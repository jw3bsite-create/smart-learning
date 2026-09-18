/*
 * Die Zeichenleiste: mathematische Zeichen zum Antippen.
 *
 * Sie schreibt in das Feld, in dem zuletzt geschrieben wurde. Damit das
 * klappt, darf ein Druck auf die Leiste dem Feld den Fokus nicht nehmen —
 * sonst wüsste niemand mehr, wo die Schreibmarke stand, und auf dem Telefon
 * klappte bei jedem Zeichen die Tastatur zu und wieder auf.
 */

import React, { useEffect, useRef } from "react";
import { ZEICHEN, anzeige, einfuegen } from "../core/zeichen.js";
import { SymbolKnopf, useMerker } from "./basis.jsx";

const IST_FELD = (el) => el && (el.tagName === "TEXTAREA"
  || (el.tagName === "INPUT" && /^(text|search|)$/i.test(el.type || "")));

/*
 * Ein Feld, das React steuert, nimmt einen neuen Wert nur über ein
 * input-Ereignis an. Einfach `value` zu setzen, würde beim nächsten Zeichnen
 * wieder überschrieben — das Zeichen erschiene und verschwände sofort.
 */
function schreibeIn(feld, zeichen) {
  const { text, marke } = einfuegen(feld.value, feld.selectionStart, feld.selectionEnd, zeichen);
  const setzer = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(feld), "value").set;
  setzer.call(feld, text);
  feld.dispatchEvent(new Event("input", { bubbles: true }));
  feld.focus();
  try { feld.setSelectionRange(marke, marke); } catch (e) { /* nicht jedes Feld kann das */ }
}

export default function Zeichenleiste({ aufSchliessen }) {
  const letztes = useRef(null);
  /* Auf dem Telefon steht immer nur eine Gruppe da; welche, merkt sich das Geraet. */
  const [gruppe, setGruppe] = useMerker("zeichenGruppe", ZEICHEN[0].gruppe);

  /* Merkt sich das zuletzt benutzte Schreibfeld — auch wenn es gerade den
     Fokus verloren hat, etwa weil man zur Leiste hochgescrollt ist. */
  useEffect(() => {
    const merken = (e) => { if (IST_FELD(e.target)) letztes.current = e.target; };
    if (IST_FELD(document.activeElement)) letztes.current = document.activeElement;
    document.addEventListener("focusin", merken);
    return () => document.removeEventListener("focusin", merken);
  }, []);

  const halten = (e) => e.preventDefault();       // Fokus bleibt im Feld

  const setzen = (zeichen) => {
    const feld = IST_FELD(document.activeElement) ? document.activeElement : letztes.current;
    if (!feld || !document.contains(feld)) return;
    schreibeIn(feld, zeichen);
  };

  return (
    <div className="zeichenleiste" onMouseDown={halten} onPointerDown={halten}>
      <div className="reihe" style={{ marginBottom: 6 }}>
        <span className="klein matt dehnen">
          Tippe in ein Feld, dann auf ein Zeichen.
        </span>
        <SymbolKnopf symbol="kreuz" titel="Zeichen schließen" art="leer klein"
          onClick={aufSchliessen} />
      </div>
      {/* Reiter nur auf schmalen Schirmen, siehe stil.css. Mit offener
          Tastatur bliebe fuer alle fuenf Gruppen auf einmal kein Platz. */}
      <div className="zeichenleiste-reiter" role="tablist">
        {ZEICHEN.map((g) => (
          <button key={g.gruppe} type="button" role="tab"
            aria-selected={g.gruppe === gruppe}
            className={"knopf klein" + (g.gruppe === gruppe ? " voll" : "")}
            onMouseDown={halten} onPointerDown={halten}
            onClick={() => setGruppe(g.gruppe)}>
            {g.gruppe}
          </button>
        ))}
      </div>
      <div className="zeichenleiste-gruppen">
        {ZEICHEN.map((g) => (
          <div key={g.gruppe} className={g.gruppe === gruppe ? "aktiv" : ""}>
            <div className="zeichenleiste-titel">{g.gruppe}</div>
            <div className="zeichenleiste-knoepfe">
              {g.zeichen.map((z) => (
                <button key={g.gruppe + z} type="button" className="zeichen-knopf"
                  title={z === "⃗" ? "Vektorpfeil über dem Zeichen davor" : z}
                  onMouseDown={halten} onPointerDown={halten}
                  onClick={() => setzen(z)}>
                  {anzeige(z)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
