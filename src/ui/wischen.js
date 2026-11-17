/*
 * Wischen auf einer Karte, wie bei Quizlet.
 *
 * Die Karte folgt dem Finger. Weit genug nach rechts heißt „Weiß ich“, nach
 * links „Noch üben“; dann fliegt sie hinaus und die nächste kommt. Kurz
 * gewischt federt sie zurück. Tippen dreht sie wie bisher um, senkrecht
 * blättert die Seite. Mit der Maus geht es genauso.
 *
 * Nur für die Übungsmodi gedacht. Im Abrufen wird nicht gewischt: Dort steht
 * vor jeder Bewertung das Aufdecken, und ein Wisch wäre eine Note im
 * Vorbeigehen.
 */

import { useRef, useState } from "react";

const SCHWELLE = 90;    // Punkte, ab denen ein Wisch zählt
const ANLAUF = 10;      // bis hierher ist es noch ein Tippen
const FLUG = 180;       // Millisekunden, bis die Karte draußen ist

export function useWischen({ links, rechts, aktiv = true }) {
  const [dx, setDx] = useState(0);
  const [zieht, setZieht] = useState(false);
  const [fliegt, setFliegt] = useState(0);         // -1 links hinaus, 1 rechts
  const start = useRef(null);
  const gewischt = useRef(false);

  const abbrechen = () => { start.current = null; setZieht(false); setDx(0); };

  const griffe = {
    onPointerDown: (e) => {
      if (!aktiv || fliegt || e.button > 0) return;
      // Stift, Stern und Ton bleiben Knöpfe.
      if (e.target.closest("button, a, input, textarea, audio, [role='button']")) return;
      start.current = { x: e.clientX, y: e.clientY, id: e.pointerId, waagrecht: null };
      gewischt.current = false;
    },
    onPointerMove: (e) => {
      const s = start.current;
      if (!s || s.id !== e.pointerId) return;
      const x = e.clientX - s.x;
      const y = e.clientY - s.y;
      if (s.waagrecht === null) {
        if (Math.abs(x) < ANLAUF && Math.abs(y) < ANLAUF) return;
        s.waagrecht = Math.abs(x) > Math.abs(y);
        if (!s.waagrecht) { start.current = null; return; }
        e.currentTarget.setPointerCapture?.(e.pointerId);
        gewischt.current = true;
        setZieht(true);
      }
      setDx(x);
    },
    onPointerUp: (e) => {
      const s = start.current;
      if (!s || !s.waagrecht) { start.current = null; return; }
      const x = e.clientX - s.x;
      start.current = null;
      setZieht(false);
      if (Math.abs(x) < SCHWELLE) { setDx(0); return; }
      const richtung = x > 0 ? 1 : -1;
      setFliegt(richtung);
      setTimeout(() => {
        (richtung > 0 ? rechts : links)();
        setFliegt(0); setDx(0);
      }, FLUG);
    },
    onPointerCancel: abbrechen,
    // Auf einen Wisch folgt ein Klick; der darf die Karte nicht umdrehen.
    onClickCapture: (e) => {
      if (!gewischt.current) return;
      gewischt.current = false;
      e.stopPropagation(); e.preventDefault();
    },
  };

  const stil = fliegt
    ? { transform: `translateX(${fliegt * 130}%) rotate(${fliegt * 14}deg)`,
      transition: `transform ${FLUG}ms ease-in`, opacity: 0.6 }
    : { transform: dx ? `translateX(${dx}px) rotate(${dx / 24}deg)` : undefined,
      transition: zieht ? "none" : `transform ${FLUG}ms ease-out` };

  /* Wie weit es schon Richtung Entscheidung geht, von -1 bis 1 — für die
     Anzeige „Weiß ich“ / „Noch üben“ beim Ziehen. */
  const anteil = fliegt || Math.max(-1, Math.min(1, dx / SCHWELLE));

  return { griffe, stil, anteil };
}
