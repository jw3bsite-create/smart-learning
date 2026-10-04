/*
 * Abgleich mit der Wolke (Supabase) — freiwillig.
 *
 * Ohne Zugangsdaten läuft die App vollständig für sich. Wer sie auf Rechner
 * und Handy mit demselben Bestand nutzen will, hinterlegt in den Einstellungen
 * Adresse und öffentlichen Schlüssel seines eigenen Supabase-Projekts und
 * meldet sich mit einer Kennung an.
 *
 * Verfahren: eine einzige Tabelle, jede Zeile ein Datensatz mit `updated_at`.
 * Beim Abgleich wird geholt, was neuer ist als der letzte Abgleich, und
 * geschickt, was sich seither hier geändert hat. Bei Streit gewinnt die
 * jüngere Änderung. Das ist einfach und für einen einzelnen Nutzer mit
 * mehreren Geräten genau richtig.
 *
 * Die Tabelle wird mit `wolke.sql` angelegt.
 */

import * as db from "./db.js";
import { tonSchluessel, tonTeile } from "./ton.js";
import { UEBERLAPPUNG, zuUebernehmen, neueMarke, medienPlan } from "./abgleich.js";

const TABELLE = "karteikasten";
const EIMER = "bilder";

/**
 * Ablage im Browser ↔ Art in der Tabelle.
 *
 * **Diese Liste muss `db.SYNCED` vollständig abdecken.** Sie tat es lange
 * nicht: Nur Ordner, Stapel, Karten und der alte Fortschritt standen hier,
 * während der Abgleich über alle zehn Ablagen läuft. Für die übrigen sechs
 * wäre `art` leer geblieben — die Spalte ist `not null`, der Abgleich also mit
 * einem Datenbankfehler abgebrochen. Gefehlt hätte ausgerechnet der Lernstand:
 * Fächer, Kartenzustände, die ganze Abrufhistorie, Entwürfe, Erklärungen,
 * Prüfungen.
 *
 * Die Namen rechts stehen in der Wolke und dürfen sich nicht mehr ändern —
 * ein neuer Name macht die alten Zeilen unauffindbar. Eine Prüfung in
 * `test/wolke.test.js` hält beides fest.
 */
export const ARTEN = {
  folders: "ordner",
  sets: "stapel",
  cards: "karte",
  progress: "stand",
  subjects: "fach",
  cardstates: "zustand",
  reviews: "abruf",
  drafts: "entwurf",
  explanations: "erklaerung",
  exams: "pruefung",
  noten: "note",
  lernzeit: "lernzeit",
};
const ZURUECK = Object.fromEntries(Object.entries(ARTEN).map(([a, b]) => [b, a]));

let klient = null;
let klientSchluessel = "";

/**
 * Zieht eine eingetippte Projektadresse gerade.
 *
 * Supabase zeigt im Verwaltungsbereich die REST-Adresse groß an —
 * `https://…supabase.co/rest/v1/`. Die trägt man dann ein, und nichts geht:
 * Die Bibliothek hängt ihre eigenen Wege hinten an und landet bei
 * `/rest/v1/rest/v1/…`. Der Fehler kommt als schlichtes „kein Anschluss"
 * zurück, und man sucht ihn beim Schlüssel oder bei der Tabelle.
 *
 * Darum wird hier abgeschnitten, was Supabase anhängt, statt dem Nutzer das
 * Aufpassen zu überlassen.
 */
export function normalisiereUrl(roh) {
  let text = String(roh || "").trim();
  if (!text) return "";
  if (!/^https?:\/\//i.test(text)) text = "https://" + text;
  let adresse;
  try {
    adresse = new URL(text);
  } catch {
    return text.replace(/\/+$/, "");
  }
  // rest, auth, storage, realtime — die vier Wege, die im Verwaltungsbereich
  // stehen. Alles davon gehört der Bibliothek, nicht der Adresse.
  const pfad = adresse.pathname
    .replace(/\/+(rest|auth|storage|realtime)\/v\d+\/?$/i, "/")
    .replace(/\/+$/, "");
  return adresse.origin + pfad;
}

/*
 * Unsichtbares Beiwerk, das beim Kopieren mitkommt: Nullbreiten-Zeichen,
 * Wortverbinder, weiches Trennzeichen, Byte-Marke. Man sieht es nicht, man
 * bekommt es von Hand nicht weg, und es macht den Schluessel unbrauchbar.
 *
 * Als Liste von Codepunkten und nicht als Suchmuster: Ein Suchmuster mit
 * diesen Zeichen enthielte sie selbst, waere also im Quelltext ebenso
 * unsichtbar und beim naechsten Bearbeiten verloren.
 */
const UNSICHTBAR = new Set([0x200b, 0x200c, 0x200d, 0x2060, 0xfeff, 0x00ad]);

/** Raeumt aus einem eingefuegten Schluessel weg, was man ohnehin nicht sieht. */
export function saeubereSchluessel(roh) {
  return [...String(roh || "")]
    .filter((z) => !UNSICHTBAR.has(z.codePointAt(0)))
    .join("")
    .trim();
}

/** Zeichen, die in einem Schluessel vorkommen duerfen. */
const ERLAUBT = /[A-Za-z0-9._-]/;

/**
 * Sagt, was mit einem Schluessel nicht stimmt - oder nichts, wenn er taugt.
 *
 * Der Grund fuer diese Pruefung ist eine Meldung, die der Browser wirft und
 * die niemand deuten kann: "String contains non ISO-8859-1 code point". Sie
 * bedeutet, dass ein Zeichen nicht in eine Kopfzeile passt - etwa ein
 * Gedankenstrich oder ein Auslassungszeichen, das beim Kopieren aus einem
 * Fliesstext mitgekommen ist. Der Browser nennt weder das Feld noch die
 * Stelle. Also nennen wir sie.
 */
export function schluesselFehler(roh) {
  const schluessel = saeubereSchluessel(roh);
  if (!schluessel) return "Es fehlt der Schlüssel.";
  const zeichen = [...schluessel];
  const stelle = zeichen.findIndex((z) => !ERLAUBT.test(z));
  if (stelle >= 0)
    return "An Stelle " + (stelle + 1) + " steht \u201e" + zeichen[stelle]
      + "\u201c \u2014 ein Zeichen, das in einem Schl\u00fcssel nicht vorkommt. "
      + "Beim Kopieren ist etwas mitgekommen; kopiere ihn noch einmal frisch "
      + "aus Supabase.";
  if (zeichen.length < 20)
    return "Der Schl\u00fcssel ist zu kurz \u2014 das sieht nach einem Ausschnitt aus.";
  return "";
}

/** Dasselbe fuer die Adresse. */
export function adressFehler(roh) {
  const adresse = normalisiereUrl(roh);
  if (!adresse) return "Es fehlt die Adresse des Projekts.";
  const fremd = [...adresse].find((z) => z.codePointAt(0) > 0x7e);
  if (fremd)
    return "In der Adresse steht \u201e" + fremd + "\u201c. Kopiere sie noch einmal frisch.";
  if (!/^https?:[/][/][^/]+[.]/i.test(adresse))
    return "Das sieht nicht nach einer Adresse aus \u2014 erwartet wird etwas wie "
      + "https://abcdefg.supabase.co";
  return "";
}

/**
 * Klopft beim Projekt an, bevor man sich darauf verlässt.
 *
 * → { ok: true } oder { ok: false, grund: "offline" | "projekt" | "schluessel" |
 *   "unbekannt", text }
 *
 * Der Grund für diese Prüfung: Ein pausiertes oder falsch abgetipptes Projekt
 * meldete sich bisher erst beim Anmelden, und dann mit dem Wortlaut des
 * Browsers. Beim Speichern nachzusehen kostet eine Anfrage und erspart das
 * Rätseln an der falschen Stelle.
 *
 * Unterschieden wird dreierlei, soweit ein Browser das überhaupt zulässt: kein
 * Netz (navigator.onLine), Netz da, aber Supabase selbst unerreichbar, und
 * Supabase erreichbar, aber dieses Projekt nicht. Nur das Letzte heißt
 * „pausiert oder falsche Adresse" — und genau dieser Fall ist der häufige.
 */
export async function verbindungPruefen(roh = {}) {
  const adresse = normalisiereUrl(roh.url);
  const schluessel = saeubereSchluessel(roh.key);

  if (typeof navigator !== "undefined" && navigator.onLine === false)
    return { ok: false, grund: "offline", text: "Dieses Gerät hat gerade kein Netz." };

  try {
    const antwort = await fetch(adresse + "/auth/v1/health", {
      headers: { apikey: schluessel },
    });
    if (antwort.status === 401 || antwort.status === 403)
      return { ok: false, grund: "schluessel",
        text: "Das Projekt antwortet, lehnt den Schlüssel aber ab. Kopiere den "
          + "publishable key frisch aus Supabase (API Keys)." };
    if (!antwort.ok)
      return { ok: false, grund: "unbekannt",
        text: "Das Projekt antwortet mit Fehler " + antwort.status + "." };
    return { ok: true };
  } catch {
    /* Die Anfrage kam nicht an. Ob das am Projekt liegt oder am Netz, prüft
       ein zweiter Versuch bei Supabase selbst. `no-cors` genügt: Lesen dürfen
       wir die Antwort nicht, aber dass eine kommt, reicht als Beweis. */
    let supabaseDa = false;
    try {
      await fetch("https://supabase.com/favicon.ico", { mode: "no-cors", cache: "no-store" });
      supabaseDa = true;
    } catch { /* bleibt false */ }

    if (!supabaseDa)
      return { ok: false, grund: "netz",
        text: "Supabase ist von hier aus nicht erreichbar. Vielleicht sperrt ein "
          + "Filter im Netz (etwa im Schul-WLAN) die Adresse." };
    return { ok: false, grund: "projekt",
      text: "Supabase ist erreichbar, dein Projekt aber nicht. Meist ist es "
        + "pausiert, kostenlose Projekte schlafen nach einer Woche ohne Nutzung "
        + "ein; in Supabase steht dann „Paused\u201c mit einem Knopf zum Aufwecken. "
        + "Sonst weicht die Adresse ab: Project URL frisch kopieren." };
  }
}

export async function zugangLesen() {
  return (await db.getSetting("wolke", null)) || { url: "", key: "" };
}

export async function zugangSchreiben(zugang) {
  // Beim Speichern geradeziehen, damit im Feld steht, was tatsächlich benutzt
  // wird — und nicht etwas, das nur zufällig noch funktioniert.
  await db.setSetting("wolke", {
    ...zugang,
    url: normalisiereUrl(zugang?.url),
    key: saeubereSchluessel(zugang?.key),
  });
  klient = null; klientSchluessel = "";
}

export const eingerichtet = (zugang) => Boolean(zugang && zugang.url && zugang.key);

/** Verbindung herstellen (oder die bestehende weiterverwenden). */
export async function verbinde() {
  const zugang = await zugangLesen();
  if (!eingerichtet(zugang)) return null;
  const adresse = normalisiereUrl(zugang.url);
  const schluessel = saeubereSchluessel(zugang.key);
  // Lieber hier mit einem verständlichen Satz abbrechen als später mit der
  // Meldung des Browsers, die niemandem hilft.
  const fehler = adressFehler(adresse) || schluesselFehler(schluessel);
  if (fehler) throw new Error(fehler);
  const kennzeichen = adresse + "|" + schluessel;
  if (klient && klientSchluessel === kennzeichen) return klient;
  const { createClient } = await import("@supabase/supabase-js");
  klient = createClient(adresse, schluessel, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: "karteikasten-anmeldung" },
  });
  klientSchluessel = kennzeichen;
  return klient;
}

/* -------------------- Zugang auf ein anderes Gerät ---------------------- */

/*
 * Adresse und Schlüssel sind lang, und man braucht sie auf jedem Gerät.
 * Abtippen ist mühsam und geht schief; also packt die App beides in einen
 * Link, den man auf dem anderen Gerät öffnet.
 *
 * Im Link steht kein Passwort. Er enthält nur, was ohnehin im Browser jedes
 * Geräts steht: die Projektadresse und den öffentlichen Schlüssel. Angemeldet
 * wird sich danach wie immer mit Kennung und Passwort.
 */

const ZUGANG_FELD = "zugang";

export function zugangAlsLink(zugang, adresse) {
  const url = normalisiereUrl(zugang?.url);
  const key = saeubereSchluessel(zugang?.key);
  if (!url || !key) return "";
  const text = btoa(JSON.stringify({ url, key }));
  const ziel = new URL(".", adresse || (typeof window !== "undefined" ? window.location.href : "https://x/"));
  ziel.hash = "";
  ziel.searchParams.set(ZUGANG_FELD, text);
  return ziel.href;
}

/** Liest einen Zugang aus der Adresse — oder null, wenn keiner darin steht. */
export function zugangAusLink(suche) {
  try {
    const text = new URLSearchParams(String(suche || "").replace(/^\?/, "")).get(ZUGANG_FELD);
    if (!text) return null;
    const daten = JSON.parse(atob(text));
    const url = normalisiereUrl(daten?.url);
    const key = saeubereSchluessel(daten?.key);
    if (!url || !key || adressFehler(url) || schluesselFehler(key)) return null;
    return { url, key };
  } catch (e) {
    return null;
  }
}

const UEBERNOMMEN = "wolke-zugang-uebernommen";

/**
 * Den Zugang aus dem Link übernehmen und die Adresse wieder aufräumen —
 * er soll nicht im Verlauf des Browsers stehen bleiben.
 */
export async function zugangUebernehmen(zugang) {
  await zugangSchreiben(zugang);
  try { window.sessionStorage.setItem(UEBERNOMMEN, "1"); } catch (e) { /* egal */ }
  if (typeof window !== "undefined") {
    const ziel = window.location.pathname + "#/einstellungen";
    window.history.replaceState(window.history.state, "", ziel);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }
}

/** Wurde gerade ein Zugang übernommen? Gibt das einmal heraus. */
export function zugangUebernahmeAbholen() {
  try {
    if (window.sessionStorage.getItem(UEBERNOMMEN) !== "1") return false;
    window.sessionStorage.removeItem(UEBERNOMMEN);
    return true;
  } catch (e) {
    return false;
  }
}

/* ------------------------------ Anmeldung ------------------------------ */

export async function sitzung() {
  const k = await verbinde();
  if (!k) return null;
  const { data } = await k.auth.getSession();
  return data?.session || null;
}

export async function anmelden(kennung, passwort) {
  const k = await verbinde();
  if (!k) throw new Error("Keine Zugangsdaten hinterlegt.");
  const { data, error } = await k.auth.signInWithPassword({ email: kennung, password: passwort });
  if (error) throw new Error(uebersetze(error.message));
  return data.session;
}

export async function registrieren(kennung, passwort) {
  const k = await verbinde();
  if (!k) throw new Error("Keine Zugangsdaten hinterlegt.");
  const { data, error } = await k.auth.signUp({
    email: kennung,
    password: passwort,
    /*
     * Wohin der Verweis aus der Bestaetigungsmail fuehren soll.
     *
     * Ohne diese Angabe nimmt Supabase die Site URL des Projekts, und die
     * steht ab Werk auf http://localhost:3000 — einen Server, den niemand
     * hat. Der Verweis fuehrt dann ins Leere, und der Fehler steht in der
     * Adresszeile statt in der App. Die App weiss selbst am besten, wo sie
     * liegt; also sagt sie es.
     */
    options: { emailRedirectTo: eigeneAdresse() },
  });
  if (error) throw new Error(uebersetze(error.message));
  return data.session;
}

/** Die Adresse, unter der diese App gerade laeuft. */
function eigeneAdresse() {
  if (typeof window === "undefined") return undefined;
  return new URL(".", window.location.href).href;
}

/**
 * Abmelden — ab Werk nur auf diesem Geraet.
 *
 * Supabase meldet ohne Angabe mit `scope: "global"` ab, also auf allen
 * Geraeten zugleich. So stand es hier bis zu dieser Fassung: Wer sich auf dem
 * Schul-iPad abmeldete, war auch auf Handy und Rechner draussen. Das will man
 * fast nie; wer es will, sagt es ausdruecklich.
 */
export async function abmelden({ ueberall = false } = {}) {
  const k = await verbinde();
  if (!k) return;
  const { error } = await k.auth.signOut({ scope: ueberall ? "global" : "local" });
  if (error) throw new Error(uebersetze(error.message));
}

/* ------------------------------ Passwort ------------------------------- */

/** Supabase verlangt ab Werk mindestens sechs Zeichen. */
export const PASSWORT_MINDEST = 6;

/** Prueft zwei Eingaben fuer ein neues Passwort, bevor etwas hinausgeht. */
export function passwortPruefen(neu, wiederholt) {
  const a = String(neu || "");
  if (!a) return "Es fehlt das neue Passwort.";
  if (a.length < PASSWORT_MINDEST)
    return "Das neue Passwort ist zu kurz \u2014 mindestens sechs Zeichen.";
  if (a !== String(wiederholt || ""))
    return "Die beiden Eingaben stimmen nicht \u00fcberein.";
  return "";
}

/**
 * Schickt einen Verweis zum Zuruecksetzen an die Kennung.
 *
 * Supabase verraet dabei nicht, ob es die Kennung gibt — sonst liesse sich
 * damit ausprobieren, welche Adressen ein Konto haben. Die Oberflaeche sagt
 * darum "wenn es die Kennung gibt".
 */
export async function passwortVergessen(kennung) {
  const k = await verbinde();
  if (!k) throw new Error("Keine Zugangsdaten hinterlegt.");
  const email = String(kennung || "").trim();
  if (!email)
    throw new Error("Trag oben deine Kennung (E-Mail) ein \u2014 dorthin geht der Verweis.");
  const { error } = await k.auth.resetPasswordForEmail(email, { redirectTo: eigeneAdresse() });
  if (error) throw new Error(uebersetze(error.message));
}

/**
 * Setzt ein neues Passwort fuer die bestehende Anmeldung.
 *
 * Gebraucht nach der Rueckkehr ueber den Verweis — dort gibt es kein
 * bisheriges Passwort, die Anmeldung stammt aus dem Verweis selbst.
 *
 * Andere Geraete bleiben angemeldet, sofern nicht `andereAbmelden` gesetzt
 * ist: Supabase selbst meldet beim Passwortwechsel niemanden ab (im Quelltext
 * des Anmeldedienstes steht dabei kein einziger Abmeldeschritt).
 */
export async function passwortSetzen(neu, { andereAbmelden = false } = {}) {
  const k = await verbinde();
  if (!k) throw new Error("Keine Zugangsdaten hinterlegt.");
  const { error } = await k.auth.updateUser({ password: neu });
  if (error) throw new Error(uebersetze(error.message));
  if (andereAbmelden) {
    const { error: abmeldeFehler } = await k.auth.signOut({ scope: "others" });
    if (abmeldeFehler) throw new Error(uebersetze(abmeldeFehler.message));
  }
}

/**
 * Aendert das Passwort, wenn man angemeldet ist und das bisherige kennt.
 *
 * Das bisherige Passwort wird verlangt, und zwar echt geprueft, indem damit
 * frisch angemeldet wird. Zwei Gruende: Wer ein entsperrtes Geraet in der Hand
 * hat, soll damit nicht das Passwort umstellen koennen. Und ist im Projekt
 * "Secure password change" eingeschaltet, verlangt Supabase bei Anmeldungen
 * aelter als 24 Stunden eine Bestaetigung per Mail — nach einer frischen
 * Anmeldung nicht.
 */
export async function passwortAendern({ kennung, bisher, neu, andereAbmelden = false }) {
  const k = await verbinde();
  if (!k) throw new Error("Keine Zugangsdaten hinterlegt.");
  const { error } = await k.auth.signInWithPassword({ email: kennung, password: bisher });
  if (error)
    throw new Error(/invalid login/i.test(error.message)
      ? "Das bisherige Passwort stimmt nicht."
      : uebersetze(error.message));
  await passwortSetzen(neu, { andereAbmelden });
}

/* ---------------------- Rueckkehr aus einer Mail ----------------------- */

const RUECKKEHR_SCHLUESSEL = "wolke-rueckkehr";

/**
 * Erkennt, ob die Adresse eine Rueckkehr aus einer Supabase-Mail ist.
 *
 * Supabase haengt die Anmeldung hinter das #: `#access_token=...&type=recovery`
 * — oder bei einem abgelaufenen Verweis `#error=access_denied&error_code=
 * otp_expired`. Genau dort liegen aber auch die Seitenwege der App
 * (`#/stapel/...`). Die beginnen immer mit einem Schraegstrich; eine
 * Rueckkehr nie.
 *
 * → null, oder { art: "recovery" | "signup" | "magiclink" | "anmeldung" }
 *   oder { art: "fehler", code, text }
 */
export function anmeldeRueckkehrLesen(hash) {
  const roh = String(hash || "").replace(/^#/, "");
  if (!/(^|&)(access_token|error|error_code|error_description)=/.test(roh)) return null;
  const teile = new URLSearchParams(roh);
  if (teile.get("error") || teile.get("error_code") || teile.get("error_description"))
    return {
      art: "fehler",
      code: teile.get("error_code") || teile.get("error") || "",
      text: teile.get("error_description") || "",
    };
  return { art: teile.get("type") || "anmeldung" };
}

function sitzungsSpeicher() {
  try { return window.sessionStorage; } catch { return null; }
}

/** Merkt sich eine Rueckkehr ueber den Neustart der Seite hinweg. */
export function rueckkehrMerken(rueckkehr, fertig = false) {
  const sp = sitzungsSpeicher();
  if (sp) sp.setItem(RUECKKEHR_SCHLUESSEL, JSON.stringify({ ...rueckkehr, fertig }));
}

/** Gibt eine fertig verarbeitete Rueckkehr einmal heraus und vergisst sie. */
export function rueckkehrAbholen() {
  const sp = sitzungsSpeicher();
  if (!sp) return null;
  try {
    const r = JSON.parse(sp.getItem(RUECKKEHR_SCHLUESSEL) || "null");
    if (!r || !r.fertig) return null;
    sp.removeItem(RUECKKEHR_SCHLUESSEL);
    return r;
  } catch {
    sp.removeItem(RUECKKEHR_SCHLUESSEL);
    return null;
  }
}

/**
 * Verarbeitet eine Rueckkehr: Verbindung aufbauen, damit die Bibliothek die
 * Anmeldung aus der Adresse liest, dann auf die Einstellungen wechseln.
 *
 * Der Grund, warum das beim Start geschehen muss: Die Bibliothek liest die
 * Anmeldung nur beim Aufbau der Verbindung aus der Adresse — und die App baut
 * sie erst bei Bedarf auf. Bis zu dieser Fassung lag die Anmeldung aus jedem
 * Bestaetigungs- und Passwortverweis darum ungelesen in der Adresse, und der
 * Verweis tat scheinbar nichts.
 */
export async function rueckkehrVerarbeiten() {
  const sp = sitzungsSpeicher();
  let r = null;
  try { r = JSON.parse((sp && sp.getItem(RUECKKEHR_SCHLUESSEL)) || "null"); } catch { r = null; }
  if (!r) return;

  if (r.art !== "fehler") {
    try {
      const k = await verbinde();
      if (!k) r = { art: "ohneZugang" };
      else {
        // getSession wartet, bis die Bibliothek die Adresse gelesen hat.
        const { data } = await k.auth.getSession();
        if (!data?.session) r = { art: "fehler", code: "keine_sitzung", text: "" };
      }
    } catch (e) {
      r = { art: "fehler", code: "", text: String(e?.message || e) };
    }
  }
  rueckkehrMerken(r, true);

  // Die Anmeldedaten gehoeren nicht in die Adresszeile — und nicht in den
  // Verlauf, wo sie beim Zurueckblaettern wieder auftauchten.
  if (typeof window !== "undefined") {
    const ziel = window.location.pathname + window.location.search + "#/einstellungen";
    // Den angehefteten Zustand behalten: Er traegt die Tiefe im Verlauf.
    window.history.replaceState(window.history.state, "", ziel);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    window.dispatchEvent(new Event(RUECKKEHR_SCHLUESSEL));
  }
}

export const RUECKKEHR_EREIGNIS = RUECKKEHR_SCHLUESSEL;

/*
 * Was ein Browser meldet, wenn eine Anfrage gar nicht erst ankommt — und
 * jeder meldet es anders: Chrome "Failed to fetch", Safari "Load failed",
 * Firefox "NetworkError when attempting to fetch resource". Zuerst stand hier
 * nur die Chrome-Fassung; auf dem iPad kam deshalb "Load failed" roh an, und
 * damit kann niemand etwas anfangen.
 */
const KEIN_ANSCHLUSS = /failed to fetch|load failed|networkerror|network request failed/i;

export function istKeinAnschluss(text) {
  return KEIN_ANSCHLUSS.test(String(text || ""));
}

export function uebersetze(text) {
  const t = String(text || "");
  if (/invalid login/i.test(t)) return "Kennung oder Passwort stimmen nicht.";
  if (/otp_expired|link is invalid or has expired/i.test(t))
    return "Der Verweis ist abgelaufen oder wurde schon benutzt. Fordere einen neuen an.";
  if (/different from the old password|same_password/i.test(t))
    return "Das neue Passwort ist dasselbe wie das bisherige.";
  if (/rate limit|only request this after|over_email_send_rate_limit/i.test(t))
    return "Supabase hat gerade zu viele Mails verschickt \u2014 in der kostenlosen "
      + "Fassung sind es nur wenige je Stunde. Versuch es sp\u00e4ter noch einmal.";
  if (/reauthentication|nonce/i.test(t))
    return "Supabase verlangt f\u00fcr den Passwortwechsel eine erneute Best\u00e4tigung. "
      + "Melde dich ab und wieder an und versuche es dann noch einmal.";
  if (/keine_sitzung/i.test(t))
    return "Der Verweis hat keine Anmeldung mitgebracht. Fordere einen neuen an.";
  if (/email not confirmed/i.test(t))
    return "Die Kennung ist noch nicht bestätigt. Supabase verschickt in der "
      + "kostenlosen Fassung nur wenige Mails am Tag, oft kommt keine an. Du "
      + "kannst die Bestätigung im eigenen Projekt abschalten: Authentication "
      + "→ Sign In / Providers → Email → Confirm email abschalten.";
  if (/already registered/i.test(t)) return "Diese Kennung gibt es bereits.";
  if (/password/i.test(t) && /least/i.test(t)) return "Das Passwort ist zu kurz (mindestens sechs Zeichen).";
  /* PostgREST meldet eine fehlende Tabelle als "Could not find the table
     'public.karteikasten' in the schema cache" (PGRST205). Das heisst fast
     immer: Der SQL-Text wurde in diesem Projekt nie ausgefuehrt — etwa weil
     ein neues Projekt angelegt wurde, nachdem das alte eingeschlafen war. */
  if (/could not find the table|schema cache|PGRST205|relation .* does not exist/i.test(t))
    return "In deinem Supabase-Projekt fehlt die Tabelle. Öffne dort den SQL "
      + "Editor, füge den Inhalt von wolke.sql ein und drücke Run. Die Anmeldung "
      + "selbst hat funktioniert, nur die Ablage für die Daten ist noch nicht da.";
  if (istKeinAnschluss(t))
    return "Dein Supabase-Projekt antwortet nicht. Meist ist es pausiert — "
      + "kostenlose Projekte schlafen nach einer Woche ohne Nutzung ein, oder "
      + "die Adresse weicht ab. Sieh in Supabase nach, ob dort „Paused\u201c steht, "
      + "und kopiere die Project URL frisch.";
  return t;
}

/* ------------------------------- Abgleich ------------------------------ */

function nachAussen(ablage, rec) {
  const { id, updatedAt, deleted, ...rest } = rec;
  return {
    id, art: ARTEN[ablage],
    daten: rest, updated_at: updatedAt || Date.now(), deleted: Boolean(deleted),
  };
}

function nachInnen(zeile) {
  return { id: zeile.id, ...(zeile.daten || {}),
    updatedAt: Number(zeile.updated_at) || 0, deleted: Boolean(zeile.deleted) };
}

/* Die Tabelle stammt aus einer früheren Fassung von wolke.sql. */
function fehltNeueFassung(text) {
  return /geaendert|karteikasten_schreiben|PGRST202|could not find the function/i.test(String(text || ""));
}
const NEUE_FASSUNG = "Dein Supabase-Projekt braucht die neue Fassung von wolke.sql. Öffne dort "
  + "den SQL Editor, füge den Inhalt der Datei wolke.sql ein und drücke Run. Deine Daten "
  + "bleiben dabei erhalten.";

function abgleichFehler(fehler) {
  const text = fehler?.message || String(fehler || "");
  return new Error(fehltNeueFassung(text) ? NEUE_FASSUNG : uebersetze(text));
}

/** Wie weit beim Schicken zurückgegriffen wird — gegen eine verstellte Geräteuhr. */
const SENDE_UEBERLAPPUNG = 10 * 60 * 1000;

/**
 * Ein vollständiger Abgleich in beide Richtungen.
 * `melde(text)` bekommt Zwischenstände für die Anzeige.
 *
 * Holen: alles, was seit dem letzten Mal beim Server angekommen ist (nach
 * seinem eigenen Stempel `geaendert`), mit etwas Überlappung. Übernommen wird
 * nur, was hier fehlt oder neuer ist.
 *
 * Schicken: alles, was sich hier seit dem letzten Schicken geändert hat. Der
 * Server nimmt eine Zeile nur an, wenn sie neuer ist als seine
 * (karteikasten_schreiben in wolke.sql) — ein Gerät mit altem Stand kann so
 * nichts Neueres überschreiben.
 */
export async function abgleichen(melde = () => {}) {
  const k = await verbinde();
  if (!k) throw new Error("Die Cloud ist nicht eingerichtet.");
  const { data: sitzungsDaten } = await k.auth.getSession();
  const sitz = sitzungsDaten?.session;
  if (!sitz) throw new Error("Nicht angemeldet.");
  const benutzer = sitz.user.id;

  const marke = Number(await db.getSetting("wolkeMarkeServer", 0)) || 0;
  let marke2 = marke;
  let geholt = 0, geschickt = 0;

  /* Was hier liegt, samt Grabsteinen — einmal gelesen statt je Zeile. */
  const hier = await db.lesenMehrere(db.SYNCED, { mitGeloeschten: true });
  const standHier = Object.fromEntries(Object.entries(hier)
    .map(([ablage, liste]) => [ablage, new Map(liste.map((r) => [r.id, r.updatedAt || 0]))]));

  /* --- Holen --- */
  melde("Hole Änderungen …");
  const seiten = 1000;
  const ab = Math.max(0, marke - UEBERLAPPUNG);
  for (let von = 0; ; von += seiten) {
    const { data, error } = await k.from(TABELLE)
      .select("*").gt("geaendert", ab)
      .order("geaendert", { ascending: true })
      .range(von, von + seiten - 1);
    if (error) throw abgleichFehler(error);
    if (!data || !data.length) break;

    const schreiben = {};
    for (const zeile of data) {
      const ablage = ZURUECK[zeile.art];
      if (!ablage) continue;
      if (!schreiben[ablage]) schreiben[ablage] = [];
      schreiben[ablage].push(nachInnen(zeile));
    }
    for (const [ablage, eintraege] of Object.entries(schreiben)) {
      const neue = zuUebernehmen(standHier[ablage] || new Map(), eintraege);
      schreiben[ablage] = neue;
      for (const e of neue) standHier[ablage]?.set(e.id, e.updatedAt);
      geholt += neue.length;
    }
    // Eine Seite in einem Zug: gelingt ganz oder gar nicht.
    await db.schreibeMehrere(schreiben);
    marke2 = neueMarke(marke2, data);
    if (data.length < seiten) break;
  }

  /* --- Schicken --- */
  melde("Schicke Änderungen …");
  const gesendet = Number(await db.getSetting("wolkeGesendet", 0)) || 0;
  /*
   * Der neue Stand wird **jetzt** genommen, nicht am Ende des Abgleichs:
   * Was der Nutzer währenddessen ändert, trägt einen späteren Zeitstempel und
   * geht beim nächsten Mal hinaus. Zurückgegriffen wird etwas weiter als
   * nötig, falls die Uhr des Geräts zwischendurch zurückgestellt wurde —
   * doppelt Geschicktes schadet nicht, der Server nimmt nur Neueres an.
   */
  const sendeStand = Date.now();
  const hinaus = [];
  const nachher = await db.lesenMehrere(db.SYNCED, { mitGeloeschten: true });
  for (const [ablage, liste] of Object.entries(nachher))
    for (const rec of liste)
      if ((rec.updatedAt || 0) > gesendet - SENDE_UEBERLAPPUNG) hinaus.push(nachAussen(ablage, rec));
  for (let i = 0; i < hinaus.length; i += 500) {
    const brocken = hinaus.slice(i, i + 500);
    const { error } = await k.rpc("karteikasten_schreiben", { zeilen: brocken });
    if (error) throw abgleichFehler(error);
    geschickt += brocken.length;
    melde("Schicke Änderungen … " + geschickt + "/" + hinaus.length);
  }

  /* --- Bilder und Aufnahmen --- */
  melde("Gleiche Bilder und Aufnahmen ab …");
  let medien = 0, medienFehler = "";
  try {
    medien = await medienAbgleichen(k, benutzer, melde);
  } catch (e) {
    medienFehler = String(e?.message || e);
  }

  const jetzt = Date.now();
  await db.setSetting("wolkeMarkeServer", marke2);
  await db.setSetting("wolkeGesendet", sendeStand);
  await db.setSetting("wolkeZuletzt", jetzt);

  return { geholt, geschickt, bilder: medien, medienFehler, zeit: jetzt };
}

/**
 * Bilder und Aufnahmen liegen nicht in der Tabelle, sondern im Dateispeicher
 * des Projekts. Was zu tun ist, rechnet medienPlan in core/abgleich.js aus.
 */
async function medienAbgleichen(k, benutzer, melde) {
  const { cards, drafts } = await db.lesenMehrere(["cards", "drafts"], { mitGeloeschten: true });
  const gebraucht = new Set();
  for (const karte of cards) {
    if (karte.termImage) gebraucht.add(karte.termImage);
    if (karte.defImage) gebraucht.add(karte.defImage);
    if (!karte.deleted) for (const seite of ["t", "d"]) gebraucht.add(tonSchluessel(karte.id, seite));
  }
  for (const e of drafts) if (e.termImage) gebraucht.add(e.termImage);
  const lokal = await db.all("media", { mitGeloeschten: true });

  const { data: liste, error } = await k.storage.from(EIMER).list(benutzer, { limit: 10000 });
  if (error) throw new Error(uebersetze(error.message));
  const plan = medienPlan({ lokal, droben: (liste || []).map((d) => d.name), gebraucht });

  let zahl = 0;
  const nachId = new Map(lokal.map((m) => [m.id, m]));
  for (const { id, name } of plan.hoch) {
    const blob = nachId.get(id)?.blob;
    if (!blob) continue;
    const { error: hochFehler } = await k.storage.from(EIMER)
      .upload(benutzer + "/" + name, blob, { upsert: true, contentType: blob.type });
    if (!hochFehler) { zahl++; melde("Lade hoch … " + zahl); }
  }
  for (const { id, name, stand } of plan.runter) {
    const { data: blob } = await k.storage.from(EIMER).download(benutzer + "/" + name);
    if (!blob) continue;
    const ton = tonTeile(id);
    await db.put("media", ton
      ? { id, blob, type: blob.type, ton: true, cardId: ton.cardId, seite: ton.seite,
        updatedAt: stand, deleted: false }
      : { id, blob, type: blob.type, updatedAt: Date.now() });
    zahl++; melde("Hole … " + zahl);
  }
  if (plan.weg.length)
    await k.storage.from(EIMER).remove(plan.weg.map((n) => benutzer + "/" + n));
  return zahl;
}

export async function letzterAbgleich() {
  return Number(await db.getSetting("wolkeZuletzt", 0)) || 0;
}

/** Setzt die Marken zurück — erzwingt beim nächsten Mal einen vollen Abgleich. */
export async function abgleichZuruecksetzen() {
  await db.setSetting("wolkeMarkeServer", 0);
  await db.setSetting("wolkeGesendet", 0);
}
