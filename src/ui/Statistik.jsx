/*
 * Fortschritt: Strähne, Tagesübersicht der letzten Wochen, Beherrschung je
 * Stapel und die letzten Sitzungen.
 */

import React, { useMemo } from "react";
import { useDaten } from "../core/store.jsx";
import { anteileNachStufe } from "../core/fsrs.js";
import { fachZaehlung, stapelStand } from "../core/warteschlange.js";
import { tagesSchluessel, anzahl, datumKurz, zeitLang } from "../core/util.js";
import { behaltenskurve } from "../core/kalibrierung.js";
import { eigenleistung } from "../core/generator.js";
import { gehe } from "../App.jsx";
import { Symbol, Balken, Leer, Knopf } from "./basis.jsx";
import Flamme from "./Flamme.jsx";

const MODUS_NAME = {
  karten: "Karteikarten", lernen: "Lernen", schreiben: "Schreiben",
  buchstabieren: "Buchstabieren", test: "Test", zuordnen: "Zuordnen", meteor: "Meteor",
};

export default function Statistik() {
  const { stapel, karten, kartenNachStapel, zustaende, stapelVon, sitzungen, reviews } = useDaten();

  const tage = useMemo(() => {
    const nach = new Map();
    for (const s of sitzungen) {
      const t = s.tag || tagesSchluessel(s.zeit);
      nach.set(t, (nach.get(t) || 0) + (s.gesamt || 0));
    }
    return nach;
  }, [sitzungen]);



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
    const anteile = anteileNachStufe(Object.values(zustaende));
    const zaehlung = fachZaehlung(karten, zustaende, stapelVon, null);
    return { anteile, ...zaehlung, beherrscht: anteile[3] };
  }, [karten, zustaende, stapelVon]);

  const letzte = [...sitzungen].sort((a, b) => b.zeit - a.zeit).slice(0, 12);
  const kurve = useMemo(() => behaltenskurve(reviews), [reviews]);
  const eigen = useMemo(() => eigenleistung(karten), [karten]);
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

      <div style={{ marginBottom: 26 }}><Flamme /></div>

      <div className="gitter" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", marginBottom: 26 }}>
        <div className="zahl-kachel">
          <div className="reihe klein matt"><Symbol name="haken" groesse={15} /> Beherrscht</div>
          <div className="zahl">{gesamt.beherrscht}</div>
          <div className="klein blass">von {karten.length} Karten</div>
        </div>
        <div className="zahl-kachel">
          <div className="reihe klein matt"><Symbol name="uhr" groesse={15} /> Heute fällig</div>
          <div className="zahl">{gesamt.faellig}</div>
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

      {/* ------------------------- Behaltenskurve ------------------------- */}
      {kurve.some((k) => k.gesamt > 2) && (
        <>
          <h3 style={{ marginBottom: 4 }}>Wie gut du behältst</h3>
          <p className="klein matt" style={{ marginTop: 0, marginBottom: 12 }}>
            Gemessen, nicht geschätzt: Wie oft du eine Karte nach diesem Abstand
            noch wusstest. Das ist die ehrlichste Zahl dieser App — und die
            einzige, die etwas darüber sagt, ob das Lernen hält.
          </p>
          <div className="zahl-kachel" style={{ marginBottom: 26 }}>
            {kurve.filter((k) => k.gesamt > 0).map((k) => (
              <div key={k.tage} style={{ marginBottom: 12 }}>
                <div className="reihe klein" style={{ marginBottom: 4 }}>
                  <span className="dehnen">
                    {k.tage === 1 ? "nach einem Tag"
                      : k.tage < 30 ? "nach " + k.tage + " Tagen"
                        : k.tage < 365 ? "nach " + Math.round(k.tage / 30) + " Monaten"
                          : "nach einem Jahr"}
                  </span>
                  <span className="mono">
                    {k.quote === null ? "—" : Math.round(k.quote * 100) + " %"}
                  </span>
                  <span className="blass">({k.gesamt})</span>
                </div>
                <div className="balken" style={{ height: 9 }}>
                  <span style={{ width: (k.quote || 0) * 100 + "%",
                    background: (k.quote || 0) >= 0.85 ? "var(--gruen)"
                      : (k.quote || 0) >= 0.7 ? "var(--akzent)" : "var(--gelb)" }} />
                </div>
              </div>
            ))}
            <p className="klein blass" style={{ marginTop: 4 }}>
              Ein Abfall über die Zeit ist normal und eingeplant — deshalb kommen
              die Karten wieder. Fällt es unter zwei Drittel, ist die
              Ziel-Sicherheit des Fachs zu niedrig eingestellt.
            </p>
          </div>
        </>
      )}

      {/* -------------------------- Eigenleistung ------------------------- */}
      {eigen.gesamt > 0 && (eigen.ki_uebernommen > 0 || eigen.ki_vorderseite > 0) && (
        <>
          <h3 style={{ marginBottom: 4 }}>Woher deine Karten kommen</h3>
          <p className="klein matt" style={{ marginTop: 0, marginBottom: 12 }}>
            Ein Deck, das überwiegend aus übernommenen Vorschlägen besteht, ist
            voll und das Gedächtnis leer. Darum steht die Zahl hier.
          </p>
          <div className="zahl-kachel" style={{ marginBottom: 26 }}>
            <div className="balken" style={{ height: 14 }}>
              <span className="fest" style={{ width: 100 * eigen.selbst / eigen.gesamt + "%" }} />
              <span className="vertraut" style={{ width: 100 * eigen.ki_vorderseite / eigen.gesamt + "%" }} />
              <span className="lernen" style={{ width: 100 * eigen.einfuhr / eigen.gesamt + "%" }} />
              <span className="neu" style={{ width: 100 * eigen.ki_uebernommen / eigen.gesamt + "%" }} />
            </div>
            <div className="reihe klein matt" style={{ marginTop: 10, flexWrap: "wrap", gap: 14 }}>
              <span>selbst geschrieben: {eigen.selbst}</span>
              <span>Rückseite selbst: {eigen.ki_vorderseite}</span>
              <span>aus Listen: {eigen.einfuhr}</span>
              <span style={{ color: eigen.anteilUebernommen > 0.3 ? "var(--gelb)" : undefined }}>
                Vorschlag übernommen: {eigen.ki_uebernommen}
              </span>
            </div>
            {eigen.anteilUebernommen > 0.3 && (
              <p className="klein" style={{ color: "var(--gelb)", marginTop: 8, marginBottom: 0 }}>
                Über ein Drittel deiner Karten hast du unverändert übernommen.
                Schreib die Rückseiten öfter selbst — der Unterschied ist genau
                das, was hängen bleibt.
              </p>
            )}
          </div>
        </>
      )}

      <h3 style={{ marginBottom: 10 }}>Nach Stapel</h3>
      <div style={{ display: "grid", gap: 10, marginBottom: 28 }}>
        {stapel.map((s) => {
          const eigene = kartenNachStapel.get(s.id) || [];
          if (!eigene.length) return null;
          const stand = stapelStand(eigene, zustaende, s);
          const anteile = anteileNachStufe(stand.zustaende);
          const anteil = Math.round(100 * (anteile[3] + anteile[2] * 0.6)
            / Math.max(1, stand.gesamt));
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
