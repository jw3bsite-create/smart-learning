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
 *
 * Was zusammengehört, wird in einem Zug geschrieben (`schreibeMehrere`):
 * Eine Antwort und der neue Termin, eine verschobene Karte und ihr Lernstand.
 * Ein Zug gelingt ganz oder gar nicht — bricht er ab, bleibt der alte Stand.
 */

/*
 * Die Namen der Datenbanken bleiben, was sie waren, auch nachdem die App
 * umbenannt wurde. Sie sind kein Titel, sondern eine Adresse: Ein Browser
 * findet die abgelegten Daten allein unter diesem Namen wieder. Ein neuer Name
 * hiesse eine neue, leere Datenbank — und die alte laege unerreichbar daneben.
 */
const DB_NAME = "karteikasten";
const SICHERUNG_DB = "karteikasten-sicherung";
const VERSION = 7;

/** So viele automatische Sicherungen bleiben liegen; ältere werden weggeräumt. */
const SICHERUNGEN_HOECHSTENS = 8;

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
 * Fassung 7: lernzeit (Zeitbloecke: wie lange gelernt, wie lange erstellt)
 *
 * Diese Fassung betrifft nur den Aufbau der Ablagen. Änderungen an der Form
 * der Einträge selbst regelt core/migrationen.js.
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
  lernzeit: { keyPath: "id", indexes: { tag: "tag", fach: "subjectId" } },
};

export const STORES = Object.keys(SCHEMA);
/**
 * Ablagen, die mit der Wolke abgeglichen werden.
 * `reviews` ist nur-anhängend — dort kann es keinen Streit zweier Geräte geben.
 * `kilog` bleibt bewusst auf dem Gerät: Es ist ein Protokoll, kein Bestand.
 */
export const SYNCED = ["folders", "sets", "cards", "progress", "subjects",
  "cardstates", "reviews", "drafts", "explanations", "exams", "noten", "lernzeit"];

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
 * `sitzungen` fehlte bis Fassung 8 der Sicherungsdatei; ältere Dateien haben
 * das Feld nicht, und das ist in Ordnung.
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
  lernzeit: "lernzeiten",
  sessions: "sitzungen",
};

/* ------------------------------ Meldungen ------------------------------ */

/*
 * Zwei Lagen, die nur die Datenbank bemerkt und die Oberfläche doch zeigen
 * muss:
 *
 *   "blockiert"    Eine neue Fassung will den Speicher umbauen, aber ein
 *                  anderer Reiter hält ihn noch offen. Ohne Meldung stünde
 *                  „wird geöffnet …" für immer da.
 *   "neueFassung"  Umgekehrt: Dieser Reiter ist der alte. Er gibt den
 *                  Speicher frei und bittet ums Neuladen.
 */
const beobachter = new Set();
export function beobachte(fn) {
  beobachter.add(fn);
  return () => beobachter.delete(fn);
}
function melde(art) {
  for (const fn of beobachter) { try { fn(art); } catch (e) { /* weiter */ } }
}

/* ------------------------------ Öffnen --------------------------------- */

let dbPromise = null;

function oeffneRoh(name, version, aufUpgrade) {
  return new Promise((fertig, schief) => {
    const req = version ? indexedDB.open(name, version) : indexedDB.open(name);
    if (aufUpgrade) req.onupgradeneeded = () => aufUpgrade(req);
    req.onblocked = () => melde("blockiert");
    req.onsuccess = () => fertig(req.result);
    req.onerror = () => schief(req.error);
  });
}

function oeffneSicherungsDb() {
  return oeffneRoh(SICHERUNG_DB, 1, (req) => {
    if (!req.result.objectStoreNames.contains("stand"))
      req.result.createObjectStore("stand", { keyPath: "id" });
  });
}

/** Alle Einträge der genannten Ablagen einer offenen Datenbank, in einem Zug. */
function allesLesen(verbindung, namen) {
  const daten = {};
  if (!namen.length) return Promise.resolve(daten);
  return new Promise((fertig, schief) => {
    const t = verbindung.transaction(namen, "readonly");
    for (const name of namen) {
      const req = t.objectStore(name).getAll();
      req.onsuccess = () => { daten[name] = req.result || []; };
    }
    t.oncomplete = () => fertig(daten);
    t.onerror = () => schief(t.error);
    t.onabort = () => schief(t.error);
  });
}

/**
 * Legt eine vollständige Kopie in eine zweite Datenbank — vor jeder
 * Umstellung, vor dem Einlesen einer Sicherung. Bilder bleiben außen vor,
 * sie sind groß und werden dabei nicht angefasst.
 *
 * Die zweite Datenbank liegt im selben Browser. Gegen einen Browser, der
 * aufräumt, hilft sie nicht (dafür gibt es die Sicherungsdatei), wohl aber
 * gegen eine Umstellung, die schiefgeht.
 */
async function kopieAblegen(verbindung, grund, vonFassung = VERSION) {
  const namen = [...verbindung.objectStoreNames].filter((n) => n !== "media");
  const daten = await allesLesen(verbindung, namen);
  const sicherung = await oeffneSicherungsDb();
  try {
    await new Promise((fertig, schief) => {
      const t = sicherung.transaction("stand", "readwrite");
      const ablage = t.objectStore("stand");
      const zeit = Date.now();
      ablage.put({
        id: "v" + vonFassung + "-" + new Date(zeit).toISOString().slice(0, 19) + "-" + grund,
        vonFassung, nachFassung: VERSION, grund, zeit, daten,
      });
      // Nur die jüngsten behalten, sonst wächst die zweite Datenbank mit
      // jeder Umstellung um den ganzen Bestand.
      const alle = ablage.getAll();
      alle.onsuccess = () => {
        const liste = (alle.result || []).sort((a, b) => (b.zeit || 0) - (a.zeit || 0));
        for (const alt of liste.slice(SICHERUNGEN_HOECHSTENS)) ablage.delete(alt.id);
      };
      t.oncomplete = () => fertig();
      t.onerror = () => schief(t.error);
      t.onabort = () => schief(t.error);
    });
  } finally {
    sicherung.close();
  }
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
      try {
        const alt = await oeffneRoh(DB_NAME);
        try { await kopieAblegen(alt, "umbau", fassung); } finally { alt.close(); }
      } catch (e) {
        console.warn("Sicherung vor dem Umbau misslungen:", e);
      }
    }
    const verbindung = await oeffneRoh(DB_NAME, VERSION, (req) => {
      const d = req.result;
      for (const [name, def] of Object.entries(SCHEMA)) {
        const store = d.objectStoreNames.contains(name)
          ? req.transaction.objectStore(name)
          : d.createObjectStore(name, { keyPath: def.keyPath });
        for (const [idx, feld] of Object.entries(def.indexes))
          if (!store.indexNames.contains(idx)) store.createIndex(idx, feld);
      }
    });
    // Eine neuere Fassung in einem anderen Reiter will umbauen: freigeben.
    verbindung.onversionchange = () => {
      verbindung.close();
      dbPromise = null;
      melde("neueFassung");
    };
    return verbindung;
  })();
  // Ein misslungenes Öffnen soll beim nächsten Versuch neu probiert werden.
  dbPromise.catch(() => { dbPromise = null; });
  return dbPromise;
}

/** Nur für Prüfungen: Verbindung schließen und vergessen. */
export async function _zuruecksetzen() {
  if (dbPromise) {
    try { (await dbPromise).close(); } catch (e) { /* egal */ }
  }
  dbPromise = null;
}

/* ------------------------- Sicherungen im Browser ----------------------- */

/** Eine Kopie des jetzigen Bestands in die zweite Datenbank legen. */
export async function sicherungAnlegen(grund = "hand") {
  const verbindung = await openDb();
  await kopieAblegen(verbindung, grund);
}

/** Die abgelegten Sicherungen — für den Notfall und zur Beruhigung. */
export async function sicherungen() {
  try {
    const d = await oeffneSicherungsDb();
    const liste = await allesLesen(d, ["stand"]).then((x) => x.stand);
    d.close();
    return liste.map(({ id, vonFassung, nachFassung, zeit, grund, daten }) => ({
      id, vonFassung, nachFassung, zeit, grund,
      umfang: Object.fromEntries(Object.entries(daten || {}).map(([k, v]) => [k, v.length])),
    })).sort((a, b) => (b.zeit || 0) - (a.zeit || 0));
  } catch (e) {
    return [];
  }
}

/**
 * Eine abgelegte Kopie in der Form einer Sicherungsdatei — zum Zurückholen.
 * Bilder und Aufnahmen sind nicht darin; `ohneMedien` lässt sie beim
 * Ersetzen darum unangetastet.
 */
export async function kopieAlsSicherung(kennung) {
  const d = await oeffneSicherungsDb();
  try {
    const rec = await new Promise((fertig, schief) => {
      const req = d.transaction("stand", "readonly").objectStore("stand").get(kennung);
      req.onsuccess = () => fertig(req.result || null);
      req.onerror = () => schief(req.error);
    });
    if (!rec) return null;
    const datei = { fassung: 8, erzeugt: rec.zeit, ohneMedien: true, bilder: [] };
    for (const [ablage, feld] of Object.entries(SICHERUNG_FELDER))
      if (Array.isArray(rec.daten?.[ablage])) datei[feld] = rec.daten[ablage];
    const e = (rec.daten?.settings || []).find((s) => s.key === "einstellungen");
    if (e) datei.einstellungen = e.value;
    return datei;
  } finally {
    d.close();
  }
}

/* ------------------------------ Zugriffe -------------------------------- */

/**
 * Ein Zug über eine oder mehrere Ablagen.
 * `fn` bekommt die Ablage (bei einem Namen) oder ein Verzeichnis Name → Ablage.
 */
function tx(ablagen, mode, fn) {
  const namen = Array.isArray(ablagen) ? ablagen : [ablagen];
  return openDb().then((d) => new Promise((resolve, reject) => {
    let t;
    try { t = d.transaction(namen, mode); } catch (e) { reject(e); return; }
    let zurueck;
    try {
      const ablageVon = Object.fromEntries(namen.map((n) => [n, t.objectStore(n)]));
      zurueck = fn(Array.isArray(ablagen) ? ablageVon : ablageVon[ablagen], t);
    } catch (e) {
      try { t.abort(); } catch (e2) { /* schon zu */ }
      reject(e);
      return;
    }
    /* Ausdrücklich abschließen: Alle Aufträge sind gestellt. Ohne das wartet
       der Browser, ob noch etwas kommt — und wird die Seite in diesem Moment
       verlassen oder neu geladen, verwirft er den ganzen Zug. Genau das
       geschah mit dem zuletzt Getippten beim Wegwischen der App. */
    if (mode === "readwrite" && typeof t.commit === "function") {
      try { t.commit(); } catch (e) { /* ältere Browser: schließt von selbst */ }
    }
    t.oncomplete = () => resolve(zurueck && "result" in zurueck ? zurueck.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error("Der Speichervorgang wurde abgebrochen."));
  }));
}

/** Alles aus einer Ablage; Grabsteine bleiben standardmäßig außen vor. */
export async function all(store, { mitGeloeschten = false } = {}) {
  const liste = await tx(store, "readonly", (s) => s.getAll());
  const daten = liste || [];
  return mitGeloeschten ? daten : daten.filter((d) => !d.deleted);
}

/** Mehrere Ablagen in einem Zug lesen — ein Stand, der zusammenpasst. */
export async function lesenMehrere(ablagen, { mitGeloeschten = false } = {}) {
  const d = await openDb();
  const roh = await allesLesen(d, ablagen);
  if (mitGeloeschten) return roh;
  return Object.fromEntries(Object.entries(roh).map(([k, v]) => [k, v.filter((x) => !x.deleted)]));
}

export async function get(store, id) {
  const rec = await tx(store, "readonly", (s) => s.get(id));
  return rec === undefined ? null : rec;
}

export async function put(store, rec) {
  await tx(store, "readwrite", (s) => { s.put(rec); });
  return rec;
}

export async function putMany(store, recs) {
  if (!recs.length) return;
  await tx(store, "readwrite", (s) => { for (const r of recs) s.put(r); });
}

/**
 * Schreibt in mehrere Ablagen in einem Zug: { cards: [...], cardstates: [...] }.
 * Gelingt ganz oder gar nicht.
 */
export async function schreibeMehrere(eintraege) {
  const namen = Object.keys(eintraege).filter((n) => eintraege[n]?.length);
  if (!namen.length) return;
  await tx(namen, "readwrite", (ablagen) => {
    for (const n of namen) for (const r of eintraege[n]) ablagen[n].put(r);
  });
}

/**
 * Leert Ablagen und schreibt neu, in einem Zug. Für das Einlesen einer
 * Sicherung: Bricht es ab, ist nichts gelöscht.
 */
export async function ersetzeUndSchreibe({ leeren = [], schreiben = {} }) {
  const namen = [...new Set([...leeren, ...Object.keys(schreiben)])];
  if (!namen.length) return;
  await tx(namen, "readwrite", (ablagen) => {
    for (const n of leeren) ablagen[n].clear();
    for (const [n, recs] of Object.entries(schreiben)) for (const r of recs) ablagen[n].put(r);
  });
}

/** Endgültig entfernen (ohne Grabstein) — nur für Bilder und Sitzungen. */
export async function remove(store, id) {
  await tx(store, "readwrite", (s) => { s.delete(id); });
}

export async function clear(store) {
  await tx(store, "readwrite", (s) => { s.clear(); });
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
  const alles = await lesenMehrere(SYNCED, { mitGeloeschten: true });
  const weg = Object.fromEntries(Object.entries(alles).map(([ablage, liste]) =>
    [ablage, liste.filter((r) => r.deleted && (r.updatedAt || 0) < grenze).map((r) => r.id)]));
  const namen = Object.keys(weg).filter((n) => weg[n].length);
  if (!namen.length) return;
  await tx(namen, "readwrite", (ablagen) => {
    for (const n of namen) for (const id of weg[n]) ablagen[n].delete(id);
  });
}
