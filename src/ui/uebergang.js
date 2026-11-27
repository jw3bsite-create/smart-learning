/*
 * Eine Karte wächst auf den ganzen Bildschirm, dahinter wechselt die Seite.
 *
 * Früher wurde die Karte selbst größer gezogen (Lage und Maße) — dabei setzte
 * der Browser in jedem Bild die Seite neu, und am Ende sprang sie hart um.
 * Das hat gehakt (27.11.2026). Jetzt liegt eine Kopie in einer eigenen
 * Schicht: Ihr Ausschnitt öffnet sich, die neue Seite entsteht verdeckt, dann
 * blendet die Schicht aus.
 */

const WACHSEN = 320;   // ms
const BLENDEN = 220;

export function wachsend(el, weiter) {
  const ruhig = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (!el?.animate || ruhig) { weiter(); return; }
  const r = el.getBoundingClientRect();
  const rund = getComputedStyle(el).borderTopLeftRadius;

  const schicht = document.createElement("div");
  schicht.className = "wachs-schicht";
  schicht.setAttribute("aria-hidden", "true");
  const kopie = el.cloneNode(true);
  Object.assign(kopie.style, { top: r.top + "px", left: r.left + "px", width: r.width + "px", height: r.height + "px" });
  schicht.appendChild(kopie);
  document.body.appendChild(schicht);

  const breite = schicht.clientWidth, hoehe = schicht.clientHeight;
  const aus = "inset(" + r.top + "px " + (breite - r.right) + "px " + (hoehe - r.bottom) + "px "
    + r.left + "px round " + rund + ")";
  schicht.animate([{ clipPath: aus }, { clipPath: "inset(0px 0px 0px 0px round 0px)" }],
    { duration: WACHSEN, easing: "cubic-bezier(.32, .72, 0, 1)", fill: "both" });
  kopie.animate([{ opacity: 1 }, { opacity: 0 }], { duration: WACHSEN * 0.7, easing: "ease-out", fill: "both" });

  /* Mit Uhr statt `finished`: Die Schicht muss auch dann verschwinden, wenn
     der Browser die Bewegung anhält (App im Hintergrund). */
  setTimeout(() => {
    weiter();
    setTimeout(() => {
      schicht.animate([{ opacity: 1 }, { opacity: 0 }], { duration: BLENDEN, easing: "ease-in-out", fill: "both" });
      setTimeout(() => schicht.remove(), BLENDEN);
    }, 60);
  }, WACHSEN);
}
