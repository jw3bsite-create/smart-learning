/*
 * Der Gestaltungsbereich der Einstellungen.
 *
 * Jede Änderung greift sofort in der ganzen App — es gibt kein „Übernehmen".
 * Daneben steht trotzdem eine Vorschau: Sie zeigt die Bauteile, die man beim
 * Verstellen nicht zufällig vor Augen hat (Karteikarte, Knöpfe, Kachel), und
 * erspart das Hin- und Herspringen.
 *
 * Was hier nicht einstellbar ist: Grün, Gelb und Rot. Sie bedeuten in dieser
 * App etwas — richtig, unsicher, falsch. Wer sie frei wählen könnte, könnte
 * sich eine Oberfläche bauen, in der diese Unterscheidung verschwindet.
 */

import React, { useEffect, useRef, useState } from "react";
import { useDaten } from "../core/store.jsx";
import {
  SCHRIFTEN, SCHRIFT_GRUPPEN, DICHTEN, BREITEN, PALETTEN, STANDARD_GESTALTUNG,
  anwenden, schriftenZurWahl, stapelVorhanden,
} from "../core/gestaltung.js";
import { Symbol, Knopf, Rueckfrage, useMerker } from "./basis.jsx";

const AKZENTE = [
  ["#5b8bff", "Blau"], ["#a97bf0", "Violett"], ["#3fbf7f", "Grün"],
  ["#e8b84b", "Gelb"], ["#ef5b6b", "Rot"], ["#4bc6d8", "Türkis"],
  ["#f08a5b", "Orange"], ["#8b97a8", "Grau"],
];

const DESIGNS = [
  ["system", "Wie das System", "zahnrad"],
  ["hell", "Hell", "sonne"],
  ["dunkel", "Dunkel", "mond"],
  ["tief", "Tiefschwarz", "mond"],
];

/* ------------------------------ Bauteile -------------------------------- */

/*
 * Ein ausklappbarer Abschnitt.
 *
 * Alle Stellschrauben auf einmal sind zu viele: Wer die Schrift wechseln
 * will, sucht sie zwischen Farben, Reglern und Schaltern. Zugeklappt steht
 * in der Zeile, was gerade eingestellt ist; das erspart das Aufklappen,
 * wenn man nur nachsehen wollte.
 *
 * Welche Abschnitte offen sind, merkt sich das Gerät (nicht die Wolke) —
 * es ist eine Gewohnheit, keine Einstellung.
 */
function Klappe({ titel, stand, offen, umschalten, children }) {
  return (
    <section className={"klappe" + (offen ? " offen" : "")}>
      <button type="button" className="klappe-kopf" aria-expanded={offen}
        onClick={umschalten}>
        <Symbol name={offen ? "runter" : "weiter"} groesse={15} />
        <strong className="dehnen">{titel}</strong>
        <span className="klein blass">{stand}</span>
      </button>
      {offen && <div className="klappe-inhalt">{children}</div>}
    </section>
  );
}

/*
 * Die Schriftwahl.
 *
 * Jeder Name steht in seiner eigenen Schrift — anders ist eine Schriftliste
 * kaum zu gebrauchen: „Optima" und „Candara" sagen einem nichts, das Bild
 * schon.
 *
 * Darum eine eigene Liste statt eines Auswahlfelds: Native Felder zeigen die
 * Schriften auf dem iPad nicht, und dort wird gelernt.
 */
function SchriftWahl({ beschriftung, wert, setzen }) {
  const [offen, setOffen] = useState(false);
  const feld = useRef(null);
  const gruppen = schriftenZurWahl();
  const gewaehlt = SCHRIFTEN[wert] || SCHRIFTEN.system;
  const da = stapelVorhanden(gewaehlt.stapel);

  /* Ein Klick daneben oder die Esc-Taste schliesst — sonst bliebe die Liste
     offen stehen, wenn man sich anders entscheidet. */
  useEffect(() => {
    if (!offen) return;
    const daneben = (e) => { if (!feld.current?.contains(e.target)) setOffen(false); };
    const taste = (e) => { if (e.key === "Escape") setOffen(false); };
    document.addEventListener("pointerdown", daneben);
    document.addEventListener("keydown", taste);
    return () => {
      document.removeEventListener("pointerdown", daneben);
      document.removeEventListener("keydown", taste);
    };
  }, [offen]);

  const waehlen = (schluessel) => { setzen(schluessel); setOffen(false); };

  return (
    <div style={{ marginBottom: 16 }} ref={feld}>
      <label className="beschriftung">{beschriftung}</label>
      <div className="schriftwahl">
        <button type="button" className="feld schriftwahl-knopf"
          aria-expanded={offen} aria-haspopup="listbox"
          onClick={() => setOffen((o) => !o)}>
          <span className="dehnen" style={{ fontFamily: gewaehlt.stapel, fontSize: 16 }}>
            {gewaehlt.name}
          </span>
          <Symbol name={offen ? "runter" : "weiter"} groesse={14} />
        </button>

        {offen && (
          <div className="schriftwahl-liste" role="listbox">
            {Object.entries(SCHRIFT_GRUPPEN).map(([schluessel, name]) => (
              <div key={schluessel}>
                <div className="schriftwahl-gruppe">{name}</div>
                {(gruppen[schluessel] || []).map((s) => {
                  const vorhanden = stapelVorhanden(s.stapel);
                  return (
                    <button key={s.schluessel} type="button" role="option"
                      aria-selected={s.schluessel === wert}
                      className={"schriftwahl-zeile" + (s.schluessel === wert ? " aktiv" : "")}
                      onClick={() => waehlen(s.schluessel)}>
                      <span style={{ fontFamily: s.stapel, fontSize: 17 }}>{s.name}</span>
                      {!vorhanden && (
                        <span className="klein blass">nicht auf diesem Gerät</span>
                      )}
                      {s.schluessel === wert && <Symbol name="haken" groesse={14} />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ fontFamily: gewaehlt.stapel, fontSize: 17, marginTop: 6 }}>
        Franz jagt im Taxi quer durch Bayern. 0123
      </div>
      {!da && (
        <div className="klein blass">
          Diese Schrift liegt nicht auf diesem Gerät, oben steht die Rückfallschrift.
          Auf einem anderen Gerät kann sie vorhanden sein.
        </div>
      )}
    </div>
  );
}

/* -------------------------------- Regler -------------------------------- */

function Regler({ beschriftung, wert, min, max, schritt = 1, einheit = "", setzen, hinweis }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div className="reihe klein" style={{ marginBottom: 4 }}>
        <span className="dehnen matt">{beschriftung}</span>
        <span className="mono">{wert}{einheit}</span>
      </div>
      <input type="range" min={min} max={max} step={schritt} value={wert}
        style={{ width: "100%" }}
        onChange={(e) => setzen(Number(e.target.value))} />
      {hinweis && <div className="klein blass" style={{ marginTop: 2 }}>{hinweis}</div>}
    </div>
  );
}

function Wahlreihe({ beschriftung, wert, moeglichkeiten, setzen }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label className="beschriftung">{beschriftung}</label>
      <div className="reihe umbruch" style={{ gap: 6 }}>
        {moeglichkeiten.map(([schluessel, name]) => (
          <button key={schluessel}
            className={"knopf klein" + (wert === schluessel ? " voll" : "")}
            onClick={() => setzen(schluessel)}>
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------- Vorschau ------------------------------- */

/**
 * Die Vorschau bekommt dieselben Veränderlichen wie die App, aber auf einem
 * eigenen Element. So lässt sich später auch eine Fassung zeigen, die noch
 * nicht übernommen ist.
 */
function Vorschau({ werte }) {
  const rahmen = useRef(null);
  useEffect(() => { anwenden(rahmen.current, werte); }, [werte]);

  return (
    <div ref={rahmen} style={{
      background: "var(--grund)", color: "var(--schrift)",
      border: "1px solid var(--rand)", borderRadius: "var(--rund)",
      padding: 18, fontFamily: "var(--schrift-oberflaeche)",
      fontSize: "var(--schriftgroesse)", lineHeight: "var(--zeilenhoehe)",
    }}>
      <div style={{ fontFamily: "var(--schrift-karten)", fontSize: 21,
        fontWeight: 600, marginBottom: 4 }}>
        So sieht es aus
      </div>
      <div style={{ color: "var(--schrift-matt)", fontSize: 13, marginBottom: 14 }}>
        Überschriften und Karten in der einen Schrift, alles Übrige in der anderen.
      </div>

      {/* Eine Karteikarte im Kleinen */}
      <div style={{
        background: "var(--grund-2)", border: "1px solid var(--rand)",
        borderRadius: "calc(var(--rund) * 1.3)", padding: 20, textAlign: "center",
        marginBottom: 14,
      }}>
        <div style={{ fontFamily: "var(--schrift-karten)", fontSize: 24, lineHeight: 1.35 }}>
          Kettenregel
        </div>
        <div style={{ color: "var(--schrift-blass)", fontSize: 12, marginTop: 8 }}>
          Vorderseite
        </div>
      </div>

      {/* Knöpfe und Marken */}
      <div className="reihe umbruch" style={{ gap: 8, marginBottom: 14 }}>
        <span style={{
          background: "var(--akzent)", color: "var(--akzent-schrift)",
          padding: "9px 14px", borderRadius: "calc(var(--rund) * 0.7)",
          fontSize: "var(--schriftgroesse)",
        }}>Gut</span>
        <span style={{
          background: "var(--grund-2)", border: "1px solid var(--rand)",
          padding: "9px 14px", borderRadius: "calc(var(--rund) * 0.7)",
        }}>Nochmal</span>
        <span style={{
          border: "1px solid rgba(63,191,127,.35)", color: "var(--gruen)",
          padding: "2px 8px", borderRadius: 999, fontSize: 12,
          display: "inline-flex", alignItems: "center",
        }}>richtig</span>
        <span style={{
          border: "1px solid rgba(239,91,107,.35)", color: "var(--rot)",
          padding: "2px 8px", borderRadius: 999, fontSize: 12,
          display: "inline-flex", alignItems: "center",
        }}>falsch</span>
      </div>

      {/* Eine Kachel */}
      <div style={{
        background: "var(--grund-2)", border: "1px solid var(--rand)",
        borderRadius: "var(--rund)", padding: "calc(16px * var(--dichte))",
      }}>
        <div style={{ fontFamily: "var(--schrift-karten)", fontSize: 17 }}>Mathematik</div>
        <div style={{ color: "var(--schrift-matt)", fontSize: 13, marginTop: 4 }}>
          24 Karten · 6 fällig
        </div>
        <div style={{ height: 8, borderRadius: 999, background: "var(--grund-3)",
          marginTop: 10, overflow: "hidden", display: "flex" }}>
          <span style={{ width: "45%", background: "var(--gruen)" }} />
          <span style={{ width: "25%", background: "var(--akzent)" }} />
          <span style={{ width: "15%", background: "var(--gelb)" }} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Der Bereich ----------------------------- */

export default function Gestaltung() {
  const { einstellungen, setzeEinstellung } = useDaten();
  const [zuruecksetzen, setZuruecksetzen] = useState(false);
  const [offen, setOffen] = useMerker("gestaltungOffen", []);
  const farbfeld = useRef(null);

  const umschalten = (name) => setOffen((alt) =>
    alt.includes(name) ? alt.filter((x) => x !== name) : [...alt, name]);
  const klappe = (name) => ({
    offen: offen.includes(name), umschalten: () => umschalten(name),
  });

  const setzen = (schluessel, wert) => setzeEinstellung(schluessel, wert);

  /** Eine ganze Palette auf einmal. */
  const paletteAnlegen = (werte) => {
    for (const [schluessel, wert] of Object.entries(werte)) setzeEinstellung(schluessel, wert);
  };

  const alleZurueck = () => {
    for (const [schluessel, wert] of Object.entries(STANDARD_GESTALTUNG))
      setzeEinstellung(schluessel, wert);
    setZuruecksetzen(false);
  };

  const eigeneFarbe = !AKZENTE.some(([f]) => f === einstellungen.akzent);

  return (
    <>
      {/* --------------------------- Paletten --------------------------- */}
      <label className="beschriftung">Fertige Zusammenstellungen</label>
      <div className="gitter" style={{ gridTemplateColumns:
        "repeat(auto-fill, minmax(170px, 1fr))", gap: 8, marginBottom: 22 }}>
        {PALETTEN.map((p) => (
          <button key={p.name} className="kachel" style={{ minHeight: 0, padding: 12 }}
            onClick={() => paletteAnlegen(p.werte)}>
            <div className="reihe" style={{ gap: 8 }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, flex: "none",
                background: p.werte.akzent, display: "block" }} />
              <strong>{p.name}</strong>
            </div>
            <div className="klein blass">{p.beschreibung}</div>
          </button>
        ))}
      </div>

      <div className="antwort-gitter" style={{ gap: 26, alignItems: "start" }}>
        {/* ------------------------ Die Stellschrauben ------------------- */}
        <div>
          {/* ----------------------------- Farben ----------------------- */}
          <Klappe titel="Farben" {...klappe("farben")}
            stand={(DESIGNS.find(([k]) => k === einstellungen.design) || DESIGNS[0])[1]
              + " · " + (AKZENTE.find(([f]) => f === einstellungen.akzent)?.[1]
                || "eigene Farbe")}>
            <Wahlreihe beschriftung="Grundton" wert={einstellungen.design}
              setzen={(w) => setzen("design", w)}
              moeglichkeiten={DESIGNS.map(([k, n]) => [k, n])} />

            <label className="beschriftung">Akzentfarbe</label>
            <div className="reihe umbruch" style={{ gap: 8, marginBottom: 8 }}>
              {AKZENTE.map(([farbe, name]) => (
                <button key={farbe} title={name} onClick={() => setzen("akzent", farbe)}
                  style={{ width: 30, height: 30, borderRadius: 9, background: farbe,
                    cursor: "pointer",
                    border: einstellungen.akzent === farbe
                      ? "2px solid var(--schrift)" : "1px solid var(--rand)" }} />
              ))}
              <button title="Eigene Farbe" onClick={() => farbfeld.current?.click()}
                style={{ width: 30, height: 30, borderRadius: 9, cursor: "pointer",
                  border: eigeneFarbe ? "2px solid var(--schrift)" : "1px solid var(--rand)",
                  background: eigeneFarbe ? einstellungen.akzent
                    : "conic-gradient(#ef5b6b,#e8b84b,#3fbf7f,#4bc6d8,#5b8bff,#a97bf0,#ef5b6b)",
                  display: "grid", placeItems: "center" }}>
                {eigeneFarbe && <Symbol name="stift" groesse={14}
                  style={{ color: "var(--akzent-schrift)" }} />}
              </button>
              <input ref={farbfeld} type="color" value={einstellungen.akzent}
                style={{ width: 0, height: 0, opacity: 0, position: "absolute" }}
                onChange={(e) => setzen("akzent", e.target.value)} />
            </div>
            <p className="klein blass" style={{ margin: 0 }}>
              Grün, Gelb und Rot bleiben, wie sie sind, sie bedeuten in dieser App
              richtig, unsicher und falsch.
            </p>
          </Klappe>

          {/* ---------------------------- Schriften --------------------- */}
          <Klappe titel="Schriften" {...klappe("schriften")}
            stand={(SCHRIFTEN[einstellungen.schriftOberflaeche] || SCHRIFTEN.system).name
              + " · " + (SCHRIFTEN[einstellungen.schriftKarten] || SCHRIFTEN.georgia).name}>
            <SchriftWahl beschriftung="Schrift der Oberfläche"
              wert={einstellungen.schriftOberflaeche}
              setzen={(w) => setzen("schriftOberflaeche", w)} />

            <SchriftWahl beschriftung="Schrift auf Karten und Überschriften"
              wert={einstellungen.schriftKarten}
              setzen={(w) => setzen("schriftKarten", w)} />

            <Regler beschriftung="Schriftgröße" wert={einstellungen.schriftgroesse}
              min={12} max={22} einheit=" px" setzen={(w) => setzen("schriftgroesse", w)} />

            <Regler beschriftung="Zeilenabstand" wert={einstellungen.zeilenhoehe}
              min={1.3} max={1.9} schritt={0.05}
              setzen={(w) => setzen("zeilenhoehe", w)} />
          </Klappe>

          {/* ------------------------ Abstände und Form ----------------- */}
          <Klappe titel="Abstände und Form" {...klappe("abstaende")}
            stand={(DICHTEN[einstellungen.dichte] || DICHTEN.normal).name
              + " · " + (BREITEN[einstellungen.breite] || BREITEN.normal).name
              + " · " + einstellungen.rundung + " px"}>
            <Wahlreihe beschriftung="Abstände" wert={einstellungen.dichte}
              setzen={(w) => setzen("dichte", w)}
              moeglichkeiten={Object.entries(DICHTEN).map(([k, d]) => [k, d.name])} />

            <Wahlreihe beschriftung="Breite der Arbeitsfläche" wert={einstellungen.breite}
              setzen={(w) => setzen("breite", w)}
              moeglichkeiten={Object.entries(BREITEN).map(([k, b]) => [k, b.name])} />

            <Regler beschriftung="Eckenrundung" wert={einstellungen.rundung}
              min={0} max={24} einheit=" px" setzen={(w) => setzen("rundung", w)}
              hinweis="Null ergibt scharfe Ecken." />

            <Regler beschriftung="Höhe der Karteikarte" wert={einstellungen.kartenhoehe}
              min={240} max={520} schritt={10} einheit=" px"
              setzen={(w) => setzen("kartenhoehe", w)}
              hinweis="Gilt für den Karteikarten-Modus." />

            <label className="schalter">
              <input type="checkbox" checked={Boolean(einstellungen.ruhig)}
                onChange={(e) => setzen("ruhig", e.target.checked)} />
              <span>Ruhige Oberfläche
                <span className="klein blass">(ohne Übergänge und Bewegung)</span>
              </span>
            </label>
          </Klappe>

          <Knopf art="klein leer" symbol="zurueckSetzen" style={{ marginTop: 14 }}
            onClick={() => setZuruecksetzen(true)}>
            Auf die Vorgaben zurücksetzen
          </Knopf>
        </div>

        {/* ---------------------------- Vorschau ------------------------- */}
        <div style={{ position: "sticky", top: 20 }}>
          <label className="beschriftung">Vorschau</label>
          <Vorschau werte={einstellungen} />
        </div>
      </div>

      {zuruecksetzen && (
        <Rueckfrage titel="Gestaltung zurücksetzen?" bestaetigung="Zurücksetzen"
          text="Alle Einstellungen dieses Bereichs gehen auf die Vorgaben zurück. Deine Karten und der Lernstand bleiben unberührt."
          aufNein={() => setZuruecksetzen(false)} aufJa={alleZurueck} />
      )}
    </>
  );
}
