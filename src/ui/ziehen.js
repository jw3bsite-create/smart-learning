/*
 * Ziehen zum Umordnen, mit Maus und Finger.
 *
 * Nicht mit dem eingebauten Ziehen des Browsers (draggable): Das geht auf
 * dem iPhone nur eingeschränkt und zeigt beim Ziehen ein halbdurchsichtiges
 * Abbild, das man nicht gestalten kann. Zeiger-Ereignisse gehen überall
 * gleich.
 *
 * Gezogen wird nur am Griff. Die ganze Zeile anfassbar zu machen hieße, dass
 * jeder Versuch zu scrollen eine Karte verschiebt.
 */

import { useEffect, useRef, useState } from "react";
import { verschiebe, zielStelle, ausweichen } from "../core/ordnen.js";

const RAND = 72;        // so nah am Rand beginnt die Liste zu scrollen
const TEMPO = 14;       // Punkte je Bild beim Scrollen

export function useZiehen({ kennungen, aufOrdnen, abstand = 8 }) {
  const [zug, setZugRoh] = useState(null);        // { id, von, nach, dy, hoehe }
  const zugJetzt = useRef(null);
  const lage = useRef(null);
  /* Den Zug zusaetzlich in einer Referenz halten: Beim Loslassen wird daraus
     die neue Reihenfolge — das darf nicht in einer Zustandsaktualisierung
     geschehen, die React doppelt ausfuehren darf. */
  const setZug = (neu) => { zugJetzt.current = neu; setZugRoh(neu); };
  const bild = useRef(0);

  /* Am Rand weiterscrollen, auch wenn der Finger stillhält. */
  useEffect(() => {
    if (!zug) return;
    const schritt = () => {
      const l = lage.current;
      if (l) {
        let richtung = 0;
        if (l.clientY < RAND) richtung = -1;
        else if (l.clientY > window.innerHeight - RAND) richtung = 1;
        if (richtung) {
          window.scrollBy(0, richtung * TEMPO);
          bewegen(l.clientY);
        }
      }
      bild.current = requestAnimationFrame(schritt);
    };
    bild.current = requestAnimationFrame(schritt);
    return () => cancelAnimationFrame(bild.current);
  }, [Boolean(zug)]);

  function bewegen(clientY) {
    const l = lage.current;
    if (!l) return;
    l.clientY = clientY;
    const y = clientY + window.scrollY;
    const nach = zielStelle(l.mitten, l.von, y);
    if (zugJetzt.current) setZug({ ...zugJetzt.current, nach, dy: y - l.startY });
  }

  function beenden(uebernehmen) {
    const z = zugJetzt.current;
    lage.current = null;
    setZug(null);
    if (uebernehmen && z && z.nach !== z.von) aufOrdnen(verschiebe(kennungen, z.von, z.nach));
  }

  /** Eigenschaften für den Griff einer Zeile. */
  const griff = (id) => ({
    "data-griff": "",
    title: "Ziehen zum Umordnen",
    style: { touchAction: "none", cursor: zug ? "grabbing" : "grab" },
    onPointerDown: (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      const von = kennungen.indexOf(id);
      if (von < 0) return;
      e.preventDefault();
      e.stopPropagation();
      const zeilen = kennungen.map((k) => document.querySelector('[data-zieh="' + k + '"]'));
      const mitten = zeilen.map((z) => {
        const r = z ? z.getBoundingClientRect() : { top: 0, height: 0 };
        return r.top + window.scrollY + r.height / 2;
      });
      const eigene = zeilen[von]?.getBoundingClientRect();
      lage.current = {
        von, mitten, startY: e.clientY + window.scrollY, clientY: e.clientY,
      };
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (f) { /* egal */ }
      setZug({ id, von, nach: von, dy: 0, hoehe: (eigene?.height || 0) + abstand });
    },
    onPointerMove: (e) => { if (lage.current) bewegen(e.clientY); },
    onPointerUp: () => beenden(true),
    onPointerCancel: () => beenden(false),
    onClick: (e) => e.stopPropagation(),
  });

  /** Stil und Klasse für eine Zeile — die gezogene folgt dem Finger. */
  const zeile = (id, index) => {
    if (!zug) return { "data-zieh": id };
    if (id === zug.id) {
      return {
        "data-zieh": id,
        className: "wird-gezogen",
        style: { transform: "translateY(" + zug.dy + "px)", zIndex: 5, position: "relative" },
      };
    }
    const versatz = ausweichen(index, zug.von, zug.nach, zug.hoehe);
    return {
      "data-zieh": id,
      style: { transform: versatz ? "translateY(" + versatz + "px)" : undefined,
        transition: "transform 0.15s" },
    };
  };

  return { griff, zeile, zieht: Boolean(zug) };
}
