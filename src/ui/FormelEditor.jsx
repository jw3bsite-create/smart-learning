/*
 * Der Formel-Editor.
 *
 * Getrennte Felder für Zähler und Nenner waren unhandlich: π in einen Bruch
 * zu setzen hieß, erst im einen Formular den Bruch zu bauen und dann im
 * anderen das Zeichen hineinzubekommen. Hier sieht man die Formel beim
 * Tippen so, wie sie auf der Karte erscheinen wird, tippt mit dem Finger in
 * Zähler oder Nenner und setzt jedes Zeichen genau dorthin.
 *
 * Unter der Haube arbeitet MathLive. Es wird erst geladen, wenn der Editor
 * aufgeht — der Rest der App bleibt so schlank wie vorher.
 *
 * Tastatur: `/` macht einen Bruch, `^` eine Hochzahl, `_` eine Tiefzahl,
 * `pi` wird zu π. Mit den Pfeiltasten wandert man zwischen den Feldern.
 * Auf Telefon und iPad erscheint eine eigene Mathematik-Tastatur.
 */

import React, { useEffect, useRef, useState } from "react";
import { editorZuKatex } from "../core/formel.js";
import { FORMEL_BAUSTEINE, FORMEL_ZEICHEN } from "../core/zeichen.js";
import { Dialog, Knopf, useMerker } from "./basis.jsx";
import Formel from "./Formel.jsx";

let geladen = null;

/* MathLive nur einmal laden und einstellen. Die Schriften bringt die
   Formelanzeige schon mit (KaTeX); MathLive erkennt sie und lädt nichts
   nach — so geht der Editor auch ohne Netz. Töne gibt es keine. */
function laden() {
  if (!geladen) {
    geladen = import("mathlive").then((m) => {
      m.MathfieldElement.fontsDirectory = null;
      m.MathfieldElement.soundsDirectory = null;
      return m;
    });
  }
  return geladen;
}

export default function FormelEditor({ anfang = "", titel = "Formel", aufFertig, aufAbbrechen, aufEntfernen }) {
  const halter = useRef(null);
  const feld = useRef(null);
  const [bereit, setBereit] = useState(false);
  const [fehler, setFehler] = useState("");
  const [leer, setLeer] = useState(!anfang);
  const [gruppe, setGruppe] = useMerker("formelGruppe", FORMEL_ZEICHEN[0].gruppe);

  useEffect(() => {
    let aus = false;
    laden().then((m) => {
      if (aus || !halter.current) return;
      const mf = new m.MathfieldElement();
      mf.value = anfang;
      mf.mathVirtualKeyboardPolicy = "auto";
      mf.className = "formel-feld";
      mf.addEventListener("input", () => setLeer(!mf.getValue("latex").trim()));
      halter.current.appendChild(mf);
      feld.current = mf;
      setBereit(true);
      setTimeout(() => mf.focus(), 50);
    }).catch((e) => setFehler("Der Formel-Editor ließ sich nicht laden: " + (e?.message || e)));
    return () => {
      aus = true;
      try { window.mathVirtualKeyboard?.hide(); } catch (e) { /* egal */ }
      feld.current?.remove();
      feld.current = null;
    };
  }, []);

  /* Knöpfe dürfen dem Formelfeld den Fokus nicht nehmen, sonst wüsste es
     nicht mehr, wo die Schreibmarke stand. */
  const halten = (e) => e.preventDefault();

  const setzen = (latex) => {
    const mf = feld.current;
    if (!mf) return;
    mf.insert(latex, { selectionMode: "placeholder", focus: true, format: "latex" });
    setLeer(!mf.getValue("latex").trim());
  };

  const fertig = () => {
    const mf = feld.current;
    if (!mf) return;
    aufFertig(editorZuKatex(mf.getValue("latex-expanded")));
  };

  return (
    <Dialog titel={titel} oben weit aufSchliessen={aufAbbrechen}
      fuss={<>
        {aufEntfernen && (
          <Knopf art="leer gefahr" onClick={aufEntfernen}>Formel entfernen</Knopf>
        )}
        <div className="dehnen" />
        <Knopf onClick={aufAbbrechen}>Abbrechen</Knopf>
        <Knopf art="voll" disabled={!bereit || leer} onClick={fertig}>
          {anfang ? "Übernehmen" : "Einfügen"}
        </Knopf>
      </>}>
      <div ref={halter} className="formel-halter">
        {!bereit && !fehler && <div className="klein blass">Der Editor wird geladen …</div>}
      </div>
      {fehler && <div className="rueckmeldung schlecht klein">{fehler}</div>}

      <p className="klein blass" style={{ margin: "8px 0 12px" }}>
        Tippen geht auch: <strong>/</strong> macht einen Bruch, <strong>^</strong> eine
        Hochzahl, <strong>pi</strong> wird zu π. Mit den Pfeiltasten wechselst du
        zwischen Zähler und Nenner.
      </p>

      <div className="formel-bausteine" onMouseDown={halten} onPointerDown={halten}>
        {FORMEL_BAUSTEINE.map(([name, latex, bild]) => (
          <button key={name} type="button" className="formel-baustein" title={name}
            onClick={() => setzen(latex)}>
            <span className="formel-baustein-bild"><Formel text={"$" + bild + "$"} /></span>
            <span className="formel-baustein-name">{name}</span>
          </button>
        ))}
      </div>

      <div className="zeichenleiste-reiter formel-reiter" role="tablist"
        onMouseDown={halten} onPointerDown={halten}>
        {FORMEL_ZEICHEN.map((g) => (
          <button key={g.gruppe} type="button" role="tab" aria-selected={g.gruppe === gruppe}
            className={"knopf klein" + (g.gruppe === gruppe ? " voll" : "")}
            onClick={() => setGruppe(g.gruppe)}>
            {g.gruppe}
          </button>
        ))}
      </div>
      <div className="zeichenleiste-knoepfe formel-zeichen" onMouseDown={halten} onPointerDown={halten}>
        {(FORMEL_ZEICHEN.find((g) => g.gruppe === gruppe) || FORMEL_ZEICHEN[0]).zeichen
          .map(([zeichen, latex]) => (
            <button key={zeichen} type="button" className="zeichen-knopf" title={zeichen}
              onClick={() => setzen(latex)}>
              {zeichen}
            </button>
          ))}
      </div>
    </Dialog>
  );
}
