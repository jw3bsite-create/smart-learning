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

/** Ablage im Browser ↔ Art in der Tabelle. */
const ARTEN = {
  folders: "ordner",
  sets: "stapel",
  cards: "karte",
  progress: "stand",
};
const ZURUECK = Object.fromEntries(Object.entries(ARTEN).map(([a, b]) => [b, a]));

let klient = null;
let klientSchluessel = "";

export async function zugangLesen() {
  return (await db.getSetting("wolke", null)) || { url: "", key: "" };
}

export async function zugangSchreiben(zugang) {
  await db.setSetting("wolke", zugang);
  klient = null; klientSchluessel = "";
}

export const eingerichtet = (zugang) => Boolean(zugang && zugang.url && zugang.key);

/** Verbindung herstellen (oder die bestehende weiterverwenden). */
export async function verbinde() {
  const zugang = await zugangLesen();
  if (!eingerichtet(zugang)) return null;
  const kennzeichen = zugang.url + "|" + zugang.key;
  if (klient && klientSchluessel === kennzeichen) return klient;
  const { createClient } = await import("@supabase/supabase-js");
  klient = createClient(zugang.url.replace(/\/+$/, ""), zugang.key, {
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
  const { data, error } = await k.auth.signUp({ email: kennung, password: passwort });
  if (error) throw new Error(uebersetze(error.message));
  return data.session;
}

export async function abmelden() {
  const k = await verbinde();
  if (k) await k.auth.signOut();
}

function uebersetze(text) {
  const t = String(text || "");
  if (/invalid login/i.test(t)) return "Kennung oder Passwort stimmen nicht.";
  if (/email not confirmed/i.test(t)) return "Die Kennung ist noch nicht bestätigt — sieh in dein Postfach.";
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
