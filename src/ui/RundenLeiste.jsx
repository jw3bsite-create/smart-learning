/*
 * „Abrufen · 7 von 20 · Fortsetzen“ — über der Navigierleiste, solange eine
 * Runde offen ist (UX-Bericht, 27.11.2026; Vorbild: der Mini-Player von
 * Spotify und Apple Music). Zurück verlässt seitdem eine Ansicht, nicht
 * eine Sitzung: Die Runde wartet, bis man weitermacht, und gilt bis zum
 * Ende des Lerntags (4 Uhr).
 *
 * Das Kreuz beendet die Runde mit Rückfrage. Bewertetes bleibt verbucht —
 * nur Reihenfolge und Wiedervorlagen verfallen.
 */

import React, { useEffect } from "react";
import { rundeGilt, rundeStand } from "../core/runde.js";
import { useRunde, rundeLoeschen } from "./runde.js";
import { bestaetigen } from "./Rueckfragen.jsx";
import { gehe } from "../App.jsx";
import { Symbol, Sinnbild } from "./basis.jsx";

export default function RundenLeiste({ weg }) {
  const runde = useRunde();
  const sichtbar = weg[0] !== "abrufen" && rundeGilt(runde);

  /* Platz schaffen: Seiten und +-Knopf rücken über die Leiste. */
  useEffect(() => {
    document.documentElement.classList.toggle("mit-runde", sichtbar);
    return () => document.documentElement.classList.remove("mit-runde");
  }, [sichtbar]);

  if (!sichtbar) return null;
  const stand = rundeStand(runde);
  const beenden = async () => {
    const ja = await bestaetigen({
      titel: "Runde beenden?",
      text: "Was du bewertet hast, bleibt verbucht. Es verfallen nur die Reihenfolge dieser Runde und ihre Wiedervorlagen.",
      ja: "Beenden", nein: "Weiter offen lassen", gefahr: true,
    });
    if (ja) rundeLoeschen(runde.id);
  };

  return (
    <div className="runden-leiste" role="region" aria-label="Laufende Runde">
      <button type="button" className="runden-leiste-haupt" onClick={() => gehe(runde.weg)}>
        <Sinnbild name="blitz" ton="blau" />
        <span className="dehnen runden-leiste-mitte">
          <span className="runden-leiste-titel">
            Abrufen · {Math.min(stand.stelle + 1, stand.gesamt)} von {stand.gesamt}
          </span>
          <span className="runden-leiste-balken" aria-hidden="true">
            <span style={{ width: Math.round(stand.anteil * 100) + "%" }} />
          </span>
        </span>
        <strong className="runden-leiste-los">Fortsetzen</strong>
      </button>
      <button type="button" className="runden-leiste-zu" title="Runde beenden" aria-label="Runde beenden"
        onClick={beenden}>
        <Symbol name="kreuz" groesse={16} />
      </button>
    </div>
  );
}
