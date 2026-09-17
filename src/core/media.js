/*
 * Bilder auf Karteikarten.
 *
 * Bilder werden vor dem Ablegen verkleinert (längste Kante 1400 Punkte) und
 * als WebP gespeichert. Ein Handyfoto von vier Megabyte schrumpft so auf
 * wenige Hundert Kilobyte — wichtig, weil Hunderte Karten sonst den Speicher
 * des Browsers füllen und der Abgleich mit der Wolke zäh wird.
 */

import { id } from "./model.js";
import * as db from "./db.js";
import { tonTeile } from "./ton.js";

const MAX_KANTE = 1400;
const urlZwischenspeicher = new Map();

async function verkleinern(datei) {
  const bild = await createImageBitmap(datei).catch(() => null);
  if (!bild) return { blob: datei, breite: 0, hoehe: 0 };
  const faktor = Math.min(1, MAX_KANTE / Math.max(bild.width, bild.height));
  const breite = Math.round(bild.width * faktor);
  const hoehe = Math.round(bild.height * faktor);
  const flaeche = document.createElement("canvas");
  flaeche.width = breite; flaeche.height = hoehe;
  const stift = flaeche.getContext("2d");
  stift.drawImage(bild, 0, 0, breite, hoehe);
  bild.close?.();
  const blob = await new Promise((fertig) =>
    flaeche.toBlob((b) => fertig(b), "image/webp", 0.85));
  return { blob: blob || datei, breite, hoehe };
}

/** Nimmt eine Datei auf und gibt die Kennung des Bildes zurück. */
export async function bildAufnehmen(datei) {
  if (!datei || !/^image\//.test(datei.type)) return null;
  const { blob, breite, hoehe } = await verkleinern(datei);
  const kennung = id("b");
  await db.put("media", { id: kennung, blob, type: blob.type || datei.type,
    breite, hoehe, updatedAt: Date.now() });
  urlZwischenspeicher.set(kennung, URL.createObjectURL(blob));
  return kennung;
}

/** Legt ein bereits fertiges Blob unter bekannter Kennung ab (für den Abgleich). */
export async function bildAblegen(kennung, blob) {
  await db.put("media", { id: kennung, blob, type: blob.type, updatedAt: Date.now() });
  urlZwischenspeicher.delete(kennung);
}

/** Adresse zum Anzeigen. Ergebnis wird gemerkt, damit nicht ständig neue entstehen. */
export async function bildUrl(kennung) {
  if (!kennung) return null;
  if (urlZwischenspeicher.has(kennung)) return urlZwischenspeicher.get(kennung);
  const rec = await db.get("media", kennung);
  if (!rec || !rec.blob) return null;
  const url = URL.createObjectURL(rec.blob);
  urlZwischenspeicher.set(kennung, url);
  return url;
}

export async function bildBlob(kennung) {
  const rec = await db.get("media", kennung);
  return rec ? rec.blob : null;
}

export async function bildLoeschen(kennung) {
  if (!kennung) return;
  const url = urlZwischenspeicher.get(kennung);
  if (url) URL.revokeObjectURL(url);
  urlZwischenspeicher.delete(kennung);
  await db.remove("media", kennung);
}

/** Alle abgelegten Bildkennungen — zum Aufräumen verwaister Bilder. */
export async function alleBilder() {
  return db.all("media", { mitGeloeschten: true });
}

/** Liest eine Datei aus einem Einfüge- oder Ziehvorgang. */
export function dateiAusEreignis(ev) {
  const dt = ev.clipboardData || ev.dataTransfer;
  if (!dt) return null;
  for (const el of dt.items || []) {
    if (el.kind === "file" && /^image\//.test(el.type)) return el.getAsFile();
  }
  for (const f of dt.files || []) if (/^image\//.test(f.type)) return f;
  return null;
}

/**
 * Räumt Bilder weg, auf die keine Karte und kein Entwurf mehr zeigt.
 *
 * Nötig, weil beim Löschen einer Karte nur ein Grabstein bleibt: Das Bild
 * selbst wüsste sonst niemand mehr zu finden und läge doch weiter im
 * Speicher. Bei abfotografierten Buchseiten summiert sich das schnell auf
 * Megabyte, die kein Mensch je wiedersieht.
 *
 * Vorsichtig gefasst: Bilder gelöschter Karten bleiben, solange der Grabstein
 * lebt (sechzig Tage) — sonst käme eine aus dem Papierkorb geholte Karte ohne
 * ihr Bild zurück.
 */
export async function verwaisteBilderAufraeumen({ trocken = false } = {}) {
  const [karten, entwuerfe, bilder] = await Promise.all([
    db.all("cards", { mitGeloeschten: true }),
    db.all("drafts", { mitGeloeschten: true }),
    db.all("media", { mitGeloeschten: true }),
  ]);

  const verwaist = verwaisteMedien(karten, entwuerfe, bilder);
  const bytes = verwaist.reduce((n, b) => n + (b.blob?.size || 0), 0);

  if (!trocken) for (const b of verwaist) await bildLoeschen(b.id);

  return { anzahl: verwaist.length, bytes, geprueft: bilder.length };
}

/**
 * Welche Mediendateien auf nichts mehr zeigen — als reine Funktion, damit
 * geprueft werden kann, was hier weggeraeumt wird.
 *
 * Tonaufnahmen haengen nicht an einem Feld der Karte, sondern an ihrer
 * Kennung (`ton_<karte>_<seite>`). Genau deshalb: Der Abgleich holt nur die
 * Datei, keine Zusatzangaben — stuende die Zuordnung daneben, waere sie auf
 * dem zweiten Geraet verloren und die Aufnahme gaelte dort als verwaist.
 * `karten` und `entwuerfe` kommen mit Grabsteinen herein, damit eine aus dem
 * Papierkorb geholte Karte ihre Aufnahme behaelt.
 */
export function verwaisteMedien(karten, entwuerfe, medien) {
  const gebraucht = new Set();
  for (const k of karten) {
    if (k.termImage) gebraucht.add(k.termImage);
    if (k.defImage) gebraucht.add(k.defImage);
  }
  for (const e of entwuerfe) if (e.termImage) gebraucht.add(e.termImage);
  const kartenIds = new Set(karten.map((k) => k.id));

  return medien.filter((m) => {
    const ton = tonTeile(m.id);
    if (ton) return !kartenIds.has(ton.cardId);
    return !gebraucht.has(m.id);
  });
}
