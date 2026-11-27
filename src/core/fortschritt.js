/*
 * Der Balken oben in den Lernmodi (Wunsch des Nutzers, 27.11.2026).
 *
 * Er misst nicht, wie weit man durch den Stapel geblättert ist, sondern wie
 * viel wirklich sitzt: Eine richtig beantwortete Karte füllt einen ganzen
 * Punkt, ein Fehlversuch einen halben — man ist ja trotzdem vorangekommen.
 *
 * Die Falle dabei: Wer dieselbe Karte dreimal falsch beantwortet, dürfte den
 * Balken nicht dreimal schieben. Darum zählt **je Karte nur ihr bester
 * Stand** (`Math.max`), nicht die Summe ihrer Versuche. Damit gilt:
 *
 * - Der Balken geht nie zurück.
 * - Mehrfach falsch bleibt ein halber Punkt.
 * - Wird dieselbe Karte später richtig, wächst sie auf den ganzen Punkt.
 * - Keine Karte kommt je über einen Punkt, der Balken nie über voll.
 */

export const GANZ = 1;
export const ANLAUF = 0.5;

/**
 * `antworten`  [{ schluessel, richtig }] in der Reihenfolge, wie sie fielen
 * `gesamt`     wie viele verschiedene Karten die Runde hat
 */
export function fortschrittAnteil(antworten, gesamt) {
  if (!gesamt || gesamt <= 0) return 0;
  const je = new Map();
  for (const a of antworten || []) {
    if (!a || !a.schluessel) continue;
    const wert = a.richtig ? GANZ : ANLAUF;
    je.set(a.schluessel, Math.max(je.get(a.schluessel) || 0, wert));
  }
  let summe = 0;
  for (const w of je.values()) summe += w;
  return Math.max(0, Math.min(1, summe / gesamt));
}
