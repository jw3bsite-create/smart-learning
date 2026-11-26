/*
 * Fragen zur App — alle Erklärungen an einem Ort (core/hilfe.js).
 *
 * Erreichbar über das kleine „?“ an der jeweiligen Stelle (`#/hilfe/<frage>`
 * öffnet und zeigt die passende Frage) und über die Einstellungen.
 */

import { ZurueckKnopf } from "./basis.jsx";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { FRAGEN, GRUPPEN } from "../core/hilfe.js";
import { zurueck } from "../App.jsx";

const klein = (t) => String(t || "").toLowerCase();

export default function Hilfe({ frage = null }) {
  const [suche, setSuche] = useState("");
  const ziel = useRef(null);

  useEffect(() => {
    if (!frage) return;
    requestAnimationFrame(() => ziel.current?.scrollIntoView?.({ block: "start", behavior: "smooth" }));
  }, [frage]);

  const treffer = useMemo(() => {
    const s = klein(suche).trim();
    if (!s) return FRAGEN;
    return FRAGEN.filter((f) => klein(f.frage).includes(s) || f.antwort.some((a) => klein(a).includes(s)));
  }, [suche]);

  return (
    <div className="mitte" style={{ maxWidth: 720 }}>
      <div className="kopfzeile">
        <ZurueckKnopf onClick={() => zurueck("/einstellungen")} />
        <h1 className="dehnen">Fragen zur App</h1>
      </div>

      <input className="feld unten-24" type="search" placeholder="Suchen, z. B. umordnen"
        value={suche} onChange={(e) => setSuche(e.target.value)} aria-label="In den Fragen suchen" />

      {GRUPPEN.map((g) => {
        const eigene = treffer.filter((f) => f.gruppe === g.id);
        if (!eigene.length) return null;
        return (
          <section key={g.id} className="hilfe-gruppe">
            <h3 className="unten-8">{g.name}</h3>
            {eigene.map((f) => (
              <details key={f.id} id={"hilfe-" + f.id} className="hilfe-frage"
                open={f.id === frage || (suche.trim() !== "" && treffer.length <= 3) || undefined}
                ref={f.id === frage ? ziel : undefined}>
                <summary>{f.frage}</summary>
                <div className="hilfe-antwort">
                  {f.antwort.map((a, i) => <p key={i}>{a}</p>)}
                </div>
              </details>
            ))}
          </section>
        );
      })}
      {!treffer.length && <p className="matt">Dazu gibt es noch keine Frage.</p>}
    </div>
  );
}
