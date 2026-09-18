/*
 * Zurück dorthin, wo man herkam.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { fortschreiben, vorheriger, wegName } from "../src/core/verlauf.js";

test("der Weg wird Schritt für Schritt fortgeschrieben", () => {
  let wege = fortschreiben([], 0, "/start");
  wege = fortschreiben(wege, 1, "/fach/m", { neu: true });
  wege = fortschreiben(wege, 2, "/stapel/s1", { neu: true });
  assert.deepEqual(wege, ["/start", "/fach/m", "/stapel/s1"]);
  assert.equal(vorheriger(wege, 2), "/fach/m");
});

/* Der Fall aus dem Alltag: Fach → Stapel → Bearbeiten → zurück → zurück.
   Das zweite Zurück muss beim Fach landen, nicht bei allen Stapeln. */
test("zurück aus dem Bearbeiten führt wieder zum Fach", () => {
  let wege = ["/start", "/fach/m", "/stapel/s1", "/stapel/s1/bearbeiten"];
  // zurück: Tiefe 2, der Eintrag bleibt, nur die Tiefe wechselt
  wege = fortschreiben(wege, 2, "/stapel/s1");
  assert.equal(vorheriger(wege, 2), "/fach/m");
});

test("ein neuer Schritt verwirft, was dahinter lag", () => {
  const wege = fortschreiben(["/start", "/fach/m", "/stapel/s1"], 2, "/fehler", { neu: true });
  assert.deepEqual(wege, ["/start", "/fach/m", "/fehler"]);
});

test("ohne Vorgänger kein Zurück im Verlauf", () => {
  assert.equal(vorheriger(["/start"], 0), null);
  assert.equal(vorheriger([], NaN), null);
  assert.equal(vorheriger(null, 3), null);
});

test("Wege heißen so, wie man sie kennt", () => {
  const namen = {
    fach: (id) => (id === "m" ? "Mathematik" : null),
    ordner: (id) => (id === "o" ? "Kant" : null),
    stapel: (id) => (id === "s" ? "Analysis" : null),
  };
  assert.equal(wegName("/fach/m", namen), "Mathematik");
  assert.equal(wegName("/ordner/o", namen), "Kant");
  assert.equal(wegName("/", namen), "Alle Stapel");
  assert.equal(wegName("/start", namen), "Start");
  assert.equal(wegName("/fehler", namen), "Fehlerheft");
  assert.equal(wegName("/stapel/s", namen), "Analysis");
  assert.equal(wegName("/stapel/s/karten", namen), null, "ein Lernmodus ist kein Ziel");
  assert.equal(wegName(null, namen), null);
});
