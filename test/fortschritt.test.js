/*
 * Der Balken in den Lernmodi (core/fortschritt.js): richtig ganz, ein
 * Fehlversuch halb — und mehrere Fehlversuche derselben Karte eben nicht
 * mehrfach (Wunsch und Einwand des Nutzers, 27.11.2026).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { fortschrittAnteil } from "../src/core/fortschritt.js";

const nah = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, a + " statt " + b);

test("richtig füllt ganz, falsch halb", () => {
  nah(fortschrittAnteil([], 10), 0);
  nah(fortschrittAnteil([{ schluessel: "a", richtig: true }], 10), 0.1);
  nah(fortschrittAnteil([{ schluessel: "a", richtig: false }], 10), 0.05);
  nah(fortschrittAnteil([
    { schluessel: "a", richtig: true }, { schluessel: "b", richtig: true },
    { schluessel: "c", richtig: true }, { schluessel: "d", richtig: true },
    { schluessel: "e", richtig: true },
  ], 10), 0.5);
});

test("dieselbe Karte mehrfach falsch schiebt den Balken nur einmal", () => {
  const dreimal = [1, 2, 3].map(() => ({ schluessel: "a", richtig: false }));
  nah(fortschrittAnteil(dreimal, 4), 0.125);          // ein halber von vier
});

test("falsch, dann richtig: die Karte wächst auf ganz", () => {
  nah(fortschrittAnteil([
    { schluessel: "a", richtig: false },
    { schluessel: "a", richtig: true },
  ], 4), 0.25);
});

test("der Balken geht nie zurück und nie über voll", () => {
  /* Erst richtig, dann (Wiedervorlage) falsch — der beste Stand bleibt. */
  nah(fortschrittAnteil([
    { schluessel: "a", richtig: true },
    { schluessel: "a", richtig: false },
  ], 2), 0.5);
  nah(fortschrittAnteil([
    { schluessel: "a", richtig: true }, { schluessel: "b", richtig: true },
    { schluessel: "c", richtig: true },
  ], 2), 1);
  assert.equal(fortschrittAnteil([{ schluessel: "a", richtig: true }], 0), 0);
});

test("unbrauchbare Einträge stören nicht", () => {
  nah(fortschrittAnteil([null, {}, { schluessel: "a", richtig: true }], 2), 0.5);
});
