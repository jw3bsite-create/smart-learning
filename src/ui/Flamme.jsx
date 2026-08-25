/*
 * Die Flamme — und die zweite Zahl daneben.
 *
 * Die Strähne allein wäre gefährlich: Sie belohnt Beharrlichkeit, und
 * Beharrlichkeit fühlt sich an wie Fortschritt. Darum steht hier immer beides
 * nebeneinander — wie oft du da warst, und wie gut dein Gefühl trägt. Nur
 * zusammen ergeben sie ein ehrliches Bild.
 */

import React, { useMemo } from "react";
import { useDaten } from "../core/store.jsx";
import { straehne, laengsteStraehne, TAGESPENSUM, RUHETAGE_JE_MONAT } from "../core/straehne.js";
import { kalibrierung } from "../core/kalibrierung.js";
import { istFaellig } from "../core/fsrs.js";
import { anzahl } from "../core/util.js";
import { gehe } from "../App.jsx";
import { Symbol, Knopf } from "./basis.jsx";

export default function Flamme({ knapp = false }) {
  const { reviews, zustaende } = useDaten();

  const stand = useMemo(() => straehne(reviews), [reviews]);
  const beste = useMemo(() => laengsteStraehne(reviews), [reviews]);
  const kal = useMemo(() => kalibrierung(reviews), [reviews]);
  const faellig = useMemo(
    () => Object.values(zustaende).filter((z) => istFaellig(z)).length, [zustaende]);

  const treffer = kal.ueberschaetzung === null ? null : 1 - kal.ueberschaetzung;
  const farbe = stand.heuteGeschafft ? "var(--gelb)" : "var(--schrift-blass)";

  /* Kurze Fassung für die Seitenleiste. */
  if (knapp) {
    return (
      <div className="baum-zeile" onClick={() => gehe("/statistik")}
        title={stand.heuteGeschafft
          ? "Heute erledigt" : stand.fehlendHeute + " Abrufe fehlen heute"}>
        <span className="pfeil" />
        <Symbol name="feuer" groesse={16} fuell={stand.heuteGeschafft}
          style={{ color: farbe }} />
        <span className="name dehnen">{stand.laenge}</span>
        {treffer !== null && (
          <span className="klein blass mono">{Math.round(treffer * 100)} %</span>
        )}
      </div>
    );
  }

  return (
    <div className="zahl-kachel">
      <div className="reihe umbruch" style={{ gap: 24 }}>
        {/* Beharrlichkeit */}
        <div style={{ minWidth: 150 }}>
          <div className="reihe klein matt">
            <Symbol name="feuer" groesse={15} style={{ color: farbe }} /> Strähne
          </div>
          <div className="zahl" style={{ color: farbe }}>{stand.laenge}</div>
          <div className="klein blass">
            {stand.laenge === 1 ? "Tag" : "Tage"} in Folge
            {beste > stand.laenge ? " · längste " + beste : ""}
          </div>
        </div>

        {/* Können */}
        <div style={{ minWidth: 150 }}>
          <div className="reihe klein matt">
            <Symbol name="auge" groesse={15} /> Kalibrierung
          </div>
          <div className="zahl" style={{
            color: treffer === null ? undefined
              : treffer >= 0.9 ? "var(--gruen)" : treffer >= 0.75 ? "var(--gelb)" : "var(--rot)",
          }}>
            {treffer === null ? "—" : Math.round(treffer * 100) + " %"}
          </div>
          <div className="klein blass">wenn du „sicher“ sagst</div>
        </div>

        <div className="dehnen" />

        {/* Heute */}
        <div style={{ minWidth: 190 }}>
          <div className="klein matt">Heute</div>
          <div className="balken" style={{ height: 10, marginTop: 6 }}>
            <span className="fest" style={{
              width: Math.min(100, 100 * stand.heuteAbrufe / TAGESPENSUM) + "%" }} />
          </div>
          <div className="klein blass" style={{ marginTop: 6 }}>
            {stand.heuteGeschafft
              ? "Pensum geschafft — " + anzahl(stand.heuteAbrufe, "Abruf", "Abrufe")
              : stand.heuteAbrufe + " von " + TAGESPENSUM + " Abrufen"}
            {faellig > 0 && !stand.heuteGeschafft
              && " · " + faellig + " fällig"}
          </div>
        </div>
      </div>

      <p className="klein blass" style={{ marginTop: 12, marginBottom: 0 }}>
        Gezählt werden abgerufene Karten, nicht geöffnete Fenster. Zu schnell
        Beantwortetes zählt nicht.
        {stand.verbrauchteRuhetage > 0
          ? ` ${anzahl(stand.verbrauchteRuhetage, "Ruhetag", "Ruhetage")} verbraucht, `
            + `${stand.ruhetageUebrig} von ${RUHETAGE_JE_MONAT} übrig.`
          : ` ${stand.ruhetageUebrig} Ruhetage übrig — eine Lücke reißt die Strähne nicht.`}
      </p>

      {!stand.heuteGeschafft && faellig > 0 && (
        <Knopf art="voll" symbol="blitz" style={{ marginTop: 14 }}
          onClick={() => gehe("/abrufen")}>
          {anzahl(faellig, "Karte abrufen", "Karten abrufen")}
        </Knopf>
      )}
    </div>
  );
}
