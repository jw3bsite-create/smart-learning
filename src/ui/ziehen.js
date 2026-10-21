/*
 * Ziehen zum Umordnen, mit Maus und Finger.
 *
 * Nicht mit dem eingebauten Ziehen des Browsers (draggable): Das geht auf
 * dem iPhone nur eingeschränkt und zeigt beim Ziehen ein halbdurchsichtiges
 * Abbild, das man nicht gestalten kann. Zeiger-Ereignisse gehen überall
 * gleich.
 *
 * Gezogen wird am Griff — oder an jeder anderen Stelle der Zeile, die kein
 * Feld und kein Knopf ist (`anfassen`): mit der Maus, sobald sie sich ein
 * paar Punkte bewegt, mit dem Finger erst nach kurzem Halten. Sofort mit dem
 * Finger hieße, dass jeder Versuch zu scrollen eine Karte verschiebt; wer
 * nach dem Antippen gleich wischt, scrollt darum weiter wie gewohnt.
 */

import { useEffect, useRef, useState } from "react";
import { verschiebe, zielStelle, ausweichen } from "../core/ordnen.js";

const RAND = 72;        // so nah am Rand beginnt die Liste zu scrollen
const TEMPO = 14;       // Punkte je Bild beim Scrollen
const HALTEN = 380;     // so lange hält der Finger still, bis die Karte folgt
const ZITTERN = 10;     // so weit darf er sich dabei bewegen (sonst: scrollen)
const MAUSWEG = 6;      // so weit muss die Maus ziehen, bis es losgeht

/* Wo ein Druck nicht zum Ziehen führt: Felder, Knöpfe, Verweise. */
const NICHT_ANFASSEN = "input, textarea, select, button, a, label, [contenteditable='true'], "
  + "math-field, [data-griff], [role='button'], .menue";

/* Solange gezogen wird, darf die Seite nicht mitscrollen. Nur so bleibt der
   Finger beim Ziehen, statt dass der Browser die Geste übernimmt. */
function scrollenSperren(e) { e.preventDefault(); }

export function useZiehen({ kennungen, aufOrdnen, abstand = 8 }) {
  const [zug, setZugRoh] = useState(null);        // { id, von, nach, dy, hoehe }
  const zugJetzt = useRef(null);
  const lage = useRef(null);
  const warten = useRef(null);                     // ein Druck, der noch kein Zug ist
  const geradeGezogen = useRef(false);
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
    document.removeEventListener("touchmove", scrollenSperren);
    document.documentElement.classList.remove("zieht");
    if (z) {
      // Der Klick, der auf das Loslassen folgt, gehört nicht der Zeile.
      geradeGezogen.current = true;
      setTimeout(() => { geradeGezogen.current = false; }, 0);
    }
    if (uebernehmen && z && z.nach !== z.von) aufOrdnen(verschiebe(kennungen, z.von, z.nach));
  }

  /* Den Zug beginnen: Mitten aller Zeilen merken, Zeiger festhalten. */
  function beginnen(id, element, clientY, zeigerId) {
    const von = kennungen.indexOf(id);
    if (von < 0) return false;
    const zeilen = kennungen.map((k) => document.querySelector('[data-zieh="' + k + '"]'));
    const mitten = zeilen.map((z) => {
      const r = z ? z.getBoundingClientRect() : { top: 0, height: 0 };
      return r.top + window.scrollY + r.height / 2;
    });
    const eigene = zeilen[von]?.getBoundingClientRect();
    lage.current = { von, mitten, startY: clientY + window.scrollY, clientY };
    try { element.setPointerCapture(zeigerId); } catch (f) { /* egal */ }
    document.addEventListener("touchmove", scrollenSperren, { passive: false });
    document.documentElement.classList.add("zieht");
    window.getSelection?.()?.removeAllRanges?.();
    setZug({ id, von, nach: von, dy: 0, hoehe: (eigene?.height || 0) + abstand });
    return true;
  }

  function wartenBeenden() {
    if (warten.current?.uhr) clearTimeout(warten.current.uhr);
    warten.current = null;
  }

  /*
   * Eigenschaften für die ganze Zeile: anfassen, wo kein Feld ist. Die
   * Maus zieht, sobald sie sich bewegt; der Finger erst nach kurzem Halten,
   * dann gibt das Gerät einen kleinen Ruck als Zeichen.
   */
  const anfassen = (id) => ({
    onPointerDown: (e) => {
      if (lage.current || (e.button !== undefined && e.button !== 0)) return;
      if (e.target.closest?.(NICHT_ANFASSEN)) return;
      wartenBeenden();
      const w = { id, x: e.clientX, y: e.clientY, zeiger: e.pointerId, element: e.currentTarget,
        maus: e.pointerType === "mouse" };
      warten.current = w;
      if (!w.maus) {
        w.uhr = setTimeout(() => {
          if (warten.current !== w) return;
          warten.current = null;
          if (beginnen(id, w.element, w.y, w.zeiger)) navigator.vibrate?.(8);
        }, HALTEN);
      }
    },
    onPointerMove: (e) => {
      if (lage.current) { bewegen(e.clientY); return; }
      const w = warten.current;
      if (!w || w.zeiger !== e.pointerId) return;
      const weit = Math.hypot(e.clientX - w.x, e.clientY - w.y);
      if (w.maus && weit > MAUSWEG) {
        warten.current = null;
        beginnen(w.id, w.element, w.y, w.zeiger);
        bewegen(e.clientY);
      } else if (!w.maus && weit > ZITTERN) {
        wartenBeenden();                       // der Finger will scrollen
      }
    },
    onPointerUp: () => { wartenBeenden(); if (lage.current) beenden(true); },
    onPointerCancel: () => { wartenBeenden(); if (lage.current) beenden(false); },
    onContextMenu: (e) => { if (warten.current || lage.current) e.preventDefault(); },
    onClickCapture: (e) => {
      if (geradeGezogen.current) { e.preventDefault(); e.stopPropagation(); }
    },
  });

  /** Eigenschaften für den Griff einer Zeile. */
  const griff = (id) => ({
    "data-griff": "",
    title: "Ziehen zum Umordnen",
    style: { touchAction: "none", cursor: zug ? "grabbing" : "grab" },
    onPointerDown: (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      if (kennungen.indexOf(id) < 0) return;
      e.preventDefault();
      e.stopPropagation();
      beginnen(id, e.currentTarget, e.clientY, e.pointerId);
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

  return { griff, zeile, anfassen, zieht: Boolean(zug) };
}
