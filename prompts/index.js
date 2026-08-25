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
 *
 * Die Fachtutoren setzen sich aus zwei Teilen zusammen: der Grundinstruktion,
 * die für alle gilt, und der fachlichen Sperre. Beides wird beim Aufruf
 * aneinandergesetzt — so lässt sich eine Regel an einer Stelle ändern und
 * wirkt überall.
 */

import { zerlege, fuelle } from "./zerlege.js";
import kartengenerator from "./kartengenerator.md?raw";
import feynman from "./feynman.md?raw";
import tutorGrund from "./tutor-grund.md?raw";
import tutorMathe from "./tutor-mathe.md?raw";
import tutorChemie from "./tutor-chemie.md?raw";
import tutorIt from "./tutor-it.md?raw";
import tutorDeutsch from "./tutor-deutsch.md?raw";
import tutorGgk from "./tutor-ggk.md?raw";
import tutorGmt from "./tutor-gmt.md?raw";

export const PROMPTS = {
  kartengenerator,
  feynman,
  "tutor-grund": tutorGrund,
  "tutor-mathe": tutorMathe,
  "tutor-chemie": tutorChemie,
  "tutor-it": tutorIt,
  "tutor-deutsch": tutorDeutsch,
  "tutor-ggk": tutorGgk,
  "tutor-gmt": tutorGmt,
};

export { zerlege, fuelle };

/** Holt eine Anweisung und setzt die Platzhalter ein. */
export function anweisung(name, werte = {}) {
  const { kopf, text } = zerlege(PROMPTS[name]);
  return { text: fuelle(text, werte), name, fassung: kopf.fassung || "?" };
}

/**
 * Die vollständige Anweisung eines Fachtutors: Grundregeln, dann die Sperre.
 * `stoff` ist der Zusammenhang aus den Karten des Nutzers (der Wahrheitsanker).
 */
export function tutorAnweisung(fachSchluessel, { stoff = "", hilfsgrad = "mittel" } = {}) {
  const grund = zerlege(PROMPTS["tutor-grund"]);
  const fach = zerlege(PROMPTS["tutor-" + fachSchluessel] || "");
  if (!fach.text) return null;

  const hilfe = {
    viel: "\n\nZum Umfang der Hilfe: Der Nutzer ist bei diesem Stoff noch "
      + "unsicher. Ein ausgearbeitetes Beispiel an einer verwandten, aber "
      + "anderen Aufgabe ist erlaubt — nie an der vorliegenden.",
    mittel: "",
    wenig: "\n\nZum Umfang der Hilfe: Der Nutzer beherrscht diesen Stoff "
      + "weitgehend. Kein Beispiel, keine Erläuterung — nur Fragen.",
  }[hilfsgrad] || "";

  const anker = stoff
    ? "\n\nDas ist der Stoff, den der Nutzer angelegt hat. Bleib nach "
      + "Möglichkeit daran; was darüber hinausgeht, kennzeichne als UNSICHER.\n\n"
      + stoff
    : "";

  return {
    text: grund.text + "\n\n---\n\n" + fach.text + hilfe + anker,
    name: "tutor-" + fachSchluessel,
    fassung: grund.kopf.fassung + "+" + fach.kopf.fassung,
  };
}
