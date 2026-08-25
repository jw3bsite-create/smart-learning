/*
 * Antwortprüfung.
 *
 * Beim Schreiben soll nicht jede Kleinigkeit als Fehler zählen: Groß- und
 * Kleinschreibung, ein vergessener Artikel, ein Punkt zu viel. Zugleich darf
 * die Prüfung nicht zu großzügig sein, sonst lernt man nichts. Deshalb drei
 * Ausgänge: richtig, fast richtig (Tippfehler) und falsch.
 */

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
  let s = String(text || "").toLowerCase().trim();
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
  return String(text || "")
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
