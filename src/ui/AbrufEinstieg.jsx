/*
 * Abrufen oben im Stapel und auf der Startseite.
 *
 * Im Stapel (Einstellung „Oben im Stapel: Abrufen“, 25.11.2026): die erste
 * Frage des Stapels mit „Wie sicher bist du dir?“; ein Tipp darauf führt ins
 * Abrufen des Stapels, mit dieser Karte zuerst und der Einschätzung gesetzt.
 *
 * Auf der Startseite (26.11.2026, Wunsch des Nutzers): richtiges Abrufen im
 * kleinen Fenster. Nach der Einschätzung erscheint das Antwortfeld; ein Tipp
 * hinein (oder auf die Frage) lässt die Karte auf volle Größe wachsen, und
 * es geht im Abrufen weiter — mit dieser Karte und der Einschätzung, ganz
 * normal verbucht.
 *
 * Welche Karten kommen, entscheidet wie immer der Plan (`baueSitzung`), auf
 * der Startseite gewichtet nach der Nähe der Klausuren.
 */

import React, { useMemo, useRef, useState } from "react";
import { useDaten } from "../core/store.jsx";
import { baueSitzung } from "../core/warteschlange.js";
import { gewichtNachKlausur } from "../core/klausuren.js";
import { seitenFuer } from "../core/kartenseiten.js";
import { KONFIDENZ } from "../core/fsrs.js";
import { anzahl } from "../core/util.js";
import { gehe } from "../App.jsx";
import { Symbol, Sinnbild, Knopf, Bild, KLICKBAR } from "./basis.jsx";
import Formel from "./Formel.jsx";

const STUFEN = [
  [KONFIDENZ.SICHER, "Sicher", "haken", "var(--gruen)"],
  [KONFIDENZ.UNSICHER, "Unsicher", "auge", "var(--gelb)"],
  [KONFIDENZ.KEINE_AHNUNG, "Keine Ahnung", "kreuz", "var(--rot)"],
];

export default function AbrufEinstieg({ setId = null, derStapel = null, auswahlFach = null, startseite = false }) {
  const { karten, zustaende, faecher, fachVon, stapelVon, stapel, ordner } = useDaten();
  const fach = derStapel ? fachVon(derStapel.subjectId) : null;
  const gemerkt = useRef(null);
  const gewicht = useMemo(() => gewichtNachKlausur(faecher, stapel, ordner), [faecher, stapel, ordner]);
  /* Startseite: schon gesehene Karten dieser Runde und die aufgedeckte Einschätzung. */
  const [gesehen, setGesehen] = useState(() => new Set());
  const [konfidenz, setKonfidenz] = useState(null);
  const kachel = useRef(null);

  const sitzung = useMemo(() => {
    if (startseite) {
      return baueSitzung({ karten, zustaende, stapelVon, faecherVon: () => faecher, umfang: 100000, gewicht });
    }
    return fach ? baueSitzung({
      karten, zustaende, fach,
      stapelVon: (id) => (id === setId ? derStapel : null),
      faecherVon: () => faecher, umfang: 100000,
    }) : null;
  }, [karten, zustaende, setId, derStapel, fach, startseite, gewicht]);

  /* Dieselbe Karte bleiben, solange sie ansteht — die Sitzung ist gemischt
     und würde sonst bei jeder Änderung eine andere zeigen. */
  const aufgaben = (sitzung?.aufgaben || []).filter((a) => !gesehen.has(a.schluessel));
  const aufgabe = aufgaben.find((a) => a.schluessel === gemerkt.current) || aufgaben[0] || null;
  gemerkt.current = aufgabe?.schluessel || null;

  if (startseite && !aufgabe) {
    /* Alle durchgesehen: noch einmal von vorn oder richtig abrufen. */
    if (gesehen.size) {
      return (
        <div className="kachel abruf-einstieg auf-start">
          <div className="reihe" style={{ gap: 10, flexWrap: "wrap" }}>
            <span className="dehnen matt">{anzahl(gesehen.size, "Karte", "Karten")} angeschaut.</span>
            <Knopf art="klein" onClick={() => setGesehen(new Set())}>Von vorn</Knopf>
            <Knopf art="klein voll" symbol="blitz" onClick={() => gehe("/abrufen/alle")}>Abrufen</Knopf>
          </div>
        </div>
      );
    }
    return null;   // dann der übliche Knopf der Startseite
  }
  const weg = startseite ? "/abrufen/alle" : "/abrufen/" + derStapel.subjectId + "/stapel/" + setId;
  const seiten = aufgabe ? seitenFuer(aufgabe.karte, aufgabe.richtung) : null;
  const insAbrufen = (konfidenz = null) =>
    gehe(weg + "/start/" + encodeURIComponent(aufgabe.schluessel) + (konfidenz ? "/" + konfidenz : ""));
  /* Die Karte wächst aus ihrer Lage auf den ganzen Bildschirm, dann das Abrufen. */
  const wachsen = (k = konfidenz) => {
    const el = kachel.current;
    const ruhig = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!el || ruhig) { insAbrufen(k); return; }
    const r = el.getBoundingClientRect();
    Object.assign(el.style, { position: "fixed", top: r.top + "px", left: r.left + "px",
      width: r.width + "px", height: r.height + "px", margin: 0, zIndex: 60 });
    el.classList.add("waechst");
    requestAnimationFrame(() => requestAnimationFrame(() => {
      Object.assign(el.style, { top: "0px", left: "0px", width: "100vw", height: "100dvh", borderRadius: "0px" });
    }));
    setTimeout(() => insAbrufen(k), 260);
  };

  return (
    <div ref={kachel} className={"kachel abruf-einstieg" + (startseite ? " auf-start" : "")}>
      <div className="reihe unten-8" style={{ gap: 8 }}>
        <Sinnbild name="blitz" ton="blau" />
        {/* Auf der Startseite ohne Fach: Wie beim Verschachteln bleibt die
            Herkunft verdeckt, bis geantwortet ist. */}
        <span className="dehnen klein matt">
          Abrufen{aufgabe ? " · " + anzahl(aufgaben.length, "Karte steht an", "Karten stehen an") : ""}
        </span>
        {auswahlFach}
        {startseite && aufgabe && (
          <Knopf art="klein" symbol="blitz" onClick={() => wachsen(null)}>Groß</Knopf>
        )}
      </div>

      {aufgabe ? (
        <>
          {/* Startseite: Ein Tipp auf die Frage führt ins Abrufen, mit dieser Karte. */}
          <div className={"abruf-einstieg-frage" + (startseite ? " tippbar" : "")}
            {...(startseite ? { ...KLICKBAR, onClick: () => wachsen(), title: "Diese Frage groß beantworten" } : {})}>
            {seiten.frageBild && <Bild kennung={seiten.frageBild} />}
            {seiten.frage && <div className={"frage-text" + (seiten.frage.length > 90 ? " lang" : "")}>
              <Formel text={seiten.frage} /></div>}
          </div>

          {startseite && konfidenz ? (
            /* Das Antwortfeld, klein; ein Tipp hinein macht die Karte groß. */
            <div className="abruf-einstieg-antwort">
              <input className="feld" readOnly placeholder="Antwort tippen …"
                onFocus={(e) => { e.target.blur(); wachsen(); }} onClick={() => wachsen()} />
              <Knopf art="voll" onClick={() => wachsen()}>Aufdecken</Knopf>
            </div>
          ) : (
            <>
              <p className="matt klein" style={{ textAlign: "center", margin: "4px 0 10px" }}>
                Wie sicher bist du dir?
              </p>
              <div className="gitter konfidenz-gitter">
                {STUFEN.map(([wert, name, symbol, farbe]) => (
                  <button key={wert} type="button" className="antwort" style={{ justifyContent: "center" }}
                    onClick={() => (startseite ? setKonfidenz(wert) : insAbrufen(wert))}>
                    <Symbol name={symbol} groesse={17} style={{ color: farbe }} />
                    <span>{name}</span>
                  </button>
                ))}
              </div>
            </>
          )}
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
