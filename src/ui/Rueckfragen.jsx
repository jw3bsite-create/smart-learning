/*
 * Rückfragen, Eingaben und Hinweise im Stil der App.
 *
 * Bisher kamen sie vom Browser: `window.confirm`, `window.prompt`,
 * `window.alert`. Die sehen in jedem Browser anders aus, auf dem iPhone als
 * Systemfenster mit der Adresse der Seite darüber, und in der installierten
 * App verschluckt manche Umgebung sie ganz. Hier dieselben drei als Dialoge
 * der App — aufgerufen wie zuvor, nur mit `await`:
 *
 *   if (!(await bestaetigen({ titel: "Löschen?", text: "…" }))) return;
 *   const name = await erfragen({ titel: "Neuer Ordner" });   // null = abgebrochen
 *   await hinweisen({ titel: "Abgleich misslungen", text: fehler.message });
 *
 * Mehrere Anfragen zugleich warten in einer Schlange; gezeigt wird immer die
 * erste. `RueckfragenWurzel` steht einmal in der App und zeichnet sie.
 */

import React, { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Dialog, Knopf } from "./basis.jsx";

let schlange = [];
let zaehler = 0;
const hoerer = new Set();

function melden() { for (const f of hoerer) f(); }
function anstellen(anfrage) {
  return new Promise((erledigt) => {
    schlange = [...schlange, { ...anfrage, nummer: ++zaehler, erledigt }];
    melden();
  });
}
function beantworten(wert) {
  const [erste, ...rest] = schlange;
  if (!erste) return;
  schlange = rest;
  melden();
  erste.erledigt(wert);
}

/** Ja oder nein. Zurück kommt `true` oder `false`. */
export function bestaetigen({ titel, text, ja = "Fortfahren", nein = "Abbrechen", gefahr = false }) {
  return anstellen({ art: "frage", titel, text, ja, nein, gefahr });
}

/** Ein kurzer Text. Zurück kommt er (getrimmt) oder `null` bei Abbruch. */
export function erfragen({ titel, text, vorgabe = "", platzhalter = "", ja = "Übernehmen",
  leerErlaubt = false }) {
  return anstellen({ art: "eingabe", titel, text, vorgabe, platzhalter, ja, leerErlaubt });
}

/** Nur zur Kenntnis. Zurück kommt nichts, sobald er weggeklickt ist. */
export function hinweisen({ titel, text, ja = "Verstanden" }) {
  return anstellen({ art: "hinweis", titel, text, ja });
}

function lesen() { return schlange[0] || null; }
function abonnieren(f) { hoerer.add(f); return () => hoerer.delete(f); }

export default function RueckfragenWurzel() {
  const anfrage = useSyncExternalStore(abonnieren, lesen, lesen);
  if (!anfrage) return null;
  // Der Schlüssel sorgt dafür, dass jede Anfrage mit frischem Feld beginnt.
  return <Anfrage key={anfrage.nummer} anfrage={anfrage} />;
}

function Anfrage({ anfrage }) {
  const { art, titel, text, ja, nein, gefahr } = anfrage;
  const [wert, setWert] = useState(anfrage.vorgabe || "");
  const feld = useRef(null);

  useEffect(() => {
    if (art !== "eingabe" || !feld.current) return;
    feld.current.focus();
    feld.current.select();
  }, [art]);

  const abbrechen = () => beantworten(art === "frage" ? false : art === "eingabe" ? null : undefined);
  const zulaessig = art !== "eingabe" || anfrage.leerErlaubt || wert.trim() !== "";
  const annehmen = () => {
    if (!zulaessig) return;
    beantworten(art === "frage" ? true : art === "eingabe" ? wert.trim() : undefined);
  };

  return (
    <Dialog titel={titel} aufSchliessen={abbrechen} klasse="rueckfrage"
      fuss={<>
        {art !== "hinweis" && <Knopf onClick={abbrechen}>{nein || "Abbrechen"}</Knopf>}
        <Knopf art={gefahr ? "voll gefahr-voll" : "voll"} disabled={!zulaessig} onClick={annehmen}>
          {ja}
        </Knopf>
      </>}>
      {text && <p className="matt" style={{ marginTop: 0 }}>{text}</p>}
      {art === "eingabe" && (
        <form onSubmit={(e) => { e.preventDefault(); annehmen(); }}>
          <input ref={feld} className="feld" value={wert} placeholder={anfrage.platzhalter}
            aria-label={titel} enterKeyHint="done"
            onChange={(e) => setWert(e.target.value)} />
        </form>
      )}
    </Dialog>
  );
}
