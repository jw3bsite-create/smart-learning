/*
 * Die Flamme — und die zweite Zahl daneben.
 *
 * Die Strähne allein wäre gefährlich: Sie belohnt Beharrlichkeit, und
 * Beharrlichkeit fühlt sich an wie Fortschritt. Darum steht hier immer beides
 * nebeneinander — wie oft du da warst, und wie gut dein Gefühl trägt. Nur
 * zusammen ergeben sie ein ehrliches Bild.
 */

import React, { useId, useMemo } from "react";
import { useDaten } from "../core/store.jsx";
import { straehne, laengsteStraehne, TAGESPENSUM, RUHETAGE_JE_MONAT } from "../core/straehne.js";
import { kalibrierung } from "../core/kalibrierung.js";
import { istFaellig } from "../core/fsrs.js";
import { anzahl } from "../core/util.js";
import { gehe } from "../App.jsx";
import { Symbol, Knopf, KLICKBAR } from "./basis.jsx";

/*
 * Das Zeichen der Flamme. Brennt sie (heute geschafft), flackert sie sanft:
 * zwei Zungen, die sich gegeneinander und ungleichmäßig bewegen, damit es
 * nicht nach Taktgeber aussieht. Sonst steht da nur ihr Umriss, still.
 * „Ruhige Oberfläche“ und „Bewegung reduzieren“ halten sie an (stil.css).
 */
export function FlammeZeichen({ an, groesse = 16 }) {
  const kennung = useId().replace(/:/g, "");
  if (!an) {
    return (
      <svg className="flamme-zeichen" width={groesse} height={groesse} viewBox="0 0 24 24" aria-hidden="true"
        fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" style={{ flex: "none" }}>
        <path d={AUSSEN} />
      </svg>
    );
  }
  return (
    <svg className="flamme-zeichen an" width={groesse} height={groesse} viewBox="0 0 24 24" aria-hidden="true"
      style={{ flex: "none", overflow: "visible" }}>
      <defs>
        <linearGradient id={"fa" + kennung} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffc14d" />
          <stop offset="1" stopColor="#ff6a3d" />
        </linearGradient>
        <linearGradient id={"fi" + kennung} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3c4" />
          <stop offset="1" stopColor="#ffc24f" />
        </linearGradient>
      </defs>
      <path className="aussen" d={AUSSEN} fill={"url(#fa" + kennung + ")"} />
      <path className="innen" d={INNEN} fill={"url(#fi" + kennung + ")"} />
    </svg>
  );
}

const AUSSEN = "M12 2.5c.7 3.1 2.6 4.8 4.3 6.8 1.4 1.7 2.2 3.5 2.2 5.7 0 3.9-2.9 6.5-6.5 6.5S5.5 18.9 5.5 15c0-2.6 1.3-4.4 2.6-5.8.3 1.4 1.1 2.4 2.2 2.8-.4-3.4.5-6.8 1.7-9.5z";
const INNEN = "M12 21.3c-2 0-3.4-1.4-3.4-3.3 0-1.8 1.3-2.9 2.3-4.2.3 1 .9 1.6 1.6 1.8-.1-1.4.4-2.6 1.2-3.6.9 1.6 2.2 2.9 2.2 5.4 0 2.3-1.7 3.9-3.9 3.9z";

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
      <div {...KLICKBAR} className="baum-zeile" onClick={() => gehe("/statistik")}
        title={stand.heuteGeschafft
          ? "Heute erledigt" : stand.fehlendHeute + " Abrufe fehlen heute"}>
        <span className="pfeil" />
        <span className="sinnbild ton-orange"><FlammeZeichen an={stand.heuteGeschafft} groesse={16} /></span>
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
            <FlammeZeichen an={stand.heuteGeschafft} groesse={17} /> Strähne
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
          <div className="klein blass oben-8">
            {stand.heuteGeschafft
              ? "Pensum geschafft: " + anzahl(stand.heuteAbrufe, "Abruf", "Abrufe")
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
          : ` ${stand.ruhetageUebrig} Ruhetage übrig, eine Lücke reißt die Strähne nicht.`}
      </p>

      {!stand.heuteGeschafft && faellig > 0 && (
        <Knopf art="voll" symbol="blitz" style={{ marginTop: 16 }}
          onClick={() => gehe("/abrufen")}>
          {anzahl(faellig, "Karte abrufen", "Karten abrufen")}
        </Knopf>
      )}
    </div>
  );
}
