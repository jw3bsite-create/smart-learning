/*
 * Bedienhilfen fürs Abrufen und den Lernsnack (UX-Bericht, 27.11.2026).
 *
 * - `ANTWORTFELD`: Antwortfelder ohne Vorschläge und Autokorrektur. Die
 *   iPhone-Tastatur schlug sonst Wörter vor (das erleichtert das Abrufen)
 *   und „verbesserte“ Fachbegriffe (das verfälscht es).
 * - `useUntereinander`: Einschätzung und Bewertung übereinander oder
 *   nebeneinander. „Automatisch“ (Vorgabe): am Handy übereinander, am PC
 *   nebeneinander, wo die Tasten 1 bis 4 der Reihenfolge entsprechen.
 * - `useTippSchutz`: Nach jedem Zustandswechsel werden Tipps auf die neu
 *   erschienenen Knöpfe kurz ignoriert. Sonst bewertete ein Doppeltipp auf
 *   „Aufdecken“ gleich mit (Vorbild: AnkiMobile, „Double Tap Prevention“).
 *   Ein ignorierter Tipp lässt den Knopf kurz wackeln, damit es nicht wie
 *   ein Fehler wirkt.
 * - `erstesMal`: Hinweise, die genau einmal erscheinen.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useDaten } from "../core/store.jsx";
import { NOTEN } from "../core/fsrs.js";

/*
 * Was die vier Bewertungen bedeuten — unter jedem Knopf. FSRS wertet
 * „Schwer“ als Erfolg; wer es für „falsch“ hält, bekommt zu lange Abstände
 * (nach der FSRS-Anleitung für Anki).
 */
export const NOTEN_SINN = {
  [NOTEN.NOCHMAL]: "nicht gewusst",
  [NOTEN.SCHWER]: "gewusst, mit Mühe",
  [NOTEN.GUT]: "gewusst",
  [NOTEN.LEICHT]: "sofort",
};

export const ANTWORTFELD = {
  autoComplete: "off", autoCorrect: "off", autoCapitalize: "off",
  spellCheck: false, enterKeyHint: "done",
};

const BREIT = "(min-width: 861px) and (pointer: fine)";

function useBreit() {
  const [breit, setBreit] = useState(() => Boolean(window.matchMedia?.(BREIT).matches));
  useEffect(() => {
    const m = window.matchMedia?.(BREIT);
    if (!m) return undefined;
    const f = () => setBreit(m.matches);
    m.addEventListener?.("change", f);
    return () => m.removeEventListener?.("change", f);
  }, []);
  return breit;
}

/** Stehen Einschätzung und Bewertung untereinander? */
export function useUntereinander() {
  const { einstellungen } = useDaten();
  const breit = useBreit();
  const wahl = einstellungen.bewertungKnoepfe || "automatisch";
  return wahl === "automatisch" ? !breit : wahl === "uebereinander";
}

/** Wie lange nach einem Zustandswechsel Tipps ignoriert werden. */
export const SCHUTZ_MS = { aus: 0, kurz: 250, normal: 350, lang: 500 };

export function useTippSchutz(zustand) {
  const { einstellungen } = useDaten();
  const ms = SCHUTZ_MS[einstellungen.tippSchutz] ?? SCHUTZ_MS.normal;
  const seit = useRef(0);
  /* Im selben Zug, in dem die neuen Knöpfe erscheinen. */
  useLayoutEffect(() => { seit.current = Date.now(); }, [zustand]);
  return {
    ms,
    /** Gilt dieser Tipp? Wenn nicht, wackelt der Knopf kurz. */
    gilt(e) {
      if (!ms || Date.now() - seit.current >= ms) return true;
      const el = e?.currentTarget;
      if (el?.classList) {
        el.classList.remove("wackelt");
        void el.offsetWidth;          // Bewegung neu starten
        el.classList.add("wackelt");
        setTimeout(() => el.classList.remove("wackelt"), 320);
      }
      return false;
    },
  };
}

/** true beim ersten Mal, danach nie wieder (je Gerät). */
export function erstesMal(name) {
  try {
    const schluessel = "kk:hinweis:" + name;
    if (localStorage.getItem(schluessel)) return false;
    localStorage.setItem(schluessel, "1");
    return true;
  } catch (e) {
    return false;
  }
}
