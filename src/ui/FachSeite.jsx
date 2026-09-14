/*
 * Die Seite eines Fachs: sein Material an einem Ort.
 *
 * Bis hierher gab es zwei Wege zu den Stapeln eines Fachs, und beide waren
 * Umwege: über die Ordner, die mit dem Fach nichts zu tun haben müssen, oder
 * über „Stapel zuordnen" im Menü der Fachübersicht, eine lange Liste aller
 * Stapel. Wer auf „Ethik" klickt, will sehen, was er für Ethik hat — und dort
 * Neues anlegen.
 *
 * Zwei Begriffe bleiben dabei getrennt, weil sie Verschiedenes sagen:
 * Der **Ordner** sagt, wo ein Stapel liegt. Das **Fach** sagt, wofür er zählt —
 * im Abrufen, im Fragemodus, bei der Prüfung. Ein Stapel gehört zu genau einem
 * Fach, liegt aber in einem beliebigen Ordner.
 *
 * Mit der Regel „keine Selbstauswahl der Wiederholungskarten" verträgt sich
 * das: Diese Seite zeigt und ordnet Material. Was beim Abrufen drankommt,
 * entscheidet weiter der Plan.
 */

import React, { useMemo, useState } from "react";
import { useDaten } from "../core/store.jsx";
import { fachZaehlung } from "../core/warteschlange.js";
import { anzahl } from "../core/util.js";
import { punkteText } from "../core/noten.js";
import { gehe } from "../App.jsx";
import { StapelKachel } from "./Bibliothek.jsx";
import { FachEinstellungen } from "./Faecher.jsx";
import { punkteZuLernfach } from "./Noten.jsx";
import {
  Symbol, SymbolKnopf, Knopf, MenuePunkt, Leer, Dialog,
} from "./basis.jsx";

export default function FachSeite({ fachId }) {
  const {
    faecher, stapel, karten, kartenNachStapel, zustaende, stapelVon,
    stapelAnlegen, stapelAendern, notenfaecher,
  } = useDaten();
  const [hinzufuegen, setHinzufuegen] = useState(false);
  const [einstellungen, setEinstellungen] = useState(false);

  const fach = faecher.find((f) => f.id === fachId) || null;

  const eigene = useMemo(() => stapel
    .filter((s) => !s.deleted && s.subjectId === fachId)
    .sort((a, b) => (a.title || "").localeCompare(b.title || "", "de")),
  [stapel, fachId]);

  const andere = useMemo(() => stapel
    .filter((s) => !s.deleted && s.subjectId !== fachId)
    .sort((a, b) => (a.title || "").localeCompare(b.title || "", "de")),
  [stapel, fachId]);

  if (!fach) {
    return (
      <div className="mitte">
        <Leer titel="Fach nicht gefunden" text="Vielleicht wurde es gelöscht.">
          <Knopf onClick={() => gehe("/faecher")}>Zu den Fächern</Knopf>
        </Leer>
      </div>
    );
  }

  const z = fachZaehlung(karten, zustaende, stapelVon, fach.id);
  const offen = z.faellig + z.neu;
  const punkte = punkteZuLernfach(notenfaecher, fach.id);
  const fachName = (id) => faecher.find((f) => f.id === id)?.name;

  /* Ein neuer Stapel gehoert sofort zum Fach — sonst muesste man ihn danach
     erst suchen und zuordnen, und genau dieser Umweg soll wegfallen. */
  const neuerStapel = async () => {
    const s = await stapelAnlegen("Neuer Stapel", null);
    await stapelAendern(s.id, { subjectId: fach.id });
    gehe("/stapel/" + s.id + "/bearbeiten");
  };

  const menue = (s) => (
    <>
      <MenuePunkt symbol="blitz" onClick={() => gehe("/stapel/" + s.id + "/lernen")}>Lernen</MenuePunkt>
      <MenuePunkt symbol="stift" onClick={() => gehe("/stapel/" + s.id + "/bearbeiten")}>Bearbeiten</MenuePunkt>
      <hr />
      <MenuePunkt symbol="kreuz" onClick={() => stapelAendern(s.id, { subjectId: null })}>
        Aus diesem Fach nehmen
      </MenuePunkt>
    </>
  );

  return (
    <div className="mitte">
      <div className="kopfzeile">
        <div className="klein matt" style={{ width: "100%" }}>
          <span style={{ cursor: "pointer" }} onClick={() => gehe("/faecher")}>Fächer</span>
          {" › "}<span style={{ color: "var(--schrift)" }}>{fach.name}</span>
        </div>
        <span style={{ width: 14, height: 14, borderRadius: 4, flex: "none",
          background: fach.farbe || "var(--akzent)", display: "block" }} />
        <h1 style={{ flex: 1 }}>{fach.name}</h1>
        <SymbolKnopf symbol="zahnrad" titel="Einstellungen des Fachs"
          onClick={() => setEinstellungen(true)} />
      </div>

      {/* ---------------------------- Zum Lernen --------------------------- */}
      <div className="reihe umbruch" style={{ marginBottom: 10 }}>
        <Knopf art="voll" symbol="blitz" disabled={offen === 0}
          onClick={() => gehe("/abrufen/" + fach.id)}>
          Abrufen
        </Knopf>
        <Knopf symbol="wuerfel" disabled={eigene.length === 0}
          onClick={() => gehe("/fragen/" + fach.id)}>
          Fragen aus {fach.name}
        </Knopf>
        <div className="reihe klein" style={{ gap: 6, flexWrap: "wrap" }}>
          {z.faellig > 0 && <span className="marke gelb">{z.faellig} fällig</span>}
          {z.neu > 0 && <span className="marke">{z.neu} neu</span>}
          {z.gesperrt > 0 && <span className="marke rot">{z.gesperrt} hängt</span>}
          {offen === 0 && z.gesamt > 0 && <span className="marke gruen">nichts offen</span>}
        </div>
      </div>
      {punkte && (
        <div className="klein matt" style={{ marginBottom: 18 }}>
          Deine Punkte: <strong>{punkteText(punkte.juengste.punkte)}</strong>
          {" "}(zuletzt {punkte.juengste.halbjahr})
        </div>
      )}

      {/* ------------------------------ Material --------------------------- */}
      {/* Solange das Fach leer ist, stehen dieselben Knoepfe gross in der Mitte. */}
      {eigene.length > 0 && (
        <div className="reihe umbruch" style={{ margin: "22px 0 12px" }}>
          <h3 className="dehnen">
            {anzahl(eigene.length, "Stapel", "Stapel") + " in diesem Fach"}
          </h3>
          {andere.length > 0 && (
            <Knopf symbol="stapel" onClick={() => setHinzufuegen(true)}>Stapel hinzufügen</Knopf>
          )}
          <Knopf art="voll" symbol="plus" onClick={neuerStapel}>Neuer Stapel</Knopf>
        </div>
      )}

      {eigene.length === 0 ? (
        <Leer symbol="stapel" titel={"Noch kein Material in " + fach.name}
          text="Leg einen Stapel an — er gehört dann automatisch zu diesem Fach. Oder nimm einen vorhandenen dazu.">
          <div className="reihe" style={{ justifyContent: "center", flexWrap: "wrap" }}>
            <Knopf art="voll gross" symbol="plus" onClick={neuerStapel}>Neuer Stapel</Knopf>
            {andere.length > 0 && (
              <Knopf art="gross" symbol="stapel" onClick={() => setHinzufuegen(true)}>
                Vorhandenen Stapel hinzufügen
              </Knopf>
            )}
          </div>
        </Leer>
      ) : (
        <div className="gitter">
          {eigene.map((s) => (
            <StapelKachel key={s.id} stapel={s} karten={kartenNachStapel.get(s.id) || []}
              zustaende={zustaende} aufMenue={menue} />
          ))}
        </div>
      )}

      <p className="klein blass" style={{ marginTop: 22, maxWidth: "62ch" }}>
        Ein Stapel gehört zu genau einem Fach. In welchem Ordner er liegt, ist davon
        unabhängig — Ordner sagen, wo etwas liegt, das Fach sagt, wofür es zählt.
      </p>

      {/* -------------------------- Stapel hinzufügen ------------------------ */}
      {hinzufuegen && (
        <Dialog weit titel={"Stapel zu " + fach.name + " hinzufügen"}
          aufSchliessen={() => setHinzufuegen(false)}
          fuss={<Knopf art="voll" onClick={() => setHinzufuegen(false)}>Fertig</Knopf>}>
          <p className="klein matt" style={{ marginTop: 0 }}>
            Gehört ein Stapel schon zu einem anderen Fach, wechselt er hierher.
          </p>
          <div style={{ display: "grid", gap: 8 }}>
            {andere.map((s) => (
              <div key={s.id} className="reihe" style={{ gap: 10 }}>
                <Symbol name="stapel" groesse={16} />
                <span className="dehnen">
                  {s.title || "Ohne Titel"}
                  <span className="klein blass">
                    {" · "}{s.subjectId ? fachName(s.subjectId) || "anderes Fach" : "ohne Fach"}
                    {" · "}{anzahl((kartenNachStapel.get(s.id) || []).length, "Karte", "Karten")}
                  </span>
                </span>
                <Knopf art="klein" onClick={() => stapelAendern(s.id, { subjectId: fach.id })}>
                  Hinzufügen
                </Knopf>
              </div>
            ))}
            {andere.length === 0 && (
              <div className="klein blass">Alle Stapel gehören schon zu diesem Fach.</div>
            )}
          </div>
        </Dialog>
      )}

      {einstellungen && (
        <FachEinstellungen fach={fach} aufSchliessen={() => setEinstellungen(false)} />
      )}
    </div>
  );
}
