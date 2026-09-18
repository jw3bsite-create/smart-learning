/*
 * Formeln auf Karteikarten: Brüche, Hoch- und Tiefstellung.
 *
 * Zwei Wege, weil es zwei Arten von Problemen sind:
 *
 * Hoch- und Tiefgestelltes ist eindimensional. Dafür gibt es eigene
 * Unicode-Zeichen (x², a₁, e⁻¹²), und die sind gewöhnlicher Text: Sie
 * überstehen jede Ausfuhr, lassen sich beim Abrufen eintippen und werden
 * überall gleich angezeigt. Darum wird eine Hochzahl hier umgewandelt, nicht
 * gesetzt.
 *
 * Ein Bruch ist zweidimensional — Zähler über dem Strich, Nenner darunter.
 * Das kann Text nicht. Dafür steht in der Karte eine kurze Formel zwischen
 * Dollarzeichen, `$\frac{x+1}{2}$`, und die Anzeige setzt sie mit KaTeX.
 * Das Dollarzeichen ist die übliche Schreibweise (LaTeX, Anki, Obsidian),
 * Karten bleiben also auch außerhalb dieser App verständlich.
 *
 * Ein echtes Dollarzeichen schreibt man als `\$`.
 */

/* ===================================================================== */
/*  Formeln im Text finden                                               */
/* ===================================================================== */

/**
 * Zerlegt Text in Stücke: gewöhnlicher Text und Formeln zwischen `$…$`.
 * Ein einzelnes Dollarzeichen ohne Gegenstück bleibt Text — „5 $" soll kein
 * halber Formelsatz werden.
 */
export function teile(text) {
  const s = String(text ?? "");
  const stuecke = [];
  let rest = "";
  let i = 0;
  while (i < s.length) {
    if (s[i] === "\\" && s[i + 1] === "$") { rest += "$"; i += 2; continue; }
    if (s[i] === "$") {
      let j = i + 1;
      while (j < s.length && !(s[j] === "$" && s[j - 1] !== "\\")) j++;
      if (j < s.length && j > i + 1) {
        if (rest) { stuecke.push({ formel: false, inhalt: rest }); rest = ""; }
        stuecke.push({ formel: true, inhalt: s.slice(i + 1, j) });
        i = j + 1;
        continue;
      }
    }
    rest += s[i];
    i += 1;
  }
  if (rest) stuecke.push({ formel: false, inhalt: rest });
  return stuecke;
}

export const hatFormel = (text) => teile(text).some((t) => t.formel);

/* ===================================================================== */
/*  Brüche                                                               */
/* ===================================================================== */

/*
 * Schützt, was KaTeX sonst als Befehl läse: geschweifte Klammern und das
 * Dollarzeichen. Alles andere (x+1, 2·π, x²) darf so hinein.
 */
function schuetze(teil) {
  return String(teil ?? "").trim()
    .replace(/\\/g, "\\backslash ")
    .replace(/([{}$%#&_])/g, "\\$1");
}

/** Ein Bruch als Formel: `$\frac{Zähler}{Nenner}$`. */
export function bruch(zaehler, nenner) {
  return "$\\frac{" + schuetze(zaehler) + "}{" + schuetze(nenner) + "}$";
}

/* ===================================================================== */
/*  Hoch und tief                                                        */
/* ===================================================================== */

const HOCH = {
  0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹",
  "+": "⁺", "-": "⁻", "−": "⁻", "=": "⁼", "(": "⁽", ")": "⁾", " ": " ",
  a: "ᵃ", b: "ᵇ", c: "ᶜ", d: "ᵈ", e: "ᵉ", f: "ᶠ", g: "ᵍ", h: "ʰ", i: "ⁱ", j: "ʲ",
  k: "ᵏ", l: "ˡ", m: "ᵐ", n: "ⁿ", o: "ᵒ", p: "ᵖ", r: "ʳ", s: "ˢ", t: "ᵗ", u: "ᵘ",
  v: "ᵛ", w: "ʷ", x: "ˣ", y: "ʸ", z: "ᶻ",
};

const TIEF = {
  0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉",
  "+": "₊", "-": "₋", "−": "₋", "=": "₌", "(": "₍", ")": "₎", " ": " ",
  a: "ₐ", e: "ₑ", h: "ₕ", i: "ᵢ", j: "ⱼ", k: "ₖ", l: "ₗ", m: "ₘ", n: "ₙ", o: "ₒ",
  p: "ₚ", r: "ᵣ", s: "ₛ", t: "ₜ", u: "ᵤ", v: "ᵥ", x: "ₓ",
};

/*
 * Wandelt Text in Hoch- oder Tiefgestelltes um. → { text, fehlt }
 * `fehlt` nennt die Zeichen, für die es keine Entsprechung gibt (etwa „q"
 * oder Großbuchstaben). Sie bleiben unverändert stehen — lieber ein normales
 * „q" als ein stillschweigend verschwundenes.
 */
function wandle(text, tafel) {
  let aus = "";
  const fehlt = [];
  for (const zeichen of String(text ?? "")) {
    const klein = zeichen.toLowerCase();
    if (tafel[zeichen] !== undefined) aus += tafel[zeichen];
    else if (tafel[klein] !== undefined && zeichen === klein) aus += tafel[klein];
    else { aus += zeichen; if (!fehlt.includes(zeichen)) fehlt.push(zeichen); }
  }
  return { text: aus, fehlt };
}

export const hoch = (text) => wandle(text, HOCH);
export const tief = (text) => wandle(text, TIEF);

/* ===================================================================== */
/*  Zurück in Klartext                                                   */
/* ===================================================================== */

const RUECK_HOCH = Object.fromEntries(Object.entries(HOCH).map(([a, b]) => [b, a]));

/**
 * Macht aus einer Formel lesbaren Klartext: `\frac{1}{2}` → `1/2`.
 *
 * Gebraucht beim Vergleich getippter Antworten (niemand tippt `\frac`) und
 * beim Vorlesen. Klammern werden nur gesetzt, wo Zähler oder Nenner mehr als
 * ein Glied haben, sonst läse sich „x/2" als „(x)/(2)".
 */
export function alsKlartext(text) {
  return teile(text).map((t) => (t.formel ? formelKlartext(t.inhalt) : t.inhalt)).join("");
}

function klammer(teil) {
  return /^[\w.,²³⁰-⁹]+$/u.test(teil) ? teil : "(" + teil + ")";
}

function formelKlartext(f) {
  let s = String(f);
  // Innen nach außen: verschachtelte Brüche zuerst auflösen.
  for (let runde = 0; runde < 8; runde++) {
    const vorher = s;
    s = s.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g,
      (_, z, n) => klammer(formelKlartext(z)) + "/" + klammer(formelKlartext(n)));
    s = s.replace(/\\sqrt\{([^{}]*)\}/g, (_, x) => "√" + klammer(x));
    s = s.replace(/\^\{([^{}]*)\}/g, (_, x) => hoch(x).text);
    s = s.replace(/_\{([^{}]*)\}/g, (_, x) => tief(x).text);
    if (s === vorher) break;
  }
  return s
    .replace(/\\(cdot|times)/g, "·")
    .replace(/\\pi/g, "π")
    .replace(/\\backslash\s?/g, "\\")
    .replace(/\\([{}$%#&_])/g, "$1")
    .replace(/\^(\w)/g, (_, x) => hoch(x).text)
    .replace(/_(\w)/g, (_, x) => tief(x).text);
}

/** Zum Vorlesen: „1/2" liest keine Stimme gut, „1 durch 2" schon. */
export function alsSprache(text) {
  return alsKlartext(text)
    .replace(/\//g, " durch ")
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻ⁿ]+/g, (m) => " hoch " + [...m].map((z) => RUECK_HOCH[z] ?? z).join(""));
}

/** Hochgestellte Ziffern zurück in `^…` — für den Vergleich getippter Formeln. */
export function hochAlsPotenz(text) {
  return String(text ?? "").replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿ]+/g,
    (m) => "^" + [...m].map((z) => RUECK_HOCH[z] ?? z).join(""));
}

/* ===================================================================== */
/*  Formel-Editor                                                        */
/* ===================================================================== */

/*
 * Der Formel-Editor (MathLive) schreibt ein paar eigene Befehle, die KaTeX
 * nicht kennt. Sie werden hier in gewöhnliches LaTeX übersetzt, ehe die
 * Formel in die Karte geht — sonst stünde später eine rote Fehlermeldung
 * statt des Integrals da.
 */
const EIGENE_BEFEHLE = [
  [/\\differentialD\b/g, "\\mathrm{d}"],
  [/\\exponentialE\b/g, "\\mathrm{e}"],
  [/\\imaginaryI\b/g, "\\mathrm{i}"],
  [/\\imaginaryJ\b/g, "\\mathrm{j}"],
  [/\\placeholder(\[[^\]]*\])?\{[^{}]*\}/g, ""],
];

export function editorZuKatex(latex) {
  let s = String(latex ?? "");
  for (const [muster, ersatz] of EIGENE_BEFEHLE) s = s.replace(muster, ersatz);
  return s.trim();
}

/**
 * Wo im Kartentext die Formeln stehen. → [{ anfang, ende, inhalt }]
 * `anfang` zeigt auf das öffnende, `ende` hinter das schließende
 * Dollarzeichen. Damit lässt sich eine Formel gezielt ersetzen, ohne den
 * Text drumherum anzufassen.
 */
export function formelStellen(text) {
  const s = String(text ?? "");
  const stellen = [];
  let i = 0;
  while (i < s.length) {
    if (s[i] === "\\" && s[i + 1] === "$") { i += 2; continue; }
    if (s[i] === "$") {
      let j = i + 1;
      while (j < s.length && !(s[j] === "$" && s[j - 1] !== "\\")) j++;
      if (j < s.length && j > i + 1) {
        stellen.push({ anfang: i, ende: j + 1, inhalt: s.slice(i + 1, j) });
        i = j + 1;
        continue;
      }
    }
    i += 1;
  }
  return stellen;
}

/** Ersetzt eine Formel an ihrer Stelle; leer heißt: Formel entfernen. */
export function ersetzeFormel(text, stelle, latex) {
  const s = String(text ?? "");
  const neu = editorZuKatex(latex);
  return s.slice(0, stelle.anfang) + (neu ? "$" + neu + "$" : "") + s.slice(stelle.ende);
}
