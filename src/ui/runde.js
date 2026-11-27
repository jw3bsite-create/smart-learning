/*
 * Wo die laufende Abrufen-Runde liegt (Rechnung in core/runde.js).
 *
 * Im Gerät (localStorage), nicht im Abgleich: Eine Runde gehört zu dem
 * Gerät, auf dem man gerade lernt. Geschrieben wird nach jeder Handlung —
 * synchron, darum übersteht auch ein abrupt beendetes iPhone-Fenster den
 * letzten Stand. Wer zuhört (die Leiste „Fortsetzen“), erfährt jede
 * Änderung über ein Ereignis.
 */

import { useEffect, useState } from "react";

const SCHLUESSEL = "kk:abrufRunde";
const EREIGNIS = "kk-runde";

const melden = () => window.dispatchEvent(new Event(EREIGNIS));

export function rundeLaden() {
  try {
    const roh = localStorage.getItem(SCHLUESSEL);
    return roh ? JSON.parse(roh) : null;
  } catch (e) {
    return null;
  }
}

export function rundeSpeichern(schnappschuss) {
  try { localStorage.setItem(SCHLUESSEL, JSON.stringify(schnappschuss)); } catch (e) { /* voll oder gesperrt */ }
  melden();
}

/** Löschen — mit `id` nur, wenn die gespeicherte Runde genau diese ist. */
export function rundeLoeschen(id = null) {
  const s = rundeLaden();
  if (!s || (id && s.id !== id)) return;
  try { localStorage.removeItem(SCHLUESSEL); } catch (e) { /* egal */ }
  melden();
}

/** Die gespeicherte Runde, stets aktuell. */
export function useRunde() {
  const [runde, setRunde] = useState(rundeLaden);
  useEffect(() => {
    const neu = () => setRunde(rundeLaden());
    window.addEventListener(EREIGNIS, neu);
    return () => window.removeEventListener(EREIGNIS, neu);
  }, []);
  return runde;
}
