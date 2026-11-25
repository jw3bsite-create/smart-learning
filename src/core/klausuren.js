/*
 * Klausuren — mehrere je Fach, jede mit Datum und den Stapeln, die
 * dazugehören (Wunsch des Nutzers, 25. November 2026).
 *
 * Vorher hatte ein Fach genau einen Prüfungstermin (`pruefungsdatum`). Daran
 * hängen Endspurt, „Reicht die Zeit?“, Kalender und Startseite. Das bleibt
 * so: Sobald ein Fach Klausuren hat, ist sein `pruefungsdatum` die nächste
 * kommende Klausur — abgeleitet im Datenspeicher (`mitKlausurTermin`), nicht
 * gespeichert. Ein Fach ohne Klausurliste behält seinen alten Termin; in der
 * Oberfläche erscheint er als erste Klausur und wird beim ersten Ändern zu
 * einer echten.
 *
 * Zuordnen lassen sich Fachordner (ein Ordner auch zu mehreren Klausuren,
 * mit seinen Unterordnern) und einzelne Stapel. Ohne jede Zuordnung gehört
 * das ganze Fach dazu.
 *
 * Nach dem Tag der Klausur zählt sie nicht mehr: Ihre Stapel bleiben ganz
 * normal im Plan, nur Sortierung und Marke vergessen sie.
 */

import { id, jetzt } from "./model.js";
import { abrufStapel } from "./fachordner.js";

const TAG = 24 * 3600 * 1000;

export function neueKlausur({ name = "", datum = null, ordnerIds = [], stapelIds = [] } = {}) {
  return {
    id: id("kl"),
    name: String(name || "").trim(),
    datum: datum === null || datum === undefined ? null : Number(datum),
    ordnerIds: [...new Set(ordnerIds || [])],
    stapelIds: [...new Set(stapelIds || [])],
    createdAt: jetzt(),
  };
}

/** Die Klausuren eines Fachs — ältere Fächer mit nur einem Termin bekommen ihn als erste. */
export function klausurenVon(fach) {
  if (!fach) return [];
  if (Array.isArray(fach.klausuren)) return fach.klausuren;
  if (fach.pruefungsdatum) {
    return [{ id: "termin", name: "Prüfung", datum: Number(fach.pruefungsdatum), ordnerIds: [], stapelIds: [] }];
  }
  return [];
}

/* Am Tag der Klausur zählt sie noch, ab dem Tag danach nicht mehr. */
const kommt = (k, zeit) => Number.isFinite(k?.datum) && k.datum + TAG > zeit;

/** Die kommenden Klausuren eines Fachs, die nächste zuerst. */
export function kommendeKlausuren(fach, zeit = Date.now()) {
  return klausurenVon(fach).filter((k) => kommt(k, zeit)).sort((a, b) => a.datum - b.datum);
}

export function naechsteKlausur(fach, zeit = Date.now()) {
  return kommendeKlausuren(fach, zeit)[0] || null;
}

/**
 * Das Fach, wie es der Rest der App sieht: mit `pruefungsdatum` = nächste
 * kommende Klausur. Ohne Klausurliste unverändert.
 */
export function mitKlausurTermin(fach, zeit = Date.now()) {
  if (!fach || !Array.isArray(fach.klausuren)) return fach;
  const n = naechsteKlausur(fach, zeit);
  return { ...fach, pruefungsdatum: n ? n.datum : null, naechsteKlausur: n };
}

/** Gehört die Klausur zum ganzen Fach (nichts Einzelnes zugeordnet)? */
export const ganzesFach = (k) => !(k?.ordnerIds?.length) && !(k?.stapelIds?.length);

/** Die Kennungen der Stapel, die zu einer Klausur gehören. */
export function stapelDerKlausur(klausur, fach, stapel, ordner) {
  const eigene = (stapel || []).filter((s) => !s.deleted && s.subjectId === fach?.id);
  if (ganzesFach(klausur)) return new Set(eigene.map((s) => s.id));
  const ids = abrufStapel(stapel || [], ordner || [], fach.id, klausur.ordnerIds || []);
  for (const sid of klausur.stapelIds || []) if (eigene.some((s) => s.id === sid)) ids.add(sid);
  return ids;
}

/**
 * Für jeden Stapel die nächste kommende Klausur, zu der er gehört —
 * für Sortierung und Marke. Zurück: Map stapelId → { klausur, fach }.
 */
export function klausurJeStapel(faecher, stapel, ordner, zeit = Date.now()) {
  const ergebnis = new Map();
  for (const fach of faecher || []) {
    if (!fach || fach.deleted) continue;
    for (const k of kommendeKlausuren(fach, zeit)) {
      for (const sid of stapelDerKlausur(k, fach, stapel, ordner)) {
        const da = ergebnis.get(sid);
        if (!da || k.datum < da.klausur.datum) ergebnis.set(sid, { klausur: k, fach });
      }
    }
  }
  return ergebnis;
}

/** Tage bis zur Klausur (0 = heute). */
export function tageBis(klausur, zeit = Date.now()) {
  if (!klausur || !Number.isFinite(klausur.datum)) return null;
  const heute = new Date(zeit); heute.setHours(0, 0, 0, 0);
  const tag = new Date(klausur.datum); tag.setHours(0, 0, 0, 0);
  return Math.round((tag - heute) / TAG);
}

/** „heute“, „morgen“, „in 6 Tagen“. */
export function tageText(tage) {
  if (tage === null) return "";
  if (tage <= 0) return "heute";
  if (tage === 1) return "morgen";
  return "in " + tage + " Tagen";
}

/* ----------------------------- Sortieren ----------------------------- */

export const SORTIERUNGEN = [
  { id: "geaendert", name: "Zuletzt geändert" },
  { id: "name", name: "Name" },
  { id: "karten", name: "Anzahl Karten" },
  { id: "gelernt", name: "Zuletzt gelernt" },
  { id: "erstellt", name: "Erstellt" },
  { id: "faellig", name: "Fällig" },
  { id: "klausur", name: "Klausur" },
];

/** Bei diesen Sortierungen kommt eine flache Liste aller Stapel (auch aus Unterordnern). */
export const FLACH = new Set(["faellig", "klausur"]);

/**
 * Sortiert Stapel. `info(s)` liefert, was die Sortierung braucht:
 * { karten, faellig, gelernt, klausurDatum }. Bei Gleichstand: Name.
 */
export function stapelSortieren(liste, art, info) {
  const name = (s) => (s.title || "").toLocaleLowerCase("de");
  const nachName = (a, b) => name(a).localeCompare(name(b), "de");
  const zahl = (wert, ersatz) => (Number.isFinite(wert) ? wert : ersatz);
  const vergleich = {
    geaendert: (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0),
    name: () => 0,
    karten: (a, b) => info(b).karten - info(a).karten,
    gelernt: (a, b) => zahl(info(b).gelernt, -1) - zahl(info(a).gelernt, -1),
    erstellt: (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
    faellig: (a, b) => info(b).faellig - info(a).faellig,
    klausur: (a, b) => zahl(info(a).klausurDatum, Infinity) - zahl(info(b).klausurDatum, Infinity),
  }[art] || (() => 0);
  return [...liste].sort((a, b) => vergleich(a, b) || nachName(a, b));
}
