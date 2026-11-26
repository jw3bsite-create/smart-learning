/*
 * Abrufen oben im Stapel (Einstellung „Oben im Stapel: Abrufen“, Wunsch des
 * Nutzers vom 25. November 2026): Wer einen Stapel öffnet, sieht gleich die
 * erste Frage, die hier ansteht, und die Einschätzung „Wie sicher bist du
 * dir?“. Ein Tipp darauf führt ins Abrufen dieses Stapels — mit dieser Karte
 * zuerst und der Einschätzung schon gesetzt, weiter geht es mit Tippen.
 *
 * Welche Karte das ist, entscheidet wie immer der Plan (`baueSitzung`), nicht
 * der Nutzer. Hier wird nichts verbucht.
 */

import React, { useMemo, useRef } from "react";
import { useDaten } from "../core/store.jsx";
import { baueSitzung } from "../core/warteschlange.js";
import { gewichtNachKlausur } from "../core/klausuren.js";
import { seitenFuer } from "../core/kartenseiten.js";
import { KONFIDENZ } from "../core/fsrs.js";
import { anzahl } from "../core/util.js";
import { gehe } from "../App.jsx";
import { Symbol, Sinnbild, Knopf, Bild } from "./basis.jsx";
import Formel from "./Formel.jsx";

/*
 * Ohne Stapel (`startseite`): über alle Fächer, die erste Karte gewichtet nach
 * der Nähe der Klausuren (Wunsch des Nutzers, 26.11.2026) — der Tipp führt nach
 * `/abrufen/alle/start/…`.
 */
export default function AbrufEinstieg({ setId = null, derStapel = null, auswahlFach = null, startseite = false }) {
  const { karten, zustaende, faecher, fachVon, stapelVon, stapel, ordner } = useDaten();
  const fach = derStapel ? fachVon(derStapel.subjectId) : null;
  const gemerkt = useRef(null);
  const gewicht = useMemo(() => gewichtNachKlausur(faecher, stapel, ordner), [faecher, stapel, ordner]);

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
  const aufgaben = sitzung?.aufgaben || [];
  const aufgabe = aufgaben.find((a) => a.schluessel === gemerkt.current) || aufgaben[0] || null;
  gemerkt.current = aufgabe?.schluessel || null;

  if (startseite && !aufgabe) return null;   // dann der übliche Knopf der Startseite
  const weg = startseite ? "/abrufen/alle" : "/abrufen/" + derStapel.subjectId + "/stapel/" + setId;
  const seiten = aufgabe ? seitenFuer(aufgabe.karte, aufgabe.richtung) : null;

  return (
    <div className={"kachel abruf-einstieg" + (startseite ? " auf-start" : "")}>
      <div className="reihe unten-8" style={{ gap: 8 }}>
        <Sinnbild name="blitz" ton="blau" />
        <span className="dehnen klein matt">
          {/* Auf der Startseite ohne Fach: Wie beim Verschachteln bleibt die
              Herkunft verdeckt, bis geantwortet ist. */}
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
            {[
              [KONFIDENZ.SICHER, "Sicher", "haken", "var(--gruen)"],
              [KONFIDENZ.UNSICHER, "Unsicher", "auge", "var(--gelb)"],
              [KONFIDENZ.KEINE_AHNUNG, "Keine Ahnung", "kreuz", "var(--rot)"],
            ].map(([wert, name, symbol, farbe]) => (
              <button key={wert} type="button" className="antwort" style={{ justifyContent: "center" }}
                onClick={() => gehe(weg + "/start/" + encodeURIComponent(aufgabe.schluessel) + "/" + wert)}>
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
