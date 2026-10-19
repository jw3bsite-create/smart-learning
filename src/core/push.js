/*
 * Push-Nachrichten im Browser: einrichten, Gerät an- und abmelden, die
 * Vorschau der fälligen Karten in die Wolke schreiben.
 *
 * Wie das Ganze zusammenhängt, steht in pushplan.js. Hier nur der Teil, der
 * im Browser läuft. Alles geht über die Anmeldung bei der eigenen Wolke und
 * die Zeilenregeln — gelesen und geschrieben wird nur, was der eigenen
 * Kennung gehört.
 */

import { verbinde } from "./cloud.js";
import { geheimnisZusammensetzen } from "./pushplan.js";

/* ------------------------------- Werkzeug ------------------------------- */

function base64url(bytes) {
  let s = "";
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function ausBase64url(text) {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4);
  const roh = atob(b64);
  return Uint8Array.from(roh, (c) => c.charCodeAt(0));
}

async function sha256hex(text) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* Fehlt die Tabelle, wurde wolke.sql in Fassung 4 noch nicht ausgeführt. */
const NEUE_FASSUNG = "Dafür braucht dein Supabase-Projekt die neue Fassung von wolke.sql "
  + "(Fassung 4). Öffne dort den SQL Editor, füge den Inhalt ein und drücke Run.";

function fehler(f) {
  const text = f?.message || String(f || "");
  if (/anchor_push|anchor_lage|schema cache|PGRST20[25]|does not exist/i.test(text))
    return new Error(NEUE_FASSUNG);
  return new Error(text);
}

/* Verbindung und eigene Kennung. Die Kennung steht in jeder geschriebenen
   Zeile ausdrücklich — sonst träfe das Überschreiben vorhandener Zeilen
   nicht sicher den Schlüssel. */
async function klient() {
  const k = await verbinde();
  if (!k) throw new Error("Dafür muss die Cloud eingerichtet sein.");
  const { data } = await k.auth.getSession();
  const uid = data?.session?.user?.id;
  if (!uid) throw new Error("Dafür musst du in der Cloud angemeldet sein.");
  return { k, uid };
}

/* ----------------------------- Unterstützung ---------------------------- */

/** Kann dieser Browser Push überhaupt? */
export function unterstuetzt() {
  return typeof window !== "undefined" && "serviceWorker" in navigator
    && "PushManager" in window && typeof Notification !== "undefined";
}

export function zeitzone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Berlin"; }
  catch (e) { return "Europe/Berlin"; }
}

/* ------------------------------ Einrichten ------------------------------ */

/** Der eingerichtete Zugang der eigenen Kennung, oder null. */
export async function zugangLesen() {
  const { k } = await klient();
  const { data, error } = await k.from("anchor_push_zugang").select("oeffentlich").maybeSingle();
  if (error) throw fehler(error);
  return data || null;
}

/**
 * Erzeugt ein neues Schlüsselpaar und ein neues Geheimnis.
 *
 * Zurück kommt die Zeichenkette für das GitHub-Secret. Sie wird nirgends
 * gespeichert — in der Wolke liegt nur ihr Fingerabdruck und der
 * öffentliche Schlüssel. Wer neu einrichtet, macht alle bisherigen
 * Abonnements wertlos; sie werden darum gleich mit entfernt.
 */
export async function einrichten() {
  const { k, uid } = await klient();
  const paar = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true,
    ["sign", "verify"]);
  const oeffentlich = base64url(await crypto.subtle.exportKey("raw", paar.publicKey));
  const privat = (await crypto.subtle.exportKey("jwk", paar.privateKey)).d;
  const token = base64url(crypto.getRandomValues(new Uint8Array(32)));

  const { error: weg } = await k.from("anchor_push_abo").delete().neq("endpoint", "");
  if (weg) throw fehler(weg);
  const { error } = await k.from("anchor_push_zugang").upsert({
    user_id: uid, oeffentlich, geheimnis_hash: await sha256hex(token), geaendert: new Date().toISOString(),
  });
  if (error) throw fehler(error);
  return { geheimnis: geheimnisZusammensetzen({ token, oeffentlich, privat }), oeffentlich };
}

/* ------------------------------- Das Gerät ------------------------------ */

/*
 * Ohne Dienst-Arbeiter kein Push. Den gibt es nur in der veröffentlichten
 * Fassung — nicht, wenn Anchor am Rechner über „Anchor starten“ von
 * localhost läuft. Das ist kein Fehler: Dort braucht man keine
 * Handy-Erinnerung, und einrichten lässt sie sich trotzdem.
 */
export function laeuftLokal() {
  return typeof location !== "undefined"
    && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
}

/** Kann sich dieses Gerät anmelden? */
export async function geraetMoeglich() {
  if (!unterstuetzt() || laeuftLokal()) return false;
  return Boolean(await navigator.serviceWorker.getRegistration());
}

async function registrierung() {
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) {
    throw new Error(laeuftLokal()
      ? "Am Rechner läuft Anchor über localhost, dort gibt es keine Push-Nachrichten. "
        + "Einschalten kannst du sie auf dem Handy."
      : "Die App ist noch nicht fertig installiert. Lade einmal neu.");
  }
  return reg;
}

/*
 * Die Erlaubnis. Ist sie schon erteilt, wird nicht noch einmal gefragt —
 * Safari antwortet sonst unter Umständen mit „nein“, weil der Tipp nicht
 * mehr frisch genug ist. In der Meldung steht, was das Gerät geantwortet
 * hat; das hilft beim Suchen.
 */
export async function erlaubnisSichern() {
  if (typeof Notification === "undefined")
    throw new Error("Dieser Browser kennt keine Benachrichtigungen.");
  const antwort = Notification.permission === "granted"
    ? "granted" : await Notification.requestPermission();
  if (antwort !== "granted") {
    throw new Error("Benachrichtigungen sind nicht erlaubt (Antwort des Geräts: "
      + (antwort === "denied" ? "abgelehnt" : "nicht entschieden") + "). Auf dem iPhone: "
      + "Einstellungen → Mitteilungen → Anchor. Hilft das nicht, nimm den Schalter "
      + "„Auf diesem Gerät“ hier noch einmal — ohne vorher etwas anderes anzutippen.");
  }
}

/** Ist dieses Gerät angemeldet? Zurück kommt das Abonnement oder null. */
export async function geraetStand() {
  if (!unterstuetzt()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) || null;
}

/**
 * Meldet dieses Gerät an. Muss aus einem Klick heraus kommen — sonst fragt
 * Safari gar nicht erst nach der Erlaubnis.
 */
export async function geraetAnmelden({ oeffentlich, stunde }) {
  if (!unterstuetzt()) throw new Error("Dieser Browser kann keine Push-Nachrichten empfangen.");
  const reg = await registrierung();
  await erlaubnisSichern();
  let abo = await reg.pushManager.getSubscription();
  // Ein Abonnement mit einem alten Schlüssel nimmt kein Push-Dienst mehr an.
  const passt = abo && abo.options?.applicationServerKey
    && base64url(abo.options.applicationServerKey) === oeffentlich;
  if (abo && !passt) { await abo.unsubscribe().catch(() => {}); abo = null; }
  if (!abo) {
    abo = await reg.pushManager.subscribe({
      userVisibleOnly: true, applicationServerKey: ausBase64url(oeffentlich),
    });
  }
  const { k, uid } = await klient();
  const json = abo.toJSON();
  const { error } = await k.from("anchor_push_abo").upsert({
    user_id: uid, endpoint: json.endpoint, abo: json, stunde: Number(stunde) || 17,
    zeitzone: zeitzone(), geaendert: new Date().toISOString(),
  });
  if (error) throw fehler(error);
  return abo;
}

export async function geraetAbmelden() {
  const abo = await geraetStand();
  if (!abo) return;
  const endpoint = abo.endpoint;
  await abo.unsubscribe().catch(() => {});
  try {
    const { k } = await klient();
    await k.from("anchor_push_abo").delete().eq("endpoint", endpoint);
  } catch (e) { /* ohne Anschluss bleibt die Zeile; der Absender räumt sie ab */ }
}

/** Die Stunde dieses Geräts ändern. */
export async function stundeSetzen(stunde) {
  const abo = await geraetStand();
  if (!abo) return;
  const { k } = await klient();
  const { error } = await k.from("anchor_push_abo")
    .update({ stunde: Number(stunde) || 17, zeitzone: zeitzone(), geaendert: new Date().toISOString() })
    .eq("endpoint", abo.endpoint);
  if (error) throw fehler(error);
}

/* ------------------------------ Die Vorschau ---------------------------- */

/*
 * Nach jedem Abgleich, von jedem Gerät — auch vom Rechner ohne eigenes
 * Abonnement. Wer am Rechner gelernt hat, soll abends auf dem Handy keine
 * Nachricht über Karten bekommen, die längst erledigt sind.
 *
 * Gibt es die Tabelle nicht (alte wolke.sql), bleibt es für diese Sitzung
 * still; das ist kein Fehler des Abgleichs.
 */
let zuletztGeschrieben = "";
let gibtEsNicht = false;

export async function lageSchreiben(plan) {
  if (gibtEsNicht) return;
  const text = JSON.stringify(plan);
  if (text === zuletztGeschrieben) return;
  const k = await verbinde();
  if (!k) return;
  const { data } = await k.auth.getSession();
  const uid = data?.session?.user?.id;
  if (!uid) return;
  const { error } = await k.from("anchor_lage")
    .upsert({ user_id: uid, plan, geaendert: new Date().toISOString() });
  if (error) {
    if (/anchor_lage|schema cache|PGRST20[25]|does not exist/i.test(error.message || "")) gibtEsNicht = true;
    return;
  }
  zuletztGeschrieben = text;
}
