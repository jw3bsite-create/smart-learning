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
import { fachZaehlung, tageBisPruefung } from "../core/warteschlange.js";
import { straehne } from "../core/straehne.js";
import { anzahl, datumKurz } from "../core/util.js";
import { gehe } from "../App.jsx";
import { Symbol, Knopf, Leer } from "./basis.jsx";

function gruss(stunde) {
  if (stunde < 5) return "Gute Nacht";
  if (stunde < 11) return "Guten Morgen";
  if (stunde < 18) return "Guten Tag";
  return "Guten Abend";
}

function Abschnitt({ titel, children, rechts }) {
  return (
    <section style={{ marginTop: 28 }}>
      <div className="reihe" style={{ marginBottom: 10 }}>
        <h3 className="dehnen" style={{ margin: 0 }}>{titel}</h3>
        {rechts}
      </div>
      {children}
    </section>
  );
}

export default function Startseite() {
  const { faecher, stapel, karten, zustaende, stapelVon, reviews } = useDaten();

  const jetzt = new Date();
  const heute = fachZaehlung(karten, zustaende, stapelVon, null);
  const offen = heute.faellig + heute.neu;
  const stand = useMemo(() => straehne(reviews), [reviews]);

  const faecherSortiert = useMemo(() => [...faecher]
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", "de"))
    .map((f) => ({ fach: f, z: fachZaehlung(karten, zustaende, stapelVon, f.id) })),
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
      <div className="kopfzeile" style={{ marginBottom: 6 }}>
        <div style={{ flex: 1 }}>
          <div className="klein matt">
            {jetzt.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}
          </div>
          <h1 style={{ margin: "2px 0 0" }}>{gruss(jetzt.getHours())}</h1>
        </div>
      </div>

      {leer ? (
        <Leer symbol="stapel" titel="Willkommen bei Smart Learning"
          text="Leg deinen ersten Stapel an — oder lade in den Einstellungen die Beispieldaten, um alles auszuprobieren.">
          <div className="reihe" style={{ justifyContent: "center", flexWrap: "wrap" }}>
            <Knopf art="voll gross" symbol="plus" onClick={() => gehe("/faecher")}>Fächer anlegen</Knopf>
            <Knopf art="gross" symbol="zahnrad" onClick={() => gehe("/einstellungen")}>Beispieldaten</Knopf>
          </div>
        </Leer>
      ) : (
        <>
          {/* ------------------------------ Heute ----------------------------- */}
          <div className="zahl-kachel" style={{ marginTop: 16 }}>
            <div className="reihe umbruch" style={{ gap: 20, alignItems: "flex-end" }}>
              <div style={{ minWidth: 140 }}>
                <div className="klein matt">Heute offen</div>
                <div className="zahl">{offen}</div>
                <div className="klein blass">
                  {heute.faellig} fällig · {heute.neu} neu
                </div>
              </div>
              <div style={{ minWidth: 140 }}>
                <div className="reihe klein matt" style={{ gap: 6 }}>
                  <Symbol name="feuer" groesse={15} fuell={stand.heuteGeschafft}
                    style={{ color: stand.heuteGeschafft ? "var(--gelb)" : undefined }} />
                  Strähne
                </div>
                <div className="zahl">{stand.laenge}</div>
                <div className="klein blass">
                  {stand.heuteGeschafft ? "heute geschafft"
                    : anzahl(stand.fehlendHeute, "Abruf fehlt", "Abrufe fehlen") + " heute"}
                </div>
              </div>
              <div className="dehnen" />
              {offen > 0 ? (
                <Knopf art="voll gross" symbol="blitz" onClick={() => gehe("/abrufen")}>
                  Abrufen
                </Knopf>
              ) : (
                <Knopf art="gross" symbol="wuerfel" onClick={() => gehe("/fragen")}>
                  Nichts fällig — Fragen üben
                </Knopf>
              )}
            </div>
          </div>

          {/* ---------------------------- Prüfungen --------------------------- */}
          {pruefungen.length > 0 && (
            <Abschnitt titel="Nächste Prüfungen">
              <div style={{ display: "grid", gap: 8 }}>
                {pruefungen.map(({ fach, tage }) => (
                  <div key={fach.id} className="kachel reihe" style={{ flexDirection: "row", gap: 12 }}
                    onClick={() => gehe("/fach/" + fach.id)}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, flex: "none",
                      background: fach.farbe || "var(--akzent)" }} />
                    <span className="dehnen">{fach.name}</span>
                    <span className="klein" style={{ color: tage < 30 ? "var(--gelb)" : "var(--schrift-matt)" }}>
                      {tage === 0 ? "heute" : tage === 1 ? "morgen" : "in " + tage + " Tagen"}
                    </span>
                    <span className="klein blass">{datumKurz(fach.pruefungsdatum)}</span>
                  </div>
                ))}
              </div>
            </Abschnitt>
          )}

          {/* ------------------------------ Fächer ---------------------------- */}
          {faecherSortiert.length > 0 && (
            <Abschnitt titel="Fächer"
              rechts={<Knopf art="klein" onClick={() => gehe("/faecher")}>Übersicht</Knopf>}>
              <div className="start-faecher">
                {faecherSortiert.map(({ fach, z }) => (
                  <div key={fach.id} className="kachel" onClick={() => gehe("/fach/" + fach.id)}>
                    <div className="reihe" style={{ gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, flex: "none",
                        background: fach.farbe || "var(--akzent)" }} />
                      <span className="titel dehnen">{fach.name}</span>
                    </div>
                    <div className="klein blass">
                      {z.faellig + z.neu > 0
                        ? z.faellig + " fällig · " + z.neu + " neu"
                        : z.gesamt > 0 ? "nichts offen" : "noch leer"}
                    </div>
                  </div>
                ))}
              </div>
            </Abschnitt>
          )}

          {/* ---------------------------- Zuletzt ----------------------------- */}
          {zuletzt.length > 0 && (
            <Abschnitt titel="Zuletzt gelernt">
              <div style={{ display: "grid", gap: 8 }}>
                {zuletzt.map(({ s, zeit }) => (
                  <div key={s.id} className="kachel reihe" style={{ flexDirection: "row", gap: 12 }}
                    onClick={() => gehe("/stapel/" + s.id)}>
                    <Symbol name="stapel" groesse={16} />
                    <span className="dehnen">{s.title || "Ohne Titel"}</span>
                    <span className="klein blass">{datumKurz(zeit)}</span>
                  </div>
                ))}
              </div>
            </Abschnitt>
          )}
        </>
      )}

      {/* ---------------------------- Schnellzugriff -------------------------- */}
      <Abschnitt titel="Schnell">
        <div className="reihe umbruch" style={{ gap: 8 }}>
          <Knopf symbol="wuerfel" onClick={() => gehe("/fragen")}>Fragen</Knopf>
          <Knopf symbol="buch" onClick={() => gehe("/erklaeren")}>Erklären</Knopf>
          <Knopf symbol="papier" onClick={() => gehe("/pruefung")}>Prüfungen</Knopf>
          <Knopf symbol="stapel" onClick={() => gehe("/")}>Alle Stapel</Knopf>
          <Knopf symbol="statistik" onClick={() => gehe("/statistik")}>Fortschritt</Knopf>
        </div>
      </Abschnitt>
    </div>
  );
}
