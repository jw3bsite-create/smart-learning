/*
 * Abrufen oben im Stapel und auf der Startseite.
 *
 * Im Stapel (Einstellung „Oben im Stapel: Abrufen“, 25.11.2026): die erste
 * Frage des Stapels mit „Wie sicher bist du dir?“; ein Tipp darauf führt ins
 * Abrufen des Stapels, mit dieser Karte zuerst und der Einschätzung gesetzt.
 *
 * Auf der Startseite ist es seit dem 27.11.2026 ein vollwertiger kleiner
 * Abruf — der „Lernsnack“ (Wort des Nutzers): Einschätzung, Antwort tippen,
 * aufdecken, bewerten, und zwar **hier**, ohne Sprung. Bewertet wird ganz
 * normal verbucht (FSRS, Strähne, Kalibrierung); eine Karte nur anzusehen,
 * ohne dass es zählt, wäre genau das Erleichtern, das der Leitsatz verbietet.
 * Wie viele Karten ein Snack hat, wählt der Nutzer (5/10/20/ohne Ende) —
 * Umfang, keine Auswahl (Regel 7).
 *
 * Alle drei Zustände stehen in denselben zwei Kästen: Das „Blatt“ ist so
 * hoch wie das Längere von Frage und Lösung, die Handlungszeile immer gleich
 * hoch. So springt beim Umschalten nichts (Wunsch des Nutzers, 27.11.2026).
 *
 * Welche Karten kommen, entscheidet wie immer der Plan (`baueSitzung`), auf
 * der Startseite gewichtet nach der Nähe der Klausuren.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useDaten } from "../core/store.jsx";
import { baueSitzung } from "../core/warteschlange.js";
import { gewichtNachKlausur } from "../core/klausuren.js";
import { seitenFuer } from "../core/kartenseiten.js";
import { KONFIDENZ, NOTEN, NOTEN_NAMEN } from "../core/fsrs.js";
import { gleichwertig } from "../core/text.js";
import { anzahl } from "../core/util.js";
import { gehe } from "../App.jsx";
import { wachsend } from "./uebergang.js";
import { Symbol, Sinnbild, Knopf, Bild, Menue, MenuePunkt, useMerker } from "./basis.jsx";
import Formel from "./Formel.jsx";

/*
 * Die Frage auf der Startseite wechselt nicht bei jedem Blick dorthin,
 * sondern frühestens nach einer halben Minute (Nutzer, 27.11.2026): Wer
 * zwischen Start und Stapel hin und her geht, soll dieselbe Frage
 * wiederfinden. Die Wahl steht hier neben der Komponente, damit sie den
 * Wechsel der Seite übersteht; ein Neuladen setzt sie zurück.
 */
const WAHL_GILT = 30000;
const wahl = { schluessel: null, zeit: 0 };

/* Länger als eine Minute vor einer Karte zu sitzen heißt: Es lief etwas
   anderes nebenher. Solche Zeiten verderben die Mediane (Fallstrick 70). */
const ZEIT_GRENZE = 60000;

const STUFEN = [
  [KONFIDENZ.SICHER, "Sicher", "haken", "var(--gruen)"],
  [KONFIDENZ.UNSICHER, "Unsicher", "auge", "var(--gelb)"],
  [KONFIDENZ.KEINE_AHNUNG, "Keine Ahnung", "kreuz", "var(--rot)"],
];

const NOTEN_FARBEN = {
  [NOTEN.NOCHMAL]: "var(--rot)",
  [NOTEN.SCHWER]: "var(--gelb)",
  [NOTEN.GUT]: "var(--akzent)",
  [NOTEN.LEICHT]: "var(--gruen)",
};

/* Wie viele Karten ein Snack hat. 0 heißt: ohne Ende. */
const SNACK_GROESSEN = [[5, "Klein · 5"], [10, "Mittel · 10"], [20, "Groß · 20"], [0, "Ohne Ende"]];

export default function AbrufEinstieg({ setId = null, derStapel = null, auswahlFach = null, startseite = false }) {
  if (startseite) return <Lernsnack />;
  return <StapelEinstieg setId={setId} derStapel={derStapel} auswahlFach={auswahlFach} />;
}

/* ------------------------------ Im Stapel ------------------------------ */

/** Oben im Stapel: die erste Frage, ein Tipp führt ins Abrufen des Stapels. */
function StapelEinstieg({ setId, derStapel, auswahlFach }) {
  const { karten, zustaende, faecher, fachVon } = useDaten();
  const fach = derStapel ? fachVon(derStapel.subjectId) : null;
  const gemerkt = useRef(null);

  const sitzung = useMemo(() => (fach ? baueSitzung({
    karten, zustaende, fach,
    stapelVon: (id) => (id === setId ? derStapel : null),
    faecherVon: () => faecher, umfang: 100000,
  }) : null), [karten, zustaende, setId, derStapel, fach]);

  const aufgaben = sitzung?.aufgaben || [];
  const aufgabe = aufgaben.find((a) => a.schluessel === gemerkt.current) || aufgaben[0] || null;
  gemerkt.current = aufgabe?.schluessel || null;

  const weg = "/abrufen/" + derStapel.subjectId + "/stapel/" + setId;
  const seiten = aufgabe ? seitenFuer(aufgabe.karte, aufgabe.richtung) : null;
  const insAbrufen = (konfidenz) =>
    gehe(weg + "/start/" + encodeURIComponent(aufgabe.schluessel) + (konfidenz ? "/" + konfidenz : ""));

  return (
    <div className="kachel abruf-einstieg">
      <div className="reihe unten-8" style={{ gap: 8 }}>
        <Sinnbild name="blitz" ton="blau" />
        <span className="dehnen klein matt">
          Abrufen{aufgabe ? " · " + anzahl(aufgaben.length, "Karte steht an", "Karten stehen an") : ""}
        </span>
        {auswahlFach}
      </div>

      {aufgabe ? (
        <>
          <div className="abruf-einstieg-frage">
            {seiten.frageBild && <Bild kennung={seiten.frageBild} />}
            {seiten.frage && <div className={"frage-text" + (seiten.frage.length > 90 ? " lang" : "")}>
              <Formel text={seiten.frage} /></div>}
          </div>
          <p className="matt klein" style={{ textAlign: "center", margin: "4px 0 10px" }}>
            Wie sicher bist du dir?
          </p>
          <div className="gitter konfidenz-gitter">
            {STUFEN.map(([wert, name, symbol, farbe]) => (
              <button key={wert} type="button" className="antwort" style={{ justifyContent: "center" }}
                onClick={() => insAbrufen(wert)}>
                <Symbol name={symbol} groesse={17} style={{ color: farbe }} />
                <span>{name}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="reihe" style={{ gap: 10, flexWrap: "wrap" }}>
          <span className="dehnen matt">Nichts fällig in diesem Stapel.</span>
          <Knopf art="klein" symbol="blitz" onClick={() => gehe(weg)}>Trotzdem abrufen</Knopf>
        </div>
      )}
    </div>
  );
}

/* ----------------------------- Der Lernsnack ---------------------------- */

function Lernsnack() {
  const {
    karten, zustaende, faecher, fachVon, stapelVon, stapel, ordner, abrufVerbuchen,
  } = useDaten();
  const gewicht = useMemo(() => gewichtNachKlausur(faecher, stapel, ordner), [faecher, stapel, ordner]);
  const gemerkt = useRef(null);

  const [groesse, setGroesse] = useMerker("snackGroesse", 5);
  const [erledigt, setErledigt] = useState(() => new Set());   // in diesem Snack bewertet
  const [geschafft, setGeschafft] = useState(0);
  const [phase, setPhase] = useState("konfidenz");             // konfidenz | tippen | aufgedeckt
  const [konfidenz, setKonfidenz] = useState(null);
  const [eingabe, setEingabe] = useState("");
  const beginn = useRef(Date.now());
  const erinnert = useRef(null);
  const bewertet = useRef(false);
  const unterwegs = useRef(false);
  const feld = useRef(null);

  const sitzung = useMemo(() => baueSitzung({
    karten, zustaende, stapelVon, faecherVon: () => faecher, umfang: 100000, gewicht,
  }), [karten, zustaende, stapelVon, faecher, gewicht]);

  const aufgaben = (sitzung?.aufgaben || []).filter((a) => !erledigt.has(a.schluessel));
  const bei = (k) => (k ? aufgaben.find((a) => a.schluessel === k) : null);
  /* Erst die Frage, die hier schon steht; sonst die zuletzt gewählte,
     solange sie noch gilt; sonst die nächste aus dem Plan. */
  const voll = groesse > 0 && geschafft >= groesse;
  const aufgabe = voll ? null
    : bei(gemerkt.current)
      || (Date.now() - wahl.zeit < WAHL_GILT ? bei(wahl.schluessel) : null)
      || aufgaben[0] || null;
  if (aufgabe && aufgabe.schluessel !== wahl.schluessel) {
    wahl.schluessel = aufgabe.schluessel;
    wahl.zeit = Date.now();
  }
  /* Neue Karte: die Uhr läuft ab jetzt. */
  if (aufgabe && aufgabe.schluessel !== gemerkt.current) {
    gemerkt.current = aufgabe.schluessel;
    beginn.current = Date.now();
    erinnert.current = null;
  }
  if (!aufgabe) gemerkt.current = null;

  /* Nach dem Aufdecken steht der Zeiger im Feld — tippen, ohne zu zielen. */
  useEffect(() => { if (phase === "tippen") feld.current?.focus(); }, [phase, aufgabe?.schluessel]);

  const seiten = aufgabe ? seitenFuer(aufgabe.karte, aufgabe.richtung) : null;
  const stimmtGenau = Boolean(aufgabe && eingabe.trim() && seiten.antwort
    && gleichwertig(eingabe, seiten.antwort));

  /* Ins große Abrufen — mit dieser Karte und, wenn schon gewählt, der
     Einschätzung. Ein Tipp irgendwo auf die Kachel tut das; Knöpfe und das
     Feld tun, was auf ihnen steht. */
  const insAbrufen = () => {
    if (unterwegs.current) return;
    unterwegs.current = true;
    const k = konfidenz;
    wachsend(() => gehe("/abrufen/alle"
      + (aufgabe ? "/start/" + encodeURIComponent(aufgabe.schluessel) + (k ? "/" + k : "") : "")));
  };
  const tippen = (e) => { if (!e.target.closest("button, input, a, textarea")) insAbrufen(); };

  const weiterZurNaechsten = () => {
    setPhase("konfidenz"); setKonfidenz(null); setEingabe("");
    bewertet.current = false;
    beginn.current = Date.now();
    erinnert.current = null;
  };

  const aufdecken = () => {
    if (phase !== "tippen") return;
    erinnert.current = Date.now() - beginn.current;
    setPhase("aufgedeckt");
  };

  const bewerten = async (note) => {
    if (phase !== "aufgedeckt" || !aufgabe || bewertet.current) return;
    bewertet.current = true;
    const zeit = Date.now() - beginn.current;
    const schluessel = aufgabe.schluessel;
    await abrufVerbuchen({
      karte: aufgabe.karte, stapel: aufgabe.stapel, richtung: aufgabe.richtung,
      bewertung: note, konfidenz, antwortzeit: zeit,
      erinnerungszeit: erinnert.current !== null && erinnert.current < ZEIT_GRENZE ? erinnert.current : null,
      eingabeLeer: !eingabe.trim(), fach: fachVon(aufgabe.fachId),
      flag: "normal", modus: "abrufen",
    });
    /* Auch Falsches kommt nicht gleich wieder — sonst stünde dieselbe Karte
       sofort erneut da. Im großen Abrufen regelt das die Wiedervorlage. */
    setErledigt((alt) => new Set(alt).add(schluessel));
    setGeschafft((n) => n + 1);
    gemerkt.current = null;
    weiterZurNaechsten();
  };

  /* Der Snack ist voll, oder es steht nichts mehr an. */
  if (!aufgabe) {
    if (!geschafft && !aufgaben.length) return null;    // dann der übliche Knopf der Startseite
    return (
      <div className="kachel abruf-einstieg auf-start">
        <div className="reihe" style={{ gap: 10, flexWrap: "wrap" }}>
          <span className="dehnen">
            <strong>{geschafft > 0 ? anzahl(geschafft, "Karte", "Karten") + " geschafft" : "Alles durch"}</strong>
            {aufgaben.length > 0 && <span className="klein matt"> · {aufgaben.length} warten noch</span>}
          </span>
          {aufgaben.length > 0 && (
            <Knopf art="klein" onClick={() => { setGeschafft(0); weiterZurNaechsten(); }}>Weiter</Knopf>
          )}
          <Knopf art="klein voll" symbol="blitz" onClick={() => gehe("/abrufen/alle")}>Groß abrufen</Knopf>
        </div>
      </div>
    );
  }

  /* Die eigene Antwort steht in der Kopfzeile — im Blatt ließe sie es beim
     Tippen wachsen, und genau das soll nicht sein. */
  const kopf = phase === "konfidenz" ? "Wie sicher bist du dir?"
    : phase === "tippen" ? "Antwort eintippen"
      : eingabe.trim() ? "Du: " + eingabe + (stimmtGenau ? " · stimmt genau" : "")
        : "Du entscheidest, ob es zählt";

  return (
    <div className="kachel abruf-einstieg auf-start tippbar" onClick={tippen}>
      <div className="reihe unten-8" style={{ gap: 8 }}>
        <Sinnbild name="blitz" ton="blau" />
        <span className={"dehnen klein eine-zeile " + (stimmtGenau && phase === "aufgedeckt" ? "gruen-text" : "matt")}>
          {kopf}
        </span>
        <span className="klein blass mono">
          {groesse > 0 ? geschafft + " / " + groesse : geschafft || ""}
        </span>
        <Menue knopf={<Knopf art="klein leer" symbol="stapel" title="Wie viele Karten?">
          {groesse > 0 ? groesse : "∞"}</Knopf>}>
          {SNACK_GROESSEN.map(([wert, name]) => (
            <MenuePunkt key={wert} symbol={wert === groesse ? "haken" : null}
              onClick={() => { setGroesse(wert); setGeschafft(0); }}>{name}</MenuePunkt>
          ))}
        </Menue>
      </div>

      {/* Das Blatt: Frage und Lösung liegen übereinander, darum bleibt es
          gleich hoch, egal welche Seite gerade zu sehen ist. */}
      <div className="snack-blatt">
        <div className={"snack-seite" + (phase === "aufgedeckt" ? " verdeckt" : "")}>
          {seiten.frageBild && <Bild kennung={seiten.frageBild} />}
          {seiten.frage && <div className={"frage-text" + (seiten.frage.length > 90 ? " lang" : "")}>
            <Formel text={seiten.frage} /></div>}
        </div>
        <div className={"snack-seite" + (phase === "aufgedeckt" ? "" : " verdeckt")}>
          {seiten.antwortBild && <Bild kennung={seiten.antwortBild} />}
          {seiten.antwort && <div className={"frage-text" + (seiten.antwort.length > 90 ? " lang" : "")}>
            <Formel text={seiten.antwort} /></div>}
        </div>
      </div>

      {/* Die Handlungszeile: immer gleich hoch, nur der Inhalt wechselt. */}
      <div className="snack-zeile">
        {phase === "konfidenz" && (
          <div className="snack-wahl">
            {STUFEN.map(([wert, name, symbol, farbe]) => (
              <button key={wert} type="button" className="antwort"
                onClick={() => { setKonfidenz(wert); setPhase("tippen"); }}>
                <Symbol name={symbol} groesse={17} style={{ color: farbe }} />
                <span>{name}</span>
              </button>
            ))}
          </div>
        )}
        {phase === "tippen" && (
          <div className="abruf-einstieg-antwort">
            <input ref={feld} className="feld" value={eingabe} placeholder="Antwort tippen …"
              onChange={(e) => setEingabe(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); aufdecken(); } }} />
            <Knopf art="voll" onClick={aufdecken}>Aufdecken</Knopf>
          </div>
        )}
        {phase === "aufgedeckt" && (
          <div className="snack-noten">
            {[NOTEN.NOCHMAL, NOTEN.SCHWER, NOTEN.GUT, NOTEN.LEICHT].map((note) => (
              <button key={note} type="button" className="antwort"
                style={{ borderColor: stimmtGenau && note === NOTEN.GUT ? NOTEN_FARBEN[note] : undefined }}
                onClick={() => bewerten(note)}>
                <span style={{ color: NOTEN_FARBEN[note], fontWeight: 600 }}>{NOTEN_NAMEN[note]}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
