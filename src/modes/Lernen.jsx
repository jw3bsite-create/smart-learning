/*
 * Lernen — nach Art von Quizlet: in einer Sitzung, bis alles sitzt.
 *
 * Die Regeln stehen in core/lernsitzung.js: Jede Karte wird erst erkannt
 * (Auswahl, wahr oder falsch), dann geschrieben; danach gilt sie als
 * gemeistert. Gelernt wird in Runden, zwischen den Runden steht der Stand.
 * Was falsch war, kommt am Ende der Runde noch einmal. Der Stand bleibt auf
 * dem Gerät liegen (je Stapel), wer aufhört, macht später dort weiter.
 *
 * Ein Übungsmodus: Antworten zählen als Übung und verschieben keine Termine.
 * Vor dem 19. November 2026 stand hier ein „Lernen“, das den Stoff über Tage
 * verteilte; das ist Aufgabe des Abrufens.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { rundeBauen, nachAntwort, fortschritt, GEMEISTERT } from "../core/lernsitzung.js";
import { pruefe } from "../core/text.js";
import { mische, ziehe, anzahl } from "../core/util.js";
import { sprich } from "../core/speech.js";
import { gehe } from "../App.jsx";
import { Knopf, SymbolKnopf, Symbol, Bild, Leer, Stern, useTastatur, useMerker } from "../ui/basis.jsx";
import {
  useModus, useBrauchbar, ModusRahmen, Seite, Wahl, RICHTUNGEN, seitenFuer, sprachenFuer, Hinweis, LeerKnoepfe,
} from "./gemeinsam.jsx";
import Formel from "../ui/Formel.jsx";

const LEER = { stufen: {}, runden: 0 };

/* Der Balken: gemeistert, bekannt, neu — wie viel von allem. */
function Stand({ stand }) {
  const teil = (n) => (stand.gesamt ? (100 * n) / stand.gesamt : 0) + "%";
  return (
    <div>
      <div className="lern-balken" aria-hidden="true">
        <span className="gemeistert" style={{ width: teil(stand.gemeistert) }} />
        <span className="bekannt" style={{ width: teil(stand.bekannt) }} />
      </div>
      <div className="reihe umbruch klein oben-8" style={{ gap: 14 }}>
        <span><span className="lern-punkt gemeistert" /> {stand.gemeistert} gemeistert</span>
        <span><span className="lern-punkt bekannt" /> {stand.bekannt} bekannt</span>
        <span><span className="lern-punkt neu" /> {stand.neu} noch neu</span>
      </div>
    </div>
  );
}

export default function Lernen({ setId, aufSchliessen }) {
  const { derStapel, karten, einstellungen, antwortVerbuchen, karteAendern, sitzungMerken } = useModus(setId);
  /* Der Stern liest die Karte, wie sie jetzt im Bestand steht — nicht die
     Kopie in der Runde. */
  const markiert = (k) => Boolean((karten.find((x) => x.id === k.id) || k).starred);

  const [sitzung, setSitzung] = useMerker("lernen:" + setId, LEER);
  const [richtung, setRichtung] = useMerker("lernenRichtung", "td");
  const [arten, setArten] = useMerker("lernenArten", { auswahl: true, schreiben: true, wahrFalsch: false });
  const [nurMarkierte, setNurMarkierte] = useState(false);
  const [runde, setRunde] = useState([]);
  const [stelle, setStelle] = useState(0);
  const [phase, setPhase] = useState("start");    // start | frage | rueckmeldung | rundenende
  const [eingabe, setEingabe] = useState("");
  const [urteil, setUrteil] = useState(null);
  const [ergebnis, setErgebnis] = useState({});    // je Karte: beim ersten Versuch richtig?
  const feld = useRef(null);
  const vorlauf = useRef(null);
  const vorher = useRef(0);                        // Stufe vor der letzten Antwort

  useEffect(() => () => clearTimeout(vorlauf.current), []);

  const brauchbare = useBrauchbar(karten, nurMarkierte);
  const stufen = sitzung?.stufen || {};
  const stand = fortschritt(brauchbare, stufen);
  const aufgabe = runde[stelle] || null;

  /* Antwortmöglichkeiten — bleiben stehen, solange die Aufgabe steht. */
  const moeglichkeiten = useMemo(() => {
    if (!aufgabe || aufgabe.art !== "auswahl") return [];
    const richtig = seitenFuer(aufgabe.karte, aufgabe.richtung);
    const andere = brauchbare.filter((k) => k.id !== aufgabe.karte.id);
    const ablenker = ziehe(andere, 3).map((k) => {
      const s = seitenFuer(k, aufgabe.richtung);
      return { id: k.id, text: s.antwort, bild: s.antwortBild, richtig: false };
    });
    return mische([{ id: aufgabe.karte.id, text: richtig.antwort, bild: richtig.antwortBild, richtig: true },
      ...ablenker]);
  }, [aufgabe?.schluessel]);

  /* Wahr oder falsch: in der Hälfte der Fälle eine fremde Antwort. */
  const behauptung = useMemo(() => {
    if (!aufgabe || aufgabe.art !== "wahrFalsch") return null;
    const eigen = seitenFuer(aufgabe.karte, aufgabe.richtung);
    const andere = brauchbare.filter((k) => k.id !== aufgabe.karte.id);
    if (Math.random() < 0.5 || !andere.length) return { text: eigen.antwort, bild: eigen.antwortBild, stimmt: true };
    const fremd = seitenFuer(ziehe(andere, 1)[0], aufgabe.richtung);
    return { text: fremd.antwort, bild: fremd.antwortBild, stimmt: false };
  }, [aufgabe?.schluessel]);

  useEffect(() => {
    if (phase === "frage" && aufgabe?.art === "schreiben") feld.current?.focus();
  }, [phase, stelle]);

  const rundeStarten = (stufenJetzt = stufen) => {
    const neu = rundeBauen(brauchbare, stufenJetzt, {
      groesse: Number(einstellungen.rundenGroesse) || 7, arten,
    });
    if (!neu.length) { setPhase("rundenende"); setRunde([]); return; }
    setRunde(neu.map((a, i) => ({
      ...a,
      // „Beide Richtungen“ heißt hier: je Karte zufällig.
      richtung: richtung === "beide" ? (Math.random() < 0.5 ? "td" : "dt") : richtung,
      schluessel: a.karte.id + ":" + i + ":" + Date.now(),
    })));
    setStelle(0); setEingabe(""); setUrteil(null); setErgebnis({});
    setPhase("frage");
  };

  const vonVorn = () => { setSitzung(LEER); rundeStarten({}); };

  /* Eine Antwort festhalten: Stufe, Übungsstand, Wiederholung am Rundenende. */
  const verbuchen = (richtig, guete = richtig ? 2 : 0) => {
    vorher.current = Number(stufen[aufgabe.karte.id]) || 0;
    antwortVerbuchen(aufgabe.karte, aufgabe.richtung, guete);
    setSitzung((alt) => ({ ...(alt || LEER), stufen: nachAntwort(alt?.stufen || {}, aufgabe.karte.id, richtig) }));
    setErgebnis((alt) => (aufgabe.karte.id in alt ? alt : { ...alt, [aufgabe.karte.id]: richtig }));
    if (!richtig && !aufgabe.wiederholung) {
      setRunde((alt) => [...alt, { ...aufgabe, wiederholung: true, schluessel: aufgabe.schluessel + ":w" }]);
    }
  };

  const weiter = () => {
    clearTimeout(vorlauf.current);
    setUrteil(null); setEingabe("");
    if (stelle + 1 >= runde.length) {
      setSitzung((alt) => ({ ...(alt || LEER), runden: (alt?.runden || 0) + 1 }));
      setPhase("rundenende");
    } else { setStelle((s) => s + 1); setPhase("frage"); }
  };

  /* Am Rundenende die Sitzung vermerken — hier, nicht in `weiter`: Das läuft
     auch aus dem Zeitgeber und sähe dort die letzte Antwort noch nicht. */
  useEffect(() => {
    if (phase !== "rundenende") return;
    const werte = Object.values(ergebnis);
    if (werte.length) sitzungMerken({ setId, modus: "lernen", gesamt: werte.length, richtig: werte.filter(Boolean).length });
  }, [phase]);

  const antwortAuswahl = (m) => {
    if (phase !== "frage") return;
    setUrteil({ status: m.richtig ? "richtig" : "falsch", gewaehlt: m.id });
    verbuchen(m.richtig);
    setPhase("rueckmeldung");
    // Richtig geht es von allein weiter; wer schneller ist, drückt Weiter.
    if (m.richtig) vorlauf.current = setTimeout(weiter, 800);
  };

  const antwortWahrFalsch = (gewaehlt) => {
    if (phase !== "frage") return;
    const gut = gewaehlt === behauptung.stimmt;
    setUrteil({ status: gut ? "richtig" : "falsch" });
    verbuchen(gut);
    setPhase("rueckmeldung");
    if (gut) vorlauf.current = setTimeout(weiter, 800);
  };

  const antwortSchreiben = () => {
    if (phase !== "frage") return;
    const seiten = seitenFuer(aufgabe.karte, aufgabe.richtung);
    const e = pruefe(eingabe, seiten.antwort, {
      tippfehlerErlauben: einstellungen.tippfehlerErlauben, ohneArtikel: einstellungen.ohneArtikel,
      zeichenEgal: einstellungen.zeichenEgal, satzzeichenEgal: einstellungen.satzzeichenEgal,
    });
    setUrteil(e);
    // „Fast“ (ein Tippfehler) zählt als gewusst, mit dem Hinweis auf die Schreibung.
    verbuchen(e.status !== "falsch", e.status === "richtig" ? 2 : e.status === "fast" ? 1 : 0);
    setPhase("rueckmeldung");
  };

  const weissNicht = () => {
    if (phase !== "frage") return;
    setUrteil({ status: "falsch", weissNicht: true });
    verbuchen(false);
    setPhase("rueckmeldung");
  };

  /** Doch richtig — der Mensch entscheidet, nicht der Zeichenvergleich. */
  const dochRichtig = () => {
    antwortVerbuchen(aufgabe.karte, aufgabe.richtung, 2);
    // Von der Stufe vor der Antwort eine hinauf, als wäre sie richtig gewesen.
    setSitzung((alt) => ({ ...(alt || LEER),
      stufen: nachAntwort({ ...(alt?.stufen || {}), [aufgabe.karte.id]: vorher.current }, aufgabe.karte.id, true) }));
    setErgebnis((alt) => ({ ...alt, [aufgabe.karte.id]: true }));
    setRunde((alt) => alt.filter((a, i) => i <= stelle || !(a.wiederholung && a.karte.id === aufgabe.karte.id)));
    weiter();
  };

  useTastatur({
    Enter: { auchBeimTippen: true, fn: () => {
      if (phase === "rueckmeldung") weiter();
      else if (phase === "frage" && aufgabe?.art === "schreiben" && eingabe.trim()) antwortSchreiben();
      else if (phase === "start" || phase === "rundenende") { if (!stand.fertig) rundeStarten(); }
    } },
    1: () => aufgabe?.art === "auswahl" && moeglichkeiten[0] && antwortAuswahl(moeglichkeiten[0]),
    2: () => aufgabe?.art === "auswahl" && moeglichkeiten[1] && antwortAuswahl(moeglichkeiten[1]),
    3: () => aufgabe?.art === "auswahl" && moeglichkeiten[2] && antwortAuswahl(moeglichkeiten[2]),
    4: () => aufgabe?.art === "auswahl" && moeglichkeiten[3] && antwortAuswahl(moeglichkeiten[3]),
  }, ["frage", "rueckmeldung", "start", "rundenende"].includes(phase));

  if (!brauchbare.length) {
    return (
      <ModusRahmen titel="Lernen" symbol="ziel" aufSchliessen={aufSchliessen}>
        <Leer titel="Nichts zu lernen" text="Der Stapel braucht Karten mit beiden Seiten.">
          <LeerKnoepfe setId={setId} nurMarkierte={nurMarkierte} aufAlle={() => setNurMarkierte(false)} />
        </Leer>
      </ModusRahmen>
    );
  }

  /* ------------------------------ Startbild ----------------------------- */
  if (phase === "start") {
    const begonnen = stand.gemeistert + stand.bekannt > 0;
    return (
      <ModusRahmen titel="Lernen" symbol="ziel" aufSchliessen={aufSchliessen}>
        <h1 className="unten-8">{derStapel.title}</h1>
        <p className="matt">
          {stand.fertig ? "Alles gemeistert. Du kannst von vorn beginnen."
            : begonnen ? "Du warst schon dabei — es geht dort weiter, wo du aufgehört hast."
              : "Jede Karte erst erkennen, dann schreiben. Bis alle sitzen."}
        </p>
        <Stand stand={stand} />

        <div className="oben-24" style={{ display: "grid", gap: 12 }}>
          <Wahl beschriftung="Abfrage" wert={richtung} setzen={setRichtung}
            moeglichkeiten={RICHTUNGEN(derStapel).map(([w, n]) => [w, w === "beide" ? "Zufällig je Karte" : n])} />
          <label className="schalter">
            <input type="checkbox" checked={arten.auswahl}
              onChange={(e) => setArten({ ...arten, auswahl: e.target.checked })} />
            <span>Auswahlfragen</span>
          </label>
          <label className="schalter">
            <input type="checkbox" checked={arten.wahrFalsch}
              onChange={(e) => setArten({ ...arten, wahrFalsch: e.target.checked })} />
            <span>Wahr oder falsch</span>
          </label>
          <label className="schalter">
            <input type="checkbox" checked={arten.schreiben}
              onChange={(e) => setArten({ ...arten, schreiben: e.target.checked })} />
            <span>Schreiben</span>
          </label>
          <label className="schalter">
            <input type="checkbox" checked={nurMarkierte}
              onChange={(e) => setNurMarkierte(e.target.checked)} />
            <span>Nur markierte Karten</span>
          </label>
        </div>

        <div className="reihe umbruch oben-24">
          {!stand.fertig && (
            <Knopf art="voll gross" symbol="blitz" onClick={() => rundeStarten()}>
              {begonnen ? "Weiter lernen" : "Lernen beginnen"}</Knopf>
          )}
          {(begonnen || stand.fertig) && (
            <Knopf art={stand.fertig ? "voll gross" : "gross"} symbol="zurueckSetzen" onClick={vonVorn}>
              Von vorn</Knopf>
          )}
        </div>
      </ModusRahmen>
    );
  }

  /* ----------------------------- Rundenende ----------------------------- */
  if (phase === "rundenende") {
    const inDieserRunde = [...new Map(runde.map((a) => [a.karte.id, a])).values()];
    return (
      <ModusRahmen titel="Lernen" symbol="ziel" aufSchliessen={aufSchliessen}>
        <div className="lern-ende">
          <div className={"lern-ende-zeichen" + (stand.fertig ? " fertig" : "")}>
            <Symbol name={stand.fertig ? "haken" : "blitz"} groesse={30} />
          </div>
          <h1 className="oben-12">{stand.fertig ? "Geschafft — alles gemeistert" : "Runde geschafft"}</h1>
          <p className="matt">
            {stand.fertig
              ? anzahl(stand.gesamt, "Karte sitzt", "Karten sitzen") + ". Prüf dich jetzt im Test, oder ruf sie morgen ab."
              : stand.gemeistert + " von " + stand.gesamt + " gemeistert. Weiter so."}
          </p>
        </div>
        <Stand stand={stand} />

        {inDieserRunde.length > 0 && (
          <div className="liste oben-24">
            {inDieserRunde.map((a) => {
              const s = seitenFuer(a.karte, a.richtung);
              const gut = ergebnis[a.karte.id];
              return (
                <div key={a.karte.id} className="listenzeile" style={{ cursor: "default" }}>
                  <span className={"lern-ergebnis " + (gut ? "gut" : "schlecht")}>
                    <Symbol name={gut ? "haken" : "kreuz"} groesse={14} />
                  </span>
                  <span className="dehnen"><Formel text={s.frage} /></span>
                  <span className="klein matt"><Formel text={s.antwort} /></span>
                  {(stufen[a.karte.id] || 0) >= GEMEISTERT && <span className="marke gruen">gemeistert</span>}
                </div>
              );
            })}
          </div>
        )}

        <div className="reihe umbruch oben-24">
          {stand.fertig ? <>
            <Knopf art="voll gross" symbol="papier" onClick={() => gehe("/stapel/" + setId + "/test")}>Testen</Knopf>
            <Knopf art="gross" symbol="zurueckSetzen" onClick={vonVorn}>Von vorn</Knopf>
          </> : (
            <Knopf art="voll gross" symbol="blitz" onClick={() => rundeStarten()}>
              Nächste Runde <span className="tastenhilfe nur-breit">↵</span></Knopf>
          )}
          <Knopf art="gross" onClick={() => gehe("/stapel/" + setId)}>Zum Stapel</Knopf>
        </div>
      </ModusRahmen>
    );
  }

  /* ------------------------------- Aufgabe ------------------------------ */
  if (!aufgabe) {
    return (
      <ModusRahmen titel="Lernen" symbol="ziel" aufSchliessen={aufSchliessen}>
        <div className="leerer-zustand">Einen Augenblick …</div>
      </ModusRahmen>
    );
  }

  const seiten = seitenFuer(aufgabe.karte, aufgabe.richtung);
  const sprachen = sprachenFuer(derStapel, aufgabe.richtung);

  return (
    <ModusRahmen titel="Lernen" symbol="ziel" aufSchliessen={aufSchliessen}
      anteil={stand.gesamt ? stand.gemeistert / stand.gesamt : 0}
      rechts={<span className="klein matt mono">{stand.gemeistert} / {stand.gesamt}</span>}>

      <div key={aufgabe.schluessel} className="lern-aufgabe">
        <div className="frage-block">
          <div className="klein blass">
            {aufgabe.wiederholung ? "Noch einmal: " : ""}
            {aufgabe.art === "auswahl" ? "Wähle die richtige Antwort"
              : aufgabe.art === "schreiben" ? "Schreib die Antwort" : "Stimmt das?"}
          </div>
          <Seite text={seiten.frage} bild={seiten.frageBild} sprache={sprachen.frage} />
          {phase === "frage" && <Hinweis text={aufgabe.karte.hint} />}
        </div>

        {aufgabe.art === "auswahl" && (
          <div className="antwort-gitter">
            {moeglichkeiten.map((m, i) => {
              let klasse = "antwort";
              if (phase === "rueckmeldung") {
                if (m.richtig) klasse += " richtig";
                else if (urteil?.gewaehlt === m.id) klasse += " falsch";
              }
              return (
                <button key={m.id} type="button" className={klasse} onClick={() => antwortAuswahl(m)}>
                  <span className="ziffer">{i + 1}</span>
                  <span><Formel text={m.text} />{m.bild && <Bild kennung={m.bild} klasse=""
                    stil={{ maxHeight: 70, borderRadius: 6, marginTop: 6, display: "block" }} />}</span>
                </button>
              );
            })}
          </div>
        )}

        {aufgabe.art === "wahrFalsch" && behauptung && (
          <>
            <div className="frage-block" style={{ minHeight: 90, marginTop: -8 }}>
              <Seite text={behauptung.text} bild={behauptung.bild} sprache={sprachen.antwort}
                vorlesen={false} klasse="frage-text lang" />
            </div>
            <div className="antwort-gitter">
              <button type="button" className={"antwort" + (phase === "rueckmeldung" && behauptung.stimmt ? " richtig" : "")}
                onClick={() => antwortWahrFalsch(true)}><Symbol name="haken" /> Stimmt</button>
              <button type="button" className={"antwort" + (phase === "rueckmeldung" && !behauptung.stimmt ? " richtig" : "")}
                onClick={() => antwortWahrFalsch(false)}><Symbol name="kreuz" /> Stimmt nicht</button>
            </div>
          </>
        )}

        {aufgabe.art === "schreiben" && (
          <div>
            <input ref={feld} className="feld" style={{ fontSize: 18, padding: "14px 16px" }}
              placeholder="Antwort eingeben" value={eingabe} disabled={phase === "rueckmeldung"}
              onChange={(e) => setEingabe(e.target.value)} />
            {phase === "frage" && (
              <div className="reihe oben-12">
                <div className="dehnen" />
                <Knopf art="voll" onClick={antwortSchreiben} disabled={!eingabe.trim()}>Prüfen</Knopf>
              </div>
            )}
          </div>
        )}

        {phase === "frage" && (
          <button type="button" className="pfad-verweis klein oben-12" onClick={weissNicht}>
            Weiß ich nicht</button>
        )}
      </div>

      {phase === "rueckmeldung" && urteil && (
        <div className={"rueckmeldung " + (urteil.status === "richtig" ? "gut"
          : urteil.status === "fast" ? "fast" : "schlecht")}>
          <div className="reihe">
            <Symbol name={urteil.status === "falsch" ? "kreuz" : "haken"} />
            <strong>{urteil.status === "richtig" ? "Richtig"
              : urteil.status === "fast" ? "Fast, achte auf die Schreibung"
                : urteil.weissNicht ? "Macht nichts — so heißt es" : "Leider nicht"}</strong>
            <div className="dehnen" />
            <SymbolKnopf symbol="laut" titel="Vorlesen"
              onClick={() => sprich(seiten.antwort, sprachen.antwort, einstellungen.sprechTempo)} />
            <Stern an={markiert(aufgabe.karte)}
              aufKlick={() => karteAendern(aufgabe.karte.id, { starred: !markiert(aufgabe.karte) })} />
          </div>
          {urteil.status !== "richtig" && (
            <div className="oben-8">
              <span className="matt klein">Richtige Antwort: </span><Formel text={seiten.antwort} />
            </div>
          )}
          {aufgabe.art === "schreiben" && urteil.status === "falsch" && eingabe.trim() && (
            <div className="reihe oben-12">
              <span className="klein matt">Deine Antwort: „{eingabe}“</span>
              <Knopf art="klein" onClick={dochRichtig}>War doch richtig</Knopf>
            </div>
          )}
          <div className="reihe oben-12" style={{ justifyContent: "flex-end" }}>
            <Knopf art="voll" onClick={weiter}>
              Weiter <span className="tastenhilfe nur-breit">↵</span>
            </Knopf>
          </div>
        </div>
      )}
    </ModusRahmen>
  );
}
