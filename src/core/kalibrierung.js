/*
 * Konfidenz-Kalibrierung — das metakognitive Gegengift.
 *
 * Vor dem Aufdecken schätzt man sich selbst ein, nach dem Aufdecken bewertet
 * man. Aus dem Abgleich beider Angaben entsteht die einzige Zahl, die die
 * Fluency-Illusion sichtbar macht: Wie oft war „sicher" tatsächlich richtig?
 *
 * Die Illusion ist der Hauptgrund, warum Lernzeit verpufft — Vertrautheit
 * fühlt sich an wie Können. Ein Prozentwert, der zeigt, dass „sicher" in
 * Chemie nur zu 62 von 100 Malen stimmte, wirkt stärker als jede Ermahnung.
 *
 * Festlegung, die hier getroffen wird: „Sicher" gilt als gerechtfertigt, wenn
 * die anschließende Bewertung Gut oder Leicht war. Wer mit Mühe (Schwer) oder
 * gar nicht (Nochmal) auf die Antwort kam, hat sich überschätzt.
 */

import { NOTEN, AUFSCHLAG_MIN, AUFSCHLAG_MAX } from "./fsrs.js";
import { KONFIDENZ } from "./fsrs.js";
import { klemme } from "./util.js";

/** Unter dieser Antwortzeit kann niemand gelesen, gedacht und getippt haben. */
export const PLAUSIBEL_AB_MS = 1500;

/** Zählt eine Bewertung als „gewusst"? */
export const gewusst = (bewertung) => bewertung >= NOTEN.GUT;

/**
 * Prüft, ob ein Review echt sein kann (§5).
 * Durchklicken soll nicht zählen — weder für die Strähne noch für die Statistik.
 */
export function istPlausibel({ antwortzeit = 0, bewertung, eingabeLeer = false }) {
  if (antwortzeit > 0 && antwortzeit < PLAUSIBEL_AB_MS) return false;
  if (eingabeLeer && gewusst(bewertung)) return false;
  return true;
}

/** Nur diese Reviews dürfen in Statistik und Optimierung. */
const zaehlt = (r) => r.flag === "normal" && r.konfidenz;

/**
 * Kalibrierung über eine Menge von Reviews.
 * → je Konfidenzstufe: wie viele, wie oft gewusst, welche Quote.
 */
export function kalibrierung(reviews) {
  const leer = () => ({ anzahl: 0, gewusst: 0 });
  const stufen = { 1: leer(), 2: leer(), 3: leer() };
  for (const r of reviews) {
    if (!zaehlt(r)) continue;
    const s = stufen[r.konfidenz];
    if (!s) continue;
    s.anzahl += 1;
    if (gewusst(r.bewertung)) s.gewusst += 1;
  }
  for (const s of Object.values(stufen))
    s.quote = s.anzahl ? s.gewusst / s.anzahl : null;

  const sicher = stufen[KONFIDENZ.SICHER];
  return {
    stufen,
    gesamt: sicher.anzahl + stufen[2].anzahl + stufen[3].anzahl,
    // Überschätzung: „sicher" gesagt und doch nicht gewusst.
    ueberschaetzung: sicher.anzahl ? 1 - sicher.gewusst / sicher.anzahl : null,
    // Unterschätzung: „keine Ahnung" gesagt und doch gewusst — auch aufschlussreich.
    unterschaetzung: stufen[3].anzahl ? stufen[3].gewusst / stufen[3].anzahl : null,
  };
}

/** Dieselbe Rechnung, aufgeteilt nach Fach. */
export function kalibrierungJeFach(reviews) {
  const nach = new Map();
  for (const r of reviews) {
    if (!r.subjectId) continue;
    if (!nach.has(r.subjectId)) nach.set(r.subjectId, []);
    nach.get(r.subjectId).push(r);
  }
  const ergebnis = {};
  for (const [fach, liste] of nach) ergebnis[fach] = kalibrierung(liste);
  return ergebnis;
}

/**
 * Der Kalibrierungsaufschlag einer einzelnen Karte (§3.3).
 *
 * Er wirkt als Multiplikator auf das von FSRS berechnete Intervall — nie auf
 * die Parameter selbst. Nur so bleibt die Historie für eine spätere
 * Nachoptimierung brauchbar. Wer sich bei einer Karte wiederholt überschätzt,
 * bekommt sie früher wieder.
 */
export function aufschlagFuer(reviewsDerKarte, letzteN = 10) {
  const jung = reviewsDerKarte
    .filter(zaehlt)
    .sort((a, b) => b.zeit - a.zeit)
    .slice(0, letzteN);
  const sicher = jung.filter((r) => r.konfidenz === KONFIDENZ.SICHER);
  if (sicher.length < 3) return AUFSCHLAG_MAX;   // zu wenig Grundlage
  const daneben = sicher.filter((r) => !gewusst(r.bewertung)).length / sicher.length;
  return klemme(AUFSCHLAG_MAX - 0.3 * daneben, AUFSCHLAG_MIN, AUFSCHLAG_MAX);
}

/** Sicherheit in Worte: für die Anzeige neben der Strähne. */
export function kalibrierungInWorten(k) {
  if (!k || k.ueberschaetzung === null) return "noch keine Einschätzungen";
  const treffer = Math.round((1 - k.ueberschaetzung) * 100);
  if (treffer >= 90) return `„sicher" stimmt zu ${treffer} % — verlässlich`;
  if (treffer >= 75) return `„sicher" stimmt zu ${treffer} %`;
  return `„sicher" stimmt nur zu ${treffer} % — du überschätzt dich`;
}
