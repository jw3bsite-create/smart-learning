/*
 * Einstellungen: Erscheinungsbild, Strenge der Antwortprüfung, Sprachausgabe,
 * Sicherung als Datei und der freiwillige Abgleich mit der Wolke.
 */

import React, { useEffect, useRef, useState } from "react";
import { useDaten } from "../core/store.jsx";
import * as wolke from "../core/cloud.js";
import { stimmen, beiStimmen, sprich } from "../core/speech.js";
import { datumKurz } from "../core/util.js";
import { Symbol, Knopf, SymbolKnopf, Dialog } from "./basis.jsx";

const FARBEN = ["#5b8bff", "#a97bf0", "#3fbf7f", "#e8b84b", "#ef5b6b", "#4bc6d8"];

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

/* ------------------------------ Die Ansicht ---------------------------- */

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

      <Abschnitt titel="Erscheinungsbild">
        <div className="reihe umbruch" style={{ gap: 8, marginBottom: 14 }}>
          {[["system", "Wie das System", "zahnrad"], ["hell", "Hell", "sonne"], ["dunkel", "Dunkel", "mond"]]
            .map(([wert, name, symbol]) => (
              <Knopf key={wert} art={einstellungen.design === wert ? "voll" : ""} symbol={symbol}
                onClick={() => setzeEinstellung("design", wert)}>{name}</Knopf>
            ))}
        </div>
        <label className="beschriftung">Akzentfarbe</label>
        <div className="reihe" style={{ gap: 8, marginBottom: 12 }}>
          {FARBEN.map((f) => (
            <button key={f} onClick={() => setzeEinstellung("akzent", f)}
              title="Farbe wählen"
              style={{ width: 30, height: 30, borderRadius: 9, background: f, cursor: "pointer",
                border: einstellungen.akzent === f ? "2px solid var(--schrift)" : "1px solid var(--rand)" }} />
          ))}
        </div>
        {schalter("schriftGross", "Größere Schrift")}
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

      <Wolkenteil aufAbgleich={aufAbgleich} />

      <Abschnitt titel="Sicherung"
        hinweis={`${stapel.length} Stapel, ${karten.length} Karten` +
          (platz ? ` · rund ${Math.round((platz.usage || 0) / 1048576)} MB belegt` : "")}>
        <div className="reihe umbruch">
          <Knopf symbol="herunter" onClick={sichern}>Sicherung herunterladen</Knopf>
          <input ref={datei} type="file" accept="application/json,.json" style={{ display: "none" }}
            onChange={(e) => dateiGewaehlt(e.target.files[0])} />
          <Knopf symbol="hinauf" onClick={() => datei.current?.click()}>Sicherung einlesen</Knopf>
        </div>
        <p className="klein matt">
          Die Sicherung enthält Ordner, Stapel, Karten, Lernstände und Bilder — alles in
          einer Datei. Gut vor einem Gerätewechsel und als Sicherheitsnetz.
        </p>
        {meldung && <div className="rueckmeldung schlecht klein">{meldung}</div>}
      </Abschnitt>

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
