/*
 * Der Weg zurück: dorthin, wo man wirklich herkam.
 *
 * Ein fester Zurück-Knopf („zum Stapel", „zu allen Stapeln") führt oft an
 * den falschen Ort. Wer über das Fach Mathematik in einen Stapel geht, will
 * zurück zu Mathematik, nicht zur Liste aller Stapel.
 *
 * Der Browser kennt den Verlauf, verrät ihn aber nicht. Darum schreibt die
 * App an jeden Eintrag, wie tief er liegt, und merkt sich die Wege dazu.
 * Zurück heißt dann: einen Schritt im Verlauf, wenn es einen gibt — sonst
 * der vernünftige Ersatz (etwa nach einem Neuladen der Seite).
 *
 * Diese Datei enthält nur, was sich ohne Browser prüfen lässt: die Liste
 * der Wege und ihre Fortschreibung. Das Anbinden steht in App.jsx.
 */

/**
 * Schreibt die Wegliste fort. → neue Liste.
 * `tiefe`  Stelle des jetzigen Eintrags im Verlauf
 * `weg`    der Weg, der jetzt angezeigt wird
 * Ein neuer Eintrag schneidet ab, was dahinter lag — wie im Browser, wo
 * ein neuer Schritt das „Vorwärts" verwirft.
 */
export function fortschreiben(wege, tiefe, weg, { neu = false } = {}) {
  const liste = (wege || []).slice(0, neu ? tiefe : Math.max(tiefe + 1, 0));
  liste[tiefe] = weg;
  return liste;
}

/** Der Weg vor dem jetzigen — oder null. */
export function vorheriger(wege, tiefe) {
  if (!Number.isFinite(tiefe) || tiefe <= 0) return null;
  return (wege || [])[tiefe - 1] ?? null;
}

/**
 * Wie ein Weg heißt, damit der Zurück-Knopf sagen kann, wohin er führt.
 * `namen` liefert Namen für Fächer, Ordner und Stapel.
 */
export function wegName(weg, { fach = () => null, ordner = () => null, stapel = () => null } = {}) {
  if (!weg) return null;
  const [a, b, c] = weg.split("/").filter(Boolean);
  switch (a) {
    case undefined: return "Alle Stapel";
    case "start": return "Start";
    case "fach": return fach(b) || "Fach";
    case "faecher": return "Fächer";
    case "ordner": return ordner(b) || "Ordner";
    case "suche": return "Suche";
    case "fehler": return "Fehlerheft";
    case "statistik": return "Fortschritt";
    case "stapel": return c ? null : stapel(b) || "Stapel";
    default: return null;
  }
}
