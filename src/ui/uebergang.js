/*
 * Von der Startseite ins Abrufen: Aus der kleinen Frage wird die große.
 *
 * Zwei Anläufe davor: Erst wuchs die Kachel selbst (Lage und Maße) — der
 * Browser setzte dabei in jedem Bild die ganze Seite neu, es hakte sichtbar.
 * Dann eine Kopie in einer eigenen Schicht, deren Ausschnitt aufging: flüssig,
 * aber dazwischen lag ein dunkler, leerer Augenblick (Nutzer, 27.11.2026).
 *
 * Jetzt macht es der Browser selbst. `startViewTransition` fotografiert die
 * Seite vorher und nachher und bewegt die Stücke, die beidseits denselben
 * `view-transition-name` tragen, ineinander (hier `abruf-karte`: die Kachel
 * der Startseite und der Frageblock im Abrufen, siehe stil.css). Nichts wird
 * dabei leer, und die Bewegung läuft außerhalb des Seitenaufbaus.
 *
 * Kennt der Browser das nicht oder sind Bewegungen abgestellt, geht es ohne
 * Umschweife weiter — ein Übergang ist nie die Sache selbst.
 */

/** Sollen Bewegungen laufen? „Ruhige Oberfläche“ setzt `--wechsel` auf 0. */
function bewegt() {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
  const w = getComputedStyle(document.documentElement).getPropertyValue("--wechsel");
  return parseFloat(w) > 0;
}

export function wachsend(weiter) {
  if (typeof document.startViewTransition !== "function" || !bewegt()) { weiter(); return; }
  document.startViewTransition(() => new Promise((fertig) => {
    /* Der neue Zustand wird fotografiert, sobald dieses Versprechen eingelöst
       ist — also erst, wenn die neue Seite wirklich steht. Zwei Bilder
       Vorlauf, und eine Notbremse, falls der Wegwechsel ausbleibt. */
    const steht = () => requestAnimationFrame(() => requestAnimationFrame(fertig));
    window.addEventListener("hashchange", steht, { once: true });
    setTimeout(fertig, 400);
    weiter();
  }));
}
