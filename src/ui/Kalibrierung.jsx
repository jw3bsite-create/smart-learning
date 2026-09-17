/*
 * Der Kalibrierungsbildschirm.
 *
 * Eine einzige Frage, sechs Wege sie zu beantworten: Stimmt dein Gefühl?
 *
 * Die Zahl, auf die es ankommt, steht oben — wie oft „sicher" tatsächlich
 * richtig war. Wer hier bei 60 % steht, lernt nicht zu wenig, sondern glaubt
 * zu früh, fertig zu sein. Das ist der teuerste Fehler beim Lernen, und er ist
 * ohne Messung unsichtbar.
 */

import React, { useMemo } from "react";
import { useDaten } from "../core/store.jsx";
import { kalibrierung, kalibrierungJeFach } from "../core/kalibrierung.js";
import { KONFIDENZ_NAMEN } from "../core/fsrs.js";
import { gehe } from "../App.jsx";
import { Knopf, Leer } from "./basis.jsx";

const STUFEN_FARBE = { 1: "var(--gruen)", 2: "var(--gelb)", 3: "var(--rot)" };

function Streifenbalken({ anteil, farbe, beschriftung }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="reihe klein" style={{ marginBottom: 4 }}>
        <span className="dehnen">{beschriftung}</span>
        <span className="mono">{anteil === null ? "—" : Math.round(anteil * 100) + " %"}</span>
      </div>
      <div className="balken" style={{ height: 10 }}>
        <span style={{ width: (anteil === null ? 0 : anteil * 100) + "%", background: farbe }} />
      </div>
    </div>
  );
}

export default function Kalibrierung() {
  const { reviews, faecher } = useDaten();

  const gesamt = useMemo(() => kalibrierung(reviews), [reviews]);
  const jeFach = useMemo(() => kalibrierungJeFach(reviews), [reviews]);

  const unecht = useMemo(
    () => reviews.filter((r) => r.flag === "implausible").length, [reviews]);
  const geuebt = useMemo(
    () => reviews.filter((r) => r.flag === "practice").length, [reviews]);

  /* Entwicklung: die letzten dreißig Tage gegen alles davor. */
  const entwicklung = useMemo(() => {
    const grenze = Date.now() - 30 * 86400000;
    return {
      jung: kalibrierung(reviews.filter((r) => r.zeit >= grenze)),
      alt: kalibrierung(reviews.filter((r) => r.zeit < grenze)),
    };
  }, [reviews]);

  if (!gesamt.gesamt) {
    return (
      <div className="mitte">
        <div className="kopfzeile"><h1>Kalibrierung</h1></div>
        <Leer symbol="auge" titel="Noch nichts zu messen"
          text="Sobald du im Abrufen ein paar Mal eingeschätzt hast, wie sicher du dir bist, steht hier, ob dein Gefühl stimmt.">
          <Knopf art="voll" symbol="blitz" onClick={() => gehe("/abrufen")}>Abrufen</Knopf>
        </Leer>
      </div>
    );
  }

  const treffer = gesamt.ueberschaetzung === null ? null : 1 - gesamt.ueberschaetzung;

  return (
    <div className="mitte" style={{ maxWidth: 820 }}>
      <div className="kopfzeile"><h1>Kalibrierung</h1></div>

      <div className="zahl-kachel" style={{ marginBottom: 24, textAlign: "center", padding: 26 }}>
        <div className="klein matt">Wenn du „sicher" sagst, stimmt es</div>
        <div style={{ fontFamily: "var(--serifen)", fontSize: 58, lineHeight: 1.1,
          color: treffer === null ? undefined
            : treffer >= 0.9 ? "var(--gruen)" : treffer >= 0.75 ? "var(--gelb)" : "var(--rot)" }}>
          {treffer === null ? "—" : Math.round(treffer * 100) + " %"}
        </div>
        <p className="matt" style={{ maxWidth: 460, margin: "8px auto 0" }}>
          {treffer === null ? "Noch keine Einschätzungen."
            : treffer >= 0.9
              ? "Dein Gefühl ist verlässlich. Du darfst dir glauben."
              : treffer >= 0.75
                ? "Brauchbar, aber du bist etwas zu zuversichtlich. Sieh dir an, in welchem Fach."
                : "Du hältst dich für sicherer, als du bist. Das ist der teuerste Fehler beim Lernen, und der Grund, warum Wiederlesen sich gut anfühlt und wenig bringt."}
        </p>
      </div>

      <h3 style={{ marginBottom: 12 }}>Wie oft du gewusst hast, was du gesagt hast</h3>
      <div className="zahl-kachel" style={{ marginBottom: 24 }}>
        {[1, 2, 3].map((s) => (
          <Streifenbalken key={s} anteil={gesamt.stufen[s].quote} farbe={STUFEN_FARBE[s]}
            beschriftung={`„${KONFIDENZ_NAMEN[s]}": ${gesamt.stufen[s].gewusst} von ${gesamt.stufen[s].anzahl} gewusst`} />
        ))}
        <p className="klein matt" style={{ marginTop: 4 }}>
          Ideal wäre eine fallende Treppe: oben hoch, unten niedrig. Liegen die
          drei Balken dicht beieinander, sagt deine Einschätzung nichts aus,
          dann rate weniger und horch genauer hin, ehe du aufdeckst.
        </p>
      </div>

      {faecher.length > 0 && (
        <>
          <h3 style={{ marginBottom: 12 }}>Nach Fach</h3>
          <div style={{ display: "grid", gap: 8, marginBottom: 24 }}>
            {faecher.map((f) => {
              const k = jeFach[f.id];
              if (!k || !k.stufen[1].anzahl) return null;
              const t = 1 - k.ueberschaetzung;
              return (
                <div key={f.id} className="karten-zeile" style={{ padding: "12px 16px" }}>
                  <div className="seite reihe" style={{ gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3,
                      background: f.farbe || "var(--akzent)", display: "block" }} />
                    <span>{f.name}</span>
                  </div>
                  <div className="seite">
                    <div className="balken" style={{ height: 8 }}>
                      <span style={{ width: t * 100 + "%",
                        background: t >= 0.9 ? "var(--gruen)" : t >= 0.75 ? "var(--gelb)" : "var(--rot)" }} />
                    </div>
                  </div>
                  <div className="klein mono">
                    {Math.round(t * 100)} %
                    <span className="blass"> ({k.stufen[1].anzahl})</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {entwicklung.alt.stufen[1].anzahl > 5 && entwicklung.jung.stufen[1].anzahl > 5 && (
        <>
          <h3 style={{ marginBottom: 12 }}>Entwicklung</h3>
          <div className="zahl-kachel" style={{ marginBottom: 24 }}>
            <Streifenbalken anteil={1 - entwicklung.alt.ueberschaetzung} farbe="var(--rand)"
              beschriftung="früher" />
            <Streifenbalken anteil={1 - entwicklung.jung.ueberschaetzung} farbe="var(--akzent)"
              beschriftung="letzte 30 Tage" />
          </div>
        </>
      )}

      <h3 style={{ marginBottom: 12 }}>Sauberkeit der Daten</h3>
      <div className="zahl-kachel">
        <div className="reihe umbruch" style={{ gap: 24 }}>
          <div>
            <div className="klein matt">Gewertete Abrufe</div>
            <div className="zahl">{gesamt.gesamt}</div>
          </div>
          <div>
            <div className="klein matt">Nur geübt</div>
            <div className="zahl">{geuebt}</div>
            <div className="klein blass">aus den Übungsmodi</div>
          </div>
          <div>
            <div className="klein matt">Durchgeklickt</div>
            <div className="zahl" style={{ color: unecht ? "var(--gelb)" : undefined }}>{unecht}</div>
            <div className="klein blass">zu schnell, um echt zu sein</div>
          </div>
        </div>
        <p className="klein matt" style={{ marginTop: 12 }}>
          Zu schnell beantwortete Karten werden festgehalten, zählen aber weder
          für den Plan noch für die Strähne. Sie schaden nicht, sie zeigen nur,
          wann eine Sitzung eigentlich keine war.
        </p>
      </div>
    </div>
  );
}
