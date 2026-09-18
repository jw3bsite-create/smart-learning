/*
 * Der Stapel im Bearbeitungszustand.
 *
 * Getippt wird in eigenen Zustandsfeldern je Zeile; erst nach kurzer Ruhe oder
 * beim Verlassen des Feldes wandert der Text in den Speicher. Sonst schriebe
 * jeder Tastendruck in die Datenbank.
 */

import React, { useEffect, useRef, useState } from "react";
import { useDaten } from "../core/store.jsx";
import { bildAufnehmen, bildLoeschen, dateiAusEreignis } from "../core/media.js";
import { anzahl } from "../core/util.js";
import { kartenArt, KARTENARTEN } from "../core/model.js";
import { gehe, zurueckZu } from "../App.jsx";
import {
  Symbol, SymbolKnopf, Knopf, Menue, MenuePunkt, Bild, Stern, Leer, Dialog, useMerker,
} from "./basis.jsx";
import { TextEinfuhr, BildEinfuhr, QuizletEinfuhr } from "./Einfuhr.jsx";
import Tonaufnahme from "./Tonaufnahme.jsx";
import Zeichenleiste from "./Zeichenleiste.jsx";
import Formel from "./Formel.jsx";
import { hatFormel } from "../core/formel.js";
import KiGenerator from "./KiGenerator.jsx";

/* ----------------------------- Eine Kartenzeile ------------------------ */

function Zeile({ karte, nummer, aendern, loeschen, aufHoch, aufRunter, aufNeueZeile }) {
  const [term, setTerm] = useState(karte.term);
  const [definition, setDefinition] = useState(karte.definition);
  const [hinweis, setHinweis] = useState(karte.hint || "");
  const [hinweisOffen, setHinweisOffen] = useState(Boolean(karte.hint));
  const istMehrschritt = kartenArt(karte) === "mehrschritt";
  const [schritteText, setSchritteText] = useState(
    (karte.schritte || []).map((s) => (s.frage ? s.frage + ": " + s.antwort : s.antwort))
      .join("\n"));
  const uhr = useRef(null);
  const vorderesFeld = useRef(null);

  // Änderungen von außen (Einfuhr, Abgleich) übernehmen.
  useEffect(() => { setTerm(karte.term); }, [karte.term]);
  useEffect(() => { setDefinition(karte.definition); }, [karte.definition]);

  const merken = (aenderung) => {
    clearTimeout(uhr.current);
    uhr.current = setTimeout(() => aendern(karte.id, aenderung), 500);
  };
  const sofort = (aenderung) => { clearTimeout(uhr.current); aendern(karte.id, aenderung); };

  /** Zeilen zu Schritten: „ableiten: f'(x) = 2x" wird Frage und Antwort. */
  const alsSchritte = (text) => String(text || "").split("\n")
    .map((z) => z.trim()).filter(Boolean)
    .map((z) => {
      const stelle = z.indexOf(":");
      // Nur trennen, wenn vorn wirklich eine Anweisung steht und nicht etwa
      // ein Verhältnis wie „3:4".
      if (stelle > 2 && /[a-zäöüß]\s*$/i.test(z.slice(0, stelle)))
        return { frage: z.slice(0, stelle).trim(), antwort: z.slice(stelle + 1).trim() };
      return { frage: "", antwort: z };
    });

  const merkenSchritte = (text) => merken({ schritte: alsSchritte(text) });
  const sofortSchritte = (text) => sofort({ schritte: alsSchritte(text) });

  useEffect(() => () => clearTimeout(uhr.current), []);

  const bildWaehlen = async (seite, datei) => {
    if (!datei) return;
    const alt = seite === "termImage" ? karte.termImage : karte.defImage;
    const kennung = await bildAufnehmen(datei);
    if (!kennung) return;
    if (alt) bildLoeschen(alt);
    sofort({ [seite]: kennung });
  };

  const seite = (welche, wert, setWert, feldName, platzhalter) => (
    <div className="seite">
      <textarea
        ref={welche === "vorn" ? vorderesFeld : null}
        className="feld" rows={2} placeholder={platzhalter} value={wert}
        style={{ minHeight: 54, resize: "vertical" }}
        onChange={(e) => { setWert(e.target.value); merken({ [feldName]: e.target.value }); }}
        onBlur={(e) => sofort({ [feldName]: e.target.value })}
        onPaste={(e) => {
          const datei = dateiAusEreignis(e);
          if (datei) { e.preventDefault(); bildWaehlen(welche === "vorn" ? "termImage" : "defImage", datei); }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); aufNeueZeile(); }
          if (e.key === "Tab" && welche === "hinten" && !e.shiftKey) aufNeueZeile(true);
        }}
        onDrop={(e) => {
          const datei = dateiAusEreignis(e);
          if (datei) { e.preventDefault(); bildWaehlen(welche === "vorn" ? "termImage" : "defImage", datei); }
        }}
      />
      {/* Enthaelt das Feld eine Formel, steht darunter, wie sie aussehen wird —
          im Feld selbst sieht man ja nur die Schreibweise. */}
      {hatFormel(wert) && (
        <div className="formel-vorschau"><Formel text={wert} /></div>
      )}
      {/* Bild und Aufnahme in einer Zeile: Auf dem Telefon waere sonst jede
          Karte doppelt so hoch, und man scrollt sich durch die Liste. */}
      <div className="reihe umbruch zeile-werkzeuge">
      {(welche === "vorn" ? karte.termImage : karte.defImage) ? (
        <div style={{ position: "relative", display: "inline-block" }}>
          <Bild kennung={welche === "vorn" ? karte.termImage : karte.defImage}
            klasse="" stil={{ maxHeight: 110, borderRadius: 8, display: "block" }} />
          <button className="knopf klein" style={{ position: "absolute", top: 4, right: 4 }}
            onClick={() => {
              const alt = welche === "vorn" ? karte.termImage : karte.defImage;
              bildLoeschen(alt);
              sofort({ [welche === "vorn" ? "termImage" : "defImage"]: null });
            }}><Symbol name="kreuz" groesse={14} /></button>
        </div>
      ) : (
        <label className="knopf klein leer" style={{ cursor: "pointer" }}>
          <Symbol name="bild" groesse={15} /> Bild
          <input type="file" accept="image/*" style={{ display: "none" }}
            onChange={(e) => bildWaehlen(welche === "vorn" ? "termImage" : "defImage", e.target.files[0])} />
        </label>
      )}
      {/* Selbst einsprechen, schon beim Anlegen: Wer Vokabeln eintippt, spricht
          sie am besten gleich einmal. Beim Abrufen wird die Aufnahme dann
          wieder abgespielt. */}
      <Tonaufnahme knapp cardId={karte.id} seite={welche === "vorn" ? "t" : "d"} />
      </div>
    </div>
  );

  return (
    <div className="karten-zeile" style={{ alignItems: "stretch" }}>
      <div style={{ gridColumn: "1 / -1" }} className="reihe klein blass">
        <span className="mono">{nummer}</span>
        <div className="dehnen" />
        <Stern an={karte.starred} groesse={16}
          aufKlick={() => sofort({ starred: !karte.starred })} />
        <SymbolKnopf symbol="hoch" titel="Nach oben" onClick={aufHoch} />
        <SymbolKnopf symbol="runter" titel="Nach unten" onClick={aufRunter} />
        <select className="feld klein" style={{ width: "auto", padding: "3px 24px 3px 8px",
          fontSize: 12 }}
          value={kartenArt(karte)}
          onChange={(e) => sofort({ art: e.target.value })}>
          {Object.entries(KARTENARTEN).map(([k, n]) => (
            <option key={k} value={k}>{n}</option>
          ))}
        </select>
        <SymbolKnopf symbol="muell" titel="Karte löschen" onClick={() => loeschen(karte.id)} />
      </div>
      {seite("vorn", term, setTerm, "term", "Vorderseite: Begriff, Frage, Vokabel")}
      {istMehrschritt ? (
        <div className="seite">
          <label className="beschriftung">Rechenweg, ein Schritt je Zeile</label>
          <textarea className="feld" rows={4} value={schritteText}
            placeholder={"f'(x) = 2x\nf'(x) = 0\nx = 0"}
            style={{ minHeight: 96, fontFamily: "ui-monospace, monospace" }}
            onChange={(e) => { setSchritteText(e.target.value); merkenSchritte(e.target.value); }}
            onBlur={(e) => sofortSchritte(e.target.value)} />
          <p className="klein blass" style={{ marginTop: 6 }}>
            Jede Zeile wird einzeln abgefragt. Ein Doppelpunkt trennt eine
            Anweisung von ihrem Ergebnis: <em>ableiten: f'(x) = 2x</em>
          </p>
        </div>
      ) : (
        seite("hinten", definition, setDefinition, "definition", "Rückseite: Erklärung, Antwort, Übersetzung")
      )}
      <div style={{ gridColumn: "1 / -1" }}>
        {hinweisOffen ? (
          <input className="feld" placeholder="Hinweis (wird auf Wunsch im Lernmodus gezeigt)"
            value={hinweis}
            onChange={(e) => { setHinweis(e.target.value); merken({ hint: e.target.value }); }}
            onBlur={(e) => sofort({ hint: e.target.value })} />
        ) : (
          <button className="knopf klein leer" onClick={() => setHinweisOffen(true)}>
            <Symbol name="plus" groesse={14} /> Hinweis
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ Die Ansicht ---------------------------- */

export default function Bearbeiten({ setId }) {
  const {
    stapel, kartenVon, stapelAendern, karteAnlegen, karteAendern, karteLoeschen, kartenOrdnen,
    entwuerfe,
  } = useDaten();
  const [textEinfuhr, setTextEinfuhr] = useState(false);
  const [quizlet, setQuizlet] = useState(false);
  const [zeichen, setZeichen] = useMerker("zeichenleisteOffen", false);
  const [bildEinfuhr, setBildEinfuhr] = useState(false);
  const [generator, setGenerator] = useState(false);
  const [hilfe, setHilfe] = useState(false);
  const unten = useRef(null);

  const derStapel = stapel.find((s) => s.id === setId);
  const karten = kartenVon(setId);
  const wartendeEntwuerfe = entwuerfe.filter((e) => e.setId === setId).length;

  if (!derStapel) {
    return <div className="mitte"><Leer titel="Stapel nicht gefunden" /></div>;
  }

  const neueKarte = async (ansEnde = true) => {
    await karteAnlegen(setId);
    if (ansEnde) setTimeout(() => unten.current?.scrollIntoView({ behavior: "smooth" }), 60);
  };

  const verschieben = (index, richtung) => {
    const ziel = index + richtung;
    if (ziel < 0 || ziel >= karten.length) return;
    const neu = [...karten];
    [neu[index], neu[ziel]] = [neu[ziel], neu[index]];
    kartenOrdnen(neu.map((k) => k.id));
  };

  return (
    <div className="mitte">
      <div className="kopfzeile">
        <SymbolKnopf symbol="zurueck" titel="Zurück" art="leer"
          onClick={() => zurueckZu("/stapel/" + setId)} />
        <h1 style={{ flex: 1 }}>Bearbeiten</h1>
        <Knopf symbol="hinauf" onClick={() => setTextEinfuhr(true)}>Text einfügen</Knopf>
        <Knopf symbol="kamera" onClick={() => setBildEinfuhr(true)}>Aus Bild</Knopf>
        <Knopf symbol="blitz" onClick={() => setGenerator(true)}>Aus Vorlage</Knopf>
        <Knopf symbol="sigma" art={zeichen ? "voll" : ""} aria-pressed={zeichen}
          title="Mathematische Zeichen" onClick={() => setZeichen((z) => !z)}>
          Zeichen
        </Knopf>
        <Knopf art="voll" symbol="haken" onClick={() => zurueckZu("/stapel/" + setId)}>Fertig</Knopf>
        <Menue knopf={<SymbolKnopf symbol="mehr" titel="Mehr" art="klein" />}>
          <MenuePunkt symbol="hinauf" onClick={() => setQuizlet(true)}>
            Aus Quizlet …</MenuePunkt>
          <MenuePunkt symbol="auge" onClick={() => setHilfe(true)}>Tastenkürzel</MenuePunkt>
        </Menue>
      </div>

      {zeichen && <Zeichenleiste aufSchliessen={() => setZeichen(false)} />}

      <input className="feld" value={derStapel.title}
        placeholder="Titel des Stapels, etwa „Englisch Vokabeln Unit 5“"
        style={{ fontSize: 20, fontFamily: "var(--serifen)", marginBottom: 10 }}
        onChange={(e) => stapelAendern(setId, { title: e.target.value })} />
      <textarea className="feld" value={derStapel.description || ""}
        placeholder="Beschreibung (freiwillig)"
        style={{ minHeight: 54, marginBottom: 20 }}
        onChange={(e) => stapelAendern(setId, { description: e.target.value })} />

      {wartendeEntwuerfe > 0 && (
        <div className="rueckmeldung fast" style={{ marginBottom: 16 }}>
          <div className="reihe">
            <Symbol name="papier" />
            <span className="dehnen">
              {anzahl(wartendeEntwuerfe, "Entwurf wartet", "Entwürfe warten")} auf eine Rückseite.
            </span>
            <Knopf art="klein" onClick={() => gehe("/stapel/" + setId + "/entwuerfe")}>
              Ansehen
            </Knopf>
          </div>
        </div>
      )}

      <div className="reihe" style={{ marginBottom: 12 }}>
        <h3 className="dehnen">{anzahl(karten.length, "Karte", "Karten")}</h3>
        <span className="klein blass nur-breit">
          <span className="tastenhilfe">Strg</span> + <span className="tastenhilfe">↵</span> legt eine neue Karte an
        </span>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {karten.map((k, i) => (
          <Zeile key={k.id} karte={k} nummer={i + 1} aendern={karteAendern}
            loeschen={karteLoeschen}
            aufHoch={() => verschieben(i, -1)} aufRunter={() => verschieben(i, 1)}
            aufNeueZeile={() => { if (i === karten.length - 1) neueKarte(); }} />
        ))}
      </div>

      <div ref={unten} style={{ marginTop: 16 }}>
        <Knopf art="gross" symbol="plus" onClick={() => neueKarte()}
          style={{ width: "100%", justifyContent: "center" }}>
          Karte hinzufügen
        </Knopf>
      </div>

      {karten.length === 0 && (
        <div style={{ marginTop: 14, textAlign: "center" }}>
          <p className="matt klein" style={{ marginBottom: 8 }}>
            Schneller geht es mit „Text einfügen“, eine Liste aus dem Heft in
            einem Rutsch.
          </p>
          <Knopf art="klein" symbol="hinauf" onClick={() => setQuizlet(true)}>
            Stapel aus Quizlet übernehmen
          </Knopf>
        </div>
      )}

      {textEinfuhr && <TextEinfuhr setId={setId} aufSchliessen={() => setTextEinfuhr(false)} />}
      {quizlet && <QuizletEinfuhr setId={setId} aufSchliessen={() => setQuizlet(false)} />}
      {bildEinfuhr && <BildEinfuhr setId={setId} aufSchliessen={() => setBildEinfuhr(false)} />}
      {generator && <KiGenerator setId={setId} aufSchliessen={() => setGenerator(false)} />}

      {hilfe && (
        <Dialog titel="Tastenkürzel beim Bearbeiten" aufSchliessen={() => setHilfe(false)}>
          <div style={{ display: "grid", gap: 10 }}>
            <div className="reihe"><span className="tastenhilfe">Strg</span>
              <span className="tastenhilfe">↵</span>
              <span className="matt">Neue Karte anlegen</span></div>
            <div className="reihe"><span className="tastenhilfe">Tab</span>
              <span className="matt">Ins nächste Feld; am Ende entsteht eine neue Karte</span></div>
            <div className="reihe"><span className="tastenhilfe">Strg</span>
              <span className="tastenhilfe">V</span>
              <span className="matt">Ein Bild aus der Zwischenablage landet auf der Karte</span></div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
