/*
 * Rechenwege als Text und zurück: eine Zeile je Schritt.
 *
 * „ableiten: f'(x) = 2x" wird Frage und Antwort, eine Zeile ohne Doppelpunkt
 * nur Antwort. Stand vorher im Editor; das Bearbeiten im Modus braucht
 * dieselbe Regel, also liegt sie jetzt hier.
 */

/** Die Schritte eines Rechenwegs als Text, eine Zeile je Schritt. */
export function schritteAlsText(schritte) {
  return (schritte || []).map((s) => (s.frage ? s.frage + ": " + s.antwort : s.antwort)).join("\n");
}

/** Zeilen zu Schritten. */
export function textAlsSchritte(text) {
  return String(text || "").split("\n")
    .map((z) => z.trim()).filter(Boolean)
    .map((z) => {
      const stelle = z.indexOf(":");
      // Nur trennen, wenn vorn wirklich eine Anweisung steht und nicht etwa
      // ein Verhältnis wie „3:4".
      if (stelle > 2 && /[a-zäöüß]\s*$/i.test(z.slice(0, stelle)))
        return { frage: z.slice(0, stelle).trim(), antwort: z.slice(stelle + 1).trim() };
      return { frage: "", antwort: z };
    });
}
