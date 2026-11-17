/*
 * Die Erinnerung über die App „Kurzbefehle“ auf dem iPhone.
 *
 * Push über GitHub kommt nicht pünktlich: GitHub lässt Zeitpläne kostenloser
 * Projekte nur alle paar Stunden laufen — gemessen im November 2026 etwa
 * alle acht. Das iPhone kann es selbst: Eine Automation in „Kurzbefehle“
 * läuft auf die Minute genau, auch wenn Anchor geschlossen ist. Sie ruft
 * eine Adresse ab und zeigt die Antwort als Mitteilung.
 *
 * Die Adresse führt zur Funktion `anchor_heute` (wolke.sql, Fassung 6). Darin
 * steht ein Schlüssel, den die App hier erzeugt; in der Wolke liegt nur sein
 * Fingerabdruck. Wer die Adresse hat, erfährt nur, wie viele Karten heute
 * fällig sind — nichts über ihren Inhalt.
 */

import * as db from "./db.js";
import { verbinde, zugangLesen, normalisiereUrl, saeubereSchluessel } from "./cloud.js";
import { base64url, sha256hex, zeitzone } from "./push.js";

const ABLAGE = "kurzbefehl";

const NEUE_FASSUNG = "Dafür braucht dein Supabase-Projekt die neue Fassung von wolke.sql "
  + "(Fassung 6). Öffne dort den SQL Editor, füge den ganzen Inhalt der Datei ein und drücke Run.";

const fehltFassung = (text) => /anchor_kurzbefehl|anchor_heute|schema cache|PGRST20[25]|does not exist/i
  .test(String(text || ""));

/** Die Adresse aus Projekt, öffentlichem Schlüssel und Kurzbefehl-Schlüssel. */
export function adresseBauen({ url, key }, schluessel) {
  return normalisiereUrl(url).replace(/\/+$/, "") + "/rest/v1/rpc/anchor_heute"
    + "?schluessel=" + encodeURIComponent(schluessel)
    + "&apikey=" + encodeURIComponent(saeubereSchluessel(key));
}

/** Die zuletzt erzeugte Adresse auf diesem Gerät, oder "". */
export async function adresseLesen() {
  return (await db.getSetting(ABLAGE, null))?.adresse || "";
}

/**
 * Erzeugt einen neuen Schlüssel und die Adresse dazu. Eine ältere Adresse
 * wird damit ungültig — ein Kurzbefehl, der sie noch enthält, bekommt
 * keine Antwort mehr.
 */
export async function einrichten() {
  const k = await verbinde();
  if (!k) throw new Error("Dafür muss die Cloud eingerichtet sein.");
  const { data } = await k.auth.getSession();
  const uid = data?.session?.user?.id;
  if (!uid) throw new Error("Dafür musst du in der Cloud angemeldet sein.");

  const schluessel = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const { error } = await k.from("anchor_kurzbefehl").upsert({
    user_id: uid, schluessel_hash: await sha256hex(schluessel), zeitzone: zeitzone(),
    geaendert: new Date().toISOString(),
  });
  if (error) throw new Error(fehltFassung(error.message) ? NEUE_FASSUNG : error.message);

  const adresse = adresseBauen(await zugangLesen(), schluessel);
  await db.setSetting(ABLAGE, { adresse });
  return adresse;
}

async function abrufen(adresse, kopf) {
  try {
    return await fetch(adresse, { cache: "no-store", headers: kopf || {} });
  } catch (f) {
    throw new Error("Keine Verbindung zu Supabase. Ist das Projekt pausiert?");
  }
}

/**
 * Ruft die Adresse ab wie der Kurzbefehl: ohne Anmeldung.
 *
 * Zurück kommt die Antwort ({ anzahl, text, tag }) und der Weg: "adresse",
 * wenn die Adresse allein genügt, "kopf", wenn Supabase den öffentlichen
 * Schlüssel nur als Kopfzeile annimmt — dann braucht der Kurzbefehl einen
 * Handgriff mehr. Geht beides nicht, eine Meldung, die sagt, was fehlt.
 */
export async function pruefen(adresse) {
  let weg = "adresse";
  let antwort = await abrufen(adresse);
  if (antwort.status === 401) {
    const apikey = new URL(adresse).searchParams.get("apikey");
    const ohne = adresse.replace(/&apikey=[^&]*/, "");
    antwort = await abrufen(ohne, { apikey });
    weg = "kopf";
  }
  const text = await antwort.text();
  if (!antwort.ok) {
    if (fehltFassung(text) || antwort.status === 404) throw new Error(NEUE_FASSUNG);
    throw new Error("Supabase antwortet mit " + antwort.status + ".");
  }
  const ergebnis = text ? JSON.parse(text) : null;
  if (!ergebnis) throw new Error("Der Schlüssel ist nicht mehr gültig. Erzeuge eine neue Adresse.");
  return { ergebnis, weg };
}

/** Die Adresse ohne den öffentlichen Schlüssel — für den Weg mit Kopfzeile. */
export const ohneApikey = (adresse) => adresse.replace(/&apikey=[^&]*/, "");
export const apikeyAus = (adresse) => new URL(adresse).searchParams.get("apikey") || "";
