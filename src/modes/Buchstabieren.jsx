/*
 * Buchstabieren: anhören und schreiben.
 *
 * Hier wird streng geprüft — es geht ja gerade um die Schreibung. Umlaute und
 * Betonungszeichen zählen also, Tippfehler werden nicht verziehen. Wer daneben
 * liegt, schreibt das Wort einmal richtig ab; das prägt sich ein.
 */

import React, { useEffect, useRef, useState } from "react";
import { normalisiere, unterschied } from "../core/text.js";
import { mische } from "../core/util.js";
import { sprich, sprachAusgabeDa } from "../core/speech.js";
import { gehe } from "../App.jsx";
import { Knopf, Symbol, SymbolKnopf, Leer, useTastatur } from "../ui/basis.jsx";
import {
  useModus, useBrauchbar, ModusRahmen, Ergebnis, Wahl,
} from "./gemeinsam.jsx";

export default function Buchstabieren({ setId, aufSchliessen }) {
  const { derStapel, karten, antwortVerbuchen, sitzungMerken } = useModus(setId);
  const [seite, setSeite] = useState("term");
  const [nurMarkierte, setNurMarkierte] = useState(false);
  const [reihe, setReihe] = useState(null);
  const [stelle, setStelle] = useState(0);
  const [eingabe, setEingabe] = useState("");
  const [zustand, setZustand] = useState("frage");   // frage | richtig | falsch | abschreiben
  const [zaehler, setZaehler] = useState({ richtig: 0, falsch: 0 });
  const [fertig, setFertig] = useState(false);
  const [tempo, setTempo] = useState(1);
  const feld = useRef(null);

  const brauchbare = useBrauchbar(karten, nurMarkierte);
  const aufgabe = reihe ? reihe[stelle] : null;
  const loesung = aufgabe ? (seite === "term" ? aufgabe.karte.term : aufgabe.karte.definition) : "";
  const gegenseite = aufgabe ? (seite === "term" ? aufgabe.karte.definition : aufgabe.karte.term) : "";
  const sprache = seite === "term" ? derStapel?.termLang : derStapel?.defLang;

  const vorlesen = (langsam = false) => {
    if (loesung) sprich(loesung, sprache, langsam ? 0.6 : tempo);
  };

  useEffect(() => {
    if (!aufgabe || zustand !== "frage") return;
    vorlesen();
    feld.current?.focus();
  }, [stelle, reihe, zustand]);

  useEffect(() => {
    if (reihe && reihe.length && stelle >= reihe.length) setFertig(true);
  }, [stelle, reihe]);

  const beginnen = () => {
    setReihe(mische(brauchbare).map((k, i) => ({ karte: k, schluessel: k.id + ":" + i })));
    setStelle(0); setEingabe(""); setZustand("frage");
    setZaehler({ richtig: 0, falsch: 0 }); setFertig(false);
  };

  const streng = { tippfehlerErlauben: false, ohneArtikel: false,
    zeichenEgal: false, satzzeichenEgal: true, ohneKlammern: false };

  const pruefen = () => {
    if (!aufgabe) return;
    if (zustand === "abschreiben") {
      if (normalisiere(eingabe, streng) === normalisiere(loesung, streng)) weiter();
      return;
    }
    if (zustand !== "frage") return;
    const gut = normalisiere(eingabe, streng) === normalisiere(loesung, streng);
    antwortVerbuchen(aufgabe.karte, seite === "term" ? "dt" : "td", gut ? 2 : 0);
    if (gut) {
      setZaehler((z) => ({ ...z, richtig: z.richtig + 1 }));
      setZustand("richtig");
      setTimeout(() => weiter(), 800);
    } else {
      setZaehler((z) => ({ ...z, falsch: z.falsch + 1 }));
      setZustand("falsch");
      setReihe((alt) => [...alt, { ...aufgabe, schluessel: aufgabe.schluessel + ":w" }]);
    }
  };

  const weiter = () => {
    setEingabe(""); setZustand("frage");
    if (stelle + 1 >= reihe.length) {
      setFertig(true);
      sitzungMerken({ setId, modus: "buchstabieren",
        gesamt: zaehler.richtig + zaehler.falsch, richtig: zaehler.richtig });
    } else setStelle((s) => s + 1);
  };

  useTastatur({
    Enter: { auchBeimTippen: true, fn: () => {
      if (!reihe) beginnen();
      else if (zustand === "falsch") { setEingabe(""); setZustand("abschreiben"); }
      else pruefen();
    } },
  }, !fertig);

  if (!brauchbare.length) {
    return (
      <ModusRahmen titel="Buchstabieren" symbol="buchstaben" aufSchliessen={aufSchliessen}>
        <Leer titel="Keine Karten" text="Für diesen Modus braucht es Karten mit Text.">
          <Knopf onClick={() => gehe("/stapel/" + setId + "/bearbeiten")}>Karten anlegen</Knopf>
        </Leer>
      </ModusRahmen>
    );
  }

  if (fertig) {
    return (
      <ModusRahmen titel="Buchstabieren" symbol="buchstaben" aufSchliessen={aufSchliessen}>
        <Ergebnis titel="Alles buchstabiert" setId={setId}
          richtig={zaehler.richtig} gesamt={zaehler.richtig + zaehler.falsch}
          aufNochmal={beginnen} />
      </ModusRahmen>
    );
  }

  if (!reihe) {
    return (
      <ModusRahmen titel="Buchstabieren" symbol="buchstaben" aufSchliessen={aufSchliessen}>
        <h1>{derStapel.title}</h1>
        {!sprachAusgabeDa() ? (
          <div className="rueckmeldung schlecht">
            Dieser Browser bringt keine Sprachausgabe mit, ohne sie ist der Modus
            nicht zu gebrauchen.
          </div>
        ) : (
          <p className="matt">
            Das Wort wird vorgelesen, du schreibst es. Achte auf Umlaute und
            Betonungszeichen: hier zählt jeder Buchstabe.
          </p>
        )}
        <div style={{ display: "grid", gap: 12, marginTop: 20 }}>
          <Wahl beschriftung="Vorgelesen wird" wert={seite} setzen={setSeite}
            moeglichkeiten={[["term", derStapel.termLabel || "Vorderseite"],
              ["definition", derStapel.defLabel || "Rückseite"]]} />
          <Wahl beschriftung="Tempo" wert={String(tempo)} setzen={(w) => setTempo(Number(w))}
            moeglichkeiten={[["0.7", "Langsam"], ["1", "Normal"], ["1.3", "Zügig"]]} />
          <label className="schalter">
            <input type="checkbox" checked={nurMarkierte}
              onChange={(e) => setNurMarkierte(e.target.checked)} />
            <span>Nur markierte Karten</span>
          </label>
        </div>
        <Knopf art="voll gross" symbol="laut" style={{ marginTop: 24 }} onClick={beginnen}>
          Anhören und schreiben
        </Knopf>
      </ModusRahmen>
    );
  }

  if (!aufgabe) {
    return (
      <ModusRahmen titel="Buchstabieren" symbol="buchstaben" aufSchliessen={aufSchliessen}>
        <div className="leerer-zustand">Einen Augenblick …</div>
      </ModusRahmen>
    );
  }

  const stellen = zustand === "falsch" ? unterschied(eingabe, loesung) : [];

  return (
    <ModusRahmen titel="Buchstabieren" symbol="buchstaben" aufSchliessen={aufSchliessen}
      anteil={stelle / reihe.length}
      rechts={<>
        <span className="marke gruen">{zaehler.richtig}</span>
        <span className="marke rot">{zaehler.falsch}</span>
        <span className="klein matt mono">{stelle + 1} / {reihe.length}</span>
      </>}>

      <div className="frage-block">
        <SymbolKnopf symbol="laut" titel="Noch einmal anhören" art="" groesse={30}
          onClick={() => vorlesen()} />
        <div className="reihe">
          <Knopf art="klein leer" onClick={() => vorlesen(true)}>Langsamer</Knopf>
        </div>
        {gegenseite && zustand !== "frage" && (
          <div className="klein matt">{gegenseite}</div>
        )}
      </div>

      {zustand === "falsch" ? (
        <div className="rueckmeldung schlecht">
          <div className="reihe"><Symbol name="kreuz" /><strong>Nicht ganz</strong></div>
          <div style={{ marginTop: 10, fontSize: 20, fontFamily: "var(--serifen)" }}>
            {loesung.split("").map((z, i) => (
              <span key={i} style={{
                color: stellen.includes(i) ? "var(--rot)" : undefined,
                textDecoration: stellen.includes(i) ? "underline" : undefined,
              }}>{z}</span>
            ))}
          </div>
          {eingabe && <div className="klein matt" style={{ marginTop: 6 }}>Geschrieben: „{eingabe}“</div>}
          <div className="reihe" style={{ marginTop: 12, justifyContent: "flex-end" }}>
            <Knopf art="voll" onClick={() => { setEingabe(""); setZustand("abschreiben"); }}>
              Einmal richtig schreiben
            </Knopf>
          </div>
        </div>
      ) : zustand === "richtig" ? (
        <div className="rueckmeldung gut">
          <div className="reihe"><Symbol name="haken" /><strong>Richtig geschrieben</strong></div>
        </div>
      ) : (
        <>
          <input ref={feld} className="feld" style={{ fontSize: 19, padding: "14px 16px" }}
            placeholder={zustand === "abschreiben" ? "Schreibe das Wort ab" : "Was hast du gehört?"}
            value={eingabe} onChange={(e) => setEingabe(e.target.value)} autoFocus />
          {zustand === "abschreiben" && (
            <div className="klein matt" style={{ marginTop: 8 }}>
              Vorlage: <strong>{loesung}</strong>
            </div>
          )}
          <div className="reihe" style={{ marginTop: 12, justifyContent: "flex-end" }}>
            <Knopf art="voll" onClick={pruefen} disabled={!eingabe.trim()}>
              {zustand === "abschreiben" ? "Übernehmen" : "Prüfen"}
            </Knopf>
          </div>
        </>
      )}
    </ModusRahmen>
  );
}
