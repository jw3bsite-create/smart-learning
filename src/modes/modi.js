/*
 * Die Übungsmodi: Name, Sinnbild und ein Satz, was sie tun.
 *
 * Eigene Datei, damit die Modi selbst ihren Satz nachschlagen können, ohne
 * die ganze App einzubinden. Der Satz steht nicht mehr auf den Kacheln der
 * Stapelansicht, sondern hinter dem „?“ im Kopf des Modus.
 */

export const MODI = [
  { id: "karten", name: "Karteikarten", symbol: "stapel",
    text: "Durchblättern und umdrehen, mit Vorlesen und Selbsteinschätzung." },
  { id: "lernen", name: "Lernen", symbol: "blitz",
    text: "Runden aus Auswahl und Schreiben, verteilt über die Tage." },
  { id: "schreiben", name: "Schreiben", symbol: "schreiben",
    text: "Antwort tippen. Verzeiht Tippfehler, nicht aber Unwissen." },
  { id: "buchstabieren", name: "Buchstabieren", symbol: "buchstaben",
    text: "Anhören und schreiben, für Vokabeln und Rechtschreibung." },
  { id: "test", name: "Test", symbol: "papier",
    text: "Klassenarbeit im Kleinen: gemischte Aufgaben, Note am Ende." },
  { id: "zuordnen", name: "Zuordnen", symbol: "raster",
    text: "Paare finden, auf Zeit. Die Bestzeit wird festgehalten." },
  { id: "meteor", name: "Meteor", symbol: "rakete",
    text: "Begriffe fallen, du tippst die Antwort. Wird schneller." },
];

/** Der Eintrag zu einem Namen, wie er im Kopf eines Modus steht. */
export function modusNachName(name) {
  return MODI.find((m) => m.name === name) || null;
}
