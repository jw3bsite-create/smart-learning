/*
 * Einstellungen: Erscheinungsbild, Strenge der Antwortprüfung, Sprachausgabe,
 * Sicherung als Datei und der freiwillige Abgleich mit der Wolke.
 */

import React, { useEffect, useRef, useState } from "react";
import { useDaten } from "../core/store.jsx";
import * as wolke from "../core/cloud.js";
import * as ki from "../core/ki.js";
import * as erinnerung from "../core/erinnerung.js";
import { stimmen, beiStimmen, sprich } from "../core/speech.js";
import { verwaisteBilderAufraeumen } from "../core/media.js";
import * as beispiel from "../core/beispiel.js";
import { datumKurz } from "../core/util.js";
import { Symbol, Knopf, SymbolKnopf, Dialog } from "./basis.jsx";
import Gestaltung from "./Gestaltung.jsx";



function Abschnitt({ titel, hinweis, children }) {
  return (
    <section style={{ marginBottom: 34 }}>
      <h2 style={{ marginBottom: hinweis ? 4 : 12 }}>{titel}</h2>
      {hinweis && <p className="klein matt" style={{ marginTop: 0, marginBottom: 12 }}>{hinweis}</p>}
      {children}
    </section>
  );
}

/* ------------------------------ Wolkenteil ----------------------------- */

function Wolkenteil({ aufAbgleich }) {
  const { wolkeStand } = useDaten();
  const [zugang, setZugang] = useState({ url: "", key: "" });
  const [sitz, setSitz] = useState(null);
  const [kennung, setKennung] = useState("");
  const [passwort, setPasswort] = useState("");
  const [neu, setNeu] = useState(false);
  const [fehler, setFehler] = useState("");
  const [hinweis, setHinweis] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [anleitung, setAnleitung] = useState(false);
  const [zuletzt, setZuletzt] = useState(0);

  useEffect(() => {
    (async () => {
      setZugang(await wolke.zugangLesen());
      setSitz(await wolke.sitzung().catch(() => null));
      setZuletzt(await wolke.letzterAbgleich());
    })();
  }, [wolkeStand.zeit]);

  const zugangSichern = async () => {
    await wolke.zugangSchreiben(zugang);
    setHinweis("Zugangsdaten gespeichert.");
    setSitz(await wolke.sitzung().catch(() => null));
  };

  const anmelden = async (e) => {
    e.preventDefault();
    setFehler(""); setHinweis(""); setLaeuft(true);
    try {
      await wolke.zugangSchreiben(zugang);
      if (neu) {
        const s = await wolke.registrieren(kennung.trim(), passwort);
        if (!s) setHinweis("Bestätige die Kennung über den Verweis in deiner Post, dann melde dich an.");
        setSitz(s);
      } else {
        setSitz(await wolke.anmelden(kennung.trim(), passwort));
      }
      setPasswort("");
      if (!neu) aufAbgleich();
    } catch (f) {
      setFehler(f.message);
    } finally { setLaeuft(false); }
  };

  const abmelden = async () => {
    await wolke.abmelden();
    setSitz(null);
  };

  return (
    <Abschnitt titel="Wolke" hinweis="Freiwillig. Ohne Zugangsdaten bleibt alles auf diesem Gerät.">
      {sitz ? (
        <div className="zahl-kachel">
          <div className="reihe">
            <Symbol name="wolke" />
            <div className="dehnen">
              <div>Angemeldet als <strong>{sitz.user?.email}</strong></div>
              <div className="klein matt">
                {wolkeStand.zustand === "arbeitet" ? wolkeStand.text
                  : zuletzt ? "Zuletzt abgeglichen " + datumKurz(zuletzt) + ", " +
                    new Date(zuletzt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })
                    : "Noch nicht abgeglichen"}
              </div>
            </div>
            <Knopf symbol="wolke" onClick={aufAbgleich}>Jetzt abgleichen</Knopf>
            <SymbolKnopf symbol="abmelden" titel="Abmelden" onClick={abmelden} />
          </div>
          {wolkeStand.zustand === "fehler" && (
            <div className="rueckmeldung schlecht klein" style={{ marginTop: 10 }}>
              {wolkeStand.text}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="antwort-gitter">
            <div>
              <label className="beschriftung">Adresse des Projekts (Project URL)</label>
              <input className="feld" placeholder="https://xxxx.supabase.co" value={zugang.url}
                onChange={(e) => setZugang({ ...zugang, url: e.target.value })} />
            </div>
            <div>
              <label className="beschriftung">Öffentlicher Schlüssel (anon key)</label>
              <input className="feld" placeholder="eyJhbGciOi…" value={zugang.key}
                onChange={(e) => setZugang({ ...zugang, key: e.target.value })} />
            </div>
          </div>
          <div className="reihe" style={{ marginTop: 10 }}>
            <Knopf art="klein" onClick={zugangSichern}>Zugangsdaten merken</Knopf>
            <Knopf art="klein leer" onClick={() => setAnleitung(true)}>
              <Symbol name="auge" groesse={15} /> Wie richte ich das ein?
            </Knopf>
          </div>

          {wolke.eingerichtet(zugang) && (
            <form onSubmit={anmelden} style={{ marginTop: 18, maxWidth: 420 }}>
              <label className="beschriftung">Kennung (E-Mail)</label>
              <input className="feld" type="email" autoComplete="username" value={kennung}
                onChange={(e) => setKennung(e.target.value)} />
              <label className="beschriftung" style={{ marginTop: 10 }}>Passwort</label>
              <input className="feld" type="password"
                autoComplete={neu ? "new-password" : "current-password"} value={passwort}
                onChange={(e) => setPasswort(e.target.value)} />
              <div className="reihe" style={{ marginTop: 12 }}>
                <Knopf art="voll" type="submit" disabled={laeuft || !kennung || !passwort}>
                  {neu ? "Kennung anlegen" : "Anmelden"}
                </Knopf>
                <Knopf art="leer klein" type="button" onClick={() => { setNeu(!neu); setFehler(""); }}>
                  {neu ? "Ich habe schon eine Kennung" : "Neue Kennung anlegen"}
                </Knopf>
              </div>
            </form>
          )}
        </>
      )}

      {fehler && <div className="rueckmeldung schlecht klein" style={{ marginTop: 12 }}>{fehler}</div>}
      {hinweis && <div className="rueckmeldung gut klein" style={{ marginTop: 12 }}>{hinweis}</div>}

      {anleitung && (
        <Dialog weit titel="Abgleich einrichten" aufSchliessen={() => setAnleitung(false)}
          fuss={<Knopf art="voll" onClick={() => setAnleitung(false)}>Verstanden</Knopf>}>
          <ol style={{ lineHeight: 1.7, paddingLeft: 20 }}>
            <li>Bei <a href="https://supabase.com" target="_blank" rel="noreferrer">supabase.com</a> ein
              kostenloses Projekt anlegen.</li>
            <li>Im Projekt unter <em>SQL Editor</em> den Inhalt der Datei <code>wolke.sql</code> aus
              diesem Verzeichnis einfügen und ausführen. Das legt die Tabelle, die Rechte und die
              Ablage für Bilder an.</li>
            <li>Unter <em>Project Settings → API</em> die <em>Project URL</em> und den
              <em> anon public</em>-Schlüssel kopieren und oben eintragen.</li>
            <li>Eine Kennung anlegen und anmelden — auf jedem Gerät dieselbe.</li>
          </ol>
          <p className="klein matt">
            Der öffentliche Schlüssel darf im Browser stehen; die Zeilenrechte („row level
            security“) sorgen dafür, dass jede Kennung nur die eigenen Daten sieht. Abgeglichen
            wird beim Start, nach Änderungen und wenn du das Fenster verlässt. Bei Streit
            gewinnt die jüngere Änderung.
          </p>
        </Dialog>
      )}
    </Abschnitt>
  );
}

/* ---------------------------- Sprachmodell ----------------------------- */

function Sprachmodellteil() {
  const [zugang, setZugang] = useState(null);
  const [stand, setStand] = useState(null);
  const [prueft, setPrueft] = useState(false);
  const [verbraucht, setVerbraucht] = useState(0);
  const [protokoll, setProtokoll] = useState([]);

  useEffect(() => {
    (async () => {
      setZugang(await ki.zugangLesen());
      setVerbraucht(await ki.verbrauchHeute());
      setProtokoll(await ki.protokoll(20));
    })();
  }, []);

  if (!zugang) return null;

  const anbieter = ki.ANBIETER[zugang.anbieter] || ki.ANBIETER.lmstudio;

  const aendern = async (aenderung) => {
    const neu = { ...zugang, ...aenderung };
    setZugang(neu);
    await ki.zugangSchreiben(neu);
    setStand(null);
  };

  const pruefen = async () => {
    setPrueft(true);
    setStand(await ki.erreichbar(zugang));
    setPrueft(false);
  };

  return (
    <Abschnitt titel="Sprachmodell"
      hinweis="Freiwillig. Wird nur beim Erzeugen von Karten und später beim Erklären gebraucht — gelernt wird ohne.">
      <label className="schalter">
        <input type="checkbox" checked={Boolean(zugang.angeschaltet)}
          onChange={(e) => aendern({ angeschaltet: e.target.checked })} />
        <span>Sprachmodell benutzen</span>
      </label>

      {zugang.angeschaltet && (
        <>
          <div className="antwort-gitter" style={{ marginTop: 12 }}>
            <div>
              <label className="beschriftung">Woher</label>
              <select className="feld" value={zugang.anbieter}
                onChange={(e) => aendern({
                  anbieter: e.target.value,
                  adresse: ki.ANBIETER[e.target.value].adresse,
                })}>
                {Object.entries(ki.ANBIETER).map(([k, a]) => (
                  <option key={k} value={k}>{a.name}</option>
                ))}
              </select>
              <p className="klein matt" style={{ marginTop: 6 }}>{anbieter.hinweis}</p>
            </div>
            <div>
              <label className="beschriftung">Adresse</label>
              <input className="feld" value={zugang.adresse}
                onChange={(e) => aendern({ adresse: e.target.value })} />
              <label className="beschriftung" style={{ marginTop: 10 }}>
                Modell {stand?.modelle?.length ? "(gefunden)" : "(freiwillig)"}
              </label>
              {stand?.modelle?.length ? (
                <select className="feld" value={zugang.modell}
                  onChange={(e) => aendern({ modell: e.target.value })}>
                  <option value="">— erstes verfügbares —</option>
                  {stand.modelle.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              ) : (
                <input className="feld" value={zugang.modell} placeholder="z. B. llama-3.1-8b"
                  onChange={(e) => aendern({ modell: e.target.value })} />
              )}
            </div>
          </div>

          {anbieter.schluesselNoetig && (
            <>
              <label className="beschriftung" style={{ marginTop: 12 }}>
                Dein Schlüssel — bleibt auf diesem Gerät
              </label>
              <input className="feld" type="password" value={zugang.schluessel}
                autoComplete="off" placeholder="sk-…"
                onChange={(e) => aendern({ schluessel: e.target.value })} />
              <p className="klein matt">
                Der Schlüssel wird lokal abgelegt und nie mit der Wolke abgeglichen.
                Wer Zugriff auf diesen Browser hat, kann ihn auslesen.
              </p>
            </>
          )}

          <div className="reihe umbruch" style={{ marginTop: 14, gap: 10 }}>
            <Knopf art="klein" onClick={pruefen} disabled={prueft}>
              {prueft ? "Prüft …" : "Verbindung prüfen"}
            </Knopf>
            {stand && (
              <span className={"marke " + (stand.gut ? "gruen" : "rot")}>
                <span className={"wolke-punkt " + (stand.gut ? "gut" : "fehler")} />
                {stand.text}
              </span>
            )}
            <div className="dehnen" />
            <label className="reihe klein matt" style={{ gap: 6 }}>
              Höchstens
              <input className="feld" type="number" min="1" max="1000" style={{ width: 80 }}
                value={zugang.tagesbudget}
                onChange={(e) => aendern({ tagesbudget: Number(e.target.value) || 1 })} />
              Aufrufe je Tag
            </label>
          </div>

          <div className="klein blass" style={{ marginTop: 8 }}>
            Heute verbraucht: {verbraucht} von {zugang.tagesbudget}.
          </div>

          {protokoll.length > 0 && (
            <details style={{ marginTop: 12 }}>
              <summary className="klein matt" style={{ cursor: "pointer" }}>
                Protokoll der letzten Aufrufe
              </summary>
              <div className="klein blass" style={{ marginTop: 8, display: "grid", gap: 4 }}>
                {protokoll.map((p) => (
                  <div key={p.id} className="reihe" style={{ gap: 8 }}>
                    <span className="mono">
                      {new Date(p.zeit).toLocaleString("de-DE", {
                        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className={"marke " + (p.gelungen ? "gruen" : "rot")}>{p.prompt}</span>
                    <span>{p.zweck}</span>
                    <div className="dehnen" />
                    <span>{p.zeichenHin} Zeichen hin{p.gelungen
                      ? ", " + p.zeichenZurueck + " zurück" : " — " + p.fehler}</span>
                  </div>
                ))}
              </div>
            </details>
          )}

          <p className="klein matt" style={{ marginTop: 12 }}>
            Die Anweisungen, mit denen das Modell arbeitet, liegen als lesbare
            Dateien im Verzeichnis <code>prompts/</code>. Es gibt kein freies
            Chatfenster: Jeder Aufruf folgt einer dieser Anweisungen.
          </p>
        </>
      )}
    </Abschnitt>
  );
}

/* ----------------------------- Erinnerung ------------------------------ */

function Erinnerungsteil() {
  const [e, setE] = useState(null);
  const [erlaubnis, setErlaubnis] = useState(erinnerung.erlaubnisStand());

  useEffect(() => { erinnerung.einstellungLesen().then(setE); }, []);
  if (!e) return null;

  const aendern = async (aenderung) => {
    const neu = { ...e, ...aenderung };
    setE(neu);
    await erinnerung.einstellungSchreiben(neu);
  };

  const anschalten = async (an) => {
    if (an && erlaubnis !== "granted") {
      const antwort = await erinnerung.erlaubnisHolen();
      setErlaubnis(antwort);
      if (antwort !== "granted") return;
    }
    aendern({ an });
  };

  return (
    <Abschnitt titel="Tageserinnerung"
      hinweis="Eine ruhige Nachricht am Tag mit der Zahl der fälligen Karten. Keine Drohung, keine Flamme.">
      <label className="schalter">
        <input type="checkbox" checked={Boolean(e.an)}
          onChange={(ev) => anschalten(ev.target.checked)} />
        <span>Einmal am Tag erinnern</span>
      </label>

      {e.an && (
        <label className="reihe klein matt" style={{ gap: 8, marginTop: 10 }}>
          Ab
          <input className="feld" type="number" min="0" max="23" style={{ width: 80 }}
            value={e.stunde} onChange={(ev) => aendern({ stunde: Number(ev.target.value) })} />
          Uhr
        </label>
      )}

      {erlaubnis === "denied" && (
        <div className="rueckmeldung schlecht klein" style={{ marginTop: 10 }}>
          Der Browser hat Benachrichtigungen für diese Seite abgelehnt. Das
          lässt sich nur in seinen eigenen Einstellungen zurücknehmen.
        </div>
      )}
      {erlaubnis === "geht nicht" && (
        <div className="klein blass" style={{ marginTop: 10 }}>
          Dieser Browser kennt keine Benachrichtigungen.
        </div>
      )}

      <p className="klein blass" style={{ marginTop: 10 }}>
        Die Nachricht erscheint nur, solange die App irgendwo geöffnet ist —
        ohne eigenen Server geht es nicht anders. Auf dem Handy also beim
        Öffnen, nicht davor.
      </p>
    </Abschnitt>
  );
}

/* ------------------------------ Die Ansicht ---------------------------- */

/**
 * Ein vollständiger Beispielbestand zum Ausprobieren.
 *
 * Der Zweck ist nicht Bequemlichkeit, sondern Prüfbarkeit: Fast alles in
 * dieser App — Strähne, Behaltenskurve, Kalibrierung, Fälligkeitsplan,
 * Verdichtung vor der Prüfung — wird erst sichtbar, wenn Wochen an Historie
 * dahinterliegen. Ohne Beispielbestand kann man diese Ansichten erst in
 * Monaten zu Gesicht bekommen und bis dahin nicht wissen, ob sie stimmen.
 */
function Beispielteil() {
  const { neuLaden } = useDaten();
  const [da, setDa] = useState(null);
  const [laeuft, setLaeuft] = useState("");
  const [meldung, setMeldung] = useState("");

  useEffect(() => { beispiel.beispieldatenVorhanden().then(setDa); }, []);

  const anlegen = async () => {
    setLaeuft("anlegen"); setMeldung("");
    try {
      const z = await beispiel.beispieldatenAnlegen();
      await neuLaden();
      setDa(true);
      setMeldung(`${z.stapel} Stapel mit ${z.karten} Karten, ${z.reviews} `
        + `Antworten aus zwölf Wochen, ${z.entwuerfe} Entwürfe, `
        + `${z.erklaerungen} Erklärungen und ${z.pruefungen} Prüfungen angelegt.`);
    } catch (e) {
      setMeldung("Das ist schiefgegangen: " + String(e?.message || e));
    } finally { setLaeuft(""); }
  };

  const entfernen = async () => {
    const vorab = await beispiel.beispieldatenEntfernen({ trocken: true });
    if (!vorab.anzahl) { setMeldung("Es liegt nichts Beispielhaftes herum."); return; }
    if (!window.confirm(
      `${vorab.anzahl} Beispieldatensätze werden endgültig entfernt. `
      + "Alles, was du selbst angelegt hast, bleibt unangetastet. Fortfahren?"))
      return;
    setLaeuft("entfernen"); setMeldung("");
    try {
      const weg = await beispiel.beispieldatenEntfernen();
      await neuLaden();
      setDa(false);
      setMeldung(`${weg.anzahl} Datensätze entfernt.`);
    } catch (e) {
      setMeldung("Das ist schiefgegangen: " + String(e?.message || e));
    } finally { setLaeuft(""); }
  };

  return (
    <Abschnitt titel="Beispieldaten"
      hinweis="Ein erfundener Bestand mit zwölf Wochen Lernhistorie — damit sich jede Ansicht ansehen lässt, ehe eigener Stoff da ist.">
      <div className="reihe umbruch">
        <Knopf art="voll" symbol="plus" disabled={Boolean(laeuft)} onClick={anlegen}>
          {laeuft === "anlegen" ? "Wird angelegt …" : "Beispieldaten anlegen"}
        </Knopf>
        {da && (
          <Knopf symbol="muell" disabled={Boolean(laeuft)} onClick={entfernen}>
            {laeuft === "entfernen" ? "Wird entfernt …" : "Beispieldaten entfernen"}
          </Knopf>
        )}
      </div>
      <p className="klein matt">
        Drei Fächer (Philosophie, Erdkunde, Mathematik), fünf Stapel mit allen
        vier Kartenarten samt Bildkarten, dazu Entwürfe, zwei Erklärungen und
        zwei Prüfungssimulationen. Die Lernhistorie ist nicht hingeschrieben,
        sondern durchgerechnet: Derselbe Planer, der im Betrieb die Termine
        setzt, ist über eine erfundene Vergangenheit gelaufen. Darum stimmen
        Fortschritt, Behaltenskurve und Warteschlange untereinander überein.
      </p>
      <p className="klein blass">
        Alles Angelegte ist als Beispiel gekennzeichnet und lässt sich mit einem
        Griff wieder entfernen — eigene Karten bleiben dabei unberührt. Vor dem
        ersten Abgleich mit der Wolke solltest du es entfernen, sonst wandert es
        auf deine anderen Geräte.
      </p>
      {meldung && (
        <div className={"rueckmeldung klein "
          + (meldung.startsWith("Das ist schief") ? "schlecht" : "gut")}
        style={{ marginTop: 10 }}>{meldung}</div>
      )}
    </Abschnitt>
  );
}

export default function Einstellungen({ aufAbgleich }) {
  const { einstellungen, setzeEinstellung, alsSicherung, ausSicherung, stapel, karten } = useDaten();
  const [stimmenListe, setStimmenListe] = useState(stimmen());
  const [platz, setPlatz] = useState(null);
  const [einlesen, setEinlesen] = useState(null);
  const [meldung, setMeldung] = useState("");
  const datei = useRef(null);

  useEffect(() => beiStimmen(setStimmenListe), []);

  useEffect(() => {
    navigator.storage?.estimate?.().then((s) => setPlatz(s)).catch(() => {});
  }, []);

  const sichern = async () => {
    const daten = await alsSicherung();
    const text = JSON.stringify(daten);
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "karteikasten-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const dateiGewaehlt = async (f) => {
    if (!f) return;
    try {
      const text = await f.text();
      setEinlesen(JSON.parse(text));
    } catch (e) {
      setMeldung("Diese Datei lässt sich nicht lesen.");
    }
  };

  const schalter = (schluessel, name, hinweis) => (
    <label className="schalter" title={hinweis}>
      <input type="checkbox" checked={Boolean(einstellungen[schluessel])}
        onChange={(e) => setzeEinstellung(schluessel, e.target.checked)} />
      <span>{name}{hinweis && <span className="klein blass"> — {hinweis}</span>}</span>
    </label>
  );

  return (
    <div className="mitte" style={{ maxWidth: 780 }}>
      <div className="kopfzeile"><h1>Einstellungen</h1></div>

      <Abschnitt titel="Erscheinungsbild"
        hinweis="Jede Änderung greift sofort. Die Vorschau daneben zeigt, was du beim Verstellen sonst nicht vor Augen hast.">
        <Gestaltung />
      </Abschnitt>

      <Abschnitt titel="Antwortprüfung"
        hinweis="Gilt für Schreiben, Lernen, Test und Meteor. „Buchstabieren“ prüft immer streng.">
        {schalter("tippfehlerErlauben", "Tippfehler verzeihen", "ein verrutschter Buchstabe zählt als fast richtig")}
        {schalter("ohneArtikel", "Artikel übergehen", "„das Haus“ gilt wie „Haus“")}
        {schalter("zeichenEgal", "Betonungszeichen übergehen", "„café“ gilt wie „cafe“")}
        {schalter("satzzeichenEgal", "Satzzeichen übergehen")}
      </Abschnitt>

      <Abschnitt titel="Lernen">
        <label className="beschriftung">Karten je Runde: {einstellungen.rundenGroesse}</label>
        <input type="range" min="4" max="20" step="1" value={einstellungen.rundenGroesse}
          style={{ width: 260 }}
          onChange={(e) => setzeEinstellung("rundenGroesse", Number(e.target.value))} />
      </Abschnitt>

      <Abschnitt titel="Sprachausgabe"
        hinweis={stimmenListe.length
          ? stimmenListe.length + " Stimmen stehen zur Verfügung."
          : "Dieser Browser meldet keine Stimmen — Vorlesen und Buchstabieren bleiben stumm."}>
        {schalter("vorlesenAutomatisch", "Bei Karteikarten von allein vorlesen")}
        <label className="beschriftung" style={{ marginTop: 10 }}>
          Sprechtempo: {Number(einstellungen.sprechTempo).toFixed(1)}
        </label>
        <div className="reihe">
          <input type="range" min="0.6" max="1.6" step="0.1" value={einstellungen.sprechTempo}
            style={{ width: 220 }}
            onChange={(e) => setzeEinstellung("sprechTempo", Number(e.target.value))} />
          <Knopf art="klein" symbol="laut"
            onClick={() => sprich("Der Karteikasten liest vor.", "de", einstellungen.sprechTempo)}>
            Probe
          </Knopf>
        </div>
      </Abschnitt>

      <Erinnerungsteil />

      <Sprachmodellteil />

      <Wolkenteil aufAbgleich={aufAbgleich} />

      <Abschnitt titel="Sicherung"
        hinweis={`${stapel.length} Stapel, ${karten.length} Karten` +
          (platz ? ` · rund ${Math.round((platz.usage || 0) / 1048576)} MB belegt` : "")}>
        <div className="reihe umbruch">
          <Knopf symbol="herunter" onClick={sichern}>Sicherung herunterladen</Knopf>
          <input ref={datei} type="file" accept="application/json,.json" style={{ display: "none" }}
            onChange={(e) => dateiGewaehlt(e.target.files[0])} />
          <Knopf symbol="hinauf" onClick={() => datei.current?.click()}>Sicherung einlesen</Knopf>
          <Knopf symbol="muell" onClick={async () => {
            const vorab = await verwaisteBilderAufraeumen({ trocken: true });
            if (!vorab.anzahl) { setMeldung("Es liegt nichts Verwaistes herum."); return; }
            const mb = Math.max(0.1, Math.round(vorab.bytes / 104857.6) / 10);
            if (!window.confirm(
              `${vorab.anzahl} Bilder gehören zu keiner Karte mehr (rund ${mb} MB). Löschen?`))
              return;
            const weg = await verwaisteBilderAufraeumen();
            setMeldung(`${weg.anzahl} Bilder weggeräumt.`);
            navigator.storage?.estimate?.().then(setPlatz).catch(() => {});
          }}>Verwaiste Bilder wegräumen</Knopf>
        </div>
        <p className="klein matt">
          Die Sicherung enthält Ordner, Stapel, Karten, Lernstände und Bilder — alles in
          einer Datei. Gut vor einem Gerätewechsel und als Sicherheitsnetz.
        </p>
        {meldung && <div className="rueckmeldung schlecht klein">{meldung}</div>}
      </Abschnitt>

      <Beispielteil />

      <Abschnitt titel="Über">
        <p className="klein matt">
          Karteikasten läuft ganz in deinem Browser. Über den Menüpunkt „Installieren“
          deines Browsers lässt er sich wie eine gewöhnliche App auf den Startbildschirm
          legen und dann auch ohne Netz benutzen.
        </p>
      </Abschnitt>

      {einlesen && (
        <Dialog titel="Sicherung einlesen" aufSchliessen={() => setEinlesen(null)}
          fuss={<>
            <Knopf onClick={() => setEinlesen(null)}>Abbrechen</Knopf>
            <Knopf onClick={async () => {
              await ausSicherung(einlesen, false); setEinlesen(null);
              setMeldung("");
            }}>Dazulegen</Knopf>
            <Knopf art="voll" onClick={async () => {
              await ausSicherung(einlesen, true); setEinlesen(null);
            }}>Alles ersetzen</Knopf>
          </>}>
          <p>
            Die Datei enthält {(einlesen.stapel || []).length} Stapel und
            {" " + (einlesen.karten || []).length} Karten
            {einlesen.erzeugt ? `, gesichert am ${new Date(einlesen.erzeugt).toLocaleDateString("de-DE")}` : ""}.
          </p>
          <p className="klein matt">
            <strong>Dazulegen</strong> behält, was schon da ist, und ergänzt es.
            <strong> Alles ersetzen</strong> wirft den jetzigen Bestand weg.
          </p>
        </Dialog>
      )}
    </div>
  );
}
