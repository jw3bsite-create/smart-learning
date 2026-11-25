/*
 * Ziele: fürs Abi (0–900) und je Halbjahr (Schnitt 0–15), mit einem Balken,
 * der sich füllt, und dem, was ab jetzt nötig ist (core/noten.js, `abiStand`,
 * `halbjahrBedarf`). Vom Nutzer gewünscht am 25. November 2026 — zur
 * Motivation, ausdrücklich auch mit Vorhersage.
 *
 * Gespeichert in den Einstellungen (`ziele`: { abi, "12.1", … }), damit sie
 * mit abgeglichen und gesichert werden. Werte immer als Punkte; die Note
 * daneben ist umgerechnet.
 */

import React, { useMemo, useState } from "react";
import { useDaten } from "../core/store.jsx";
import {
  ABI_MAX, PUNKTE_MAX, HALBJAHRE, abiStand, abiNote, abiPunkteFuer, punkteFuerNote, alsNote,
  noteKomma, punkteText, halbjahrBedarf, faecherIm, halbjahrSchnitt, halbjahrZiel,
} from "../core/noten.js";
import { Knopf, Dialog, HilfeLink } from "./basis.jsx";
import ZahlFeld from "./ZahlFeld.jsx";

/** Die Ziele aus den Einstellungen und ein Setzer dafür. */
export function useZiele() {
  const { einstellungen, setzeEinstellung } = useDaten();
  const ziele = einstellungen.ziele || {};
  const setzen = (schluessel, wert) => setzeEinstellung("ziele", { ...ziele, [schluessel]: wert });
  return [ziele, setzen];
}

const prozent = (wert, max) => Math.max(0, Math.min(100, (100 * (wert || 0)) / max)) + "%";

/**
 * Ein Balken mit bis zu drei Dingen: was erreicht ist (voll), was
 * hochgerechnet dazukäme (blass) und das Ziel (ein Strich).
 */
export function ZielBalken({ erreicht, hochgerechnet = null, ziel = null, max, hoehe = 12, titel }) {
  const ueber = ziel !== null && hochgerechnet !== null && hochgerechnet >= ziel;
  return (
    <div className={"ziel-balken" + (ueber ? " auf-kurs" : "")} style={{ height: hoehe }}
      role="img" aria-label={titel}>
      {hochgerechnet !== null && hochgerechnet > erreicht && (
        <span className="ziel-hoch" style={{ left: prozent(erreicht, max), width: prozent(hochgerechnet - erreicht, max) }} />
      )}
      <span className="ziel-voll" style={{ width: prozent(erreicht, max) }} />
      {ziel !== null && <span className="ziel-strich" style={{ left: prozent(ziel, max) }} />}
    </div>
  );
}

/** Ein Ziel setzen: Punkte oder Note, das andere rechnet sich mit. */
export function ZielDialog({ titel, art, wert, automatisch = null, aufSpeichern, aufSchliessen }) {
  const abi = art === "abi";
  const [punkte, setPunkte] = useState(wert ?? (abi ? 700 : 12));
  const note = abi ? abiNote(punkte) : alsNote(punkte);
  return (
    <Dialog titel={titel} aufSchliessen={aufSchliessen}
      fuss={<>
        {wert !== null && wert !== undefined && (
          <Knopf onClick={() => { aufSpeichern(null); aufSchliessen(); }}>
            {automatisch !== null ? "Automatisch" : "Kein Ziel"}
          </Knopf>
        )}
        <span className="dehnen" />
        <Knopf onClick={aufSchliessen}>Abbrechen</Knopf>
        <Knopf art="voll" onClick={() => { aufSpeichern(punkte); aufSchliessen(); }}>Speichern</Knopf>
      </>}>
      <div className="gitter" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <label className="beschriftung">{abi ? "Punkte (von 900)" : "Schnitt in Punkten"}
          <ZahlFeld wert={abi ? punkte : Math.round(punkte * 10) / 10} min={0} max={abi ? ABI_MAX : PUNKTE_MAX}
            autoFocus aufAendern={(p) => setPunkte(abi ? Math.round(p) : p)} />
        </label>
        <label className="beschriftung">Note
          <ZahlFeld wert={note === null ? null : Math.round(note * 10) / 10} min={1} max={6}
            aufAendern={(n) => setPunkte(abi ? abiPunkteFuer(n) : punkteFuerNote(n))} />
        </label>
      </div>
      <p className="klein blass oben-8 erklaerung">
        {abi ? "Umgerechnet mit Note = 17/3 − Punkte/180, ein Richtwert."
          : automatisch !== null
            ? "Gemeint ist der Schnitt aller Fächer. „Automatisch“ nimmt, was dein Abi-Ziel verlangt (jetzt " + punkteText(automatisch) + " P)."
            : "Gemeint ist der Schnitt aller Fächer dieses Halbjahres."}
      </p>
    </Dialog>
  );
}

/** Das Halbjahr, das gerade läuft: das jüngste mit Fächern, sonst das erste. */
function laufendesHalbjahr(alle) {
  return [...HALBJAHRE].reverse().find((x) => faecherIm(alle, x.id).length) || HALBJAHRE[0];
}

/**
 * Der Satz, auf den es ankommt (Wunsch des Nutzers, 25.11.2026): was im
 * laufenden Halbjahr als Schnitt nötig ist — nicht ein Schnitt „über alles
 * ab jetzt“, der sich mit den Halbjahreszielen ohnehin auflöst.
 */
function BrauchstDu({ alle, ziele, klasse = "klein oben-4" }) {
  const h = laufendesHalbjahr(alle);
  const ziel = halbjahrZiel(alle, h.id, ziele).wert;
  if (ziel === null) return null;
  const schnitt = halbjahrSchnitt(faecherIm(alle, h.id));
  if (ziel > PUNKTE_MAX) {
    return <div className={klasse} style={{ color: "var(--rot)" }}>
      In {h.name} wären über 15 P nötig, das Ziel ist mit dieser Rechnung nicht mehr erreichbar.</div>;
  }
  return (
    <div className={klasse}>
      In {h.name} brauchst du einen Schnitt von <strong>{punkteText(ziel)} P</strong> (≈ {noteKomma(alsNote(ziel))})
      {schnitt !== null && (schnitt >= ziel ? <>, mit {punkteText(schnitt)} P liegst du darüber.</>
        : <>, gerade stehst du bei {punkteText(schnitt)} P.</>)}
      {schnitt === null && "."}
    </div>
  );
}

/** Alle vier Halbjahre auf einen Blick: Ziel und, wo es ihn gibt, der Schnitt. */
function HalbjahrReihe({ alle, ziele }) {
  const jetzt = laufendesHalbjahr(alle).id;
  return (
    <div className="halbjahr-reihe oben-12">
      {HALBJAHRE.map((h) => {
        const ziel = halbjahrZiel(alle, h.id, ziele).wert;
        const schnitt = halbjahrSchnitt(faecherIm(alle, h.id));
        const erreicht = ziel !== null && schnitt !== null && schnitt >= ziel;
        return (
          <div key={h.id} className={"halbjahr-zelle" + (h.id === jetzt ? " jetzt" : "")}>
            <div className="klein blass">{h.id}</div>
            <div className={"halbjahr-ziel" + (erreicht ? " gut" : "")}>
              {ziel === null ? "—" : ziel > PUNKTE_MAX ? "> 15" : punkteText(ziel)}
            </div>
            <div className="klein blass">{schnitt !== null ? "ist " + punkteText(schnitt) : "Ziel"}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------- Abitur -------------------------------- */

/** Die große Kachel auf der Punkte-Seite. */
export function AbiZiel() {
  const { notenfaecher } = useDaten();
  const [ziele, setzen] = useZiele();
  const [dialog, setDialog] = useState(false);
  const stand = useMemo(() => abiStand(notenfaecher, ziele.abi ?? null), [notenfaecher, ziele.abi]);

  return (
    <div className="zahl-kachel unten-16 ziel-kachel">
      <div className="reihe unten-8">
        <div className="dehnen">
          <div className="klein matt">Abitur</div>
          <div className="ziel-zahl">
            {Math.round(stand.erreicht)}<span className="klein blass"> / {ABI_MAX}</span>
          </div>
        </div>
        <Knopf art="klein" onClick={() => setDialog(true)}>{stand.ziel === null ? "Ziel setzen" : "Ziel ändern"}</Knopf>
      </div>
      <ZielBalken erreicht={stand.erreicht} hochgerechnet={stand.hochgerechnet} ziel={stand.ziel}
        max={ABI_MAX} titel="Abiturpunkte" />
      <div className="klein matt oben-8">
        {stand.hochgerechnet !== null
          ? <>Hochgerechnet <strong>{Math.round(stand.hochgerechnet)}</strong> (≈ {noteKomma(stand.note)})</>
          : "Noch keine Punkte eingetragen"}
        {stand.ziel !== null && <> · Ziel <strong>{stand.ziel}</strong> (≈ {noteKomma(stand.zielNote)})</>}
      </div>
      {(stand.ziel !== null || Object.keys(ziele).some((k) => k !== "abi" && ziele[k] !== null)) && (
        <>
          <BrauchstDu alle={notenfaecher} ziele={ziele} klasse="oben-8" />
          <HalbjahrReihe alle={notenfaecher} ziele={ziele} />
        </>
      )}
      <div className="klein blass oben-8">
        <span className="erklaerung">Grob: jedes Halbjahr gleich, Prüfungen mit deinem Schnitt geschätzt.</span>
        <HilfeLink frage="ziele" titel="Wie wird das Abi-Ziel gerechnet?" />
      </div>
      {dialog && (
        <ZielDialog titel="Ziel fürs Abitur" art="abi" wert={stand.ziel}
          aufSpeichern={(p) => setzen("abi", p)} aufSchliessen={() => setDialog(false)} />
      )}
    </div>
  );
}

/* ------------------------------ Halbjahr ------------------------------- */

/** Ziel und Bedarf eines Halbjahres — in der Schnitt-Kachel des Halbjahres. */
export function HalbjahrZiel({ halbjahr, schnitt }) {
  const { notenfaecher } = useDaten();
  const [ziele, setzen] = useZiele();
  const [dialog, setDialog] = useState(false);
  const gilt = halbjahrZiel(notenfaecher, halbjahr, ziele);
  const ziel = gilt.wert;
  const eigenes = ziele[halbjahr] ?? null;
  const ausAbi = halbjahrZiel(notenfaecher, halbjahr, { abi: ziele.abi }).wert;
  const bedarf = halbjahrBedarf(faecherIm(notenfaecher, halbjahr), ziel);
  const name = HALBJAHRE.find((h) => h.id === halbjahr)?.name || halbjahr;

  return (
    <div className="oben-12">
      <ZielBalken erreicht={schnitt ?? 0} ziel={ziel} max={PUNKTE_MAX} hoehe={8} titel={"Schnitt " + name} />
      <div className="reihe klein oben-8" style={{ gap: 8, flexWrap: "wrap" }}>
        <span className="dehnen matt">
          {ziel === null ? "Kein Ziel für dieses Halbjahr"
            : ziel > PUNKTE_MAX ? <>Fürs Abi-Ziel wären hier über 15 P nötig</>
              : <>Ziel <strong>{punkteText(ziel)} P</strong> (≈ {noteKomma(alsNote(ziel))})
                {gilt.automatisch && <span className="blass"> aus dem Abi-Ziel</span>}
                {schnitt !== null && (schnitt >= ziel ? " · erreicht" : " · noch " + punkteText(ziel - schnitt) + " P")}</>}
        </span>
        <Knopf art="klein leer" onClick={() => setDialog(true)}>{ziel === null ? "Ziel setzen" : "Ändern"}</Knopf>
      </div>
      {bedarf?.offen > 0 && (
        <div className="klein oben-4">
          {bedarf.offen === 1 ? "Das Fach ohne Note braucht " : "Die " + bedarf.offen + " Fächer ohne Note brauchen im Schnitt "}
          <strong>{bedarf.offeneBrauchen > PUNKTE_MAX ? "mehr als 15 P" : bedarf.offeneBrauchen <= 0 ? "nichts mehr" : punkteText(Math.max(0, bedarf.offeneBrauchen)) + " P"}</strong>.
        </div>
      )}
      {dialog && (
        <ZielDialog titel={"Ziel für " + name} art="halbjahr" wert={eigenes ?? ziel} automatisch={ausAbi}
          aufSpeichern={(p) => setzen(halbjahr, p)} aufSchliessen={() => setDialog(false)} />
      )}
    </div>
  );
}

/* ----------------------------- Startseite ------------------------------ */

/**
 * Ganz oben auf der Startseite: der Abi-Balken, der Schnitt in Punkten und
 * Note, das Ziel. Ein Tipp führt zu den Punkten. Ohne Punkte und ohne Ziel
 * steht hier nichts.
 */
export function ZielStreifen({ aufOeffnen }) {
  const { notenfaecher } = useDaten();
  const [ziele] = useZiele();
  const stand = useMemo(() => abiStand(notenfaecher, ziele.abi ?? null), [notenfaecher, ziele.abi]);
  if (stand.schnitt === null && stand.ziel === null) return null;
  return (
    <button type="button" className="ziel-streifen unten-16" onClick={aufOeffnen}>
      <div className="reihe" style={{ gap: 10, marginBottom: 8 }}>
        <span className="klein matt dehnen" style={{ textAlign: "left" }}>
          Abi {Math.round(stand.erreicht)} / {ABI_MAX}
          {stand.ziel !== null && <> · Ziel {stand.ziel}</>}
        </span>
        {stand.schnitt !== null && (
          <span className="klein">
            <strong>{punkteText(stand.schnitt)} P</strong>
            <span className="matt"> · {noteKomma(alsNote(stand.schnitt))}</span>
          </span>
        )}
      </div>
      <ZielBalken erreicht={stand.erreicht} hochgerechnet={stand.hochgerechnet} ziel={stand.ziel}
        max={ABI_MAX} hoehe={8} titel="Abiturpunkte" />
      <LaufendesHalbjahr ziele={ziele} />
    </button>
  );
}

/* Das jüngste Halbjahr mit Fächern — das, das gerade läuft — mit seinem Ziel. */
function LaufendesHalbjahr({ ziele }) {
  const { notenfaecher } = useDaten();
  const h = [...HALBJAHRE].reverse().find((x) => faecherIm(notenfaecher, x.id).length);
  if (!h) return null;
  const faecher = faecherIm(notenfaecher, h.id);
  const schnitt = halbjahrSchnitt(faecher);
  const ziel = halbjahrZiel(notenfaecher, h.id, ziele).wert;
  if (schnitt === null && ziel === null) return null;
  const bedarf = halbjahrBedarf(faecher, ziel);
  return (
    <div className="oben-12">
      <div className="reihe klein" style={{ gap: 10, marginBottom: 6 }}>
        <span className="matt dehnen" style={{ textAlign: "left" }}>
          {h.name}{ziel !== null && <> · Ziel {punkteText(ziel)} P</>}
        </span>
        {schnitt !== null && <strong>{punkteText(schnitt)} P</strong>}
      </div>
      <ZielBalken erreicht={schnitt ?? 0} ziel={ziel} max={PUNKTE_MAX} hoehe={6} titel={"Schnitt " + h.name} />
      <div style={{ textAlign: "left" }}><BrauchstDu alle={notenfaecher} ziele={ziele} klasse="klein matt oben-4" /></div>
      {bedarf?.offen > 0 && bedarf.offeneBrauchen > 0 && (
        <div className="klein blass oben-4" style={{ textAlign: "left" }}>
          {bedarf.offen === 1 ? "Fach ohne Note braucht " : bedarf.offen + " Fächer ohne Note brauchen je "}
          {bedarf.offeneBrauchen > PUNKTE_MAX ? "mehr als 15 P" : punkteText(bedarf.offeneBrauchen) + " P"}
        </div>
      )}
    </div>
  );
}
