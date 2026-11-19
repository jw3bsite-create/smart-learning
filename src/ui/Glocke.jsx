/*
 * Die Glocke: wenige Mitteilungen, die etwas zu tun geben
 * (core/mitteilungen.js). Am Telefon oben rechts im Kopfstreifen, am
 * Rechner oben in der Seitenleiste.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useDaten } from "../core/store.jsx";
import { mitteilungenBilden, verworfenAufraeumen, RUHE } from "../core/mitteilungen.js";
import { gehe } from "../App.jsx";
import { Symbol, Knopf } from "./basis.jsx";

const SINNBILD = { pruefung: "papier", ruht: "uhr", lange: "blitz" };

export default function Glocke({ seite = "rechts" }) {
  const {
    stapel, faecher, karten, zustaende, reviews, stapelVon, einstellungen, setzeEinstellung, stapelAendern,
  } = useDaten();
  const [offen, setOffen] = useState(false);
  const huelle = useRef(null);
  const verworfen = einstellungen.mitteilungenVerworfen || {};

  /* Einmal je Viertelstunde neu rechnen genügt — und nach jeder Änderung. */
  const [takt, setTakt] = useState(0);
  useEffect(() => { const t = setInterval(() => setTakt((x) => x + 1), 15 * 60000); return () => clearInterval(t); }, []);
  const liste = useMemo(() => mitteilungenBilden({
    stapel, faecher, karten, zustaende, reviews, stapelVon, verworfen,
  }), [stapel, faecher, karten, zustaende, reviews, stapelVon, verworfen, takt]);

  /* Ein Tipp daneben schließt. */
  useEffect(() => {
    if (!offen) return undefined;
    const daneben = (e) => { if (!huelle.current?.contains(e.target)) setOffen(false); };
    document.addEventListener("pointerdown", daneben);
    return () => document.removeEventListener("pointerdown", daneben);
  }, [offen]);

  const ausblenden = (m) => setzeEinstellung("mitteilungenVerworfen",
    verworfenAufraeumen({ ...verworfen, [m.id]: Date.now() + RUHE[m.art] }));

  return (
    <div className="glocke" ref={huelle}>
      <button type="button" className={"glocke-knopf" + (liste.length ? " hat" : "")}
        aria-expanded={offen} title="Mitteilungen"
        aria-label={liste.length ? liste.length + " Mitteilungen" : "Mitteilungen"}
        onClick={() => setOffen((x) => !x)}>
        <Symbol name="glocke" groesse={21} />
        {liste.length > 0 && <span className="glocke-zahl">{liste.length}</span>}
      </button>
      {offen && (
        <div className={"glocke-tafel " + seite} role="dialog" aria-label="Mitteilungen">
          <div className="glocke-titel">Mitteilungen</div>
          {liste.length === 0 && <p className="klein blass oben-4 unten-0">Gerade nichts. Gut so.</p>}
          {liste.map((m) => (
            <div key={m.id} className={"glocke-eintrag " + m.art}>
              <span className="glocke-sinnbild"><Symbol name={SINNBILD[m.art]} groesse={16} /></span>
              <div className="dehnen">
                <div className="klein">{m.text}</div>
                <div className="reihe umbruch oben-8" style={{ gap: 6 }}>
                  {m.art === "ruht" && (
                    <Knopf art="klein voll" onClick={() => stapelAendern(m.stapelId, { ruht: null })}>
                      Zurückholen</Knopf>
                  )}
                  <Knopf art="klein" onClick={() => { setOffen(false); gehe(m.weg); }}>Ansehen</Knopf>
                  <Knopf art="klein leer" onClick={() => ausblenden(m)}>
                    {m.art === "ruht" ? "Später" : "Ausblenden"}</Knopf>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
