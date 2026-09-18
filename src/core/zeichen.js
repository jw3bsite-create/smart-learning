/*
 * Mathematische Zeichen zum Einfügen.
 *
 * Dieselbe Auswahl wie im Wissensnetz, damit man nicht zwei Anordnungen
 * lernen muss. Es sind gewöhnliche Unicode-Zeichen, kein Formelsatz: Sie
 * stehen als Text in der Karte, überstehen jede Ausfuhr (Quizlet, Anki,
 * Tabelle, Sicherung) und lassen sich beim Schreiben-Modus auch eintippen
 * und vergleichen. Für Brüche und mehrzeilige Formeln reicht das nicht — dafür
 * kommt später der Formelsatz.
 */

export const ZEICHEN = [
  { gruppe: "Rechnen", zeichen: ["·", "×", "÷", "±", "∓", "≠", "≈", "≡", "≤", "≥", "≪", "≫",
    "√", "∛", "∞", "%", "‰", "°"] },
  { gruppe: "Analysis", zeichen: ["∫", "∬", "∮", "∑", "∏", "∂", "∇", "Δ", "lim", "→", "d",
    "′", "″", "ƒ"] },
  { gruppe: "Mengen & Logik", zeichen: ["∈", "∉", "⊂", "⊆", "⊃", "⊇", "∪", "∩", "∅", "∀", "∃",
    "¬", "∧", "∨", "⇒", "⇔", "ℕ", "ℤ", "ℚ", "ℝ", "ℂ"] },
  { gruppe: "Griechisch", zeichen: ["α", "β", "γ", "δ", "ε", "θ", "λ", "μ", "π", "ρ", "σ", "τ",
    "φ", "χ", "ψ", "ω", "Γ", "Θ", "Λ", "Π", "Σ", "Φ", "Ω"] },
  { gruppe: "Hoch & tief", zeichen: ["⁰", "¹", "²", "³", "⁴", "ⁿ", "₀", "₁", "₂", "₃", "ₙ",
    "⃗", "≙", "∝", "⊥", "∥", "∠"] },
];

/*
 * Wie ein Zeichen auf seinem Knopf erscheint.
 *
 * Der Vektorpfeil ist ein Kombinationszeichen: Er setzt sich auf den
 * Buchstaben davor. Allein auf einem Knopf stünde er über nichts und wäre
 * unsichtbar oder verrutscht; der gepunktete Kreis ist die übliche
 * Platzhalterform dafür.
 */
export function anzeige(zeichen) {
  return /^[̀-ͯ⃐-⃿]$/.test(zeichen) ? "◌" + zeichen : zeichen;
}

/**
 * Setzt ein Zeichen an die Schreibmarke — oder ersetzt, was markiert ist.
 * → { text, marke } mit der neuen Position der Schreibmarke dahinter.
 */
export function einfuegen(text, anfang, ende, zeichen) {
  const t = String(text ?? "");
  const a = Math.max(0, Math.min(Number.isFinite(anfang) ? anfang : t.length, t.length));
  const b = Math.max(a, Math.min(Number.isFinite(ende) ? ende : a, t.length));
  return { text: t.slice(0, a) + zeichen + t.slice(b), marke: a + zeichen.length };
}

/* ===================================================================== */
/*  Für den Formel-Editor                                                */
/* ===================================================================== */

/*
 * Bausteine: [Name, was eingefügt wird, wie das Bild auf dem Knopf aussieht].
 *
 * `#@` nimmt, was links von der Schreibmarke steht (aus „3" wird „3 hoch …"),
 * `#0` nimmt, was markiert ist, `#?` ist ein leeres Feld zum Ausfüllen.
 */
export const FORMEL_BAUSTEINE = [
  ["Bruch", "\\frac{#@}{#?}", "\\frac{a}{b}"],
  ["Hochzahl", "#@^{#?}", "x^{n}"],
  ["Tiefzahl", "#@_{#?}", "x_{n}"],
  ["Wurzel", "\\sqrt{#0}", "\\sqrt{x}"],
  ["n-te Wurzel", "\\sqrt[#?]{#0}", "\\sqrt[n]{x}"],
  ["Klammern", "\\left(#0\\right)", "(x)"],
  ["Betrag", "\\left|#0\\right|", "|x|"],
  ["Integral", "\\int_{#?}^{#?}#0\\,\\mathrm{d}x", "\\int_{a}^{b}"],
  ["Summe", "\\sum_{#?}^{#?}#0", "\\sum_{i}^{n}"],
  ["Grenzwert", "\\lim_{#? \\to #?}#0", "\\lim_{x\\to a}"],
  ["Vektor", "\\vec{#0}", "\\vec{v}"],
  ["Ableitung", "#@'", "f'"],
];

/*
 * Dieselben Zeichen wie in der Zeichenleiste, jeweils mit dem Befehl, den
 * der Editor versteht: [Zeichen auf dem Knopf, Befehl].
 */
export const FORMEL_ZEICHEN = [
  { gruppe: "Rechnen", zeichen: [
    ["·", "\\cdot"], ["×", "\\times"], ["÷", "\\div"], ["±", "\\pm"], ["∓", "\\mp"],
    ["≠", "\\ne"], ["≈", "\\approx"], ["≡", "\\equiv"], ["≤", "\\le"], ["≥", "\\ge"],
    ["≪", "\\ll"], ["≫", "\\gg"], ["√", "\\sqrt{#0}"], ["∛", "\\sqrt[3]{#0}"],
    ["∞", "\\infty"], ["%", "\\%"], ["°", "^{\\circ}"],
  ] },
  { gruppe: "Analysis", zeichen: [
    ["∫", "\\int"], ["∬", "\\iint"], ["∮", "\\oint"], ["∑", "\\sum"], ["∏", "\\prod"],
    ["∂", "\\partial"], ["∇", "\\nabla"], ["Δ", "\\Delta"], ["lim", "\\lim"], ["→", "\\to"],
    ["d", "\\mathrm{d}"], ["′", "'"], ["″", "''"], ["ƒ", "f"], ["e", "\\mathrm{e}"],
  ] },
  { gruppe: "Mengen & Logik", zeichen: [
    ["∈", "\\in"], ["∉", "\\notin"], ["⊂", "\\subset"], ["⊆", "\\subseteq"], ["⊃", "\\supset"],
    ["⊇", "\\supseteq"], ["∪", "\\cup"], ["∩", "\\cap"], ["∅", "\\emptyset"], ["∀", "\\forall"],
    ["∃", "\\exists"], ["¬", "\\neg"], ["∧", "\\land"], ["∨", "\\lor"], ["⇒", "\\Rightarrow"],
    ["⇔", "\\Leftrightarrow"], ["ℕ", "\\mathbb{N}"], ["ℤ", "\\mathbb{Z}"], ["ℚ", "\\mathbb{Q}"], ["ℝ", "\\mathbb{R}"],
    ["ℂ", "\\mathbb{C}"],
  ] },
  { gruppe: "Griechisch", zeichen: [
    ["α", "\\alpha"], ["β", "\\beta"], ["γ", "\\gamma"], ["δ", "\\delta"], ["ε", "\\varepsilon"],
    ["θ", "\\theta"], ["λ", "\\lambda"], ["μ", "\\mu"], ["π", "\\pi"], ["ρ", "\\rho"],
    ["σ", "\\sigma"], ["τ", "\\tau"], ["φ", "\\varphi"], ["χ", "\\chi"], ["ψ", "\\psi"],
    ["ω", "\\omega"], ["Γ", "\\Gamma"], ["Θ", "\\Theta"], ["Λ", "\\Lambda"], ["Π", "\\Pi"],
    ["Σ", "\\Sigma"], ["Φ", "\\Phi"], ["Ω", "\\Omega"],
  ] },
  { gruppe: "Geometrie", zeichen: [
    ["⊥", "\\perp"], ["∥", "\\parallel"], ["∠", "\\angle"], ["≙", "\\triangleq"],
    ["∝", "\\propto"], ["°", "^{\\circ}"], ["△", "\\triangle"],
  ] },
];
