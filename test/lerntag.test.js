/*
 * Der Lerntag beginnt um 4 Uhr: Wer nach Mitternacht lernt, lernt für den
 * Tag davor.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { tagesSchluessel, kalenderSchluessel, lerntagBeginn, TAGESWECHSEL } from "../src/core/util.js";
import { straehne } from "../src/core/straehne.js";
import { heuteEingefuehrt } from "../src/core/warteschlange.js";

const um = (tag, stunde, minute = 0) => new Date(2026, 9, tag, stunde, minute).getTime();

test("halb eins gehört zum Vortag, vier Uhr zum neuen Tag", () => {
  assert.equal(tagesSchluessel(um(21, 0, 30)), "2026-10-20");
  assert.equal(tagesSchluessel(um(21, 3, 59)), "2026-10-20");
  assert.equal(tagesSchluessel(um(21, TAGESWECHSEL)), "2026-10-21");
  assert.equal(kalenderSchluessel(um(21, 0, 30)), "2026-10-21", "das echte Datum bleibt das echte");
});

test("der Lerntag beginnt um vier — auch am Tag der Zeitumstellung", () => {
  assert.equal(new Date(lerntagBeginn(um(25, 12))).getHours(), 4);
  assert.equal(new Date(lerntagBeginn(um(25, 2))).getDate(), 24);
});

test("eine Runde nach Mitternacht hält die Strähne des Vortags", () => {
  const abrufe = (zeit, n) => Array.from({ length: n }, (_, i) => ({
    flag: "normal", zeit: zeit + i * 1000, bewertung: 3, konfidenz: 1,
  }));
  // Am 19. normal gelernt, den 20. erst um 0:40 Uhr am 21. nachgeholt.
  const reviews = [...abrufe(um(19, 18), 30), ...abrufe(um(21, 0, 40), 30)];
  const s = straehne(reviews, { jetzt: um(21, 1) });
  assert.equal(s.laenge, 2, "der 19. und der 20. — die späte Runde zählt für den 20.");
});

test("das Tageslimit für neue Karten zählt ab vier Uhr", () => {
  const z = { a: { eingefuehrt: um(21, 0, 30), reps: 1 }, b: { eingefuehrt: um(21, 9), reps: 1 } };
  // Morgens um zehn: Die Karte von halb eins gehört zum gestrigen Kontingent.
  const n = heuteEingefuehrt(Object.values(z).map((x, i) => ({ ...x, id: "k" + i + ":td" })), null, um(21, 10));
  assert.equal(n, 1);
});
