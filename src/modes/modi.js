/*
 * Die Übungsmodi: Name, Sinnbild, Farbton (ui/basis.jsx, `Sinnbild`) und ein
 * Satz, was sie tun.
 *
 * Eigene Datei, damit die Modi selbst ihren Satz nachschlagen können, ohne
 * die ganze App einzubinden. Der Satz steht nicht mehr auf den Kacheln der
 * Stapelansicht, sondern hinter dem „?“ im Kopf des Modus.
 */

export const MODI = [
  { id: "karten", name: "Karteikarten", symbol: "stapel", ton: "blau",
    text: "Durchblättern und umdrehen, mit Vorlesen und Selbsteinschätzung." },
  { id: "lernen", name: "Lernen", symbol: "ziel", ton: "lila",
    text: "Erst erkennen, dann schreiben, in Runden, bis jede Karte sitzt." },
  { id: "schreiben", name: "Schreiben", symbol: "schreiben", ton: "gruen",
    text: "Antwort tippen. Verzeiht Tippfehler, nicht aber Unwissen." },
  { id: "buchstabieren", name: "Buchstabieren", symbol: "buchstaben", ton: "tuerkis",
    text: "Anhören und schreiben, für Vokabeln und Rechtschreibung." },
  { id: "test", name: "Test", symbol: "papier", ton: "orange",
    text: "Klassenarbeit im Kleinen: gemischte Aufgaben, Note am Ende." },
  { id: "zuordnen", name: "Zuordnen", symbol: "raster", ton: "gelb",
    text: "Paare finden, auf Zeit. Die Bestzeit wird festgehalten." },
  { id: "meteor", name: "Meteor", symbol: "rakete", ton: "rot",
    text: "Begriffe fallen, du tippst die Antwort. Wird schneller." },
];

/** Der Eintrag zu einem Namen, wie er im Kopf eines Modus steht. */
export function modusNachName(name) {
  return MODI.find((m) => m.name === name) || null;
}
