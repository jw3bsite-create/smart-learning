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

const DB_NAME = "karteikasten";
const VERSION = 1;

/** Alle Ablagen und ihre Verzeichnisse. */
const SCHEMA = {
  folders: { keyPath: "id", indexes: { parent: "parentId" } },
  sets: { keyPath: "id", indexes: { folder: "folderId" } },
  cards: { keyPath: "id", indexes: { set: "setId" } },
  progress: { keyPath: "id", indexes: { set: "setId" } },
  media: { keyPath: "id", indexes: {} },
  settings: { keyPath: "key", indexes: {} },
  sessions: { keyPath: "id", indexes: { set: "setId" } },
};

export const STORES = Object.keys(SCHEMA);
/** Ablagen, die mit der Wolke abgeglichen werden. */
export const SYNCED = ["folders", "sets", "cards", "progress"];

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
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
  return dbPromise;
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
