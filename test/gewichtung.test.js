/*
 * Klausurnähe zieht Karten nach vorn (core/klausuren.js, core/warteschlange.js).
 * Geprüft wird die Kurve und, über viele Ziehungen, dass die Karten der nahen
 * Klausur wirklich häufiger kommen — und dass ohne Gewicht alles bleibt, wie es war.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { klausurGewicht } from "../src/core/klausuren.js";
import { gewichtetZiehen } from "../src/core/warteschlange.js";

test("das Gewicht wächst in den letzten 30 Tagen bis aufs Fünffache", () => {
  assert.equal(klausurGewicht(null), 1);
  assert.equal(klausurGewicht(40), 1);
  assert.equal(klausurGewicht(30), 1);
  assert.equal(klausurGewicht(15), 3);
  assert.equal(klausurGewicht(0), 5);
  assert.equal(klausurGewicht(-1), 1, "nach der Klausur kein Vorrang mehr");
});

test("gewichtetes Ziehen: schwere Einträge kommen häufiger, alle sind möglich", () => {
  const liste = [...Array(20)].map((_, i) => ({ id: i, nah: i < 10 }));
  let nah = 0, fern = 0;
  let saat = 1;
  const zufall = () => { saat = (saat * 16807) % 2147483647; return saat / 2147483647; };
  for (let r = 0; r < 400; r++) {
    for (const e of gewichtetZiehen(liste, 5, (x) => (x.nah ? 5 : 1), zufall)) (e.nah ? nah++ : fern++);
  }
  assert.ok(nah > fern * 2, "nah " + nah + " gegen fern " + fern);
  assert.ok(fern > 0, "auch ferne kommen vor");
  assert.equal(gewichtetZiehen(liste, 50, () => 1).length, 20, "nicht mehr als da ist");
});
