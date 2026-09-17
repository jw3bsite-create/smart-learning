/*
 * Feynman — erklären, bis nichts mehr fehlt.
 *
 * Der Nutzer schreibt eine Erklärung in eigenen Worten. Die KI antwortet
 * ausschließlich mit Lücken und Fragen dazu; sie füllt nichts, ergänzt nichts,
 * lobt nichts. Der Nutzer überarbeitet, bis die Liste leer ist.
 *
 * Der Widerstand ist der Sinn der Sache. Wer eine Erklärung selbst schreibt,
 * merkt an genau den Stellen etwas, an denen er sonst weitergelesen hätte —
 * dort, wo der eigene Satz stockt, sitzt die Lücke. Eine KI, die diese Stellen
 * glattbügelt, nimmt einem die Erkenntnis ab und lässt das Gefühl zurück,
 * verstanden zu haben.
 *
 * Ohne Sprachmodell ist der Modus nicht wertlos: Das Schreiben allein wirkt
 * (der Effekt heißt Generieren), und die Fassungen werden ebenso aufgehoben.
 * Es fehlt dann nur die Rückmeldung.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useDaten } from "../core/store.jsx";
import * as ki from "../core/ki.js";
import { umfangDerErklaerung } from "../core/model.js";
import { datumKurz, anzahl } from "../core/util.js";
import { gehe } from "../App.jsx";
import { Knopf, SymbolKnopf, Symbol, Leer, Dialog } from "../ui/basis.jsx";
import { ModusRahmen } from "./gemeinsam.jsx";

/** Nach so vielen Runden wird nicht weiter nachgehakt (§3.4). */
const RUNDEN_HOECHSTENS = 5;

const ART_NAME = { luecke: "Lücke", ungenau: "ungenau", falsch: "falsch" };
const ART_FARBE = { luecke: "var(--gelb)", ungenau: "var(--akzent)", falsch: "var(--rot)" };

export default function Feynman({ erklaerungId, aufSchliessen }) {
  const {
    erklaerungen, faecher,
    erklaerungAnlegen, erklaerungFortschreiben, erklaerungLoeschen,
  } = useDaten();

  const [text, setText] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState("");
  const [kiDa, setKiDa] = useState(null);
  const [verlauf, setVerlauf] = useState(false);
  const [aufgeben, setAufgeben] = useState(false);
  const feld = useRef(null);

  const erklaerung = erklaerungen.find((x) => x.id === erklaerungId) || null;

  useEffect(() => {
    (async () => {
      const zugang = await ki.zugangLesen();
      setKiDa(ki.eingerichtet(zugang));
    })();
  }, []);

  useEffect(() => {
    if (!erklaerung) return;
    const letzte = erklaerung.fassungen[erklaerung.fassungen.length - 1];
    setText(letzte ? letzte.text : "");
    setTimeout(() => feld.current?.focus(), 60);
  }, [erklaerungId, erklaerung?.fassungen.length]);

  const woerter = useMemo(
    () => text.trim().split(/\s+/).filter(Boolean).length, [text]);

  /* --------------------------- Der eine Aufruf --------------------------- */

  const pruefenLassen = async () => {
    if (!erklaerung || woerter < 15) return;
    setLaeuft(true); setFehler("");
    try {
      const luecken = await ki.frageJson({
        prompt: "feynman",
        nutzerText: "Thema: " + erklaerung.thema + "\n\nMeine Erklärung:\n" + text,
        zweck: "Lücken in einer Erklärung",
        temperatur: 0.2,
        hoechstensZeichen: 1500,
      });
      await erklaerungFortschreiben(erklaerung.id, text,
        Array.isArray(luecken) ? luecken.slice(0, 5) : []);
    } catch (e) {
      setFehler(String(e?.message || e));
    } finally {
      setLaeuft(false);
    }
  };

  /** Ohne Modell: Fassung aufheben, ohne Rückmeldung. */
  const nurSichern = async () => {
    if (!erklaerung || !text.trim()) return;
    await erklaerungFortschreiben(erklaerung.id, text, null);
  };

  /* ------------------------------ Übersicht ------------------------------ */

  if (!erklaerung) {
    return <Uebersicht faecher={faecher} erklaerungen={erklaerungen}
      aufAnlegen={erklaerungAnlegen}
      aufLoeschen={erklaerungLoeschen} aufSchliessen={aufSchliessen} />;
  }

  const luecken = erklaerung.offeneLuecken || [];
  const hatRueckmeldung = erklaerung.runden > 0;
  const fertig = erklaerung.erledigt;
  const genugRunden = erklaerung.runden >= RUNDEN_HOECHSTENS && luecken.length > 0;

  return (
    <ModusRahmen titel="Erklären" symbol="buch" aufSchliessen={aufSchliessen}
      rechts={<>
        {erklaerung.runden > 0 && (
          <span className="klein matt">Runde {erklaerung.runden}</span>
        )}
        <span className="klein blass mono">{woerter} Wörter</span>
        {erklaerung.fassungen.length > 1 && (
          <SymbolKnopf symbol="uhr" titel="Frühere Fassungen"
            onClick={() => setVerlauf(true)} />
        )}
      </>}>

      <h1 style={{ marginBottom: 4 }}>{erklaerung.thema}</h1>
      <p className="matt" style={{ marginTop: 0 }}>
        Erkläre es so, als säße jemand vor dir, der davon noch nie gehört hat.
        Keine Stichworte, ganze Sätze.
      </p>

      <textarea ref={feld} className="feld"
        style={{ minHeight: 260, fontSize: 16, lineHeight: 1.7 }}
        placeholder="Schreib los …"
        value={text} onChange={(e) => setText(e.target.value)} />

      <div className="reihe umbruch" style={{ marginTop: 12 }}>
        {woerter < 15 && (
          <span className="klein blass">
            Noch etwas kurz, unter fünfzehn Wörtern lohnt die Prüfung nicht.
          </span>
        )}
        <div className="dehnen" />
        {kiDa === false ? (
          <>
            <span className="klein matt">Kein Sprachmodell eingerichtet</span>
            <Knopf art="voll" onClick={nurSichern} disabled={!text.trim()}>
              Fassung aufheben
            </Knopf>
          </>
        ) : (
          <Knopf art="voll" onClick={pruefenLassen} disabled={laeuft || woerter < 15}>
            {laeuft ? "Wird gelesen …" : hatRueckmeldung ? "Erneut prüfen lassen" : "Prüfen lassen"}
          </Knopf>
        )}
      </div>

      {fehler && (
        <div className="rueckmeldung schlecht klein" style={{ marginTop: 12 }}>{fehler}</div>
      )}

      {/* ---------------------------- Rückmeldung --------------------------- */}
      {fertig && (
        <div className="rueckmeldung gut" style={{ marginTop: 18 }}>
          <div className="reihe">
            <Symbol name="haken" />
            <strong>Nichts mehr offen.</strong>
          </div>
          <p className="klein" style={{ marginTop: 6, marginBottom: 0 }}>
            Das heißt nicht, dass die Erklärung vollständig ist, nur, dass die
            Prüfung nichts mehr gefunden hat. Der beste nächste Schritt: das
            Thema in ein paar Tagen noch einmal erklären, ohne vorher
            nachzulesen.
          </p>
        </div>
      )}

      {luecken.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <div className="reihe" style={{ marginBottom: 10 }}>
            <h3 className="dehnen">
              {anzahl(luecken.length, "Stelle", "Stellen")}, an denen etwas fehlt
            </h3>
            {genugRunden && (
              <Knopf art="klein leer" onClick={() => setAufgeben(true)}>
                Für heute genug
              </Knopf>
            )}
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {luecken.map((l, i) => (
              <div key={i} className="karten-zeile" style={{ display: "block", padding: 14 }}>
                <div className="reihe klein" style={{ marginBottom: 6 }}>
                  <span className="marke" style={{ color: ART_FARBE[l.art] || undefined }}>
                    {ART_NAME[l.art] || "unklar"}
                  </span>
                  {l.stelle && <span className="blass" style={{ fontStyle: "italic" }}>
                    „{l.stelle}“
                  </span>}
                </div>
                <div style={{ fontSize: 16 }}>{l.frage}</div>
              </div>
            ))}
          </div>
          <p className="klein matt" style={{ marginTop: 12 }}>
            Beantworte die Fragen nicht hier, sondern oben im Text, schreib die
            Erklärung so um, dass sie sich nicht mehr stellen.
          </p>
        </div>
      )}

      {/* ----------------------------- Verlauf ------------------------------ */}
      {verlauf && (
        <Dialog weit titel="Frühere Fassungen" aufSchliessen={() => setVerlauf(false)}
          fuss={<Knopf art="voll" onClick={() => setVerlauf(false)}>Schließen</Knopf>}>
          <p className="klein matt" style={{ marginTop: 0 }}>
            Wie sich deine Erklärung entwickelt hat. Das ist der ehrlichste
            Fortschrittsmesser, den diese App kennt.
          </p>
          <div style={{ display: "grid", gap: 12 }}>
            {[...erklaerung.fassungen].reverse().map((f, i) => (
              <div key={i} className="zahl-kachel">
                <div className="reihe klein matt" style={{ marginBottom: 6 }}>
                  <span>{datumKurz(f.zeit)}</span>
                  <span className="mono">
                    {f.text.trim().split(/\s+/).filter(Boolean).length} Wörter
                  </span>
                  <div className="dehnen" />
                  <span className={"marke " + (f.lueckenZahl === 0 ? "gruen" : "gelb")}>
                    {f.lueckenZahl === 0 ? "nichts offen" : f.lueckenZahl + " offen"}
                  </span>
                </div>
                <div className="klein" style={{ whiteSpace: "pre-wrap", maxHeight: 160,
                  overflow: "auto" }}>{f.text}</div>
              </div>
            ))}
          </div>
        </Dialog>
      )}

      {aufgeben && (
        <Dialog titel="Für heute genug" aufSchliessen={() => setAufgeben(false)}
          fuss={<>
            <Knopf onClick={() => setAufgeben(false)}>Weiter versuchen</Knopf>
            <Knopf art="voll" onClick={() => { setAufgeben(false); aufSchliessen(); }}>
              Beenden
            </Knopf>
          </>}>
          <p>
            Nach {RUNDEN_HOECHSTENS} Runden hakt es meist nicht mehr am Formulieren,
            sondern am Stoff. Das ist kein Scheitern, sondern ein Befund: Hier
            fehlt Grundlage.
          </p>
          <p className="klein matt">
            Sinnvoller Nächstschritt: die offenen Stellen als Karten anlegen und
            erst einmal abrufen. In ein paar Tagen liest sich die eigene
            Erklärung anders.
          </p>
        </Dialog>
      )}
    </ModusRahmen>
  );
}

/* --------------------------- Liste aller Themen ------------------------- */

function Uebersicht({ faecher, erklaerungen, aufAnlegen, aufLoeschen, aufSchliessen }) {
  const [thema, setThema] = useState("");
  const [fach, setFach] = useState("");

  const anlegen = async () => {
    if (!thema.trim()) return;
    const x = await aufAnlegen({ thema: thema.trim(), subjectId: fach || null });
    setThema("");
    gehe("/erklaeren/" + x.id);
  };

  return (
    <ModusRahmen titel="Erklären" symbol="buch" aufSchliessen={aufSchliessen}>
      <h1>Erklären</h1>
      <p className="matt">
        Ein Thema in eigenen Worten erklären und sich sagen lassen, wo es hakt,
        aber nicht, wie es weitergeht. Das Nachdenken bleibt bei dir.
      </p>

      <div className="reihe umbruch" style={{ marginTop: 18, marginBottom: 26 }}>
        <input className="feld" style={{ flex: 1, minWidth: 220 }} value={thema}
          placeholder="Welches Thema? Etwa „Ableitung der Kettenregel“"
          onChange={(e) => setThema(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") anlegen(); }} />
        <select className="feld" style={{ width: "auto" }} value={fach}
          onChange={(e) => setFach(e.target.value)}>
          <option value="">(ohne Fach)</option>
          {faecher.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <Knopf art="voll" symbol="plus" onClick={anlegen} disabled={!thema.trim()}>
          Anfangen
        </Knopf>
      </div>

      {erklaerungen.length === 0 ? (
        <Leer symbol="buch" titel="Noch nichts erklärt"
          text="Nimm ein Thema, das du gerade lernst, und versuch es aufzuschreiben, ohne nachzusehen. Die Stellen, an denen du ins Stocken gerätst, sind die Antwort." />
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {[...erklaerungen].sort((a, b) => b.updatedAt - a.updatedAt).map((x) => {
            const f = faecher.find((y) => y.id === x.subjectId);
            return (
              <div key={x.id} className="karten-zeile" style={{ cursor: "pointer" }}
                onClick={() => gehe("/erklaeren/" + x.id)}>
                <div className="seite">
                  <div style={{ fontSize: 16 }}>{x.thema}</div>
                  <div className="klein blass">
                    {f ? f.name + " · " : ""}
                    {anzahl(x.fassungen.length, "Fassung", "Fassungen")}
                    {" · " + umfangDerErklaerung(x) + " Wörter"}
                  </div>
                </div>
                <div className="seite klein matt">
                  {x.erledigt
                    ? <span className="marke gruen">nichts offen</span>
                    : x.runden === 0
                      ? <span className="marke">noch nicht geprüft</span>
                      : <span className="marke gelb">
                          {(x.offeneLuecken || []).length} offen
                        </span>}
                </div>
                <div className="werkzeuge">
                  <span className="klein blass">{datumKurz(x.updatedAt)}</span>
                  <SymbolKnopf symbol="muell" titel="Löschen"
                    onClick={(e) => { e.stopPropagation(); aufLoeschen(x.id); }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </ModusRahmen>
  );
}
