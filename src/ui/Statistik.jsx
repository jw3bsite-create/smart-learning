/*
 * Fortschritt: Strähne, Tagesübersicht der letzten Wochen, Beherrschung je
 * Stapel und die letzten Sitzungen.
 */

import React, { useMemo } from "react";
import { useDaten } from "../core/store.jsx";
import { anteileNachStufe } from "../core/model.js";
import { faelligZaehlen } from "../core/scheduler.js";
import { straehne, tagesSchluessel, anzahl, datumKurz, zeitLang } from "../core/util.js";
import { gehe } from "../App.jsx";
import { Symbol, Balken, Leer, Knopf } from "./basis.jsx";

const MODUS_NAME = {
  karten: "Karteikarten", lernen: "Lernen", schreiben: "Schreiben",
  buchstabieren: "Buchstabieren", test: "Test", zuordnen: "Zuordnen", meteor: "Meteor",
};

export default function Statistik() {
  const { stapel, karten, kartenNachStapel, staende, sitzungen } = useDaten();

  const tage = useMemo(() => {
    const nach = new Map();
    for (const s of sitzungen) {
      const t = s.tag || tagesSchluessel(s.zeit);
      nach.set(t, (nach.get(t) || 0) + (s.gesamt || 0));
    }
    return nach;
  }, [sitzungen]);

  const strecke = straehne([...tage.keys()]);

  /* Die letzten 91 Tage als Streifen, beginnend am ältesten. */
  const streifen = useMemo(() => {
    const liste = [];
    const d = new Date();
    d.setDate(d.getDate() - 90);
    for (let i = 0; i < 91; i++) {
      const schluessel = tagesSchluessel(d.getTime());
      const zahl = tage.get(schluessel) || 0;
      liste.push({ schluessel, zahl,
        stufe: zahl === 0 ? 0 : zahl < 10 ? 1 : zahl < 30 ? 2 : 3 });
      d.setDate(d.getDate() + 1);
    }
    return liste;
  }, [tage]);

  const gesamt = useMemo(() => {
    const anteile = anteileNachStufe(karten, staende);
    const zaehlung = faelligZaehlen(karten, staende);
    return { anteile, ...zaehlung };
  }, [karten, staende]);

  const letzte = [...sitzungen].sort((a, b) => b.zeit - a.zeit).slice(0, 12);
  const heute = tage.get(tagesSchluessel()) || 0;

  if (!karten.length) {
    return (
      <div className="mitte">
        <Leer symbol="statistik" titel="Noch nichts zu zeigen"
          text="Sobald du lernst, sammeln sich hier Zahlen an.">
          <Knopf art="voll" onClick={() => gehe("/")}>Zur Übersicht</Knopf>
        </Leer>
      </div>
    );
  }

  return (
    <div className="mitte">
      <div className="kopfzeile"><h1>Fortschritt</h1></div>

      <div className="gitter" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", marginBottom: 26 }}>
        <div className="zahl-kachel">
          <div className="reihe klein matt"><Symbol name="feuer" groesse={15} /> Strähne</div>
          <div className="zahl">{strecke}</div>
          <div className="klein blass">{strecke === 1 ? "Tag" : "Tage"} in Folge</div>
        </div>
        <div className="zahl-kachel">
          <div className="reihe klein matt"><Symbol name="haken" groesse={15} /> Beherrscht</div>
          <div className="zahl">{gesamt.beherrscht}</div>
          <div className="klein blass">von {karten.length} Karten</div>
        </div>
        <div className="zahl-kachel">
          <div className="reihe klein matt"><Symbol name="uhr" groesse={15} /> Heute fällig</div>
          <div className="zahl">{gesamt.faellige}</div>
          <div className="klein blass">{heute} Antworten heute</div>
        </div>
        <div className="zahl-kachel">
          <div className="reihe klein matt"><Symbol name="stapel" groesse={15} /> Bestand</div>
          <div className="zahl">{stapel.length}</div>
          <div className="klein blass">{anzahl(karten.length, "Karte", "Karten")}</div>
        </div>
      </div>

      <h3 style={{ marginBottom: 10 }}>Die letzten drei Monate</h3>
      <div className="streifen" style={{ marginBottom: 8 }}>
        {streifen.map((t) => (
          <i key={t.schluessel} data-stufe={t.stufe}
            title={t.schluessel + ": " + t.zahl + " Antworten"} />
        ))}
      </div>
      <div className="klein blass" style={{ marginBottom: 28 }}>
        Je dunkler, desto mehr beantwortete Karten an diesem Tag.
      </div>

      <h3 style={{ marginBottom: 10 }}>Nach Stapel</h3>
      <div style={{ display: "grid", gap: 10, marginBottom: 28 }}>
        {stapel.map((s) => {
          const eigene = kartenNachStapel.get(s.id) || [];
          if (!eigene.length) return null;
          const anteile = anteileNachStufe(eigene, staende);
          const anteil = Math.round(100 * (anteile[3] + anteile[2] * 0.6) / eigene.length);
          return (
            <div key={s.id} className="zahl-kachel" style={{ cursor: "pointer" }}
              onClick={() => gehe("/stapel/" + s.id)}>
              <div className="reihe" style={{ marginBottom: 8 }}>
                <div className="dehnen">{s.title}</div>
                <span className="klein matt mono">{anteil} %</span>
              </div>
              <Balken anteile={anteile} />
              <div className="klein blass" style={{ marginTop: 6 }}>
                {anzahl(eigene.length, "Karte", "Karten")} · {anteile[3]} beherrscht
              </div>
            </div>
          );
        })}
      </div>

      {letzte.length > 0 && (
        <>
          <h3 style={{ marginBottom: 10 }}>Zuletzt gelernt</h3>
          <div style={{ display: "grid", gap: 6 }}>
            {letzte.map((s) => {
              const name = stapel.find((x) => x.id === s.setId)?.title || "Gelöschter Stapel";
              return (
                <div key={s.id} className="karten-zeile" style={{ padding: "10px 14px" }}>
                  <div className="seite">
                    <div>{name}</div>
                    <div className="klein blass">{MODUS_NAME[s.modus] || s.modus}</div>
                  </div>
                  <div className="seite klein matt">
                    {s.gesamt ? `${s.richtig} von ${s.gesamt} richtig` : ""}
                    {s.dauer ? ` · ${zeitLang(s.dauer)}` : ""}
                    {s.punkte ? ` · ${s.punkte} Punkte` : ""}
                  </div>
                  <div className="klein blass">{datumKurz(s.zeit)}</div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
