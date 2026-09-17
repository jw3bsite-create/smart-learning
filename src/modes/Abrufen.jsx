/*
 * Abrufen — der Modus, der über Termine entscheidet.
 *
 * Der Ablauf ist verbindlich und in dieser Reihenfolge festgelegt:
 *
 *   Frage sehen → sich selbst einschätzen → Antwort tippen → aufdecken → bewerten
 *
 * Die Selbsteinschätzung vor dem Aufdecken ist der Kern. Sie kostet eine
 * Sekunde und liefert die einzige Zahl, die zeigt, ob man sich selbst traut:
 * Wie oft war „sicher" tatsächlich richtig? Wer sie überspringt, lernt weiter
 * mit dem Gefühl statt mit dem Befund.
 *
 * Die Bewertung wird nicht aus dem Tippergebnis abgeleitet. Stimmt die Antwort
 * Zeichen für Zeichen (nach Normalisierung), sagt die App das — die Note wählt
 * trotzdem der Mensch. Bei Abweichung stehen eigene Antwort und Lösung
 * nebeneinander, und die Entscheidung liegt ganz beim Nutzer. Genau diese
 * Entscheidung ist der metakognitive Akt; sie darf nicht wegautomatisiert
 * werden.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDaten } from "../core/store.jsx";
import { normalisiere, formelStimmt } from "../core/text.js";
import { clozeTeile, kartenArt, richtungName, schritteVon, schrittBilanz } from "../core/model.js";
import {
  NOTEN, NOTEN_NAMEN, KONFIDENZ, vorschau, abstandLang, neuerZustand, istNeu,
} from "../core/fsrs.js";
import {
  baueSitzung, baueCramSitzung, wirksameRetention, tageBisPruefung, CRAM_AB_TAGEN,
} from "../core/warteschlange.js";
import { kalibrierung, kalibrierungInWorten } from "../core/kalibrierung.js";
import { sprich } from "../core/speech.js";
import { seitenFuerRichtung } from "../core/ton.js";
import Tonaufnahme from "../ui/Tonaufnahme.jsx";
import { anzahl } from "../core/util.js";
import { gehe } from "../App.jsx";
import {
  Knopf, SymbolKnopf, Symbol, Bild, Stern, Leer, useTastatur, useMerker,
} from "../ui/basis.jsx";
import { ModusRahmen } from "./gemeinsam.jsx";

/* ------------------------- Was gefragt, was gesucht --------------------- */

/**
 * Zerlegt eine Aufgabe in Frageseite und Lösung — je nach Kartenart und
 * Abfragerichtung.
 */
function aufgabeTeile(karte, richtung) {
  const art = kartenArt(karte);

  /* Mehrschritt: der Rechenweg wird Schritt für Schritt abgefragt. Eine
     Bewertung gibt es trotzdem nur einmal, am Ende — es ist eine Karte. */
  if (art === "mehrschritt") {
    const schritte = schritteVon(karte);
    return {
      art: "mehrschritt", schritte,
      frage: karte.term, frageBild: karte.termImage,
      loesung: schritte.map((s) => s.antwort).join("\n"),
    };
  }

  if (art === "cloze" && richtung.startsWith("c")) {
    const nummer = Number(richtung.slice(1)) || 1;
    const stuecke = clozeTeile(karte.term);
    const gesucht = stuecke.find((s) => s.art === "luecke" && s.nummer === nummer);
    return {
      art: "cloze", stuecke, luecke: nummer,
      frageBild: karte.termImage,
      loesung: gesucht ? gesucht.text : "",
      zusatz: karte.definition,          // Erläuterung auf der Rückseite
    };
  }

  if (richtung === "dt") {
    return { art, frage: karte.definition, frageBild: karte.defImage,
      loesung: karte.term, loesungBild: karte.termImage };
  }
  return { art, frage: karte.term, frageBild: karte.termImage,
    loesung: karte.definition, loesungBild: karte.defImage };
}

/** Lückentext anzeigen — die gesuchte Lücke verdeckt, die übrigen offen. */
function ClozeText({ stuecke, luecke, aufgedeckt, eingabe }) {
  return (
    <div className="frage-text lang" style={{ lineHeight: 1.9 }}>
      {stuecke.map((s, i) => {
        if (s.art === "text") return <span key={i}>{s.text}</span>;
        if (s.nummer !== luecke)
          return <span key={i} style={{ opacity: 0.75 }}>{s.text}</span>;
        return (
          <span key={i} style={{
            borderBottom: "2px solid var(--akzent)",
            padding: "0 8px", margin: "0 2px",
            color: aufgedeckt ? "var(--gruen)" : "var(--schrift-blass)",
            fontWeight: aufgedeckt ? 600 : 400,
          }}>
            {aufgedeckt ? s.text : (eingabe || "…")}
          </span>
        );
      })}
    </div>
  );
}

/* --------------------------------- Modus -------------------------------- */

export default function Abrufen({ fachId = null, aufSchliessen }) {
  const daten = useDaten();
  const {
    karten, zustaende, stapelVon, faecher, fachVon, einstellungen,
    abrufVerbuchen, karteAendern, sitzungMerken,
  } = daten;

  const fach = fachId ? fachVon(fachId) : null;
  const [sitzung, setSitzung] = useState(null);
  const [stelle, setStelle] = useState(0);
  const [phase, setPhase] = useState("konfidenz");   // konfidenz | tippen | aufgedeckt
  const [konfidenz, setKonfidenz] = useState(null);
  const [eingabe, setEingabe] = useState("");
  const [ergebnisse, setErgebnisse] = useState([]);
  const [fertig, setFertig] = useState(false);
  // Verschachteln: mehrere Fächer in einer Sitzung, Herkunft verborgen (§3.5).
  const [gewaehlteFaecher, setGewaehlteFaecher] = useMerker("interleaving:faecher", []);
  const [herkunftVerbergen, setHerkunftVerbergen] = useMerker("interleaving:verbergen", true);
  const [gestartet, setGestartet] = useState(Boolean(fachId));
  // Mehrschritt-Karten: welcher Schritt ist dran, und wie lief es bisher?
  const [schrittNr, setSchrittNr] = useState(0);
  const [schrittErgebnisse, setSchrittErgebnisse] = useState([]);
  const feld = useRef(null);
  const beginn = useRef(Date.now());

  const faecherVon = useCallback(() => faecher, [faecher]);

  /* Endspurt: in den letzten Tagen vor dem Termin lässt sich der ganze Stoff
     durchgehen, ohne dass es den Plan verstellt. */
  const [cram, setCram] = useState(false);
  const restTage = tageBisPruefung(fach);
  const cramMoeglich = restTage !== null && restTage >= 0 && restTage <= CRAM_AB_TAGEN;

  const sitzungBauen = useCallback(() => (cram && fach
    ? baueCramSitzung({ karten, zustaende, stapelVon, fach, umfang: 40 })
    : baueSitzung({
      karten, zustaende, stapelVon, faecherVon, fach,
      faecherIds: fachId ? null : gewaehlteFaecher,
      umfang: Number(einstellungen.sitzungsUmfang) || 30,
    })), [karten, zustaende, stapelVon, faecherVon, fach, fachId, gewaehlteFaecher,
    einstellungen.sitzungsUmfang, cram]);

  /* Die Warteschlange wird einmal beim Betreten gebaut — was während der
     Sitzung fällig wird, kommt erst beim nächsten Mal dran. */
  useEffect(() => {
    if (!gestartet) return;
    setSitzung(sitzungBauen());
    setStelle(0); setPhase("konfidenz"); setKonfidenz(null); setEingabe("");
    setErgebnisse([]); setFertig(false);
    beginn.current = Date.now();
  }, [fachId, gestartet]);

  const aufgabe = sitzung?.aufgaben?.[stelle] || null;

  const teile = useMemo(
    () => (aufgabe ? aufgabeTeile(aufgabe.karte, aufgabe.richtung) : null),
    [aufgabe?.schluessel]);

  const zustand = aufgabe
    ? (zustaende[aufgabe.schluessel] ||
       neuerZustand(aufgabe.karte.id, aufgabe.richtung, aufgabe.karte.setId, aufgabe.fachId))
    : null;

  const zeitfenster = useMemo(
    () => (zustand ? vorschau(zustand, {
      zielRetention: wirksameRetention(fach),
      maximalTage: fach?.maximalTage ?? 3650,
    }) : null),
    [aufgabe?.schluessel, phase === "aufgedeckt"]);

  useEffect(() => {
    if (phase === "tippen") feld.current?.focus();
  }, [phase, stelle]);

  useEffect(() => { beginn.current = Date.now(); }, [stelle]);

  /* ------------------------------ Handgriffe ---------------------------- */

  const konfidenzWaehlen = (wert) => {
    if (phase !== "konfidenz") return;
    setKonfidenz(wert);
    setPhase("tippen");
  };

  const aufdecken = () => {
    if (phase !== "tippen") return;
    setPhase("aufgedeckt");
  };

  /* --------------------------- Mehrschritt-Karten ------------------------ */

  const istMehrschritt = teile?.art === "mehrschritt";
  const derSchritt = istMehrschritt ? teile.schritte[schrittNr] : null;

  /** Einen Zwischenschritt prüfen und zum nächsten gehen. */
  const schrittPruefen = () => {
    if (!derSchritt) return;
    const stimmt = formelStimmt(eingabe, derSchritt.antwort)
      || normalisiere(eingabe) === normalisiere(derSchritt.antwort);
    const neueErgebnisse = [...schrittErgebnisse, stimmt];
    setSchrittErgebnisse(neueErgebnisse);
    setEingabe("");
    if (schrittNr + 1 >= teile.schritte.length) setPhase("aufgedeckt");
    else setSchrittNr((n) => n + 1);
  };

  const schritteZuruecksetzen = () => {
    setSchrittNr(0);
    setSchrittErgebnisse([]);
  };

  const stimmtGenau = useMemo(() => {
    if (!teile) return false;
    if (teile.art === "mehrschritt") {
      const b = schrittBilanz(schrittErgebnisse);
      return b.alleRichtig;
    }
    if (!eingabe.trim()) return false;
    return normalisiere(eingabe) === normalisiere(teile.loesung);
  }, [eingabe, teile, schrittErgebnisse]);


  const bewerten = async (note) => {
    if (phase !== "aufgedeckt" || !aufgabe) return;
    const antwortzeit = Date.now() - beginn.current;
    await abrufVerbuchen({
      karte: aufgabe.karte, stapel: aufgabe.stapel, richtung: aufgabe.richtung,
      bewertung: note, konfidenz, antwortzeit,
      eingabeLeer: !eingabe.trim(), fach: fachVon(aufgabe.fachId),
      flag: cram ? "cram" : "normal", modus: cram ? "endspurt" : "abrufen",
    });
    setErgebnisse((alt) => [...alt, {
      schluessel: aufgabe.schluessel, note, konfidenz, stimmtGenau,
      frage: teile.frage || teile.stuecke?.map((s) => s.text).join(" ") || "",
      loesung: teile.loesung,
    }]);

    setEingabe(""); setKonfidenz(null); setPhase("konfidenz"); schritteZuruecksetzen();
    if (stelle + 1 >= sitzung.aufgaben.length) setFertig(true);
    else setStelle((s) => s + 1);
  };

  useTastatur({
    1: () => (phase === "konfidenz" ? konfidenzWaehlen(KONFIDENZ.SICHER) : bewerten(NOTEN.NOCHMAL)),
    2: () => (phase === "konfidenz" ? konfidenzWaehlen(KONFIDENZ.UNSICHER) : bewerten(NOTEN.SCHWER)),
    3: () => (phase === "konfidenz" ? konfidenzWaehlen(KONFIDENZ.KEINE_AHNUNG) : bewerten(NOTEN.GUT)),
    4: () => phase === "aufgedeckt" && bewerten(NOTEN.LEICHT),
    " ": { auchBeimTippen: true, fn: () => phase === "tippen" && aufdecken() },
    Enter: { auchBeimTippen: true, fn: () => {
      if (phase === "tippen") { if (istMehrschritt) schrittPruefen(); else aufdecken(); }
      else if (phase === "aufgedeckt") bewerten(stimmtGenau ? NOTEN.GUT : NOTEN.NOCHMAL);
    } },
  }, Boolean(aufgabe) && !fertig);

  useEffect(() => {
    if (!fertig || !ergebnisse.length) return;
    sitzungMerken({
      setId: null, subjectId: fachId, modus: "abrufen",
      gesamt: ergebnisse.length,
      richtig: ergebnisse.filter((e) => e.note >= NOTEN.GUT).length,
      dauer: Date.now() - beginn.current,
    });
  }, [fertig]);

  /* ------------------------------- Anzeigen ----------------------------- */

  const titel = fach ? "Abrufen — " + fach.name : "Abrufen";

  /* Ohne Fachwahl: erst fragen, worüber. Das ist die einzige Wahl, die der
     Nutzer hat — welche Karten drankommen, entscheidet er nie. */
  if (!gestartet) {
    const bereit = gewaehlteFaecher.length > 0;
    const umschalten = (id) => setGewaehlteFaecher((alt) =>
      alt.includes(id) ? alt.filter((x) => x !== id) : [...alt, id]);

    return (
      <ModusRahmen titel="Abrufen" symbol="blitz" aufSchliessen={aufSchliessen}>
        <h1>Verschachtelt abrufen</h1>
        <p className="matt">
          Mehrere Fächer in einer Sitzung, gemischt und ohne Ankündigung, woher
          eine Frage kommt. Das ist mühsamer als ein Fach am Stück, und genau
          darum wirksamer: In der Prüfung steht auch nicht dabei, welches
          Verfahren gemeint ist.
        </p>

        {faecher.length === 0 ? (
          <Leer symbol="buch" titel="Noch keine Fächer"
            text="Lege zuerst Fächer an und ordne ihnen Stapel zu.">
            <Knopf art="voll" onClick={() => gehe("/faecher")}>Zu den Fächern</Knopf>
          </Leer>
        ) : (
          <>
            <label className="beschriftung" style={{ marginTop: 20 }}>Welche Fächer?</label>
            <div className="gitter" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
              {faecher.map((f) => {
                const an = gewaehlteFaecher.includes(f.id);
                return (
                  <button key={f.id} className={"antwort" + (an ? " richtig" : "")}
                    onClick={() => umschalten(f.id)}>
                    <span style={{ width: 10, height: 10, borderRadius: 3,
                      background: f.farbe || "var(--akzent)", display: "block", flex: "none" }} />
                    <span className="dehnen">{f.name}</span>
                    {an && <Symbol name="haken" groesse={16} />}
                  </button>
                );
              })}
            </div>

            <div className="reihe" style={{ marginTop: 10 }}>
              <Knopf art="klein leer"
                onClick={() => setGewaehlteFaecher(faecher.map((f) => f.id))}>
                Alle
              </Knopf>
              <Knopf art="klein leer" onClick={() => setGewaehlteFaecher([])}>Keins</Knopf>
            </div>

            <label className="schalter" style={{ marginTop: 16 }}>
              <input type="checkbox" checked={herkunftVerbergen}
                onChange={(e) => setHerkunftVerbergen(e.target.checked)} />
              <span>Herkunft verbergen
                <span className="klein blass">(Fach und Stapel erst nach der Antwort)</span>
              </span>
            </label>

            <Knopf art="voll gross" symbol="blitz" style={{ marginTop: 24 }}
              disabled={!bereit} onClick={() => setGestartet(true)}>
              Losgehen
            </Knopf>
          </>
        )}
      </ModusRahmen>
    );
  }

  if (!sitzung) {
    return <ModusRahmen titel={titel} symbol="blitz" aufSchliessen={aufSchliessen}>
      <div className="leerer-zustand">Stelle die Sitzung zusammen …</div>
    </ModusRahmen>;
  }

  if (!sitzung.aufgaben.length) {
    const nichtsFaellig = sitzung.faellig === 0 && sitzung.neu > 0;
    return (
      <ModusRahmen titel={titel} symbol="blitz" aufSchliessen={aufSchliessen}>
        <Leer symbol="haken" titel={nichtsFaellig ? "Für heute genug Neues" : "Nichts fällig"}
          text={nichtsFaellig
            ? `Das Tageslimit für neue Karten ist erreicht. ${anzahl(sitzung.neu, "Karte wartet", "Karten warten")} auf später, so bleibt die Menge tragbar.`
            : "Alle Karten sitzen im Plan. Komm wieder, wenn etwas fällig wird."}>
          <div className="reihe" style={{ justifyContent: "center", flexWrap: "wrap" }}>
            <Knopf onClick={() => gehe("/faecher")}>Zur Übersicht</Knopf>
            {cramMoeglich && (
              <Knopf art="voll" symbol="uhr" onClick={() => setCram(true)}>
                Endspurt, alles durchgehen
              </Knopf>
            )}
          </div>
          {cramMoeglich && (
            <p className="klein blass" style={{ maxWidth: 460, margin: "14px auto 0" }}>
              In {restTage === 0 ? "null" : restTage} Tagen ist deine Prüfung. Der
              Endspurt geht den ganzen Stoff durch, ohne Rücksicht auf Termine,
              und ohne den Plan zu verstellen: Was hier geschieht, zählt nicht
              als Wiederholung.
            </p>
          )}
        </Leer>
      </ModusRahmen>
    );
  }

  if (fertig) {
    const k = kalibrierung(ergebnisse.map((e) => ({
      flag: "normal", konfidenz: e.konfidenz, bewertung: e.note,
    })));
    const gewusst = ergebnisse.filter((e) => e.note >= NOTEN.GUT).length;
    return (
      <ModusRahmen titel={titel} symbol="blitz" aufSchliessen={aufSchliessen} anteil={1}>
        <div style={{ textAlign: "center", paddingTop: 20 }}>
          <div style={{ fontFamily: "var(--serifen)", fontSize: 52 }}>
            {gewusst}<span style={{ fontSize: 24 }}> / {ergebnisse.length}</span>
          </div>
          <h1 style={{ marginTop: 6 }}>Sitzung beendet</h1>
          <p className="matt">{kalibrierungInWorten(k)}</p>

          <div className="gitter" style={{ maxWidth: 620, margin: "24px auto",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
            {[[KONFIDENZ.SICHER, "sicher"], [KONFIDENZ.UNSICHER, "unsicher"],
              [KONFIDENZ.KEINE_AHNUNG, "keine Ahnung"]].map(([stufe, name]) => {
              const s = k.stufen[stufe];
              return (
                <div key={stufe} className="zahl-kachel">
                  <div className="klein matt">{name}</div>
                  <div className="zahl">{s.anzahl ? Math.round(s.quote * 100) + " %" : "—"}</div>
                  <div className="klein blass">{s.anzahl ? s.gewusst + " von " + s.anzahl : "nicht gesagt"}</div>
                </div>
              );
            })}
          </div>

          <div className="reihe" style={{ justifyContent: "center", flexWrap: "wrap" }}>
            <Knopf art="voll gross" symbol="blitz" onClick={() => {
              setSitzung(sitzungBauen()); setStelle(0); setPhase("konfidenz");
              setKonfidenz(null); setEingabe(""); setErgebnisse([]); setFertig(false);
            }}>Weiter abrufen</Knopf>
            <Knopf art="gross" onClick={() => gehe("/kalibrierung")}>Kalibrierung ansehen</Knopf>
            <Knopf art="gross" onClick={() => gehe("/faecher")}>Zur Übersicht</Knopf>
          </div>
        </div>
      </ModusRahmen>
    );
  }

  if (!aufgabe || !teile) {
    return <ModusRahmen titel={titel} symbol="blitz" aufSchliessen={aufSchliessen}>
      <div className="leerer-zustand">Einen Augenblick …</div>
    </ModusRahmen>;
  }

  const frisch = istNeu(zustaende[aufgabe.schluessel]);
  const sprache = aufgabe.richtung === "dt"
    ? aufgabe.stapel?.defLang : aufgabe.stapel?.termLang;

  return (
    <ModusRahmen titel={titel} symbol="blitz" aufSchliessen={aufSchliessen}
      anteil={stelle / sitzung.aufgaben.length}
      rechts={<>
        {cram && <span className="marke rot">Endspurt, zählt nicht für den Plan</span>}
        {frisch && !cram && <span className="marke">neu</span>}
        <span className="klein matt mono">{stelle + 1} / {sitzung.aufgaben.length}</span>
      </>}>

      {/* ------------------------------ Frage ------------------------------ */}
      <div className="frage-block" style={{ position: "relative" }}>
        <div className="klein blass">
          {/* Beim Verschachteln bleibt die Herkunft verdeckt, bis geantwortet
              ist — sonst verrät die Überschrift schon das Verfahren. */}
          {!fachId && herkunftVerbergen && phase !== "aufgedeckt" ? (
            <span style={{ fontStyle: "italic" }}>Woher diese Frage kommt, siehst du gleich</span>
          ) : (
            <>
              {aufgabe.fachId && fachVon(aufgabe.fachId)
                ? fachVon(aufgabe.fachId).name + " · " : ""}
              {aufgabe.stapel?.title}
              {" · "}
              {richtungName(aufgabe.richtung, aufgabe.stapel)}
            </>
          )}
        </div>

        {teile.art === "cloze" ? (
          <ClozeText stuecke={teile.stuecke} luecke={teile.luecke}
            aufgedeckt={phase === "aufgedeckt"} eingabe={eingabe} />
        ) : (
          <>
            {teile.frageBild && <Bild kennung={teile.frageBild} />}
            {teile.frage && (
              <div className={"frage-text" + (teile.frage.length > 90 ? " lang" : "")}>
                {teile.frage}
              </div>
            )}
          </>
        )}

        <div style={{ position: "absolute", top: 10, right: 12 }}>
          <SymbolKnopf symbol="laut" titel="Vorlesen"
            onClick={() => sprich(teile.frage || teile.loesung, sprache,
              einstellungen.sprechTempo)} />
          <Stern an={aufgabe.karte.starred}
            aufKlick={() => karteAendern(aufgabe.karte.id, { starred: !aufgabe.karte.starred })} />
        </div>
      </div>

      {/* --------------------------- Konfidenz ---------------------------- */}
      {phase === "konfidenz" && (
        <>
          <p className="matt klein" style={{ textAlign: "center", marginBottom: 10 }}>
            Ehe du antwortest: Wie sicher bist du dir?
          </p>
          <div className="gitter konfidenz-gitter">
            {[
              [KONFIDENZ.SICHER, "Sicher", "haken", "var(--gruen)"],
              [KONFIDENZ.UNSICHER, "Unsicher", "auge", "var(--gelb)"],
              [KONFIDENZ.KEINE_AHNUNG, "Keine Ahnung", "kreuz", "var(--rot)"],
            ].map(([wert, name, symbol, farbe]) => (
              <button key={wert} className="antwort" style={{ justifyContent: "center" }}
                onClick={() => konfidenzWaehlen(wert)}>
                <span className="ziffer">{wert}</span>
                <Symbol name={symbol} groesse={17} style={{ color: farbe }} />
                <span>{name}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ----------------------------- Tippen ----------------------------- */}
      {phase === "tippen" && istMehrschritt && (
        <>
          {/* Was schon steht, bleibt sichtbar — ein Rechenweg baut aufeinander auf. */}
          {schrittErgebnisse.length > 0 && (
            <div style={{ display: "grid", gap: 6, marginBottom: 14 }}>
              {teile.schritte.slice(0, schrittNr).map((s, i) => (
                <div key={i} className="reihe klein" style={{ gap: 8 }}>
                  <Symbol name={schrittErgebnisse[i] ? "haken" : "kreuz"} groesse={15}
                    style={{ color: schrittErgebnisse[i] ? "var(--gruen)" : "var(--rot)" }} />
                  <span className="matt">{s.frage || "Schritt " + (i + 1)}</span>
                  <span className="dehnen mono" style={{ textAlign: "right" }}>{s.antwort}</span>
                </div>
              ))}
            </div>
          )}

          <div className="klein matt" style={{ marginBottom: 6 }}>
            Schritt {schrittNr + 1} von {teile.schritte.length}
            {derSchritt?.frage ? " — " + derSchritt.frage : ""}
          </div>
          <input ref={feld} className="feld"
            style={{ fontSize: 19, padding: "14px 16px", fontFamily: "ui-monospace, monospace" }}
            placeholder="Diesen Schritt schreiben"
            value={eingabe} onChange={(e) => setEingabe(e.target.value)} />
          <div className="reihe" style={{ marginTop: 12 }}>
            <span className="klein blass nur-breit">
              Schreibweise ist egal: 2·x, 2*x und 2x gelten gleich.
            </span>
            <div className="dehnen" />
            <Knopf art="voll" onClick={schrittPruefen} disabled={!eingabe.trim()}>
              {schrittNr + 1 >= teile.schritte.length ? "Weg abschließen" : "Nächster Schritt"}
              <span className="tastenhilfe nur-breit">↵</span>
            </Knopf>
          </div>
        </>
      )}

      {phase === "tippen" && !istMehrschritt && (
        <>
          <input ref={feld} className="feld" style={{ fontSize: 19, padding: "14px 16px" }}
            placeholder="Antwort schreiben, dann Leertaste zum Aufdecken"
            value={eingabe} onChange={(e) => setEingabe(e.target.value)} />
          <div className="reihe" style={{ marginTop: 12 }}>
            <span className="klein blass nur-breit">
              Eingeschätzt als <strong>{konfidenz === 1 ? "sicher"
                : konfidenz === 2 ? "unsicher" : "keine Ahnung"}</strong>
            </span>
            <div className="dehnen" />
            <Knopf art="voll" onClick={aufdecken}>
              Aufdecken <span className="tastenhilfe nur-breit">Leertaste</span>
            </Knopf>
          </div>
        </>
      )}

      {/* ---------------------------- Aufgedeckt --------------------------- */}
      {phase === "aufgedeckt" && (
        <>
          {istMehrschritt ? (
            <div className={"rueckmeldung " + (stimmtGenau ? "gut" : "fast")}>
              <div className="reihe" style={{ marginBottom: 10 }}>
                <Symbol name={stimmtGenau ? "haken" : "auge"} />
                <strong>
                  {stimmtGenau
                    ? "Der ganze Weg stimmt"
                    : "Bis Schritt " + ((schrittBilanz(schrittErgebnisse).erstesFalsch ?? 0) + 1)
                      + " war es richtig"}
                </strong>
                <div className="dehnen" />
                <span className="klein matt">
                  {schrittBilanz(schrittErgebnisse).richtig} von {teile.schritte.length}
                </span>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {teile.schritte.map((s, i) => (
                  <div key={i} className="reihe klein" style={{ gap: 8, alignItems: "flex-start" }}>
                    <Symbol name={schrittErgebnisse[i] ? "haken" : "kreuz"} groesse={15}
                      style={{ color: schrittErgebnisse[i] ? "var(--gruen)" : "var(--rot)",
                        marginTop: 3 }} />
                    <div className="dehnen">
                      {s.frage && <div className="blass">{s.frage}</div>}
                      <div className="mono" style={{ fontSize: 15 }}>{s.antwort}</div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="klein matt" style={{ marginTop: 10, marginBottom: 0 }}>
                Ein Weg, der an einer Stelle kippt, ist nicht halb richtig,
                aber du siehst, wo. Bewerte danach.
              </p>
            </div>
          ) : (
          <div className={"rueckmeldung " + (stimmtGenau ? "gut" : "fast")}>
            {stimmtGenau ? (
              <div className="reihe">
                <Symbol name="haken" />
                <strong>Wort für Wort richtig</strong>
              </div>
            ) : (
              <div className="antwort-gitter" style={{ gap: 14 }}>
                <div>
                  <div className="klein matt">Deine Antwort</div>
                  <div style={{ fontSize: 17 }}>{eingabe.trim() || <em className="blass">nichts geschrieben</em>}</div>
                </div>
                <div>
                  <div className="klein matt">Lösung</div>
                  <div style={{ fontSize: 17 }}>{teile.loesung}</div>
                  {teile.loesungBild && <Bild kennung={teile.loesungBild}
                    klasse="" stil={{ maxHeight: 120, borderRadius: 8, marginTop: 6 }} />}
                </div>
              </div>
            )}
            {teile.zusatz && teile.art === "cloze" && (
              <div className="klein matt" style={{ marginTop: 10 }}>{teile.zusatz}</div>
            )}
            {aufgabe.karte.hint && (
              <div className="klein blass" style={{ marginTop: 6 }}>Hinweis: {aufgabe.karte.hint}</div>
            )}
          </div>
          )}

          {/* Erst hier, nie vorher: Die Loesung liegt offen, das Abrufen ist
              vorbei. Jetzt laut nachsprechen schadet nichts und praegt ein. */}
          <Tonaufnahme cardId={aufgabe.karte.id}
            seite={seitenFuerRichtung(aufgabe.richtung).loesung}
            autoAbspielen={einstellungen.eigeneStimmeAutomatisch} />

          <p className="matt klein" style={{ textAlign: "center", margin: "18px 0 10px" }}>
            Du entscheidest, ob es zählt.
          </p>
          <div className="gitter bewertung-gitter">
            {[
              [NOTEN.NOCHMAL, "var(--rot)"],
              [NOTEN.SCHWER, "var(--gelb)"],
              [NOTEN.GUT, "var(--akzent)"],
              [NOTEN.LEICHT, "var(--gruen)"],
            ].map(([note, farbe]) => (
              <button key={note} className="antwort"
                style={{ flexDirection: "column", gap: 4, alignItems: "center",
                  borderColor: stimmtGenau && note === NOTEN.GUT ? farbe : undefined }}
                onClick={() => bewerten(note)}>
                <span className="ziffer">{note}</span>
                <span style={{ color: farbe, fontWeight: 600 }}>{NOTEN_NAMEN[note]}</span>
                <span className="klein blass">
                  {zeitfenster ? abstandLang(zeitfenster[note]) : ""}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </ModusRahmen>
  );
}
