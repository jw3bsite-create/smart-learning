/*
 * Karten aus einer Vorlage erzeugen.
 *
 * Was hier herauskommt, sind keine Karten, sondern Entwürfe: Vorderseite und
 * Quellenauszug. Die Rückseite schreibt der Nutzer im Entwurfsbereich selbst.
 *
 * Vor dem ersten Aufruf steht die Vorschau, was den Rechner verlässt. Bei LM
 * Studio ist die Antwort: nichts — es läuft alles hier. Bei einem Anbieter
 * dagegen geht die Vorlage tatsächlich hinaus, und dann soll man das gesehen
 * haben, ehe man auf „Erzeugen" drückt.
 */

import React, { useEffect, useRef, useState } from "react";
import { useDaten } from "../core/store.jsx";
import * as ki from "../core/ki.js";
import { pruefeVorschlaege, alsEntwuerfe, inHaeppchen } from "../core/generator.js";
import { erkenne } from "../core/ocr.js";
import { anzahl } from "../core/util.js";
import { gehe } from "../App.jsx";
import { Dialog, Knopf, Symbol, SymbolKnopf } from "./basis.jsx";

export default function KiGenerator({ setId, aufSchliessen }) {
  const { kartenVon, entwuerfeAnlegen, einstellungen } = useDaten();
  const [vorlage, setVorlage] = useState("");
  const [wieViele, setWieViele] = useState(10);
  const [zugang, setZugang] = useState(null);
  const [stand, setStand] = useState(null);         // Erreichbarkeit
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState("");
  const [fehler, setFehler] = useState("");
  const [bericht, setBericht] = useState(null);
  const [zeigeVorschau, setZeigeVorschau] = useState(false);
  const waehler = useRef(null);

  useEffect(() => {
    (async () => {
      const z = await ki.zugangLesen();
      setZugang(z);
      if (ki.eingerichtet(z)) setStand(await ki.erreichbar(z));
    })();
  }, []);

  const bereit = zugang && ki.eingerichtet(zugang);
  const lokal = zugang?.anbieter === "lmstudio";

  const bildLesen = async (datei) => {
    if (!datei) return;
    setLaeuft(true); setMeldung("Lese das Bild …"); setFehler("");
    try {
      const ergebnis = await erkenne(datei, einstellungen.ocrSprache || "deu+eng",
        (a, was) => setMeldung(was + " " + Math.round(a * 100) + " %"));
      setVorlage((alt) => (alt ? alt + "\n\n" : "") + ergebnis.text);
      setMeldung("");
    } catch (e) {
      setFehler("Die Texterkennung ist gescheitert: " + (e?.message || e));
    } finally { setLaeuft(false); }
  };

  const erzeugen = async () => {
    setLaeuft(true); setFehler(""); setBericht(null);
    try {
      const haeppchen = inHaeppchen(vorlage, 3000);
      const alle = [];
      for (let i = 0; i < haeppchen.length; i++) {
        setMeldung(haeppchen.length > 1
          ? `Abschnitt ${i + 1} von ${haeppchen.length} …` : "Das Modell denkt nach …");
        const teil = await ki.frageJson({
          prompt: "kartengenerator",
          werte: { ANZAHL: Math.max(1, Math.ceil(wieViele / haeppchen.length)) },
          nutzerText: haeppchen[i],
          zweck: "Kartenvorschläge",
          hoechstensZeichen: 4000,
        });
        if (Array.isArray(teil)) alle.push(...teil);
      }
      const geprueft = pruefeVorschlaege(alle, kartenVon(setId));
      setBericht(geprueft);
      setMeldung("");
    } catch (e) {
      setFehler(String(e?.message || e));
    } finally { setLaeuft(false); }
  };

  const uebernehmen = async () => {
    const entwuerfe = alsEntwuerfe(setId, bericht.brauchbar);
    await entwuerfeAnlegen(entwuerfe);
    aufSchliessen();
    gehe("/stapel/" + setId + "/entwuerfe");
  };

  const vorschau = vorlage.trim()
    ? ki.vorschau({ prompt: "kartengenerator", werte: { ANZAHL: wieViele },
      nutzerText: inHaeppchen(vorlage, 3000)[0] })
    : null;

  return (
    <Dialog weit titel="Karten aus einer Vorlage" aufSchliessen={aufSchliessen}
      fuss={<>
        <Knopf onClick={aufSchliessen}>Abbrechen</Knopf>
        {bericht
          ? <Knopf art="voll" onClick={uebernehmen} disabled={!bericht.brauchbar.length}>
              {anzahl(bericht.brauchbar.length, "Entwurf anlegen", "Entwürfe anlegen")}
            </Knopf>
          : <Knopf art="voll" onClick={erzeugen}
              disabled={!bereit || laeuft || vorlage.trim().length < 40}>
              {laeuft ? "Arbeitet …" : "Vorschläge erzeugen"}
            </Knopf>}
      </>}>

      {!bereit ? (
        <div className="rueckmeldung fast">
          <div className="reihe"><Symbol name="zahnrad" /><strong>Noch nicht eingerichtet</strong></div>
          <p className="klein" style={{ marginTop: 8 }}>
            Für diesen Weg braucht es ein Sprachmodell. Am einfachsten läuft es
            mit LM Studio auf diesem Rechner, dann verlässt die Vorlage das
            Gerät nicht und es kostet nichts.
          </p>
          <Knopf art="klein" onClick={() => { aufSchliessen(); gehe("/einstellungen"); }}>
            In den Einstellungen einrichten
          </Knopf>
        </div>
      ) : (
        <>
          <p className="klein matt" style={{ marginTop: 0 }}>
            Füge einen Abschnitt aus dem Buch, dem Heft oder deinen Notizen ein.
            Heraus kommen <strong>Vorderseiten</strong> mit der Stelle, auf die
            sie sich stützen. Die Rückseiten schreibst du selbst, das ist der
            Teil, bei dem man lernt.
          </p>

          <textarea className="feld" style={{ minHeight: 170 }} value={vorlage}
            placeholder="Text der Vorlage hier einfügen …"
            onChange={(e) => { setVorlage(e.target.value); setBericht(null); }} />

          <div className="reihe umbruch" style={{ marginTop: 12, gap: 10 }}>
            <input ref={waehler} type="file" accept="image/*" style={{ display: "none" }}
              onChange={(e) => bildLesen(e.target.files[0])} />
            <Knopf art="klein" symbol="kamera" onClick={() => waehler.current?.click()}>
              Aus einem Foto lesen
            </Knopf>
            <label className="reihe klein matt" style={{ gap: 6 }}>
              Höchstens
              <input className="feld" type="number" min="1" max="40" value={wieViele}
                style={{ width: 70 }}
                onChange={(e) => setWieViele(Math.max(1, Math.min(40, Number(e.target.value) || 1)))} />
              Karten
            </label>
            <div className="dehnen" />
            <span className={"marke " + (stand?.gut ? "gruen" : "rot")}>
              <span className={"wolke-punkt " + (stand?.gut ? "gut" : "fehler")} />
              {lokal ? "LM Studio" : ki.ANBIETER[zugang.anbieter]?.name}
              {stand ? " · " + stand.text : ""}
            </span>
          </div>

          {/* Was verlässt den Rechner */}
          <div className="klein" style={{ marginTop: 12 }}>
            {lokal ? (
              <span className="matt">
                <Symbol name="haken" groesse={14} /> Läuft auf diesem Rechner,
                die Vorlage verlässt das Gerät nicht.
              </span>
            ) : (
              <span style={{ color: "var(--gelb)" }}>
                <Symbol name="wolke" groesse={14} /> Die Vorlage wird an
                {" " + ki.ANBIETER[zugang.anbieter]?.name} gesendet
                {vorschau ? ` (${vorschau.zeichen} Zeichen)` : ""}.
                {" "}
                <button className="knopf leer klein" onClick={() => setZeigeVorschau(true)}>
                  Genau ansehen
                </button>
              </span>
            )}
          </div>

          {laeuft && (
            <div style={{ marginTop: 16 }}>
              <div className="balken" style={{ height: 8 }}>
                <span className="vertraut" style={{ width: "100%", opacity: 0.6 }} />
              </div>
              <div className="klein matt" style={{ marginTop: 6 }}>{meldung}</div>
            </div>
          )}

          {fehler && (
            <div className="rueckmeldung schlecht klein" style={{ marginTop: 12 }}>
              {fehler}
              {lokal && (
                <div style={{ marginTop: 6 }}>
                  Prüfe, ob in LM Studio der Server läuft und ein Modell geladen ist.
                </div>
              )}
            </div>
          )}

          {/* Prüfbericht */}
          {bericht && (
            <>
              <hr className="trennlinie" />
              <div className="reihe" style={{ marginBottom: 10 }}>
                <h3 className="dehnen">
                  {anzahl(bericht.brauchbar.length, "brauchbarer Vorschlag", "brauchbare Vorschläge")}
                </h3>
                {bericht.verworfen.length > 0 && (
                  <span className="marke gelb">{bericht.verworfen.length} ausgesiebt</span>
                )}
              </div>

              <div style={{ display: "grid", gap: 6, maxHeight: 260, overflow: "auto" }}>
                {bericht.brauchbar.map((v, i) => (
                  <div key={i} className="karten-zeile" style={{ padding: "10px 14px" }}>
                    <div className="seite">{v.frage}</div>
                    <div className="seite klein blass" style={{ fontStyle: "italic" }}>
                      {v.quelle}
                    </div>
                    <SymbolKnopf symbol="kreuz" titel="Verwerfen"
                      onClick={() => setBericht({ ...bericht,
                        brauchbar: bericht.brauchbar.filter((_, j) => j !== i) })} />
                  </div>
                ))}
              </div>

              {bericht.verworfen.length > 0 && (
                <details style={{ marginTop: 12 }}>
                  <summary className="klein matt" style={{ cursor: "pointer" }}>
                    Was ausgesiebt wurde und warum
                  </summary>
                  <div className="klein blass" style={{ marginTop: 8, display: "grid", gap: 4 }}>
                    {bericht.verworfen.map((v, i) => (
                      <div key={i}>
                        <span className="marke">{v.grund}</span>{" "}
                        {v.vorschlag.frage || <em>ohne Frage</em>}
                      </div>
                    ))}
                  </div>
                </details>
              )}

              <p className="klein matt" style={{ marginTop: 12 }}>
                Die vorgeschlagenen Rückseiten sind mit dabei, bleiben aber
                verborgen, bis du deine eigene geschrieben hast.
              </p>
            </>
          )}
        </>
      )}

      {zeigeVorschau && vorschau && (
        <Dialog weit titel="Das würde gesendet" aufSchliessen={() => setZeigeVorschau(false)}
          fuss={<Knopf art="voll" onClick={() => setZeigeVorschau(false)}>Verstanden</Knopf>}>
          <label className="beschriftung">Anweisung ({vorschau.anweisungName})</label>
          <pre className="klein matt" style={{ whiteSpace: "pre-wrap", background: "var(--grund-3)",
            padding: 12, borderRadius: 8, maxHeight: 220, overflow: "auto" }}>
            {vorschau.anweisung}
          </pre>
          <label className="beschriftung" style={{ marginTop: 12 }}>Deine Vorlage</label>
          <pre className="klein" style={{ whiteSpace: "pre-wrap", background: "var(--grund-3)",
            padding: 12, borderRadius: 8, maxHeight: 220, overflow: "auto" }}>
            {vorschau.nutzerText}
          </pre>
        </Dialog>
      )}
    </Dialog>
  );
}
