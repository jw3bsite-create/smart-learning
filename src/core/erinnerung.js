/*
 * Die Tagesbenachrichtigung.
 *
 * Eine Nachricht am Tag, mit einer Zahl darin. Keine Drohung, keine
 * Flammensymbole, kein „Deine Strähne ist in Gefahr!" — genau diese Art von
 * Nachricht erzeugt die Minimalsitzung um 23:50 Uhr, die niemandem nützt.
 *
 * Technisch bescheiden und mit Absicht: Die App kann nur benachrichtigen,
 * solange sie in irgendeinem Fenster offen ist (ohne eigenen Server gibt es
 * keine echten Push-Nachrichten). Wer sie als App auf dem Handy hat und
 * morgens öffnet, bekommt die Nachricht dann.
 */

import * as db from "./db.js";
import { tagesSchluessel } from "./util.js";

const SCHLUESSEL = "erinnerung";

export const STANDARD = {
  an: false,
  stunde: 17,          // Tageszeit, zu der erinnert wird
  zuletzt: "",         // Tagesschlüssel der letzten Nachricht
};

export async function einstellungLesen() {
  return { ...STANDARD, ...((await db.getSetting(SCHLUESSEL, null)) || {}) };
}

export async function einstellungSchreiben(neu) {
  await db.setSetting(SCHLUESSEL, { ...STANDARD, ...neu });
}

export function erlaubnisStand() {
  if (typeof Notification === "undefined") return "geht nicht";
  return Notification.permission;   // default | granted | denied
}

export async function erlaubnisHolen() {
  if (typeof Notification === "undefined") return "geht nicht";
  if (Notification.permission !== "default") return Notification.permission;
  return Notification.requestPermission();
}

/**
 * Prüft, ob heute schon erinnert wurde, und benachrichtigt gegebenenfalls.
 * Wird beim Start und danach stündlich aufgerufen.
 */
export async function vielleichtErinnern({ faellig, text }) {
  const e = await einstellungLesen();
  if (!e.an || erlaubnisStand() !== "granted") return false;

  const heute = tagesSchluessel();
  if (e.zuletzt === heute) return false;              // heute schon geschehen
  if (new Date().getHours() < Number(e.stunde)) return false;
  if (!faellig) return false;                          // nichts zu melden

  try {
    new Notification("Karteikasten", {
      body: text,
      tag: "karteikasten-tag",                         // ersetzt die vorige
      silent: true,
    });
    await einstellungSchreiben({ ...e, zuletzt: heute });
    return true;
  } catch (fehler) {
    return false;
  }
}
