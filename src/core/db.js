/*
 * Speicher der App: IndexedDB.
 *
 * Warum nicht localStorage — dort fasst ein Browser je nach Hersteller nur
 * wenige Megabyte, und schon ein paar abfotografierte Vokabellisten sprengen
 * das. IndexedDB kennt diese Grenze nicht und nimmt auch Bilddateien roh auf.
 *
 * Jeder Datensatz trägt `updatedAt` (Zeitpunkt der letzten Änderung) und darf
 * `deleted: true` tragen. Gelöschtes wird also nicht sofort entfernt, sondern
 * als Grabstein behalten — sonst käme es beim Abgleich mit der Wolke von einem
 * anderen Gerät wieder zurück.
 */

/*
 * Die Namen der Datenbanken bleiben, was sie waren, auch nachdem die App
 * umbenannt wurde. Sie sind kein Titel, sondern eine Adresse: Ein Browser
 * findet die abgelegten Daten allein unter diesem Namen wieder. Ein neuer Name
 * hiesse eine neue, leere Datenbank — und die alte laege unerreichbar daneben.
 */
const DB_NAME = "karteikasten";
const SICHERUNG_DB = "karteikasten-sicherung";
const VERSION = 6;

/**
 * Alle Ablagen und ihre Verzeichnisse.
 *
 * Fassung 1: folders, sets, cards, progress, media, settings, sessions
 * Fassung 2: subjects (Fächer), cardstates (FSRS je Karte und Richtung),
 *            reviews (jede einzelne Antwort — die Historie)
 * Fassung 3: drafts (Kartenentwürfe, die noch auf ihre Rückseite warten),
 *            kilog (Protokoll der Aufrufe an ein Sprachmodell)
 * Fassung 4: explanations (Erklärungen im Feynman-Modus, versioniert)
 * Fassung 5: exams (Prüfungssimulationen samt Kriterienraster)
 * Fassung 6: noten (Punkte der Kursstufe, ein Satz je Fach und Halbjahr)
 *
 * `progress` bleibt bestehen und unangetastet: davon leben die sieben
 * Übungsmodi weiter. Über Wiederholungstermine entscheidet ab Fassung 2
 * ausschließlich `cardstates`.
 */
const SCHEMA = {
  folders: { keyPath: "id", indexes: { parent: "parentId" } },
  sets: { keyPath: "id", indexes: { folder: "folderId" } },
  cards: { keyPath: "id", indexes: { set: "setId" } },
  progress: { keyPath: "id", indexes: { set: "setId" } },
  media: { keyPath: "id", indexes: {} },
  settings: { keyPath: "key", indexes: {} },
  sessions: { keyPath: "id", indexes: { set: "setId" } },
  subjects: { keyPath: "id", indexes: {} },
  cardstates: { keyPath: "id", indexes: { karte: "cardId", fach: "subjectId", stapel: "setId" } },
  reviews: { keyPath: "id", indexes: { karte: "cardId", fach: "subjectId", zeit: "zeit" } },
  drafts: { keyPath: "id", indexes: { stapel: "setId" } },
  kilog: { keyPath: "id", indexes: { zeit: "zeit" } },
  explanations: { keyPath: "id", indexes: { thema: "themaId", fach: "subjectId" } },
  exams: { keyPath: "id", indexes: { fach: "subjectId", zeit: "zeit" } },
  noten: { keyPath: "id", indexes: { halbjahr: "halbjahr", fach: "subjectId" } },
};

export const STORES = Object.keys(SCHEMA);
/**
 * Ablagen, die mit der Wolke abgeglichen werden.
 * `reviews` ist nur-anhängend — dort kann es keinen Streit zweier Geräte geben.
 * `kilog` bleibt bewusst auf dem Gerät: Es ist ein Protokoll, kein Bestand.
 */
export const SYNCED = ["folders", "sets", "cards", "progress", "subjects",
  "cardstates", "reviews", "drafts", "explanations", "exams", "noten"];

/**
 * Wie die Ablagen in einer Sicherungsdatei heissen.
 *
 * Diese Liste steht hier und nicht dort, wo gesichert wird, weil sie an drei
 * Stellen gebraucht wird: beim Schreiben der Sicherung, beim Einlesen und in
 * der Auffanglinie. Dreimal dieselbe Liste von Hand zu fuehren ist genau die
 * Art Buchhaltung, die stillschweigend auseinanderlaeuft — als die Ablage
 * `noten` dazukam, fehlte sie prompt in allen dreien, und eine Sicherung
 * haette die Punkte kommentarlos nicht enthalten.
 *
 * Die Namen sind Teil des Dateiformats und duerfen sich nicht mehr aendern.
 */
export const SICHERUNG_FELDER = {
  folders: "ordner",
  sets: "stapel",
  cards: "karten",
  progress: "staende",
  subjects: "faecher",
  cardstates: "zustaende",
  reviews: "reviews",
  drafts: "entwuerfe",
  explanations: "erklaerungen",
  exams: "pruefungen",
  noten: "notenfaecher",
};

let dbPromise = null;

/**
 * Vor jeder Schemaänderung eine vollständige Kopie in eine zweite Datenbank.
 * Bilder bleiben außen vor — sie sind groß und werden von Migrationen nicht
 * angefasst.
 */
async function sichereVorMigration(alteVersion) {
  const alteDaten = {};
  const alt = await new Promise((fertig, schief) => {
    const req = indexedDB.open(DB_NAME);        // ohne Version: nimmt die vorhandene
    req.onsuccess = () => fertig(req.result);
    req.onerror = () => schief(req.error);
  });
  try {
    const vorhandene = [...alt.objectStoreNames].filter((n) => n !== "media");
    if (vorhandene.length) {
      await new Promise((fertig, schief) => {
        const t = alt.transaction(vorhandene, "readonly");
        for (const name of vorhandene) {
          const req = t.objectStore(name).getAll();
          req.onsuccess = () => { alteDaten[name] = req.result; };
        }
        t.oncomplete = () => fertig();
        t.onerror = () => schief(t.error);
      });
    }
  } finally {
    alt.close();
  }

  const sicherung = await new Promise((fertig, schief) => {
    const req = indexedDB.open(SICHERUNG_DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains("stand"))
        req.result.createObjectStore("stand", { keyPath: "id" });
    };
    req.onsuccess = () => fertig(req.result);
    req.onerror = () => schief(req.error);
  });
  await new Promise((fertig, schief) => {
    const t = sicherung.transaction("stand", "readwrite");
    t.objectStore("stand").put({
      id: "v" + alteVersion + "-" + new Date().toISOString().slice(0, 19),
      vonFassung: alteVersion, nachFassung: VERSION, zeit: Date.now(), daten: alteDaten,
    });
    t.oncomplete = () => fertig();
    t.onerror = () => schief(t.error);
  });
  sicherung.close();
  console.info("Sicherung vor der Migration abgelegt (Fassung " + alteVersion + ").");
}

/** Welche Fassung liegt gerade vor? 0, wenn es die Datenbank noch nicht gibt. */
async function vorhandeneFassung() {
  if (indexedDB.databases) {
    const liste = await indexedDB.databases().catch(() => []);
    const treffer = (liste || []).find((d) => d.name === DB_NAME);
    return treffer ? treffer.version || 0 : 0;
  }
  // Ältere Browser kennen databases() nicht: einmal öffnen und nachsehen.
  return new Promise((fertig) => {
    const req = indexedDB.open(DB_NAME);
    req.onsuccess = () => { const v = req.result.version; req.result.close(); fertig(v); };
    req.onerror = () => fertig(0);
  });
}

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = (async () => {
    const fassung = await vorhandeneFassung();
    if (fassung > 0 && fassung < VERSION) {
      try { await sichereVorMigration(fassung); } catch (e) {
        console.warn("Sicherung vor der Migration misslungen:", e);
      }
    }
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const [name, def] of Object.entries(SCHEMA)) {
          const store = db.objectStoreNames.contains(name)
            ? req.transaction.objectStore(name)
            : db.createObjectStore(name, { keyPath: def.keyPath });
          for (const [idx, feld] of Object.entries(def.indexes))
            if (!store.indexNames.contains(idx)) store.createIndex(idx, feld);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  })();
  return dbPromise;
}

/** Die abgelegten Sicherungen — für den Notfall und zur Beruhigung. */
export async function sicherungen() {
  try {
    const db = await new Promise((fertig, schief) => {
      const req = indexedDB.open(SICHERUNG_DB, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains("stand"))
          req.result.createObjectStore("stand", { keyPath: "id" });
      };
      req.onsuccess = () => fertig(req.result);
      req.onerror = () => schief(req.error);
    });
    const liste = await new Promise((fertig, schief) => {
      const t = db.transaction("stand", "readonly");
      const req = t.objectStore("stand").getAll();
      req.onsuccess = () => fertig(req.result || []);
      t.onerror = () => schief(t.error);
    });
    db.close();
    return liste.map(({ id, vonFassung, nachFassung, zeit, daten }) => ({
      id, vonFassung, nachFassung, zeit,
      umfang: Object.fromEntries(Object.entries(daten || {}).map(([k, v]) => [k, v.length])),
    }));
  } catch (e) {
    return [];
  }
}

function tx(store, mode, fn) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    let ergebnis;
    const zurueck = fn(t.objectStore(store), t);
    if (zurueck && typeof zurueck.then === "function") zurueck.then((v) => { ergebnis = v; });
    else if (zurueck && "result" in zurueck) t.addEventListener("complete", () => { ergebnis = zurueck.result; });
    t.oncomplete = () => resolve(ergebnis !== undefined ? ergebnis : (zurueck && zurueck.result));
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

/** Alles aus einer Ablage; Grabsteine bleiben standardmäßig außen vor. */
export async function all(store, { mitGeloeschten = false } = {}) {
  const liste = await tx(store, "readonly", (s) => s.getAll());
  const daten = liste || [];
  return mitGeloeschten ? daten : daten.filter((d) => !d.deleted);
}

export async function get(store, id) {
  const rec = await tx(store, "readonly", (s) => s.get(id));
  return rec === undefined ? null : rec;
}

export async function put(store, rec) {
  await tx(store, "readwrite", (s) => s.put(rec));
  return rec;
}

export async function putMany(store, recs) {
  if (!recs.length) return;
  await tx(store, "readwrite", (s) => { for (const r of recs) s.put(r); });
}

/** Endgültig entfernen (ohne Grabstein) — nur für Bilder und Sitzungen. */
export async function remove(store, id) {
  await tx(store, "readwrite", (s) => s.delete(id));
}

export async function clear(store) {
  await tx(store, "readwrite", (s) => s.clear());
}

/** Einstellung lesen; `standard`, wenn nichts hinterlegt ist. */
export async function getSetting(key, standard = null) {
  const rec = await get("settings", key);
  return rec ? rec.value : standard;
}

export async function setSetting(key, value) {
  await put("settings", { key, value });
  return value;
}

/** Grabsteine, die älter als 60 Tage sind, endgültig wegräumen. */
export async function pruneTombstones() {
  const grenze = Date.now() - 60 * 24 * 3600 * 1000;
  for (const store of SYNCED) {
    const alle = await all(store, { mitGeloeschten: true });
    for (const rec of alle)
      if (rec.deleted && (rec.updatedAt || 0) < grenze) await remove(store, rec.id);
  }
}
