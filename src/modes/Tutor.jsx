/*
 * Die Fachtutoren.
 *
 * Kein Chatfenster im üblichen Sinn: Der Tutor fragt, der Nutzer denkt. Es
 * gibt keinen Knopf „Lösung anzeigen", und der Tutor hat Anweisung, sie auch
 * auf Bitten nicht herauszurücken. Was er trotzdem tut — Modelle sind
 * dienstfertig und vergessen ihre Regeln im Gesprächsverlauf —, fängt die
 * Drift-Erkennung ab: Wird die Antwort zu lang, enthält sie Code, eine
 * Rechnung oder eine Lösungsfloskel, erscheint eine Warnung und der
 * ZURÜCK-Knopf, der die Regeln neu einspielt.
 *
 * Der Hilfsumfang richtet sich nach der Stabilität der Karten des Fachs: Wer
 * einen Stoff kaum kennt, bekommt eher ein ausgearbeitetes Beispiel; wer ihn
 * beherrscht, bekommt nur noch Fragen. Dieselbe ausführliche Hilfe, die
 * Anfängern nützt, bremst Fortgeschrittene.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useDaten } from "../core/store.jsx";
import * as ki from "../core/ki.js";
import { pruefeAntwort, driftText, ZURUECK_TEXT } from "../core/drift.js";
import { istNeu } from "../core/fsrs.js";
import { gehe } from "../App.jsx";
import { Knopf, SymbolKnopf, Symbol, Leer } from "../ui/basis.jsx";
import { ModusRahmen } from "./gemeinsam.jsx";

/** Die sechs Fächer mit Tutor — der Schlüssel muss zur Datei in prompts/ passen. */
export const TUTOREN = [
  { schluessel: "mathe", name: "Mathematik", sperre: "rechnet nichts aus, prüft nur den Weg" },
  { schluessel: "deutsch", name: "Deutsch", sperre: "deutet nicht, verlangt Textbelege" },
  { schluessel: "chemie", name: "Chemie", sperre: "formuliert keine Mechanismen" },
  { schluessel: "it", name: "Informatik", sperre: "schreibt keine Zeile Code" },
  { schluessel: "ggk", name: "Gemeinschaftskunde", sperre: "wertet nicht, trennt Fakt und Wertung" },
  { schluessel: "gmt", name: "Gestaltung und Medien", sperre: "gibt Kriterien statt Analysen" },
];

/** Rät aus dem Fachnamen, welcher Tutor gemeint ist. */
function tutorZuFach(fachName = "") {
  const n = fachName.toLowerCase();
  if (/mathe/.test(n)) return "mathe";
  if (/deutsch/.test(n)) return "deutsch";
  if (/chem/.test(n)) return "chemie";
  if (/informatik|^it$|technische informatik/.test(n)) return "it";
  if (/gemeinschaft|ggk|politik/.test(n)) return "ggk";
  if (/gmt|gestalt|medien/.test(n)) return "gmt";
  return null;
}

export default function Tutor({ tutorSchluessel, aufSchliessen }) {
  const { faecher, karten, stapelVon, zustaende } = useDaten();
  const [verlauf, setVerlauf] = useState([]);
  const [eingabe, setEingabe] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState("");
  const [kiDa, setKiDa] = useState(null);
  const unten = useRef(null);
  const feld = useRef(null);

  const tutor = TUTOREN.find((t) => t.schluessel === tutorSchluessel) || null;

  useEffect(() => {
    (async () => {
      const zugang = await ki.zugangLesen();
      setKiDa(ki.eingerichtet(zugang));
    })();
  }, []);

  useEffect(() => {
    unten.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [verlauf.length, laeuft]);

  /* Das Fach, dessen Karten den Wahrheitsanker bilden. */
  const fach = useMemo(
    () => faecher.find((f) => tutorZuFach(f.name) === tutorSchluessel) || null,
    [faecher, tutorSchluessel]);

  /* Höchstens ein paar Dutzend Karten als Zusammenhang — mehr überfordert
     kleine Modelle und bringt nichts. */
  const stoff = useMemo(() => {
    if (!fach) return "";
    const eigene = karten.filter((k) => {
      const s = stapelVon(k.setId);
      return s && s.subjectId === fach.id;
    }).slice(0, 60);
    if (!eigene.length) return "";
    return eigene.map((k) => "- " + k.term + " — " + k.definition).join("\n");
  }, [fach, karten, stapelVon]);

  /* Wie sicher sitzt der Stoff? Danach richtet sich der Hilfsumfang. */
  const hilfsgrad = useMemo(() => {
    if (!fach) return "mittel";
    const eigene = Object.values(zustaende).filter((z) => z.subjectId === fach.id);
    if (eigene.length < 5) return "viel";
    const reif = eigene.filter((z) => !istNeu(z) && (z.stability || 0) >= 21).length;
    const anteil = reif / eigene.length;
    return anteil > 0.6 ? "wenig" : anteil > 0.25 ? "mittel" : "viel";
  }, [fach, zustaende]);

  const senden = async (text, alsZurueck = false) => {
    const inhalt = String(text || "").trim();
    if (!inhalt || laeuft) return;
    const neuerVerlauf = [...verlauf, { wer: "ich", text: inhalt, zeit: Date.now() }];
    setVerlauf(neuerVerlauf);
    setEingabe("");
    setLaeuft(true); setFehler("");
    try {
      const antwort = await ki.tutorZug({
        fach: tutorSchluessel, verlauf: neuerVerlauf, stoff, hilfsgrad,
      });
      const geprueft = pruefeAntwort(antwort, tutorSchluessel);
      setVerlauf((alt) => [...alt, {
        wer: "tutor", text: antwort, zeit: Date.now(),
        drift: geprueft.sauber ? null : geprueft.gruende,
        nachZurueck: alsZurueck,
      }]);
    } catch (e) {
      setFehler(String(e?.message || e));
      setVerlauf((alt) => alt.slice(0, -1));   // die eigene Nachricht zurücknehmen
      setEingabe(inhalt);
    } finally {
      setLaeuft(false);
      setTimeout(() => feld.current?.focus(), 40);
    }
  };

  /* ------------------------------- Auswahl ------------------------------- */

  if (!tutor) {
    return (
      <ModusRahmen titel="Tutor" symbol="buch" aufSchliessen={aufSchliessen}>
        <h1>Fachtutoren</h1>
        <p className="matt" style={{ maxWidth: 620 }}>
          Sechs Tutoren, jeder mit einer Sperre. Keiner von ihnen gibt dir die
          Lösung, auch nicht, wenn du darum bittest. Sie fragen, bis du selbst
          darauf kommst.
        </p>
        {kiDa === false && (
          <div className="rueckmeldung fast" style={{ marginTop: 16 }}>
            <div className="reihe"><Symbol name="zahnrad" />
              <strong>Kein Sprachmodell eingerichtet</strong></div>
            <Knopf art="klein" style={{ marginTop: 8 }}
              onClick={() => gehe("/einstellungen")}>Einrichten</Knopf>
          </div>
        )}
        <div className="gitter" style={{ marginTop: 22 }}>
          {TUTOREN.map((t) => (
            <div key={t.schluessel} className="kachel"
              onClick={() => gehe("/tutor/" + t.schluessel)}>
              <div className="titel">{t.name}</div>
              <div className="klein matt">{t.sperre}</div>
            </div>
          ))}
        </div>
        <p className="klein blass" style={{ marginTop: 22, maxWidth: 620 }}>
          Warum Sperren: Mit unbegrenztem Modellzugang üben Schüler messbar
          besser und schreiben die Prüfung ohne Modell messbar schlechter. Mit
          Leitplanken verschwindet dieser Schaden. Die Sperren sind kein
          Misstrauen gegen dich, sondern gegen die Bequemlichkeit der Maschine.
        </p>
      </ModusRahmen>
    );
  }

  /* ------------------------------- Gespräch ------------------------------ */

  return (
    <ModusRahmen titel={"Tutor — " + tutor.name} symbol="buch" aufSchliessen={aufSchliessen}
      rechts={<>
        <span className="marke">{
          hilfsgrad === "viel" ? "ausführlich" : hilfsgrad === "wenig" ? "knapp" : "mittel"
        }</span>
        {stoff && <span className="klein blass nur-breit">mit deinen Karten</span>}
      </>}>

      <div className="rueckmeldung fast klein" style={{ marginBottom: 18 }}>
        <strong>{tutor.name}:</strong> {tutor.sperre}. Er nennt die Lösung nicht,
        auch nicht auf Bitten.
      </div>

      {kiDa === false ? (
        <Leer symbol="zahnrad" titel="Kein Sprachmodell eingerichtet"
          text="Ohne Modell kann der Tutor nichts sagen. Am einfachsten geht es mit LM Studio auf diesem Rechner.">
          <Knopf art="voll" onClick={() => gehe("/einstellungen")}>Einrichten</Knopf>
        </Leer>
      ) : (
        <>
          {verlauf.length === 0 && (
            <div className="leerer-zustand" style={{ padding: "30px 10px" }}>
              <Symbol name="buch" groesse={30} />
              <p style={{ maxWidth: 480, margin: "12px auto 0" }}>
                Beschreib deine Aufgabe und was du bisher versucht hast. Je
                genauer dein Versuch, desto brauchbarer die Rückfrage.
              </p>
            </div>
          )}

          <div style={{ display: "grid", gap: 14 }}>
            {verlauf.map((z, i) => (
              <div key={i}>
                <div className={"karten-zeile"} style={{
                  display: "block", padding: 14,
                  marginLeft: z.wer === "ich" ? "18%" : 0,
                  marginRight: z.wer === "ich" ? 0 : "18%",
                  background: z.wer === "ich" ? "var(--grund-3)" : "var(--grund-2)",
                  borderColor: z.drift ? "var(--gelb)" : "var(--rand)",
                }}>
                  <div className="klein blass" style={{ marginBottom: 6 }}>
                    {z.wer === "ich" ? "Du" : tutor.name}
                  </div>
                  <div style={{ whiteSpace: "pre-wrap", fontSize: 15.5, lineHeight: 1.6 }}>
                    {z.text}
                  </div>
                </div>

                {z.drift && (
                  <div className="rueckmeldung fast klein"
                    style={{ marginRight: "18%", marginTop: 6 }}>
                    <div className="reihe">
                      <Symbol name="auge" groesse={15} />
                      <span className="dehnen">
                        Der Tutor weicht ab: {driftText(z.drift)}.
                      </span>
                      <Knopf art="klein" onClick={() => senden(ZURUECK_TEXT, true)}
                        disabled={laeuft}>
                        ZURÜCK
                      </Knopf>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {laeuft && (
              <div className="klein matt" style={{ padding: "8px 4px" }}>
                {tutor.name} denkt nach …
              </div>
            )}
            <div ref={unten} />
          </div>

          {fehler && (
            <div className="rueckmeldung schlecht klein" style={{ marginTop: 12 }}>{fehler}</div>
          )}

          <div style={{ position: "sticky", bottom: 0, background: "var(--grund)",
            paddingTop: 14, marginTop: 18 }}>
            <textarea ref={feld} className="feld" rows={3} value={eingabe}
              placeholder="Deine Aufgabe und dein Versuch …"
              style={{ minHeight: 76 }}
              onChange={(e) => setEingabe(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault(); senden(eingabe);
                }
              }} />
            <div className="reihe" style={{ marginTop: 8 }}>
              <span className="klein blass nur-breit">
                <span className="tastenhilfe">Strg</span>
                <span className="tastenhilfe">↵</span> senden
              </span>
              <div className="dehnen" />
              {verlauf.length > 0 && (
                <SymbolKnopf symbol="zurueckSetzen" titel="Gespräch verwerfen"
                  onClick={() => { setVerlauf([]); setFehler(""); }} />
              )}
              <Knopf art="voll" onClick={() => senden(eingabe)}
                disabled={laeuft || !eingabe.trim()}>
                Senden
              </Knopf>
            </div>
          </div>
        </>
      )}
    </ModusRahmen>
  );
}
