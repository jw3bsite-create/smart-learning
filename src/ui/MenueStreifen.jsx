/*
 * Die Logo-Leiste oben am Handy (Logo, Glocke, auf Wunsch die Pfeile) und
 * die Zurück-/Vor-Pfeile.
 *
 * Seit dem 26.11.2026 auch über den Vollbild-Modi (Abrufen, Lernen, …):
 * Vorher verschwand dort das Logo, und an seiner Stelle stand das Kreuz zum
 * Beenden — der Weg zurück wanderte. Jetzt bleibt das Logo oben, und darunter
 * steht überall derselbe runde Zurück-Knopf (`ZurueckKnopf` in basis.jsx).
 */

import React from "react";
import { useDaten } from "../core/store.jsx";
import { gehe, START, naechsterWeg } from "../App.jsx";
import { SymbolKnopf } from "./basis.jsx";
import Glocke from "./Glocke.jsx";

/*
 * Zurück und vor wie im Browser — die App vom Startbildschirm hat keine
 * Browserknöpfe (Wunsch des Nutzers, 25.11.2026). Wo sie stehen, ist
 * einstellbar (Einstellungen → Aussehen): klein unten mittig über der
 * Leiste, unter dem Logo, oder gar nicht. Neben dem Logo quetschten sie es.
 */
export function VerlaufKnoepfe({ art, skala = 1 }) {
  /* Die Größe stellt der Nutzer selbst ein (Einstellungen → Aussehen).
     Symbol, Tippfläche und bei „unten“ die Wölbung wachsen gemeinsam. */
  const s = Math.min(1.8, Math.max(0.7, Number(skala) || 1));
  const knoepfe = (
    <div className={"verlauf-knoepfe " + art} style={{ "--pfeil-skala": s }}>
      {/* Zurück nur bis zur Startseite (Wunsch des Nutzers, 26.11.2026):
          Dort ist Schluss, auch wenn der Verlauf davor noch etwas kennt. */}
      <SymbolKnopf symbol="zurueck" titel="Zurück" art="leer klein" groesse={Math.round(16 * s)}
        disabled={!(window.history.state?.slTiefe > 0) || (window.location.hash.slice(1) || START) === START}
        onClick={() => window.history.back()} />
      <SymbolKnopf symbol="weiter" titel="Vor" art="leer klein" groesse={Math.round(16 * s)}
        disabled={!naechsterWeg()}
        onClick={() => window.history.forward()} />
    </div>
  );
  if (art !== "unten") return knoepfe;
  /* Unten: Die Leiste hebt sich über „Abrufen“ zu einem flachen Buckel —
     unten ein weicher Übergang in die Kante, steile Seiten, oben breit und
     gerade (nach einer Skizze des Nutzers, 25.11.2026). Darin die Pfeile. */
  return (
    <div className="fuss-welle" style={{ "--pfeil-skala": s }}>
      <svg className="fuss-welle-form" viewBox="0 0 140 30" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 30 C 8 30, 13 28, 15 22 L 18 9 C 20 3, 25 1, 32 1 L 108 1 C 115 1, 120 3, 122 9 L 125 22 C 127 28, 132 30, 140 30 Z" fill="var(--grund)" />
        <path d="M0 30 C 8 30, 13 28, 15 22 L 18 9 C 20 3, 25 1, 32 1 L 108 1 C 115 1, 120 3, 122 9 L 125 22 C 127 28, 132 30, 140 30" fill="none"
          stroke="var(--rand)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </svg>
      {knoepfe}
    </div>
  );
}

/** Die Logo-Leiste am Handy. `imModus`: über einem Vollbild-Modus (nicht selbst klebend). */
export default function MenueStreifen({ imModus = false }) {
  const { einstellungen } = useDaten();
  const pfeile = einstellungen.verlaufPfeile || "unten";
  return (
    <div className={"menue-streifen nur-schmal" + (imModus ? " im-modus" : "")}>
      <div className="logo-spalte">
        <button type="button" className="logo-knopf" title="Zur Startseite" onClick={() => gehe(START)}>
          <img src="./logo-96.png" className="logo-bild klein" alt="" />
          <span>Anchor</span>
        </button>
        {pfeile === "logo" && <VerlaufKnoepfe art="unter-logo" skala={einstellungen.verlaufPfeileGroesse} />}
      </div>
      <span className="dehnen" />
      <Glocke />
    </div>
  );
}
