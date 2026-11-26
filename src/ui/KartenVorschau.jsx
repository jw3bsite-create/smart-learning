/*
 * Karteikarten oben im Stapel — wie bei Quizlet (in den Einstellungen unter
 * Lernen wählbar: „Oben im Stapel“).
 *
 * Seit dem 26.11.2026 nach einem Bildschirmfoto des Nutzers: eine große
 * Karte, die nächste schaut am Rand hervor; beim Ziehen läuft die Karte mit
 * dem Finger mit und rastet weich ein. Antippen dreht, das Symbol unten
 * rechts öffnet die Karteikarten im Ganzen. Zuerst kommen die Karten, die
 * heute anstehen — so entsteht ein Arbeitsablauf.
 *
 * Nur zum Ansehen: Hier wird nichts verbucht, kein Lernstand, keine Übung.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useDaten } from "../core/store.jsx";
import { seitenFuer } from "../core/kartenseiten.js";
import { istFaellig } from "../core/fsrs.js";
import { gehe } from "../App.jsx";
import { SymbolKnopf, Symbol, Bild } from "./basis.jsx";
import Formel from "./Formel.jsx";

const BREITE = 0.84;   // Anteil der Kartenbreite an der Fläche; der Rest zeigt die Nachbarn
const ABSTAND = 12;    // Pixel zwischen den Karten

export default function KartenVorschau({ setId, karten }) {
  const { zustaende } = useDaten();
  /* Was heute ansteht, zuerst; sonst die Reihenfolge des Stapels. */
  const reihe = useMemo(() => {
    const jetzt = Date.now();
    const faellig = (k) => ["td", "dt"].some((r) => istFaellig(zustaende[k.id + ":" + r], jetzt));
    return [...karten.filter(faellig), ...karten.filter((k) => !faellig(k))];
  }, [karten, zustaende]);
  const anzahlFaellig = useMemo(() => reihe.filter((k) =>
    ["td", "dt"].some((r) => istFaellig(zustaende[k.id + ":" + r]))).length, [reihe, zustaende]);

  const [stelle, setStelle] = useState(0);
  const [gedreht, setGedreht] = useState(false);
  const [zug, setZug] = useState(0);          // aktuelle Verschiebung beim Ziehen (px)
  const [zieht, setZieht] = useState(false);
  const flaeche = useRef(null);
  const druck = useRef(null);
  const [breite, setBreite] = useState(320);
  const n = reihe.length;

  useEffect(() => { if (stelle >= n) setStelle(Math.max(0, n - 1)); }, [n]);
  useEffect(() => {
    const messen = () => setBreite(flaeche.current?.clientWidth || 320);
    messen();
    window.addEventListener("resize", messen);
    return () => window.removeEventListener("resize", messen);
  }, []);
  if (!n) return null;

  const karteB = Math.round(breite * BREITE);
  const schritt = karteB + ABSTAND;
  const rand = Math.round((breite - karteB) / 2);
  const zu = (i) => { setGedreht(false); setStelle(Math.min(n - 1, Math.max(0, i))); };

  const runter = (e) => {
    druck.current = { x: e.clientX, y: e.clientY, zeit: Date.now(), seitlich: null };
    setZieht(true);
  };
  const ziehen = (e) => {
    const d = druck.current;
    if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (d.seitlich === null && Math.abs(dx) + Math.abs(dy) > 6) d.seitlich = Math.abs(dx) > Math.abs(dy);
    if (d.seitlich) {
      e.preventDefault();
      /* Am Anfang und am Ende gibt die Karte nur zögernd nach. */
      const amRand = (stelle === 0 && dx > 0) || (stelle === n - 1 && dx < 0);
      setZug(amRand ? dx / 3 : dx);
    }
  };
  const hoch = () => {
    const d = druck.current;
    druck.current = null;
    setZieht(false);
    if (!d) return;
    const tempo = zug / Math.max(1, Date.now() - d.zeit);       // px je ms
    if (d.seitlich && (Math.abs(zug) > schritt * 0.25 || Math.abs(tempo) > 0.45)) zu(stelle + (zug < 0 ? 1 : -1));
    else if (!d.seitlich) setGedreht((g) => !g);                   // Tippen dreht
    setZug(0);
  };

  /* Nur die Karten in der Nähe zeichnen — mehr sieht man nicht. */
  const sichtbar = [];
  for (let i = Math.max(0, stelle - 2); i <= Math.min(n - 1, stelle + 2); i++) sichtbar.push(i);

  return (
    <div className="vorschau unten-20">
      <div ref={flaeche} className="vorschau-flaeche"
        onPointerDown={runter} onPointerMove={ziehen} onPointerUp={hoch} onPointerCancel={hoch}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") { e.preventDefault(); setGedreht((g) => !g); }
          else if (e.key === "ArrowRight") zu(stelle + 1);
          else if (e.key === "ArrowLeft") zu(stelle - 1);
        }}
        tabIndex={0} role="group" aria-label={"Karteikarte " + (stelle + 1) + " von " + n}>
        <div className={"vorschau-spur" + (zieht ? " zieht" : "")}
          style={{ transform: "translateX(" + (rand - stelle * schritt + zug) + "px)" }}>
          {sichtbar.map((i) => {
            const k = reihe[i];
            const vorn = i === stelle;
            const s = seitenFuer(k, "td");
            const dreh = vorn && gedreht;
            const text = dreh ? s.antwort : s.frage;
            const bild = dreh ? s.antwortBild : s.frageBild;
            return (
              <div key={k.id} className={"vorschau-karte" + (dreh ? " gedreht" : "") + (vorn ? " vorn" : "")}
                style={{ width: karteB, left: i * schritt }}>
                <div className="vorschau-inhalt" key={k.id + (dreh ? ":r" : ":v")}>
                  {bild && <Bild kennung={bild} />}
                  {text && <div className={"vorschau-text" + (String(text).length > 120 ? " lang" : "")}><Formel text={text} /></div>}
                </div>
                {vorn && (
                  <button type="button" className="vorschau-vollbild" title="Karteikarten öffnen" aria-label="Karteikarten öffnen"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); gehe("/stapel/" + setId + "/karten"); }}>
                    <Symbol name="vollbild" groesse={18} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="reihe vorschau-leiste">
        <SymbolKnopf symbol="pfeilLinks" titel="Vorige Karte" art="leer" onClick={() => zu(stelle - 1)} disabled={stelle === 0} />
        <span className="klein matt mono">
          {stelle + 1} / {n}{anzahlFaellig > 0 && stelle < anzahlFaellig ? " · heute dran" : ""}
        </span>
        <SymbolKnopf symbol="pfeilRechts" titel="Nächste Karte" art="leer" onClick={() => zu(stelle + 1)} disabled={stelle >= n - 1} />
      </div>
    </div>
  );
}
