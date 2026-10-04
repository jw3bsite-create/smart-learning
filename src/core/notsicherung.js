/*
 * Die Notsicherung: alles aus der Datenbank in eine Datei, ohne Umweg.
 *
 * Gebraucht, wenn die App selbst nicht mehr steht — ein Absturz der Anzeige
 * oder ein Laden, das scheitert. Darum liest sie unmittelbar aus der
 * Datenbank und nicht aus dem Bestand der App; der könnte gerade der sein,
 * der nicht funktioniert. Bilder bleiben außen vor, damit die Datei auch
 * dann entsteht, wenn der Speicher knapp ist.
 */

import * as db from "./db.js";
import { FASSUNG } from "./sicherung.js";
import { herunterladen } from "./datei.js";

export async function notsicherungHerunterladen() {
  const daten = { fassung: FASSUNG, erzeugt: Date.now(), notsicherung: true, ohneMedien: true };
  for (const [ablage, feld] of Object.entries(db.SICHERUNG_FELDER)) {
    try { daten[feld] = await db.all(ablage, { mitGeloeschten: true }); }
    catch (e) { daten[feld] = []; }
  }
  try { daten.einstellungen = await db.getSetting("einstellungen", null); } catch (e) { /* ohne */ }
  const name = "deep-dive-notsicherung-"
    + new Date().toISOString().slice(0, 16).replace(":", "") + ".json";
  herunterladen(name, JSON.stringify(daten), "application/json");
}
