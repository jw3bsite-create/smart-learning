/*
 * Kopf und Text einer Anweisung trennen, Platzhalter füllen.
 *
 * Bewusst eine eigene Datei ohne Bündelwerkzeug-Magie: So lässt sich das
 * Verhalten der Anweisungen prüfen, ohne einen Browser zu starten.
 */

/** Trennt den Kopf (zwischen zwei Strichlinien) vom eigentlichen Text. */
export function zerlege(roh) {
  const treffer = String(roh || "").match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!treffer) return { kopf: {}, text: String(roh || "").trim() };
  const kopf = {};
  for (const zeile of treffer[1].split(/\r?\n/)) {
    const stelle = zeile.indexOf(":");
    if (stelle > 0) kopf[zeile.slice(0, stelle).trim()] = zeile.slice(stelle + 1).trim();
  }
  return { kopf, text: treffer[2].trim() };
}

/** Ersetzt {{PLATZHALTER}} durch die übergebenen Werte. */
export function fuelle(text, werte = {}) {
  return String(text || "").replace(/\{\{(\w+)\}\}/g,
    (ganz, schluessel) => (schluessel in werte ? String(werte[schluessel]) : ganz));
}
