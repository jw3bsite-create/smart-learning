/*
 * Der Zeitmesser: horcht auf eigene Handlungen und führt die Stoppuhr.
 *
 * Er zeichnet nichts. Was zählt und was nicht, steht in core/lernzeit.js;
 * hier wird nur verdrahtet: welche Seite offen ist, ob das Fenster sichtbar
 * ist und den Fokus hat, und wann gesichert wird.
 */

import { useEffect, useRef } from "react";
import { useDaten } from "../core/store.jsx";
import { Stoppuhr, taetigkeitFuer } from "../core/lernzeit.js";

/* Eigene Handlungen. Bewusst ohne Mausbewegung: Ein Zeiger, der über ein
   Fenster auf dem zweiten Bildschirm streift, ist kein Lernen. */
const HANDLUNGEN = ["pointerdown", "keydown", "wheel", "touchstart", "input", "scroll"];

/** Alle so viele Millisekunden wird der laufende Block gesichert. */
const SICHERN_ALLE = 30 * 1000;

const imBlick = () => document.visibilityState === "visible" && document.hasFocus();

export default function Zeitmesser({ weg }) {
  const { stapelVon, lernzeitSpeichern } = useDaten();
  const uhr = useRef(null);
  if (!uhr.current) uhr.current = new Stoppuhr();
  const taetigkeit = useRef(null);
  const gesichert = useRef(new Map());          // Kennung → gesichertes Ende

  // Immer die neuesten Funktionen, ohne die Horcher neu anzuhängen.
  const aktuell = useRef({});
  aktuell.current = { stapelVon, lernzeitSpeichern };

  /* Nur schreiben, was sich geändert hat. Sonst schriebe ein offenes, aber
     unberührtes Fenster alle halbe Minute denselben Block — und jeder dieser
     Schreibvorgänge schöbe den Abgleich mit der Wolke wieder hinaus. */
  const ablegen = (bloecke) => {
    const neu = bloecke.filter((b) => b && gesichert.current.get(b.id) !== b.ende);
    if (!neu.length) return;
    for (const b of neu) gesichert.current.set(b.id, b.ende);
    aktuell.current.lernzeitSpeichern(neu).catch(() => {});
  };

  /* Ein Seitenwechsel ist selbst eine Handlung — er kommt ja aus einem Klick. */
  useEffect(() => {
    const teile = weg.split("/").filter(Boolean);
    taetigkeit.current = taetigkeitFuer(teile,
      (setId) => aktuell.current.stapelVon(setId)?.subjectId);
    ablegen(imBlick()
      ? uhr.current.regung(Date.now(), taetigkeit.current)
      : uhr.current.anhalten());
  }, [weg]);

  useEffect(() => {
    const regung = () => {
      if (imBlick()) ablegen(uhr.current.regung(Date.now(), taetigkeit.current));
    };
    const halt = () => ablegen(uhr.current.anhalten());
    const sicht = () => { if (document.visibilityState !== "visible") halt(); };
    const optionen = { capture: true, passive: true };

    for (const art of HANDLUNGEN) window.addEventListener(art, regung, optionen);
    document.addEventListener("visibilitychange", sicht);
    window.addEventListener("blur", halt);
    window.addEventListener("pagehide", halt);
    const takt = setInterval(() => {
      const stand = uhr.current.stand();
      if (stand) ablegen([stand]);
    }, SICHERN_ALLE);

    return () => {
      for (const art of HANDLUNGEN) window.removeEventListener(art, regung, optionen);
      document.removeEventListener("visibilitychange", sicht);
      window.removeEventListener("blur", halt);
      window.removeEventListener("pagehide", halt);
      clearInterval(takt);
      halt();
    };
  }, []);

  return null;
}
