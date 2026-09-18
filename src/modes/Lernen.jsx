/*
 * Lernen — der Modus, der den Stoff über Tage verteilt.
 *
 * Es wird in Runden gearbeitet. Welche Karten drankommen, entscheidet der
 * Lernplan (siehe core/scheduler.js): erst Neues und Überfälliges, dann der
 * Rest. Frische Karten erscheinen als Auswahlfrage, sitzende als Schreib-
 * aufgabe. Was falsch war, kehrt noch in derselben Runde zurück.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { baueRunde, frageArt, faelligZaehlen } from "../core/scheduler.js";
import { anteileNachStufe } from "../core/model.js";
import { pruefe } from "../core/text.js";
import { mische, ziehe, anzahl } from "../core/util.js";
import { sprich } from "../core/speech.js";
import { gehe } from "../App.jsx";
import { Knopf, SymbolKnopf, Symbol, Balken, Bild, Leer, Stern, useTastatur } from "../ui/basis.jsx";
import {
  useModus, useBrauchbar, ModusRahmen, Seite, Wahl,
  RICHTUNGEN, seitenFuer, sprachenFuer, Hinweis,
} from "./gemeinsam.jsx";
import Formel from "../ui/Formel.jsx";

export default function Lernen({ setId, aufSchliessen }) {
  const {
    derStapel, karten, staende, einstellungen, antwortVerbuchen, karteAendern, sitzungMerken,
  } = useModus(setId);

  const [richtung, setRichtung] = useState("td");
  const [nurMarkierte, setNurMarkierte] = useState(false);
  const [arten, setArten] = useState({ auswahl: true, schreiben: true, wahrFalsch: false });
  const [runde, setRunde] = useState([]);
  const [stelle, setStelle] = useState(0);
  const [phase, setPhase] = useState("start");    // start | frage | rueckmeldung | rundenende
  const [eingabe, setEingabe] = useState("");
  const [urteil, setUrteil] = useState(null);
  const [zaehler, setZaehler] = useState({ richtig: 0, falsch: 0 });
  const feld = useRef(null);
  const vorlauf = useRef(null);

  useEffect(() => () => clearTimeout(vorlauf.current), []);

  const brauchbare = useBrauchbar(karten, nurMarkierte);
  const zaehlung = faelligZaehlen(brauchbare, staende);
  const aufgabe = runde[stelle] || null;

  /* Antwortmöglichkeiten für Auswahlfragen — bleiben stehen, solange die
     Aufgabe steht. */
  const moeglichkeiten = useMemo(() => {
    if (!aufgabe || aufgabe.art !== "auswahl") return [];
    const richtig = seitenFuer(aufgabe.karte, aufgabe.richtung);
    const andere = brauchbare.filter((k) => k.id !== aufgabe.karte.id);
    const ablenker = ziehe(andere, 3).map((k) => {
      const s = seitenFuer(k, aufgabe.richtung);
      return { id: k.id, text: s.antwort, bild: s.antwortBild, richtig: false };
    });
    return mische([{ id: aufgabe.karte.id, text: richtig.antwort,
      bild: richtig.antwortBild, richtig: true }, ...ablenker]);
  }, [aufgabe?.schluessel]);

  /* Bei „Wahr oder falsch“ wird in der Hälfte der Fälle eine fremde Antwort
     gezeigt. */
  const behauptung = useMemo(() => {
    if (!aufgabe || aufgabe.art !== "wahrFalsch") return null;
    const eigen = seitenFuer(aufgabe.karte, aufgabe.richtung);
    const stimmt = Math.random() < 0.5;
    if (stimmt) return { text: eigen.antwort, bild: eigen.antwortBild, stimmt: true };
    const andere = brauchbare.filter((k) => k.id !== aufgabe.karte.id);
    if (!andere.length) return { text: eigen.antwort, bild: eigen.antwortBild, stimmt: true };
    const fremd = seitenFuer(ziehe(andere, 1)[0], aufgabe.richtung);
    return { text: fremd.antwort, bild: fremd.antwortBild, stimmt: false };
  }, [aufgabe?.schluessel]);

  useEffect(() => {
    if (phase === "frage" && aufgabe?.art === "schreiben") feld.current?.focus();
  }, [phase, stelle]);

  const rundeStarten = () => {
    const gewaehlt = baueRunde(brauchbare, staende, {
      groesse: Number(einstellungen.rundenGroesse) || 7,
      richtung, nurMarkierte,
    });
    if (!gewaehlt.length) { setPhase("rundenende"); setRunde([]); return; }
    setRunde(gewaehlt.map((g, i) => ({
      karte: g.card, richtung: g.richtung,
      art: frageArt(staende[g.card.id]?.[g.richtung]?.box || 0, arten),
      schluessel: g.card.id + ":" + g.richtung + ":" + i,
    })));
    setStelle(0); setEingabe(""); setUrteil(null);
    setZaehler({ richtig: 0, falsch: 0 });
    setPhase("frage");
  };

  const verbuchen = (guete) => {
    antwortVerbuchen(aufgabe.karte, aufgabe.richtung, guete);
    setZaehler((z) => guete >= 2
      ? { ...z, richtig: z.richtig + 1 }
      : { ...z, falsch: z.falsch + 1 });
    if (guete < 2) {
      // Falsches kehrt am Ende der Runde zurück — dann als Auswahlfrage.
      setRunde((alt) => [...alt, {
        ...aufgabe, art: arten.auswahl ? "auswahl" : aufgabe.art,
        schluessel: aufgabe.schluessel + ":w" + alt.length,
      }]);
    }
  };

  const weiter = () => {
    clearTimeout(vorlauf.current);
    setUrteil(null); setEingabe("");
    if (stelle + 1 >= runde.length) {
      setPhase("rundenende");
      sitzungMerken({ setId, modus: "lernen", gesamt: zaehler.richtig + zaehler.falsch,
        richtig: zaehler.richtig });
    } else setStelle((s) => s + 1);
  };

  const antwortAuswahl = (moeglichkeit) => {
    if (phase !== "frage") return;
    const gut = moeglichkeit.richtig;
    setUrteil({ status: gut ? "richtig" : "falsch", gewaehlt: moeglichkeit.id });
    verbuchen(gut ? 2 : 0);
    setPhase("rueckmeldung");
    // Nach einer richtigen Antwort geht es von allein weiter; wer schneller
    // ist und „Weiter“ drückt, bricht diesen Vorlauf ab.
    if (gut) vorlauf.current = setTimeout(() => { setPhase("frage"); weiter(); }, 700);
  };

  const antwortSchreiben = () => {
    if (phase !== "frage") return;
    const seiten = seitenFuer(aufgabe.karte, aufgabe.richtung);
    const ergebnis = pruefe(eingabe, seiten.antwort, {
      tippfehlerErlauben: einstellungen.tippfehlerErlauben,
      ohneArtikel: einstellungen.ohneArtikel,
      zeichenEgal: einstellungen.zeichenEgal,
      satzzeichenEgal: einstellungen.satzzeichenEgal,
    });
    setUrteil(ergebnis);
    verbuchen(ergebnis.status === "richtig" ? 2 : ergebnis.status === "fast" ? 1 : 0);
    setPhase("rueckmeldung");
  };

  const antwortWahrFalsch = (gewaehlt) => {
    if (phase !== "frage") return;
    const gut = gewaehlt === behauptung.stimmt;
    setUrteil({ status: gut ? "richtig" : "falsch" });
    verbuchen(gut ? 2 : 0);
    setPhase("rueckmeldung");
  };

  /** Doch richtig — der Mensch entscheidet, nicht der Zeichenvergleich. */
  const dochRichtig = () => {
    antwortVerbuchen(aufgabe.karte, aufgabe.richtung, 2);
    setZaehler((z) => ({ richtig: z.richtig + 1, falsch: Math.max(0, z.falsch - 1) }));
    // Die eben angehängte Wiederholung dieser Karte wieder herausnehmen.
    setRunde((alt) => alt.filter((a, i) => i <= stelle || a.karte.id !== aufgabe.karte.id));
    setUrteil(null); setEingabe("");
    setStelle((s) => s + 1);
    setPhase("frage");
  };

  /* Sicherheitsnetz: läuft die Stelle über das Ende hinaus, ist die Runde vorbei. */
  useEffect(() => {
    if ((phase === "frage" || phase === "rueckmeldung") && stelle >= runde.length) {
      setPhase("rundenende");
      sitzungMerken({ setId, modus: "lernen", gesamt: zaehler.richtig + zaehler.falsch,
        richtig: zaehler.richtig });
    }
  }, [stelle, runde.length, phase]);

  useTastatur({
    Enter: { auchBeimTippen: true, fn: () => {
      if (phase === "rueckmeldung") { setPhase("frage"); weiter(); }
      else if (phase === "frage" && aufgabe?.art === "schreiben") antwortSchreiben();
      else if (phase === "start") rundeStarten();
    } },
    1: () => aufgabe?.art === "auswahl" && moeglichkeiten[0] && antwortAuswahl(moeglichkeiten[0]),
    2: () => aufgabe?.art === "auswahl" && moeglichkeiten[1] && antwortAuswahl(moeglichkeiten[1]),
    3: () => aufgabe?.art === "auswahl" && moeglichkeiten[2] && antwortAuswahl(moeglichkeiten[2]),
    4: () => aufgabe?.art === "auswahl" && moeglichkeiten[3] && antwortAuswahl(moeglichkeiten[3]),
  }, phase === "frage" || phase === "rueckmeldung" || phase === "start");

  if (!brauchbare.length) {
    return (
      <ModusRahmen titel="Lernen" symbol="blitz" aufSchliessen={aufSchliessen}>
        <Leer titel="Nichts zu lernen"
          text="Der Stapel braucht Karten mit beiden Seiten.">
          <Knopf onClick={() => gehe("/stapel/" + setId + "/bearbeiten")}>Karten anlegen</Knopf>
        </Leer>
      </ModusRahmen>
    );
  }

  /* ------------------------------ Startbild ----------------------------- */
  if (phase === "start") {
    return (
      <ModusRahmen titel="Lernen" symbol="blitz" aufSchliessen={aufSchliessen}>
        <h1 style={{ marginBottom: 6 }}>{derStapel.title}</h1>
        <p className="matt">
          {zaehlung.faellige > 0 || zaehlung.neu > 0
            ? `${anzahl(zaehlung.neu, "neue Karte", "neue Karten")}, ${zaehlung.faellige} zur Wiederholung.`
            : "Alles wiederholt, du kannst trotzdem eine Runde einlegen."}
        </p>
        <Balken anteile={anteileNachStufe(brauchbare, staende)} hoehe={12} />

        <div style={{ marginTop: 24, display: "grid", gap: 12 }}>
          <Wahl beschriftung="Abfrage" wert={richtung} setzen={setRichtung}
            moeglichkeiten={RICHTUNGEN(derStapel)} />
          <label className="schalter">
            <input type="checkbox" checked={arten.auswahl}
              onChange={(e) => setArten({ ...arten, auswahl: e.target.checked })} />
            <span>Auswahlfragen</span>
          </label>
          <label className="schalter">
            <input type="checkbox" checked={arten.schreiben}
              onChange={(e) => setArten({ ...arten, schreiben: e.target.checked })} />
            <span>Schreibaufgaben</span>
          </label>
          <label className="schalter">
            <input type="checkbox" checked={arten.wahrFalsch}
              onChange={(e) => setArten({ ...arten, wahrFalsch: e.target.checked })} />
            <span>Wahr oder falsch</span>
          </label>
          <label className="schalter">
            <input type="checkbox" checked={nurMarkierte}
              onChange={(e) => setNurMarkierte(e.target.checked)} />
            <span>Nur markierte Karten</span>
          </label>
        </div>

        <Knopf art="voll gross" symbol="blitz" style={{ marginTop: 26 }}
          onClick={rundeStarten}>Runde beginnen</Knopf>
      </ModusRahmen>
    );
  }

  /* ----------------------------- Rundenende ----------------------------- */
  if (phase === "rundenende") {
    const neueZaehlung = faelligZaehlen(brauchbare, staende);
    const alles = neueZaehlung.beherrscht === brauchbare.length;
    return (
      <ModusRahmen titel="Lernen" symbol="blitz" aufSchliessen={aufSchliessen}>
        <div style={{ textAlign: "center", paddingTop: 16 }}>
          <Symbol name={alles ? "haken" : "blitz"} groesse={38} />
          <h1 style={{ marginTop: 10 }}>{alles ? "Alles sitzt" : "Runde geschafft"}</h1>
          <p className="matt">
            {zaehler.richtig} richtig, {zaehler.falsch} daneben.
          </p>
          <div style={{ maxWidth: 460, margin: "20px auto" }}>
            <Balken anteile={anteileNachStufe(brauchbare, staende)} hoehe={12} />
            <div className="klein matt" style={{ marginTop: 8 }}>
              {neueZaehlung.beherrscht} von {brauchbare.length} beherrscht
            </div>
          </div>
          <div className="reihe" style={{ justifyContent: "center", flexWrap: "wrap" }}>
            {!alles && <Knopf art="voll gross" symbol="blitz" onClick={rundeStarten}>Weiter lernen</Knopf>}
            <Knopf art="gross" symbol="papier" onClick={() => gehe("/stapel/" + setId + "/test")}>
              Testen</Knopf>
            <Knopf art="gross" onClick={() => gehe("/stapel/" + setId)}>Zum Stapel</Knopf>
          </div>
        </div>
      </ModusRahmen>
    );
  }

  /* ------------------------------- Aufgabe ------------------------------ */
  if (!aufgabe) {
    return (
      <ModusRahmen titel="Lernen" symbol="blitz" aufSchliessen={aufSchliessen}>
        <div className="leerer-zustand">Einen Augenblick …</div>
      </ModusRahmen>
    );
  }

  const seiten = seitenFuer(aufgabe.karte, aufgabe.richtung);
  const sprachen = sprachenFuer(derStapel, aufgabe.richtung);
  const anteil = runde.length ? stelle / runde.length : 0;

  return (
    <ModusRahmen titel="Lernen" symbol="blitz" aufSchliessen={aufSchliessen} anteil={anteil}
      rechts={<>
        <span className="marke gruen">{zaehler.richtig}</span>
        <span className="marke rot">{zaehler.falsch}</span>
        <span className="klein matt mono">{stelle + 1} / {runde.length}</span>
      </>}>

      <div className="frage-block">
        <div className="klein blass">
          {aufgabe.art === "auswahl" ? "Wähle die richtige Antwort"
            : aufgabe.art === "schreiben" ? "Schreibe die Antwort"
              : "Stimmt das?"}
        </div>
        <Seite text={seiten.frage} bild={seiten.frageBild} sprache={sprachen.frage} />
        {phase === "frage" && <Hinweis text={aufgabe.karte.hint} />}
        <div style={{ position: "absolute" }} />
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
              <button key={m.id} className={klasse} onClick={() => antwortAuswahl(m)}>
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
            <button className={"antwort" + (phase === "rueckmeldung" && behauptung.stimmt ? " richtig" : "")}
              onClick={() => antwortWahrFalsch(true)}>
              <Symbol name="haken" /> Stimmt
            </button>
            <button className={"antwort" + (phase === "rueckmeldung" && !behauptung.stimmt ? " richtig" : "")}
              onClick={() => antwortWahrFalsch(false)}>
              <Symbol name="kreuz" /> Stimmt nicht
            </button>
          </div>
        </>
      )}

      {aufgabe.art === "schreiben" && (
        <div>
          <input ref={feld} className="feld" style={{ fontSize: 18, padding: "14px 16px" }}
            placeholder="Antwort eingeben" value={eingabe} disabled={phase === "rueckmeldung"}
            onChange={(e) => setEingabe(e.target.value)} />
          <div className="reihe" style={{ marginTop: 12 }}>
            <Knopf art="leer klein" onClick={() => { verbuchen(0); setUrteil({ status: "falsch" }); setPhase("rueckmeldung"); }}>
              Weiß ich nicht
            </Knopf>
            <div className="dehnen" />
            {phase === "frage"
              ? <Knopf art="voll" onClick={antwortSchreiben} disabled={!eingabe.trim()}>Prüfen</Knopf>
              : <Knopf art="voll" onClick={() => { setPhase("frage"); weiter(); }}>Weiter</Knopf>}
          </div>
        </div>
      )}

      {phase === "rueckmeldung" && urteil && (
        <div className={"rueckmeldung " + (urteil.status === "richtig" ? "gut"
          : urteil.status === "fast" ? "fast" : "schlecht")}>
          <div className="reihe">
            <Symbol name={urteil.status === "falsch" ? "kreuz" : "haken"} />
            <strong>{urteil.status === "richtig" ? "Richtig"
              : urteil.status === "fast" ? "Fast, achte auf die Schreibung" : "Leider nicht"}</strong>
            <div className="dehnen" />
            <SymbolKnopf symbol="laut" titel="Vorlesen"
              onClick={() => sprich(seiten.antwort, sprachen.antwort, einstellungen.sprechTempo)} />
            <Stern an={aufgabe.karte.starred}
              aufKlick={() => karteAendern(aufgabe.karte.id, { starred: !aufgabe.karte.starred })} />
          </div>
          <div style={{ marginTop: 8 }}>
            <span className="matt klein">Richtige Antwort: </span><Formel text={seiten.antwort} />
          </div>
          {aufgabe.art === "schreiben" && urteil.status !== "richtig" && eingabe.trim() && (
            <div className="reihe" style={{ marginTop: 10 }}>
              <span className="klein matt">Deine Antwort: „{eingabe}“</span>
              <Knopf art="klein" onClick={dochRichtig}>War doch richtig</Knopf>
            </div>
          )}
          <div className="reihe" style={{ marginTop: 12, justifyContent: "flex-end" }}>
            <Knopf art="voll" onClick={() => { setPhase("frage"); weiter(); }}>
              Weiter <span className="tastenhilfe nur-breit">↵</span>
            </Knopf>
          </div>
        </div>
      )}
    </ModusRahmen>
  );
}
