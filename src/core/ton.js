/*
 * Die eigene Stimme: Lösungen selbst einsprechen.
 *
 * Warum überhaupt? Selbst aussprechen und sich dann selbst hören prägt
 * stärker ein als bloßes Zuhören — das Sprechen erzeugt eine eigene Spur
 * (Produktionseffekt), und die eigene Stimme ist beim Wiedererkennen
 * besonders auffällig.
 *
 * Wichtig ist die Reihenfolge, und nur die ist hier festgelegt: Aufgenommen
 * wird erst, wenn die Lösung schon offenliegt. Vor dem Abrufen vorgesprochen
 * wäre es Vorsagen, und der Nutzen des Abrufens wäre weg.
 *
 * Abgelegt wird in derselben Ablage wie Bilder (`media`) — damit nimmt eine
 * Aufnahme den vorhandenen Weg in die Wolke, ohne dass dafür etwas Neues
 * gebaut werden muss.
 */

import * as db from "./db.js";

/** Länger als das ist keine Lösung, sondern ein Vortrag. */
export const HOECHSTDAUER = 90;

/** Datenrate der Aufnahme: genug für Sprache, wenig für den Abgleich. */
export const BITRATE = 32000;

/*
 * Die Reihenfolge ist Absicht: Opus in WebM ist klein und überall dort zu
 * haben, wo es geht; Safari auf iPhone und iPad kennt nur MP4. Ohne diesen
 * Rückfall nimmt das Schul-iPad gar nichts auf.
 */
export const TYPEN = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/aac",
  "audio/ogg;codecs=opus",
];

export function waehleTyp(kandidaten = TYPEN, kann) {
  const pruefe = kann || ((t) => typeof MediaRecorder !== "undefined"
    && MediaRecorder.isTypeSupported?.(t));
  for (const t of kandidaten) if (pruefe(t)) return t;
  return "";        // leer heißt: der Browser soll selbst entscheiden
}

export const tonMoeglich = () => typeof MediaRecorder !== "undefined"
  && typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

/* ===================================================================== */
/*  Kennungen                                                            */
/* ===================================================================== */

/*
 * Die Kennung wird aus Karte und Seite gebildet, nicht zufällig gezogen.
 *
 * Zwei Gründe: Ein zweites Gerät findet die Aufnahme, ohne dass die Karte
 * dafür ein zusätzliches Feld braucht — und der Abgleich überträgt nur die
 * Datei selbst, keine Zusatzangaben. Stünde die Zuordnung nur daneben, wäre
 * sie nach dem Abgleich verloren und die Aufnahme würde als verwaist
 * fortgeräumt.
 */
export const VORSATZ = "ton_";

export function tonSchluessel(cardId, seite) {
  return VORSATZ + cardId + "_" + seite;
}

/** Zerlegt eine Tonkennung wieder — oder gibt null für alles andere. */
export function tonTeile(kennung) {
  const text = String(kennung || "");
  if (!text.startsWith(VORSATZ)) return null;
  const rest = text.slice(VORSATZ.length);
  const schnitt = rest.lastIndexOf("_");
  if (schnitt < 1) return null;
  return { cardId: rest.slice(0, schnitt), seite: rest.slice(schnitt + 1) };
}

export const istTon = (kennung) => tonTeile(kennung) !== null;

/**
 * Welche Kartenseite ist Frage, welche Lösung?
 *
 * `t` ist der Begriff (die Vorderseite), `d` die Erklärung. Bei der Richtung
 * „dt" wird umgekehrt gefragt — die Aufnahme gehört trotzdem zur Seite, die
 * gesprochen wird, nicht zur Richtung. Sonst lägen für dieselben Worte zwei
 * Aufnahmen.
 */
export function seitenFuerRichtung(richtung) {
  return richtung === "dt" ? { frage: "d", loesung: "t" } : { frage: "t", loesung: "d" };
}

/* ===================================================================== */
/*  Aufnehmen                                                            */
/* ===================================================================== */

/**
 * Ein Tonband. Aufnahme starten, Aufnahme beenden, Blob bekommen.
 *
 * Der Mikrofonzugriff wird erst beim Start erbeten — ungefragt beim Laden der
 * Seite danach zu fragen, wäre zudringlich und würde im Browser ohnehin
 * abgelehnt.
 */
export class Tonband {
  constructor({ hoechstdauer = HOECHSTDAUER } = {}) {
    this.hoechstdauer = hoechstdauer;
    this.aufnehmer = null;
    this.spur = null;
    this.stuecke = [];
    this.beginn = 0;
  }

  get laeuft() { return this.aufnehmer?.state === "recording"; }

  async start() {
    if (this.laeuft) return;
    this.spur = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    /*
     * 32 kbit/s reichen für Sprache reichlich; ohne Angabe nimmt der Browser
     * ein Mehrfaches davon. Das ist keine Kosmetik: Jede Aufnahme wandert
     * über die Wolke auf Handy und iPad, und hundert gesprochene Lösungen in
     * Musikqualität wären Hunderte Megabyte.
     */
    const typ = waehleTyp();
    this.aufnehmer = new MediaRecorder(this.spur, {
      ...(typ ? { mimeType: typ } : {}),
      audioBitsPerSecond: BITRATE,
    });
    this.stuecke = [];
    this.aufnehmer.ondataavailable = (e) => { if (e.data?.size) this.stuecke.push(e.data); };
    this.aufnehmer.start();
    this.beginn = Date.now();
  }

  /** Beendet die Aufnahme. → { blob, sekunden } oder null, wenn nichts kam. */
  async stop() {
    const aufnehmer = this.aufnehmer;
    if (!aufnehmer) return null;
    const sekunden = Math.max(1, Math.round((Date.now() - this.beginn) / 1000));
    const fertig = new Promise((los) => { aufnehmer.onstop = () => los(); });
    if (aufnehmer.state !== "inactive") aufnehmer.stop();
    await fertig;
    this.aufraeumen();
    if (!this.stuecke.length) return null;
    const blob = new Blob(this.stuecke, { type: aufnehmer.mimeType || "audio/webm" });
    this.stuecke = [];
    return { blob, sekunden };
  }

  /** Bricht ab, ohne etwas zurückzugeben — und gibt das Mikrofon frei. */
  abbrechen() {
    try { if (this.aufnehmer?.state !== "inactive") this.aufnehmer?.stop(); } catch (e) { /* egal */ }
    this.stuecke = [];
    this.aufraeumen();
  }

  aufraeumen() {
    for (const s of this.spur?.getTracks() || []) s.stop();
    this.spur = null;
    this.aufnehmer = null;
  }
}

/* ===================================================================== */
/*  Ablegen und abspielen                                                */
/* ===================================================================== */

const adressen = new Map();

export async function tonAblegen(cardId, seite, blob, sekunden) {
  const kennung = tonSchluessel(cardId, seite);
  const alte = adressen.get(kennung);
  if (alte) { URL.revokeObjectURL(alte); adressen.delete(kennung); }
  await db.put("media", {
    id: kennung, blob, type: blob.type || "audio/webm",
    ton: true, cardId, seite, sekunden, updatedAt: Date.now(),
  });
  return kennung;
}

export async function tonLesen(cardId, seite) {
  const rec = await db.get("media", tonSchluessel(cardId, seite));
  return rec?.blob ? rec : null;
}

/** Adresse zum Abspielen; wird gemerkt, damit nicht ständig neue entstehen. */
export async function tonAdresse(cardId, seite) {
  const kennung = tonSchluessel(cardId, seite);
  if (adressen.has(kennung)) return adressen.get(kennung);
  const rec = await db.get("media", kennung);
  if (!rec?.blob) return null;
  const url = URL.createObjectURL(rec.blob);
  adressen.set(kennung, url);
  return url;
}

export async function tonEntfernen(cardId, seite) {
  const kennung = tonSchluessel(cardId, seite);
  const url = adressen.get(kennung);
  if (url) URL.revokeObjectURL(url);
  adressen.delete(kennung);
  await db.remove("media", kennung);
}

/** m:ss — auch für die Anzeige während der Aufnahme. */
export function dauerAnzeige(sekunden) {
  const s = Math.max(0, Math.round(sekunden || 0));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}
