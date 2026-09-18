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
