/*
 * Die laufende Abrufen-Runde als eigenes Ding — unabhängig vom Bildschirm
 * (UX-Bericht, 27.11.2026, Priorität 1).
 *
 * Vorher lebte die Runde nur im Abrufen selbst: Zurück, ein Reiterwechsel
 * oder Neuladen warfen Reihenfolge, Wiedervorlagen, Balken und die getippte
 * Antwort weg. Bewertetes blieb verbucht, aber die Runde begann neu. Jetzt
 * wird nach jeder Handlung ein Schnappschuss geschrieben; das Abrufen nimmt
 * ihn beim Wiederkommen auf, und über der Navigierleiste steht so lange
 * „Abrufen · 7 von 20 · Fortsetzen“ (Vorbild: der Mini-Player von Spotify).
 *
 * Gespeichert werden nur Schlüssel und Zustände, keine Karten: Die Karten
 * kommen beim Wiederherstellen frisch aus dem Bestand. Fehlt eine (gelöscht,
 * abgehakt), beginnt lieber eine neue Runde, als dass eine halbe weiterläuft.
 * Eine Runde gilt nur am selben Lerntag (ab 4 Uhr).
 *
 * Reiner Kern ohne Browser; das Speichern selbst steht in ui/runde.js.
 */

import { istRelevant } from "./model.js";
import { tagesSchluessel } from "./util.js";
import { fortschrittAnteil } from "./fortschritt.js";

export const RUNDE_FASSUNG = 1;

/** Ein Schnappschuss der Runde, wie er gespeichert wird. */
export function rundeSchnappschuss({
  id, basis, weg, titel, sitzung, stelle = 0, phase = "konfidenz", konfidenz = null, eingabe = "",
  schrittNr = 0, schrittErgebnisse = [], ergebnisse = [], groesse = null, cram = false, erinnert = null,
  zeit = Date.now(),
}) {
  return {
    fassung: RUNDE_FASSUNG, id, lerntag: tagesSchluessel(zeit), zeit, basis, weg, titel,
    aufgaben: sitzung.aufgaben.map((a) => ({ s: a.schluessel, g: a.grund || null, w: a.wiederholung || 0 })),
    wv: sitzung.wv || null, zusatz: sitzung.zusatz || null,
    faellig: sitzung.faellig ?? null, neu: sitzung.neu ?? null,
    stelle, phase, konfidenz, eingabe, schrittNr, schrittErgebnisse,
    /* Nur, was für Balken und Ergebnis zählt — keine Karteninhalte. */
    ergebnisse: ergebnisse.map((e) => ({ ...e })),
    groesse, cram,
    /* Die schon gemessene Erinnerungszeit, wenn die Karte aufgedeckt ist —
       sonst mäße die Uhr nach dem Wiederkommen fast nichts. */
    erinnert: phase === "aufgedeckt" ? erinnert : null,
  };
}

/** Taugt der Schnappschuss zum Weitermachen? (Fassung, Lerntag, Ort, nicht leer) */
export function rundeGilt(s, { basis = null, zeit = Date.now() } = {}) {
  return Boolean(s && s.fassung === RUNDE_FASSUNG
    && s.lerntag === tagesSchluessel(zeit)
    && (basis === null || s.basis === basis)
    && Array.isArray(s.aufgaben) && s.aufgaben.length > 0
    && Number.isInteger(s.stelle) && s.stelle >= 0 && s.stelle < s.aufgaben.length);
}

/**
 * Die Sitzung aus dem Schnappschuss zurückbauen — mit den Karten, wie sie
 * jetzt im Bestand stehen. Fehlt eine Karte oder ihr Stapel, kommt null.
 * Stillgelegte Karten bleiben drin: Sie können in dieser Runde gerade erst
 * stillgelegt worden sein und stehen noch als Wiedervorlage an.
 */
export function rundeWiederherstellen(s, { karten, zustaende, stapelVon }) {
  const nachId = new Map(karten.map((k) => [k.id, k]));
  const aufgaben = [];
  for (const t of s.aufgaben) {
    const trenner = String(t.s).lastIndexOf(":");
    const karte = nachId.get(String(t.s).slice(0, trenner));
    if (!karte || !istRelevant(karte)) return null;
    const stapel = stapelVon(karte.setId);
    if (!stapel) return null;
    aufgaben.push({
      karte, stapel, richtung: String(t.s).slice(trenner + 1), zustand: zustaende[t.s],
      fachId: stapel.subjectId || null, schluessel: t.s,
      ...(t.g ? { grund: t.g } : {}), ...(t.w ? { wiederholung: t.w } : {}),
    });
  }
  return {
    aufgaben, wv: s.wv || undefined,
    ...(s.zusatz ? { zusatz: s.zusatz } : {}),
    faellig: s.faellig ?? 0, neu: s.neu ?? 0,
  };
}

/** Für die Leiste „Fortsetzen“: wo man steht und wie voll der Balken ist. */
export function rundeStand(s) {
  const verschieden = new Set(s.aufgaben.map((a) => a.s)).size;
  return {
    stelle: s.stelle, gesamt: s.aufgaben.length,
    anteil: fortschrittAnteil((s.ergebnisse || []).map((e) => ({ schluessel: e.schluessel, richtig: e.note !== 1 })),
      verschieden),
  };
}
