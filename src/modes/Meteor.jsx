/*
 * Meteor: Begriffe fallen vom Himmel, die Antwort tippen, ehe sie unten
 * aufschlagen. Mit jeder Stufe wird es schneller.
 *
 * Die Lage der Brocken liegt im Zustand und wird von einem Bildtakt
 * fortgeschrieben. Bei höchstens drei Brocken zugleich ist das unbedenklich.
 */

import React, { useEffect, useRef, useState } from "react";
import { pruefe } from "../core/text.js";
import { ziehe } from "../core/util.js";
import { gehe } from "../App.jsx";
import { Knopf, Symbol, Leer, useMerker } from "../ui/basis.jsx";
import { useModus, useBrauchbar, ModusRahmen, Wahl, RICHTUNGEN, seitenFuer } from "./gemeinsam.jsx";

const LEBEN = 3;
const HOEHE = 460;

export default function Meteor({ setId, aufSchliessen }) {
  const { derStapel, karten, einstellungen, antwortVerbuchen, sitzungMerken } = useModus(setId);
  const [richtung, setRichtung] = useState("td");
  const [nurMarkierte, setNurMarkierte] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [brocken, setBrocken] = useState([]);
  const [eingabe, setEingabe] = useState("");
  const [leben, setLeben] = useState(LEBEN);
  const [punkte, setPunkte] = useState(0);
  const [stufe, setStufe] = useState(1);
  const [treffer, setTreffer] = useState(0);
  const [meldung, setMeldung] = useState(null);
  const [aus, setAus] = useState(false);
  const [bestwert, setBestwert] = useMerker("meteor:" + setId, 0);
  const feld = useRef(null);
  const takt = useRef(0);
  const letzte = useRef(0);
  const naechsterWurf = useRef(0);
  const zaehlwerk = useRef(0);
  const brockenRef = useRef([]);

  const brauchbare = useBrauchbar(karten, nurMarkierte);

  /* Bildtakt: Brocken fallen lassen, neue werfen, Aufschläge verbuchen. */
  useEffect(() => {
    if (!laeuft) return;
    letzte.current = performance.now();
    const schritt = (zeit) => {
      const dt = Math.min(60, zeit - letzte.current);
      letzte.current = zeit;
      const tempo = 0.011 + 0.0045 * (stufe - 1);      // Anteil der Höhe je Millisekunde
      const hoechstens = Math.min(3, 1 + Math.floor(stufe / 3));

      // Bewusst außerhalb des Zustandsaktualisierers gerechnet: dort dürfen
      // keine Nebenwirkungen stehen, React ruft ihn im Prüflauf doppelt auf.
      let neu = brockenRef.current.map((b) => ({ ...b, y: b.y + tempo * dt }));
      const gefallen = neu.filter((b) => b.y >= 100);
      if (gefallen.length) {
        neu = neu.filter((b) => b.y < 100);
        for (const b of gefallen) {
          antwortVerbuchen(b.karte, richtung === "beide" ? "td" : richtung, 0);
          setMeldung({ art: "falsch", frage: b.text, antwort: b.antwort });
        }
        setLeben((l) => Math.max(0, l - gefallen.length));
      }
      if (neu.length < hoechstens && zeit > naechsterWurf.current) {
        naechsterWurf.current = zeit + Math.max(900, 2600 - stufe * 160);
        const kandidaten = brauchbare.filter((k) => !neu.some((b) => b.karte.id === k.id));
        const karte = ziehe(kandidaten.length ? kandidaten : brauchbare, 1)[0];
        if (karte) {
          const seiten = seitenFuer(karte, richtung === "beide"
            ? (Math.random() < 0.5 ? "td" : "dt") : richtung);
          zaehlwerk.current += 1;
          neu = [...neu, {
            id: "m" + zaehlwerk.current, karte, y: -6,
            x: 6 + Math.random() * 60, text: seiten.frage, antwort: seiten.antwort,
          }];
        }
      }
      brockenRef.current = neu;
      setBrocken(neu);
      takt.current = requestAnimationFrame(schritt);
    };
    takt.current = requestAnimationFrame(schritt);
    return () => cancelAnimationFrame(takt.current);
  }, [laeuft, stufe, richtung, brauchbare]);

  useEffect(() => {
    if (laeuft && leben <= 0) {
      setLaeuft(false); setAus(true);
      if (punkte > bestwert) setBestwert(punkte);
      sitzungMerken({ setId, modus: "meteor", gesamt: treffer + (LEBEN - leben),
        richtig: treffer, punkte });
    }
  }, [leben, laeuft]);

  useEffect(() => {
    if (!meldung) return;
    const u = setTimeout(() => setMeldung(null), 2200);
    return () => clearTimeout(u);
  }, [meldung]);

  const beginnen = () => {
    setBrocken([]); brockenRef.current = [];
    setLeben(LEBEN); setPunkte(0); setStufe(1); setTreffer(0);
    setMeldung(null); setAus(false); setEingabe("");
    naechsterWurf.current = 0;
    setLaeuft(true);
    setTimeout(() => feld.current?.focus(), 50);
  };

  const abschicken = () => {
    if (!eingabe.trim() || !brocken.length) return;
    let getroffen = null;
    for (const b of brocken) {
      const ergebnis = pruefe(eingabe, b.antwort, {
        tippfehlerErlauben: einstellungen.tippfehlerErlauben,
        ohneArtikel: einstellungen.ohneArtikel,
        zeichenEgal: einstellungen.zeichenEgal,
        satzzeichenEgal: einstellungen.satzzeichenEgal,
      });
      if (ergebnis.status !== "falsch") { getroffen = b; break; }
    }
    if (getroffen) {
      brockenRef.current = brockenRef.current.filter((b) => b.id !== getroffen.id);
      setBrocken(brockenRef.current);
      antwortVerbuchen(getroffen.karte, richtung === "beide" ? "td" : richtung, 2);
      const gewinn = Math.round(100 * (1 - getroffen.y / 100)) + stufe * 10;
      setPunkte((p) => p + gewinn);
      setTreffer((t) => {
        const neu = t + 1;
        if (neu % 5 === 0) setStufe((s) => s + 1);
        return neu;
      });
      setMeldung({ art: "richtig", frage: getroffen.text, antwort: getroffen.antwort, gewinn });
    } else {
      setPunkte((p) => Math.max(0, p - 5));
    }
    setEingabe("");
  };

  if (brauchbare.length < 4) {
    return (
      <ModusRahmen titel="Meteor" symbol="rakete" aufSchliessen={aufSchliessen}>
        <Leer titel="Zu wenige Karten" text="Für dieses Spiel braucht es mindestens vier Karten.">
          <Knopf onClick={() => gehe("/stapel/" + setId + "/bearbeiten")}>Karten anlegen</Knopf>
        </Leer>
      </ModusRahmen>
    );
  }

  if (!laeuft && !aus) {
    return (
      <ModusRahmen titel="Meteor" symbol="rakete" aufSchliessen={aufSchliessen}>
        <h1>{derStapel.title}</h1>
        <p className="matt">
          Die Begriffe fallen. Tippe die Antwort und drücke die Eingabetaste, ehe
          ein Brocken den Boden erreicht. Drei Aufschläge, dann ist Schluss.
        </p>
        {bestwert > 0 && <p className="marke gelb"><Symbol name="feuer" groesse={14} /> Bestwert {bestwert}</p>}
        <div style={{ display: "grid", gap: 12, marginTop: 18, maxWidth: 420 }}>
          <Wahl beschriftung="Abfrage" wert={richtung} setzen={setRichtung}
            moeglichkeiten={RICHTUNGEN(derStapel)} />
          <label className="schalter">
            <input type="checkbox" checked={nurMarkierte}
              onChange={(e) => setNurMarkierte(e.target.checked)} />
            <span>Nur markierte Karten</span>
          </label>
        </div>
        <Knopf art="voll gross" symbol="rakete" style={{ marginTop: 22 }} onClick={beginnen}>
          Spiel beginnen
        </Knopf>
      </ModusRahmen>
    );
  }

  if (aus) {
    return (
      <ModusRahmen titel="Meteor" symbol="rakete" aufSchliessen={aufSchliessen}>
        <div style={{ textAlign: "center", paddingTop: 24 }}>
          <Symbol name="rakete" groesse={38} />
          <h1 style={{ marginTop: 10 }}>{punkte} Punkte</h1>
          <p className="matt">
            {treffer} Begriffe abgewehrt, Stufe {stufe} erreicht
            {punkte >= bestwert && punkte > 0 ? " — neuer Bestwert!" : bestwert ? ` · Bestwert ${bestwert}` : ""}
          </p>
          <div className="reihe" style={{ justifyContent: "center", marginTop: 20, flexWrap: "wrap" }}>
            <Knopf art="voll gross" symbol="zurueckSetzen" onClick={beginnen}>Noch einmal</Knopf>
            <Knopf art="gross" onClick={() => gehe("/stapel/" + setId)}>Zum Stapel</Knopf>
          </div>
        </div>
      </ModusRahmen>
    );
  }

  return (
    <ModusRahmen titel="Meteor" symbol="rakete" aufSchliessen={aufSchliessen}
      rechts={<>
        <span className="marke">Stufe {stufe}</span>
        <span className="marke gelb mono">{punkte}</span>
        <span className="reihe" style={{ gap: 3 }}>
          {Array.from({ length: LEBEN }, (_, i) => (
            <Symbol key={i} name="feuer" groesse={16}
              fuell={i < leben} style={{ opacity: i < leben ? 1 : 0.25 }} />
          ))}
        </span>
      </>}>

      <div className="himmel" style={{ height: HOEHE }}>
        {brocken.map((b) => (
          <div key={b.id} className={"meteor" + (b.y > 72 ? " gefahr" : "")}
            style={{ left: b.x + "%", top: `calc(${b.y}% - 20px)` }}>
            {b.text}
          </div>
        ))}
        <div className="boden" />
      </div>

      <input ref={feld} className="feld" style={{ fontSize: 18, padding: "14px 16px", marginTop: 14 }}
        placeholder="Antwort tippen und Eingabetaste" value={eingabe}
        onChange={(e) => setEingabe(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); abschicken(); } }}
        autoFocus />

      {meldung && (
        <div className={"rueckmeldung " + (meldung.art === "richtig" ? "gut" : "schlecht")}>
          <div className="reihe">
            <Symbol name={meldung.art === "richtig" ? "haken" : "kreuz"} />
            <strong>{meldung.frage}</strong>
            <span className="matt">→ {meldung.antwort}</span>
            <div className="dehnen" />
            {meldung.gewinn && <span className="marke gruen">+{meldung.gewinn}</span>}
          </div>
        </div>
      )}
    </ModusRahmen>
  );
}
