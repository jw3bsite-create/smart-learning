/*
 * Umordnen durch Ziehen: wohin fällt die Karte?
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { verschiebe, zielStelle, ausweichen } from "../src/core/ordnen.js";

test("verschieben nach unten und nach oben", () => {
  assert.deepEqual(verschiebe(["a", "b", "c", "d"], 0, 2), ["b", "c", "a", "d"]);
  assert.deepEqual(verschiebe(["a", "b", "c", "d"], 3, 1), ["a", "d", "b", "c"]);
  assert.deepEqual(verschiebe(["a", "b"], 1, 1), ["a", "b"], "an Ort und Stelle");
});

test("verrutschte Stellen werden eingefangen", () => {
  assert.deepEqual(verschiebe(["a", "b", "c"], 0, 99), ["b", "c", "a"]);
  assert.deepEqual(verschiebe(["a", "b", "c"], 2, -5), ["c", "a", "b"]);
  assert.deepEqual(verschiebe(["a", "b"], 7, 0), ["a", "b"], "unbekannte Stelle ändert nichts");
});

/* Zeilen mit Mitten bei 50, 150, 250, 350 — gezogen wird die zweite. */
test("das Ziel richtet sich nach den Mitten vom Anfang des Zugs", () => {
  const mitten = [50, 150, 250, 350];
  assert.equal(zielStelle(mitten, 1, 150), 1, "nicht bewegt");
  assert.equal(zielStelle(mitten, 1, 260), 2, "über die dritte hinaus");
  assert.equal(zielStelle(mitten, 1, 400), 3, "ans Ende");
  assert.equal(zielStelle(mitten, 1, 10), 0, "an den Anfang");
});

test("nur die Zeilen zwischen alter und neuer Stelle weichen aus", () => {
  // von 1 nach 3: Zeilen 2 und 3 rücken hoch
  assert.deepEqual([0, 1, 2, 3, 4].map((i) => ausweichen(i, 1, 3, 100)), [0, 0, -100, -100, 0]);
  // von 3 nach 1: Zeilen 1 und 2 rücken runter
  assert.deepEqual([0, 1, 2, 3, 4].map((i) => ausweichen(i, 3, 1, 100)), [0, 100, 100, 0, 0]);
});

/* Das Zusammenspiel: Wer die zweite Karte hinter die vierte zieht, muss
   genau diese Reihenfolge bekommen. */
test("ziehen und fallenlassen ergibt die erwartete Reihenfolge", () => {
  const liste = ["k1", "k2", "k3", "k4"];
  const mitten = [50, 150, 250, 350];
  const nach = zielStelle(mitten, 1, 380);
  assert.deepEqual(verschiebe(liste, 1, nach), ["k1", "k3", "k4", "k2"]);
});
