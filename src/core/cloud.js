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
import { bildBlob, bildAblegen } from "./media.js";

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

export async function abmelden() {
  const k = await verbinde();
  if (k) await k.auth.signOut();
}

function uebersetze(text) {
  const t = String(text || "");
  if (/invalid login/i.test(t)) return "Kennung oder Passwort stimmen nicht.";
  if (/email not confirmed/i.test(t))
    return "Die Kennung ist noch nicht bestätigt. Supabase verschickt in der "
      + "kostenlosen Fassung nur wenige Mails am Tag, oft kommt keine an. Du "
      + "kannst die Bestätigung im eigenen Projekt abschalten: Authentication "
      + "→ Sign In / Providers → Email → Confirm email abschalten.";
  if (/already registered/i.test(t)) return "Diese Kennung gibt es bereits.";
  if (/password/i.test(t) && /least/i.test(t)) return "Das Passwort ist zu kurz (mindestens sechs Zeichen).";
  if (/failed to fetch/i.test(t)) return "Kein Anschluss — Adresse falsch oder keine Verbindung.";
  return t;
}

/* ------------------------------- Abgleich ------------------------------ */

function nachAussen(ablage, rec, benutzer) {
  const { id, updatedAt, deleted, ...rest } = rec;
  return {
    id, user_id: benutzer, art: ARTEN[ablage],
    daten: rest, updated_at: updatedAt || Date.now(), deleted: Boolean(deleted),
  };
}

function nachInnen(zeile) {
  return { id: zeile.id, ...(zeile.daten || {}),
    updatedAt: Number(zeile.updated_at) || 0, deleted: Boolean(zeile.deleted) };
}

/**
 * Ein vollständiger Abgleich in beide Richtungen.
 * `melde(text)` bekommt Zwischenstände für die Anzeige.
 */
export async function abgleichen(melde = () => {}) {
  const k = await verbinde();
  if (!k) throw new Error("Die Wolke ist nicht eingerichtet.");
  const { data: sitzungsDaten } = await k.auth.getSession();
  const sitz = sitzungsDaten?.session;
  if (!sitz) throw new Error("Nicht angemeldet.");
  const benutzer = sitz.user.id;

  const marke = Number(await db.getSetting("wolkeMarke", 0)) || 0;
  let neueMarke = marke;
  let geholt = 0, geschickt = 0;

  /* --- Holen --- */
  melde("Hole Änderungen …");
  const seiten = 1000;
  for (let von = 0; ; von += seiten) {
    const { data, error } = await k.from(TABELLE)
      .select("*").gt("updated_at", marke)
      .order("updated_at", { ascending: true })
      .range(von, von + seiten - 1);
    if (error) throw new Error(uebersetze(error.message));
    if (!data || !data.length) break;

    for (const zeile of data) {
      const ablage = ZURUECK[zeile.art];
      if (!ablage) continue;
      const fremd = nachInnen(zeile);
      const eigen = await db.get(ablage, fremd.id);
      if (!eigen || (eigen.updatedAt || 0) < fremd.updatedAt) {
        await db.put(ablage, fremd);
        geholt++;
      }
      neueMarke = Math.max(neueMarke, fremd.updatedAt);
    }
    if (data.length < seiten) break;
  }

  /* --- Schicken --- */
  melde("Schicke Änderungen …");
  const gesendet = Number(await db.getSetting("wolkeGesendet", 0)) || 0;
  const hinaus = [];
  for (const ablage of db.SYNCED) {
    const alle = await db.all(ablage, { mitGeloeschten: true });
    for (const rec of alle)
      if ((rec.updatedAt || 0) > gesendet) hinaus.push(nachAussen(ablage, rec, benutzer));
  }
  for (let i = 0; i < hinaus.length; i += 500) {
    const brocken = hinaus.slice(i, i + 500);
    const { error } = await k.from(TABELLE).upsert(brocken, { onConflict: "user_id,id" });
    if (error) throw new Error(uebersetze(error.message));
    geschickt += brocken.length;
    melde(`Schicke Änderungen … ${geschickt}/${hinaus.length}`);
  }

  /* --- Bilder --- */
  melde("Gleiche Bilder ab …");
  const bilderZahl = await bilderAbgleichen(k, benutzer, melde).catch(() => 0);

  const jetzt = Date.now();
  await db.setSetting("wolkeMarke", Math.max(neueMarke, marke));
  await db.setSetting("wolkeGesendet", jetzt);
  await db.setSetting("wolkeZuletzt", jetzt);

  return { geholt, geschickt, bilder: bilderZahl, zeit: jetzt };
}

/**
 * Bilder liegen nicht in der Tabelle, sondern im Dateispeicher des Projekts.
 * Hochgeladen wird, was hier ist und dort fehlt; geholt, was Karten
 * verlangen und hier fehlt.
 */
async function bilderAbgleichen(k, benutzer, melde) {
  const karten = await db.all("cards", { mitGeloeschten: true });
  const gebraucht = new Set();
  for (const karte of karten) {
    if (karte.termImage) gebraucht.add(karte.termImage);
    if (karte.defImage) gebraucht.add(karte.defImage);
  }
  const eigene = new Set((await db.all("media", { mitGeloeschten: true })).map((b) => b.id));

  const { data: liste, error } = await k.storage.from(EIMER)
    .list(benutzer, { limit: 10000 });
  if (error) return 0;
  const droben = new Set((liste || []).map((d) => d.name));

  let zahl = 0;
  // Hochladen, was fehlt.
  for (const kennung of gebraucht) {
    if (!eigene.has(kennung) || droben.has(kennung)) continue;
    const blob = await bildBlob(kennung);
    if (!blob) continue;
    const { error: hochFehler } = await k.storage.from(EIMER)
      .upload(`${benutzer}/${kennung}`, blob, { upsert: true, contentType: blob.type });
    if (!hochFehler) { zahl++; melde(`Lade Bilder hoch … ${zahl}`); }
  }
  // Herunterladen, was hier fehlt.
  for (const kennung of gebraucht) {
    if (eigene.has(kennung) || !droben.has(kennung)) continue;
    const { data: blob } = await k.storage.from(EIMER).download(`${benutzer}/${kennung}`);
    if (blob) { await bildAblegen(kennung, blob); zahl++; melde(`Hole Bilder … ${zahl}`); }
  }
  return zahl;
}

export async function letzterAbgleich() {
  return Number(await db.getSetting("wolkeZuletzt", 0)) || 0;
}

/** Setzt die Wasserzeichen zurück — erzwingt beim nächsten Mal einen vollen Abgleich. */
export async function abgleichZuruecksetzen() {
  await db.setSetting("wolkeMarke", 0);
  await db.setSetting("wolkeGesendet", 0);
}
