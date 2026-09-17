/*
 * Termine in den Kalender des Telefons.
 *
 * Eine Datei, kein Konto: Auf dem iPhone und auf dem Schul-iPad ist das der
 * einzige Weg, der ohne Rechte und ohne Server auskommt. Der Kalender weckt
 * dann auch, wenn Smart Learning geschlossen ist — was die App selbst nicht
 * kann, solange niemand die Nachricht verschickt.
 */

import React, { useState } from "react";
import { useDaten } from "../core/store.jsx";
import { termineDatei, dateiname } from "../core/kalender.js";
import { tageBisPruefung } from "../core/warteschlange.js";
import { anzahl, datumKurz } from "../core/util.js";
import { Dialog, Knopf, Symbol } from "./basis.jsx";

export default function Kalenderausfuhr({ aufSchliessen }) {
  const { faecher } = useDaten();
  const [mitErinnerung, setMitErinnerung] = useState(true);
  const [stunde, setStunde] = useState(18);
  const [meldung, setMeldung] = useState("");

  const mitTermin = faecher.filter((f) => !f.deleted && f.pruefungsdatum);

  const schreiben = () => {
    const text = termineDatei(faecher, {
      erinnerung: mitErinnerung ? { stunde, minute: 0 } : null,
    });
    if (!text) {
      setMeldung("Es gibt noch keinen Prüfungstermin und keine Erinnerung zum Ausgeben.");
      return;
    }
    const blob = new Blob([text], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = dateiname();
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    setMeldung("Datei geschrieben. Öffne sie auf dem Gerät und tippe auf Hinzufügen.");
  };

  return (
    <Dialog titel="Termine in den Kalender" aufSchliessen={aufSchliessen}
      fuss={<>
        <Knopf onClick={aufSchliessen}>Schließen</Knopf>
        <Knopf art="voll" symbol="herunter" onClick={schreiben}>Datei schreiben</Knopf>
      </>}>
      <p className="klein matt" style={{ marginTop: 0 }}>
        Geschrieben wird eine gewöhnliche Kalenderdatei (.ics). Auf dem iPhone
        oder iPad öffnest du sie und tippst auf Hinzufügen, am Rechner nimmt sie
        Outlook oder der Google Kalender.
      </p>

      <div style={{ display: "grid", gap: 6, marginBottom: 14 }}>
        {mitTermin.length === 0 ? (
          <div className="klein blass">
            Noch kein Prüfungstermin eingetragen. Das geht bei jedem Fach unter
            Einstellungen des Fachs.
          </div>
        ) : mitTermin
          .slice()
          .sort((a, b) => a.pruefungsdatum - b.pruefungsdatum)
          .map((f) => (
            <div key={f.id} className="reihe klein" style={{ gap: 8 }}>
              <Symbol name="papier" groesse={15} />
              <span className="dehnen">{f.name}</span>
              <span className="matt">{datumKurz(f.pruefungsdatum)}</span>
              <span className="blass">
                {(() => { const t = tageBisPruefung(f); return t === null ? "" : t + " Tage"; })()}
              </span>
            </div>
          ))}
      </div>
      <p className="klein blass" style={{ marginTop: 0 }}>
        Jeder Termin bringt zwei Weckrufe mit: eine Woche und einen Tag vorher.
      </p>

      <label className="schalter">
        <input type="checkbox" checked={mitErinnerung}
          onChange={(e) => setMitErinnerung(e.target.checked)} />
        <span>Tägliche Lernerinnerung mitgeben
          <span className="klein blass">(weckt auch bei geschlossener App)</span>
        </span>
      </label>
      {mitErinnerung && (
        <label className="reihe klein matt" style={{ gap: 8, marginTop: 8 }}>
          Täglich um
          <input className="feld" type="number" min="0" max="23" style={{ width: 90 }}
            value={stunde} onChange={(e) => setStunde(Number(e.target.value))} />
          Uhr
        </label>
      )}

      <p className="klein blass">
        {anzahl(mitTermin.length, "Prüfungstermin", "Prüfungstermine")}
        {mitErinnerung ? " und die tägliche Erinnerung" : ""} kommen in die Datei.
        Liest du sie später erneut ein, werden dieselben Termine aktualisiert,
        statt sich zu verdoppeln.
      </p>

      {meldung && <div className="rueckmeldung gut klein">{meldung}</div>}
    </Dialog>
  );
}
