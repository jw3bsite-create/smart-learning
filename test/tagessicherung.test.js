/*
 * Die tägliche Sicherung: einmal je Lerntag, getrennt gezählt von den
 * Kopien vor einem Umbau.
 */

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import * as db from "../src/core/db.js";
import { erzeugeBestand } from "../src/core/bestand.js";
import { lokalSichern, ueberzaehlig } from "../src/core/tagessicherung.js";

beforeEach(async () => {
  await db._zuruecksetzen();
  globalThis.indexedDB = new IDBFactory();
});

async function bestandMitKarte() {
  const b = erzeugeBestand({});
  await b.aktionen.laden();
  const s = await b.aktionen.stapelAnlegen("Englisch");
  await b.aktionen.karteAnlegen(s.id, "Haus", "house");
  return b;
}

test("einmal am Tag — ein zweiter Start am selben Tag legt nichts an", async () => {
  await bestandMitKarte();
  assert.equal(await lokalSichern(), true);
  assert.equal(await lokalSichern(), false);
  const taeglich = (await db.sicherungen()).filter((k) => k.grund === "taeglich");
  assert.equal(taeglich.length, 1);
  assert.equal(taeglich[0].umfang.cards, 1, "die Karte steckt in der Kopie");
});

test("tägliche Kopien verdrängen keine Kopie vor einem Umbau", async () => {
  await bestandMitKarte();
  await db.sicherungAnlegen("umbau");
  for (let i = 0; i < 10; i++) await db.sicherungAnlegen("taeglich");
  const liste = await db.sicherungen();
  assert.equal(liste.filter((k) => k.grund === "taeglich").length, 7, "sieben Tage");
  assert.equal(liste.filter((k) => k.grund === "umbau").length, 1, "die vor dem Umbau bleibt");
});

test("in der Wolke bleiben die letzten vierzehn Tage", () => {
  const namen = Array.from({ length: 16 }, (_, i) => "2026-10-" + String(i + 1).padStart(2, "0") + ".json");
  assert.deepEqual(ueberzaehlig([...namen, "fremd.txt"]), ["2026-10-02.json", "2026-10-01.json"]);
  assert.deepEqual(ueberzaehlig(namen.slice(0, 3)), []);
});
