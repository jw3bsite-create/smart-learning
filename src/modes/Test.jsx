/*
 * Test: eine kleine Klassenarbeit.
 *
 * Alle Fragen stehen auf einer Seite, beantwortet wird ohne Rückmeldung, erst
 * am Ende wird ausgewertet — so merkt man, was wirklich sitzt. Die Auswertung
 * geht auch in den Lernstand ein.
 */

import React, { useState } from "react";
import { pruefe } from "../core/text.js";
import { mische, ziehe } from "../core/util.js";
import { gehe } from "../App.jsx";
import { Knopf, Symbol, Bild, Leer } from "../ui/basis.jsx";
import {
  useModus, useBrauchbar, ModusRahmen, Seite, Wahl, RICHTUNGEN, seitenFuer, sprachenFuer,
} from "./gemeinsam.jsx";

/** Baut die Fragen zusammen. */
function baueFragen(karten, { anzahl, arten, richtung }) {
  const gewaehlt = ziehe(karten, anzahl);
  const fragen = [];
  const moegliche = Object.entries(arten).filter(([, an]) => an).map(([k]) => k);
  if (!moegliche.length) moegliche.push("auswahl");

  // Zuordnen kommt als eine Aufgabe mit fünf Paaren, nicht je Karte.
  const mitZuordnen = moegliche.includes("zuordnen");
  const uebrige = moegliche.filter((a) => a !== "zuordnen");
  let zuordnenKarten = [];
  let rest = gewaehlt;
  if (mitZuordnen && gewaehlt.length >= 4) {
    const wieViele = Math.min(5, Math.max(4, Math.floor(gewaehlt.length / 4)));
    zuordnenKarten = gewaehlt.slice(0, wieViele);
    rest = gewaehlt.slice(wieViele);
  }

  rest.forEach((karte, i) => {
    const r = richtung === "beide" ? (i % 2 ? "dt" : "td") : richtung;
    const art = uebrige.length ? uebrige[i % uebrige.length] : "auswahl";
    const seiten = seitenFuer(karte, r);
    const frage = { id: "f" + i + karte.id, art, karte, richtung: r, seiten };
    if (art === "auswahl") {
      const andere = karten.filter((k) => k.id !== karte.id);
      frage.moeglichkeiten = mische([
        { id: karte.id, ...seitenFuer(karte, r) },
        ...ziehe(andere, 3).map((k) => ({ id: k.id, ...seitenFuer(k, r) })),
      ]);
    }
    if (art === "wahrFalsch") {
      const stimmt = Math.random() < 0.5;
      const andere = karten.filter((k) => k.id !== karte.id);
      const fremd = andere.length ? seitenFuer(ziehe(andere, 1)[0], r) : seiten;
      frage.behauptung = stimmt
        ? { text: seiten.antwort, bild: seiten.antwortBild, stimmt: true }
        : { text: fremd.antwort, bild: fremd.antwortBild, stimmt: false };
    }
    fragen.push(frage);
  });

  if (zuordnenKarten.length) {
    const r = richtung === "dt" ? "dt" : "td";
    fragen.push({
      id: "zuordnen", art: "zuordnen", richtung: r,
      paare: zuordnenKarten.map((k) => ({ karte: k, ...seitenFuer(k, r) })),
      optionen: mische(zuordnenKarten.map((k) => ({ id: k.id, ...seitenFuer(k, r) }))),
    });
  }

  return mische(fragen);
}

export default function Test({ setId, aufSchliessen }) {
  const { derStapel, karten, einstellungen, antwortVerbuchen, sitzungMerken } = useModus(setId);
  const [richtung, setRichtung] = useState("td");
  const [nurMarkierte, setNurMarkierte] = useState(false);
  const [wieViele, setWieViele] = useState(20);
  const [arten, setArten] = useState({ schreiben: true, auswahl: true, wahrFalsch: true, zuordnen: true });
  const [fragen, setFragen] = useState(null);
  const [antworten, setAntworten] = useState({});
  const [auswertung, setAuswertung] = useState(null);

  const brauchbare = useBrauchbar(karten, nurMarkierte);
  const sprachen = sprachenFuer(derStapel, richtung === "dt" ? "dt" : "td");
  const hoechstzahl = Math.min(50, brauchbare.length);

  const beginnen = () => {
    setFragen(baueFragen(brauchbare, {
      anzahl: Math.min(wieViele, brauchbare.length), arten, richtung,
    }));
    setAntworten({}); setAuswertung(null);
  };

  const abgeben = () => {
    let richtig = 0, gesamt = 0;
    const einzeln = {};
    for (const frage of fragen) {
      if (frage.art === "zuordnen") {
        for (const paar of frage.paare) {
          gesamt++;
          const gewaehlt = antworten[frage.id]?.[paar.karte.id];
          const gut = gewaehlt === paar.karte.id;
          einzeln[frage.id + ":" + paar.karte.id] = gut;
          if (gut) richtig++;
          antwortVerbuchen(paar.karte, frage.richtung, gut ? 2 : 0);
        }
        continue;
      }
      gesamt++;
      const gegeben = antworten[frage.id];
      let gut = false;
      if (frage.art === "schreiben") {
        const ergebnis = pruefe(gegeben || "", frage.seiten.antwort, {
          tippfehlerErlauben: einstellungen.tippfehlerErlauben,
          ohneArtikel: einstellungen.ohneArtikel,
          zeichenEgal: einstellungen.zeichenEgal,
          satzzeichenEgal: einstellungen.satzzeichenEgal,
        });
        gut = ergebnis.status !== "falsch";
      } else if (frage.art === "auswahl") gut = gegeben === frage.karte.id;
      else if (frage.art === "wahrFalsch") gut = gegeben === frage.behauptung.stimmt;
      einzeln[frage.id] = gut;
      if (gut) richtig++;
      antwortVerbuchen(frage.karte, frage.richtung, gut ? 2 : 0);
    }
    setAuswertung({ richtig, gesamt, einzeln });
    sitzungMerken({ setId, modus: "test", gesamt, richtig });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const antwortSetzen = (id, wert) => setAntworten((alt) => ({ ...alt, [id]: wert }));

  if (brauchbare.length < 2) {
    return (
      <ModusRahmen titel="Test" symbol="papier" aufSchliessen={aufSchliessen}>
        <Leer titel="Zu wenige Karten" text="Für einen Test braucht es mindestens zwei Karten.">
          <Knopf onClick={() => gehe("/stapel/" + setId + "/bearbeiten")}>Karten anlegen</Knopf>
        </Leer>
      </ModusRahmen>
    );
  }

  /* ------------------------------ Vorbereitung -------------------------- */
  if (!fragen) {
    return (
      <ModusRahmen titel="Test" symbol="papier" aufSchliessen={aufSchliessen}>
        <h1>{derStapel.title}</h1>
        <p className="matt">Aufgaben zusammenstellen und ohne Zwischenrufe durcharbeiten.</p>
        <div style={{ display: "grid", gap: 12, marginTop: 20, maxWidth: 460 }}>
          <label>
            <span className="beschriftung">Anzahl der Fragen (höchstens {hoechstzahl})</span>
            <input className="feld" type="number" min="1" max={hoechstzahl} value={wieViele}
              onChange={(e) => setWieViele(Math.max(1, Math.min(hoechstzahl, Number(e.target.value) || 1)))} />
          </label>
          <Wahl beschriftung="Abfrage" wert={richtung} setzen={setRichtung}
            moeglichkeiten={RICHTUNGEN(derStapel)} />
          <div>
            <span className="beschriftung">Aufgabenarten</span>
            {[["schreiben", "Schreiben"], ["auswahl", "Auswahl"],
              ["wahrFalsch", "Wahr oder falsch"], ["zuordnen", "Zuordnen"]].map(([k, n]) => (
              <label key={k} className="schalter">
                <input type="checkbox" checked={arten[k]}
                  onChange={(e) => setArten({ ...arten, [k]: e.target.checked })} />
                <span>{n}</span>
              </label>
            ))}
          </div>
          <label className="schalter">
            <input type="checkbox" checked={nurMarkierte}
              onChange={(e) => setNurMarkierte(e.target.checked)} />
            <span>Nur markierte Karten</span>
          </label>
        </div>
        <Knopf art="voll gross" symbol="papier" style={{ marginTop: 24 }} onClick={beginnen}>
          Test beginnen
        </Knopf>
      </ModusRahmen>
    );
  }

  /* -------------------------------- Fragen ------------------------------ */
  const beantwortet = fragen.filter((f) => f.art === "zuordnen"
    ? Object.keys(antworten[f.id] || {}).length === f.paare.length
    : antworten[f.id] !== undefined).length;

  return (
    <ModusRahmen titel="Test" symbol="papier" aufSchliessen={aufSchliessen}
      anteil={auswertung ? 1 : beantwortet / fragen.length}
      rechts={auswertung
        ? <span className="marke gruen">{Math.round(100 * auswertung.richtig / auswertung.gesamt)} %</span>
        : <span className="klein matt mono">{beantwortet} / {fragen.length}</span>}>

      {auswertung && (
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <div style={{ fontFamily: "var(--serifen)", fontSize: 52 }}>
            {Math.round(100 * auswertung.richtig / auswertung.gesamt)}
            <span style={{ fontSize: 24 }}>%</span>
          </div>
          <p className="matt">{auswertung.richtig} von {auswertung.gesamt} richtig</p>
          <div className="reihe" style={{ justifyContent: "center", flexWrap: "wrap" }}>
            <Knopf art="voll" symbol="zurueckSetzen" onClick={beginnen}>Neuer Test</Knopf>
            <Knopf symbol="blitz" onClick={() => gehe("/stapel/" + setId + "/lernen")}>
              Schwaches üben</Knopf>
            <Knopf onClick={() => gehe("/stapel/" + setId)}>Zum Stapel</Knopf>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gap: 16 }}>
        {fragen.map((frage, nummer) => {
          const bewertet = auswertung ? auswertung.einzeln[frage.id] : null;
          const rahmen = auswertung && frage.art !== "zuordnen"
            ? { borderColor: bewertet ? "var(--gruen)" : "var(--rot)" } : {};

          return (
            <div key={frage.id} className="zahl-kachel" style={rahmen}>
              <div className="reihe klein blass" style={{ marginBottom: 10 }}>
                <span className="mono">{nummer + 1}</span>
                <span>{frage.art === "schreiben" ? "Schreiben"
                  : frage.art === "auswahl" ? "Auswahl"
                    : frage.art === "wahrFalsch" ? "Wahr oder falsch" : "Zuordnen"}</span>
                {auswertung && frage.art !== "zuordnen" && (
                  <>
                    <div className="dehnen" />
                    <Symbol name={bewertet ? "haken" : "kreuz"} groesse={16} />
                  </>
                )}
              </div>

              {frage.art === "zuordnen" ? (
                <div style={{ display: "grid", gap: 10 }}>
                  {frage.paare.map((paar) => {
                    const gewaehlt = antworten[frage.id]?.[paar.karte.id] || "";
                    const gut = auswertung ? auswertung.einzeln[frage.id + ":" + paar.karte.id] : null;
                    return (
                      <div key={paar.karte.id} className="reihe umbruch" style={{ gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 140 }}>
                          {paar.frage}
                          {paar.frageBild && <Bild kennung={paar.frageBild} klasse=""
                            stil={{ maxHeight: 60, borderRadius: 6, display: "block", marginTop: 4 }} />}
                        </div>
                        <select className="feld" style={{ flex: 1, minWidth: 160,
                          borderColor: auswertung ? (gut ? "var(--gruen)" : "var(--rot)") : undefined }}
                          value={gewaehlt} disabled={Boolean(auswertung)}
                          onChange={(e) => antwortSetzen(frage.id, {
                            ...(antworten[frage.id] || {}), [paar.karte.id]: e.target.value,
                          })}>
                          <option value="">(wählen)</option>
                          {frage.optionen.map((o) => (
                            <option key={o.id} value={o.id}>{o.antwort}</option>
                          ))}
                        </select>
                        {auswertung && !gut && (
                          <span className="klein" style={{ color: "var(--gruen)" }}>{paar.antwort}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: 14 }}>
                    <Seite text={frage.seiten.frage} bild={frage.seiten.frageBild}
                      sprache={sprachen.frage} klasse="frage-text lang" vorlesen={false} />
                  </div>

                  {frage.art === "schreiben" && (
                    <>
                      <input className="feld" placeholder="Antwort" value={antworten[frage.id] || ""}
                        disabled={Boolean(auswertung)}
                        onChange={(e) => antwortSetzen(frage.id, e.target.value)} />
                      {auswertung && !bewertet && (
                        <div className="klein" style={{ marginTop: 8, color: "var(--gruen)" }}>
                          Richtig wäre: {frage.seiten.antwort}
                        </div>
                      )}
                    </>
                  )}

                  {frage.art === "auswahl" && (
                    <div className="antwort-gitter">
                      {frage.moeglichkeiten.map((m) => {
                        let klasse = "antwort";
                        if (auswertung) {
                          if (m.id === frage.karte.id) klasse += " richtig";
                          else if (antworten[frage.id] === m.id) klasse += " falsch";
                        } else if (antworten[frage.id] === m.id) klasse += " richtig";
                        return (
                          <button key={m.id} className={klasse} disabled={Boolean(auswertung)}
                            onClick={() => antwortSetzen(frage.id, m.id)}>
                            <span>{m.antwort}
                              {m.antwortBild && <Bild kennung={m.antwortBild} klasse=""
                                stil={{ maxHeight: 60, borderRadius: 6, display: "block", marginTop: 4 }} />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {frage.art === "wahrFalsch" && (
                    <>
                      <div className="frage-block" style={{ minHeight: 60, padding: 16, marginBottom: 12 }}>
                        <div className="frage-text lang">{frage.behauptung.text}</div>
                        {frage.behauptung.bild && <Bild kennung={frage.behauptung.bild} />}
                      </div>
                      <div className="antwort-gitter">
                        {[[true, "Stimmt"], [false, "Stimmt nicht"]].map(([wert, name]) => {
                          let klasse = "antwort";
                          if (auswertung) {
                            if (wert === frage.behauptung.stimmt) klasse += " richtig";
                            else if (antworten[frage.id] === wert) klasse += " falsch";
                          } else if (antworten[frage.id] === wert) klasse += " richtig";
                          return (
                            <button key={String(wert)} className={klasse} disabled={Boolean(auswertung)}
                              onClick={() => antwortSetzen(frage.id, wert)}>
                              <Symbol name={wert ? "haken" : "kreuz"} /> {name}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {!auswertung && (
        <div className="reihe" style={{ marginTop: 24, justifyContent: "center" }}>
          <Knopf art="voll gross" symbol="haken" onClick={abgeben}>
            Abgeben {beantwortet < fragen.length && `(${fragen.length - beantwortet} offen)`}
          </Knopf>
        </div>
      )}
    </ModusRahmen>
  );
}
