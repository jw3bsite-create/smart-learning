/*
 * Karten in Mengen anlegen: aus eingefügtem Text oder aus einem Foto.
 *
 * Beides endet in derselben Durchsicht — erst wenn die Paare stimmen, werden
 * sie angelegt. Bei der Texterkennung ist das nicht Zierde, sondern nötig:
 * kein Erkenner liest eine abfotografierte Liste fehlerfrei.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useDaten } from "../core/store.jsx";
import {
  zerlege, rateTrenner, ankiLesen, SPALTEN_TRENNER, ZEILEN_TRENNER,
} from "../core/importer.js";
import { erkenne, zuKarten, ausText, OCR_SPRACHEN } from "../core/ocr.js";
import { anzahl } from "../core/util.js";
import { Dialog, Knopf, Symbol, SymbolKnopf } from "./basis.jsx";

/* --------------------------- Durchsicht der Paare ---------------------- */

function Durchsicht({ paare, setPaare }) {
  if (!paare.length) return <div className="matt klein">Noch nichts zu sehen.</div>;
  return (
    <div style={{ display: "grid", gap: 6, maxHeight: 320, overflow: "auto" }}>
      {paare.map((p, i) => (
        <div key={i} className="karten-zeile" style={{ padding: "8px 10px", gap: 8 }}>
          <input className="feld" value={p.term} placeholder="Vorderseite"
            onChange={(e) => setPaare(paare.map((q, j) =>
              j === i ? { ...q, term: e.target.value } : q))} />
          <input className="feld" value={p.definition} placeholder="Rückseite"
            onChange={(e) => setPaare(paare.map((q, j) =>
              j === i ? { ...q, definition: e.target.value } : q))} />
          <SymbolKnopf symbol="kreuz" titel="Zeile verwerfen"
            onClick={() => setPaare(paare.filter((_, j) => j !== i))} />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------ Aus Text ------------------------------- */

export function TextEinfuhr({ setId, aufSchliessen }) {
  const { kartenAnlegenViele } = useDaten();
  const [text, setText] = useState("");
  const [spalte, setSpalte] = useState("tab");
  const [spalteEigen, setSpalteEigen] = useState("");
  const [zeile, setZeile] = useState("zeile");
  const [zeileEigen, setZeileEigen] = useState("");
  const [tauschen, setTauschen] = useState(false);
  const [bearbeitet, setBearbeitet] = useState(null);

  /* Eine Anki-Ausfuhr erkennt man an ihren Kopfzeilen — dann brauchen die
     Trennzeichen unten niemanden mehr zu kümmern. */
  const istAnki = /^#\s*separator/im.test(text);

  const ergebnis = useMemo(() => {
    if (istAnki) {
      const paare = ankiLesen(text).map((k) => (tauschen
        ? { term: k.definition, definition: k.term, hint: k.hint }
        : { term: k.term, definition: k.definition, hint: k.hint }));
      return { paare, uebrig: [] };
    }
    return zerlege(text, { spalte, spalteEigen, zeile, zeileEigen, tauschen });
  }, [text, istAnki, spalte, spalteEigen, zeile, zeileEigen, tauschen]);

  const paare = bearbeitet ?? ergebnis.paare;

  const anlegen = async () => {
    const brauchbar = paare.filter((p) => (p.term || "").trim() || (p.definition || "").trim());
    if (brauchbar.length) await kartenAnlegenViele(setId, brauchbar);
    aufSchliessen();
  };

  return (
    <Dialog weit titel="Karten aus Text" aufSchliessen={aufSchliessen}
      fuss={<>
        <Knopf onClick={aufSchliessen}>Abbrechen</Knopf>
        <Knopf art="voll" onClick={anlegen} disabled={!paare.length}>
          {anzahl(paare.length, "Karte anlegen", "Karten anlegen")}
        </Knopf>
      </>}>
      <p className="klein matt" style={{ marginTop: 0 }}>
        Füge eine Liste ein — je Zeile Vorder- und Rückseite, getrennt durch
        Tabulator, Komma oder Gedankenstrich. So kommen auch Stapel aus Quizlet
        herüber: dort „Exportieren“ wählen und den Text hier einsetzen.
      </p>
      <textarea className="feld" style={{ minHeight: 150, fontFamily: "ui-monospace, monospace" }}
        placeholder={"Haus\tmaison\nBaum\tarbre"}
        value={text}
        onChange={(e) => {
          const neu = e.target.value;
          setText(neu); setBearbeitet(null);
          if (!text && neu.length > 20) setSpalte(rateTrenner(neu));
        }} />

      {istAnki && (
        <div className="rueckmeldung gut klein" style={{ marginTop: 12 }}>
          <Symbol name="haken" groesse={15} /> Anki-Ausfuhr erkannt — die
          Kopfzeilen und die Auszeichnung werden entfernt, die Trennzeichen
          unten sind hier ohne Belang.
        </div>
      )}

      <div className="antwort-gitter" style={{ marginTop: 14,
        opacity: istAnki ? 0.4 : 1, pointerEvents: istAnki ? "none" : "auto" }}>
        <div>
          <label className="beschriftung">Zwischen Vorder- und Rückseite</label>
          <select className="feld" value={spalte}
            onChange={(e) => { setSpalte(e.target.value); setBearbeitet(null); }}>
            {SPALTEN_TRENNER.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
          </select>
          {spalte === "eigen" && (
            <input className="feld" style={{ marginTop: 8 }} value={spalteEigen}
              placeholder="z. B. |" onChange={(e) => { setSpalteEigen(e.target.value); setBearbeitet(null); }} />
          )}
        </div>
        <div>
          <label className="beschriftung">Zwischen den Karten</label>
          <select className="feld" value={zeile}
            onChange={(e) => { setZeile(e.target.value); setBearbeitet(null); }}>
            {ZEILEN_TRENNER.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
          </select>
          {zeile === "eigen" && (
            <input className="feld" style={{ marginTop: 8 }} value={zeileEigen}
              placeholder="z. B. ;" onChange={(e) => { setZeileEigen(e.target.value); setBearbeitet(null); }} />
          )}
        </div>
      </div>

      <label className="schalter" style={{ marginTop: 8 }}>
        <input type="checkbox" checked={tauschen}
          onChange={(e) => { setTauschen(e.target.checked); setBearbeitet(null); }} />
        <span>Seiten vertauscht übernehmen</span>
      </label>

      {ergebnis.uebrig.length > 0 && (
        <div className="rueckmeldung fast klein" style={{ marginBottom: 12 }}>
          {anzahl(ergebnis.uebrig.length, "Zeile hat", "Zeilen haben")} keine Rückseite —
          sie werden übergangen. Stimmt das Trennzeichen?
        </div>
      )}

      <h3 style={{ margin: "16px 0 8px" }}>Durchsicht</h3>
      <Durchsicht paare={paare} setPaare={setBearbeitet} />
    </Dialog>
  );
}

/* ------------------------------- Aus Bild ------------------------------ */

export function BildEinfuhr({ setId, aufSchliessen }) {
  const { kartenAnlegenViele, einstellungen, setzeEinstellung } = useDaten();
  const [dateien, setDateien] = useState([]);
  const [vorschau, setVorschau] = useState(null);
  const [laeuft, setLaeuft] = useState(false);
  const [anteil, setAnteil] = useState(0);
  const [meldung, setMeldung] = useState("");
  const [roh, setRoh] = useState("");
  const [erkannt, setErkannt] = useState(null);
  const [art, setArt] = useState("spalten");
  const [paare, setPaare] = useState([]);
  const [fehler, setFehler] = useState("");
  const waehler = useRef(null);

  const sprache = einstellungen.ocrSprache || "deu+eng";

  useEffect(() => {
    if (!dateien.length) { setVorschau(null); return; }
    const url = URL.createObjectURL(dateien[0]);
    setVorschau(url);
    return () => URL.revokeObjectURL(url);
  }, [dateien]);

  const lesen = async () => {
    if (!dateien.length) return;
    setLaeuft(true); setFehler(""); setAnteil(0);
    try {
      let gesamtText = "";
      const alleZeilen = [];
      for (let i = 0; i < dateien.length; i++) {
        setMeldung(`Bild ${i + 1} von ${dateien.length}`);
        const ergebnis = await erkenne(dateien[i], sprache, (a, was) => {
          setAnteil((i + a) / dateien.length);
          setMeldung(was + ` (Bild ${i + 1} von ${dateien.length})`);
        });
        gesamtText += (gesamtText ? "\n" : "") + ergebnis.text;
        alleZeilen.push(...ergebnis.zeilen);
      }
      const gesammelt = { text: gesamtText, zeilen: alleZeilen };
      setErkannt(gesammelt);
      setRoh(gesamtText);
      setPaare(zuKarten(gesammelt, art));
      setMeldung("");
    } catch (e) {
      setFehler("Die Texterkennung ist gescheitert: " + (e?.message || e) +
        ". Beim ersten Mal muss die Sprachdatei geladen werden — dafür wird eine Verbindung gebraucht.");
    } finally {
      setLaeuft(false);
    }
  };

  const anlegen = async () => {
    const brauchbar = paare.filter((p) => (p.term || "").trim());
    if (brauchbar.length) await kartenAnlegenViele(setId, brauchbar);
    aufSchliessen();
  };

  return (
    <Dialog weit titel="Karten aus einem Bild" aufSchliessen={aufSchliessen}
      fuss={<>
        <Knopf onClick={aufSchliessen}>Abbrechen</Knopf>
        {!roh
          ? <Knopf art="voll" onClick={lesen} disabled={!dateien.length || laeuft}>
              {laeuft ? "Liest …" : "Text erkennen"}</Knopf>
          : <Knopf art="voll" onClick={anlegen} disabled={!paare.length}>
              {anzahl(paare.length, "Karte anlegen", "Karten anlegen")}</Knopf>}
      </>}>
      <p className="klein matt" style={{ marginTop: 0 }}>
        Fotografiere eine Vokabelliste oder ein Blatt und lass den Text auslesen.
        Gedrucktes gelingt gut, Handschrift nur mäßig — sieh das Ergebnis darum
        durch, bevor du es übernimmst. Die Erkennung läuft auf diesem Gerät;
        beim ersten Mal wird die Sprachdatei geladen und danach behalten.
      </p>

      <div className="antwort-gitter">
        <div>
          <label className="beschriftung">Bilder</label>
          <input ref={waehler} type="file" accept="image/*" multiple style={{ display: "none" }}
            onChange={(e) => {
              setDateien([...e.target.files]); setRoh(""); setErkannt(null); setPaare([]);
            }} />
          <Knopf symbol="kamera" onClick={() => waehler.current?.click()}>
            {dateien.length ? anzahl(dateien.length, "Bild gewählt", "Bilder gewählt") : "Bilder wählen"}
          </Knopf>
        </div>
        <div>
          <label className="beschriftung">Sprache der Vorlage</label>
          <select className="feld" value={sprache}
            onChange={(e) => setzeEinstellung("ocrSprache", e.target.value)}>
            {OCR_SPRACHEN.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
          </select>
        </div>
      </div>

      {vorschau && (
        <img src={vorschau} alt="" style={{
          maxHeight: 200, maxWidth: "100%", borderRadius: 10, marginTop: 14,
          border: "1px solid var(--rand)",
        }} />
      )}

      {laeuft && (
        <div style={{ marginTop: 16 }}>
          <div className="balken" style={{ height: 10 }}>
            <span className="vertraut" style={{ width: Math.round(anteil * 100) + "%" }} />
          </div>
          <div className="klein matt" style={{ marginTop: 6 }}>{meldung}</div>
        </div>
      )}

      {fehler && <div className="rueckmeldung schlecht klein">{fehler}</div>}

      {roh && (
        <>
          <div className="reihe" style={{ margin: "18px 0 8px" }}>
            <h3 className="dehnen">Durchsicht</h3>
            <select className="feld" style={{ width: "auto" }} value={art}
              onChange={(e) => { setArt(e.target.value); setPaare(zuKarten(erkannt, e.target.value)); }}>
              <option value="spalten">Zwei Spalten im Bild</option>
              <option value="zeichen">Trennzeichen in der Zeile</option>
              <option value="wechselnd">Zeile für Zeile abwechselnd</option>
            </select>
            <SymbolKnopf symbol="zurueckSetzen" titel="Erneut aufteilen"
              onClick={() => setPaare(zuKarten(erkannt, art))} />
          </div>
          <details style={{ marginBottom: 12 }}>
            <summary className="klein matt" style={{ cursor: "pointer" }}>Erkannten Rohtext ansehen</summary>
            <textarea className="feld" style={{ minHeight: 120, marginTop: 8 }} value={roh}
              onChange={(e) => {
                setRoh(e.target.value);
                setPaare(ausText(e.target.value, art === "wechselnd" ? "wechselnd" : "zeichen"));
              }} />
          </details>
          <Durchsicht paare={paare} setPaare={setPaare} />
        </>
      )}

      {!roh && !laeuft && !dateien.length && (
        <div className="leerer-zustand" style={{ padding: 30 }}>
          <Symbol name="bild" groesse={30} />
          <div className="klein" style={{ marginTop: 8 }}>Noch kein Bild gewählt.</div>
        </div>
      )}
    </Dialog>
  );
}
