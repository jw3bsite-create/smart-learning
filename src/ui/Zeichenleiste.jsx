/*
 * Die Zeichenleiste: mathematische Zeichen zum Antippen.
 *
 * Sie schreibt in das Feld, in dem zuletzt geschrieben wurde. Damit das
 * klappt, darf ein Druck auf die Leiste dem Feld den Fokus nicht nehmen —
 * sonst wüsste niemand mehr, wo die Schreibmarke stand, und auf dem Telefon
 * klappte bei jedem Zeichen die Tastatur zu und wieder auf.
 */

import React, { useEffect, useRef, useState } from "react";
import { ZEICHEN, anzeige, einfuegen } from "../core/zeichen.js";
import { SymbolKnopf, Tipp, useMerker } from "./basis.jsx";
import FormelEditor from "./FormelEditor.jsx";

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
  const wurzel = useRef(null);
  const [editor, setEditor] = useState(false);
  /* Auf dem Telefon steht immer nur eine Gruppe da; welche, merkt sich das Geraet. */
  const [gruppe, setGruppe] = useMerker("zeichenGruppe", ZEICHEN[0].gruppe);

  /* Merkt sich das zuletzt benutzte Schreibfeld — auch wenn es gerade den
     Fokus verloren hat, etwa weil man zur Leiste hochgescrollt ist. */
  useEffect(() => {
    const eigenes = (el) => wurzel.current && wurzel.current.contains(el);
    const merken = (e) => {
      if (IST_FELD(e.target) && !eigenes(e.target)) letztes.current = e.target;
    };
    if (IST_FELD(document.activeElement) && !eigenes(document.activeElement))
      letztes.current = document.activeElement;
    /* Auch beim Tippen merken, nicht nur beim Fokuswechsel: Wer schon im
       Feld stand, als die Leiste aufging, hat keinen Fokuswechsel ausgeloest. */
    document.addEventListener("focusin", merken);
    document.addEventListener("input", merken, true);
    return () => {
      document.removeEventListener("focusin", merken);
      document.removeEventListener("input", merken, true);
    };
  }, []);

  /* Fokus bleibt im Kartenfeld — ausser man tippt in die eigenen Felder
     der Leiste (Zaehler, Nenner, Hochzahl). */
  const halten = (e) => {
    /* Im Formel-Editor (einem Dialog ueber allem) nichts festhalten —
       sonst kaeme sein eigenes Formelfeld nie an den Fokus. */
    if (!e.target.closest?.("input, textarea, select, .schleier")) e.preventDefault();
  };

  const setzen = (zeichen) => {
    const aktiv = document.activeElement;
    const feld = IST_FELD(aktiv) && !wurzel.current?.contains(aktiv) ? aktiv : letztes.current;
    if (!feld || !document.contains(feld)) return;
    schreibeIn(feld, zeichen);
  };

  return (
    <div className="zeichenleiste" ref={wurzel} onMouseDown={halten} onPointerDown={halten}>
      <div className="reihe umbruch" style={{ marginBottom: 6 }}>
        <strong className="klein dehnen">Zeichen und Formeln</strong>
        <Tipp kennung="zeichenleiste">
          Tippe zuerst in das Feld der Karte, dann auf ein Zeichen. Es landet an
          der Schreibmarke. Brüche, Hochzahlen und Wurzeln baust du mit
          „Formel einfügen“.
        </Tipp>
        <SymbolKnopf symbol="kreuz" titel="Zeichen schließen" art="leer klein"
          onClick={aufSchliessen} />
      </div>
      {/* Die Formel als eigener, großer Knopf: Brüche, Hochzahlen, Wurzeln —
          alles, was nicht in eine Textzeile passt. Die Zeichen darunter
          bleiben für gewöhnlichen Text. */}
      <button type="button" className="knopf voll formel-oeffnen"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          const aktiv = document.activeElement;
          if (IST_FELD(aktiv) && !wurzel.current?.contains(aktiv)) letztes.current = aktiv;
          setEditor(true);
        }}>
        <span className="formel-oeffnen-bild">½ xⁿ √</span> Formel einfügen
        <span className="klein" style={{ opacity: 0.8 }}>Bruch, Hochzahl, Wurzel …</span>
      </button>
      {editor && (
        <FormelEditor
          aufAbbrechen={() => { setEditor(false); letztes.current?.focus(); }}
          aufFertig={(latex) => { setEditor(false); if (latex) setzen("$" + latex + "$"); }} />
      )}

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
