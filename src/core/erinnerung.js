/*
 * Die Erinnerung.
 *
 * Eine Nachricht zu jeder eingestellten Uhrzeit, mit einer Zahl darin. Keine Drohung, keine
 * Flammensymbole, kein „Deine Strähne ist in Gefahr!" — genau diese Art von
 * Nachricht erzeugt die Minimalsitzung um 23:50 Uhr, die niemandem nützt.
 *
 * Technisch bescheiden und mit Absicht: Die App kann nur benachrichtigen,
 * solange sie in irgendeinem Fenster offen ist (ohne eigenen Server gibt es
 * keine echten Push-Nachrichten). Wer sie als App auf dem Handy hat und
 * morgens öffnet, bekommt die Nachricht dann.
 */

import * as db from "./db.js";
import { letzterTermin, schonGesendet } from "./pushplan.js";

const SCHLUESSEL = "erinnerung";

export const STANDARD = {
  an: false,
  stunde: 17,          // die eine Stunde von früher; gilt, solange kein Zeitplan da ist
  zeitplan: null,      // Uhrzeiten je Wochentag, siehe pushplan.js
  zuletzt: "",         // Tag und Uhrzeit der letzten Nachricht („JJJJ-MM-TT HH:MM“)
  push: false,         // dieses Gerät bekommt sie als Push (siehe push.js)
};

export async function einstellungLesen() {
  return { ...STANDARD, ...((await db.getSetting(SCHLUESSEL, null)) || {}) };
}

export async function einstellungSchreiben(neu) {
  await db.setSetting(SCHLUESSEL, { ...STANDARD, ...neu });
}

function ortsZeitzone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Berlin"; }
  catch (f) { return "Europe/Berlin"; }
}

export function erlaubnisStand() {
  if (typeof Notification === "undefined") return "geht nicht";
  return Notification.permission;   // default | granted | denied
}

/*
 * Eine Nachricht zeigen.
 *
 * `new Notification(...)` ist auf Telefonen verboten: Chrome auf Android
 * wirft „Illegal constructor", Safari auf dem iPhone kennt den Weg in einer
 * installierten App gar nicht. Dort geht es nur über den Dienst-Arbeiter.
 * Der Fehler wurde bisher verschluckt — auf dem Handy kam darum nie etwas,
 * auch nicht bei geöffneter App. Der alte Weg bleibt als Rückfall für
 * Browser ohne Dienst-Arbeiter.
 */
export async function zeigen(titel, optionen) {
  const reg = typeof navigator !== "undefined" && navigator.serviceWorker
    ? await navigator.serviceWorker.getRegistration().catch(() => null) : null;
  if (reg && typeof reg.showNotification === "function") {
    await reg.showNotification(titel, optionen);
    return;
  }
  new Notification(titel, optionen);
}

/** Läuft Anchor als installierte App (vom Startbildschirm)? */
export function alsAppGeoeffnet() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches
    || window.navigator.standalone === true;
}

/** Ein iPhone oder iPad, egal welcher Browser. */
export function istApple() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** Eine Probe, damit man sofort sieht, ob Nachrichten ankommen. */
export async function probe() {
  const erlaubnis = await erlaubnisHolen();
  if (erlaubnis !== "granted") return erlaubnis;
  await zeigen("Anchor", {
    body: "So sieht die Tageserinnerung aus.",
    tag: "karteikasten-probe", icon: "./symbol-192.png", badge: "./symbol-192.png",
  });
  return "gezeigt";
}

export async function erlaubnisHolen() {
  if (typeof Notification === "undefined") return "geht nicht";
  if (Notification.permission !== "default") return Notification.permission;
  return Notification.requestPermission();
}

/**
 * Prüft, ob die letzte eingestellte Uhrzeit schon erinnert hat, und
 * benachrichtigt gegebenenfalls. Wird beim Start und danach alle paar
 * Minuten aufgerufen. Dieselbe Rechnung wie beim Absender (pushplan.js).
 */
export async function vielleichtErinnern({ faellig, text }) {
  const e = await einstellungLesen();
  if (!e.an || erlaubnisStand() !== "granted") return false;
  if (e.push) return false;                            // kommt schon als Push

  const t = letzterTermin({ zeitplan: e.zeitplan, stunde: e.stunde, zeitzone: ortsZeitzone() });
  if (!t.termin) return false;                         // heute noch keine Uhrzeit erreicht
  if (schonGesendet(e.zuletzt, t)) return false;      // für diese schon geschehen
  if (!faellig) return false;                          // nichts zu melden

  try {
    await zeigen("Anchor", {
      body: text,
      tag: "karteikasten-tag",                         // ersetzt die vorige
      silent: true,
      icon: "./symbol-192.png",
      badge: "./symbol-192.png",
    });
    await einstellungSchreiben({ ...e, zuletzt: t.termin });
    return true;
  } catch (fehler) {
    return false;
  }
}
