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
  zerlege, rateTrenner, ankiLesen, quizletLesen, nurQuizletLink, SPALTEN_TRENNER, ZEILEN_TRENNER,
} from "../core/importer.js";
import { knopfAdresse, uebergabeLesen } from "../core/quizletknopf.js";
import { dateiLesen } from "../core/quizletdatei.js";
import { erkenne, zuKarten, ausText, OCR_SPRACHEN } from "../core/ocr.js";
import { anzahl } from "../core/util.js";
import { Dialog, Knopf, Symbol, SymbolKnopf, useMerker, Leer } from "./basis.jsx";

/* --------------------------- Durchsicht der Paare ---------------------- */

export function Durchsicht({ paare, setPaare }) {
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

/* ------------------------------ Aus Quizlet ---------------------------- */

const SPALTEN_NAME = {
  tab: "Tabulator", komma: "Komma", semikolon: "Semikolon",
  strich: "Gedankenstrich", doppelpunkt: "Doppelpunkt", gleich: "Gleichheitszeichen",
};
const ZEILEN_NAME = { zeile: "neue Zeile", leerzeile: "Leerzeile" };

/* Die Adresse von Anchor selbst, für „Anchor öffnen“ im Quizlet-Knopf. */
const ANCHOR_ADRESSE = typeof window !== "undefined"
  ? window.location.origin + window.location.pathname : "";

/*
 * Der Quizlet-Knopf zum Ziehen in die Favoritenleiste. React lässt
 * `javascript:`-Adressen im JSX nicht durch; sie wird darum nach dem
 * Zeichnen gesetzt.
 */
function KnopfZumZiehen() {
  const ziel = useRef(null);
  useEffect(() => { ziel.current?.setAttribute("href", knopfAdresse(ANCHOR_ADRESSE)); }, []);
  return (
    <a ref={ziel} className="knopf klein voll" draggable="true" style={{ textDecoration: "none" }}
      onClick={(e) => e.preventDefault()} title="In die Favoritenleiste ziehen">
      <Symbol name="stern" groesse={15} /> Nach Anchor
    </a>
  );
}

/* Die Schritte, eine Datei zu sichern — je Gerät. Gezeigt wird zuerst das,
   an dem man gerade sitzt; das andere ist eingeklappt. */
const AM_TELEFON = typeof window !== "undefined" && Boolean(window.matchMedia?.("(pointer: coarse)").matches);
const DATEI_IPHONE = (
  <ol className="oben-8 unten-0" style={{ paddingLeft: 20 }}>
    <li className="unten-4">Den Stapel in <strong>Safari</strong> öffnen, nicht in der Quizlet-App —
      aus der App kommt beim Sichern nur der Link. Am einfachsten: in der App Teilen → Link
      kopieren, dann in Safari oben in die Adresszeile einsetzen.</li>
    <li className="unten-4">Bis zur Liste aller Begriffe hinunterscrollen. Steht dort Mehr
      anzeigen, antippen.</li>
    <li className="unten-4">Teilen → oben <strong>Optionen</strong> → <strong>PDF</strong> →
      <strong> In Dateien sichern</strong>.</li>
    <li>Hier <strong>Datei auswählen</strong> und die Datei aus Dateien wählen.</li>
  </ol>
);
const DATEI_PC = (
  <ol className="oben-8 unten-0" style={{ paddingLeft: 20 }}>
    <li className="unten-4">Den Stapel im Browser öffnen und bis zur Liste aller Begriffe scrollen.</li>
    <li className="unten-4"><strong>Strg + P</strong>, als Drucker <strong>Als PDF speichern</strong>
      wählen, Speichern. (Oder Strg + S als Webseite.)</li>
    <li>Hier <strong>Datei auswählen</strong> — oder die Datei einfach in dieses Fenster ziehen.</li>
  </ol>
);

const WEGE = [
  ["datei", "Als Datei"],
  ["knopf", "Quizlet-Knopf"],
  ["export", "Exportieren"],
  ["markieren", "Markieren"],
];

/*
 * Stapel aus Quizlet uebernehmen.
 *
 * Getrennt von der allgemeinen Texteinfuhr, obwohl beide dasselbe Format
 * lesen: Dort muss man wissen, welche Zeichen Quizlet gerade verwendet, hier
 * nicht. Wer eine Vokabelliste seiner Lehrerin uebernehmen will, soll nicht
 * erst Trennzeichen vergleichen muessen.
 *
 * Quizlet gibt seine Karten nicht an andere Seiten heraus; ein Link allein
 * hilft also nicht. Darum stehen oben vier Wege, je nachdem, was man hat:
 * die Seite als Datei sichern (jeder Stapel, ohne Plus, auf beiden Geräten;
 * gelesen in core/quizletdatei.js), den Quizlet-Knopf, „Exportieren“ (eigene
 * Stapel) und das Markieren der Begriffsliste.
 *
 * Bilder kommen nicht mit — Quizlet gibt sie nicht heraus.
 */
export function QuizletEinfuhr({ setId, aufSchliessen }) {
  const { kartenAnlegenViele } = useDaten();
  const [text, setText] = useState("");
  const [tauschen, setTauschen] = useState(false);
  const [abwechselnd, setAbwechselnd] = useState(false);
  const [bearbeitet, setBearbeitet] = useState(null);
  const [weg, setWeg] = useMerker("quizletWegWahl", "datei");
  const [meldung, setMeldung] = useState("");
  const [kopiert, setKopiert] = useState(false);
  const [liest, setLiest] = useState(false);
  const [ausDatei, setAusDatei] = useState("");
  const datei = useRef(null);

  const gelesen = useMemo(() => quizletLesen(text, { abwechselnd }), [text, abwechselnd]);
  const paare = bearbeitet ?? (tauschen
    ? gelesen.paare.map((p) => ({ term: p.definition, definition: p.term }))
    : gelesen.paare);
  const nurLink = !paare.length && nurQuizletLink(text);

  const neuerText = (t) => {
    setText(t); setBearbeitet(null); setAbwechselnd(false); setMeldung(""); setAusDatei("");
  };

  /* PDF, Webarchiv, gesicherte Webseite oder Text — erkannt am Inhalt. */
  const dateiGewaehlt = async (f) => {
    if (!f) return;
    setLiest(true);
    try {
      const e = await dateiLesen(f);
      neuerText(e.text);
      if (e.hinweis) setMeldung(e.hinweis);
      else if (e.art !== "text") setAusDatei(e.artName);
    } catch (fehler) {
      setMeldung("Die Datei ließ sich nicht lesen (" + (fehler?.message || fehler) + ").");
    } finally {
      setLiest(false);
      if (datei.current) datei.current.value = "";
    }
  };

  /* Auf dem iPhone fragt Safari mit „Einsetzen“ nach; am Rechner fragt der
     Browser einmal um Erlaubnis. */
  const einfuegen = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (!t.trim()) { setMeldung("In der Zwischenablage liegt nichts."); return; }
      neuerText(t);
    } catch (f) {
      setMeldung("Einfügen ging nicht direkt. Tipp ins Feld, halte gedrückt und wähle Einsetzen.");
    }
  };

  const codeKopieren = async () => {
    try { await navigator.clipboard.writeText(knopfAdresse(ANCHOR_ADRESSE)); setKopiert(true); }
    catch (f) { setMeldung("Kopieren ging nicht."); }
  };

  const anlegen = async () => {
    const brauchbar = paare.filter((p) => (p.term || "").trim() || (p.definition || "").trim());
    if (brauchbar.length) await kartenAnlegenViele(setId, brauchbar);
    aufSchliessen();
  };

  return (
    <Dialog weit titel="Karten aus Quizlet" aufSchliessen={aufSchliessen}
      fuss={<>
        <Knopf onClick={aufSchliessen}>Abbrechen</Knopf>
        <Knopf art="voll" onClick={anlegen} disabled={!paare.length}>
          {anzahl(paare.length, "Karte anlegen", "Karten anlegen")}
        </Knopf>
      </>}>
      <p className="klein matt oben-0">
        Ein Link reicht leider nicht: Quizlet gibt seine Karten nicht an andere Seiten heraus.
        Die Karten selbst müssen herüber — auf einem dieser Wege:
      </p>

      <div className="reihe umbruch unten-12" style={{ gap: 6 }}>
        {WEGE.map(([schluessel, name]) => (
          <button key={schluessel} type="button"
            className={"knopf klein" + (weg === schluessel ? " voll" : "")}
            onClick={() => setWeg(schluessel)}>{name}</button>
        ))}
      </div>

      {weg === "datei" && (
        <div className="zahl-kachel klein unten-12">
          <strong>Jeder Stapel, ohne Plus.</strong> Die Seite des Stapels als Datei sichern und
          hier auswählen.
          {AM_TELEFON ? <>{DATEI_IPHONE}<details className="oben-8">
            <summary className="matt" style={{ cursor: "pointer" }}>Am PC</summary>{DATEI_PC}</details></>
            : <>{DATEI_PC}<details className="oben-8">
              <summary className="matt" style={{ cursor: "pointer" }}>Am iPhone</summary>{DATEI_IPHONE}</details></>}
        </div>
      )}
      {weg === "knopf" && (
        <div className="zahl-kachel klein unten-12">
          <strong>Jeder Stapel, am einfachsten am Rechner.</strong> Einmal einrichten:
          <ol className="oben-8 unten-8" style={{ paddingLeft: 20 }}>
            <li className="unten-4">Die Favoritenleiste einblenden (in Edge: Strg + Umschalt + B).</li>
            <li className="unten-4">Diesen Knopf mit der Maus in die Leiste ziehen: <KnopfZumZiehen /></li>
          </ol>
          Danach jedes Mal: den Stapel bei Quizlet im Browser öffnen, in der Leiste
          auf <strong>Nach Anchor</strong> klicken, dann <strong>Kopieren</strong> — und hier
          unten <strong>Einfügen</strong>.
          <details className="oben-8">
            <summary className="matt" style={{ cursor: "pointer" }}>Auf dem iPhone (Safari)</summary>
            <ol className="oben-8 unten-0" style={{ paddingLeft: 20 }}>
              <li className="unten-4">
                <button type="button" className="pfad-verweis" onClick={codeKopieren}>
                  {kopiert ? "Code kopiert" : "Code des Knopfs kopieren"}</button>.
              </li>
              <li className="unten-4">In Safari irgendeine Seite als Lesezeichen sichern (Teilen →
                Lesezeichen hinzufügen) und es <strong>Nach Anchor</strong> nennen.</li>
              <li className="unten-4">Lesezeichen öffnen → Bearbeiten → das Lesezeichen antippen,
                die Adresse löschen und den Code einsetzen.</li>
              <li>Den Quizlet-Stapel in Safari öffnen (nicht in der Quizlet-App), oben in die
                Adresszeile tippen, <strong>Nach Anchor</strong> eingeben und den Vorschlag antippen.</li>
            </ol>
          </details>
        </div>
      )}
      {weg === "export" && (
        <div className="zahl-kachel klein unten-12">
          <strong>Nur für eigene Stapel und nur auf der Quizlet-Webseite</strong> (in der App fehlt es):
          <ol className="oben-8 unten-0" style={{ paddingLeft: 20 }}>
            <li className="unten-4">Den Stapel bei Quizlet im Browser öffnen.</li>
            <li className="unten-4">Auf die drei Punkte ··· neben dem Stapel tippen und
              <strong> Exportieren</strong> wählen.</li>
            <li>Auf <strong>Text kopieren</strong> tippen und hier unten <strong>Einfügen</strong>.</li>
          </ol>
        </div>
      )}
      {weg === "markieren" && (
        <div className="zahl-kachel klein unten-12">
          <strong>Geht immer, ist aber Handarbeit.</strong>
          <ol className="oben-8 unten-0" style={{ paddingLeft: 20 }}>
            <li className="unten-4">Den Stapel bei Quizlet im Browser öffnen und nach unten zur
              Liste aller Begriffe scrollen.</li>
            <li className="unten-4">Die Liste von der Überschrift (Begriffe in diesem Set) bis zum
              letzten Begriff markieren und kopieren.</li>
            <li>Hier unten <strong>Einfügen</strong>. Anchor liest Begriff und Definition aus
              abwechselnden Zeilen; prüf in der Durchsicht, ob es aufgeht.</li>
          </ol>
        </div>
      )}

      {/* Eine Datei darf auch einfach hierher gezogen werden. Ohne die
          Abfangung öffnete der Browser sie selbst und Anchor wäre weg. */}
      <div onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); dateiGewaehlt(e.dataTransfer?.files?.[0]); }}>
        <div className="reihe umbruch unten-8" style={{ gap: 8 }}>
          <Knopf art={"klein" + (weg === "datei" ? " voll" : "")} symbol="hinauf" disabled={liest}
            onClick={() => datei.current?.click()}>
            {liest ? "Lese die Datei …" : "Datei auswählen"}
          </Knopf>
          <input ref={datei} type="file"
            accept=".pdf,.webarchive,.html,.htm,.mhtml,.mht,.txt,.csv,.tsv,application/pdf,text/html,text/plain,text/csv"
            style={{ display: "none" }}
            onChange={(e) => dateiGewaehlt(e.target.files[0])} />
          <Knopf art={"klein" + (weg === "datei" ? "" : " voll")} symbol="papier" onClick={einfuegen}>
            Einfügen
          </Knopf>
        </div>

        <textarea className="feld"
          style={{ minHeight: 120, fontFamily: "ui-monospace, monospace" }}
          placeholder={"Oder hier hineinkopieren, etwa:\nla casa\tdas Haus\nel perro\tder Hund"}
          value={text}
          onChange={(e) => neuerText(e.target.value)} />
      </div>

      <label className="schalter oben-8">
        <input type="checkbox" checked={tauschen}
          onChange={(e) => { setTauschen(e.target.checked); setBearbeitet(null); }} />
        <span>Seiten vertauschen
          <span className="klein blass">(Deutsch vorn statt hinten)</span>
        </span>
      </label>

      {meldung && <div className="rueckmeldung schlecht klein oben-8">{meldung}</div>}

      {nurLink && (
        <div className="rueckmeldung schlecht klein oben-12">
          Das ist der Link zum Stapel. Die Karten selbst holt Anchor nicht: Quizlet sperrt alles,
          was nicht ein Mensch in seinem eigenen Browser ist. So geht es trotzdem schnell: den
          Stapel öffnen und dort oben in der Favoritenleiste auf <strong>Nach Anchor</strong>,
          dann <strong>In Anchor übernehmen</strong>. Den Knopf richtest du einmal unter
          „Quizlet-Knopf“ ein.
          <div className="oben-8">
            <Knopf art="klein voll" symbol="weiter"
              onClick={() => window.open(text.trim().match(/https?:\/\/\S+/)?.[0] || text.trim(), "_blank")}>
              Bei Quizlet öffnen</Knopf>
          </div>
        </div>
      )}

      {text.trim() && !nurLink && (
        <div className={"rueckmeldung klein oben-12 " + (paare.length ? "gut" : "schlecht")}>
          {paare.length ? (
            <>
              <Symbol name="haken" groesse={15} /> {ausDatei ? "Aus der Datei (" + ausDatei + ") gelesen." : "Erkannt:"}
              {ausDatei ? "" : gelesen.spalte === "abwechselnd"
                ? " Begriff und Definition in abwechselnden Zeilen."
                : " " + (SPALTEN_NAME[gelesen.spalte] || gelesen.spalte) + " zwischen den Seiten, "
                  + (ZEILEN_NAME[gelesen.zeile] || gelesen.zeile) + " zwischen den Karten."}
              {gelesen.doppelte > 0
                && " " + anzahl(gelesen.doppelte, "doppelte Karte", "doppelte Karten")
                  + " übergangen."}
              {gelesen.uebrig.length > 0
                && " " + anzahl(gelesen.uebrig.length, "Zeile ohne Rückseite wird übergangen",
                  "Zeilen ohne Rückseite werden übergangen") + "."}
            </>
          ) : (
            <>
              Daraus lassen sich keine Karten lesen. Stehen Begriff und Definition in
              abwechselnden Zeilen untereinander (vom Markieren der Quizlet-Seite)?{" "}
              <button type="button" className="pfad-verweis" onClick={() => setAbwechselnd(true)}>
                So lesen</button>
            </>
          )}
        </div>
      )}

      {paare.length > 0 && (
        <>
          <label className="beschriftung oben-16">
            Durchsicht: {anzahl(paare.length, "Karte", "Karten")}
          </label>
          <Durchsicht paare={paare} setPaare={setBearbeitet} />
        </>
      )}
    </Dialog>
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
      <p className="klein matt oben-0">
        Füge eine Liste ein, je Zeile Vorder- und Rückseite, getrennt durch
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
        <div className="rueckmeldung gut klein oben-12">
          <Symbol name="haken" groesse={15} /> Anki-Ausfuhr erkannt, die
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
            <input className="feld oben-8" value={spalteEigen}
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
            <input className="feld oben-8" value={zeileEigen}
              placeholder="z. B. ;" onChange={(e) => { setZeileEigen(e.target.value); setBearbeitet(null); }} />
          )}
        </div>
      </div>

      <label className="schalter oben-8">
        <input type="checkbox" checked={tauschen}
          onChange={(e) => { setTauschen(e.target.checked); setBearbeitet(null); }} />
        <span>Seiten vertauscht übernehmen</span>
      </label>

      {ergebnis.uebrig.length > 0 && (
        <div className="rueckmeldung fast klein unten-12">
          {anzahl(ergebnis.uebrig.length,
            "Zeile ohne Rückseite wird übergangen",
            "Zeilen ohne Rückseite werden übergangen")}. Stimmt das Trennzeichen?
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
        ". Beim ersten Mal muss die Sprachdatei geladen werden, dafür wird eine Verbindung gebraucht.");
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
      <p className="klein matt oben-0">
        Fotografiere eine Vokabelliste oder ein Blatt und lass den Text auslesen.
        Gedrucktes gelingt gut, Handschrift nur mäßig, sieh das Ergebnis darum
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
        <div className="oben-16">
          <div className="balken" style={{ height: 10 }}>
            <span className="vertraut" style={{ width: Math.round(anteil * 100) + "%" }} />
          </div>
          <div className="klein matt oben-8">{meldung}</div>
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
          <details className="unten-12">
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
          <div className="klein oben-8">Noch kein Bild gewählt.</div>
        </div>
      )}
    </Dialog>
  );
}

/* --------------------------- Aus dem Quizlet-Knopf --------------------------- */

/*
 * Hierher führt „In Anchor übernehmen“ auf der Quizlet-Seite: die Karten
 * schon fertig, zur Durchsicht. Angelegt wird ein neuer Stapel mit dem Titel
 * von Quizlet, oder die Karten kommen in einen vorhandenen.
 */
export function QuizletUebernahme({ daten }) {
  const { stapel, stapelAnlegen, kartenAnlegenViele } = useDaten();
  const gelesen = useMemo(() => uebergabeLesen(daten), [daten]);
  const [paare, setPaare] = useState(() => gelesen?.paare || []);
  const [titel, setTitel] = useState(() => gelesen?.titel || "Aus Quizlet");
  const [ziel, setZiel] = useState("neu");
  const [laeuft, setLaeuft] = useState(false);

  /* Die Karten nicht in der Adresse stehen lassen: Ein Neuladen legte sie
     sonst ein zweites Mal vor. */
  useEffect(() => { if (gelesen) window.history.replaceState(null, "", "#/quizlet"); }, []);

  if (!gelesen) {
    return (
      <div className="mitte">
        <Leer symbol="hinauf" titel="Keine Karten angekommen"
          text="Hier landen Karten aus dem Quizlet-Knopf." />
      </div>
    );
  }

  const uebernehmen = async () => {
    const brauchbar = paare.filter((p) => p.term.trim() || p.definition.trim());
    if (!brauchbar.length) return;
    setLaeuft(true);
    const setId = ziel === "neu" ? (await stapelAnlegen(titel.trim() || "Aus Quizlet")).id : ziel;
    await kartenAnlegenViele(setId, brauchbar);
    window.location.replace("#/stapel/" + setId);
  };

  const vorhandene = stapel.filter((s) => !s.deleted)
    .sort((a, b) => (a.title || "").localeCompare(b.title || "", "de"));

  return (
    <div className="mitte">
      <h1 className="unten-8">Aus Quizlet</h1>
      <p className="matt oben-0">{anzahl(paare.length, "Karte", "Karten")} angekommen. Sieh sie durch, dann übernehmen.</p>

      <label className="beschriftung oben-16">Wohin?</label>
      <select className="feld" value={ziel} onChange={(e) => setZiel(e.target.value)}>
        <option value="neu">Neuer Stapel</option>
        {vorhandene.map((s) => <option key={s.id} value={s.id}>{s.title || "Ohne Titel"}</option>)}
      </select>
      {ziel === "neu" && (
        <>
          <label className="beschriftung oben-12">Titel</label>
          <input className="feld" value={titel} onChange={(e) => setTitel(e.target.value)} />
        </>
      )}

      <div className="reihe umbruch oben-16">
        <Knopf art="voll" symbol="haken" disabled={laeuft || !paare.length} onClick={uebernehmen}>
          {laeuft ? "Lege an …" : anzahl(paare.length, "Karte übernehmen", "Karten übernehmen")}
        </Knopf>
        <Knopf onClick={() => window.location.replace("#/")}>Verwerfen</Knopf>
      </div>

      <label className="beschriftung oben-24">Durchsicht</label>
      <Durchsicht paare={paare} setPaare={setPaare} />
    </div>
  );
}
