/*
 * Neue Fassungen: wann still übernommen, wann neu geladen, wann gefragt wird.
 *
 * Geprüft wird die reine Entscheidung. Der Weg dorthin (Dienst-Arbeiter
 * fragen, Fenster zählen) gehört dem Browser und steht in
 * src/core/aktualisierung.js und public/sw.js.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { aktualisierungsPlan } from "../src/core/aktualisierung.js";

const lage = (x) => aktualisierungsPlan({
  eigenerStand: "a", swStand: "b", fenster: 1, fruehPhase: false, ...x,
});

test("gleicher Stand: still übernehmen, ohne jemanden zu behelligen", () => {
  assert.equal(lage({ swStand: "a" }), "still");
  // Auch mitten im Betrieb — die Seite läuft schon mit diesem Code.
  assert.equal(lage({ swStand: "a", fruehPhase: true }), "still");
});

test("älterer Code, aber nichts angefangen: übernehmen und neu laden", () => {
  assert.equal(lage({ fruehPhase: true }), "neuladen");
});

test("älterer Code und die App ist in Gebrauch: melden", () => {
  assert.equal(lage({ fruehPhase: false }), "melden");
});

test("ein zweites Fenster verbietet jede stille Übernahme", () => {
  // Dessen Fassung würde beim Wegräumen der alten Dateien den Boden verlieren.
  assert.equal(lage({ swStand: "a", fenster: 2 }), "melden");
  assert.equal(lage({ fenster: 3, fruehPhase: true }), "melden");
});

test("ohne Auskunft des Dienst-Arbeiters wird nur gemeldet", () => {
  assert.equal(lage({ swStand: null, fenster: 0, fruehPhase: true }), "melden");
  assert.equal(lage({ swStand: undefined, fenster: undefined }), "melden");
});

test("ohne vergleichbare Kennung entscheidet allein die Anfangszeit", () => {
  // Ein Bau ohne eingesetzten Stand kommt nicht vor, soll aber nicht
  // stillstehen: dann gilt dieselbe Regel wie bei älterem Code.
  assert.equal(lage({ eigenerStand: null, fruehPhase: true }), "neuladen");
  assert.equal(lage({ eigenerStand: null, fruehPhase: false }), "melden");
});
