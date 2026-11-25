/*
 * Karteikarten oben im Stapel — wie bei Quizlet (seit dem 25. November 2026,
 * in den Einstellungen unter Lernen wählbar: „Oben im Stapel“).
 *
 * Antippen dreht, wischen oder die Pfeile blättern, das Symbol rechts oben
 * öffnet die Karteikarten im Ganzen. Nur zum Ansehen: Hier wird nichts
 * verbucht, kein Lernstand, keine Übung — dafür gibt es die Modi und das
 * Abrufen darunter.
 */

import React, { useEffect, useRef, useState } from "react";
import { seitenFuer } from "../core/kartenseiten.js";
import { gehe } from "../App.jsx";
import { SymbolKnopf, Bild } from "./basis.jsx";
import Formel from "./Formel.jsx";

export default function KartenVorschau({ setId, karten }) {
  const [stelle, setStelle] = useState(0);
  const [gedreht, setGedreht] = useState(false);
  const start = useRef(null);
  const anzahl = karten.length;

  useEffect(() => { if (stelle >= anzahl) setStelle(0); }, [anzahl]);
  if (!anzahl) return null;

  const karte = karten[Math.min(stelle, anzahl - 1)];
  const seiten = seitenFuer(karte, "td");
  const zu = (i) => { setGedreht(false); setStelle((i + anzahl) % anzahl); };

  const text = gedreht ? seiten.antwort : seiten.frage;
  const bild = gedreht ? seiten.antwortBild : seiten.frageBild;

  return (
    <div className="vorschau unten-20">
      <div className={"vorschau-karte" + (gedreht ? " gedreht" : "")}
        role="button" tabIndex={0} aria-label={gedreht ? "Rückseite, antippen zum Drehen" : "Vorderseite, antippen zum Drehen"}
        onClick={() => setGedreht((g) => !g)}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") { e.preventDefault(); setGedreht((g) => !g); }
          else if (e.key === "ArrowRight") zu(stelle + 1);
          else if (e.key === "ArrowLeft") zu(stelle - 1);
        }}
        onTouchStart={(e) => { start.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (start.current === null) return;
          const weg = e.changedTouches[0].clientX - start.current;
          start.current = null;
          if (Math.abs(weg) > 45) { e.preventDefault(); zu(stelle + (weg < 0 ? 1 : -1)); }
        }}>
        <div className="vorschau-inhalt" key={karte.id + (gedreht ? ":r" : ":v")}>
          {bild && <Bild kennung={bild} />}
          {text && <div className={"vorschau-text" + (String(text).length > 120 ? " lang" : "")}><Formel text={text} /></div>}
        </div>
        <div className="vorschau-ecke" onClick={(e) => e.stopPropagation()}>
          <SymbolKnopf symbol="raster" titel="Karteikarten öffnen" art="leer klein"
            onClick={() => gehe("/stapel/" + setId + "/karten")} />
        </div>
      </div>
      <div className="reihe vorschau-leiste">
        <SymbolKnopf symbol="pfeilLinks" titel="Vorige Karte" art="leer" onClick={() => zu(stelle - 1)} />
        <span className="klein matt mono">{Math.min(stelle, anzahl - 1) + 1} / {anzahl}</span>
        <SymbolKnopf symbol="pfeilRechts" titel="Nächste Karte" art="leer" onClick={() => zu(stelle + 1)} />
      </div>
    </div>
  );
}
