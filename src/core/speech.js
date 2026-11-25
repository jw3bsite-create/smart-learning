/*
 * Vorlesen über die Sprachausgabe des Browsers.
 *
 * Kostet nichts. Welche Stimmen es gibt, hängt vom Gerät ab — und die
 * Unterschiede sind riesig: Edge bringt „Natural“-Stimmen mit, die kaum nach
 * Maschine klingen (sie brauchen Netz), Windows selbst nur die alten
 * Roboterstimmen. Am iPhone gibt es „Erweitert“ und „Premium“, aber erst,
 * wenn man sie in den iOS-Einstellungen geladen hat.
 *
 * Darum wählt Anchor nicht die erstbeste Stimme einer Sprache, sondern die
 * beste vorhandene (seit dem 25. November 2026): natürlich vor erweitert vor
 * einfach, bei gleicher Güte männlich (Wunsch des Nutzers) und bei Spanisch
 * die aus Spanien. Wer will, wählt je Sprache selbst — gemerkt pro Gerät,
 * denn iPhone und PC haben ganz verschiedene Stimmen.
 *
 * Die Liste der Stimmen trifft verzögert ein — darum das Ereignis unten.
 */

import { alsSprache } from "./formel.js";

let stimmenListe = [];
const horcher = new Set();

function laden() {
  if (typeof speechSynthesis === "undefined") return;
  stimmenListe = speechSynthesis.getVoices() || [];
  for (const h of horcher) h(stimmenListe);
}

if (typeof speechSynthesis !== "undefined") {
  laden();
  speechSynthesis.addEventListener?.("voiceschanged", laden);
}

export function stimmen() { return stimmenListe; }

export function beiStimmen(fn) {
  horcher.add(fn);
  if (stimmenListe.length) fn(stimmenListe);
  return () => horcher.delete(fn);
}

export const sprachAusgabeDa = () => typeof speechSynthesis !== "undefined";

/* ------------------------------- Bewerten ------------------------------- */

/** Bevorzugte Gegend je Sprache: Deutsch aus Deutschland, Spanisch aus Spanien. */
const GEGEND = { de: "de-de", es: "es-es", en: "en-gb", fr: "fr-fr", it: "it-it", pt: "pt-pt" };

/*
 * Männliche Stimmen, die es auf den Geräten des Nutzers gibt oder geben
 * kann (Edge „Natural“, Windows, Apple). Die Namen stehen in den Stimmen
 * selbst; ein Geschlecht melden Browser nicht.
 */
const MAENNLICH = new Set([
  // Deutsch
  "conrad", "killian", "florian", "bernd", "christoph", "kasper", "klaus", "ralf", "stefan",
  "markus", "yannick", "martin", "viktor", "jonas",
  // Spanisch
  "alvaro", "álvaro", "arnau", "dario", "darío", "elias", "elías", "nil", "saul", "saúl", "teo",
  "pablo", "jorge", "diego", "juan", "carlos",
  // Englisch, Französisch
  "guy", "ryan", "thomas", "daniel", "oliver", "henri", "remy", "rémy", "jerome", "jérôme",
]);

/* Apples Spaßstimmen (Eloquence, Bad News …) taugen nicht zum Lernen. */
const SPASS = /eloquence|novelty|\b(eddy|flo|grandma|grandpa|oma|opa|reed|rocko|sandy|shelley|bad news|bahh|bells|boing|bubbles|cellos|jester|organ|superstar|trinoids|whisper|wobble|zarvox|albert|fred|junior|kathy|ralph)\b/i;

/** Der Vorname aus „Microsoft Conrad Online (Natural) - German (Germany)“ oder „Markus (Erweitert)“. */
export function vorname(stimme) {
  const name = String(stimme?.name || "").replace(/^(microsoft|google|apple)\s+/i, "");
  return (name.split(/[\s(,-]+/)[0] || "").toLowerCase();
}

/**
 * Wie gut eine Stimme klingt: „natuerlich“ (Edge Natural/Neural, Apple
 * Premium, Google-Netzstimmen), „erweitert“ (Apple Erweitert) oder
 * „einfach“ (alles andere — meist hörbar Maschine).
 */
export function guete(stimme) {
  const kennung = String(stimme?.name || "") + " " + String(stimme?.voiceURI || "");
  if (/natural|neural|premium|multilingual/i.test(kennung)) return "natuerlich";
  if (/enhanced|erweitert|verbessert|optimiert|siri/i.test(kennung)) return "erweitert";
  if (/^google\s/i.test(String(stimme?.name || ""))) return "erweitert";
  return "einfach";
}

export const GUETE_NAMEN = { natuerlich: "natürlich", erweitert: "erweitert", einfach: "einfach" };

/** Punkte für die Reihenfolge: Güte zuerst, dann Gegend, dann männlich. */
export function bewerte(stimme, sprache = "de") {
  const kurz = String(sprache || "de").slice(0, 2).toLowerCase();
  const lang = String(stimme?.lang || "").toLowerCase().replace("_", "-");
  if (!lang.startsWith(kurz)) return -Infinity;
  let punkte = { natuerlich: 300, erweitert: 200, einfach: 100 }[guete(stimme)];
  if (SPASS.test(String(stimme?.name || "") + " " + String(stimme?.voiceURI || ""))) punkte -= 250;
  if (GEGEND[kurz] && lang === GEGEND[kurz]) punkte += 30;
  if (MAENNLICH.has(vorname(stimme))) punkte += 20;
  if (stimme?.default) punkte += 1;
  return punkte;
}

/** Alle Stimmen einer Sprache, die beste zuerst. */
export function stimmenFuer(sprache = "de", liste = stimmenListe) {
  return (liste || [])
    .map((s) => ({ s, p: bewerte(s, sprache) }))
    .filter((x) => x.p > -Infinity)
    .sort((a, b) => b.p - a.p || String(a.s.name).localeCompare(String(b.s.name)))
    .map((x) => x.s);
}

export function besteStimme(sprache = "de", liste = stimmenListe) {
  return stimmenFuer(sprache, liste)[0] || null;
}

/* ------------------------------ Eigene Wahl ----------------------------- */

const MERKER = "anchor:stimmen";

function wahlLesen() {
  try { return JSON.parse(localStorage.getItem(MERKER) || "{}") || {}; } catch (e) { return {}; }
}

/** Die selbst gewählte Stimme je Sprache (Kennung) — oder null für „automatisch“. */
export function gewaehlt(sprache = "de") {
  return wahlLesen()[String(sprache).slice(0, 2).toLowerCase()] || null;
}

export function waehle(sprache, kennung) {
  const w = wahlLesen();
  const kurz = String(sprache).slice(0, 2).toLowerCase();
  if (kennung) w[kurz] = kennung; else delete w[kurz];
  try { localStorage.setItem(MERKER, JSON.stringify(w)); } catch (e) { /* privat: dann eben automatisch */ }
  for (const h of horcher) h(stimmenListe);
}

const kennungVon = (s) => s?.voiceURI || s?.name || "";

/** Die Stimme, mit der vorgelesen wird: die gewählte, sonst die beste. */
export function stimmeFuer(sprache = "de", liste = stimmenListe) {
  const eigene = gewaehlt(sprache);
  if (eigene) {
    const treffer = (liste || []).find((s) => kennungVon(s) === eigene);
    if (treffer) return treffer;
  }
  return besteStimme(sprache, liste);
}

export { kennungVon };

/* ------------------------------- Sprechen ------------------------------- */

/** Liest einen Text vor. Bricht Vorheriges ab. */
export function sprich(text, sprache = "de", tempo = 1) {
  if (!sprachAusgabeDa() || !text) return;
  // Formeln liest keine Stimme vor; „1 durch 2" schon.
  const gesagt = String(alsSprache(text)).slice(0, 400);
  const stimme = stimmeFuer(sprache);
  try {
    speechSynthesis.cancel();
    const sagen = (mit, nochmal) => {
      const spruch = new SpeechSynthesisUtterance(gesagt);
      if (mit) spruch.voice = mit;
      spruch.lang = mit?.lang || sprache || "de";
      spruch.rate = tempo;
      /* Die natürlichen Stimmen von Edge brauchen Netz. Ohne Netz scheitern
         sie — dann eben mit der besten Stimme, die auf dem Gerät liegt. */
      if (nochmal) {
        spruch.onerror = (e) => {
          if (e?.error === "interrupted" || e?.error === "canceled") return;
          const hier = stimmenFuer(sprache).find((s) => s.localService && s !== mit);
          if (hier) sagen(hier, false);
        };
      }
      speechSynthesis.speak(spruch);
    };
    sagen(stimme, Boolean(stimme && stimme.localService === false));
  } catch (e) { /* stumm bleiben, wenn der Browser nicht mitspielt */ }
}

export function schweig() {
  if (sprachAusgabeDa()) try { speechSynthesis.cancel(); } catch (e) { /* nichts */ }
}

/** Ein Satz zum Probehören, in der jeweiligen Sprache. */
export const PROBE = {
  de: "Hallo, so klinge ich beim Vorlesen deiner Karten.",
  es: "Hola, así sueno cuando leo tus tarjetas.",
  en: "Hello, this is how I sound reading your cards.",
  fr: "Bonjour, voici comment je lis tes cartes.",
  it: "Ciao, ecco come leggo le tue carte.",
  la: "Salve, sic sonat vox mea.",
};

/** Die Sprachen, die zur Auswahl stehen. */
export const SPRACHEN = [
  ["de", "Deutsch"], ["en", "Englisch"], ["fr", "Französisch"], ["es", "Spanisch"],
  ["la", "Latein"], ["it", "Italienisch"], ["ru", "Russisch"], ["tr", "Türkisch"],
  ["nl", "Niederländisch"], ["pl", "Polnisch"], ["pt", "Portugiesisch"],
  ["grc", "Altgriechisch"], ["zh", "Chinesisch"], ["ja", "Japanisch"],
];
