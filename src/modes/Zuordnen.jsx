/*
 * Zuordnen: Paare finden, auf Zeit.
 *
 * Sechs Paare liegen gemischt auf dem Tisch. Ein Fehlgriff kostet eine
 * Sekunde. Die beste Zeit je Stapel bleibt im Browser stehen.
 */

import React, { useEffect, useRef, useState } from "react";
import { mische, ziehe, zeitLang } from "../core/util.js";
import { gehe } from "../App.jsx";
import { Knopf, Symbol, Bild, Leer, useMerker } from "../ui/basis.jsx";
import { useModus, useBrauchbar, ModusRahmen } from "./gemeinsam.jsx";

const PAARE = 6;

export default function Zuordnen({ setId, aufSchliessen }) {
  const { derStapel, karten, sitzungMerken, antwortVerbuchen } = useModus(setId);
  const [nurMarkierte, setNurMarkierte] = useState(false);
  const [plaettchen, setPlaettchen] = useState(null);
  const [gewaehlt, setGewaehlt] = useState(null);
  const [daneben, setDaneben] = useState(null);
  const [erledigt, setErledigt] = useState([]);
  const [start, setStart] = useState(0);
  const [strafe, setStrafe] = useState(0);
  const [jetzt, setJetzt] = useState(0);
  const [zeit, setZeit] = useState(null);
  const [bestzeit, setBestzeit] = useMerker("bestzeit:" + setId, null);
  const uhr = useRef(null);

  const brauchbare = useBrauchbar(karten, nurMarkierte);

  useEffect(() => {
    if (!start || zeit !== null) return;
    uhr.current = setInterval(() => setJetzt(Date.now()), 100);
    return () => clearInterval(uhr.current);
  }, [start, zeit]);

  const beginnen = () => {
    const gewaehlteKarten = ziehe(brauchbare, PAARE);
    const stuecke = [];
    for (const k of gewaehlteKarten) {
      stuecke.push({ id: k.id + ":a", paar: k.id, text: k.term, bild: k.termImage, karte: k });
      stuecke.push({ id: k.id + ":b", paar: k.id, text: k.definition, bild: k.defImage, karte: k });
    }
    setPlaettchen(mische(stuecke));
    setErledigt([]); setGewaehlt(null); setDaneben(null);
    setStrafe(0); setZeit(null); setStart(Date.now()); setJetzt(Date.now());
  };

  const anklicken = (stueck) => {
    if (zeit !== null || erledigt.includes(stueck.paar)) return;
    if (!gewaehlt) { setGewaehlt(stueck); return; }
    if (gewaehlt.id === stueck.id) { setGewaehlt(null); return; }

    if (gewaehlt.paar === stueck.paar) {
      const neueErledigt = [...erledigt, stueck.paar];
      setErledigt(neueErledigt);
      setGewaehlt(null);
      antwortVerbuchen(stueck.karte, "td", 2);
      if (neueErledigt.length * 2 >= plaettchen.length) {
        const gebraucht = Date.now() - start + strafe;
        setZeit(gebraucht);
        clearInterval(uhr.current);
        if (bestzeit === null || gebraucht < bestzeit) setBestzeit(gebraucht);
        sitzungMerken({ setId, modus: "zuordnen", gesamt: PAARE, richtig: PAARE, dauer: gebraucht });
      }
    } else {
      setDaneben([gewaehlt.id, stueck.id]);
      setStrafe((s) => s + 1000);
      setTimeout(() => { setDaneben(null); setGewaehlt(null); }, 320);
    }
  };

  if (brauchbare.length < 4) {
    return (
      <ModusRahmen titel="Zuordnen" symbol="raster" aufSchliessen={aufSchliessen}>
        <Leer titel="Zu wenige Karten" text="Für dieses Spiel braucht es mindestens vier Karten.">
          <Knopf onClick={() => gehe("/stapel/" + setId + "/bearbeiten")}>Karten anlegen</Knopf>
        </Leer>
      </ModusRahmen>
    );
  }

  if (!plaettchen) {
    return (
      <ModusRahmen titel="Zuordnen" symbol="raster" aufSchliessen={aufSchliessen}>
        <h1>{derStapel.title}</h1>
        <p className="matt">
          Sechs Paare, gemischt. Tippe zusammengehörende Plättchen an — jeder
          Fehlgriff kostet eine Sekunde.
        </p>
        {bestzeit !== null && (
          <p className="marke gruen" style={{ marginTop: 4 }}>
            <Symbol name="uhr" groesse={14} /> Bestzeit {zeitLang(bestzeit)}
          </p>
        )}
        <label className="schalter" style={{ marginTop: 14 }}>
          <input type="checkbox" checked={nurMarkierte}
            onChange={(e) => setNurMarkierte(e.target.checked)} />
          <span>Nur markierte Karten</span>
        </label>
        <Knopf art="voll gross" symbol="raster" style={{ marginTop: 20 }} onClick={beginnen}>
          Los
        </Knopf>
      </ModusRahmen>
    );
  }

  const laufend = zeit !== null ? zeit : (jetzt - start + strafe);

  return (
    <ModusRahmen titel="Zuordnen" symbol="raster" aufSchliessen={aufSchliessen}
      rechts={<>
        {strafe > 0 && <span className="marke rot">+{Math.round(strafe / 1000)} s</span>}
        <span className="mono" style={{ fontSize: 17 }}>{zeitLang(laufend)}</span>
      </>}>

      {zeit !== null ? (
        <div style={{ textAlign: "center", paddingTop: 24 }}>
          <Symbol name="uhr" groesse={38} />
          <h1 style={{ marginTop: 10 }}>{zeitLang(zeit)}</h1>
          <p className="matt">
            {bestzeit !== null && zeit <= bestzeit ? "Neue Bestzeit!" : `Bestzeit: ${zeitLang(bestzeit)}`}
            {strafe > 0 && ` · ${Math.round(strafe / 1000)} Sekunden Strafe`}
          </p>
          <div className="reihe" style={{ justifyContent: "center", marginTop: 20, flexWrap: "wrap" }}>
            <Knopf art="voll gross" symbol="zurueckSetzen" onClick={beginnen}>Noch einmal</Knopf>
            <Knopf art="gross" onClick={() => gehe("/stapel/" + setId)}>Zum Stapel</Knopf>
          </div>
        </div>
      ) : (
        <div className="zuordnen-gitter">
          {plaettchen.map((p) => {
            let klasse = "plaettchen";
            if (erledigt.includes(p.paar)) klasse += " weg";
            else if (daneben?.includes(p.id)) klasse += " daneben";
            else if (gewaehlt?.id === p.id) klasse += " gewaehlt";
            return (
              <div key={p.id} className={klasse} onClick={() => anklicken(p)}>
                <div>
                  {p.bild && <Bild kennung={p.bild} klasse="" stil={{ maxHeight: 64, borderRadius: 6 }} />}
                  <div>{p.text}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </ModusRahmen>
  );
}
