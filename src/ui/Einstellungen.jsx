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
import {
  dateiname, inhaltsangabe, angabeText, groesseText, pruefeSicherung,
  letzteText, sicherungFaellig, ERINNERUNG_TAGE,
} from "../core/sicherung.js";
import { alsCsvMitPlan } from "../core/importer.js";
import { herunterladen } from "../core/datei.js";
import { sicherungen as kopienLesen, kopieAlsSicherung } from "../core/db.js";
import * as beispiel from "../core/beispiel.js";
import { datumKurz } from "../core/util.js";
import { Symbol, Knopf, SymbolKnopf, Dialog } from "./basis.jsx";
import Gestaltung from "./Gestaltung.jsx";
import Kalenderausfuhr from "./Kalenderausfuhr.jsx";



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
  // Passwort: "aendern" (angemeldet, bisheriges bekannt), "setzen" (nach dem
  // Verweis aus der Mail) oder null.
  const [pwArt, setPwArt] = useState(null);
  const [pwBisher, setPwBisher] = useState("");
  const [pwNeu, setPwNeu] = useState("");
  const [pwWieder, setPwWieder] = useState("");
  const [andereAbmelden, setAndereAbmelden] = useState(false);
  const [pwFehler, setPwFehler] = useState("");
  const [pwLaeuft, setPwLaeuft] = useState(false);
  const [link, setLink] = useState("");
  const [kopiert, setKopiert] = useState(false);

  useEffect(() => {
    (async () => {
      setZugang(await wolke.zugangLesen());
      setSitz(await wolke.sitzung().catch(() => null));
      setZuletzt(await wolke.letzterAbgleich());
    })();
  }, [wolkeStand.zeit]);

  /* Von einem anderen Gerät eingerichtet (siehe zugangAlsLink). */
  useEffect(() => {
    if (wolke.zugangUebernahmeAbholen())
      setHinweis("Adresse und Schlüssel sind übernommen. Melde dich jetzt mit deiner "
        + "Kennung an, dann gleicht sich dieses Gerät mit den anderen ab.");
  }, []);

  /* Rueckkehr aus einer Mail von Supabase. Abgeholt wird beim Oeffnen der
     Einstellungen und, falls sie schon offen sind, auf das Ereignis hin. */
  useEffect(() => {
    const abholen = async () => {
      const r = wolke.rueckkehrAbholen();
      if (!r) return;
      setSitz(await wolke.sitzung().catch(() => null));
      if (r.art === "recovery") {
        setHinweis("Du bist über den Verweis angemeldet. Leg jetzt ein neues Passwort fest.");
        oeffnePasswort("setzen");
      } else if (r.art === "fehler") {
        setFehler(wolke.uebersetze(r.code + " " + r.text));
      } else if (r.art === "ohneZugang") {
        setFehler("Der Verweis funktioniert nur auf einem Gerät, auf dem Adresse und "
          + "Schlüssel schon eingetragen sind. Trag beides hier ein und fordere dann "
          + "einen neuen Verweis an.");
      } else {
        setHinweis("Deine Kennung ist bestätigt, du bist angemeldet.");
      }
    };
    abholen();
    window.addEventListener(wolke.RUECKKEHR_EREIGNIS, abholen);
    return () => window.removeEventListener(wolke.RUECKKEHR_EREIGNIS, abholen);
  }, []);

  /*
   * Beim Speichern prüfen, nicht erst beim Verbinden. Sonst kommt der Fehler
   * erst als Meldung des Browsers zurück, und die lautet „String contains non
   * ISO-8859-1 code point" — sie nennt weder das Feld noch die Stelle.
   */
  const zugangSichern = async () => {
    setFehler(""); setHinweis("");
    const beanstandung = wolke.adressFehler(zugang.url) || wolke.schluesselFehler(zugang.key);
    if (beanstandung) { setFehler(beanstandung); return; }
    await wolke.zugangSchreiben(zugang);
    setZugang(await wolke.zugangLesen());   // zeigt die geradegezogene Adresse
    /* Gespeichert wird in jedem Fall — aber gleich nachgesehen, ob das Projekt
       antwortet. Sonst erfährt man es erst beim Anmelden, und dann in der
       Sprache des Browsers. */
    setHinweis("Zugangsdaten gespeichert, sehe nach, ob das Projekt antwortet …");
    const probe = await wolke.verbindungPruefen(zugang);
    if (probe.ok) setHinweis("Zugangsdaten gespeichert. Das Projekt antwortet.");
    else { setHinweis("Zugangsdaten gespeichert."); setFehler(probe.text); }
    setSitz(await wolke.sitzung().catch(() => null));
  };

  const anmelden = async (e) => {
    e.preventDefault();
    setFehler(""); setHinweis("");
    const beanstandung = wolke.adressFehler(zugang.url) || wolke.schluesselFehler(zugang.key);
    if (beanstandung) { setFehler(beanstandung); return; }
    setLaeuft(true);
    try {
      await wolke.zugangSchreiben(zugang);
      if (neu) {
        const s = await wolke.registrieren(kennung.trim(), passwort);
        if (!s) setHinweis("Das Konto ist angelegt. Supabase will die Kennung noch "
          + "bestätigt haben und schickt dafür eine Mail, in der kostenlosen "
          + "Fassung kommt die oft nicht an. Einfacher: im eigenen Projekt unter "
          + "Authentication → Sign In / Providers → Email die Option Confirm "
          + "email abschalten und hier auf Anmelden wechseln.");
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

  /*
   * Von vorn anfangen: Beide Marken zurücksetzen und sofort abgleichen.
   *
   * Die Marken sind der Grund, warum ein Gerät stillschweigend nichts mehr
   * holt — steht die Marke über der Änderungszeit dessen, was ein anderes
   * Gerät später hochlädt, bleibt es für immer draußen.
   */
  const neuBeginnen = async () => {
    setFehler(""); setHinweis("");
    setLaeuft(true);
    try {
      await wolke.abgleichZuruecksetzen();
      setHinweis("Der Abgleich beginnt von vorn. Das kann einen Moment dauern.");
      await aufAbgleich();
      setZuletzt(await wolke.letzterAbgleich());
    } catch (f) {
      setFehler(f.message);
    } finally { setLaeuft(false); }
  };

  const abmelden = async (ueberall = false) => {
    setFehler(""); setHinweis("");
    if (ueberall && !window.confirm(
      "Auf allen Geräten abmelden? Handy, Tablet und Rechner müssen sich danach "
      + "neu anmelden. Deine Karten bleiben auf jedem Gerät erhalten.")) return;
    try {
      await wolke.abmelden({ ueberall });
      setSitz(null);
      if (ueberall)
        setHinweis("Abgemeldet. Andere Geräte verlieren die Anmeldung spätestens "
          + "nach einer Stunde.");
    } catch (f) { setFehler(f.message); }
  };

  function oeffnePasswort(art) {
    setPwArt(art); setPwBisher(""); setPwNeu(""); setPwWieder("");
    setAndereAbmelden(false); setPwFehler("");
  }

  const passwortSpeichern = async () => {
    setPwFehler("");
    const beanstandung = wolke.passwortPruefen(pwNeu, pwWieder);
    if (beanstandung) { setPwFehler(beanstandung); return; }
    if (pwArt === "aendern" && !pwBisher) { setPwFehler("Es fehlt das bisherige Passwort."); return; }
    setPwLaeuft(true);
    try {
      if (pwArt === "aendern")
        await wolke.passwortAendern({
          kennung: sitz?.user?.email, bisher: pwBisher, neu: pwNeu, andereAbmelden,
        });
      else
        await wolke.passwortSetzen(pwNeu, { andereAbmelden });
      setPwArt(null);
      setSitz(await wolke.sitzung().catch(() => null));
      setFehler("");
      setHinweis(andereAbmelden
        ? "Passwort geändert. Deine anderen Geräte werden abgemeldet; "
          + "spätestens nach einer Stunde müssen sie sich neu anmelden."
        : "Passwort geändert. Deine anderen Geräte bleiben angemeldet.");
    } catch (f) {
      setPwFehler(f.message);
    } finally { setPwLaeuft(false); }
  };

  const passwortVergessen = async () => {
    setFehler(""); setHinweis("");
    const beanstandung = wolke.adressFehler(zugang.url) || wolke.schluesselFehler(zugang.key);
    if (beanstandung) { setFehler(beanstandung); return; }
    setLaeuft(true);
    try {
      await wolke.zugangSchreiben(zugang);
      await wolke.passwortVergessen(kennung);
      setHinweis("Wenn es diese Kennung gibt, ist ein Verweis unterwegs. Öffne ihn auf "
        + "einem Gerät, auf dem Adresse und Schlüssel eingetragen sind, dann "
        + "kannst du ein neues Passwort festlegen. Supabase verschickt in der kostenlosen "
        + "Fassung nur wenige Mails je Stunde; sieh auch im Spam nach.");
    } catch (f) {
      setFehler(f.message);
    } finally { setLaeuft(false); }
  };

  return (
    <Abschnitt titel="Cloud" hinweis="Freiwillig. Ohne Zugangsdaten bleibt alles auf diesem Gerät.">
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
            <SymbolKnopf symbol="abmelden" titel="Auf diesem Gerät abmelden"
              onClick={() => abmelden(false)} />
          </div>
          <div className="reihe umbruch" style={{ marginTop: 10 }}>
            <Knopf art="klein" onClick={() => oeffnePasswort("aendern")}>Passwort ändern</Knopf>
            {/* Für den Fall, dass ein Gerät nichts mehr holt: Die Marken sagen,
                bis wohin schon abgeglichen wurde. Zurückgesetzt wird alles
                einmal frisch geholt und geschickt. */}
            <Knopf art="klein" disabled={laeuft} onClick={neuBeginnen}>Abgleich neu beginnen</Knopf>
            <Knopf art="klein" onClick={() => { setLink(wolke.zugangAlsLink(zugang)); setKopiert(false); }}>
              Auf anderes Gerät übertragen
            </Knopf>
            <Knopf art="klein leer" onClick={() => abmelden(true)}>Auf allen Geräten abmelden</Knopf>
          </div>
          <p className="klein blass" style={{ margin: "8px 0 0" }}>
            „Abgleich neu beginnen“ holt und schickt alles noch einmal. Nichts geht dabei
            verloren; bei viel Bestand dauert es ein paar Minuten. Sinnvoll, wenn ein Gerät
            Änderungen eines anderen nicht bekommt.
          </p>
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
              {/* Supabase zeigt die REST-Adresse groß an. Wer sie einträgt,
                  bekommt nur „kein Anschluss" und sucht den Fehler beim
                  Schlüssel. Die App schneidet das ab — hier steht, dass sie
                  es tut. */}
              <div className="klein blass" style={{ marginTop: 4 }}>
                Der Anhang <span className="mono">/rest/v1/</span> darf dranbleiben,
                er wird beim Speichern abgeschnitten.
              </div>
            </div>
            <div>
              <label className="beschriftung">Öffentlicher Schlüssel</label>
              <input className="feld" placeholder="sb_publishable_… oder eyJ…" value={zugang.key}
                onChange={(e) => setZugang({ ...zugang, key: e.target.value })} />
              <div className="klein blass" style={{ marginTop: 4 }}>
                Der <span className="mono">publishable</span> beziehungsweise
                <span className="mono"> anon</span> key. Niemals der
                <span className="mono"> service_role</span> key, der umgeht jeden Schutz.
              </div>
            </div>
          </div>
          <div className="reihe umbruch" style={{ marginTop: 10 }}>
            <Knopf art="klein" onClick={zugangSichern}>Zugangsdaten merken</Knopf>
            {wolke.eingerichtet(zugang) && (
              <Knopf art="klein" onClick={() => { setLink(wolke.zugangAlsLink(zugang)); setKopiert(false); }}>
                Auf anderes Gerät übertragen
              </Knopf>
            )}
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
                {!neu && (
                  <Knopf art="leer klein" type="button" disabled={laeuft} onClick={passwortVergessen}>
                    Passwort vergessen?
                  </Knopf>
                )}
              </div>
            </form>
          )}
        </>
      )}

      {link && (
        <div className="zahl-kachel" style={{ marginTop: 12 }}>
          <div className="reihe umbruch" style={{ gap: 8 }}>
            <strong className="dehnen">Einrichtung für iPad und Handy</strong>
            <Knopf art="klein leer" onClick={() => setLink("")}>Schließen</Knopf>
          </div>
          <p className="klein matt" style={{ marginTop: 6 }}>
            Öffne diesen Link auf dem anderen Gerät. Adresse und Schlüssel stehen dann dort,
            und du musst dich nur noch anmelden. Dein Passwort steht nicht darin.
          </p>
          <input className="feld mono klein" readOnly value={link}
            onFocus={(e) => e.target.select()} />
          <div className="reihe" style={{ marginTop: 8 }}>
            <Knopf art="klein voll" onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setKopiert(true);
              } catch (e) {
                setKopiert(false);
              }
            }}>
              {kopiert ? "Kopiert" : "Link kopieren"}
            </Knopf>
            <span className="klein blass">
              Schick ihn dir selbst, etwa über WhatsApp oder deine Notizen.
            </span>
          </div>
        </div>
      )}

      {fehler && <div className="rueckmeldung schlecht klein" style={{ marginTop: 12 }}>{fehler}</div>}
      {hinweis && <div className="rueckmeldung gut klein" style={{ marginTop: 12 }}>{hinweis}</div>}

      {pwArt && (
        <Dialog titel={pwArt === "aendern" ? "Passwort ändern" : "Neues Passwort festlegen"}
          aufSchliessen={() => setPwArt(null)}
          fuss={<>
            <Knopf onClick={() => setPwArt(null)}>Abbrechen</Knopf>
            <Knopf art="voll" disabled={pwLaeuft} onClick={passwortSpeichern}>
              {pwLaeuft ? "Wird gespeichert …" : "Speichern"}
            </Knopf>
          </>}>
          {/* Ein verborgenes Feld mit der Kennung, damit Passwortmanager wissen,
              zu welchem Konto das neue Passwort gehoert. */}
          <input type="email" autoComplete="username" value={sitz?.user?.email || kennung}
            readOnly hidden />
          {pwArt === "aendern" && (
            <>
              <label className="beschriftung">Bisheriges Passwort</label>
              <input className="feld" type="password" autoComplete="current-password"
                value={pwBisher} onChange={(e) => setPwBisher(e.target.value)} />
            </>
          )}
          <label className="beschriftung" style={{ marginTop: 10 }}>Neues Passwort</label>
          <input className="feld" type="password" autoComplete="new-password"
            value={pwNeu} onChange={(e) => setPwNeu(e.target.value)} />
          <label className="beschriftung" style={{ marginTop: 10 }}>Neues Passwort wiederholen</label>
          <input className="feld" type="password" autoComplete="new-password"
            value={pwWieder} onChange={(e) => setPwWieder(e.target.value)} />

          <label className="schalter" style={{ marginTop: 16 }}>
            <input type="checkbox" checked={andereAbmelden}
              onChange={(e) => setAndereAbmelden(e.target.checked)} />
            <span>Auf meinen anderen Geräten abmelden</span>
          </label>
          <p className="klein matt" style={{ marginTop: 4 }}>
            Ohne Haken bleiben Handy, Tablet und Rechner angemeldet. Supabase meldet
            beim Passwortwechsel von sich aus niemanden ab. Mit Haken müssen sie sich neu
            anmelden, spätestens nach einer Stunde, wenn ihre Anmeldung erneuert würde.
            Setz den Haken, wenn du das Passwort änderst, weil jemand es kennen könnte.
          </p>
          {pwFehler && <div className="rueckmeldung schlecht klein" style={{ marginTop: 10 }}>{pwFehler}</div>}
        </Dialog>
      )}

      {anleitung && (
        <Dialog weit titel="Abgleich einrichten" aufSchliessen={() => setAnleitung(false)}
          fuss={<Knopf art="voll" onClick={() => setAnleitung(false)}>Verstanden</Knopf>}>
          <ol style={{ lineHeight: 1.7, paddingLeft: 20 }}>
            <li>Bei <a href="https://supabase.com" target="_blank" rel="noreferrer">supabase.com</a> ein
              kostenloses Projekt anlegen.</li>
            <li>Im Projekt unter <em>SQL Editor</em> den Inhalt der Datei <code>wolke.sql</code> aus
              diesem Verzeichnis einfügen und ausführen. Das legt die Tabelle, die Rechte und die
              Ablage für Bilder und Aufnahmen an. Kommt später eine neue Fassung der Datei, führst
              du sie einfach noch einmal aus; deine Daten bleiben.</li>
            <li>Unter <em>Project Settings → API</em> die <em>Project URL</em> und den
              <em> anon public</em>-Schlüssel kopieren und oben eintragen.</li>
            <li>Unter <em>Authentication → URL Configuration</em> die Adresse dieser App als
              <em> Site URL</em> eintragen und zusätzlich unter <em>Redirect URLs</em>. Sonst
              führen die Verweise zum Bestätigen und zum Zurücksetzen des Passworts ins
              Leere.</li>
            <li>Eine Kennung anlegen und anmelden, auf jedem Gerät dieselbe. Adresse und
              Schlüssel musst du dafür nur einmal eintragen: Danach erzeugt der Knopf
              <em> Auf anderes Gerät übertragen</em> einen Link, den du auf iPad und Handy
              öffnest.</li>
            <li>Danach unter <em>Authentication → Sign In / Providers</em> die Option
              <em> Allow new users to sign up</em> abschalten. Sonst kann sich jeder, der Adresse
              und Schlüssel kennt, ein eigenes Konto in deinem Projekt anlegen. Deine Daten sähe
              er nicht, aber er könnte dein kostenloses Kontingent füllen.</li>
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
      hinweis="Freiwillig. Wird nur beim Erzeugen von Karten und später beim Erklären gebraucht, gelernt wird ohne.">
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
                  <option value="">(erstes verfügbares)</option>
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
                Dein Schlüssel, bleibt auf diesem Gerät
              </label>
              <input className="feld" type="password" value={zugang.schluessel}
                autoComplete="off" placeholder="sk-…"
                onChange={(e) => aendern({ schluessel: e.target.value })} />
              <p className="klein matt">
                Der Schlüssel wird lokal abgelegt und nie mit der Cloud abgeglichen.
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
                      ? ", " + p.zeichenZurueck + " zurück" : ", " + p.fehler}</span>
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
  const [kalender, setKalender] = useState(false);
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

      {/*
        * Der ehrliche Teil: Ohne geoeffnete App kann diese Nachricht nicht
        * kommen, denn es gibt keinen Server, der sie verschickt. Der Kalender
        * des Geraets kann es, und darum steht der Weg hier daneben.
        */}
      <div className="reihe umbruch" style={{ gap: 10, marginTop: 14 }}>
        <Knopf art="klein" symbol="papier" onClick={() => setKalender(true)}>
          Erinnerung in den Kalender legen
        </Knopf>
        <span className="klein blass">
          weckt auch, wenn Deep Dive geschlossen ist
        </span>
      </div>
      {kalender && <Kalenderausfuhr aufSchliessen={() => setKalender(false)} />}

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
        Die Nachricht erscheint nur, solange die App irgendwo geöffnet ist,
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
      hinweis="Ein erfundener Bestand mit zwölf Wochen Lernhistorie, damit sich jede Ansicht ansehen lässt, ehe eigener Stoff da ist.">
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
        Griff wieder entfernen, eigene Karten bleiben dabei unberührt. Vor dem
        ersten Abgleich mit der Cloud solltest du es entfernen, sonst wandert es
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

/* ---------------------------- Sicherungsteil ---------------------------- */

/** Wofür eine automatische Kopie angelegt wurde, in Worten. */
function kopieGrund(grund) {
  const g = String(grund || "");
  if (g === "umbau") return "vor einem Umbau";
  if (g === "vor-ersetzen") return "vor dem Ersetzen";
  if (g === "vor-dazulegen") return "vor dem Dazulegen";
  if (g.startsWith("vor-umstellung")) return "vor einer Umstellung";
  return "Kopie";
}

/*
 * Die Sicherung als Datei, gleich unter der Cloud.
 *
 * Sie steht dort, weil beide dasselbe Bedürfnis betreffen und weil die Cloud
 * allein nicht genügt: Sie gleicht ab, und das heisst, sie gleicht auch das
 * Löschen ab. Wer versehentlich einen Stapel wegwirft und das Gerät wechselt,
 * findet ihn nirgends wieder. Eine Datei in der Hand ist der einzige Stand,
 * den nichts nachträglich verändert.
 */
function Sicherungsteil() {
  const {
    einstellungen, setzeEinstellung, alsSicherung, ausSicherung,
    stapel, karten, zustaende, stapelVon, fachVon, dauerhaft,
  } = useDaten();
  const [platz, setPlatz] = useState(null);
  const [kopien, setKopien] = useState([]);
  const [einlesen, setEinlesen] = useState(null);
  const [pruefung, setPruefung] = useState(null);
  const [meldung, setMeldung] = useState("");
  const [fehler, setFehler] = useState("");
  const [laeuft, setLaeuft] = useState("");
  const datei = useRef(null);

  useEffect(() => {
    navigator.storage?.estimate?.().then(setPlatz).catch(() => {});
    kopienLesen().then(setKopien).catch(() => {});
  }, []);

  const sichern = async (mitMedien) => {
    setFehler(""); setMeldung("");
    setLaeuft(mitMedien ? "voll" : "daten");
    try {
      const daten = await alsSicherung({ mitMedien });
      const text = JSON.stringify(daten);
      /* Erst lesen, dann behaupten: Eine Datei, die sich nicht wieder
         einlesen laesst, waere schlimmer als keine — man verliesse sich
         darauf. */
      const geprueft = pruefeSicherung(JSON.parse(text));
      if (!geprueft.gut) {
        setFehler("Die Sicherung wirkt unvollständig: " + geprueft.probleme.join(" "));
        return;
      }
      const bytes = herunterladen(dateiname(mitMedien ? "voll" : "daten"), text, "application/json");
      setzeEinstellung("letzteSicherung", Date.now());
      /* Die Zahlen liegen ueber denen der Uebersicht, weil auch der
         Papierkorb mitgesichert wird. Ungesagt wirkt das wie ein Fehler. */
      setMeldung("Gesichert: " + angabeText(geprueft.angabe)
        + " · " + groesseText(bytes) + " · einschließlich Papierkorb"
        + (mitMedien ? "" : " · ohne Bilder und Aufnahmen"));
    } catch (e) {
      setFehler("Die Sicherung ist gescheitert: " + (e?.message || e));
    } finally { setLaeuft(""); }
  };

  const alsTabelle = () => {
    setFehler(""); setMeldung("");
    const text = alsCsvMitPlan(karten.filter((k) => !k.deleted), zustaende,
      { stapelVon, fachVon });
    const bytes = herunterladen(dateiname("karten"), "\ufeff" + text, "text/csv");
    setMeldung("Tabelle geschrieben: " + karten.length + " Karten · " + groesseText(bytes)
      + ". Diese Datei öffnet jedes Tabellenprogramm, sie dient zum Nachlesen, "
      + "nicht zum Wiederherstellen.");
  };

  const dateiGewaehlt = async (f) => {
    if (!f) return;
    setFehler(""); setMeldung("");
    try {
      const daten = JSON.parse(await f.text());
      setPruefung(pruefeSicherung(daten));
      setEinlesen(daten);
    } catch (e) {
      setFehler("Diese Datei lässt sich nicht lesen. Ist es eine Sicherung dieser App?");
    }
  };

  /* Vor dem Ersetzen der jetzige Stand als Datei — ohne Rueckfrage, denn wer
     hier irrt, hat sonst nichts mehr, worauf er zurueckgreifen koennte.
     Zusaetzlich legt der Speicher selbst eine Kopie im Browser ab. */
  const einlesenMit = async (ersetzen) => {
    setFehler(""); setMeldung(""); setLaeuft("einlesen");
    try {
      if (ersetzen) {
        try {
          const vorher = await alsSicherung({ mitMedien: true });
          herunterladen(dateiname("vorher"), JSON.stringify(vorher), "application/json");
        } catch (e) { /* die Kopie im Browser entsteht trotzdem */ }
      }
      const b = await ausSicherung(einlesen, ersetzen);
      setEinlesen(null); setPruefung(null);
      setMeldung(ersetzen
        ? "Ersetzt. Was vorher da war, liegt im Papierkorb und als Datei mit dem Zusatz "
          + "vor-dem-einlesen in deinen Downloads."
        : "Dazugelegt: " + b.geschrieben + " Einträge neu oder neuer als hier"
          + (b.aelter ? ", " + b.aelter + " waren hier schon aktueller und sind geblieben" : "")
          + (b.medien ? ", " + b.medien + " Bilder und Aufnahmen" : "") + ".");
      if (b.ungueltig) setFehler(b.ungueltig + " Einträge in der Datei waren unbrauchbar und wurden übergangen.");
      kopienLesen().then(setKopien).catch(() => {});
    } catch (e) {
      setFehler("Das Einlesen ist gescheitert, dein Bestand ist unverändert: " + (e?.message || e));
    } finally { setLaeuft(""); }
  };
  const ersetzen = () => einlesenMit(true);

  /* Aus einer automatischen Kopie im Browser zurueckholen. */
  const ausKopie = async (k) => {
    if (!window.confirm("Den Stand vom " + new Date(k.zeit).toLocaleString("de-DE")
      + " zurückholen? Der jetzige Stand wandert in den Papierkorb, Bilder und Aufnahmen bleiben.")) return;
    setFehler(""); setMeldung("");
    try {
      const datei = await kopieAlsSicherung(k.id);
      if (!datei) { setFehler("Diese Kopie ist nicht mehr da."); return; }
      await ausSicherung(datei, true);
      setMeldung("Zurückgeholt: der Stand vom " + new Date(k.zeit).toLocaleString("de-DE") + ".");
      kopienLesen().then(setKopien).catch(() => {});
    } catch (e) {
      setFehler("Das Zurückholen ist gescheitert, dein Bestand ist unverändert: " + (e?.message || e));
    }
  };

  const faellig = sicherungFaellig(einstellungen.letzteSicherung);
  const belegt = platz ? groesseText(platz.usage || 0) : null;

  return (
    <Abschnitt titel="Sicherung als Datei"
      hinweis="Für den schlimmsten Fall: eine Datei mit allem, die du selbst aufbewahrst.">
      <div className={"zahl-kachel" + (faellig ? "" : "")} style={{ marginBottom: 14 }}>
        <div className="reihe umbruch">
          <div className="dehnen">
            <div className="klein matt">Letzte Sicherung</div>
            <strong style={{ color: faellig ? "var(--gelb)" : undefined }}>
              {letzteText(einstellungen.letzteSicherung)}
            </strong>
            <div className="klein blass">
              {stapel.filter((s) => !s.deleted).length} Stapel,
              {" " + karten.filter((k) => !k.deleted).length} Karten
              {belegt ? " · " + belegt + " im Browser belegt" : ""}
            </div>
            {dauerhaft === true && (
              <div className="klein blass">Der Browser hält den Speicher dauerhaft.</div>
            )}
            {dauerhaft === false && (
              <div className="klein" style={{ color: "var(--gelb)" }}>
                Der Browser darf den Speicher räumen, wenn der Platz knapp wird. Installiere
                Deep Dive als App (im Browsermenü „Installieren“ oder „Zum
                Home-Bildschirm“), dann nicht mehr, und sichere regelmäßig als Datei.
              </div>
            )}
          </div>
          <Knopf art="voll" symbol="herunter" disabled={laeuft === "voll"}
            onClick={() => sichern(true)}>
            {laeuft === "voll" ? "Wird geschrieben …" : "Alles sichern"}
          </Knopf>
        </div>
        {faellig && (
          <p className="klein matt" style={{ margin: "10px 0 0" }}>
            {einstellungen.letzteSicherung
              ? "Länger als " + ERINNERUNG_TAGE + " Tage her. Ein guter Zeitpunkt."
              : "Noch nie gesichert. Lade die Datei einmal herunter und lege sie irgendwohin, wo sie bleibt."}
          </p>
        )}
      </div>

      <div className="reihe umbruch">
        <Knopf symbol="herunter" disabled={laeuft === "daten"} onClick={() => sichern(false)}>
          Nur Daten (klein)
        </Knopf>
        <Knopf symbol="herunter" onClick={alsTabelle}>Karten als Tabelle</Knopf>
        <input ref={datei} type="file" accept="application/json,.json"
          style={{ display: "none" }}
          onChange={(e) => dateiGewaehlt(e.target.files[0])} />
        <Knopf symbol="hinauf" onClick={() => datei.current?.click()}>Sicherung einlesen</Knopf>
        <Knopf symbol="muell" onClick={async () => {
          const vorab = await verwaisteBilderAufraeumen({ trocken: true });
          if (!vorab.anzahl) { setMeldung("Es liegt nichts Verwaistes herum."); return; }
          if (!window.confirm(vorab.anzahl + " Dateien gehören zu keiner Karte mehr (rund "
            + groesseText(vorab.bytes) + "). Löschen?")) return;
          const weg = await verwaisteBilderAufraeumen();
          setMeldung(weg.anzahl + " Dateien weggeräumt.");
          navigator.storage?.estimate?.().then(setPlatz).catch(() => {});
        }}>Verwaistes wegräumen</Knopf>
      </div>

      <p className="klein matt">
        <strong>Alles sichern</strong> schreibt eine Datei mit Ordnern, Stapeln, Karten,
        Lernständen, Fächern, Punkten, Lernzeiten, Bildern und deinen Tonaufnahmen.
        <strong> Nur Daten</strong> lässt Bilder und Aufnahmen weg und ist darum viel
        kleiner. <strong>Karten als Tabelle</strong> ist zum Nachlesen in Excel gedacht,
        nicht zum Wiederherstellen.
      </p>
      <p className="klein blass">
        Leg die Datei an einen zweiten Ort, etwa OneDrive oder einen Stick. Eine
        Sicherung, die neben den Daten liegt, hilft gegen einen verlorenen Rechner nicht.
      </p>

      {kopien.length > 0 && (
        <details style={{ marginTop: 6 }}>
          <summary className="klein matt" style={{ cursor: "pointer" }}>
            Automatische Kopien im Browser ({kopien.length})
          </summary>
          <p className="klein blass" style={{ margin: "8px 0" }}>
            Vor jeder Umstellung der Daten und vor jedem Einlesen legt die App selbst
            eine Kopie ab, ohne Bilder und Aufnahmen. Sie liegt im selben Browser, ersetzt
            also keine Datei, hilft aber, wenn eine Umstellung schiefgeht.
          </p>
          <div style={{ display: "grid", gap: 6 }}>
            {kopien.map((k) => (
              <div key={k.id} className="reihe klein" style={{ gap: 8 }}>
                <span className="dehnen">
                  {new Date(k.zeit).toLocaleString("de-DE", { day: "2-digit", month: "2-digit",
                    year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  {" · " + (k.umfang?.cards ?? 0) + " Karten · " + kopieGrund(k.grund)}
                </span>
                <Knopf art="klein" onClick={() => ausKopie(k)}>Zurückholen</Knopf>
              </div>
            ))}
          </div>
        </details>
      )}

      {meldung && <div className="rueckmeldung gut klein" style={{ marginTop: 10 }}>{meldung}</div>}
      {fehler && <div className="rueckmeldung schlecht klein" style={{ marginTop: 10 }}>{fehler}</div>}

      {einlesen && (
        <Dialog titel="Sicherung einlesen" aufSchliessen={() => { setEinlesen(null); setPruefung(null); }}
          fuss={<>
            <Knopf onClick={() => { setEinlesen(null); setPruefung(null); }}>Abbrechen</Knopf>
            <Knopf disabled={!pruefung?.gut || Boolean(laeuft)} onClick={() => einlesenMit(false)}>
              Dazulegen</Knopf>
            <Knopf art="voll" disabled={!pruefung?.gut || Boolean(laeuft)} onClick={ersetzen}>
              Alles ersetzen</Knopf>
          </>}>
          <p>
            Die Datei enthält {angabeText(inhaltsangabe(einlesen))}
            {einlesen.erzeugt
              ? ", gesichert am " + new Date(einlesen.erzeugt).toLocaleDateString("de-DE")
              : ""}.
          </p>
          {pruefung && !pruefung.gut && (
            <div className="rueckmeldung schlecht klein">
              {pruefung.probleme.map((t) => <div key={t}>{t}</div>)}
            </div>
          )}
          <p className="klein matt">
            <strong>Dazulegen</strong> ergänzt, was fehlt, und übernimmt nur, was in
            der Datei neuer ist. Dein jetziger Lernstand bleibt, wo er aktueller ist.
            <strong> Alles ersetzen</strong> macht die Datei zum Stand. Was jetzt da ist,
            wandert in den Papierkorb, und davor schreibt die App eine Datei mit dem
            jetzigen Stand in deine Downloads.
          </p>
        </Dialog>
      )}
    </Abschnitt>
  );
}

export default function Einstellungen({ aufAbgleich }) {
  const { einstellungen, setzeEinstellung } = useDaten();
  const [stimmenListe, setStimmenListe] = useState(stimmen());

  useEffect(() => beiStimmen(setStimmenListe), []);

  const schalter = (schluessel, name, hinweis) => (
    <label className="schalter" title={hinweis}>
      <input type="checkbox" checked={Boolean(einstellungen[schluessel])}
        onChange={(e) => setzeEinstellung(schluessel, e.target.checked)} />
      <span>{name}{hinweis && <span className="klein blass"> · {hinweis}</span>}</span>
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
          : "Dieser Browser meldet keine Stimmen. Vorlesen und Buchstabieren bleiben stumm."}>
        {schalter("vorlesenAutomatisch", "Bei Karteikarten von allein vorlesen")}
        {schalter("eigeneStimmeAutomatisch", "Eigene Aufnahme von allein abspielen",
          "wenn du die Loesung selbst eingesprochen hast, sobald sie aufgedeckt ist")}
        <label className="beschriftung" style={{ marginTop: 10 }}>
          Sprechtempo: {Number(einstellungen.sprechTempo).toFixed(1)}
        </label>
        <div className="reihe">
          <input type="range" min="0.6" max="1.6" step="0.1" value={einstellungen.sprechTempo}
            style={{ width: 220 }}
            onChange={(e) => setzeEinstellung("sprechTempo", Number(e.target.value))} />
          <Knopf art="klein" symbol="laut"
            onClick={() => sprich("Deep Dive liest vor.", "de", einstellungen.sprechTempo)}>
            Probe
          </Knopf>
        </div>
      </Abschnitt>

      <Erinnerungsteil />

      <Sprachmodellteil />

      <Wolkenteil aufAbgleich={aufAbgleich} />

      <Sicherungsteil />

      <Beispielteil />

      <Abschnitt titel="Über">
        <p className="klein matt">
          Deep Dive läuft ganz in deinem Browser. Über den Menüpunkt „Installieren“
          deines Browsers lässt er sich wie eine gewöhnliche App auf den Startbildschirm
          legen und dann auch ohne Netz benutzen.
        </p>
      </Abschnitt>

    </div>
  );
}
