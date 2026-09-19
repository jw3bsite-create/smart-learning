/*
 * Antwortprüfung.
 *
 * Beim Schreiben soll nicht jede Kleinigkeit als Fehler zählen: Groß- und
 * Kleinschreibung, ein vergessener Artikel, ein Punkt zu viel. Zugleich darf
 * die Prüfung nicht zu großzügig sein, sonst lernt man nichts. Deshalb drei
 * Ausgänge: richtig, fast richtig (Tippfehler) und falsch.
 */

import { alsKlartext, hochAlsPotenz, hatFormel } from "./formel.js";

const ARTIKEL = new Set([
  "der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem", "einer", "eines",
  "the", "a", "an", "to",
  "le", "la", "les", "un", "une", "des", "l",
  "el", "los", "las", "una", "unos", "unas",
  "il", "lo", "gli", "uno",
]);

/** Entfernt Betonungszeichen: „für“ → „fur“. */
function ohneZeichen(s) {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}

/** Deutsche Umlaute in ihre Umschrift, damit „schoen“ auch „schön“ trifft. */
function umschrift(s) {
  return s.replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");
}

export function normalisiere(text, opt = {}) {
  const {
    ohneKlammern = true, ohneArtikel = true,
    zeichenEgal = true, satzzeichenEgal = true,
  } = opt;
  // Eine Formel wird als Klartext verglichen: niemand tippt Formelbefehle.
  let s = alsKlartext(String(text || "")).toLowerCase().trim();
  if (ohneKlammern) s = s.replace(/[([{][^)\]}]*[)\]}]/g, " ");
  if (satzzeichenEgal) s = s.replace(/[.,;:!?¡¿"'`´„“”«»…\-–—_*]/g, " ");
  s = umschrift(s);
  if (zeichenEgal) s = ohneZeichen(s);
  s = s.replace(/\s+/g, " ").trim();
  if (ohneArtikel) {
    const woerter = s.split(" ").filter(Boolean);
    if (woerter.length > 1) {
      const ohne = woerter.filter((w) => !ARTIKEL.has(w));
      if (ohne.length) s = ohne.join(" ");
    }
  }
  return s;
}

/**
 * Zerlegt eine Rückseite in gleichwertige Antworten.
 * „gehen, laufen / spazieren“ → drei zulässige Antworten.
 */
export function antwortVarianten(text) {
  const roh = String(text || "").split(/\s*[/;]\s*|\s*,\s*(?![^(]*\))/);
  const liste = roh.map((s) => s.trim()).filter(Boolean);
  return liste.length ? liste : [String(text || "").trim()];
}

/** Levenshtein-Abstand, begrenzt aus Geschwindigkeitsgründen. */
export function abstand(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let vorige = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const zeile = [i + 1];
    for (let j = 0; j < b.length; j++) {
      const kosten = a[i] === b[j] ? 0 : 1;
      zeile[j + 1] = Math.min(zeile[j] + 1, vorige[j + 1] + 1, vorige[j] + kosten);
    }
    vorige = zeile;
  }
  return vorige[b.length];
}

/** Erlaubte Tippfehler je nach Länge der erwarteten Antwort. */
function spielraum(laenge) {
  if (laenge <= 3) return 0;
  if (laenge <= 6) return 1;
  if (laenge <= 12) return 2;
  return 3;
}

/**
 * Prüft eine getippte Antwort.
 * → { status: "richtig" | "fast" | "falsch", treffer, erwartet }
 */
export function pruefe(eingabe, erwartet, opt = {}) {
  const { alleVerlangen = false, tippfehlerErlauben = true } = opt;
  /* Rechnungen und Zahlen streng: Ein Vorzeichen ist kein Tippfehler, eine
     Klammer kein Beiwerk. Siehe istMathe. */
  if (istMathe(erwartet)) {
    if (!String(eingabe || "").trim()) return { status: "falsch", erwartet };
    return matheGleich(eingabe, erwartet)
      ? { status: "richtig", treffer: erwartet, erwartet }
      : { status: "falsch", treffer: erwartet, erwartet };
  }
  const varianten = antwortVarianten(erwartet);
  const nEingabe = normalisiere(eingabe, opt);
  if (!nEingabe) return { status: "falsch", erwartet };

  if (alleVerlangen && varianten.length > 1) {
    const gegeben = antwortVarianten(eingabe).map((s) => normalisiere(s, opt));
    const alle = varianten.every((v) =>
      gegeben.some((g) => g === normalisiere(v, opt)));
    if (alle) return { status: "richtig", treffer: erwartet, erwartet };
  }

  let bester = null;
  for (const v of varianten) {
    const nv = normalisiere(v, opt);
    if (!nv) continue;
    if (nEingabe === nv) return { status: "richtig", treffer: v, erwartet };
    const d = abstand(nEingabe, nv);
    if (bester === null || d < bester.d) bester = { d, v, nv };
  }
  if (!bester) return { status: "falsch", erwartet };

  if (tippfehlerErlauben && bester.d <= spielraum(bester.nv.length))
    return { status: "fast", treffer: bester.v, erwartet };

  // Ganz enthalten zählt bei langen Erklärungen als fast richtig.
  if (bester.nv.length > 20 && (bester.nv.includes(nEingabe) || nEingabe.includes(bester.nv)))
    return { status: "fast", treffer: bester.v, erwartet };

  return { status: "falsch", treffer: bester.v, erwartet };
}

/** Hebt die Stellen hervor, an denen sich zwei Wörter unterscheiden. */
export function unterschied(eingabe, erwartet) {
  const a = String(eingabe || ""), b = String(erwartet || "");
  const stellen = [];
  for (let i = 0; i < b.length; i++)
    if (a[i]?.toLowerCase() !== b[i]?.toLowerCase()) stellen.push(i);
  return stellen;
}

/** Erster Buchstabe je Wort als Hilfe: „das Haus“ → „d__ H___“. */
export function schablone(text) {
  return String(text || "").split(/\s+/)
    .map((w) => (w.length <= 1 ? w : w[0] + "_".repeat(w.length - 1)))
    .join(" ");
}

/* ===================================================================== */
/*  Mathematische Schreibweisen                                          */
/* ===================================================================== */

/**
 * Normalisiert einen Rechenausdruck für den Vergleich.
 *
 * Bewusst keine Formelbibliothek: Wer „f'(x) = 2x" tippt, meint dasselbe wie
 * „f´(x)=2·x". Verglichen wird darum eine geglättete Fassung — Leerzeichen,
 * Malzeichen, Anführungsstriche und die üblichen Schreibvarianten fallen weg.
 *
 * Was hier NICHT geschieht: rechnen. „2+2" und „4" bleiben verschieden. Ob
 * zwei Ausdrücke mathematisch gleichwertig sind, entscheidet der Mensch beim
 * Bewerten — dieselbe Regel wie überall in dieser App.
 */
export function normalisiereFormel(text) {
  return hochAlsPotenz(alsKlartext(String(text || "")))
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[´`'′]/g, "'")            // Ableitungsstrich in allen Formen
    .replace(/[·×∙]/g, "*")             // Malzeichen vereinheitlichen
    .replace(/[−–—]/g, "-")             // Minus in allen Formen
    .replace(/[:÷]/g, "/")              // Geteilt
    .replace(/\*\*/g, "^")              // Potenz
    .replace(/,(\d)/g, ".$1")           // Dezimalkomma
    .replace(/√/g, "wurzel")
    // Stillschweigende Multiplikation: „2*x" und „2x" sind dasselbe.
    .replace(/(\d)\*(?=[a-z(])/g, "$1")
    .replace(/[{}]/g, "");
}

export function formelStimmt(eingabe, erwartet) {
  const a = normalisiereFormel(eingabe);
  const b = normalisiereFormel(erwartet);
  return Boolean(a) && a === b;
}

/* ===================================================================== */
/*  Rechnungen erkennen und streng vergleichen                           */
/* ===================================================================== */

/*
 * Warum überhaupt zwei Arten zu vergleichen?
 *
 * Für Vokabeln ist Nachsicht richtig: „(sich) erinnern" gilt wie „erinnern",
 * ein Bindestrich ist Zierde, ein verrutschter Buchstabe ein Tippfehler. Für
 * Rechnungen ist genau das falsch. Mit den Vokabelregeln galt „x = −3" als
 * „x = 3", „(a+b)²" als „(a−b)²" und „x = 12" statt 13 als Tippfehler — der
 * häufigste Fehler in Mathematik, das Vorzeichen, bekam einen grünen Haken.
 */

/** Wörter, die in einer Rechnung vorkommen, ohne sie zu Sprache zu machen. */
const MATHE_WOERTER = new Set([
  "sin", "cos", "tan", "cot", "arcsin", "arccos", "arctan", "sinh", "cosh", "tanh",
  "log", "exp", "sqrt", "wurzel", "lim", "oder", "und", "bzw", "mit", "fuer", "für",
  "gilt", "also", "sowie", "falls", "wenn", "dann", "ist", "gleich", "cdot", "frac",
  "left", "right", "pi", "infty", "unendlich",
]);

const MATHE_ZEICHEN = /[=+\-−*/^·×÷√∫∑∏π<>≤≥≈≠∞²³⁰-⁹₀-₉⁺⁻]/u;
const FUNKTION = /(?:^|[^\p{L}])(?:[a-z]|sin|cos|tan|ln|lg|log|exp|sqrt)['´′`]*\s*\(/iu;

/**
 * Ist eine Lösung eine Rechnung (oder eine Zahl) statt eines Satzes?
 *
 * Ja, wenn sie eine Formel enthält — oder wenn in ihr kein richtiges Wort
 * steht (vier Buchstaben und mehr, abgesehen von Rechenwörtern wie „sin"
 * oder „oder") und dafür Ziffern, Rechenzeichen oder eine Funktion wie
 * „f(x)". So bleibt „Ludwig XIV (1638–1715)" ein Satz und „(to) go" eine
 * Vokabel, während „x = −3", „cos(2x)" und „1789" streng geprüft werden.
 */
export function istMathe(text) {
  const s = String(text || "").trim();
  if (!s) return false;
  if (hatFormel(s)) return true;
  const woerter = s.toLowerCase().match(/\p{L}{4,}/gu) || [];
  if (woerter.some((w) => !MATHE_WOERTER.has(w))) return false;
  return /\d/.test(s) || MATHE_ZEICHEN.test(s) || FUNKTION.test(s);
}

const TIEF_ZIFFERN = { "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4",
  "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9", "₊": "+", "₋": "-" };

/** Eine Rechnung in die Form, in der verglichen wird. */
export function normalisiereMathe(text) {
  return normalisiereFormel(text)
    .replace(/[₀-₉₊₋]/g, (z) => TIEF_ZIFFERN[z])
    .replace(/\\(left|right)\b/g, "")      // \left( ist dieselbe Klammer wie (
    .replace(/\.$/, "");                   // ein Satzpunkt am Ende ist keine Rechnung
}

/*
 * Mehrere Lösungen („x = 2 oder x = −2", „x₁ = 1; x₂ = 3") dürfen in
 * beliebiger Reihenfolge stehen — verlangt werden aber alle.
 */
function matheTeile(text) {
  return String(text || "")
    .split(/\s+(?:oder|und|bzw\.?)\s+|;/i)
    .map(normalisiereMathe)
    .filter(Boolean)
    .sort();
}

/** Stimmen zwei Rechnungen überein? Ohne Nachsicht bei Zeichen und Zahlen. */
export function matheGleich(eingabe, erwartet) {
  const a = matheTeile(eingabe);
  const b = matheTeile(erwartet);
  return a.length > 0 && a.length === b.length && a.every((x, i) => x === b[i]);
}

/**
 * Die eine Antwort auf „stimmt das?" — für Abrufen, Rechenwege und
 * Vorabtest. Rechnungen streng, alles andere mit den üblichen Nachsichten.
 */
export function gleichwertig(eingabe, erwartet, opt = {}) {
  if (!String(eingabe || "").trim()) return false;
  if (istMathe(erwartet)) return matheGleich(eingabe, erwartet);
  return normalisiere(eingabe, opt) === normalisiere(erwartet, opt);
}
