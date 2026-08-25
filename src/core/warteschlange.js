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

/* ===================================================================== */
/*  Klausur-Modus                                                        */
/* ===================================================================== */

/**
 * Zwei getrennte Mechanismen, damit die Historie sauber bleibt:
 *
 * **Verdichtung** — je näher der Termin, desto höher die Ziel-Retention des
 * Fachs. Die Termine rücken zusammen, aber alles läuft weiter durch FSRS und
 * die Reviews bleiben gewöhnliche Reviews. Das ist kein Pauken, sondern
 * dichteres Wiederholen.
 *
 * **Cram-Warteschlange** — nur in den letzten Tagen. Sie geht den ganzen Stoff
 * durch, ohne Rücksicht auf Termine, verändert den Kartenzustand *nicht* und
 * schreibt Reviews mit dem Vermerk `cram`. Was hier geschieht, verfälscht die
 * Messung nicht: Sie ist Notbehelf, nicht Lernen.
 */

/** Ab so vielen Tagen vor dem Termin beginnt die Verdichtung. */
export const VERDICHTUNG_AB_TAGEN = 60;
/** Ab so vielen Tagen davor ist die Cram-Warteschlange sinnvoll. */
export const CRAM_AB_TAGEN = 5;

/**
 * Die wirksame Ziel-Retention eines Fachs — angehoben, wenn der Termin naht.
 * Steigt von der eingestellten Marke bis auf höchstens 0,97.
 */
export function wirksameRetention(fach, zeit = Date.now()) {
  const grund = Number(fach?.zielRetention) || 0.9;
  if (!fach?.pruefungsdatum) return grund;
  const tage = (fach.pruefungsdatum - zeit) / TAG;
  if (tage <= 0 || tage > VERDICHTUNG_AB_TAGEN) return grund;
  const naehe = 1 - tage / VERDICHTUNG_AB_TAGEN;     // 0 weit weg, 1 am Termin
  return Math.min(0.97, grund + (0.97 - grund) * naehe);
}

/** Wie viele Tage bleiben — oder null, wenn kein Termin hinterlegt ist. */
export function tageBisPruefung(fach, zeit = Date.now()) {
  if (!fach?.pruefungsdatum) return null;
  return Math.ceil((fach.pruefungsdatum - zeit) / TAG);
}

/**
 * Reicht die Zeit?
 *
 * Gerechnet wird schlicht: Wie viele Karten sind noch nie in einen stabilen
 * Zustand gekommen, und wie viele Tage bleiben? Bei mehr als dreißig Karten
 * am Tag wird es unrealistisch — das sagt die App dann auch.
 */
export function pensumPruefen(karten, zustaende, stapelVon, fach, zeit = Date.now()) {
  const tage = tageBisPruefung(fach, zeit);
  if (tage === null) return null;

  const { gesamt, neu, faellig } = fachZaehlung(karten, zustaende, stapelVon, fach.id, zeit);
  let wacklig = 0;
  for (const z of Object.values(zustaende)) {
    if (z.subjectId !== fach.id || z.gesperrt) continue;
    if (!istNeu(z) && (z.stability || 0) < 7) wacklig += 1;
  }

  const offen = neu + wacklig;
  const jeTag = tage > 0 ? offen / tage : offen;

  return {
    tage, gesamt, neu, faellig, wacklig, offen,
    jeTag: Math.ceil(jeTag),
    machbar: tage > 0 && jeTag <= 30,
    text: tage <= 0
      ? "Der Termin ist da."
      : offen === 0
        ? "Alles steht — es geht nur noch ums Halten."
        : jeTag <= 30
          ? `${Math.ceil(jeTag)} Karten am Tag, dann steht bis dahin alles.`
          : `${offen} Karten in ${tage} Tagen wären ${Math.ceil(jeTag)} am Tag — das geht `
            + "sich nicht aus. Kürze den Stoff oder fang bei dem an, was am meisten zählt.",
  };
}

/**
 * Die Warteschlange für den Endspurt: alles, quer durch, ohne Rücksicht auf
 * Termine. Verändert nichts — die Reviews tragen den Vermerk `cram`.
 */
export function baueCramSitzung({ karten, zustaende, stapelVon, fach, umfang = 40 }) {
  const alle = [];
  for (const karte of karten) {
    if (karte.deleted) continue;
    const stapel = stapelVon(karte.setId);
    if (!stapel || (fach && stapel.subjectId !== fach.id)) continue;
    for (const richtung of richtungenFuer(karte, stapel)) {
      const zustand = zustaende[karte.id + ":" + richtung];
      if (zustand?.gesperrt) continue;
      alle.push({ karte, stapel, richtung, zustand, fachId: stapel.subjectId,
        schluessel: karte.id + ":" + richtung });
    }
  }
  // Das Wackligste zuerst — in den letzten Tagen zählt, was am ehesten fehlt.
  alle.sort((a, b) => (a.zustand?.stability || 0) - (b.zustand?.stability || 0));
  return {
    aufgaben: alle.slice(0, umfang),
    gesamt: alle.length,
    cram: true,
  };
}

/**
 * Der Stand eines einzelnen Stapels — für die Stapelansicht.
 *
 * Wichtig: Gerechnet wird mit den FSRS-Zuständen, nicht mit dem alten
 * Fächerplan. Sonst zeigt dieselbe Karte an zwei Stellen der App zwei
 * verschiedene Wahrheiten, und keine davon ist die, nach der gelernt wird.
 */
export function stapelStand(karten, zustaende, stapel, zeit = Date.now()) {
  let faellig = 0, neu = 0, gesperrt = 0, gesamt = 0;
  let naechste = null;
  const alle = [];

  for (const karte of karten) {
    if (karte.deleted) continue;
    for (const richtung of richtungenFuer(karte, stapel)) {
      const z = zustaende[karte.id + ":" + richtung];
      gesamt += 1;
      alle.push(z || null);
      if (z?.gesperrt) { gesperrt += 1; continue; }
      if (istNeu(z)) { neu += 1; continue; }
      if (istFaellig(z, zeit)) faellig += 1;
      else if (naechste === null || z.due < naechste) naechste = z.due;
    }
  }
  return { faellig, neu, gesperrt, gesamt, naechste, zustaende: alle };
}
