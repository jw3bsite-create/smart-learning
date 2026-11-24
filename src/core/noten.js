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

/**
 * Sorten von Leistungen innerhalb einer Art — Klassenarbeit, Test, GFS …
 *
 * Jede Sorte trägt ein Gewicht, das für alle Leistungen dieser Sorte gilt:
 * Wer einmal festlegt „ein Test zählt halb so viel wie eine Klassenarbeit“,
 * muss es nicht bei jedem Test neu eintippen. Die Zahlen sind ein Vorschlag
 * zum Ändern; was an der eigenen Schule gilt, steht in keiner Datei.
 *
 * Ein Fach ohne eigene Liste (alle, die vor dem 24.11.2026 angelegt wurden)
 * bekommt diese hier.
 */
export const STANDARD_SORTEN = [
  { id: "klassenarbeit", name: "Klassenarbeit", art: "schriftlich", gewicht: 1 },
  { id: "test", name: "Test", art: "schriftlich", gewicht: 0.5 },
];

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
export function neuesNotenfach({ halbjahr, fach, subjectId = null, sorten = null, artGewicht = null }) {
  return {
    id: id("n"),
    halbjahr,
    fach: String(fach || "").trim(),
    subjectId,                 // Verknüpfung mit einem Lernfach, freiwillig
    leistungen: [],
    /* Wie die drei Arten gegeneinander zählen. Alle gleich, bis der Nutzer es
       ändert — was an einer Schule gilt, steht in keiner Datei, die wir haben. */
    artGewicht: { schriftlich: 1, muendlich: 1, praktisch: 1, ...(artGewicht || {}) },
    sorten: (sorten || STANDARD_SORTEN).map((x) => ({ ...x })),
    endpunkte: null,           // von Hand gesetzt, sticht die Rechnung
    createdAt: jetzt(), updatedAt: jetzt(), deleted: false,
  };
}

/**
 * Eine Leistung. Ohne Punkte (`null`) ist sie angelegt, aber noch nicht
 * eingetragen — sie zählt dann nicht mit, statt mit null Punkten den Schnitt
 * zu verhageln, bis man die Zahl eingetippt hat.
 */
export function neueLeistung({ art = "schriftlich", punkte = null, gewicht = 1, was = "", sorte = null } = {}) {
  return {
    id: id("l"),
    art: ART_IDS.includes(art) ? art : "schriftlich",
    punkte: punkte === null || punkte === undefined || punkte === "" ? null : begrenze(punkte),
    gewicht: Math.max(0, zahl(gewicht, 1)),
    sorte: sorte || null,
    was: String(was || ""),
    zeit: jetzt(),
  };
}

export function neueSorte({ name = "", art = "schriftlich", gewicht = 1 } = {}) {
  return {
    id: id("s"),
    name: String(name || ""),
    art: ART_IDS.includes(art) ? art : "schriftlich",
    gewicht: Math.max(0, zahl(gewicht, 1)),
  };
}

/** Die Sorten eines Fachs — ältere Fächer ohne eigene Liste nehmen die üblichen. */
export function sortenVon(notenfach) {
  return Array.isArray(notenfach?.sorten) ? notenfach.sorten : STANDARD_SORTEN;
}

/**
 * Das Gewicht, mit dem eine Leistung zählt: das ihrer Sorte, wenn sie eine
 * hat — sonst ihr eigenes. Wird eine Sorte gelöscht, zählt das Gewicht, das
 * die Leistung beim Zuordnen mitbekommen hat.
 */
export function gewichtVon(leistung, sorten = []) {
  const sorte = leistung?.sorte ? (sorten || []).find((x) => x.id === leistung.sorte) : null;
  return Math.max(0, zahl(sorte ? sorte.gewicht : leistung?.gewicht, 1));
}

/**
 * Die Bezeichnung einer Leistung: was eingetragen ist, sonst durchgezählt —
 * „Klassenarbeit 1“, „Test 2“, „Mündlich 3“. Gezählt wird in der Reihenfolge
 * des Eintragens, getrennt nach Sorte; wird eine gelöscht, rücken die
 * anderen nach.
 */
export function leistungsName(notenfach, leistung) {
  const eigen = String(leistung?.was || "").trim();
  if (eigen) return eigen;
  const sorten = sortenVon(notenfach);
  const sorte = leistung?.sorte ? sorten.find((x) => x.id === leistung.sorte) : null;
  const ohneSorte = (l) => !sorten.some((x) => x.id === l.sorte);
  const gleich = (l) => (sorte ? l.sorte === sorte.id : l.art === leistung.art && ohneSorte(l));
  const reihe = (notenfach?.leistungen || []).filter(gleich);
  const stelle = reihe.findIndex((l) => l.id === leistung.id);
  const grund = (sorte && sorte.name.trim()) || ARTEN[leistung?.art]?.name || "Leistung";
  return grund + " " + ((stelle < 0 ? reihe.length : stelle) + 1);
}

/**
 * Eine Zahl, wie sie getippt wird: „0,5“ und „0.5“ gelten gleich. Leer oder
 * Unfug gibt `null` — das Feld behält dann, was es hatte.
 */
export function zahlLesen(text) {
  const roh = String(text ?? "").trim().replace(",", ".");
  if (!roh || roh === "." || roh === "-") return null;
  const n = Number(roh);
  return Number.isFinite(n) ? n : null;
}

/** Und zurück: 0.5 → „0,5“. */
export function zahlZeigen(wert) {
  if (wert === null || wert === undefined || wert === "") return "";
  return String(wert).replace(".", ",");
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

/** Eingetragen, nicht nur angelegt. */
export const hatPunkte = (l) => l?.punkte !== null && l?.punkte !== undefined && l?.punkte !== "";

/**
 * Der Schnitt einer Art — gewichtetes Mittel der einzelnen Leistungen.
 * `null`, wenn es in dieser Art nichts gibt: Eine Art ohne Leistungen soll
 * den Schnitt nicht nach unten ziehen, sondern gar nicht mitzählen.
 */
export function artSchnitt(leistungen, art, sorten = []) {
  const eigene = (leistungen || []).filter((l) => l && l.art === art && hatPunkte(l));
  if (!eigene.length) return null;
  let summe = 0, gewicht = 0;
  for (const l of eigene) {
    const g = gewichtVon(l, sorten);
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
  const sorten = sortenVon(notenfach);
  for (const art of ART_IDS) proArt[art] = artSchnitt(leistungen, art, sorten);

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
    anzahl: leistungen.filter(hatPunkte).length,
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
 * Was sich in ein Halbjahr übernehmen lässt: die Fächer der anderen
 * Halbjahre (mit Sorten, Gewichten und Verknüpfung, vom nächstgelegenen
 * Halbjahr) und die Lernfächer, die dort noch fehlen. Was im Halbjahr schon
 * steht, kommt nicht noch einmal.
 */
export function uebernahmeVorschlaege(alle, halbjahr, lernfaecher = []) {
  const schluessel = (name) => String(name || "").trim().toLowerCase();
  const schon = new Set(faecherIm(alle, halbjahr).map((f) => schluessel(f.fach)));
  const ziel = HALBJAHR_IDS.indexOf(halbjahr);
  /* Näher dran zuerst, bei gleichem Abstand das frühere Halbjahr — es ist
     das, was man gerade hinter sich hat. */
  const abstand = (hj) => {
    const i = HALBJAHR_IDS.indexOf(hj);
    if (i < 0 || ziel < 0) return 99;
    return Math.abs(i - ziel) * 2 + (i > ziel ? 1 : 0);
  };
  const nachName = new Map();
  const andere = (alle || [])
    .filter((f) => f && !f.deleted && f.halbjahr !== halbjahr && (f.fach || "").trim())
    .sort((a, b) => abstand(a.halbjahr) - abstand(b.halbjahr));
  for (const f of andere) {
    const k = schluessel(f.fach);
    if (schon.has(k) || nachName.has(k)) continue;
    nachName.set(k, {
      fach: f.fach.trim(), subjectId: f.subjectId || null, herkunft: f.halbjahr,
      sorten: sortenVon(f).map((x) => ({ ...x })), artGewicht: { ...(f.artGewicht || {}) },
    });
  }
  for (const lf of lernfaecher || []) {
    if (!lf || lf.deleted || !(lf.name || "").trim()) continue;
    const k = schluessel(lf.name);
    if (schon.has(k)) continue;
    const da = nachName.get(k);
    if (da) { if (!da.subjectId) da.subjectId = lf.id; continue; }
    nachName.set(k, { fach: lf.name.trim(), subjectId: lf.id, herkunft: "lernfach", sorten: null, artGewicht: null });
  }
  return [...nachName.values()].sort((a, b) => a.fach.localeCompare(b.fach, "de"));
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
