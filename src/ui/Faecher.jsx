/*
 * Die Fachübersicht — der Einstieg in das Abrufen.
 *
 * Hier wird nicht ausgewählt, was wiederholt wird, sondern nur, in welchem
 * Fach gearbeitet wird. Was drankommt, entscheidet der Plan. Die Kacheln
 * zeigen darum keine Themen, sondern Zahlen: was fällig ist, was neu wäre,
 * was hängt.
 */

import React, { useMemo, useState } from "react";
import { useDaten } from "../core/store.jsx";
import { anteileNachStufe } from "../core/fsrs.js";
import { fachZaehlung, faelligJeTag, lastprognose } from "../core/warteschlange.js";
import { kalibrierungJeFach, kalibrierungInWorten } from "../core/kalibrierung.js";
import { anzahl, datumKurz } from "../core/util.js";
import { gehe } from "../App.jsx";
import {
  Symbol, SymbolKnopf, Knopf, Menue, MenuePunkt, Balken, Leer, Dialog, Rueckfrage,
} from "./basis.jsx";

/** Vorschlag beim ersten Mal — Fächer des Technischen Gymnasiums. */
const VORSCHLAG = [
  ["Mathematik", "#5b8bff"],
  ["Deutsch", "#a97bf0"],
  ["Chemie", "#3fbf7f"],
  ["GMT", "#e8b84b"],
  ["Informatik", "#4bc6d8"],
  ["Gemeinschaftskunde", "#ef5b6b"],
];

function FachEinstellungen({ fach, aufSchliessen }) {
  const { fachAendern } = useDaten();
  const termin = fach.pruefungsdatum
    ? new Date(fach.pruefungsdatum).toISOString().slice(0, 10) : "";

  return (
    <Dialog titel={fach.name} aufSchliessen={aufSchliessen}
      fuss={<Knopf art="voll" onClick={aufSchliessen}>Fertig</Knopf>}>
      <label className="beschriftung">Name</label>
      <input className="feld" value={fach.name}
        onChange={(e) => fachAendern(fach.id, { name: e.target.value })} />

      <label className="beschriftung" style={{ marginTop: 16 }}>
        Ziel-Behaltenswahrscheinlichkeit: {Math.round(fach.zielRetention * 100)} %
      </label>
      <input type="range" min="0.80" max="0.97" step="0.01" style={{ width: "100%" }}
        value={fach.zielRetention}
        onChange={(e) => fachAendern(fach.id, { zielRetention: Number(e.target.value) })} />
      <p className="klein matt" style={{ marginTop: 4 }}>
        Wie wahrscheinlich du eine Karte im Moment der Wiederholung noch können
        willst. Höher heißt sicherer und deutlich mehr Wiederholungen —
        Nomenklatur verträgt 95 %, Überblickswissen kommt mit 85 % aus.
      </p>

      <label className="beschriftung" style={{ marginTop: 16 }}>
        Neue Karten je Tag: {fach.neuProTag}
      </label>
      <input type="range" min="0" max="60" step="1" style={{ width: "100%" }}
        value={fach.neuProTag}
        onChange={(e) => fachAendern(fach.id, { neuProTag: Number(e.target.value) })} />
      <p className="klein matt" style={{ marginTop: 4 }}>
        Die Bremse gegen den Rückstau: Jede neue Karte kommt über die Monate
        mehrfach zurück. Null heißt: nur wiederholen, nichts Neues.
      </p>

      <label className="beschriftung" style={{ marginTop: 16 }}>Prüfungstermin</label>
      <input className="feld" type="date" value={termin}
        onChange={(e) => fachAendern(fach.id, {
          pruefungsdatum: e.target.value ? new Date(e.target.value).getTime() : null,
        })} />

      <label className="schalter" style={{ marginTop: 16 }}>
        <input type="checkbox" checked={(fach.richtungen || ["td"]).includes("dt")}
          onChange={(e) => fachAendern(fach.id, {
            richtungen: e.target.checked ? ["td", "dt"] : ["td"],
          })} />
        <span>Beide Richtungen abfragen
          <span className="klein blass"> — für Vokabeln sinnvoll, für Definitionen selten</span>
        </span>
      </label>
      <p className="klein blass">
        Wirkt auf Stapel, die keine eigene Einstellung haben.
      </p>
    </Dialog>
  );
}

export default function Faecher() {
  const daten = useDaten();
  const {
    faecher, karten, zustaende, stapel, stapelVon, reviews,
    fachAnlegen, fachLoeschen, stapelAendern, setzeEinstellung,
  } = daten;
  const [einstellungenFuer, setEinstellungenFuer] = useState(null);
  const [loescht, setLoescht] = useState(null);
  const [zuordnen, setZuordnen] = useState(false);

  const alleZustaende = useMemo(() => Object.values(zustaende), [zustaende]);
  const kalibrierungen = useMemo(() => kalibrierungJeFach(reviews), [reviews]);

  const zaehlungen = useMemo(() => {
    const ergebnis = {};
    for (const f of faecher)
      ergebnis[f.id] = fachZaehlung(karten, zustaende, stapelVon, f.id);
    return ergebnis;
  }, [faecher, karten, zustaende, stapelVon]);

  const gesamt = useMemo(() => {
    const summe = { faellig: 0, neu: 0, gesperrt: 0, gesamt: 0 };
    for (const z of Object.values(zaehlungen))
      for (const schluessel of Object.keys(summe)) summe[schluessel] += z[schluessel];
    return summe;
  }, [zaehlungen]);

  const ohneFach = stapel.filter((s) => !s.subjectId);
  const last = useMemo(() => lastprognose(alleZustaende,
    faecher.reduce((n, f) => n + (Number(f.neuProTag) || 0), 0)), [alleZustaende, faecher]);
  const kalender = useMemo(() => faelligJeTag(alleZustaende, 30), [alleZustaende]);

  const faecherAnlegen = async () => {
    for (const [name, farbe] of VORSCHLAG) await fachAnlegen(name, farbe);
    setzeEinstellung("faecherAngelegt", true);
  };

  const zustaendeVonFach = (fachId) =>
    alleZustaende.filter((z) => z.subjectId === fachId);

  if (!faecher.length) {
    return (
      <div className="mitte">
        <div className="kopfzeile"><h1>Fächer</h1></div>
        <Leer symbol="buch" titel="Noch keine Fächer"
          text="Ein Fach bündelt Stapel, bekommt einen Prüfungstermin und eine eigene Ziel-Sicherheit. Erst damit kann der Plan rechnen, was wann drankommt.">
          <div className="reihe" style={{ justifyContent: "center", flexWrap: "wrap" }}>
            <Knopf art="voll gross" symbol="plus" onClick={faecherAnlegen}>
              Die sechs Schulfächer anlegen
            </Knopf>
            <Knopf art="gross" symbol="plus" onClick={async () => {
              const name = window.prompt("Name des Fachs");
              if (name) await fachAnlegen(name.trim());
            }}>Einzelnes Fach</Knopf>
          </div>
        </Leer>
      </div>
    );
  }

  return (
    <div className="mitte">
      <div className="kopfzeile">
        <h1 style={{ flex: 1 }}>Fächer</h1>
        <Knopf symbol="plus" onClick={async () => {
          const name = window.prompt("Name des Fachs");
          if (name) await fachAnlegen(name.trim());
        }}>Fach</Knopf>
        {gesamt.faellig + gesamt.neu > 0 && (
          <Knopf art="voll" symbol="blitz" onClick={() => gehe("/abrufen")}>
            Alles abrufen ({gesamt.faellig + Math.min(gesamt.neu, 20)})
          </Knopf>
        )}
      </div>

      {/* --------------------------- Tageslage --------------------------- */}
      <div className="zahl-kachel" style={{ marginBottom: 22 }}>
        <div className="reihe umbruch" style={{ gap: 20 }}>
          <div>
            <div className="klein matt">Heute fällig</div>
            <div className="zahl">{gesamt.faellig}</div>
          </div>
          <div>
            <div className="klein matt">Noch nie gesehen</div>
            <div className="zahl">{gesamt.neu}</div>
          </div>
          <div>
            <div className="klein matt">Karten im Plan</div>
            <div className="zahl">{gesamt.gesamt}</div>
          </div>
          {gesamt.gesperrt > 0 && (
            <div>
              <div className="klein matt">Hängengeblieben</div>
              <div className="zahl" style={{ color: "var(--rot)" }}>{gesamt.gesperrt}</div>
            </div>
          )}
          <div className="dehnen" />
          <div style={{ minWidth: 180 }}>
            <div className="klein matt">Nächste 30 Tage</div>
            <div className="streifen" style={{ marginTop: 6 }}>
              {kalender.eimer.map((n, i) => (
                <i key={i} data-stufe={n === 0 ? 0 : n < 10 ? 1 : n < 30 ? 2 : 3}
                  title={n + " Karten in " + i + " Tagen"} />
              ))}
            </div>
          </div>
        </div>
        {last.heute > 0 && (
          <div className="klein blass" style={{ marginTop: 10 }}>
            Schöpfst du die Tageslimits aus, sind auf Dauer rund {last.heute} Abrufe
            am Tag zu erwarten — etwa {Math.max(1, last.minutenHeute)} Minuten.
            Grobe Größenordnung, keine Vorhersage.
            {kalender.ueberfaellig > 20 && (
              <strong style={{ color: "var(--gelb)" }}>
                {" "}{kalender.ueberfaellig} Karten sind überfällig — nimm das Tageslimit
                für neue Karten zurück, bis der Rückstand weg ist.
              </strong>
            )}
          </div>
        )}
      </div>

      {/* ----------------------------- Fächer ---------------------------- */}
      <div className="gitter">
        {faecher.map((f) => {
          const z = zaehlungen[f.id] || { faellig: 0, neu: 0, gesamt: 0, gesperrt: 0 };
          const anteile = anteileNachStufe(zustaendeVonFach(f.id));
          const k = kalibrierungen[f.id];
          const tageBisPruefung = f.pruefungsdatum
            ? Math.ceil((f.pruefungsdatum - Date.now()) / 86400000) : null;
          return (
            <div key={f.id} className="kachel" onClick={() => gehe("/abrufen/" + f.id)}>
              <div className="reihe">
                <span style={{ width: 10, height: 10, borderRadius: 3,
                  background: f.farbe || "var(--akzent)", display: "block" }} />
                <div className="titel dehnen">{f.name}</div>
                <Menue knopf={<SymbolKnopf symbol="mehr" titel="Mehr" />}>
                  <MenuePunkt symbol="zahnrad" onClick={() => setEinstellungenFuer(f)}>
                    Einstellungen …</MenuePunkt>
                  <MenuePunkt symbol="stapel" onClick={() => setZuordnen(true)}>
                    Stapel zuordnen …</MenuePunkt>
                  <hr />
                  <MenuePunkt symbol="muell" gefahr onClick={() => setLoescht(f)}>
                    Fach löschen</MenuePunkt>
                </Menue>
              </div>

              <div className="reihe klein" style={{ gap: 6, flexWrap: "wrap" }}>
                {z.faellig > 0 && <span className="marke gelb">{z.faellig} fällig</span>}
                {z.neu > 0 && <span className="marke">{z.neu} neu</span>}
                {z.gesperrt > 0 && <span className="marke rot">{z.gesperrt} hängt</span>}
                {z.faellig === 0 && z.neu === 0 && z.gesamt > 0 &&
                  <span className="marke gruen">nichts offen</span>}
              </div>

              <div className="dehnen" />
              <Balken anteile={anteile} />
              <div className="klein blass">
                {anzahl(z.gesamt, "Karte", "Karten")}
                {k && k.ueberschaetzung !== null &&
                  " · " + kalibrierungInWorten(k)}
                {tageBisPruefung !== null && (
                  <span style={{ color: tageBisPruefung < 30 ? "var(--gelb)" : undefined }}>
                    {" · Prüfung " + (tageBisPruefung > 0
                      ? "in " + tageBisPruefung + " Tagen"
                      : datumKurz(f.pruefungsdatum))}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ------------------------ Stapel ohne Fach ----------------------- */}
      {ohneFach.length > 0 && (
        <>
          <hr className="trennlinie" />
          <div className="reihe" style={{ marginBottom: 10 }}>
            <h3 className="dehnen">Stapel ohne Fach ({ohneFach.length})</h3>
            <span className="klein matt">Ohne Fach kommen sie im Abrufen nicht vor.</span>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {ohneFach.map((s) => (
              <div key={s.id} className="karten-zeile" style={{ padding: "10px 14px" }}>
                <div className="seite reihe" style={{ gap: 8 }}>
                  <Symbol name="stapel" groesse={16} />
                  <span>{s.title || "Ohne Titel"}</span>
                </div>
                <div className="seite klein matt">
                  {anzahl((daten.kartenNachStapel.get(s.id) || []).length, "Karte", "Karten")}
                </div>
                <select className="feld" style={{ width: "auto" }} value=""
                  onChange={(e) => e.target.value && stapelAendern(s.id, { subjectId: e.target.value })}>
                  <option value="">Fach wählen …</option>
                  {faecher.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
            ))}
          </div>
        </>
      )}

      {einstellungenFuer && (
        <FachEinstellungen fach={faecher.find((f) => f.id === einstellungenFuer.id) || einstellungenFuer}
          aufSchliessen={() => setEinstellungenFuer(null)} />
      )}

      {zuordnen && (
        <Dialog weit titel="Stapel den Fächern zuordnen" aufSchliessen={() => setZuordnen(false)}
          fuss={<Knopf art="voll" onClick={() => setZuordnen(false)}>Fertig</Knopf>}>
          <div style={{ display: "grid", gap: 8 }}>
            {stapel.map((s) => (
              <div key={s.id} className="reihe" style={{ gap: 10 }}>
                <span className="dehnen">{s.title || "Ohne Titel"}</span>
                <select className="feld" style={{ width: 200 }} value={s.subjectId || ""}
                  onChange={(e) => stapelAendern(s.id, { subjectId: e.target.value || null })}>
                  <option value="">— ohne Fach —</option>
                  {faecher.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
            ))}
          </div>
        </Dialog>
      )}

      {loescht && (
        <Rueckfrage titel="Fach löschen?"
          text={`„${loescht.name}" verschwindet. Die Stapel darin bleiben erhalten und sind danach ohne Fach — der Lernstand der Karten bleibt ebenfalls.`}
          aufNein={() => setLoescht(null)}
          aufJa={() => { fachLoeschen(loescht.id); setLoescht(null); }} />
      )}
    </div>
  );
}
