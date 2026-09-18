/*
 * Vorab — fünf Fragen zu Stoff, den man noch nicht gelernt hat.
 *
 * Das klingt widersinnig und ist es nicht: Wer eine Frage zu sehen bekommt,
 * ehe er die Antwort kennt, behält die Antwort später besser — auch dann,
 * wenn er beim Versuch danebenliegt. Der Effekt entsteht durch das Suchen,
 * nicht durch das Treffen.
 *
 * Deshalb wird hier nichts gewertet: keine Note, kein Eintrag in den Plan,
 * keine Zeile in der Statistik. Die Reviews werden mit dem Vermerk `pretest`
 * abgelegt und bleiben aus jeder Auswertung heraus. Wer hier fünfmal danebenhaut,
 * hat alles richtig gemacht.
 */

import React, { useMemo, useState } from "react";
import { useDaten } from "../core/store.jsx";
import { normalisiere } from "../core/text.js";
import { kartenArt, richtungenFuer } from "../core/model.js";
import { ziehe } from "../core/util.js";
import { gehe } from "../App.jsx";
import { Knopf, Symbol, Bild, Leer, useTastatur } from "../ui/basis.jsx";
import { ModusRahmen } from "./gemeinsam.jsx";
import Formel from "../ui/Formel.jsx";

const WIE_VIELE = 5;

export default function Pretest({ setId, aufSchliessen }) {
  const { stapel, kartenVon, zustaende, abrufVerbuchen, fachDesStapels } = useDaten();
  const [stelle, setStelle] = useState(0);
  const [eingabe, setEingabe] = useState("");
  const [aufgedeckt, setAufgedeckt] = useState(false);
  const [fertig, setFertig] = useState(false);
  const [getroffen, setGetroffen] = useState(0);

  const derStapel = stapel.find((s) => s.id === setId);
  const karten = kartenVon(setId);

  /* Gefragt wird nur, was noch nie abgerufen wurde — sonst ist es kein Vorab. */
  const auswahl = useMemo(() => {
    const frische = karten.filter((k) => {
      if (kartenArt(k) === "cloze") return true;
      const z = zustaende[k.id + ":td"];
      return !z || !z.reps;
    });
    return ziehe(frische.length ? frische : karten, WIE_VIELE);
  }, [setId]);

  const karte = auswahl[stelle] || null;
  const richtung = karte ? richtungenFuer(karte, derStapel)[0] : "td";
  const loesung = karte ? (richtung === "dt" ? karte.term : karte.definition) : "";

  const aufdecken = () => {
    if (aufgedeckt || !karte) return;
    setAufgedeckt(true);
    const stimmt = eingabe.trim() &&
      normalisiere(eingabe) === normalisiere(loesung);
    if (stimmt) setGetroffen((g) => g + 1);
    // Festhalten, aber nichts verschieben: der Vermerk hält es aus der
    // Auswertung heraus.
    abrufVerbuchen({
      karte, stapel: derStapel, richtung,
      bewertung: stimmt ? 3 : 1, konfidenz: null,
      antwortzeit: 0, flag: "pretest", modus: "pretest",
      fach: fachDesStapels(setId),
    });
  };

  const weiter = () => {
    setAufgedeckt(false); setEingabe("");
    if (stelle + 1 >= auswahl.length) setFertig(true);
    else setStelle((s) => s + 1);
  };

  useTastatur({
    Enter: { auchBeimTippen: true, fn: () => (aufgedeckt ? weiter() : aufdecken()) },
  }, Boolean(karte) && !fertig);

  if (!derStapel || karten.length < 2) {
    return (
      <ModusRahmen titel="Vorab" symbol="auge" aufSchliessen={aufSchliessen}>
        <Leer titel="Zu wenige Karten"
          text="Für eine Vorabrunde braucht es mindestens zwei Karten im Stapel." />
      </ModusRahmen>
    );
  }

  if (fertig) {
    return (
      <ModusRahmen titel="Vorab" symbol="auge" aufSchliessen={aufSchliessen} anteil={1}>
        <div style={{ textAlign: "center", paddingTop: 24 }}>
          <Symbol name="auge" groesse={38} />
          <h1 style={{ marginTop: 12 }}>Vorab erledigt</h1>
          <p className="matt" style={{ maxWidth: 480, margin: "10px auto" }}>
            {getroffen === 0
              ? "Nichts getroffen, genau so war es gedacht. Die Fragen haben ihre Arbeit trotzdem getan: Der Stoff kommt dir gleich bekannter vor, als er sollte."
              : getroffen === auswahl.length
                ? "Alles getroffen. Dann kennst du das Thema schon, häng dich lieber an etwas Neues."
                : `${getroffen} von ${auswahl.length} getroffen. Der Rest ist jetzt vorbereitet, ohne dass du es merkst.`}
          </p>
          <p className="klein blass">
            Nichts davon wurde gewertet. Kein Termin hat sich verschoben.
          </p>
          <div className="reihe" style={{ justifyContent: "center", marginTop: 22, flexWrap: "wrap" }}>
            <Knopf art="voll gross" symbol="blitz"
              onClick={() => gehe(derStapel.subjectId
                ? "/abrufen/" + derStapel.subjectId : "/faecher")}>
              Jetzt richtig lernen
            </Knopf>
            <Knopf art="gross" onClick={() => gehe("/stapel/" + setId)}>Zum Stapel</Knopf>
          </div>
        </div>
      </ModusRahmen>
    );
  }

  if (!karte) {
    return <ModusRahmen titel="Vorab" symbol="auge" aufSchliessen={aufSchliessen}>
      <div className="leerer-zustand">Einen Augenblick …</div>
    </ModusRahmen>;
  }

  const frage = richtung === "dt" ? karte.definition : karte.term;
  const frageBild = richtung === "dt" ? karte.defImage : karte.termImage;

  return (
    <ModusRahmen titel="Vorab" symbol="auge" aufSchliessen={aufSchliessen}
      anteil={stelle / auswahl.length}
      rechts={<span className="klein matt mono">{stelle + 1} / {auswahl.length}</span>}>

      <div className="rueckmeldung fast" style={{ marginBottom: 18 }}>
        <div className="reihe">
          <Symbol name="auge" />
          <strong>Vorab. Fehler sind hier erwünscht.</strong>
        </div>
        <p className="klein" style={{ marginTop: 6, marginBottom: 0 }}>
          Diesen Stoff hattest du noch nicht. Rate ruhig; nichts davon zählt.
        </p>
      </div>

      <div className="frage-block">
        {frageBild && <Bild kennung={frageBild} />}
        <div className={"frage-text" + (frage.length > 90 ? " lang" : "")}><Formel text={frage} /></div>
      </div>

      {!aufgedeckt ? (
        <>
          <input className="feld" style={{ fontSize: 18, padding: "14px 16px" }}
            placeholder="Was könnte es sein?" value={eingabe} autoFocus
            onChange={(e) => setEingabe(e.target.value)} />
          <div className="reihe" style={{ marginTop: 12, justifyContent: "flex-end" }}>
            <Knopf art="voll" onClick={aufdecken}>
              Auflösen <span className="tastenhilfe nur-breit">↵</span>
            </Knopf>
          </div>
        </>
      ) : (
        <>
          <div className="rueckmeldung gut">
            <div className="klein matt">Die Antwort</div>
            <div style={{ fontSize: 18, marginTop: 4 }}><Formel text={loesung} /></div>
            {eingabe.trim() && (
              <div className="klein blass" style={{ marginTop: 8 }}>
                Du hattest geschrieben: „{eingabe}“
              </div>
            )}
          </div>
          <div className="reihe" style={{ marginTop: 12, justifyContent: "flex-end" }}>
            <Knopf art="voll" onClick={weiter}>
              Weiter <span className="tastenhilfe nur-breit">↵</span>
            </Knopf>
          </div>
        </>
      )}
    </ModusRahmen>
  );
}
