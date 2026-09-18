/*
 * Mathematische Zeichen: dieselbe Auswahl wie im Wissensnetz, eingefügt an
 * der Schreibmarke.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { ZEICHEN, anzeige, einfuegen } from "../src/core/zeichen.js";

test("dieselben fünf Gruppen wie im Wissensnetz", () => {
  assert.deepEqual(ZEICHEN.map((g) => g.gruppe),
    ["Rechnen", "Analysis", "Mengen & Logik", "Griechisch", "Hoch & tief"]);
  const alle = ZEICHEN.flatMap((g) => g.zeichen);
  for (const z of ["∫", "√", "π", "≤", "ℝ", "²", "Δ", "→"])
    assert.ok(alle.includes(z), z + " fehlt");
});

test("keine Gruppe enthält ein Zeichen doppelt", () => {
  for (const g of ZEICHEN)
    assert.equal(new Set(g.zeichen).size, g.zeichen.length, g.gruppe);
});

test("eingefügt wird an der Schreibmarke", () => {
  assert.deepEqual(einfuegen("f(x) = x", 8, 8, "²"), { text: "f(x) = x²", marke: 9 });
  assert.deepEqual(einfuegen("a b", 1, 1, "·"), { text: "a· b", marke: 2 });
});

test("Markiertes wird ersetzt", () => {
  assert.deepEqual(einfuegen("x <= 3", 2, 4, "≤"), { text: "x ≤ 3", marke: 3 });
});

test("ohne Schreibmarke ans Ende, verrutschte Werte werden eingefangen", () => {
  assert.deepEqual(einfuegen("x", undefined, undefined, "²"), { text: "x²", marke: 2 });
  assert.deepEqual(einfuegen("x", 99, 120, "²"), { text: "x²", marke: 2 });
  assert.deepEqual(einfuegen("x", -5, -1, "√"), { text: "√x", marke: 1 });
  assert.deepEqual(einfuegen(null, 0, 0, "π"), { text: "π", marke: 1 });
});

test("mehrzeichige Einträge rücken die Marke um ihre ganze Länge", () => {
  assert.deepEqual(einfuegen("", 0, 0, "lim"), { text: "lim", marke: 3 });
});

/* Der Vektorpfeil steht ueber dem Zeichen davor. Allein auf dem Knopf waere
   er unsichtbar — also zeigt der Knopf einen Platzhalter darunter. */
test("das Kombinationszeichen bekommt einen Platzhalter auf dem Knopf", () => {
  assert.equal(anzeige("⃗"), "◌⃗");
  assert.equal(anzeige("π"), "π");
  assert.deepEqual(einfuegen("v", 1, 1, "⃗"), { text: "v⃗", marke: 2 },
    "eingefügt wird nur der Pfeil, nicht der Platzhalter");
});
