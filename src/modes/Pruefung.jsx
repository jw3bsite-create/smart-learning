/*
 * Prüfungssimulation — der Moment, in dem die Krücke wegfällt.
 *
 * Unter Zeit, ohne Sprachmodell, ohne Karten, ohne Nachschlagen. Erst nach
 * der Abgabe wird ausgewertet.
 *
 * Das ist die einzige Messung dieser App, die etwas über das Abitur aussagt.
 * Alles andere misst, wie gut man mit Hilfe zurechtkommt; hier zeigt sich,
 * was ohne sie übrig bleibt. Wer regelmäßig übt und nie unter Prüfungs-
 * bedingungen schreibt, misst nur die Qualität seiner Hilfsmittel.
 *
 * Die Auswertung vergibt keine Note. Sie prüft, ob die Kriterien, die der
 * Nutzer selbst hinterlegt hat, im Text vorkommen — mehr kann ein Modell
 * nicht wissen, das den Erwartungshorizont der Lehrkraft nicht kennt.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useDaten } from "../core/store.jsx";
import * as ki from "../core/ki.js";
import { pruefungsStand } from "../core/model.js";
import { datumKurz, anzahl } from "../core/util.js";
import { gehe } from "../App.jsx";
import { Knopf, SymbolKnopf, Symbol, Leer, Dialog, Rueckfrage } from "../ui/basis.jsx";
import { ModusRahmen } from "./gemeinsam.jsx";

const STAND_FARBE = { ja: "var(--gruen)", unklar: "var(--gelb)", nein: "var(--rot)", offen: "var(--rand)" };
const STAND_NAME = { ja: "behandelt", unklar: "unklar", nein: "fehlt", offen: "offen" };

/* ------------------------------ Die Uhr -------------------------------- */

function Uhr({ bis, aufAblauf }) {
  const [jetzt, setJetzt] = useState(Date.now());
  useEffect(() => {
    const takt = setInterval(() => setJetzt(Date.now()), 1000);
    return () => clearInterval(takt);
  }, []);
  useEffect(() => {
    if (bis && jetzt >= bis) aufAblauf?.();
  }, [jetzt >= bis]);

  if (!bis) return <span className="klein matt">ohne Zeitnahme</span>;
  const rest = Math.max(0, bis - jetzt);
  const min = Math.floor(rest / 60000);
  const sek = Math.floor((rest % 60000) / 1000);
  const knapp = rest < 10 * 60000;
  return (
    <span className="mono" style={{ fontSize: 17, color: knapp ? "var(--rot)" : undefined }}>
      {String(min).padStart(2, "0")}:{String(sek).padStart(2, "0")}
    </span>
  );
}

/* ============================== Der Modus =============================== */

export default function Pruefung({ pruefungId, aufSchliessen }) {
  const {
    pruefungen, faecher, pruefungAnlegen, pruefungAendern, pruefungLoeschen,
  } = useDaten();

  const pruefung = pruefungen.find((p) => p.id === pruefungId) || null;
  const [text, setText] = useState("");
  const [abgabeFrage, setAbgabeFrage] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState("");
  const feld = useRef(null);
  const sichern = useRef(null);

  useEffect(() => {
    if (!pruefung) return;
    setText(pruefung.text || "");
  }, [pruefungId]);

  /* Während des Schreibens regelmäßig sichern — ein Absturz darf keine
     neunzig Minuten kosten. */
  useEffect(() => {
    if (!pruefung || pruefung.abgegeben) return;
    clearTimeout(sichern.current);
    sichern.current = setTimeout(() => {
      pruefungAendern(pruefung.id, { text });
    }, 3000);
    return () => clearTimeout(sichern.current);
  }, [text]);

  const stand = useMemo(
    () => (pruefung ? pruefungsStand({ ...pruefung, text }) : null), [pruefung, text]);

  const woerter = text.trim().split(/\s+/).filter(Boolean).length;

  /* --------------------------- Abgabe und Prüfung ------------------------ */

  const abgeben = async () => {
    if (!pruefung) return;
    setAbgabeFrage(false);
    const gebraucht = pruefung.begonnen ? Date.now() - pruefung.begonnen : 0;
    await pruefungAendern(pruefung.id, {
      text, abgegeben: Date.now(), gebrauchteZeit: gebraucht,
    });
  };

  const kriterienPruefen = async () => {
    if (!pruefung?.kriterien?.length) return;
    setLaeuft(true); setFehler("");
    try {
      const ergebnis = await ki.frageJson({
        prompt: "kriterien",
        nutzerText: "Kriterien:\n"
          + pruefung.kriterien.map((k, i) => (i + 1) + ". " + k).join("\n")
          + "\n\nText des Nutzers:\n" + (pruefung.text || text),
        zweck: "Kriterien einer Prüfung",
        temperatur: 0.1,
        hoechstensZeichen: 2500,
      });
      await pruefungAendern(pruefung.id,
        { ergebnis: Array.isArray(ergebnis) ? ergebnis : [] });
    } catch (e) {
      setFehler(String(e?.message || e));
    } finally {
      setLaeuft(false);
    }
  };

  /* ------------------------------ Übersicht ------------------------------ */

  if (!pruefung) {
    return <Uebersicht pruefungen={pruefungen} faecher={faecher}
      aufAnlegen={pruefungAnlegen} aufLoeschen={pruefungLoeschen}
      aufSchliessen={aufSchliessen} />;
  }

  const fach = faecher.find((f) => f.id === pruefung.subjectId);
  const laufend = pruefung.begonnen && !pruefung.abgegeben;
  const bis = laufend && pruefung.minuten
    ? pruefung.begonnen + pruefung.minuten * 60000 : 0;

  /* ------------------------------- Vor dem Start ------------------------- */
  if (!pruefung.begonnen) {
    return (
      <ModusRahmen titel="Prüfung" symbol="papier" aufSchliessen={aufSchliessen}>
        <h1>{pruefung.titel}</h1>
        <p className="klein matt">{fach ? fach.name : "ohne Fach"}</p>

        <div className="rueckmeldung fast" style={{ marginTop: 18 }}>
          <div className="reihe"><Symbol name="uhr" /><strong>Es gilt wie in der Prüfung.</strong></div>
          <p className="klein" style={{ marginTop: 6, marginBottom: 0 }}>
            Kein Sprachmodell, keine Karten, kein Nachschlagen in dieser App.
            {pruefung.minuten
              ? ` Die Uhr läuft ${pruefung.minuten} Minuten.`
              : " Ohne Zeitnahme, trag eine Zeit ein, wenn du sie kennst."}
            {pruefung.hilfsmittelfrei && " Hilfsmittelfreier Teil."}
          </p>
        </div>

        {pruefung.aufgabe && (
          <div className="zahl-kachel" style={{ marginTop: 18 }}>
            <div className="klein matt" style={{ marginBottom: 6 }}>Aufgabe</div>
            <div style={{ whiteSpace: "pre-wrap" }}>{pruefung.aufgabe}</div>
          </div>
        )}

        <div className="klein matt" style={{ marginTop: 18 }}>
          {anzahl(pruefung.kriterien.length, "Kriterium hinterlegt", "Kriterien hinterlegt")}
          {pruefung.kriterien.length === 0
            && " (ohne Erwartungshorizont gibt es hinterher nichts abzugleichen)."}
        </div>

        <Knopf art="voll gross" symbol="uhr" style={{ marginTop: 22 }}
          onClick={() => pruefungAendern(pruefung.id, { begonnen: Date.now() })}>
          Prüfung beginnen
        </Knopf>
      </ModusRahmen>
    );
  }

  /* -------------------------------- Schreiben ---------------------------- */
  if (laufend) {
    return (
      <ModusRahmen titel={pruefung.titel} symbol="papier"
        aufSchliessen={() => setAbgabeFrage(true)}
        rechts={<>
          <span className="klein blass mono">{woerter} Wörter</span>
          <Uhr bis={bis} aufAblauf={abgeben} />
        </>}>

        {pruefung.aufgabe && (
          <details open style={{ marginBottom: 14 }}>
            <summary className="klein matt" style={{ cursor: "pointer" }}>Aufgabe</summary>
            <div className="zahl-kachel" style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>
              {pruefung.aufgabe}
            </div>
          </details>
        )}

        <textarea ref={feld} className="feld" autoFocus
          style={{ minHeight: "58vh", fontSize: 16, lineHeight: 1.7 }}
          placeholder="Deine Antwort …"
          value={text} onChange={(e) => setText(e.target.value)} />

        <div className="reihe" style={{ marginTop: 12 }}>
          <span className="klein blass">
            Wird laufend gesichert. Die Kriterien siehst du erst nach der Abgabe.
          </span>
          <div className="dehnen" />
          <Knopf art="voll" onClick={() => setAbgabeFrage(true)}>Abgeben</Knopf>
        </div>

        {abgabeFrage && (
          <Rueckfrage titel="Abgeben?" bestaetigung="Abgeben"
            text="Danach lässt sich nichts mehr ändern. Das ist der Sinn der Sache."
            aufNein={() => setAbgabeFrage(false)} aufJa={abgeben} />
        )}
      </ModusRahmen>
    );
  }

  /* ------------------------------- Auswertung ---------------------------- */
  const minuten = Math.round((pruefung.gebrauchteZeit || 0) / 60000);

  return (
    <ModusRahmen titel="Auswertung" symbol="papier" aufSchliessen={aufSchliessen} anteil={1}>
      <h1>{pruefung.titel}</h1>
      <p className="klein matt">
        {fach ? fach.name + " · " : ""}
        {datumKurz(pruefung.abgegeben)}
        {minuten ? " · " + minuten + " Minuten gebraucht" : ""}
        {" · " + anzahl(woerter, "Wort", "Wörter")}
      </p>

      <div className="rueckmeldung fast" style={{ marginTop: 16 }}>
        <strong>Keine Note.</strong> Diese App weiß nicht, was deine Lehrkraft
        erwartet, sie prüft nur, ob die Kriterien vorkommen, die du selbst
        hinterlegt hast. Die Bewertung bleibt bei dir.
      </div>

      {/* ---------------------------- Kriterien ---------------------------- */}
      <div className="reihe" style={{ margin: "22px 0 10px" }}>
        <h3 className="dehnen">Kriterien</h3>
        {stand.gesamt > 0 && (
          <span className="klein matt">
            {stand.ja} behandelt, {stand.unklar} unklar, {stand.nein} fehlt
          </span>
        )}
        {pruefung.kriterien.length > 0 && !pruefung.ergebnis && (
          <Knopf art="klein" onClick={kriterienPruefen} disabled={laeuft}>
            {laeuft ? "Prüft …" : "Abgleichen lassen"}
          </Knopf>
        )}
      </div>

      {fehler && <div className="rueckmeldung schlecht klein">{fehler}</div>}

      {pruefung.kriterien.length === 0 ? (
        <p className="matt klein">
          Kein Erwartungshorizont hinterlegt. Trag die Kriterien nach, dann
          lässt sich abgleichen.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {pruefung.kriterien.map((k, i) => {
            const eintrag = (pruefung.ergebnis || []).find((e) => e.kriterium === k);
            const eigen = pruefung.selbstpruefung?.[i];
            const wert = eigen || eintrag?.stand || "offen";
            return (
              <div key={i} className="karten-zeile" style={{ display: "block", padding: 14,
                borderLeft: "4px solid " + STAND_FARBE[wert] }}>
                <div className="reihe" style={{ marginBottom: 6 }}>
                  <span className="dehnen">{k}</span>
                  <span className="marke klein" style={{ color: STAND_FARBE[wert] }}>
                    {STAND_NAME[wert]}
                  </span>
                </div>
                {eintrag?.stelle && (
                  <div className="klein blass" style={{ fontStyle: "italic" }}>
                    gefunden bei: „{eintrag.stelle}“
                  </div>
                )}
                <div className="reihe klein" style={{ marginTop: 8, gap: 6 }}>
                  <span className="blass">Du selbst:</span>
                  {["ja", "unklar", "nein"].map((w) => (
                    <button key={w} className={"knopf klein" + (eigen === w ? " voll" : " leer")}
                      onClick={() => pruefungAendern(pruefung.id, {
                        selbstpruefung: { ...(pruefung.selbstpruefung || {}), [i]: w },
                      })}>
                      {STAND_NAME[w]}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ------------------------------ Der Text ---------------------------- */}
      <details style={{ marginTop: 24 }}>
        <summary className="klein matt" style={{ cursor: "pointer" }}>Dein Text</summary>
        <div className="zahl-kachel" style={{ marginTop: 8, whiteSpace: "pre-wrap",
          lineHeight: 1.7 }}>{pruefung.text || text}</div>
      </details>

      <div className="reihe" style={{ marginTop: 24, flexWrap: "wrap" }}>
        <Knopf art="voll" symbol="papier" onClick={() => gehe("/pruefung")}>
          Zur Übersicht
        </Knopf>
        <Knopf onClick={() => gehe("/statistik")}>Fortschritt ansehen</Knopf>
      </div>
    </ModusRahmen>
  );
}

/* ---------------------------- Liste und Anlegen ------------------------- */

function Uebersicht({ pruefungen, faecher, aufAnlegen, aufLoeschen, aufSchliessen }) {
  const [neu, setNeu] = useState(false);
  const [titel, setTitel] = useState("");
  const [fach, setFach] = useState("");
  const [aufgabe, setAufgabe] = useState("");
  const [minuten, setMinuten] = useState(0);
  const [kriterienText, setKriterienText] = useState("");
  const [hilfsmittelfrei, setHilfsmittelfrei] = useState(false);

  const anlegen = async () => {
    if (!titel.trim()) return;
    const p = await aufAnlegen({
      titel: titel.trim(), subjectId: fach || null, aufgabe,
      minuten: Number(minuten) || 0, hilfsmittelfrei,
      kriterien: kriterienText.split("\n").map((z) => z.trim()).filter(Boolean),
    });
    setNeu(false); setTitel(""); setAufgabe(""); setKriterienText(""); setMinuten(0);
    gehe("/pruefung/" + p.id);
  };

  return (
    <ModusRahmen titel="Prüfungen" symbol="papier" aufSchliessen={aufSchliessen}>
      <div className="reihe">
        <h1 className="dehnen">Prüfungssimulation</h1>
        <Knopf art="voll" symbol="plus" onClick={() => setNeu(true)}>Neue Prüfung</Knopf>
      </div>
      <p className="matt" style={{ maxWidth: 640 }}>
        Unter Zeit, ohne jede Hilfe, Auswertung erst nach der Abgabe. Das ist
        die einzige Übung, die zeigt, was ohne Hilfsmittel übrig bleibt.
      </p>

      {pruefungen.length === 0 ? (
        <Leer symbol="papier" titel="Noch keine Prüfung"
          text="Nimm eine Aufgabe aus einer alten Klausur oder aus dem Übungsbuch, trag die Kriterien der Musterlösung ein und schreib sie unter Zeit." />
      ) : (
        <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
          {[...pruefungen].sort((a, b) => b.zeit - a.zeit).map((p) => {
            const f = faecher.find((x) => x.id === p.subjectId);
            const s = pruefungsStand(p);
            return (
              <div key={p.id} className="karten-zeile" style={{ cursor: "pointer" }}
                onClick={() => gehe("/pruefung/" + p.id)}>
                <div className="seite">
                  <div style={{ fontSize: 16 }}>{p.titel}</div>
                  <div className="klein blass">
                    {f ? f.name + " · " : ""}
                    {p.minuten ? p.minuten + " min · " : ""}
                    {anzahl(p.kriterien.length, "Kriterium", "Kriterien")}
                  </div>
                </div>
                <div className="seite klein matt">
                  {!p.begonnen ? <span className="marke">noch nicht begonnen</span>
                    : !p.abgegeben ? <span className="marke gelb">läuft</span>
                      : <span className="marke gruen">
                          {s.gesamt ? s.ja + " von " + s.gesamt + " behandelt" : "abgegeben"}
                        </span>}
                </div>
                <div className="werkzeuge">
                  <span className="klein blass">{datumKurz(p.zeit)}</span>
                  <SymbolKnopf symbol="muell" titel="Löschen"
                    onClick={(e) => { e.stopPropagation(); aufLoeschen(p.id); }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {neu && (
        <Dialog weit titel="Neue Prüfung" aufSchliessen={() => setNeu(false)}
          fuss={<>
            <Knopf onClick={() => setNeu(false)}>Abbrechen</Knopf>
            <Knopf art="voll" onClick={anlegen} disabled={!titel.trim()}>Anlegen</Knopf>
          </>}>
          <div className="antwort-gitter">
            <div>
              <label className="beschriftung">Titel</label>
              <input className="feld" value={titel} placeholder="Etwa „Analysis, Wahlteil 2019“"
                onChange={(e) => setTitel(e.target.value)} />
            </div>
            <div>
              <label className="beschriftung">Fach</label>
              <select className="feld" value={fach} onChange={(e) => setFach(e.target.value)}>
                <option value="">(ohne Fach)</option>
                {faecher.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
          </div>

          <label className="beschriftung" style={{ marginTop: 14 }}>Aufgabenstellung</label>
          <textarea className="feld" style={{ minHeight: 90 }} value={aufgabe}
            placeholder="Der Wortlaut der Aufgabe …"
            onChange={(e) => setAufgabe(e.target.value)} />

          <label className="beschriftung" style={{ marginTop: 14 }}>
            Erwartungshorizont, ein Kriterium je Zeile
          </label>
          <textarea className="feld" style={{ minHeight: 120 }} value={kriterienText}
            placeholder={"Ableitung korrekt gebildet\nRandwerte geprüft\nErgebnis im Sachzusammenhang gedeutet"}
            onChange={(e) => setKriterienText(e.target.value)} />
          <p className="klein matt">
            Aus der Musterlösung oder aus dem, was im Unterricht besprochen
            wurde. Je genauer, desto brauchbarer der Abgleich.
          </p>

          <div className="reihe umbruch" style={{ marginTop: 14 }}>
            <label className="reihe klein matt" style={{ gap: 6 }}>
              Zeit in Minuten
              <input className="feld" type="number" min="0" max="360" style={{ width: 90 }}
                value={minuten} onChange={(e) => setMinuten(e.target.value)} />
            </label>
            <label className="schalter">
              <input type="checkbox" checked={hilfsmittelfrei}
                onChange={(e) => setHilfsmittelfrei(e.target.checked)} />
              <span>Hilfsmittelfreier Teil</span>
            </label>
          </div>
          <p className="klein blass">
            Die Prüfungszeiten für dein Abitur trägst du selbst ein, sie stehen
            im Bildungsplan und ändern sich; geraten wird hier nichts.
          </p>
        </Dialog>
      )}
    </ModusRahmen>
  );
}
