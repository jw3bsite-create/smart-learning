/*
 * Die laufende Abrufen-Runde überlebt Zurück, Reiterwechsel und Neuladen
 * (core/runde.js, UX-Bericht 27.11.2026). Geprüft: Schnappschuss hin und
 * zurück, Lerntag, fehlende Karten, Wiedervorlagen, Balken.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { rundeSchnappschuss, rundeGilt, rundeWiederherstellen, rundeStand } from "../src/core/runde.js";

const JETZT = new Date(2026, 10, 27, 15).getTime();
const stapel = { id: "s1", subjectId: "de", title: "Deutsch" };
const stapelVon = (id) => (id === "s1" ? stapel : null);
const karten = ["a", "b", "c"].map((id) => ({ id, setId: "s1", term: id, definition: id.toUpperCase() }));
const aufgabe = (id, extra = {}) => ({
  karte: karten.find((k) => k.id === id), stapel, richtung: "td", fachId: "de",
  schluessel: id + ":td", ...extra,
});
const sitzung = {
  aufgaben: [aufgabe("a"), aufgabe("b"), aufgabe("c"), aufgabe("a", { grund: "falsch", wiederholung: 1 })],
  wv: { folge: [{ id: "a:td", grund: "erst" }], fehler: { "a:td": 1 }, langsamSchon: {}, problem: [], verlauf: [] },
  faellig: 2, neu: 1,
};
const schnapp = (mehr = {}) => rundeSchnappschuss({
  id: "r1", basis: "de||", weg: "/abrufen/de", titel: "Abrufen — Deutsch", sitzung,
  stelle: 2, phase: "tippen", konfidenz: 2, eingabe: "halb getippt",
  ergebnisse: [{ schluessel: "a:td", note: 1 }, { schluessel: "b:td", note: 3 }],
  groesse: "klein", zeit: JETZT, ...mehr,
});

test("Schnappschuss und Wiederherstellen ergeben dieselbe Runde", () => {
  const s = JSON.parse(JSON.stringify(schnapp()));   // wie aus dem Speicher
  assert.ok(rundeGilt(s, { basis: "de||", zeit: JETZT }));
  const neu = rundeWiederherstellen(s, { karten, zustaende: {}, stapelVon });
  assert.deepEqual(neu.aufgaben.map((a) => a.schluessel), ["a:td", "b:td", "c:td", "a:td"]);
  assert.equal(neu.aufgaben[3].grund, "falsch", "die Wiedervorlage bleibt eine");
  assert.equal(neu.aufgaben[3].wiederholung, 1);
  assert.equal(neu.aufgaben[0].karte.definition, "A", "Karten kommen frisch aus dem Bestand");
  assert.deepEqual(neu.wv.fehler, { "a:td": 1 });
  assert.equal(s.eingabe, "halb getippt");
  assert.equal(s.phase, "tippen");
});

test("nur am selben Lerntag und am selben Ort", () => {
  const s = schnapp();
  assert.ok(rundeGilt(s, { zeit: JETZT + 3 * 3600000 }), "später am selben Tag");
  assert.equal(rundeGilt(s, { zeit: JETZT + 14 * 3600000 }), false, "nach 4 Uhr am nächsten Morgen nicht mehr");
  assert.equal(rundeGilt(s, { basis: "ma||", zeit: JETZT }), false, "ein anderes Fach beginnt neu");
  assert.equal(rundeGilt(null), false);
  assert.equal(rundeGilt({ ...s, stelle: 9 }, { zeit: JETZT }), false, "Stelle hinter dem Ende");
});

test("fehlt eine Karte, wird nicht halb weitergemacht", () => {
  const s = schnapp();
  const ohneB = karten.filter((k) => k.id !== "b");
  assert.equal(rundeWiederherstellen(s, { karten: ohneB, zustaende: {}, stapelVon }), null);
  const abgehakt = karten.map((k) => (k.id === "c" ? { ...k, nichtRelevant: true } : k));
  assert.equal(rundeWiederherstellen(s, { karten: abgehakt, zustaende: {}, stapelVon }), null);
});

test("die Leiste kennt Stelle und Balken", () => {
  const stand = rundeStand(schnapp());
  assert.equal(stand.stelle, 2);
  assert.equal(stand.gesamt, 4);
  /* drei verschiedene Karten: a falsch (halb), b richtig (ganz) = 1,5 / 3 */
  assert.equal(stand.anteil, 0.5);
});
