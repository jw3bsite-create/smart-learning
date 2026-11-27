/*
 * Karteikarten: durchblättern und umdrehen.
 *
 * Dazu die Selbsteinschätzung „Weiß ich“ / „Noch üben“ — sie geht in denselben
 * Lernstand ein wie die übrigen Modi, sodass sich Fächer und Wiederholungen
 * auch beim bloßen Durchblättern füllen.
 *
 * Seit dem 24. November 2026 kommt nicht mehr alles der Reihe nach: Was
 * falsch war oder nur langsam gewusst, kommt in derselben Sitzung wieder,
 * im Abstand nach der Erinnerungszeit (core/wiedervorlage.js). Gemessen wird
 * vom Erscheinen der Karte bis zum Umdrehen (ui/stoppuhr.js).
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { mische, anzahl } from "../core/util.js";
import { fortschrittAnteil } from "../core/fortschritt.js";
import { sprich } from "../core/speech.js";
import { seitenFuerRichtung } from "../core/ton.js";
import Tonaufnahme from "../ui/Tonaufnahme.jsx";
import { gehe } from "../App.jsx";
import { Knopf, SymbolKnopf, Symbol, Stern, Leer, useTastatur, HilfeLink } from "../ui/basis.jsx";
import KarteBearbeiten from "../ui/KarteBearbeiten.jsx";
import { useWischen } from "../ui/wischen.js";
import { useStoppuhr } from "../ui/stoppuhr.js";
import {
  sitzungBeginnen, antworten, zusammenfassung, zeitenAusVerlauf, stapelMedian, referenz, kappen,
} from "../core/wiedervorlage.js";
import {
  useModus, useBrauchbar, ModusRahmen, Seite, Ergebnis, ModusLeiste, Wahl, Hinweis, RICHTUNGEN, seitenFuer, sprachenFuer, LeerKnoepfe,
} from "./gemeinsam.jsx";

export default function Karteikarten({ setId, aufSchliessen }) {
  const { derStapel, karten, karteAendern, antwortVerbuchen, einstellungen, sitzungMerken, reviews } = useModus(setId);
  /*
   * Die Stelle im Stapel bleibt (UX-Bericht, 27.11.2026): wie bei „Lernen“
   * je Stapel im Gerät gemerkt — Reihenfolge, Wiedervorlagen, Balken und
   * die Abfrage-Einstellungen. Hat sich die Auswahl der Karten geändert,
   * beginnt es neu (siehe `wvAuswahl` unten); ist der Stapel durch, wird
   * vergessen.
   */
  const speicher = "kk:karteikarten:" + setId;
  const [gespeichert] = useState(() => {
    try { return JSON.parse(localStorage.getItem(speicher)) || null; } catch (e) { return null; }
  });
  const [richtung, setRichtung] = useState(gespeichert?.richtung || "td");
  const [nurMarkierte, setNurMarkierte] = useState(Boolean(gespeichert?.nurMarkierte));
  const [gemischt, setGemischt] = useState(Boolean(gespeichert?.gemischt));
  const [stelle, setStelle] = useState(gespeichert?.stelle || 0);
  const [urteile, setUrteile] = useState(gespeichert?.urteile || []);   // für den Balken oben
  const [gedreht, setGedreht] = useState(false);
  const [selbstlauf, setSelbstlauf] = useState(false);
  const [problemBearbeitet, setProblemBearbeitet] = useState(null);
  const [fertig, setFertig] = useState(false);
  const [bearbeitet, setBearbeitet] = useState(false);
  /* Der Klick darf die Karte nicht umdrehen — er gilt dem Stift. */
  const bearbeitenOeffnen = (e) => { e?.stopPropagation?.(); setSelbstlauf(false); setBearbeitet(true); };
  const uhr = useRef(null);

  const brauchbare = useBrauchbar(karten, nurMarkierte);
  const nachId = useMemo(() => new Map(brauchbare.map((k) => [k.id, k])), [brauchbare]);

  /* Die Sitzung: welche Karte wann kommt (core/wiedervorlage.js). Neu
     begonnen nur, wenn sich die Auswahl ändert — nicht, wenn eine Karte
     markiert oder bearbeitet wird, sonst finge man von vorn an. */
  const auswahl = brauchbare.map((k) => k.id).join(",") + (gemischt ? ":gemischt" : "");
  const neueSitzung = () => sitzungBeginnen((gemischt ? mische(brauchbare) : brauchbare).map((k) => k.id));
  /* Gemerkt war die Auswahl von damals: Stimmt sie nicht mehr, greift
     gleich unten der Neubeginn. */
  const [wv, setWv] = useState(() => (gespeichert?.wv?.folge?.length ? gespeichert.wv : neueSitzung()));
  const [wvAuswahl, setWvAuswahl] = useState(gespeichert?.wv ? gespeichert.auswahl : auswahl);
  if (wvAuswahl !== auswahl) {
    setWvAuswahl(auswahl); setWv(neueSitzung()); setStelle(0); setGedreht(false); setFertig(false);
    setUrteile([]);
  }

  useEffect(() => {
    try {
      if (fertig) localStorage.removeItem(speicher);
      else localStorage.setItem(speicher, JSON.stringify({ auswahl, gemischt, richtung, nurMarkierte, wv, stelle, urteile }));
    } catch (e) { /* voll oder gesperrt: dann eben nicht */ }
  }, [fertig, auswahl, gemischt, richtung, nurMarkierte, wv, stelle, urteile]);
  const eintrag = wv.folge[stelle];
  const karte = eintrag ? nachId.get(eintrag.id) : null;
  const reihe = brauchbare;

  /* „Zufällig je Karte“: Jede Karte zeigt zufällig ihre Vorder- oder ihre
     Rückseite zuerst. Ausgelost einmal je Durchgang, damit eine Karte beim
     Zurückblättern dieselbe Seite zeigt. Mit „Mischen“ ist dann beides
     zufällig, Reihenfolge und Seite. */
  const los = useMemo(() => new Map(reihe.map((k) => [k.id, Math.random() < 0.5 ? "td" : "dt"])),
    [auswahl, richtung]);
  const aktiv = richtung === "beide" ? (karte && los.get(karte.id)) || "td" : richtung;

  const seiten = karte ? seitenFuer(karte, aktiv) : null;
  const sprachen = sprachenFuer(derStapel, aktiv);

  /* Die Erinnerungszeit: läuft, sobald die Vorderseite steht, hält beim
     ersten Umdrehen an (ui/stoppuhr.js). */
  const stoppuhr = useStoppuhr();
  const gemessen = useRef(null);
  useEffect(() => { gemessen.current = null; stoppuhr.starten(); }, [stelle, wv]);
  useEffect(() => { if (gedreht && gemessen.current === null) gemessen.current = stoppuhr.anhalten(); }, [gedreht]);
  const zeiten = useMemo(() => zeitenAusVerlauf(reviews, setId), [reviews, setId]);

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

  const weiter = (laenge = wv.folge.length) => {
    setGedreht(false);
    if (stelle + 1 >= laenge) setFertig(true);
    else setStelle(stelle + 1);
  };

  const zurueck = () => {
    setGedreht(false);
    setStelle((s) => Math.max(0, s - 1));
  };

  /* Bewertet: verbuchen, und die Sitzung entscheidet, ob und wann die Karte
     wiederkommt. Ohne Umdrehen gilt die Zeit bis zur Bewertung. */
  const urteilen = (kann) => {
    if (!karte) return;
    setUrteile((alt) => [...alt, { schluessel: karte.id, richtig: kann }]);
    const roh = gemessen.current ?? stoppuhr.anhalten();
    const stapelMs = stapelMedian(zeiten.stapel);
    const zeitMs = Math.round(kappen(roh, stapelMs));
    antwortVerbuchen(karte, aktiv, kann ? 2 : 0, { erinnerungszeit: zeitMs, modus: "karten" });
    const { sitzung } = antworten(wv, stelle, {
      richtig: kann, zeitMs, stapelMs, referenzMs: referenz(zeiten.jeKarte.get(karte.id) || [], stapelMs),
    });
    setWv(sitzung);
    weiter(sitzung.folge.length);
  };

  useTastatur({
    " ": () => setGedreht((g) => !g),
    ArrowRight: () => weiter(),
    ArrowLeft: zurueck,
    ArrowUp: () => urteilen(true),
    ArrowDown: () => urteilen(false),
    s: () => karte && karteAendern(karte.id, { starred: !karte.starred }),
    e: () => { if (karte) bearbeitenOeffnen(); },
    a: () => karte && sprich(gedreht ? seiten.antwort : seiten.frage,
      gedreht ? sprachen.antwort : sprachen.frage, einstellungen.sprechTempo),
  }, Boolean(karte) && !fertig);

  /* Wischen wie bei Quizlet: rechts „Weiß ich“, links „Noch üben“. */
  const wisch = useWischen({
    rechts: () => urteilen(true), links: () => urteilen(false),
    aktiv: Boolean(karte) && !fertig && !bearbeitet,
  });

  useEffect(() => {
    if (!fertig) return;
    const z = zusammenfassung(wv);
    if (!z.ersteGesamt) return;
    sitzungMerken({ setId, modus: "karten", gesamt: z.ersteGesamt, richtig: z.ersteRichtig });
  }, [fertig]);

  if (!brauchbare.length) {
    return (
      <ModusRahmen titel="Karteikarten" symbol="stapel" aufSchliessen={aufSchliessen}>
        <Leer titel="Keine Karten zum Durchblättern"
          text={nurMarkierte ? ""
            : "Der Stapel braucht Karten mit Vorder- und Rückseite."}>
          <LeerKnoepfe setId={setId} nurMarkierte={nurMarkierte} aufAlle={() => setNurMarkierte(false)} />
        </Leer>
      </ModusRahmen>
    );
  }

  if (fertig) {
    const z = zusammenfassung(wv);
    const mittel = z.mittel[0];
    return (
      <ModusRahmen titel="Karteikarten" symbol="stapel" aufSchliessen={aufSchliessen}>
        {problemBearbeitet && (
          <KarteBearbeiten karte={problemBearbeitet} aufSchliessen={() => setProblemBearbeitet(null)} />
        )}
        <Ergebnis titel="Stapel durchgesehen" setId={setId}
          richtig={z.ersteRichtig} gesamt={z.ersteGesamt || reihe.length}
          aufNochmal={() => {
            setWv(neueSitzung()); setStelle(0); setGedreht(false); setFertig(false); setUrteile([]);
          }}
          aufWeiter={z.fehler > 0
            ? <Knopf art="gross" symbol="ziel"
                onClick={() => gehe("/stapel/" + setId + "/lernen")}>Schwache üben</Knopf>
            : null}>
          <p className="klein matt oben-8">
            {anzahl(z.fehler, "Fehler", "Fehler")}
            {z.wiedervorlagen > 0 && " · " + anzahl(z.wiedervorlagen, "Wiedervorlage", "Wiedervorlagen")}
            {mittel && " · im Schnitt " + (mittel.ms / 1000).toFixed(1).replace(".", ",") + " s bis zum Umdrehen"}
          </p>
          {z.problem.length > 0 && (
            <div className="rueckmeldung schlecht oben-16" style={{ textAlign: "left" }}>
              <strong>{z.problem.length === 1 ? "Eine Problemkarte" : z.problem.length + " Problemkarten"}</strong>
              <div className="klein matt oben-4 unten-8">
                Viermal falsch in dieser Sitzung. Oft hilft es, sie umzuformulieren oder in zwei Karten
                zu teilen.
              </div>
              <div className="liste">
                {z.problem.map((id) => nachId.get(id)).filter(Boolean).map((k) => (
                  <button key={k.id} type="button" className="listenzeile" onClick={() => setProblemBearbeitet(k)}>
                    <span className="dehnen">{k.term}</span>
                    <Symbol name="stift" groesse={15} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </Ergebnis>
      </ModusRahmen>
    );
  }

  /* Die Folge wächst mit den Wiedervorlagen — der Balken und die Zahl
     rechnen mit der ganzen Folge, nicht nur mit dem Stapel. */
  /* Der Balken zeigt, was sitzt: „Weiß ich“ ganz, „Noch üben“ halb, je
     Karte nur ihr bester Stand (core/fortschritt.js). */
  const anteil = fortschrittAnteil(urteile, new Set(wv.folge.map((e) => e.id)).size);
  const offeneWieder = wv.folge.slice(stelle + 1).filter((e) => e.grund !== "erst").length;

  return (
    <ModusRahmen titel="Karteikarten" symbol="stapel" aufSchliessen={aufSchliessen} anteil={anteil}
      rechts={<>
        <SymbolKnopf symbol={selbstlauf ? "uhr" : "weiter"} art={selbstlauf ? "klein voll" : "leer klein"}
          titel={selbstlauf ? "Selbstlauf beenden" : "Von allein weiterblättern"}
          onClick={() => setSelbstlauf((x) => !x)} />
        <SymbolKnopf symbol="mischen" art={gemischt ? "klein voll" : "leer klein"}
          titel="Mischen" onClick={() => { setGemischt((x) => !x); setStelle(0); setGedreht(false); }} />
        <span className="klein matt mono"
          title={offeneWieder ? anzahl(offeneWieder, "Wiedervorlage folgt", "Wiedervorlagen folgen") : undefined}>
          {stelle + 1} / {wv.folge.length}
        </span>
      </>}>
      {bearbeitet && karte && (
        <KarteBearbeiten karte={karte} aufSchliessen={() => setBearbeitet(false)} />
      )}

      <ModusLeiste>
        <Wahl beschriftung="Abfrage" wert={richtung} setzen={(w) => { setRichtung(w); setGedreht(false); }}
          moeglichkeiten={RICHTUNGEN(derStapel).map(([w, name]) =>
            [w, w === "beide" ? "Zufällig je Karte" : name])} />
        <label className="reihe klein matt" style={{ gap: 6, cursor: "pointer" }}>
          <input type="checkbox" checked={nurMarkierte}
            onChange={(e) => { setNurMarkierte(e.target.checked); setStelle(0); setGedreht(false); }} />
          Nur Markierte
        </label>
        <div className="dehnen" />
        <HilfeLink frage="karteikarten" titel="Wie funktionieren die Karteikarten?" />
      </ModusLeiste>

      <div className="karten-buehne">
        <div className="karte-wisch" style={wisch.stil} {...wisch.griffe}>
        {wisch.anteil !== 0 && (
          <div className={"wisch-marke " + (wisch.anteil > 0 ? "gut" : "ueben")}
            style={{ opacity: Math.min(1, Math.abs(wisch.anteil) * 1.4) }}>
            {wisch.anteil > 0 ? "Weiß ich" : "Noch üben"}
          </div>
        )}
        {/* Je Karte neu aufgebaut: Sonst dreht sich die Karte beim Weiterblättern
            sichtbar zurück, und für einen Augenblick steht die Antwort der
            nächsten Karte auf ihrer Rückseite. */}
        <div key={karte.id + ":" + stelle} className={"karte-gross" + (gedreht ? " gedreht" : "")}
          onClick={() => setGedreht((g) => !g)}>
          <div className="karte-seite">
            {eintrag?.grund !== "erst" && (
              <span className="wieder-marke" title={eintrag.grund === "falsch"
                ? "Kommt wieder, weil sie eben falsch war" : "Kommt zur Festigung noch einmal"}>
                <Symbol name="zurueckSetzen" groesse={13} />
                {eintrag.grund === "falsch" ? "noch einmal" : "zur Festigung"}
              </span>
            )}
            <div className="karte-ecke">{aktiv === "dt"
              ? (derStapel.defLabel || "Rückseite") : (derStapel.termLabel || "Vorderseite")}</div>
            <Seite text={seiten.frage} bild={seiten.frageBild} sprache={sprachen.frage}
              klasse="karte-text" />
            {gedreht === false && <Hinweis text={karte.hint} />}
            <div className="karte-werkzeuge">
              <SymbolKnopf symbol="stift" titel="Karte bearbeiten (E)" onClick={bearbeitenOeffnen} />
              <Stern an={karte.starred} aufKlick={() => karteAendern(karte.id, { starred: !karte.starred })} />
            </div>
          </div>
          <div className="karte-seite rueck">
            <div className="karte-ecke">{aktiv === "dt"
              ? (derStapel.termLabel || "Vorderseite") : (derStapel.defLabel || "Rückseite")}</div>
            <Seite text={seiten.antwort} bild={seiten.antwortBild} sprache={sprachen.antwort}
              klasse="karte-text" />
            {/* Der Stern auch hier: Ob eine Karte markiert gehört, merkt man
                oft erst beim Blick auf die Antwort. */}
            <div className="karte-werkzeuge">
              <SymbolKnopf symbol="stift" titel="Karte bearbeiten (E)" onClick={bearbeitenOeffnen} />
              <Stern an={karte.starred} aufKlick={() => karteAendern(karte.id, { starred: !karte.starred })} />
            </div>
            {/* Die Rueckseite ist aufgedeckt — hier darf gesprochen werden. */}
            <Tonaufnahme knapp
              cardId={karte.id}
              seite={seitenFuerRichtung(aktiv).loesung}
              autoAbspielen={gedreht && einstellungen.eigeneStimmeAutomatisch} />
          </div>
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
          onClick={() => weiter()} />
      </div>

      <p className="klein blass" style={{ textAlign: "center", marginTop: 18 }}>
        {wv.verlauf.filter((v) => v.richtig).length} richtig ·
        {" " + wv.verlauf.filter((v) => !v.richtig).length} falsch
        {offeneWieder > 0 && " · " + anzahl(offeneWieder, "kommt noch einmal", "kommen noch einmal")}
      </p>
    </ModusRahmen>
  );
}
