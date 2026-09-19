/*
 * Das Fehlerheft: was schiefging, an einem Ort.
 *
 * Alle Angaben dafür liegen längst in der App — jede Antwort steht mit
 * Bewertung, Selbsteinschätzung und Zeitpunkt in `reviews`. Was fehlte, war
 * die Ansicht. Und die lohnt sich, weil die eigenen Fehler der kürzeste Weg
 * zum nächsten Punkt sind: Sie zeigen nicht, was man noch nicht kann, sondern
 * was man zu können glaubte.
 *
 * Die teuerste Sorte bekommt darum einen eigenen Platz: „sicher" gesagt und
 * doch falsch. Wer sich irrt und es weiß, lernt weiter; wer sich irrt und es
 * nicht weiß, hört auf zu üben.
 *
 * Nicht gezählt werden Fehler im Vorabtest. Dort sind sie ausdrücklich
 * erwünscht (man rät vor dem Unterricht), und sie würden das Heft zumüllen.
 */

import { NOTEN, KONFIDENZ } from "./fsrs.js";

const TAG = 86400000;

/** Zeiträume für die Auswahl im Heft. `null` heißt: alles. */
export const ZEITRAEUME = {
  woche: { name: "7 Tage", tage: 7 },
  monat: { name: "30 Tage", tage: 30 },
  quartal: { name: "3 Monate", tage: 90 },
  alles: { name: "Alles", tage: null },
};

/** Flags, deren Fehler nicht ins Heft gehören. */
const AUSGENOMMEN = new Set(["pretest"]);

/*
 * Der Fragemodus hat bis Fassung 2 jede Antwort als falsch verbucht. Diese
 * Einträge sagen nichts über das Können und bleiben draußen.
 */
const unzuverlaessig = (r) => r.modus === "fragen" && !(r.fassung >= 2);

export function von(zeitraum, jetzt = Date.now()) {
  const eintrag = ZEITRAEUME[zeitraum] || ZEITRAEUME.monat;
  return eintrag.tage === null ? 0 : jetzt - eintrag.tage * TAG;
}

const schluesselVon = (r) => r.cardId + ":" + (r.richtung || "td");

/**
 * Fasst die Fehler je Karte und Richtung zusammen.
 *
 * Gezählt wird die Bewertung „Nochmal" — das ist die Stelle, an der man selbst
 * gesagt hat: nicht gewusst. Die Schreibprüfung wird bewusst nicht befragt;
 * ein Tippfehler ist kein Wissensfehler, und die Bewertung stand danach.
 */
export function fehlerListe(reviews, { seit = 0, bis = Infinity } = {}) {
  const nach = new Map();
  for (const r of reviews || []) {
    if (!r || r.deleted || !r.cardId) continue;
    if (AUSGENOMMEN.has(r.flag) || unzuverlaessig(r)) continue;
    if (r.zeit < seit || r.zeit > bis) continue;
    if (r.bewertung !== NOTEN.NOCHMAL) continue;

    const schluessel = schluesselVon(r);
    let e = nach.get(schluessel);
    if (!e) {
      e = {
        schluessel, cardId: r.cardId, richtung: r.richtung || "td",
        setId: r.setId || null, subjectId: r.subjectId || null,
        fehler: 0, ueberschaetzt: 0, zuletzt: 0, imLernen: 0,
      };
      nach.set(schluessel, e);
    }
    e.fehler += 1;
    if (r.konfidenz === KONFIDENZ.SICHER) e.ueberschaetzt += 1;
    if (r.flag === "practice") e.imLernen += 1;
    if (r.zeit > e.zuletzt) e.zuletzt = r.zeit;
    if (!e.subjectId && r.subjectId) e.subjectId = r.subjectId;
    if (!e.setId && r.setId) e.setId = r.setId;
  }
  return [...nach.values()];
}

/**
 * Reihenfolge im Heft: erst das Überschätzte, dann das Häufige, dann das
 * Frische. Nicht alphabetisch — das Heft ist keine Liste, sondern eine
 * Rangfolge dessen, was zu tun ist.
 */
export function sortiere(liste) {
  return [...liste].sort((a, b) =>
    (b.ueberschaetzt - a.ueberschaetzt)
    || (b.fehler - a.fehler)
    || (b.zuletzt - a.zuletzt));
}

/** Nur ein Fach. `null` lässt alles durch. */
export function nurFach(liste, subjectId) {
  return subjectId ? liste.filter((e) => e.subjectId === subjectId) : liste;
}

/** Nur die teure Sorte: „sicher" gesagt und doch falsch. */
export function nurUeberschaetzt(liste) {
  return liste.filter((e) => e.ueberschaetzt > 0);
}

/** Je Fach gebündelt, das Fach mit den meisten Fehlern zuerst. */
export function nachFach(liste) {
  const karte = new Map();
  for (const e of liste) {
    const schluessel = e.subjectId || null;
    if (!karte.has(schluessel))
      karte.set(schluessel, { subjectId: schluessel, eintraege: [], fehler: 0, ueberschaetzt: 0 });
    const g = karte.get(schluessel);
    g.eintraege.push(e);
    g.fehler += e.fehler;
    g.ueberschaetzt += e.ueberschaetzt;
  }
  for (const g of karte.values()) g.eintraege = sortiere(g.eintraege);
  return [...karte.values()].sort((a, b) => b.fehler - a.fehler);
}

/** Die Zahlen über dem Heft. */
export function zahlen(liste) {
  return {
    karten: liste.length,
    fehler: liste.reduce((n, e) => n + e.fehler, 0),
    ueberschaetzt: liste.filter((e) => e.ueberschaetzt > 0).length,
  };
}

/**
 * Die Schlüssel für eine Übungsrunde.
 *
 * Wichtig für die Grundregel dieser App: Damit lässt sich *üben*, nicht
 * wiederholen. Der Plan entscheidet weiter allein, wann eine Karte im Abrufen
 * wiederkommt; eine Runde aus dem Fehlerheft zählt als Übung und verschiebt
 * keine Termine.
 */
export function schluessel(liste) {
  return new Set(liste.map((e) => e.schluessel));
}

/** Gibt es überhaupt etwas im Heft? Für die Seitenleiste. */
export function fehlerZahlKurz(reviews, { zeitraum = "monat", jetzt = Date.now() } = {}) {
  return fehlerListe(reviews, { seit: von(zeitraum, jetzt) }).length;
}
