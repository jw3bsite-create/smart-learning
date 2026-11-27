/*
 * Einstellungen: Erscheinungsbild, Strenge der Antwortprüfung, Sprachausgabe,
 * Sicherung als Datei und der freiwillige Abgleich mit der Wolke.
 *
 * Seit dem 25. November 2026 wie am iPhone: eine ruhige Übersicht mit
 * sieben Gruppen, jede auf einer eigenen Seite (`#/einstellungen/<gruppe>`).
 * Vorher stand alles untereinander auf einer langen Seite — zu viel auf
 * einmal.
 */

import { ZurueckKnopf } from "./basis.jsx";
import React, { useEffect, useRef, useState } from "react";
import { useDaten } from "../core/store.jsx";
import * as wolke from "../core/cloud.js";
import * as ki from "../core/ki.js";
import * as erinnerung from "../core/erinnerung.js";
import * as push from "../core/push.js";
import * as kurzbefehl from "../core/kurzbefehl.js";
import { WOCHE, HOECHSTENS_JE_TAG, zeitplanOrdnen } from "../core/pushplan.js";
import * as tagessicherung from "../core/tagessicherung.js";
import { UmzugAlt, UmzugNeu } from "./Umzug.jsx";
import {
  stimmen, beiStimmen, sprich, stimmenFuer, stimmeFuer, gewaehlt, waehle, kennungVon, guete,
  GUETE_NAMEN, PROBE, SPRACHEN, sprachAusgabeDa,
} from "../core/speech.js";
import { verwaisteBilderAufraeumen } from "../core/media.js";
import {
  dateiname, inhaltsangabe, angabeText, groesseText, pruefeSicherung,
  letzteText, sicherungFaellig, ERINNERUNG_TAGE,
} from "../core/sicherung.js";
import { alsCsvMitPlan } from "../core/importer.js";
import { herunterladen } from "../core/datei.js";
import { sicherungen as kopienLesen, kopieAlsSicherung } from "../core/db.js";
import * as beispiel from "../core/beispiel.js";
import { datumKurz, tagesSchluessel } from "../core/util.js";
import { Symbol, Knopf, SymbolKnopf, Dialog, Sinnbild } from "./basis.jsx";
import { gehe, zurueck } from "../App.jsx";
import { bestaetigen } from "./Rueckfragen.jsx";
import Gestaltung from "./Gestaltung.jsx";
import Kalenderausfuhr from "./Kalenderausfuhr.jsx";



/* Auf einer Unterseite, die schon so heißt, fällt die doppelte Überschrift weg. */
const SeitenTitel = React.createContext(null);

function Abschnitt({ titel, hinweis, children }) {
  const seite = React.useContext(SeitenTitel);
  const ohneTitel = seite && seite === titel;
  return (
    <section className="unten-32">
      {!ohneTitel && <h2 style={{ marginBottom: hinweis ? 4 : 12 }}>{titel}</h2>}
      {hinweis && (
        <p className="klein matt erklaerung" style={{ marginTop: 0, marginBottom: 12 }}>{hinweis}</p>
      )}
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
    if (ueberall && !(await bestaetigen({
      titel: "Auf allen Geräten abmelden?",
      text: "Handy, Tablet und Rechner müssen sich danach neu anmelden. Deine Karten "
        + "bleiben auf jedem Gerät erhalten.",
      ja: "Überall abmelden",
    }))) return;
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
          {/* Umbruch: Die Kennung ist lang, und ohne ihn schob sie auf dem
              Telefon den Abgleichknopf aus dem Bild. */}
          <div className="reihe umbruch">
            <Symbol name="wolke" />
            <div className="dehnen" style={{ minWidth: 180 }}>
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
          <div className="reihe umbruch oben-12">
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
            <div className="rueckmeldung schlecht klein oben-12">
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
              <div className="klein blass oben-4">
                Der Anhang <span className="mono">/rest/v1/</span> darf dranbleiben,
                er wird beim Speichern abgeschnitten.
              </div>
            </div>
            <div>
              <label className="beschriftung">Öffentlicher Schlüssel</label>
              <input className="feld" placeholder="sb_publishable_… oder eyJ…" value={zugang.key}
                onChange={(e) => setZugang({ ...zugang, key: e.target.value })} />
              <div className="klein blass oben-4">
                Der <span className="mono">publishable</span> beziehungsweise
                <span className="mono"> anon</span> key. Niemals der
                <span className="mono"> service_role</span> key, der umgeht jeden Schutz.
              </div>
            </div>
          </div>
          <div className="reihe umbruch oben-12">
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
              <label className="beschriftung oben-12">Passwort</label>
              <input className="feld" type="password"
                autoComplete={neu ? "new-password" : "current-password"} value={passwort}
                onChange={(e) => setPasswort(e.target.value)} />
              <div className="reihe oben-12">
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
        <div className="zahl-kachel oben-12">
          <div className="reihe umbruch" style={{ gap: 8 }}>
            <strong className="dehnen">Einrichtung für iPad und Handy</strong>
            <Knopf art="klein leer" onClick={() => setLink("")}>Schließen</Knopf>
          </div>
          <p className="klein matt oben-8">
            Öffne diesen Link auf dem anderen Gerät. Adresse und Schlüssel stehen dann dort,
            und du musst dich nur noch anmelden. Dein Passwort steht nicht darin.
          </p>
          <input className="feld mono klein" readOnly value={link}
            onFocus={(e) => e.target.select()} />
          <div className="reihe oben-8">
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

      {fehler && <div className="rueckmeldung schlecht klein oben-12">{fehler}</div>}
      {hinweis && <div className="rueckmeldung gut klein oben-12">{hinweis}</div>}

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
          <label className="beschriftung oben-12">Neues Passwort</label>
          <input className="feld" type="password" autoComplete="new-password"
            value={pwNeu} onChange={(e) => setPwNeu(e.target.value)} />
          <label className="beschriftung oben-12">Neues Passwort wiederholen</label>
          <input className="feld" type="password" autoComplete="new-password"
            value={pwWieder} onChange={(e) => setPwWieder(e.target.value)} />

          <label className="schalter oben-16">
            <input type="checkbox" checked={andereAbmelden}
              onChange={(e) => setAndereAbmelden(e.target.checked)} />
            <span>Auf meinen anderen Geräten abmelden</span>
          </label>
          <p className="klein matt oben-4">
            Ohne Haken bleiben Handy, Tablet und Rechner angemeldet. Supabase meldet
            beim Passwortwechsel von sich aus niemanden ab. Mit Haken müssen sie sich neu
            anmelden, spätestens nach einer Stunde, wenn ihre Anmeldung erneuert würde.
            Setz den Haken, wenn du das Passwort änderst, weil jemand es kennen könnte.
          </p>
          {pwFehler && <div className="rueckmeldung schlecht klein oben-12">{pwFehler}</div>}
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
          <div className="antwort-gitter oben-12">
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
              <p className="klein matt oben-8">{anbieter.hinweis}</p>
            </div>
            <div>
              <label className="beschriftung">Adresse</label>
              <input className="feld" value={zugang.adresse}
                onChange={(e) => aendern({ adresse: e.target.value })} />
              <label className="beschriftung oben-12">
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
              <label className="beschriftung oben-12">
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

          <div className="klein blass oben-8">
            Heute verbraucht: {verbraucht} von {zugang.tagesbudget}.
          </div>

          {protokoll.length > 0 && (
            <details className="oben-12">
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

          <p className="klein matt oben-12">
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
  const [probe, setProbe] = useState("");
  const pushTakt = useRef(null);

  // Der Zeitplan wird beim Öffnen einmal geordnet, beim Tippen nicht: Sonst
  // spränge eine Uhrzeit mitten im Ändern an eine andere Stelle.
  useEffect(() => {
    erinnerung.einstellungLesen().then((x) => setE({ ...x, zeitplan: zeitplanOrdnen(x.zeitplan, x.stunde) }));
  }, []);
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
    // Wer die Erinnerung abschaltet, will auch keine Push-Nachricht mehr.
    if (!an && e.push) await push.geraetAbmelden().catch(() => {});
    aendern(an ? { an } : { an, push: false });
  };

  // Beim Absender erst eintragen, wenn das Tippen eine Weile ruht.
  const zeitplanAendern = (zeitplan) => {
    aendern({ zeitplan });
    if (!e.push) return;
    clearTimeout(pushTakt.current);
    pushTakt.current = setTimeout(() => push.zeitplanSetzen(zeitplan, e.stunde).catch(() => {}), 800);
  };

  return (
    <Abschnitt titel="Erinnerung"
      hinweis="Eine ruhige Nachricht mit der Zahl der fälligen Karten, zu den Uhrzeiten, die du hier einstellst. Keine Drohung, keine Flamme.">
      <label className="schalter">
        <input type="checkbox" checked={Boolean(e.an)}
          onChange={(ev) => anschalten(ev.target.checked)} />
        <span>An fällige Karten erinnern</span>
      </label>

      {e.an && <Zeitplan plan={e.zeitplan} setzen={zeitplanAendern} />}

      {/* Am iPhone der verlässliche Weg bei geschlossener App — unabhängig
          vom Schalter oben, der nur die Nachricht bei offener App regelt. */}
      <KurzbefehlTeil />

      {e.an && (
        <PushTeil stunde={e.stunde} zeitplan={e.zeitplan} aktivHier={Boolean(e.push)}
          setzeAktivHier={(an) => aendern({ push: an })} />
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
          weckt auch, wenn Anchor geschlossen ist
        </span>
      </div>
      {kalender && <Kalenderausfuhr aufSchliessen={() => setKalender(false)} />}

      {erlaubnis !== "geht nicht" && (
        <div className="reihe umbruch" style={{ gap: 10, marginTop: 10 }}>
          <Knopf art="klein" onClick={async () => {
            setProbe("");
            try {
              const r = await erinnerung.probe();
              setErlaubnis(erinnerung.erlaubnisStand());
              setProbe(r === "gezeigt" ? "Gesendet. Kam nichts an, sieh in den Mitteilungen "
                + "des Geräts nach, ob sie für Anchor erlaubt sind." : "");
            } catch (f) {
              setProbe("Ging nicht: " + (f?.message || f));
            }
          }}>Probe senden</Knopf>
          {probe && <span className="klein matt">{probe}</span>}
        </div>
      )}

      {erlaubnis === "denied" && (
        <div className="rueckmeldung schlecht klein oben-12">
          Der Browser hat Benachrichtigungen für diese Seite abgelehnt. Das
          lässt sich nur in seinen eigenen Einstellungen zurücknehmen.
        </div>
      )}
      {erlaubnis === "geht nicht" && (
        <div className="klein blass oben-12">
          {erinnerung.istApple() && !erinnerung.alsAppGeoeffnet()
            ? "Auf dem iPhone gibt es Benachrichtigungen nur, wenn Anchor vom "
              + "Home-Bildschirm aus geöffnet ist, nicht im Safari-Fenster."
            : "Dieser Browser kennt keine Benachrichtigungen."}
        </div>
      )}

      {!e.push && (
        <p className="klein blass oben-12">
          Ohne Push erscheint die Nachricht nur, solange die App irgendwo geöffnet
          ist. Auf dem Handy also beim Öffnen, nicht davor.
        </p>
      )}
    </Abschnitt>
  );
}

/*
 * Die Erinnerung über die App „Kurzbefehle“ (core/kurzbefehl.js).
 *
 * Anchor kann auf dem iPhone keinen Kurzbefehl anlegen — das geht nur in
 * der App selbst. Also: eine Adresse erzeugen, die man einmal kopiert, und
 * eine Anleitung, die jeden Handgriff mit dem Namen nennt, unter dem er
 * auf dem iPhone steht.
 */
function KurzbefehlTeil() {
  const [adresse, setAdresse] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState("");
  const [probe, setProbe] = useState(null);
  const [kopiert, setKopiert] = useState("");
  const [offen, setOffen] = useState(false);

  useEffect(() => { kurzbefehl.adresseLesen().then(setAdresse).catch(() => {}); }, []);

  const pruefen = async (a) => {
    setMeldung(""); setProbe(null);
    try { setProbe(await kurzbefehl.pruefen(a)); }
    catch (f) { setMeldung(f.message); }
  };

  const erzeugen = async () => {
    if (adresse && !(await bestaetigen({
      titel: "Neue Adresse erzeugen?", ja: "Neu erzeugen",
      text: "Die bisherige Adresse gilt danach nicht mehr. Im Kurzbefehl musst du sie "
        + "durch die neue ersetzen.",
    }))) return;
    setLaeuft(true); setMeldung("");
    try {
      const neu = await kurzbefehl.einrichten();
      setAdresse(neu); setOffen(true);
      await pruefen(neu);
    } catch (f) { setMeldung(f.message); }
    finally { setLaeuft(false); }
  };

  const kopieren = async (text, was) => {
    try { await navigator.clipboard.writeText(text); setKopiert(was); }
    catch (f) { setMeldung("Kopieren ging nicht. Halte den Text gedrückt und wähle Kopieren."); }
  };

  const mitKopf = probe?.weg === "kopf";
  const aufgabe = (n, inhalt) => <li className="unten-8" key={n}>{inhalt}</li>;

  return (
    <div className="zahl-kachel oben-16">
      <strong>Auf dem iPhone, auch bei geschlossener App</strong>
      <p className="klein matt" style={{ margin: "6px 0 10px" }}>
        Über die App <strong>Kurzbefehle</strong>, die auf jedem iPhone ist. Sie erinnert auf die
        Minute genau, an den Tagen und zu den Uhrzeiten, die du dort einstellst — und nur, wenn
        Karten fällig sind. Einmal einrichten, etwa fünf Minuten.
      </p>

      {!adresse ? (
        <Knopf art="klein voll" disabled={laeuft} onClick={erzeugen}>
          {laeuft ? "Erzeuge …" : "Adresse für den Kurzbefehl erzeugen"}
        </Knopf>
      ) : (
        <>
          <div className="reihe umbruch" style={{ gap: 8 }}>
            <Knopf art="klein voll" symbol="papier"
              onClick={() => kopieren(mitKopf ? kurzbefehl.ohneApikey(adresse) : adresse, "adresse")}>
              {kopiert === "adresse" ? "Adresse kopiert" : "Adresse kopieren"}
            </Knopf>
            <Knopf art="klein" onClick={() => pruefen(adresse)}>Prüfen</Knopf>
            <Knopf art="klein" onClick={() => setOffen((x) => !x)}>
              {offen ? "Anleitung zuklappen" : "Anleitung"}
            </Knopf>
            <Knopf art="klein leer" disabled={laeuft} onClick={erzeugen}>Neu erzeugen</Knopf>
          </div>
          {probe && (
            <div className="rueckmeldung gut klein oben-8">
              <Symbol name="haken" groesse={15} /> Die Adresse antwortet:{" "}
              {probe.ergebnis.text || "heute ist nichts fällig, also käme keine Mitteilung"}
            </div>
          )}
        </>
      )}
      {meldung && <div className="rueckmeldung schlecht klein oben-8">{meldung}</div>}

      {adresse && offen && (
        <div className="klein oben-12">
          <strong>1. Den Kurzbefehl anlegen (einmal)</strong>
          <ol style={{ paddingLeft: 20 }}>
            {aufgabe(1, <>App <strong>Kurzbefehle</strong> öffnen, unten <strong>Kurzbefehle</strong>,
              oben rechts <strong>+</strong>. Oben als Namen <strong>Anchor</strong> eintragen.</>)}
            {aufgabe(2, <>Aktion suchen: <strong>Inhalte von URL abrufen</strong>. Auf das blaue
              Wort <strong>URL</strong> tippen und die kopierte Adresse einsetzen.</>)}
            {mitKopf && aufgabe(3, <>In derselben Aktion auf den Pfeil tippen, unter
              <strong> Header</strong> einen Eintrag hinzufügen: Schlüssel <strong>apikey</strong>,
              als Wert den öffentlichen Schlüssel{" "}
              <button type="button" className="pfad-verweis"
                onClick={() => kopieren(kurzbefehl.apikeyAus(adresse), "apikey")}>
                {kopiert === "apikey" ? "(kopiert)" : "(kopieren)"}</button>.</>)}
            {aufgabe(4, <>Aktion <strong>Wörterbuchwert abrufen</strong> hinzufügen. Auf
              <strong> Schlüssel</strong> tippen und <strong>text</strong> eintragen.</>)}
            {aufgabe(5, <>Aktion <strong>Wenn</strong> hinzufügen. Als Bedingung
              <strong> hat einen beliebigen Wert</strong> wählen.</>)}
            {aufgabe(6, <>Aktion <strong>Mitteilung anzeigen</strong> hinzufügen und sie zwischen
              <strong> Wenn</strong> und <strong>Sonst</strong> ziehen. Den Text darin löschen und
              stattdessen die Variable <strong>Wörterbuchwert</strong> einsetzen (über der Tastatur).</>)}
            {aufgabe(7, <>Oben rechts <strong>Fertig</strong>. Einmal antippen zum Probieren: Sind
              Karten fällig, kommt die Mitteilung sofort.</>)}
          </ol>

          <strong>2. Die Uhrzeiten festlegen</strong>
          <ol style={{ paddingLeft: 20 }}>
            {aufgabe(1, <>In Kurzbefehle unten <strong>Automation</strong>, dann <strong>+</strong> bzw.
              <strong> Neue Automation</strong>.</>)}
            {aufgabe(2, <><strong>Tageszeit</strong> wählen, die Uhrzeit einstellen, darunter
              <strong> Wöchentlich</strong> und die Tage antippen.</>)}
            {aufgabe(3, <><strong>Sofort ausführen</strong> wählen und <strong>Bei Ausführung
              mitteilen</strong> ausschalten. Dann <strong>Weiter</strong>.</>)}
            {aufgabe(4, <>In der Liste den Kurzbefehl <strong>Anchor</strong> antippen. Steht dort
              keine Liste: Aktion <strong>Kurzbefehl ausführen</strong> hinzufügen und darin
              <strong> Anchor</strong> wählen. Dann <strong>Fertig</strong>.</>)}
          </ol>
          <p className="matt" style={{ margin: 0 }}>
            Jede Uhrzeit ist eine eigene Automation — für morgens und abends also zwei. Die Zahl
            stammt aus der Cloud; sie stimmt, sobald Anchor nach dem Lernen kurz abgeglichen hat.
            Antippen der Mitteilung öffnet die Kurzbefehle, nicht Anchor.
          </p>
        </div>
      )}
    </div>
  );
}

/*
 * Wann erinnert wird: je Wochentag bis zu acht Uhrzeiten. Gerechnet wird
 * damit in core/pushplan.js — vom Absender wie von der offenen App.
 */
function Zeitplan({ plan, setzen }) {
  const tagSetzen = (tag, liste) => setzen({ ...plan, [tag]: liste });
  const dazu = (tag) => {
    const liste = plan[tag];
    const letzte = liste[liste.length - 1];
    // Drei Stunden nach der letzten, sonst der späte Nachmittag.
    const neu = letzte
      ? String((Number(letzte.slice(0, 2)) + 3) % 24).padStart(2, "0") + letzte.slice(2) : "17:00";
    tagSetzen(tag, [...liste, neu]);
  };
  const uebertragen = (auf) => setzen({ ...plan, ...Object.fromEntries(auf.map((w) => [w, [...plan[1]]])) });
  const anzahl = Object.values(plan).reduce((n, l) => n + l.length, 0);

  return (
    <div className="oben-12">
      <div className="zeitplan">
        {WOCHE.map(([tag, kurz, lang]) => (
          <div key={tag} className="zeitplan-zeile">
            <span className="zeitplan-tag" title={lang}>{kurz}</span>
            <div className="zeitplan-zeiten">
              {plan[tag].length === 0 && <span className="klein blass">keine</span>}
              {plan[tag].map((u, i) => (
                <span key={i} className="zeitplan-zeit">
                  <input type="time" className="feld" value={u}
                    aria-label={lang + ", " + (i + 1) + ". Uhrzeit"}
                    onChange={(ev) => ev.target.value
                      && tagSetzen(tag, plan[tag].map((x, j) => (j === i ? ev.target.value : x)))} />
                  <SymbolKnopf symbol="kreuz" groesse={14} titel={"Diese Uhrzeit am " + lang + " entfernen"}
                    onClick={() => tagSetzen(tag, plan[tag].filter((_, j) => j !== i))} />
                </span>
              ))}
              {plan[tag].length < HOECHSTENS_JE_TAG && (
                <SymbolKnopf symbol="plus" titel={"Uhrzeit am " + lang + " hinzufügen"}
                  onClick={() => dazu(tag)} />
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="reihe umbruch oben-8" style={{ gap: 8 }}>
        <Knopf art="klein" disabled={!plan[1].length} onClick={() => uebertragen([2, 3, 4, 5])}>
          Montag auf Di–Fr übertragen
        </Knopf>
        <Knopf art="klein" disabled={!plan[1].length} onClick={() => uebertragen([0, 2, 3, 4, 5, 6])}>
          Montag auf alle Tage
        </Knopf>
      </div>
      <p className="klein blass oben-8" style={{ marginBottom: 0 }}>
        {anzahl === 0 ? "Keine Uhrzeit eingestellt — es kommt keine Nachricht."
          : anzahl + (anzahl === 1 ? " Erinnerung" : " Erinnerungen") + " in der Woche. "
            + "Sind zu einer Uhrzeit keine Karten fällig, bleibt sie still."}
      </p>
    </div>
  );
}

/*
 * Was der Absender über dieses Gerät weiß. Drei Zeilen, die zusammen
 * sagen, ob und warum eine Nachricht kommt.
 */
function PushEinblick() {
  const [e, setE] = useState(null);
  const [fehlerText, setFehlerText] = useState("");
  useEffect(() => { push.geraetEinblick().then(setE).catch((f) => setFehlerText(f.message)); }, []);
  if (fehlerText) return <div className="klein blass oben-4">{fehlerText}</div>;
  if (!e) return null;
  const heute = tagesSchluessel();
  const heuteZahl = e.plan?.[heute];
  const alter = e.vorschauZeit ? Math.round((Date.now() - e.vorschauZeit) / 60000) : null;
  const zeile = (gut, text) => (
    <div className="reihe klein" style={{ gap: 6 }}>
      <Symbol name={gut ? "haken" : "kreuz"} groesse={14}
        style={{ color: gut ? "var(--gruen)" : "var(--gelb)" }} />
      <span className="matt">{text}</span>
    </div>
  );
  return (
    <div className="oben-8 unten-8" style={{ display: "grid", gap: 4 }}>
      {zeile(e.eingetragen && !e.zeitplanFehlt, !e.eingetragen
        ? "Beim Absender nicht eingetragen. Schalter einmal aus- und wieder einschalten."
        : e.zeitplanFehlt
          ? "Beim Absender eingetragen, aber nur mit einer Uhrzeit (ab " + e.stunde + " Uhr): "
            + "Für mehrere braucht Supabase wolke.sql in Fassung 5."
          : "Beim Absender eingetragen"
            + (e.zeitplan ? " mit " + Object.values(e.zeitplan).flat().length + " Uhrzeiten in der Woche."
              : ", Nachricht ab " + e.stunde + " Uhr."))}
      {zeile(heuteZahl !== undefined, heuteZahl === undefined
        ? "Für heute liegt keine Vorschau vor. Einmal unter Cloud abgleichen."
        : "Vorschau: heute " + heuteZahl + (heuteZahl === 1 ? " Karte" : " Karten") + " fällig"
          + (alter !== null ? ", aktualisiert vor " + (alter < 60 ? alter + " Min." : Math.round(alter / 60) + " Std.") : "")
          + (heuteZahl === 0 ? " — ohne fällige Karten kommt keine Nachricht." : "."))}
      {zeile(Boolean(e.letzte), e.letzte
        ? "Letzte Nachricht am " + new Date(e.letzte.slice(0, 10) + "T12:00").toLocaleDateString("de-DE",
          { weekday: "long", day: "numeric", month: "long" })
          + (e.letzte.length > 10 ? ", " + e.letzte.slice(11) + " Uhr" : "") + "."
        : "Bisher keine Nachricht gesendet.")}
    </div>
  );
}

/*
 * Push: die Erinnerung auch bei geschlossener App (core/push.js).
 *
 * Einmal einrichten erzeugt ein Schlüsselpaar und ein Geheimnis; das
 * Geheimnis kommt als ANCHOR_PUSH zu GitHub, wo der Absender läuft. Danach
 * schaltet man jedes Gerät einzeln ein.
 */
function PushTeil({ stunde, zeitplan, aktivHier, setzeAktivHier }) {
  const [lage, setLage] = useState({ stand: "laedt" });
  const [fehler, setFehler] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [geheimnis, setGeheimnis] = useState("");
  const [kopiert, setKopiert] = useState(false);

  const pruefen = async () => {
    setFehler("");
    if (!push.unterstuetzt()) { setLage({ stand: "geht nicht" }); return; }
    try {
      if (!(await wolke.sitzung())) { setLage({ stand: "abgemeldet" }); return; }
      const [zugang, geraet, moeglich] = await Promise.all([
        push.zugangLesen(), push.geraetStand(), push.geraetMoeglich()]);
      setLage({ stand: "bereit", zugang, geraet, moeglich });
    } catch (f) {
      setLage({ stand: "fehler" });
      setFehler(f.message);
    }
  };
  useEffect(() => { pruefen(); }, []);

  /*
   * Einrichten heißt: Schlüssel und Geheimnis erzeugen und das Geheimnis
   * zeigen. Das Gerät anzumelden ist ein zweiter, eigener Schritt. Vorher
   * hing beides zusammen, und scheiterte die Anmeldung (etwa am Rechner
   * ohne Dienst-Arbeiter), war das Geheimnis schon erzeugt, aber nie zu
   * sehen gewesen.
   */
  const einrichten = async () => {
    if (lage.zugang && !(await bestaetigen({
      titel: "Push neu einrichten?",
      text: "Es entsteht ein neues Geheimnis. Du musst es auf GitHub als ANCHOR_PUSH ersetzen "
        + "und jedes Gerät noch einmal einschalten.",
      ja: "Neu einrichten",
    }))) return;
    setLaeuft(true); setFehler("");
    try {
      const r = await push.einrichten();
      setzeAktivHier(false);
      setGeheimnis(r.geheimnis); setKopiert(false);
      await pruefen();
    } catch (f) {
      setFehler(f.message);
    } finally { setLaeuft(false); }
  };

  const umschalten = async (an) => {
    setLaeuft(true); setFehler("");
    try {
      if (an) {
        // Die Erlaubnis als Allererstes, solange der Tipp frisch ist.
        await push.erlaubnisSichern();
        await push.geraetAnmelden({ oeffentlich: lage.zugang.oeffentlich, stunde, zeitplan });
      } else {
        await push.geraetAbmelden();
      }
      setzeAktivHier(an);
      await pruefen();
    } catch (f) {
      setFehler(f.message);
    } finally { setLaeuft(false); }
  };

  const hier = lage.stand === "bereit" && Boolean(lage.geraet) && aktivHier;

  return (
    <div className="zahl-kachel oben-16">
      <strong>Auch bei geschlossener App</strong>
      <p className="klein matt" style={{ margin: "6px 0 10px" }}>
        Als echte Push-Nachricht, verschickt über GitHub, zu den Uhrzeiten oben und nur,
        wenn Karten warten. Pünktlich ist das nicht: GitHub lässt den Absender oft nur alle
        paar Stunden laufen. Auf dem iPhone ist der Weg über Kurzbefehle (oben) verlässlicher.
      </p>

      {lage.stand === "laedt" && <div className="klein blass">Prüfe …</div>}
      {lage.stand === "geht nicht" && (
        <div className="klein blass">
          {erinnerung.istApple() && !erinnerung.alsAppGeoeffnet()
            ? "Auf dem iPhone geht das nur, wenn Anchor vom Home-Bildschirm aus geöffnet ist."
            : "Dieser Browser kann keine Push-Nachrichten empfangen."}
        </div>
      )}
      {lage.stand === "abgemeldet" && (
        <div className="klein blass">Dafür musst du unten unter „Cloud“ angemeldet sein.</div>
      )}

      {lage.stand === "bereit" && !lage.zugang && (
        <Knopf art="voll" disabled={laeuft} onClick={einrichten}>Push einrichten</Knopf>
      )}
      {lage.stand === "bereit" && lage.zugang && (
        <>
          {lage.moeglich ? (
            <>
              <label className="schalter">
                <input type="checkbox" checked={hier} disabled={laeuft}
                  onChange={(ev) => umschalten(ev.target.checked)} />
                <span>Auf diesem Gerät</span>
              </label>
              {hier && <PushEinblick />}
            </>
          ) : (
            <div className="klein blass unten-8">
              Eingerichtet. {push.laeuftLokal()
                ? "Hier am Rechner (localhost) gibt es keine Push-Nachrichten — schalte sie auf dem Handy ein."
                : "Dieses Gerät kann keine Push-Nachrichten empfangen."}
            </div>
          )}
          <button type="button" className="pfad-verweis klein blass" disabled={laeuft}
            onClick={einrichten}>Neu einrichten (neues Geheimnis) …</button>
        </>
      )}

      {fehler && <div className="rueckmeldung schlecht klein oben-12">{fehler}</div>}

      {geheimnis && (
        <Dialog titel="Noch ein Schritt auf GitHub" aufSchliessen={() => setGeheimnis("")}
          fuss={<Knopf art="voll" onClick={() => setGeheimnis("")}>Erledigt</Knopf>}>
          <p className="matt oben-0">
            Damit die Nachrichten verschickt werden, braucht GitHub das Geheimnis
            unten. <strong>Es wird nur jetzt angezeigt</strong> und nirgends
            gespeichert. Danach schaltest du jedes Gerät einzeln unter „Auf diesem
            Gerät“ ein.
          </p>
          <textarea className="feld mono" readOnly rows={4} value={geheimnis}
            onFocus={(ev) => ev.target.select()} style={{ fontSize: 12 }} />
          <div className="reihe umbruch oben-8">
            <Knopf symbol="papier" onClick={async () => {
              try { await navigator.clipboard.writeText(geheimnis); setKopiert(true); }
              catch (f) { setKopiert(false); }
            }}>{kopiert ? "Kopiert" : "Kopieren"}</Knopf>
          </div>
          <ol className="klein matt" style={{ paddingLeft: 18, marginBottom: 0 }}>
            <li>Auf GitHub dein Projekt <strong>smart-learning</strong> öffnen.</li>
            <li><strong>Settings</strong> → links <strong>Secrets and variables</strong> →
              <strong> Actions</strong> → <strong>New repository secret</strong>.</li>
            <li>Name: <strong>ANCHOR_PUSH</strong>, darunter das Kopierte einfügen,
              <strong> Add secret</strong>.</li>
            <li>Zum Ausprobieren: <strong>Actions</strong> → <strong>Push-Erinnerung</strong> →
              <strong> Run workflow</strong>. Nach deiner Uhrzeit und mit fälligen Karten
              kommt die Nachricht dann sofort.</li>
          </ol>
        </Dialog>
      )}
    </div>
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
    if (!(await bestaetigen({
      titel: "Beispieldaten entfernen?",
      text: `${vorab.anzahl} Beispieldatensätze werden endgültig entfernt. `
        + "Alles, was du selbst angelegt hast, bleibt unangetastet.",
      ja: "Entfernen", gefahr: true,
    }))) return;
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
        style={{ marginTop: 12 }}>{meldung}</div>
      )}
    </Abschnitt>
  );
}

/* ---------------------------- Sicherungsteil ---------------------------- */

/*
 * Die täglichen Sicherungen in der Wolke (core/tagessicherung.js). Nur
 * sichtbar, wenn man angemeldet ist und es welche gibt.
 */
function Wolkensicherungen({ ausSicherung, setMeldung, setFehler }) {
  const [liste, setListe] = useState([]);
  useEffect(() => { tagessicherung.wolkenSicherungen().then(setListe).catch(() => {}); }, []);
  if (!liste.length) return null;

  const zurueckholen = async (s) => {
    const datum = new Date(s.tag + "T12:00").toLocaleDateString("de-DE",
      { weekday: "long", day: "numeric", month: "long" });
    if (!(await bestaetigen({
      titel: "Stand von " + datum + " zurückholen?",
      text: "Der jetzige Stand wandert in den Papierkorb, Bilder und Aufnahmen bleiben. "
        + "Vorher legt die App selbst eine Kopie ab.",
      ja: "Zurückholen",
    }))) return;
    setFehler(""); setMeldung("");
    try {
      await ausSicherung(await tagessicherung.wolkenSicherungLaden(s.name), true);
      setMeldung("Zurückgeholt: der Stand von " + datum + ".");
    } catch (e) {
      setFehler("Das Zurückholen ist gescheitert, dein Bestand ist unverändert: " + (e?.message || e));
    }
  };

  return (
    <details className="oben-8">
      <summary className="klein matt" style={{ cursor: "pointer" }}>
        Tägliche Sicherungen in der Cloud ({liste.length})
      </summary>
      <p className="klein blass" style={{ margin: "8px 0" }}>
        Nach dem ersten Abgleich eines Tages legt die App eine Sicherung ohne Bilder in
        deinem Supabase-Speicher ab und behält die letzten {tagessicherung.WOLKE_TAGE} Tage.
        Sie bleibt, auch wenn der Browser seinen Speicher räumt.
      </p>
      <div style={{ display: "grid", gap: 6 }}>
        {liste.map((s) => (
          <div key={s.name} className="reihe klein" style={{ gap: 8 }}>
            <span className="dehnen">
              {new Date(s.tag + "T12:00").toLocaleDateString("de-DE",
                { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })}
            </span>
            <Knopf art="klein" onClick={() => zurueckholen(s)}>Zurückholen</Knopf>
          </div>
        ))}
      </div>
    </details>
  );
}

/** Wofür eine automatische Kopie angelegt wurde, in Worten. */
function kopieGrund(grund) {
  const g = String(grund || "");
  if (g === "umbau") return "vor einem Umbau";
  if (g === "vor-ersetzen") return "vor dem Ersetzen";
  if (g === "vor-dazulegen") return "vor dem Dazulegen";
  if (g.startsWith("vor-umstellung")) return "vor einer Umstellung";
  if (g === "taeglich") return "tägliche Sicherung";
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
    if (!(await bestaetigen({
      titel: "Stand vom " + new Date(k.zeit).toLocaleString("de-DE") + " zurückholen?",
      text: "Der jetzige Stand wandert in den Papierkorb, Bilder und Aufnahmen bleiben.",
      ja: "Zurückholen",
    }))) return;
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
      <div className={"zahl-kachel" + (faellig ? "" : "")} style={{ marginBottom: 16 }}>
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
                Anchor als App (im Browsermenü „Installieren“ oder „Zum
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
          if (!(await bestaetigen({
            titel: "Verwaistes wegräumen?",
            text: vorab.anzahl + " Dateien gehören zu keiner Karte mehr (rund "
              + groesseText(vorab.bytes) + ").",
            ja: "Löschen", gefahr: true,
          }))) return;
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
        <details className="oben-8">
          <summary className="klein matt" style={{ cursor: "pointer" }}>
            Automatische Kopien im Browser ({kopien.length})
          </summary>
          <p className="klein blass" style={{ margin: "8px 0" }}>
            Einmal am Tag, vor jeder Umstellung der Daten und vor jedem Einlesen legt die
            App selbst eine Kopie ab, ohne Bilder und Aufnahmen. Sie liegt im selben
            Browser, ersetzt also keine Datei, hilft aber, wenn etwas schiefgeht.
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

      <Wolkensicherungen ausSicherung={ausSicherung} setMeldung={setMeldung} setFehler={setFehler} />

      {meldung && <div className="rueckmeldung gut klein oben-12">{meldung}</div>}
      {fehler && <div className="rueckmeldung schlecht klein oben-12">{fehler}</div>}

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

/* ------------------------------- Stimme -------------------------------- */

const istIphone = () => typeof navigator !== "undefined"
  && (/iPhone|iPad|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
const istEdge = () => typeof navigator !== "undefined" && /Edg\//.test(navigator.userAgent);

/**
 * Je Sprache die Stimme: automatisch die beste (core/speech.js) oder eine
 * selbst gewählte, mit Probehören. Gibt es nur eine einfache Stimme, sagt
 * die Seite, wie man an eine bessere kommt — gratis, aber nur der Nutzer
 * selbst kann sie laden.
 */
function StimmenWahl({ tempo }) {
  const { stapel } = useDaten();
  const [liste, setListe] = useState(stimmen());
  useEffect(() => beiStimmen((l) => setListe([...l])), []);

  /* Deutsch und Spanisch immer, dazu jede Sprache, die ein Stapel nutzt. */
  const benutzt = new Set(["de", "es"]);
  for (const st of stapel || []) {
    if (st.deleted) continue;
    for (const l of [st.termLang, st.defLang]) if (l) benutzt.add(String(l).slice(0, 2));
  }
  const sprachen = SPRACHEN.filter(([k]) => benutzt.has(k));

  if (!sprachAusgabeDa()) {
    return <p className="klein matt">Dieser Browser kann nicht vorlesen.</p>;
  }
  if (!liste.length) {
    return <p className="klein matt">Die Stimmen werden geladen …</p>;
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {sprachen.map(([kurz, name]) => {
        const alle = stimmenFuer(kurz, liste);
        const aktiv = stimmeFuer(kurz, liste);
        const eigene = gewaehlt(kurz);
        const beste = alle[0] || null;
        const schwach = !beste || guete(beste) === "einfach";
        return (
          <div key={kurz}>
            <label className="beschriftung">{name}</label>
            <div className="reihe" style={{ gap: 8 }}>
              <select className="feld dehnen" style={{ minWidth: 0 }}
                value={eigene && alle.some((x) => kennungVon(x) === eigene) ? eigene : ""}
                onChange={(e) => { waehle(kurz, e.target.value || null); setListe([...liste]); }}>
                <option value="">
                  {beste ? "Automatisch · " + kurzName(beste) : "Keine Stimme auf diesem Gerät"}
                </option>
                {alle.map((x) => (
                  <option key={kennungVon(x)} value={kennungVon(x)}>
                    {kurzName(x)} · {GUETE_NAMEN[guete(x)]}{x.localService === false ? " · braucht Netz" : ""}
                  </option>
                ))}
              </select>
              <Knopf art="klein" symbol="laut" disabled={!aktiv}
                onClick={() => sprich(PROBE[kurz] || PROBE.de, kurz, tempo)}>
                Probe
              </Knopf>
            </div>
            {schwach && (
              <div className="rueckmeldung oben-8 klein">
                Für {name} gibt es auf diesem Gerät nur eine einfache Stimme.{" "}
                {istIphone()
                  ? <>Eine bessere lädst du gratis in den iPhone-Einstellungen: <strong>Bedienungshilfen →
                    Gesprochene Inhalte → Stimmen → {name}</strong>, dort eine Stimme mit „Erweitert“ oder
                    „Premium“ laden (z. B. {kurz === "es" ? "Jorge" : "Markus"}). Danach Anchor neu öffnen.</>
                  : istEdge()
                    ? <>Edge hat natürliche Stimmen, sie brauchen eine Internetverbindung. Ist der PC
                      verbunden, erscheinen sie nach einem Neuladen.</>
                    : <>Öffne Anchor in <strong>Microsoft Edge</strong>, dort gibt es gratis natürliche Stimmen.</>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** „Microsoft Conrad Online (Natural) - German (Germany)“ → „Conrad (Deutschland)“. */
function kurzName(stimme) {
  const name = String(stimme?.name || "");
  const edge = /^Microsoft\s+(\S+).*?-\s*[^(]+\(([^)]+)\)/.exec(name);
  if (edge) return edge[1] + " (" + (LAENDER[edge[2]] || edge[2]) + ")";
  const lang = String(stimme?.lang || "");
  const land = LAENDER_KURZ[lang.slice(3).toUpperCase()];
  return name.replace(/^(Microsoft|Google|Apple)\s+/, "") + (land && !name.includes("(") ? " (" + land + ")" : "");
}
const LAENDER = {
  Germany: "Deutschland", Austria: "Österreich", Switzerland: "Schweiz", Spain: "Spanien",
  Mexico: "Mexiko", "United States": "USA", "United Kingdom": "Großbritannien", France: "Frankreich",
  Argentina: "Argentinien", Colombia: "Kolumbien",
};
const LAENDER_KURZ = { DE: "Deutschland", AT: "Österreich", CH: "Schweiz", ES: "Spanien", MX: "Mexiko",
  US: "USA", GB: "Großbritannien", FR: "Frankreich", AR: "Argentinien", CO: "Kolumbien" };

/* ------------------------------ Die Seiten ----------------------------- */

const TEILE = [
  { id: "lernen", name: "Lernen", symbol: "ziel", ton: "blau" },
  { id: "stimme", name: "Stimme", symbol: "laut", ton: "lila" },
  { id: "erinnerung", name: "Erinnerung", symbol: "glocke", ton: "orange" },
  { id: "aussehen", name: "Aussehen", symbol: "sonne", ton: "gelb" },
  { id: "cloud", name: "Cloud und Geräte", symbol: "wolke", ton: "tuerkis" },
  { id: "daten", name: "Daten und Sicherung", symbol: "herunter", ton: "gruen" },
  { id: "erweitert", name: "Erweitert", symbol: "zahnrad", ton: "grau" },
];

export default function Einstellungen({ aufAbgleich, teil = null }) {
  const { einstellungen, setzeEinstellung } = useDaten();

  const schalter = (schluessel, name, hinweis) => (
    <label className="schalter" title={hinweis}>
      <input type="checkbox" checked={Boolean(einstellungen[schluessel])}
        onChange={(e) => setzeEinstellung(schluessel, e.target.checked)} />
      <span>{name}{hinweis && <span className="klein blass erklaerung"> · {hinweis}</span>}</span>
    </label>
  );

  const seite = TEILE.find((x) => x.id === teil);

  /* ------------------------------ Übersicht ----------------------------- */
  if (!seite) {
    return (
      <div className="mitte" style={{ maxWidth: 640 }}>
        <div className="kopfzeile"><ZurueckKnopf onClick={() => zurueck("/start")} /><h1>Einstellungen</h1></div>

        <UmzugAlt aufAbgleich={aufAbgleich} />
        <UmzugNeu />

        <div className="einstellungs-liste">
          {TEILE.map((x) => (
            <button key={x.id} type="button" className="einstellungs-zeile"
              onClick={() => gehe("/einstellungen/" + x.id)}>
              <Sinnbild name={x.symbol} ton={x.ton} />
              <span className="dehnen">{x.name}</span>
              <Symbol name="weiter" groesse={16} className="blass" />
            </button>
          ))}
        </div>

        <div className="einstellungs-liste oben-16">
          <button type="button" className="einstellungs-zeile" onClick={() => gehe("/hilfe")}>
            <Sinnbild name="frage" ton="blau" />
            <span className="dehnen">Fragen zur App</span>
            <Symbol name="weiter" groesse={16} className="blass" />
          </button>
        </div>
      </div>
    );
  }

  /* ------------------------------ Unterseite ---------------------------- */
  return (
    <SeitenTitel.Provider value={seite.name}>
      <div className="mitte" style={{ maxWidth: 780 }}>
        <div className="kopfzeile">
          <ZurueckKnopf titel="Einstellungen" onClick={() => zurueck("/einstellungen")} />
          <h1 className="dehnen">{seite.name}</h1>
        </div>

        {teil === "lernen" && (
          <>
            <Abschnitt titel="Antwortprüfung"
              hinweis="Gilt für Schreiben, Lernen, Test und Meteor. „Buchstabieren“ prüft immer streng.">
              {schalter("tippfehlerErlauben", "Tippfehler verzeihen", "ein verrutschter Buchstabe zählt als fast richtig")}
              {schalter("ohneArtikel", "Artikel übergehen", "„das Haus“ gilt wie „Haus“")}
              {schalter("zeichenEgal", "Betonungszeichen übergehen", "„café“ gilt wie „cafe“")}
              {schalter("satzzeichenEgal", "Satzzeichen übergehen")}
            </Abschnitt>

            <Abschnitt titel="Oben im Stapel"
              hinweis="Zum Ausprobieren: Was beim Öffnen eines Stapels ganz oben steht.">
              <div className="reihe umbruch" style={{ gap: 8 }} role="radiogroup" aria-label="Oben im Stapel">
                {[["abrufen", "Abrufen"], ["karteikarten", "Karteikarten wie bei Quizlet"]].map(([wert, name]) => {
                  const an = (einstellungen.stapelOben || "abrufen") === wert;
                  return (
                    <Knopf key={wert} art={an ? "voll" : ""} role="radio" aria-checked={an}
                      onClick={() => setzeEinstellung("stapelOben", wert)}>{name}</Knopf>
                  );
                })}
              </div>
            </Abschnitt>

            <Abschnitt titel="Bewertungsknöpfe"
              hinweis="Übereinander: breite Zeilen, für jede Hand gleich gut erreichbar und weg vom ungenauen Rand. Nebeneinander passt zu den Tasten 1 bis 4. Automatisch: am Handy übereinander, am PC nebeneinander. Gilt für Einschätzung und Bewertung, im Abrufen und auf der Startseite.">
              <div className="reihe umbruch" style={{ gap: 8 }} role="radiogroup" aria-label="Bewertungsknöpfe">
                {[["automatisch", "Automatisch"], ["uebereinander", "Übereinander"], ["nebeneinander", "Nebeneinander"]].map(([wert, name]) => {
                  const an = (einstellungen.bewertungKnoepfe || "automatisch") === wert;
                  return (
                    <Knopf key={wert} art={an ? "voll" : ""} role="radio" aria-checked={an}
                      onClick={() => setzeEinstellung("bewertungKnoepfe", wert)}>{name}</Knopf>
                  );
                })}
              </div>
            </Abschnitt>

            <Abschnitt titel="Schutz vor Doppeltipp"
              hinweis="Gleich nachdem neue Knöpfe erscheinen (Einschätzung, Aufdecken, Bewertung), zählen Tipps kurz nicht. So bewertet ein Doppeltipp auf „Aufdecken“ nicht versehentlich mit.">
              <div className="reihe umbruch" style={{ gap: 8 }} role="radiogroup" aria-label="Schutz vor Doppeltipp">
                {[["aus", "Aus"], ["kurz", "Kurz"], ["normal", "Normal"], ["lang", "Lang"]].map(([wert, name]) => {
                  const an = (einstellungen.tippSchutz || "normal") === wert;
                  return (
                    <Knopf key={wert} art={an ? "voll" : ""} role="radio" aria-checked={an}
                      onClick={() => setzeEinstellung("tippSchutz", wert)}>{name}</Knopf>
                  );
                })}
              </div>
            </Abschnitt>

            <Abschnitt titel="Auf der Startseite"
              hinweis="Zum Ausprobieren: Abrufen im kleinen Fenster oder die anstehenden Karten zum Durchblättern.">
              <div className="reihe umbruch" style={{ gap: 8 }} role="radiogroup" aria-label="Auf der Startseite">
                {[["abrufen", "Abrufen"], ["karteikarten", "Karteikarten"]].map(([wert, name]) => {
                  const an = (einstellungen.startseiteModus || "abrufen") === wert;
                  return (
                    <Knopf key={wert} art={an ? "voll" : ""} role="radio" aria-checked={an}
                      onClick={() => setzeEinstellung("startseiteModus", wert)}>{name}</Knopf>
                  );
                })}
              </div>
            </Abschnitt>

            <Abschnitt titel="Übungsrunden"
              hinweis="Wie viele Karten eine Runde in Lernen, Schreiben und Test hat. Beim Abrufen wählst du die Größe jedes Mal neu.">
              <label className="beschriftung">Karten je Runde: {einstellungen.rundenGroesse}</label>
              <input type="range" min="4" max="20" step="1" value={einstellungen.rundenGroesse}
                style={{ width: "100%", maxWidth: 320 }}
                onChange={(e) => setzeEinstellung("rundenGroesse", Number(e.target.value))} />
            </Abschnitt>
          </>
        )}

        {teil === "stimme" && (
          <>
            <Abschnitt titel="Stimmen"
              hinweis="Automatisch nimmt Anchor die beste Stimme auf diesem Gerät. Die Wahl gilt nur hier, iPhone und PC haben verschiedene Stimmen.">
              <StimmenWahl tempo={einstellungen.sprechTempo} />
            </Abschnitt>
            <Abschnitt titel="Vorlesen">
              {schalter("vorlesenAutomatisch", "Bei Karteikarten von allein vorlesen")}
              {schalter("eigeneStimmeAutomatisch", "Eigene Aufnahme von allein abspielen",
                "sobald die Lösung aufgedeckt ist")}
              <label className="beschriftung oben-12">
                Sprechtempo: {Number(einstellungen.sprechTempo).toFixed(1).replace(".", ",")}
              </label>
              <input type="range" min="0.6" max="1.6" step="0.1" value={einstellungen.sprechTempo}
                style={{ width: "100%", maxWidth: 320 }}
                onChange={(e) => setzeEinstellung("sprechTempo", Number(e.target.value))} />
            </Abschnitt>
          </>
        )}

        {teil === "erinnerung" && <Erinnerungsteil />}

        {teil === "aussehen" && (
          <>
            {/* Minimal: einheitliche Zeichen und keine Erklärtexte — ein Schalter
                für beides; die Fragen zur App erklären weiter alles. */}
            <section className="unten-24">
              <label className="schalter">
                <input type="checkbox"
                  checked={einstellungen.sinnbilderFarbig === false && einstellungen.erklaerungen === false}
                  onChange={(e) => {
                    setzeEinstellung("sinnbilderFarbig", !e.target.checked);
                    setzeEinstellung("erklaerungen", !e.target.checked);
                  }} />
                <span><strong>Minimal</strong>
                  <span className="klein blass"> · einheitliche Zeichen, keine Erklärtexte, Hilfe über das „?“</span>
                </span>
              </label>
            </section>
            {/* Zum Ausprobieren (Wunsch des Nutzers, 25.11.2026). */}
            <section className="unten-24">
              <label className="beschriftung">Zurück- und Vor-Pfeile am Handy</label>
              <div className="reihe umbruch" style={{ gap: 8 }} role="radiogroup" aria-label="Zurück- und Vor-Pfeile">
                {[["unten", "Unten in der Mitte"], ["logo", "Unter dem Logo"], ["aus", "Aus"]].map(([wert, name]) => {
                  const an = (einstellungen.verlaufPfeile || "unten") === wert;
                  return (
                    <Knopf key={wert} art={"klein" + (an ? " voll" : "")} role="radio" aria-checked={an}
                      onClick={() => setzeEinstellung("verlaufPfeile", wert)}>{name}</Knopf>
                  );
                })}
              </div>
              {(einstellungen.verlaufPfeile || "unten") !== "aus" && (
                <>
                  <label className="beschriftung oben-12">
                    Größe der Pfeile: {Math.round((Number(einstellungen.verlaufPfeileGroesse) || 1) * 100)} %
                  </label>
                  <input type="range" min="0.7" max="1.8" step="0.05"
                    value={Number(einstellungen.verlaufPfeileGroesse) || 1}
                    style={{ width: "100%", maxWidth: 320 }}
                    onChange={(e) => setzeEinstellung("verlaufPfeileGroesse", Number(e.target.value))} />
                </>
              )}
            
              {/* Die Navigierleiste unten (Start, Fächer, Abrufen, …): Größe nach Geschmack. */}
              <label className="beschriftung oben-16">
                Größe der Navigierleiste: {Math.round((Number(einstellungen.navGroesse) || 1) * 100)} %
              </label>
              <input type="range" min="0.8" max="1.5" step="0.05"
                value={Number(einstellungen.navGroesse) || 1}
                style={{ width: "100%", maxWidth: 320 }}
                onChange={(e) => setzeEinstellung("navGroesse", Number(e.target.value))} />

              {/* Zwei Wege zum Erstellen, zum Ausprobieren (26.11.2026). */}
              <label className="beschriftung oben-16">Erstellen</label>
              <div className="reihe umbruch" style={{ gap: 8 }} role="radiogroup" aria-label="Erstellen">
                {[["plus", "Plus-Knopf"], ["vereint", "Fächer und Stapel vereint"]].map(([wert, name]) => {
                  const an = (einstellungen.erstellen || "plus") === wert;
                  return (
                    <Knopf key={wert} art={"klein" + (an ? " voll" : "")} role="radio" aria-checked={an}
                      onClick={() => setzeEinstellung("erstellen", wert)}>{name}</Knopf>
                  );
                })}
              </div>
              <p className="klein blass oben-4 erklaerung">
                {(einstellungen.erstellen || "plus") === "vereint"
                  ? "Fächer und Stapel teilen sich einen Reiter, in der Leiste unten steht „Erstellen“."
                  : "Ein runder +-Knopf unten rechts über der Leiste, auf Start, Fächer und Stapel."}
              </p>
            </section>
          <Abschnitt titel="Aussehen"
            hinweis="Jede Änderung greift sofort.">
            <Gestaltung />
          </Abschnitt>
          </>
        )}

        {teil === "cloud" && <Wolkenteil aufAbgleich={aufAbgleich} />}

        {teil === "daten" && <Sicherungsteil />}

        {teil === "erweitert" && (
          <>
            <Sprachmodellteil />
            <Beispielteil />
            <Abschnitt titel="Über">
              <p className="klein matt">
                Anchor läuft ganz in deinem Browser. Über „Installieren“ im Menü des Browsers
                liegt er wie eine App auf dem Startbildschirm und geht auch ohne Netz.
              </p>
            </Abschnitt>
          </>
        )}
      </div>
    </SeitenTitel.Provider>
  );
}
