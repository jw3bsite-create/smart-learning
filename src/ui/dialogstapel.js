/*
 * Welcher Dialog oben liegt.
 *
 * Dialoge können übereinander liegen — eine Rückfrage über dem Fenster, aus
 * dem sie kam. Bisher hörte jeder für sich auf Escape, und ein Druck schloss
 * beide: Wer die Rückfrage abbrechen wollte, verlor auch das Fenster darunter
 * samt allem Eingetippten. Hier steht, wer gerade oben ist; nur der reagiert.
 *
 * Ohne React und ohne Fenster, damit es sich prüfen lässt.
 */

const stapel = [];

/** Legt einen Dialog oben auf; zurück kommt die Funktion, die ihn wieder abnimmt. */
export function auflegen(kennung) {
  stapel.push(kennung);
  return () => {
    const i = stapel.lastIndexOf(kennung);
    if (i >= 0) stapel.splice(i, 1);
  };
}

/** Liegt dieser Dialog zuoberst? */
export function obenauf(kennung) {
  return stapel.length > 0 && stapel[stapel.length - 1] === kennung;
}

/** Wie viele Dialoge gerade offen sind. */
export function anzahlOffen() {
  return stapel.length;
}

/*
 * Was sich mit der Tabulatortaste erreichen lässt. Unsichtbares fällt
 * heraus: Ein verborgenes Feld als letztes Ziel hieße, dass der Fokus am
 * Ende des Dialogs ins Leere springt.
 */
const FOKUSSIERBAR = [
  "button:not([disabled])", "a[href]", "input:not([disabled]):not([type=hidden])",
  "select:not([disabled])", "textarea:not([disabled])", "[tabindex]:not([tabindex='-1'])",
  "[contenteditable='true']", "math-field",
].join(",");

/** Die Ziele in Reihenfolge; `sichtbar` entscheidet im Einzelfall. */
export function fokusZiele(kasten, sichtbar = (el) => el.getClientRects().length > 0) {
  if (!kasten) return [];
  return [...kasten.querySelectorAll(FOKUSSIERBAR)].filter(sichtbar);
}

/**
 * Hält die Tabulatortaste im Dialog: Vom letzten Ziel geht es zum ersten,
 * mit Umschalt vom ersten zum letzten. Gibt zurück, wohin der Fokus soll,
 * oder null, wenn der Browser es selbst richtig macht.
 */
export function naechstesZiel(ziele, aktiv, rueckwaerts, kasten) {
  if (!ziele.length) return kasten || null;
  const erstes = ziele[0];
  const letztes = ziele[ziele.length - 1];
  const drin = ziele.includes(aktiv);
  if (!drin) return rueckwaerts ? letztes : erstes;
  if (rueckwaerts && aktiv === erstes) return letztes;
  if (!rueckwaerts && aktiv === letztes) return erstes;
  return null;
}
