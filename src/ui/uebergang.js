/*
 * Von der Startseite ins Abrufen: Aus der kleinen Frage wird die große.
 *
 * Zwei Anläufe davor: Erst wuchs die Kachel selbst (Lage und Maße) — der
 * Browser setzte dabei in jedem Bild die ganze Seite neu, es hakte sichtbar.
 * Dann eine Kopie in einer eigenen Schicht, deren Ausschnitt aufging:
 * flüssig, aber dazwischen lag ein dunkler, leerer Augenblick.
 *
 * Jetzt macht es der Browser selbst. `startViewTransition` fotografiert die
 * Seite vorher und nachher und bewegt die Stücke, die beidseits denselben
 * `view-transition-name` tragen, ineinander (hier `abruf-karte`: die Kachel
 * der Startseite und der Frageblock im Abrufen, siehe stil.css).
 *
 * Dazwischen steht das Bild still. Darum muss das Warten so kurz wie möglich
 * sein: `wegGesetzt` meldet aus der App, sobald die neue Seite steht (der
 * Effekt läuft nach dem Einbauen und vor dem Zeichnen), und erst dann wird
 * fotografiert. Bleibt der Wegwechsel aus, greift die Notbremse.
 *
 * Kennt der Browser keine View Transitions oder sind Bewegungen abgestellt,
 * geht es ohne Umschweife weiter — ein Übergang ist nie die Sache selbst.
 */

const NOTBREMSE = 500;   // ms
let wartet = null;

/** Aus der App: Die neue Seite steht. */
export function wegGesetzt() {
  const w = wartet;
  wartet = null;
  if (w) w();
}

/** Sollen Bewegungen laufen? „Ruhige Oberfläche“ setzt `--wechsel` auf 0. */
function bewegt() {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
  const w = getComputedStyle(document.documentElement).getPropertyValue("--wechsel");
  return parseFloat(w) > 0;
}

export function wachsend(weiter) {
  if (typeof document.startViewTransition !== "function" || !bewegt()) { weiter(); return; }
  /* Solange der Übergang läuft, blendet die neue Seite nicht zusätzlich ein
     (`.mitte` in stil.css): Zwei Blenden übereinander sahen fahl aus. */
  const wurzel = document.documentElement;
  wurzel.classList.add("im-uebergang");
  const ab = setTimeout(() => wurzel.classList.remove("im-uebergang"), 2000);
  const lauf = document.startViewTransition(() => new Promise((fertig) => {
    wartet = fertig;
    setTimeout(() => { if (wartet === fertig) wegGesetzt(); }, NOTBREMSE);
    weiter();
  }));
  lauf.finished.finally(() => { clearTimeout(ab); wurzel.classList.remove("im-uebergang"); });
}
