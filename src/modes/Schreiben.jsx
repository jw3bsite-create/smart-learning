/*
 * Schreiben: die Antwort tippen.
 *
 * Geprüft wird nachsichtig — Groß- und Kleinschreibung, Artikel und einzelne
 * Tippfehler zählen nicht als Fehler (einstellbar). Wer sich ungerecht
 * behandelt fühlt, drückt „War doch richtig“; das letzte Wort hat der Mensch.
 */

import React, { useEffect, useRef, useState } from "react";
import { pruefe, schablone } from "../core/text.js";
import { mische } from "../core/util.js";
import { sprich } from "../core/speech.js";
import { gehe } from "../App.jsx";
import { Knopf, SymbolKnopf, Symbol, Stern, Leer, useTastatur } from "../ui/basis.jsx";
import {
  useModus, useBrauchbar, ModusRahmen, Seite, Ergebnis, Wahl,
  RICHTUNGEN, seitenFuer, sprachenFuer, Hinweis,
} from "./gemeinsam.jsx";
import Formel from "../ui/Formel.jsx";

export default function Schreiben({ setId, aufSchliessen }) {
  const {
    derStapel, karten, einstellungen, antwortVerbuchen, karteAendern, sitzungMerken,
  } = useModus(setId);

  const [richtung, setRichtung] = useState("td");
  const [nurMarkierte, setNurMarkierte] = useState(false);
  const [reihe, setReihe] = useState(null);
  const [stelle, setStelle] = useState(0);
  const [eingabe, setEingabe] = useState("");
  const [urteil, setUrteil] = useState(null);
  const [hilfe, setHilfe] = useState(false);
  const [zaehler, setZaehler] = useState({ richtig: 0, falsch: 0 });
  const [fertig, setFertig] = useState(false);
  const feld = useRef(null);

  const brauchbare = useBrauchbar(karten, nurMarkierte);

  useEffect(() => { setReihe(null); setStelle(0); setFertig(false);
    setZaehler({ richtig: 0, falsch: 0 }); }, [nurMarkierte, richtung]);

  useEffect(() => {
    if (reihe && !urteil) feld.current?.focus();
  }, [stelle, reihe, urteil]);

  /* Sicherheitsnetz, falls die Stelle über das Ende hinausläuft. */
  useEffect(() => {
    if (reihe && reihe.length && stelle >= reihe.length) setFertig(true);
  }, [stelle, reihe]);

  const aufgabe = reihe ? reihe[stelle] : null;
  const seiten = aufgabe ? seitenFuer(aufgabe.karte, aufgabe.richtung) : null;
  const sprachen = sprachenFuer(derStapel, aufgabe?.richtung || "td");

  const beginnen = () => {
    const liste = mische(brauchbare).map((k, i) => ({
      karte: k,
      richtung: richtung === "beide" ? (i % 2 ? "dt" : "td") : richtung,
      schluessel: k.id + ":" + i,
    }));
    setReihe(liste); setStelle(0); setEingabe(""); setUrteil(null);
    setZaehler({ richtig: 0, falsch: 0 }); setFertig(false);
  };

  const pruefen = () => {
    if (urteil || !aufgabe) return;
    const ergebnis = pruefe(eingabe, seiten.antwort, {
      tippfehlerErlauben: einstellungen.tippfehlerErlauben,
      ohneArtikel: einstellungen.ohneArtikel,
      zeichenEgal: einstellungen.zeichenEgal,
      satzzeichenEgal: einstellungen.satzzeichenEgal,
    });
    setUrteil(ergebnis);
    antwortVerbuchen(aufgabe.karte, aufgabe.richtung,
      ergebnis.status === "richtig" ? 2 : ergebnis.status === "fast" ? 1 : 0);
    if (ergebnis.status === "falsch") {
      setZaehler((z) => ({ ...z, falsch: z.falsch + 1 }));
      setReihe((alt) => [...alt, { ...aufgabe, schluessel: aufgabe.schluessel + ":w" }]);
    } else setZaehler((z) => ({ ...z, richtig: z.richtig + 1 }));
  };

  const weiter = () => {
    setUrteil(null); setEingabe(""); setHilfe(false);
    if (stelle + 1 >= reihe.length) {
      setFertig(true);
      sitzungMerken({ setId, modus: "schreiben",
        gesamt: zaehler.richtig + zaehler.falsch, richtig: zaehler.richtig });
    } else setStelle((s) => s + 1);
  };

  const dochRichtig = () => {
    antwortVerbuchen(aufgabe.karte, aufgabe.richtung, 2);
    setZaehler((z) => ({ richtig: z.richtig + 1, falsch: Math.max(0, z.falsch - 1) }));
    setReihe((alt) => alt.filter((a, i) => i <= stelle || a.karte.id !== aufgabe.karte.id));
    weiter();
  };

  useTastatur({
    Enter: { auchBeimTippen: true, fn: () => {
      if (!reihe) beginnen();
      else if (urteil) weiter();
      else pruefen();
    } },
  }, !fertig);

  if (!brauchbare.length) {
    return (
      <ModusRahmen titel="Schreiben" symbol="schreiben" aufSchliessen={aufSchliessen}>
        <Leer titel="Keine Karten" text="Für diesen Modus braucht es Karten mit beiden Seiten.">
          <Knopf onClick={() => gehe("/stapel/" + setId + "/bearbeiten")}>Karten anlegen</Knopf>
        </Leer>
      </ModusRahmen>
    );
  }

  if (fertig) {
    return (
      <ModusRahmen titel="Schreiben" symbol="schreiben" aufSchliessen={aufSchliessen}>
        <Ergebnis titel="Durchgeschrieben" setId={setId}
          richtig={zaehler.richtig} gesamt={zaehler.richtig + zaehler.falsch}
          aufNochmal={beginnen} />
      </ModusRahmen>
    );
  }

  if (!reihe) {
    return (
      <ModusRahmen titel="Schreiben" symbol="schreiben" aufSchliessen={aufSchliessen}>
        <h1>{derStapel.title}</h1>
        <p className="matt">
          Alle {brauchbare.length} Karten der Reihe nach, falsch Beantwortetes kommt
          am Ende noch einmal.
        </p>
        <div style={{ display: "grid", gap: 12, marginTop: 20 }}>
          <Wahl beschriftung="Abfrage" wert={richtung} setzen={setRichtung}
            moeglichkeiten={RICHTUNGEN(derStapel)} />
          <label className="schalter">
            <input type="checkbox" checked={nurMarkierte}
              onChange={(e) => setNurMarkierte(e.target.checked)} />
            <span>Nur markierte Karten</span>
          </label>
        </div>
        <Knopf art="voll gross" symbol="schreiben" style={{ marginTop: 24 }} onClick={beginnen}>
          Losschreiben
        </Knopf>
      </ModusRahmen>
    );
  }

  if (!aufgabe) {
    return (
      <ModusRahmen titel="Schreiben" symbol="schreiben" aufSchliessen={aufSchliessen}>
        <div className="leerer-zustand">Einen Augenblick …</div>
      </ModusRahmen>
    );
  }

  const anteil = stelle / reihe.length;

  return (
    <ModusRahmen titel="Schreiben" symbol="schreiben" aufSchliessen={aufSchliessen} anteil={anteil}
      rechts={<>
        <span className="marke gruen">{zaehler.richtig}</span>
        <span className="marke rot">{zaehler.falsch}</span>
        <span className="klein matt mono">{stelle + 1} / {reihe.length}</span>
      </>}>

      <div className="frage-block">
        <div className="klein blass">
          {aufgabe.richtung === "dt" ? derStapel.termLabel || "Vorderseite" : derStapel.defLabel || "Rückseite"} gesucht
        </div>
        <Seite text={seiten.frage} bild={seiten.frageBild} sprache={sprachen.frage} />
        {hilfe && <div className="matt mono">{schablone(seiten.antwort)}</div>}
        <Hinweis text={aufgabe.karte.hint} />
      </div>

      <input ref={feld} className="feld" style={{ fontSize: 18, padding: "14px 16px" }}
        placeholder="Antwort eingeben" value={eingabe} disabled={Boolean(urteil)}
        onChange={(e) => setEingabe(e.target.value)} />

      <div className="reihe" style={{ marginTop: 12 }}>
        {!urteil && (
          <>
            <Knopf art="leer klein" onClick={() => setHilfe(true)}>
              <Symbol name="auge" groesse={15} /> Anfangsbuchstaben
            </Knopf>
            <Knopf art="leer klein" onClick={() => {
              setUrteil({ status: "falsch", erwartet: seiten.antwort });
              antwortVerbuchen(aufgabe.karte, aufgabe.richtung, 0);
              setZaehler((z) => ({ ...z, falsch: z.falsch + 1 }));
              setReihe((alt) => [...alt, { ...aufgabe, schluessel: aufgabe.schluessel + ":w" }]);
            }}>Weiß ich nicht</Knopf>
          </>
        )}
        <div className="dehnen" />
        {urteil
          ? <Knopf art="voll" onClick={weiter}>Weiter <span className="tastenhilfe nur-breit">↵</span></Knopf>
          : <Knopf art="voll" onClick={pruefen} disabled={!eingabe.trim()}>Prüfen</Knopf>}
      </div>

      {urteil && (
        <div className={"rueckmeldung " + (urteil.status === "richtig" ? "gut"
          : urteil.status === "fast" ? "fast" : "schlecht")}>
          <div className="reihe">
            <Symbol name={urteil.status === "falsch" ? "kreuz" : "haken"} />
            <strong>{urteil.status === "richtig" ? "Richtig"
              : urteil.status === "fast" ? "Fast richtig, sieh dir die Schreibung an"
                : "Leider nicht"}</strong>
            <div className="dehnen" />
            <SymbolKnopf symbol="laut" titel="Vorlesen"
              onClick={() => sprich(seiten.antwort, sprachen.antwort, einstellungen.sprechTempo)} />
            <Stern an={aufgabe.karte.starred}
              aufKlick={() => karteAendern(aufgabe.karte.id, { starred: !aufgabe.karte.starred })} />
          </div>
          <div style={{ marginTop: 8, fontSize: 17 }}><Formel text={seiten.antwort} /></div>
          {urteil.status !== "richtig" && (
            <div className="reihe" style={{ marginTop: 10 }}>
              {eingabe.trim() && <span className="klein matt">Getippt: „{eingabe}“</span>}
              <Knopf art="klein" onClick={dochRichtig}>War doch richtig</Knopf>
            </div>
          )}
        </div>
      )}
    </ModusRahmen>
  );
}
