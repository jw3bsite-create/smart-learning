/*
 * Karteikarten: durchblättern und umdrehen.
 *
 * Dazu die Selbsteinschätzung „Weiß ich“ / „Noch üben“ — sie geht in denselben
 * Lernstand ein wie die übrigen Modi, sodass sich Fächer und Wiederholungen
 * auch beim bloßen Durchblättern füllen.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { mische, anzahl } from "../core/util.js";
import { sprich } from "../core/speech.js";
import { gehe } from "../App.jsx";
import { Knopf, SymbolKnopf, Symbol, Stern, Leer, useTastatur } from "../ui/basis.jsx";
import {
  useModus, useBrauchbar, ModusRahmen, Seite, Ergebnis, ModusLeiste, Wahl,
  RICHTUNGEN, seitenFuer, sprachenFuer,
} from "./gemeinsam.jsx";

export default function Karteikarten({ setId, aufSchliessen }) {
  const { derStapel, karten, karteAendern, antwortVerbuchen, einstellungen, sitzungMerken } = useModus(setId);
  const [richtung, setRichtung] = useState("td");
  const [nurMarkierte, setNurMarkierte] = useState(false);
  const [gemischt, setGemischt] = useState(false);
  const [stelle, setStelle] = useState(0);
  const [gedreht, setGedreht] = useState(false);
  const [selbstlauf, setSelbstlauf] = useState(false);
  const [urteile, setUrteile] = useState({});
  const [fertig, setFertig] = useState(false);
  const uhr = useRef(null);

  const brauchbare = useBrauchbar(karten, nurMarkierte);
  const reihe = useMemo(() => gemischt ? mische(brauchbare) : brauchbare,
    [brauchbare, gemischt]);
  const karte = reihe[stelle];

  const seiten = karte ? seitenFuer(karte, richtung === "beide" ? "td" : richtung) : null;
  const sprachen = sprachenFuer(derStapel, richtung === "beide" ? "td" : richtung);

  /* Vorlesen, sobald eine Seite erscheint. */
  useEffect(() => {
    if (!karte || !einstellungen.vorlesenAutomatisch) return;
    const text = gedreht ? seiten.antwort : seiten.frage;
    const sprache = gedreht ? sprachen.antwort : sprachen.frage;
    if (text) sprich(text, sprache, einstellungen.sprechTempo);
  }, [karte, gedreht]);

  /* Selbstlauf: umdrehen, weiterblättern. */
  useEffect(() => {
    clearTimeout(uhr.current);
    if (!selbstlauf || fertig || !karte) return;
    uhr.current = setTimeout(() => {
      if (!gedreht) setGedreht(true);
      else weiter();
    }, gedreht ? 2600 : 2200);
    return () => clearTimeout(uhr.current);
  }, [selbstlauf, gedreht, stelle, fertig, karte]);

  const weiter = () => {
    setGedreht(false);
    setStelle((s) => {
      if (s + 1 >= reihe.length) { setFertig(true); return s; }
      return s + 1;
    });
  };

  const zurueck = () => {
    setGedreht(false);
    setStelle((s) => Math.max(0, s - 1));
  };

  const urteilen = (kann) => {
    if (!karte) return;
    antwortVerbuchen(karte, richtung === "beide" ? "td" : richtung, kann ? 2 : 0);
    setUrteile((alt) => ({ ...alt, [karte.id]: kann }));
    weiter();
  };

  useTastatur({
    " ": () => setGedreht((g) => !g),
    ArrowRight: weiter,
    ArrowLeft: zurueck,
    ArrowUp: () => urteilen(true),
    ArrowDown: () => urteilen(false),
    s: () => karte && karteAendern(karte.id, { starred: !karte.starred }),
    a: () => karte && sprich(gedreht ? seiten.antwort : seiten.frage,
      gedreht ? sprachen.antwort : sprachen.frage, einstellungen.sprechTempo),
  }, Boolean(karte) && !fertig);

  useEffect(() => {
    if (!fertig) return;
    const werte = Object.values(urteile);
    if (!werte.length) return;
    sitzungMerken({ setId, modus: "karten", gesamt: werte.length,
      richtig: werte.filter(Boolean).length });
  }, [fertig]);

  if (!brauchbare.length) {
    return (
      <ModusRahmen titel="Karteikarten" symbol="stapel" aufSchliessen={aufSchliessen}>
        <Leer titel="Keine Karten zum Durchblättern"
          text={nurMarkierte ? "In diesem Stapel ist nichts markiert."
            : "Der Stapel braucht Karten mit Vorder- und Rückseite."}>
          <Knopf onClick={() => gehe("/stapel/" + setId + "/bearbeiten")}>Karten anlegen</Knopf>
        </Leer>
      </ModusRahmen>
    );
  }

  if (fertig) {
    const werte = Object.values(urteile);
    return (
      <ModusRahmen titel="Karteikarten" symbol="stapel" aufSchliessen={aufSchliessen}>
        <Ergebnis titel="Stapel durchgesehen" setId={setId}
          richtig={werte.filter(Boolean).length} gesamt={werte.length || reihe.length}
          aufNochmal={() => { setStelle(0); setGedreht(false); setUrteile({}); setFertig(false); }}
          aufWeiter={Object.values(urteile).some((x) => !x)
            ? <Knopf art="gross" symbol="blitz"
                onClick={() => gehe("/stapel/" + setId + "/lernen")}>Schwache üben</Knopf>
            : null} />
      </ModusRahmen>
    );
  }

  const anteil = reihe.length ? (stelle + 1) / reihe.length : 0;

  return (
    <ModusRahmen titel="Karteikarten" symbol="stapel" aufSchliessen={aufSchliessen} anteil={anteil}
      rechts={<>
        <SymbolKnopf symbol={selbstlauf ? "uhr" : "weiter"} art={selbstlauf ? "klein voll" : "leer klein"}
          titel={selbstlauf ? "Selbstlauf beenden" : "Von allein weiterblättern"}
          onClick={() => setSelbstlauf((x) => !x)} />
        <SymbolKnopf symbol="mischen" art={gemischt ? "klein voll" : "leer klein"}
          titel="Mischen" onClick={() => { setGemischt((x) => !x); setStelle(0); setGedreht(false); }} />
        <span className="klein matt mono">{stelle + 1} / {reihe.length}</span>
      </>}>

      <ModusLeiste>
        <Wahl beschriftung="Abfrage" wert={richtung} setzen={(w) => { setRichtung(w); setGedreht(false); }}
          moeglichkeiten={RICHTUNGEN(derStapel)} />
        <label className="reihe klein matt" style={{ gap: 6, cursor: "pointer" }}>
          <input type="checkbox" checked={nurMarkierte}
            onChange={(e) => { setNurMarkierte(e.target.checked); setStelle(0); setGedreht(false); }} />
          Nur Markierte
        </label>
        <div className="dehnen" />
        <span className="klein blass nur-breit">
          <span className="tastenhilfe">Leertaste</span> drehen ·
          <span className="tastenhilfe">↑</span> weiß ich ·
          <span className="tastenhilfe">↓</span> noch üben
        </span>
      </ModusLeiste>

      <div className="karten-buehne">
        <div className={"karte-gross" + (gedreht ? " gedreht" : "")}
          onClick={() => setGedreht((g) => !g)}>
          <div className="karte-seite">
            <div className="karte-ecke">{richtung === "dt"
              ? (derStapel.defLabel || "Rückseite") : (derStapel.termLabel || "Vorderseite")}</div>
            <Seite text={seiten.frage} bild={seiten.frageBild} sprache={sprachen.frage}
              klasse="karte-text" />
            {karte.hint && gedreht === false && (
              <div className="klein blass">Hinweis: {karte.hint}</div>
            )}
            <div style={{ position: "absolute", top: 8, right: 10 }}>
              <Stern an={karte.starred} aufKlick={() => karteAendern(karte.id, { starred: !karte.starred })} />
            </div>
          </div>
          <div className="karte-seite rueck">
            <div className="karte-ecke">{richtung === "dt"
              ? (derStapel.termLabel || "Vorderseite") : (derStapel.defLabel || "Rückseite")}</div>
            <Seite text={seiten.antwort} bild={seiten.antwortBild} sprache={sprachen.antwort}
              klasse="karte-text" />
          </div>
        </div>
      </div>

      <div className="karten-leiste">
        <SymbolKnopf symbol="pfeilLinks" titel="Zurück" art="leer" groesse={22}
          onClick={zurueck} disabled={stelle === 0} />
        <Knopf art="klein" onClick={() => urteilen(false)}>
          <Symbol name="zurueckSetzen" groesse={16} /> Noch üben
        </Knopf>
        <Knopf art="klein voll" onClick={() => urteilen(true)}>
          <Symbol name="haken" groesse={16} /> Weiß ich
        </Knopf>
        <SymbolKnopf symbol="pfeilRechts" titel="Weiter" art="leer" groesse={22}
          onClick={weiter} />
      </div>

      <p className="klein blass" style={{ textAlign: "center", marginTop: 18 }}>
        {anzahl(Object.values(urteile).filter(Boolean).length, "Karte sitzt", "Karten sitzen")} ·
        {" " + Object.values(urteile).filter((x) => !x).length} zum Üben
      </p>
    </ModusRahmen>
  );
}
