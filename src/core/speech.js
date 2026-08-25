/*
 * Vorlesen über die Sprachausgabe des Browsers.
 *
 * Kostet nichts und braucht kein Netz. Welche Stimmen es gibt, hängt vom
 * Betriebssystem ab; Windows bringt Deutsch und Englisch von Haus aus mit.
 * Die Liste der Stimmen trifft verzögert ein — darum das Ereignis unten.
 */

let stimmenListe = [];
const horcher = new Set();

function laden() {
  if (typeof speechSynthesis === "undefined") return;
  stimmenListe = speechSynthesis.getVoices() || [];
  for (const h of horcher) h(stimmenListe);
}

if (typeof speechSynthesis !== "undefined") {
  laden();
  speechSynthesis.addEventListener("voiceschanged", laden);
}

export function stimmen() { return stimmenListe; }

export function beiStimmen(fn) {
  horcher.add(fn);
  if (stimmenListe.length) fn(stimmenListe);
  return () => horcher.delete(fn);
}

export const sprachAusgabeDa = () => typeof speechSynthesis !== "undefined";

function waehleStimme(sprache) {
  if (!stimmenListe.length) return null;
  const kurz = (sprache || "de").slice(0, 2).toLowerCase();
  return stimmenListe.find((s) => s.lang.toLowerCase().startsWith(kurz)) || null;
}

/** Liest einen Text vor. Bricht Vorheriges ab. */
export function sprich(text, sprache = "de", tempo = 1) {
  if (!sprachAusgabeDa() || !text) return;
  try {
    speechSynthesis.cancel();
    const spruch = new SpeechSynthesisUtterance(String(text).slice(0, 400));
    const stimme = waehleStimme(sprache);
    if (stimme) spruch.voice = stimme;
    spruch.lang = sprache || "de";
    spruch.rate = tempo;
    speechSynthesis.speak(spruch);
  } catch (e) { /* stumm bleiben, wenn der Browser nicht mitspielt */ }
}

export function schweig() {
  if (sprachAusgabeDa()) try { speechSynthesis.cancel(); } catch (e) {}
}

/** Die Sprachen, die zur Auswahl stehen. */
export const SPRACHEN = [
  ["de", "Deutsch"], ["en", "Englisch"], ["fr", "Französisch"], ["es", "Spanisch"],
  ["la", "Latein"], ["it", "Italienisch"], ["ru", "Russisch"], ["tr", "Türkisch"],
  ["nl", "Niederländisch"], ["pl", "Polnisch"], ["pt", "Portugiesisch"],
  ["grc", "Altgriechisch"], ["zh", "Chinesisch"], ["ja", "Japanisch"],
];
