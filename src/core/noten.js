/*
 * Punkte und Schnitte der Kursstufe.
 *
 * Baden-Württemberg rechnet in der Kursstufe nicht mit Noten, sondern mit
 * Punkten von 0 bis 15. Diese Datei rechnet damit und übersetzt am Ende in
 * die geläufige Notenzahl — nicht umgekehrt.
 *
 * Warum das überhaupt in eine Lern-App gehört: Der Lernstand sagt, wie gut
 * eine Karte sitzt. Die Punkte sagen, ob das Lernen ankommt. Beides
 * nebeneinander zu sehen ist der einzige Weg zu merken, dass man ein Fach
 * fleißig übt und trotzdem abrutscht — oder dass ein Fach ohne Karten am
 * besten läuft und die Karten anderswo nötiger wären.
 *
 * **Was hier ausdrücklich nicht gerechnet wird:** die Abiturnote. Sie entsteht
 * in Baden-Württemberg aus Block I (den Halbjahresleistungen, teils doppelt
 * gewichtet, mit Einbringungspflichten) und Block II (den Prüfungen). Welche
 * Kurse in welcher Zahl eingebracht werden müssen, steht in der Verordnung
 * für den jeweiligen Jahrgang. Die kennt diese Datei nicht, und sie rät sie
 * nicht. Was sie liefert, ist der schlichte Durchschnitt aller erfassten
 * Halbjahresleistungen — nützlich als Richtwert, und in der Oberfläche auch
 * genau so bezeichnet.
 */

import { id, jetzt } from "./model.js";

/** Die vier Halbjahre der Kursstufe, in ihrer Reihenfolge. */
export const HALBJAHRE = [
  { id: "12.1", stufe: "TGG12", teil: "1. Halbjahr", kurz: "1. HJ", name: "TGG12 · 1. Halbjahr" },
  { id: "12.2", stufe: "TGG12", teil: "2. Halbjahr", kurz: "2. HJ", name: "TGG12 · 2. Halbjahr" },
  { id: "13.1", stufe: "TGG13", teil: "1. Halbjahr", kurz: "1. HJ", name: "TGG13 · 1. Halbjahr" },
  { id: "13.2", stufe: "TGG13", teil: "2. Halbjahr", kurz: "2. HJ", name: "TGG13 · 2. Halbjahr" },
];

export const HALBJAHR_IDS = HALBJAHRE.map((h) => h.id);

export const istHalbjahr = (was) => HALBJAHR_IDS.includes(was);

/** Die drei Arten von Leistungen. */
export const ARTEN = {
  schriftlich: { name: "Schriftlich", kurz: "S" },
  muendlich: { name: "Mündlich", kurz: "M" },
  praktisch: { name: "Praktisch", kurz: "P" },
};

export const ART_IDS = Object.keys(ARTEN);

/** Punkte liegen zwischen null und fünfzehn. */
export const PUNKTE_MIN = 0;
export const PUNKTE_MAX = 15;

/* ===================================================================== */
/*  Datensätze                                                           */
/* ===================================================================== */

/**
 * Ein Fach in einem Halbjahr.
 *
 * Ein Datensatz je Fach **und** Halbjahr, nicht ein Fach mit vier Fächern
 * darin: So bleibt jede Zeile für sich änderbar, und der Abgleich zwischen
 * zwei Geräten kann nicht ein ganzes Schuljahr auf einmal überschreiben, wenn
 * beide am selben Tag etwas eingetragen haben.
 */
export function neuesNotenfach({ halbjahr, fach, subjectId = null }) {
  return {
    id: id("n"),
    halbjahr,
    fach: String(fach || "").trim(),
    subjectId,                 // Verknüpfung mit einem Lernfach, freiwillig
    leistungen: [],
    /* Wie die drei Arten gegeneinander zählen. Alle gleich, bis der Nutzer es
       ändert — was an einer Schule gilt, steht in keiner Datei, die wir haben. */
    artGewicht: { schriftlich: 1, muendlich: 1, praktisch: 1 },
    endpunkte: null,           // von Hand gesetzt, sticht die Rechnung
    createdAt: jetzt(), updatedAt: jetzt(), deleted: false,
  };
}

export function neueLeistung({ art = "schriftlich", punkte = 0, gewicht = 1, was = "" } = {}) {
  return {
    id: id("l"),
    art: ART_IDS.includes(art) ? art : "schriftlich",
    punkte: begrenze(punkte),
    gewicht: Math.max(0, zahl(gewicht, 1)),
    was: String(was || ""),
    zeit: jetzt(),
  };
}

/* ===================================================================== */
/*  Rechnen                                                              */
/* ===================================================================== */

function zahl(wert, ersatz = 0) {
  const n = typeof wert === "string" ? Number(wert.replace(",", ".")) : Number(wert);
  return Number.isFinite(n) ? n : ersatz;
}

/** Hält eine Punktzahl im erlaubten Bereich. */
export function begrenze(punkte) {
  return Math.min(PUNKTE_MAX, Math.max(PUNKTE_MIN, zahl(punkte, 0)));
}

/**
 * Der Schnitt einer Art — gewichtetes Mittel der einzelnen Leistungen.
 * `null`, wenn es in dieser Art nichts gibt: Eine Art ohne Leistungen soll
 * den Schnitt nicht nach unten ziehen, sondern gar nicht mitzählen.
 */
export function artSchnitt(leistungen, art) {
  const eigene = (leistungen || []).filter((l) => l && l.art === art);
  if (!eigene.length) return null;
  let summe = 0, gewicht = 0;
  for (const l of eigene) {
    const g = Math.max(0, zahl(l.gewicht, 1));
    summe += begrenze(l.punkte) * g;
    gewicht += g;
  }
  return gewicht > 0 ? summe / gewicht : null;
}

/**
 * Die Punktzahl eines Fachs.
 *
 * Erst je Art mitteln, dann die Arten nach ihrem Gewicht zusammenfassen — und
 * nicht alle Leistungen in einen Topf. Sonst zöge ein Fach mit zwölf mündlichen
 * Kleinigkeiten und einer Klausur den Schnitt dorthin, wo die Menge liegt,
 * statt dorthin, wo das Gewicht liegt.
 *
 * Eine von Hand gesetzte Endpunktzahl sticht alles: Am Ende zählt, was auf dem
 * Zeugnis steht, nicht was wir uns ausgerechnet haben.
 */
export function fachPunkte(notenfach) {
  const leistungen = notenfach?.leistungen || [];
  const proArt = {};
  for (const art of ART_IDS) proArt[art] = artSchnitt(leistungen, art);

  let summe = 0, gewicht = 0;
  for (const art of ART_IDS) {
    if (proArt[art] === null) continue;
    const g = Math.max(0, zahl(notenfach?.artGewicht?.[art], 1));
    summe += proArt[art] * g;
    gewicht += g;
  }
  const gerechnet = gewicht > 0 ? summe / gewicht : null;

  const vonHand = notenfach?.endpunkte === null || notenfach?.endpunkte === undefined
    ? null : begrenze(notenfach.endpunkte);

  const punkte = vonHand !== null ? vonHand : gerechnet;
  return {
    proArt,
    gerechnet,
    vonHand,
    punkte,
    anzahl: leistungen.length,
    // Auf dem Zeugnis stehen ganze Punkte.
    gerundet: punkte === null ? null : Math.round(punkte),
  };
}

/**
 * Der Schnitt eines Halbjahres: jedes Fach zählt einmal.
 *
 * Fächer ohne eine einzige Leistung bleiben außen vor — sie stünden sonst mit
 * null Punkten da, und ein gerade erst angelegtes Fach würde den Schnitt
 * verhageln.
 */
export function halbjahrSchnitt(faecher) {
  const werte = (faecher || [])
    .filter((f) => f && !f.deleted)
    .map((f) => fachPunkte(f).punkte)
    .filter((p) => p !== null);
  if (!werte.length) return null;
  return werte.reduce((a, b) => a + b, 0) / werte.length;
}

/**
 * Der Schnitt über alle Halbjahre.
 *
 * Gemittelt wird über die einzelnen Halbjahresleistungen, nicht über die vier
 * Halbjahresschnitte: Ein Halbjahr mit drei Fächern und eines mit zehn dürfen
 * nicht gleich schwer wiegen.
 */
export function gesamtSchnitt(alleFaecher) {
  const werte = (alleFaecher || [])
    .filter((f) => f && !f.deleted && istHalbjahr(f.halbjahr))
    .map((f) => fachPunkte(f).punkte)
    .filter((p) => p !== null);
  if (!werte.length) return null;
  return {
    punkte: werte.reduce((a, b) => a + b, 0) / werte.length,
    leistungen: werte.length,
  };
}

/**
 * Punkte in die geläufige Notenzahl.
 *
 * N = (17 − P) / 3 — die Umrechnung, die auch hinter der Tabelle
 * 15 Punkte = 1+, 5 Punkte = 4, 0 Punkte = 6 steht.
 *
 * **Das ist nicht die Abiturnote.** Die entsteht aus Block I und Block II nach
 * der Verordnung des jeweiligen Jahrgangs; diese Zahl ist ein Richtwert für
 * den eigenen Stand.
 */
export function alsNote(punkte) {
  if (punkte === null || punkte === undefined) return null;
  const n = (17 - begrenze(punkte)) / 3;
  return Math.min(6, Math.max(1, n));
}

/** Für die Anzeige: „2,3" statt „2.3333333". */
export function noteText(punkte) {
  const n = alsNote(punkte);
  return n === null ? "—" : n.toFixed(1).replace(".", ",");
}

export function punkteText(punkte) {
  if (punkte === null || punkte === undefined) return "—";
  const gerundet = Math.round(punkte * 10) / 10;
  return String(gerundet).replace(".", ",");
}

/**
 * Wie eine Punktzahl einzuordnen ist — für die Farbe in der Anzeige.
 * Fünf Punkte sind die Schwelle, unter der ein Kurs als nicht bestanden gilt.
 */
export function punkteStufe(punkte) {
  if (punkte === null || punkte === undefined) return "leer";
  if (punkte < 5) return "schlecht";
  if (punkte < 8) return "wacklig";
  if (punkte < 11) return "solide";
  return "gut";
}

/* ===================================================================== */
/*  Zusammenstellen                                                      */
/* ===================================================================== */

/** Die Fächer eines Halbjahres, alphabetisch. */
export function faecherIm(alle, halbjahr) {
  return (alle || [])
    .filter((f) => f && !f.deleted && f.halbjahr === halbjahr)
    .sort((a, b) => (a.fach || "").localeCompare(b.fach || "", "de"));
}

/** Alle Fachnamen, die irgendwo vorkommen — für Vorschläge beim Anlegen. */
export function bekannteFaecher(alle) {
  const namen = new Set();
  for (const f of alle || [])
    if (f && !f.deleted && (f.fach || "").trim()) namen.add(f.fach.trim());
  return [...namen].sort((a, b) => a.localeCompare(b, "de"));
}

/**
 * Der Verlauf eines Fachs über die Halbjahre.
 * Zeigt, ob es aufwärts oder abwärts geht — die Zahl, die man eigentlich
 * sehen will und die in keiner einzelnen Note steht.
 */
export function verlaufVon(alle, fachname) {
  return HALBJAHR_IDS.map((hj) => {
    const treffer = (alle || []).find((f) =>
      f && !f.deleted && f.halbjahr === hj
      && (f.fach || "").trim().toLowerCase() === String(fachname).trim().toLowerCase());
    return { halbjahr: hj, punkte: treffer ? fachPunkte(treffer).punkte : null };
  });
}

/** Übersicht über alle vier Halbjahre — für die Gesamtansicht. */
export function uebersicht(alle) {
  const halbjahre = HALBJAHRE.map((h) => {
    const faecher = faecherIm(alle, h.id);
    return {
      ...h,
      faecher,
      anzahl: faecher.length,
      schnitt: halbjahrSchnitt(faecher),
    };
  });
  return { halbjahre, gesamt: gesamtSchnitt(alle) };
}
