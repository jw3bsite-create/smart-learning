/*
 * Die Startseite: ein Blick, was heute ansteht.
 *
 * Sie ist bewusst knapp. Oben steht das Einzige, was jeden Tag zählt — die
 * fälligen Karten und der Weg ins Abrufen. Darunter, was die nächsten Wochen
 * bestimmt (Prüfungen), und die kurzen Wege zu den Fächern und zu dem, woran
 * du zuletzt gesessen hast.
 *
 * Punkte stehen hier nicht: Sie sollen erinnern, wenn man ein Fach öffnet,
 * nicht bei jedem Start im Blick sein.
 */

import React, { useMemo } from "react";
import { useDaten } from "../core/store.jsx";
import { fachZaehlung, heuteAnstehend, tageBisPruefung } from "../core/warteschlange.js";
import { straehne } from "../core/straehne.js";
import { anzahl, datumKurz } from "../core/util.js";
import { gehe } from "../App.jsx";
import { Symbol, Sinnbild, Knopf, Leer, KLICKBAR, FachPunkt } from "./basis.jsx";
import { FlammeZeichen } from "./Flamme.jsx";
import { useLernzeiten } from "./Lernzeit.jsx";
import { summe, tagesBeginn, dauerText } from "../core/lernzeit.js";
import { UmzugNeu, UmzugHinweis } from "./Umzug.jsx";
import AbrufEinstieg from "./AbrufEinstieg.jsx";
import KartenVorschau from "./KartenVorschau.jsx";
import { baueSitzung } from "../core/warteschlange.js";
import { gewichtNachKlausur } from "../core/klausuren.js";
import { ZielStreifen } from "./Ziele.jsx";

function gruss(stunde) {
  if (stunde < 5) return "Gute Nacht";
  if (stunde < 11) return "Guten Morgen";
  if (stunde < 18) return "Guten Tag";
  return "Guten Abend";
}

function Abschnitt({ titel, children, rechts }) {
  return (
    <section className="oben-32">
      <div className="reihe unten-12">
        <h3 className="dehnen" style={{ margin: 0 }}>{titel}</h3>
        {rechts}
      </div>
      {children}
    </section>
  );
}

/* Karteikarten auf der Startseite: die anstehenden Karten aller Fächer,
   gewichtet nach der Nähe der Klausuren, zum Durchblättern wie im Stapel. */
function StartKarten() {
  const { karten, zustaende, stapelVon, faecher, stapel, ordner } = useDaten();
  const liste = useMemo(() => {
    const gewicht = gewichtNachKlausur(faecher, stapel, ordner);
    const s = baueSitzung({ karten, zustaende, stapelVon, faecherVon: () => faecher, umfang: 100000, gewicht });
    const gesehen = new Set();
    return s.aufgaben.map((a) => a.karte).filter((k) => !gesehen.has(k.id) && gesehen.add(k.id));
  }, [karten, zustaende, stapelVon, faecher, stapel, ordner]);
  if (!liste.length) return null;
  return <KartenVorschau karten={liste} reihenfolgeBehalten />;
}

export default function Startseite() {
  const { faecher, stapel, karten, zustaende, stapelVon, reviews, einstellungen, offen: heute } = useDaten();

  const jetzt = new Date();
  /* „offen“ ist die Zahl am Reiter und im Abrufen: Fälliges plus neue
     Karten bis zum Tageslimit — nicht alle nie gesehenen (vorher 101 statt 47). */
  const offen = heute.gesamt;
  const stand = useMemo(() => straehne(reviews), [reviews]);
  const bloecke = useLernzeiten();
  const heuteZeit = bloecke ? summe(bloecke, tagesBeginn(jetzt.getTime())) : null;

  const faecherSortiert = useMemo(() => [...faecher]
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", "de"))
    .map((f) => ({
      fach: f,
      z: fachZaehlung(karten, zustaende, stapelVon, f.id),
      h: heuteAnstehend({ karten, zustaende, stapelVon, faecherVon: () => faecher, fach: f }),
    })),
  [faecher, karten, zustaende, stapelVon]);

  const pruefungen = useMemo(() => faecher
    .map((f) => ({ fach: f, tage: tageBisPruefung(f) }))
    .filter((x) => x.tage !== null && x.tage >= 0)
    .sort((a, b) => a.tage - b.tage)
    .slice(0, 3),
  [faecher]);

  /* Zuletzt gelernt: der jüngste Abruf je Stapel, in einem Durchgang. */
  const zuletzt = useMemo(() => {
    const juengster = new Map();
    for (const r of reviews) {
      if (!r || r.deleted || !r.setId) continue;
      if ((juengster.get(r.setId) || 0) < r.zeit) juengster.set(r.setId, r.zeit);
    }
    return [...juengster.entries()]
      .map(([id, zeit]) => ({ s: stapelVon(id), zeit }))
      .filter((x) => x.s && !x.s.deleted)
      .sort((a, b) => b.zeit - a.zeit)
      .slice(0, 4);
  }, [reviews, stapelVon]);

  const leer = stapel.filter((s) => !s.deleted).length === 0;

  return (
    <div className="mitte">
      {/* Ganz oben, über allem: das Abi-Ziel (Wunsch des Nutzers, 25.11.2026). */}
      <ZielStreifen aufOeffnen={() => gehe("/punkte")} />
      <div className="kopfzeile unten-8">
        <div style={{ flex: 1 }}>
          <div className="klein matt">
            {jetzt.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}
          </div>
          <h1 style={{ margin: "2px 0 0" }}>{gruss(jetzt.getHours())}</h1>
        </div>
      </div>

      <UmzugNeu knapp />

      {leer ? (
        <Leer symbol="stapel" titel="Willkommen bei Anchor"
          text="Leg deinen ersten Stapel an oder probier die Beispieldaten aus.">
          <div className="reihe" style={{ justifyContent: "center", flexWrap: "wrap" }}>
            <Knopf art="voll gross" symbol="plus" onClick={() => gehe("/faecher")}>Fächer anlegen</Knopf>
            <Knopf art="gross" symbol="zahnrad" onClick={() => gehe("/einstellungen/erweitert")}>Beispieldaten</Knopf>
          </div>
          <UmzugHinweis />
        </Leer>
      ) : (
        <>
          {/* ------------------------- Gleich abrufen ------------------------- */}
          {/* Die erste Frage steht gleich da, mit „Wie sicher bist du dir?“ —
              gewichtet nach der Nähe der Klausuren (Wunsch des Nutzers, 26.11.2026). */}
          {offen > 0 && (
            <div className="oben-16">
              {/* Abrufen oder Karteikarten — einstellbar unter Lernen (26.11.2026). */}
              {einstellungen.startseiteModus === "karteikarten"
                ? <StartKarten /> : <AbrufEinstieg startseite />}
            </div>
          )}

          {/* ------------------------------ Heute ----------------------------- */}
          {/* Eine schmale Zeile statt einer großen Kachel (Wunsch des Nutzers, 26.11.2026). */}
          <div className="zahl-kachel heute-zeile oben-16">
            <span className="heute-wert" title={heute.faellig + " fällig · " + heute.neu + " neu"}>
              <strong>{offen}</strong><span className="klein matt">offen</span>
            </span>
            <span className="heute-wert" title={stand.heuteGeschafft ? "heute geschafft"
              : anzahl(stand.fehlendHeute, "Abruf fehlt", "Abrufe fehlen") + " heute"}>
              <FlammeZeichen an={stand.heuteGeschafft} groesse={16} />
              <strong>{stand.laenge}</strong><span className="klein matt">Strähne</span>
            </span>
            {heuteZeit && (
              <span {...KLICKBAR} className="heute-wert" onClick={() => gehe("/statistik")} title="Mehr unter Fortschritt">
                <Symbol name="uhr" groesse={14} />
                <strong>{dauerText(heuteZeit.lernen)}</strong><span className="klein matt">heute</span>
              </span>
            )}
            {offen === 0 && (
              <Knopf art="klein" symbol="wuerfel" onClick={() => gehe("/fragen")}>Fragen üben</Knopf>
            )}
          </div>

          {/* ---------------------------- Zuletzt ----------------------------- */}
          {/* Nach oben gerückt und kompakt, zwei mal zwei (Wunsch des Nutzers,
              26.11.2026): der schnelle Wiedereinstieg. */}
          {zuletzt.length > 0 && (
            <Abschnitt titel="Zuletzt gelernt">
              <div className="zuletzt-raster">
                {zuletzt.map(({ s, zeit }) => (
                  <button type="button" key={s.id} className="zuletzt-kachel"
                    onClick={() => gehe("/stapel/" + s.id)} title={s.title || "Ohne Titel"}>
                    <span className="zuletzt-name">{s.title || "Ohne Titel"}</span>
                    <span className="klein blass">{datumKurz(zeit)}</span>
                  </button>
                ))}
              </div>
            </Abschnitt>
          )}

          {/* ---------------------------- Prüfungen --------------------------- */}
          {pruefungen.length > 0 && (
            <Abschnitt titel="Nächste Prüfungen">
              <div className="liste">
                {pruefungen.map(({ fach, tage }) => (
                  <button type="button" key={fach.id} className="listenzeile"
                    onClick={() => gehe("/fach/" + fach.id)}>
                    <FachPunkt farbe={fach.farbe} />
                    <span className="dehnen">{fach.name}
                      {fach.naechsteKlausur?.name && <span className="klein blass"> · {fach.naechsteKlausur.name}</span>}
                    </span>
                    <span className="klein" style={{ color: tage < 30 ? "var(--gelb)" : "var(--schrift-matt)" }}>
                      {tage === 0 ? "heute" : tage === 1 ? "morgen" : "in " + tage + " Tagen"}
                    </span>
                    <span className="klein blass nur-breit">{datumKurz(fach.pruefungsdatum)}</span>
                  </button>
                ))}
              </div>
            </Abschnitt>
          )}

          {/* ------------------------------ Fächer ---------------------------- */}
          {faecherSortiert.length > 0 && (
            <Abschnitt titel="Fächer"
              rechts={<Knopf art="klein" onClick={() => gehe("/faecher")}>Übersicht</Knopf>}>
              <div className="start-faecher">
                {faecherSortiert.map(({ fach, z, h }) => (
                  <div {...KLICKBAR} key={fach.id} className="kachel" onClick={() => gehe("/fach/" + fach.id)}>
                    <div className="reihe" style={{ gap: 8 }}>
                      <FachPunkt farbe={fach.farbe} />
                      <span className="titel dehnen">{fach.name}</span>
                    </div>
                    <div className="klein blass">
                      {h.gesamt > 0
                        ? h.faellig + " fällig · " + h.neu + " neu"
                        : z.gesamt > 0 ? "nichts offen" : "noch leer"}
                    </div>
                  </div>
                ))}
              </div>
            </Abschnitt>
          )}

        </>
      )}

      {/* ---------------------------- Schnellzugriff -------------------------- */}
      <Abschnitt titel="Schnell">
        <div className="schnell-raster">
          <Knopf onClick={() => gehe("/fragen")}><Sinnbild name="wuerfel" ton="gelb" />Fragen</Knopf>
          <Knopf onClick={() => gehe("/erklaeren")}><Sinnbild name="schreiben" ton="lila" />Erklären</Knopf>
          <Knopf onClick={() => gehe("/pruefung")}><Sinnbild name="papier" ton="orange" />Prüfungen</Knopf>
          <Knopf onClick={() => gehe("/")}><Sinnbild name="stapel" ton="blau" />Alle Stapel</Knopf>
          <Knopf onClick={() => gehe("/statistik")}><Sinnbild name="statistik" ton="tuerkis" />Fortschritt</Knopf>
        </div>
      </Abschnitt>
    </div>
  );
}
