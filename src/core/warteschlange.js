/*
 * Die Warteschlange — was als Nächstes drankommt.
 *
 * Der Nutzer wählt Fach und Umfang. Welche Karten das sind, entscheidet der
 * Plan (§3.1): erst was fällig ist, dann so viele neue, wie das Tageslimit des
 * Fachs noch zulässt. Keine Themenauswahl, keine Kartenauswahl.
 *
 * Die Reihenfolge innerhalb der Sitzung ist gemischt — auch das ist Absicht:
 * Beim Verschachteln muss man zuerst erkennen, worum es überhaupt geht, ehe
 * man antwortet. Genau diese Leistung verlangt später auch die Prüfung.
 */

import { istFaellig, istNeu } from "./fsrs.js";
import { richtungenFuer } from "./model.js";
import { mische } from "./util.js";

const TAG = 24 * 3600 * 1000;

function tagesBeginn(zeit = Date.now()) {
  const d = new Date(zeit);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Wie viele Karten heute schon neu eingeführt wurden.
 * Näherung über den Zustand: erste Wiederholung, letzter Abruf heute.
 */
export function heuteEingefuehrt(zustaende, subjectId = null, zeit = Date.now()) {
  const beginn = tagesBeginn(zeit);
  return zustaende.filter((z) =>
    (!subjectId || z.subjectId === subjectId) &&
    z.reps >= 1 && (z.last_review || 0) >= beginn &&
    z.reps <= 3   // in den ersten Lernschritten — grobe, aber brauchbare Marke
  ).length;
}

/**
 * Stellt eine Sitzung zusammen.
 *
 * `karten`      alle Karten (aus dem Bestand)
 * `zustaende`   Verzeichnis id → Kartenzustand (`<kartenkennung>:<richtung>`)
 * `stapelVon`   Funktion setId → Stapel
 * `fach`        das gewählte Fach (oder null für alle)
 * `umfang`      Höchstzahl der Aufgaben
 */
export function baueSitzung({
  karten, zustaende, stapelVon, faecherVon, fach = null, faecherIds = null,
  umfang = 30, zeit = Date.now(), nurWiederholung = false,
}) {
  const faellige = [];
  const neue = [];

  for (const karte of karten) {
    if (karte.deleted) continue;
    const stapel = stapelVon(karte.setId);
    if (!stapel) continue;
    const fachId = stapel.subjectId || null;
    if (fach && fachId !== fach.id) continue;
    // Beim Verschachteln über mehrere Fächer: nur die gewählten.
    if (faecherIds && faecherIds.length && !faecherIds.includes(fachId)) continue;

    for (const richtung of richtungenFuer(karte, stapel)) {
      const zustand = zustaende[karte.id + ":" + richtung];
      if (zustand?.gesperrt) continue;         // Leech — wartet auf Überarbeitung
      const eintrag = { karte, stapel, richtung, zustand, fachId,
        schluessel: karte.id + ":" + richtung };
      if (istNeu(zustand)) neue.push(eintrag);
      else if (istFaellig(zustand, zeit)) faellige.push(eintrag);
    }
  }

  // Fälliges zuerst und nach Überfälligkeit geordnet — was am längsten wartet,
  // ist am ehesten vergessen.
  faellige.sort((a, b) => (a.zustand?.due || 0) - (b.zustand?.due || 0));

  let neuErlaubt = 0;
  if (!nurWiederholung) {
    if (fach) {
      const limit = Number(fach.neuProTag) || 0;
      neuErlaubt = Math.max(0, limit - heuteEingefuehrt(Object.values(zustaende), fach.id, zeit));
    } else {
      // Ohne Fachwahl gilt die Summe der Einzellimits.
      for (const f of faecherVon()) {
        if (faecherIds && faecherIds.length && !faecherIds.includes(f.id)) continue;
        const limit = Number(f.neuProTag) || 0;
        neuErlaubt += Math.max(0, limit -
          heuteEingefuehrt(Object.values(zustaende), f.id, zeit));
      }
    }
  }

  const genommenNeu = mische(neue).slice(0, Math.max(0, neuErlaubt));
  const genommenFaellig = faellige.slice(0, umfang);

  // Bis zum Umfang auffüllen: erst Wiederholungen, dann Neues.
  const zusammen = [...genommenFaellig];
  for (const n of genommenNeu) {
    if (zusammen.length >= umfang) break;
    zusammen.push(n);
  }

  return {
    aufgaben: mische(zusammen),
    faellig: faellige.length,
    neu: neue.length,
    neuHeuteMoeglich: neuErlaubt,
  };
}

/** Was in einem Fach ansteht — für die Übersicht. */
export function fachZaehlung(karten, zustaende, stapelVon, fachId, zeit = Date.now()) {
  let faellig = 0, neu = 0, gesperrt = 0, gesamt = 0;
  for (const karte of karten) {
    if (karte.deleted) continue;
    const stapel = stapelVon(karte.setId);
    if (!stapel || (fachId && stapel.subjectId !== fachId)) continue;
    for (const richtung of richtungenFuer(karte, stapel)) {
      const z = zustaende[karte.id + ":" + richtung];
      gesamt += 1;
      if (z?.gesperrt) gesperrt += 1;
      else if (istNeu(z)) neu += 1;
      else if (istFaellig(z, zeit)) faellig += 1;
    }
  }
  return { faellig, neu, gesperrt, gesamt };
}

/**
 * Wie viele Karten in den nächsten Tagen terminiert sind.
 *
 * Das ist eine Untergrenze: Folgewiederholungen, die aus den heutigen
 * Antworten erst entstehen, sind naturgemäß noch nicht terminiert. Für die
 * Frage „staut es sich?" reicht die Zahl trotzdem — sie zeigt den Bestand,
 * der bereits auf dem Kalender steht.
 */
export function faelligJeTag(zustaende, tage = 30, zeit = Date.now()) {
  const beginn = tagesBeginn(zeit);
  const eimer = new Array(tage).fill(0);
  let ueberfaellig = 0;
  for (const z of zustaende) {
    if (!z || z.gesperrt || istNeu(z)) continue;
    const versatz = Math.floor(((z.due || 0) - beginn) / TAG);
    if (versatz < 0) ueberfaellig += 1;
    else if (versatz < tage) eimer[versatz] += 1;
  }
  return { eimer, ueberfaellig };
}

/**
 * Grobe Hochrechnung der täglichen Last (§3.1).
 *
 * Faustformel, keine Simulation: Eine Karte im Wiederholungsstand erzeugt im
 * Mittel etwa 1/Stabilität Abrufe pro Tag; frisch eingeführte Karten liegen in
 * den ersten Wochen deutlich darüber. Die Zahl soll eine Größenordnung geben
 * und vor dem Rückstau warnen, nicht eine Vorhersage sein.
 */
export function lastprognose(zustaende, neuProTagGesamt, tage = 180) {
  let bestandslast = 0;
  for (const z of zustaende) {
    if (!z || z.gesperrt || istNeu(z)) continue;
    bestandslast += 1 / Math.max(1, z.stability || 1);
  }
  // Jede neue Karte bringt erfahrungsgemäß rund acht Abrufe im ersten Halbjahr.
  const neueLast = (neuProTagGesamt * 8) / 30;
  const inTagen = bestandslast + neueLast;
  const spaeter = bestandslast + neuProTagGesamt * tage / Math.max(30, tage) * 0.5 + neueLast;
  return {
    heute: Math.round(inTagen),
    inHalbjahr: Math.round(spaeter),
    minutenHeute: Math.round(inTagen * 8 / 60),   // rund acht Sekunden je Karte
  };
}
