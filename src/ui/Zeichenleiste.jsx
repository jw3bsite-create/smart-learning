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
import { bruch, hoch, tief } from "../core/formel.js";
import { Knopf, SymbolKnopf, useMerker } from "./basis.jsx";
import Formel from "./Formel.jsx";

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

/*
 * Bruch, Hoch- und Tiefzahl: ein kleines Formular in der Leiste.
 *
 * Man tippt Zähler und Nenner (oder die Hochzahl) in eigene Felder und sieht
 * sofort, was daraus wird. Die Formelschreibweise selbst muss niemand kennen.
 */
function Bauform({ art, aufEinfuegen, aufAbbrechen }) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const erstes = useRef(null);
  useEffect(() => { erstes.current?.focus(); }, [art]);

  const ergebnis = art === "bruch"
    ? (a.trim() || b.trim() ? bruch(a, b) : "")
    : (art === "hoch" ? hoch(a) : tief(a)).text;
  const fehlt = art === "bruch" ? [] : (art === "hoch" ? hoch(a) : tief(a)).fehlt;

  const einfuegen = (e) => {
    e?.preventDefault();
    if (ergebnis) aufEinfuegen(ergebnis);
  };

  return (
    <form className="bauform" onSubmit={einfuegen}>
      {art === "bruch" ? (
        <div className="bauform-bruch">
          <input ref={erstes} className="feld" value={a} placeholder="Zähler, etwa x+1"
            onChange={(e) => setA(e.target.value)} />
          <div className="bauform-strich" />
          <input className="feld" value={b} placeholder="Nenner, etwa 2"
            onChange={(e) => setB(e.target.value)} />
        </div>
      ) : (
        <input ref={erstes} className="feld" value={a}
          placeholder={art === "hoch" ? "Hochzahl, etwa 12 oder -3 oder n+1" : "Index, etwa 1 oder n"}
          onChange={(e) => setA(e.target.value)} />
      )}
      <div className="reihe umbruch" style={{ gap: 8, marginTop: 8 }}>
        <span className="klein matt">Wird zu:</span>
        <span className="bauform-vorschau">{ergebnis ? <Formel text={ergebnis} /> : "…"}</span>
        <div className="dehnen" />
        <Knopf art="klein" type="button" onClick={aufAbbrechen}>Abbrechen</Knopf>
        <Knopf art="klein voll" type="submit" disabled={!ergebnis}>Einfügen</Knopf>
      </div>
      {fehlt.length > 0 && (
        <div className="klein blass" style={{ marginTop: 6 }}>
          {fehlt.join(" ")} gibt es nicht
          {art === "hoch" ? " hochgestellt" : " tiefgestellt"}, das bleibt normal stehen.
        </div>
      )}
    </form>
  );
}

export default function Zeichenleiste({ aufSchliessen }) {
  const letztes = useRef(null);
  const wurzel = useRef(null);
  const [bau, setBau] = useState(null);          // "bruch" | "hoch" | "tief" | null
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
    if (!e.target.closest?.("input, textarea, select, .bauform")) e.preventDefault();
  };

  const setzen = (zeichen) => {
    const aktiv = document.activeElement;
    const feld = IST_FELD(aktiv) && !wurzel.current?.contains(aktiv) ? aktiv : letztes.current;
    if (!feld || !document.contains(feld)) return;
    schreibeIn(feld, zeichen);
  };

  return (
    <div className="zeichenleiste" ref={wurzel} onMouseDown={halten} onPointerDown={halten}>
      <div className="reihe" style={{ marginBottom: 6 }}>
        <span className="klein matt dehnen">
          Tippe in ein Feld, dann auf ein Zeichen.
        </span>
        <SymbolKnopf symbol="kreuz" titel="Zeichen schließen" art="leer klein"
          onClick={aufSchliessen} />
      </div>
      <div className="reihe umbruch" style={{ gap: 6, marginBottom: 8 }}>
        {[["bruch", "Bruch", "a/b"], ["hoch", "Hochzahl", "xⁿ"], ["tief", "Tiefzahl", "xₙ"]].map(([k, name, bild]) => (
          <button key={k} type="button"
            className={"knopf klein" + (bau === k ? " voll" : "")}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              /* Das Formular nimmt gleich den Fokus. Vorher festhalten, in
                 welchem Kartenfeld die Schreibmarke stand. */
              const aktiv = document.activeElement;
              if (IST_FELD(aktiv) && !wurzel.current?.contains(aktiv)) letztes.current = aktiv;
              setBau(bau === k ? null : k);
            }}>
            <span className="bauform-bild">{bild}</span> {name}
          </button>
        ))}
      </div>
      {bau && (
        <Bauform key={bau} art={bau}
          aufAbbrechen={() => { setBau(null); letztes.current?.focus(); }}
          aufEinfuegen={(text) => { setzen(text); setBau(null); }} />
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
