/*
 * Fehler, die niemand auffängt — und welche davon man zeigt.
 *
 * Ein Knopf, dessen Handlung asynchron scheitert, tat früher einfach nichts:
 * Der Fehler landete in der Konsole, die auf dem Telefon niemand sieht. Jetzt
 * steht er oben in der Hinweisleiste (ui/Meldungen.jsx). Ausgenommen ist, was
 * der Browser selbst als gewollten Abbruch meldet — ein angehaltenes
 * Abspielen, ein abgebrochenes Laden, eine verweigerte Berechtigung.
 */

const HARMLOS = new Set(["AbortError", "NotAllowedError"]);

/** Der Text, der gezeigt wird, oder null, wenn der Grund nichts zu sagen hat. */
export function stoerungsText(grund) {
  if (grund === null || grund === undefined) return null;
  if (HARMLOS.has(grund.name)) return null;
  const text = String(grund.message || grund).trim();
  return text || null;
}
