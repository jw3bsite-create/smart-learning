/*
 * Die Erinnerungszeit: vom Erscheinen der Frage bis zum Aufdecken.
 *
 * Steht Anchor im Hintergrund (anderer Reiter, andere App, Bildschirm aus),
 * hält die Uhr an — sonst wäre jede Karte nach einer Nachricht „langsam“.
 * Gekappt wird nicht hier, sondern in core/wiedervorlage.js, weil dafür der
 * Median des Stapels gebraucht wird.
 */

import { useEffect, useRef } from "react";

const jetzt = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
const versteckt = () => typeof document !== "undefined" && document.visibilityState === "hidden";

export function useStoppuhr() {
  const uhr = useRef({ summe: 0, seit: null, steht: true });

  useEffect(() => {
    const wechsel = () => {
      const u = uhr.current;
      if (u.steht) return;
      if (versteckt()) {
        if (u.seit !== null) { u.summe += jetzt() - u.seit; u.seit = null; }
      } else if (u.seit === null) u.seit = jetzt();
    };
    document.addEventListener("visibilitychange", wechsel);
    return () => document.removeEventListener("visibilitychange", wechsel);
  }, []);

  /** Von vorn, für eine neue Frage. */
  const starten = () => { uhr.current = { summe: 0, seit: versteckt() ? null : jetzt(), steht: false }; };

  /** Anhalten (beim Aufdecken) und die Millisekunden zurückgeben. Ein
      zweites Anhalten ändert nichts mehr. */
  const anhalten = () => {
    const u = uhr.current;
    if (!u.steht) {
      if (u.seit !== null) u.summe += jetzt() - u.seit;
      u.seit = null; u.steht = true;
    }
    return Math.round(u.summe);
  };

  return { starten, anhalten };
}
