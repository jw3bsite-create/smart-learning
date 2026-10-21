/*
 * Die tägliche Sicherung, still im Hintergrund.
 *
 * Bisher sicherte die App nur von Hand — und von Hand sichert man selten.
 * Jetzt legt sie einmal je Lerntag selbst eine Sicherung ab, ohne Bilder
 * und Aufnahmen, an zwei Orten:
 *
 *   im Browser  in der zweiten Datenbank (db.js), die letzten sieben Tage.
 *               Hilft, wenn etwas versehentlich gelöscht wurde.
 *   in der Wolke  im eigenen Supabase-Speicher unter
 *               `<kennung>/sicherungen/JJJJ-MM-TT.json`, die letzten
 *               vierzehn Tage. Hilft auch, wenn der Browser seinen Speicher
 *               räumt oder das Gerät verloren geht.
 *
 * Der Abgleich allein ersetzt das nicht: Er gleicht auch das Löschen ab.
 * Eine Sicherung ist ein Stand, den nichts mehr verändert.
 */

import * as db from "./db.js";
import { verbinde } from "./cloud.js";
import { tagesSchluessel } from "./util.js";

export const WOLKE_TAGE = 14;
const EIMER = "bilder";
const ORDNER = "sicherungen";

/* ------------------------------ Im Browser ------------------------------ */

/** Legt die heutige Kopie im Browser an, falls es sie noch nicht gibt. */
export async function lokalSichern(jetzt = Date.now()) {
  const heute = tagesSchluessel(jetzt);
  const liste = await db.sicherungen();
  if (liste.some((k) => k.grund === "taeglich" && tagesSchluessel(k.zeit) === heute)) return false;
  await db.sicherungAnlegen("taeglich");
  return true;
}

/* ------------------------------- In der Wolke --------------------------- */

async function zugang() {
  const k = await verbinde();
  if (!k) return null;
  const { data } = await k.auth.getSession();
  const uid = data?.session?.user?.id;
  return uid ? { k, uid } : null;
}

/** Welche Namen nach dem Hochladen gehen dürfen: alles über die letzten `behalten`. */
export function ueberzaehlig(namen, behalten = WOLKE_TAGE) {
  return [...namen].filter((n) => /^\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort().reverse().slice(behalten);
}

/**
 * Legt die heutige Sicherung in der Wolke ab, einmal je Lerntag.
 * `alsSicherung` kommt aus dem Bestand (ohne Medien).
 */
export async function wolkeSichern(alsSicherung, jetzt = Date.now()) {
  const heute = tagesSchluessel(jetzt);
  if ((await db.getSetting("wolkeSicherungTag", "")) === heute) return false;
  const z = await zugang();
  if (!z) return false;
  const daten = await alsSicherung({ mitMedien: false });
  const blob = new Blob([JSON.stringify(daten)], { type: "application/json" });
  const pfad = z.uid + "/" + ORDNER + "/" + heute + ".json";
  const { error } = await z.k.storage.from(EIMER).upload(pfad, blob,
    { upsert: true, contentType: "application/json" });
  if (error) throw new Error(error.message);

  const { data: liste } = await z.k.storage.from(EIMER).list(z.uid + "/" + ORDNER, { limit: 100 });
  const weg = ueberzaehlig((liste || []).map((d) => d.name));
  if (weg.length) await z.k.storage.from(EIMER).remove(weg.map((n) => z.uid + "/" + ORDNER + "/" + n));
  await db.setSetting("wolkeSicherungTag", heute);
  return true;
}

/** Die Sicherungen in der Wolke, jüngste zuerst: `[{ name, tag }]`. */
export async function wolkenSicherungen() {
  const z = await zugang();
  if (!z) return [];
  const { data, error } = await z.k.storage.from(EIMER).list(z.uid + "/" + ORDNER, { limit: 100 });
  if (error) return [];
  return (data || []).map((d) => d.name).filter((n) => /^\d{4}-\d{2}-\d{2}\.json$/.test(n))
    .sort().reverse().map((name) => ({ name, tag: name.slice(0, 10) }));
}

/** Eine Sicherung aus der Wolke holen, als Inhalt einer Sicherungsdatei. */
export async function wolkenSicherungLaden(name) {
  const z = await zugang();
  if (!z) throw new Error("Dafür musst du in der Cloud angemeldet sein.");
  const { data, error } = await z.k.storage.from(EIMER).download(z.uid + "/" + ORDNER + "/" + name);
  if (error || !data) throw new Error(error?.message || "Die Sicherung ließ sich nicht laden.");
  return JSON.parse(await data.text());
}
