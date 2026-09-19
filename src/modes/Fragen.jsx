/*
 * Fragemodus — eine Handvoll Fragen, quer durch, gewichtet.
 *
 * Der Unterschied zum Abrufen steht in `mischen.js` ausführlich; kurz: Dort
 * entscheidet der Plan, was drankommt, und dort entstehen Termine. Hier sagt
 * man „gib mir zwanzig Fragen" und bekommt zwanzig Fragen — und es entstehen
 * keine Termine. Sonst wäre dieser Modus eine Hintertür, durch die man sich
 * seine Wiederholungen selbst zusammenstellt.
 *
 * Was er darf, ist die Auswahl gewichten: Ein Fach mit naher Prüfung, mit
 * schwachen Punkten oder mit hoher Priorität kommt öfter dran. Warum es das
 * tut, steht am Ende der Runde — eine Gewichtung, die man nicht nachvollziehen
 * kann, ist von Willkür nicht zu unterscheiden.
 */

import React, { useCallback, useMemo, useState } from "react";
import { useDaten } from "../core/store.jsx";
import { fehlerListe, von as fehlerVon, schluessel as fehlerSchluessel } from "../core/fehler.js";
import { baueFragen, UMFAENGE, fachGewicht } from "../core/mischen.js";
import { ordnerZweig } from "../core/model.js";
import { seitenFuer, sprachenFuer, ModusRahmen, Seite, Ergebnis } from "./gemeinsam.jsx";
import { fachPunkte } from "../core/noten.js";
import { pruefe } from "../core/text.js";
import { anzahl } from "../core/util.js";
import { Knopf, SymbolKnopf, Symbol, Leer } from "../ui/basis.jsx";
import Formel from "../ui/Formel.jsx";

/** Die Punkte eines Lernfachs — für die Gewichtung und den Hinweis. */
function punkteJeFach(notenfaecher) {
  const nach = new Map();
  for (const n of notenfaecher || []) {
    if (!n || n.deleted || !n.subjectId) continue;
    const p = fachPunkte(n).punkte;
    if (p === null) continue;
    if (!nach.has(n.subjectId)) nach.set(n.subjectId, []);
    nach.get(n.subjectId).push(p);
  }
  const schnitt = {};
  for (const [id, werte] of nach)
    schnitt[id] = werte.reduce((a, b) => a + b, 0) / werte.length;
  return schnitt;
}

export default function Fragen({ bereichArt = "alles", bereichId = null, aufSchliessen }) {
  const {
    karten, zustaende, stapelVon, faecher, ordner, notenfaecher, reviews,
    einstellungen, uebungVerbuchen, sitzungMerken, karteAendern,
  } = useDaten();

  const [umfang, setUmfang] = useState(20);
  const [eigeneZahl, setEigeneZahl] = useState("");
  const [gewichten, setGewichten] = useState(true);
  /*
   * Aus dem Fehlerheft kommt der Bereich als Menge von Schluesseln herein.
   * Er wird hier gebildet und nicht durchgereicht, damit ein Verweis wie
   * /fragen/fehler auch nach dem Neuladen der Seite noch etwas ergibt.
   */
  const fehlerSatz = useMemo(() => (bereichArt === "fehler"
    ? fehlerSchluessel(fehlerListe(reviews, { seit: fehlerVon("monat") })
      .filter((e) => !bereichId || e.subjectId === bereichId))
    : null), [reviews, bereichArt, bereichId]);

  const [bereich, setBereich] = useState(bereichArt === "fehler"
    ? { art: "fehler", id: bereichId, schluessel: fehlerSatz }
    : { art: bereichArt, id: bereichId });
  const [runde, setRunde] = useState(null);

  const [nummer, setNummer] = useState(0);
  const [eingabe, setEingabe] = useState("");
  const [auf, setAuf] = useState(false);
  const [ergebnisse, setErgebnisse] = useState([]);
  const [begonnen, setBegonnen] = useState(0);

  const punkte = useMemo(() => punkteJeFach(notenfaecher), [notenfaecher]);
  const punkteVon = useCallback((id) => (id in punkte ? punkte[id] : null), [punkte]);

  const zweig = useMemo(() => (bereich.art === "ordner" && bereich.id
    ? ordnerZweig(ordner, bereich.id) : null), [ordner, bereich]);

  const losgehen = () => {
    const r = baueFragen({
      karten, zustaende, stapelVon,
      faecherVon: () => faecher,
      punkteVon,
      umfang, bereich, gewichten,
      ordnerZweigIds: zweig,
    });
    setRunde(r);
    setNummer(0); setEingabe(""); setAuf(false); setErgebnisse([]);
    setBegonnen(Date.now());
  };

  /* --------------------------- Die Auswahl ----------------------------- */

  if (!runde) {
    const bereiche = [
      { art: "alles", id: null, name: "Alles" },
      ...(fehlerSatz && fehlerSatz.size
        ? [{ art: "fehler", id: bereichId, name: "Fehlerheft", schluessel: fehlerSatz }]
        : []),
      ...faecher.map((f) => ({ art: "fach", id: f.id, name: f.name })),
    ];
    const vorschau = baueFragen({
      karten, zustaende, stapelVon, faecherVon: () => faecher, punkteVon,
      umfang: 0, bereich, gewichten, ordnerZweigIds: zweig,
    });

    return (
      <ModusRahmen titel="Fragen" symbol="wuerfel" aufSchliessen={aufSchliessen}>
        <h1 style={{ marginBottom: 6 }}>Ein paar Fragen</h1>
        <p className="matt" style={{ marginTop: 0, maxWidth: "62ch" }}>
          Quer durch, ohne Rücksicht auf den Plan, und ohne ihn zu verstellen:
          Was hier geschieht, zählt für die Strähne, verschiebt aber keine
          Termine. Zum Zwischendurchfragen, wenn du fünf Minuten hast.
        </p>

        <label className="beschriftung" style={{ marginTop: 20 }}>Woraus?</label>
        <div className="reihe umbruch">
          {bereiche.map((b) => (
            <Knopf key={b.art + (b.id || "")}
              art={"klein" + (bereich.art === b.art && bereich.id === b.id ? " voll" : "")}
              onClick={() => setBereich({ art: b.art, id: b.id, schluessel: b.schluessel })}>
              {b.name}
            </Knopf>
          ))}
        </div>

        <label className="beschriftung" style={{ marginTop: 18 }}>Wie viele?</label>
        <div className="reihe umbruch">
          {UMFAENGE.map((n) => (
            <Knopf key={n} art={"klein" + (umfang === n && !eigeneZahl ? " voll" : "")}
              onClick={() => { setUmfang(n); setEigeneZahl(""); }}>
              {n}
            </Knopf>
          ))}
          <input className="feld klein" type="number" min="1" max="200"
            style={{ width: 90 }} placeholder="eigene"
            value={eigeneZahl}
            onChange={(e) => {
              setEigeneZahl(e.target.value);
              const n = Number(e.target.value);
              if (n >= 1) setUmfang(Math.min(200, n));
            }} />
        </div>

        <label className="schalter" style={{ marginTop: 18 }}>
          <input type="checkbox" checked={gewichten}
            onChange={(e) => setGewichten(e.target.checked)} />
          <span>
            Gewichten
            <span className="klein blass">
              {" "}(nahe Prüfung, schwache Punkte und vordringliche Fächer öfter)
            </span>
          </span>
        </label>

        {/* Was die Gewichtung gerade bewirkt — sonst ist sie Willkür. */}
        {gewichten && faecher.length > 0 && (
          <div className="zahl-kachel" style={{ marginTop: 16 }}>
            <div className="klein matt" style={{ marginBottom: 8 }}>
              So stehen deine Fächer gerade zueinander:
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              {faecher.map((f) => {
                const g = fachGewicht(f, { punkte: punkteVon(f.id) });
                return (
                  <div key={f.id} className="reihe klein">
                    <span className="dehnen">{f.name}</span>
                    {g.gruende.length > 0 && (
                      <span className="blass">{g.gruende.join(" · ")}</span>
                    )}
                    <span className="mono" style={{ minWidth: 46, textAlign: "right" }}>
                      ×{g.gewicht.toFixed(1)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="reihe" style={{ marginTop: 22 }}>
          <Knopf art="voll gross" symbol="blitz"
            disabled={vorschau.vorrat === 0}
            onClick={losgehen}>
            {vorschau.vorrat === 0 ? "Nichts vorhanden" : "Losgehen"}
          </Knopf>
          <span className="klein blass">
            {anzahl(vorschau.vorrat, "Frage steht bereit", "Fragen stehen bereit")}
            {vorschau.abgehakt > 0 && ` · ${vorschau.abgehakt} abgehakt`}
          </span>
        </div>
      </ModusRahmen>
    );
  }

  /* --------------------------- Der Durchgang --------------------------- */

  if (!runde.aufgaben.length) {
    return (
      <ModusRahmen titel="Fragen" symbol="wuerfel" aufSchliessen={aufSchliessen}>
        <Leer symbol="haken" titel="Nichts zum Fragen"
          text="In diesem Bereich gibt es keine Karten, die nicht abgehakt sind.">
          <Knopf art="voll" onClick={() => setRunde(null)}>Zurück</Knopf>
        </Leer>
      </ModusRahmen>
    );
  }

  const fertig = nummer >= runde.aufgaben.length;

  if (fertig) {
    const richtig = ergebnisse.filter(Boolean).length;
    return (
      <ModusRahmen titel="Fragen" symbol="wuerfel" aufSchliessen={aufSchliessen}>
        <Ergebnis titel="Runde vorbei" richtig={richtig} gesamt={ergebnisse.length}
          setId={runde.aufgaben[0]?.stapel?.id}
          aufNochmal={() => { setRunde(null); setTimeout(losgehen, 0); }}>
          {runde.beteiligt.length > 0 && (
            <div className="zahl-kachel" style={{ marginTop: 18, textAlign: "left" }}>
              <div className="klein matt" style={{ marginBottom: 8 }}>
                Woher die Fragen kamen und warum:
              </div>
              {runde.beteiligt.map((b) => (
                <div key={b.fach.id} className="reihe klein" style={{ marginBottom: 4 }}>
                  <span className="dehnen">{b.fach.name}</span>
                  <span className="blass">{b.gruende.join(" · ") || "gleichmäßig"}</span>
                  <strong>{b.anzahl}</strong>
                </div>
              ))}
            </div>
          )}
          <p className="klein blass" style={{ marginTop: 14 }}>
            Diese Runde hat keine Termine verschoben. Was wann wiederkommt,
            entscheidet weiter das Abrufen.
          </p>
        </Ergebnis>
      </ModusRahmen>
    );
  }

  const jetzt = runde.aufgaben[nummer];
  const seiten = seitenFuer(jetzt.karte, jetzt.richtung);
  const sprachen = sprachenFuer(jetzt.stapel, jetzt.richtung);
  /* `pruefe` meldet `status`, nicht `art`. Hier stand `.art` — damit galt
     jede Antwort als falsch, und das Fehlerheft füllte sich mit Fehlern, die
     keine waren. Ein Tippfehler zählt wie in den übrigen Modi als gewusst. */
  const urteil = auf ? pruefe(eingabe, seiten.antwort, einstellungen).status : null;
  const stimmt = urteil === "richtig" || urteil === "fast";

  const aufdecken = () => {
    if (auf) return;
    setAuf(true);
    const richtig = pruefe(eingabe, seiten.antwort, einstellungen).status !== "falsch";
    setErgebnisse((alt) => [...alt, richtig]);
    uebungVerbuchen({
      karte: jetzt.karte, stapel: jetzt.stapel, richtung: jetzt.richtung,
      gewusst: richtig, antwortzeit: 0, modus: "fragen",
    });
  };

  const weiter = () => {
    if (nummer + 1 >= runde.aufgaben.length) {
      sitzungMerken({
        setId: jetzt.stapel.id, modus: "fragen",
        gesamt: ergebnisse.length,
        richtig: ergebnisse.filter(Boolean).length,
        dauer: Date.now() - begonnen,
      });
    }
    setNummer((n) => n + 1);
    setEingabe(""); setAuf(false);
  };

  return (
    <ModusRahmen titel="Fragen" symbol="wuerfel" aufSchliessen={aufSchliessen}
      anteil={nummer / runde.aufgaben.length}
      rechts={<>
        <span className="klein matt">{nummer + 1} / {runde.aufgaben.length}</span>
        <SymbolKnopf symbol={jetzt.karte.nichtRelevant ? "haken" : "kreuz"}
          titel="Diese Karte abhaken, kommt nicht dran"
          art="leer klein"
          onClick={() => karteAendern(jetzt.karte.id,
            { nichtRelevant: !jetzt.karte.nichtRelevant })} />
      </>}>

      <div className="frage-karte">
        {jetzt.fach && (
          <div className="karte-ecke" style={{ left: 14 }}>
            {jetzt.fach.name} · {jetzt.stapel.title}
          </div>
        )}
        <Seite text={seiten.frage} bild={seiten.frageBild} sprache={sprachen.frage} />
      </div>

      <input className="feld" autoFocus value={eingabe}
        placeholder="Antwort schreiben"
        onChange={(e) => setEingabe(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          if (auf) weiter(); else aufdecken();
        }} />

      {auf && (
        <div className={"rueckmeldung " + (stimmt ? "gut" : "schlecht")}
          style={{ marginTop: 14 }}>
          <div className="reihe">
            <Symbol name={stimmt ? "haken" : "kreuz"} />
            <strong>{urteil === "richtig" ? "Richtig"
              : urteil === "fast" ? "Fast richtig, ein Tippfehler" : "Die Antwort lautet"}</strong>
          </div>
          <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}><Formel text={seiten.antwort} /></div>
          {jetzt.karte.hint && (
            <div className="klein blass" style={{ marginTop: 8 }}>{jetzt.karte.hint}</div>
          )}
        </div>
      )}

      <div className="reihe" style={{ marginTop: 16, justifyContent: "flex-end" }}>
        {auf
          ? <Knopf art="voll" onClick={weiter}>Weiter</Knopf>
          : <Knopf art="voll" onClick={aufdecken}>Aufdecken</Knopf>}
      </div>

      <p className="klein blass" style={{ marginTop: 20 }}>
        Kommt eine Karte im Abitur sicher nicht dran, kannst du sie oben rechts
        abhaken. Sie verschwindet dann aus allen Modi und aus den Zahlen, der
        Lernstand bleibt erhalten, und das Abhaken lässt sich zurücknehmen.
      </p>
    </ModusRahmen>
  );
}
