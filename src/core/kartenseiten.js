/*
 * Welche Seite einer Karte ist die Frage, welche die Antwort?
 *
 * Steht im Kern und nicht bei den Modi, weil es reine Logik ist: keine
 * Oberfläche, kein React, und darum ohne Browser prüfbar. Hier lag einmal ein
 * Fehler, den niemand bemerkt hatte — Lückentexte zeigten in den Übungsmodi
 * ihre geschweiften Klammern, Rechenwege verschwanden ganz. Solche Fehler
 * fallen nur auf, wenn sich die Sache prüfen lässt.
 */

import { kartenArt, clozeTeile, schritteVon } from "./model.js";

/**
 * Übersetzt eine Karte in die zwei Seiten, die die Übungsmodi kennen.
 *
 * - **Lückentext**: Die Lücken werden zu Unterstrichen, die Lösungen wandern
 *   auf die Rückseite.
 * - **Mehrschritt**: Die Aufgabe ist die Frage, der nummerierte Rechenweg die
 *   Antwort. Zum Üben genügt das; Schritt für Schritt abgefragt wird er nur
 *   im Abrufmodus.
 */
export function seitenFuer(karte, richtung) {
  const art = kartenArt(karte);

  if (art === "cloze") {
    const stuecke = clozeTeile(karte.term);
    const mitLuecken = stuecke.map((s) => (s.art === "luecke"
      ? "_".repeat(Math.max(3, Math.min(12, s.text.length)))
      : s.text)).join("");
    const loesungen = stuecke.filter((s) => s.art === "luecke")
      .map((s) => s.text).join(" · ");
    const rueckseite = [loesungen, karte.definition].filter(Boolean).join("\n");
    return richtung === "dt"
      ? { frage: rueckseite, frageBild: karte.defImage,
        antwort: mitLuecken, antwortBild: karte.termImage }
      : { frage: mitLuecken, frageBild: karte.termImage,
        antwort: rueckseite, antwortBild: karte.defImage };
  }

  if (art === "mehrschritt") {
    const weg = schritteVon(karte)
      .map((s, i) => (i + 1) + ". " + (s.frage ? s.frage + ": " : "") + s.antwort)
      .join("\n");
    return { frage: karte.term, frageBild: karte.termImage,
      antwort: weg || karte.definition, antwortBild: karte.defImage };
  }

  if (richtung === "dt")
    return { frage: karte.definition, frageBild: karte.defImage,
      antwort: karte.term, antwortBild: karte.termImage };
  return { frage: karte.term, frageBild: karte.termImage,
    antwort: karte.definition, antwortBild: karte.defImage };
}

/** Lässt sich mit dieser Karte üben? Geprüft wird auf der übersetzten Fassung. */
export function istUebbar(karte) {
  const s = seitenFuer(karte, "td");
  return Boolean(((s.frage || "").trim() || s.frageBild)
    && ((s.antwort || "").trim() || s.antwortBild));
}

export function sprachenFuer(derStapel, richtung) {
  const t = derStapel?.termLang || "de";
  const d = derStapel?.defLang || "de";
  return richtung === "dt" ? { frage: d, antwort: t } : { frage: t, antwort: d };
}
