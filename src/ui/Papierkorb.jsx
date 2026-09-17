/*
 * Papierkorb: Gelöschtes bleibt sechzig Tage liegen und lässt sich zurückholen.
 * Danach räumt der Speicher es beim Start von selbst weg.
 */

import React, { useEffect, useState } from "react";
import { useDaten } from "../core/store.jsx";
import { datumKurz, anzahl } from "../core/util.js";
import { Symbol, Knopf, Leer } from "./basis.jsx";

export default function Papierkorb() {
  const { papierkorbLesen, wiederherstellen, stapel } = useDaten();
  const [inhalt, setInhalt] = useState(null);

  const laden = () => papierkorbLesen().then(setInhalt);
  useEffect(() => { laden(); }, []);

  const zurueckholen = async (art, id) => {
    await wiederherstellen(art, id);
    laden();
  };

  if (!inhalt) return <div className="mitte"><div className="matt">Wird gelesen …</div></div>;

  const leer = !inhalt.ordner.length && !inhalt.stapel.length && !inhalt.karten.length;

  const zeile = (art, name, zusatz, rec) => (
    <div key={art + rec.id} className="karten-zeile" style={{ padding: "10px 14px" }}>
      <div className="seite reihe" style={{ gap: 8 }}>
        <Symbol name={art === "ordner" ? "ordner" : art === "stapel" ? "stapel" : "papier"} groesse={16} />
        <span>{name || "Ohne Titel"}</span>
      </div>
      <div className="seite klein matt">{zusatz}</div>
      <div className="werkzeuge">
        <span className="klein blass">{datumKurz(rec.updatedAt)}</span>
        <Knopf art="klein" symbol="zurueckSetzen" onClick={() => zurueckholen(art, rec.id)}>
          Zurückholen
        </Knopf>
      </div>
    </div>
  );

  return (
    <div className="mitte">
      <div className="kopfzeile">
        <h1 style={{ flex: 1 }}>Papierkorb</h1>
      </div>

      {leer ? (
        <Leer symbol="papierkorb" titel="Nichts gelöscht"
          text="Was du löschst, landet hier und lässt sich sechzig Tage lang zurückholen." />
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {inhalt.ordner.map((o) => zeile("ordner", o.name, "Ordner", o))}
          {inhalt.stapel.map((s) => zeile("stapel", s.title, "Stapel", s))}
          {inhalt.karten
            .filter((k) => !inhalt.stapel.some((s) => s.id === k.setId))
            .slice(0, 200)
            .map((k) => zeile("karte", k.term,
              "Karte aus „" + (stapel.find((s) => s.id === k.setId)?.title || "gelöschtem Stapel") + "“", k))}
        </div>
      )}

      {!leer && (
        <p className="klein blass" style={{ marginTop: 18 }}>
          {anzahl(inhalt.karten.length, "gelöschte Karte", "gelöschte Karten")} insgesamt.
          Karten aus gelöschten Stapeln kommen mit dem Stapel zurück.
        </p>
      )}
    </div>
  );
}
