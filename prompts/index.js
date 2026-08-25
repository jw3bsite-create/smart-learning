/*
 * Die Systemanweisungen der App.
 *
 * Sie liegen als eigene Dateien in diesem Verzeichnis, nicht im Code verstreut.
 * Das ist Absicht: Diese Texte sind der eigentliche Wirkstoff jeder KI-Funktion
 * — sie entscheiden darüber, ob die App beim Lernen hilft oder das Lernen
 * ersetzt. Sie müssen einzeln lesbar, einzeln änderbar und einzeln prüfbar
 * sein.
 *
 * Jede Datei trägt einen Kopf mit Name, Fassung und Zweck. Wer eine Anweisung
 * ändert, erhöht die Fassung — dann lässt sich später zuordnen, unter welcher
 * Anweisung ein Ergebnis entstanden ist.
 */

import { zerlege, fuelle } from "./zerlege.js";
import kartengenerator from "./kartengenerator.md?raw";

export const PROMPTS = {
  kartengenerator,
};

export { zerlege, fuelle };

/** Holt eine Anweisung und setzt die Platzhalter ein. */
export function anweisung(name, werte = {}) {
  const { kopf, text } = zerlege(PROMPTS[name]);
  return { text: fuelle(text, werte), name, fassung: kopf.fassung || "?" };
}
