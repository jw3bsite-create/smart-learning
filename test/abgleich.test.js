/*
 * Die Regeln des Abgleichs.
 *
 * Der Fehler, um den es hier geht: Die App merkte sich, bis zu welcher
 * Änderungszeit sie geholt hatte. Wer offline lernte und erst abends
 * hochlud, schickte Zeilen mit einer früheren Änderungszeit — das andere
 * Gerät holte sie nie. Jetzt zählt der Stempel des Servers.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  zuUebernehmen, neueMarke, medienPlan, drobenName, drobenLesen, UEBERLAPPUNG,
} from "../src/core/abgleich.js";

const MIN = 60000;

test("übernommen wird, was fehlt oder neuer ist", () => {
  const hier = new Map([["a", 1000], ["b", 3000]]);
  const zeilen = [
    { id: "a", updatedAt: 2000 },      // neuer
    { id: "b", updatedAt: 2000 },      // älter, bleibt draußen
    { id: "c", updatedAt: 500 },       // fehlt hier
  ];
  assert.deepEqual(zuUebernehmen(hier, zeilen).map((z) => z.id), ["a", "c"]);
});

test("ein Grabstein von dort zählt wie jede andere Änderung", () => {
  const hier = new Map([["a", 1000]]);
  const weg = [{ id: "a", updatedAt: 2000, deleted: true }];
  assert.equal(zuUebernehmen(hier, weg).length, 1);
});

test("die Marke folgt dem Stempel des Servers, nicht der Änderungszeit", () => {
  const gestern = Date.now() - 24 * 3600 * 1000;
  const zeilen = [
    // Am Handy gestern gelernt, heute erst hochgeladen.
    { id: "a", updated_at: gestern, geaendert: 5000 },
    { id: "b", updated_at: Date.now(), geaendert: 4000 },
  ];
  assert.equal(neueMarke(3000, zeilen), 5000);
  assert.equal(neueMarke(9000, zeilen), 9000, "die Marke geht nie zurück");
});

test("beim Holen wird etwas zurückgegriffen", () => {
  assert.ok(UEBERLAPPUNG >= MIN, "sonst gehen Zeilen verloren, die gleichzeitig ankamen");
});

/* ------------------------------- Medien -------------------------------- */

const bild = (id, updatedAt = 1000) => ({ id, updatedAt, blob: {}, deleted: false });
const ton = (karte, seite, updatedAt, extra = {}) =>
  ({ id: "ton_" + karte + "_" + seite, updatedAt, blob: {}, deleted: false, ...extra });

test("Dateinamen tragen bei Aufnahmen den Stand, bei Bildern nicht", () => {
  assert.equal(drobenName("b_1", 500), "b_1");
  assert.equal(drobenName("ton_k1_d", 500), "ton_k1_d@500");
  assert.deepEqual(drobenLesen("ton_k1_d@500"), { id: "ton_k1_d", stand: 500, name: "ton_k1_d@500" });
  assert.deepEqual(drobenLesen("b_1"), { id: "b_1", stand: 0, name: "b_1" });
});

test("Bilder gehen hoch, wenn sie droben fehlen, und herunter, wenn sie hier fehlen", () => {
  const plan = medienPlan({
    lokal: [bild("b_1")],
    droben: ["b_2"],
    gebraucht: new Set(["b_1", "b_2"]),
  });
  assert.deepEqual(plan.hoch.map((x) => x.name), ["b_1"]);
  assert.deepEqual(plan.runter.map((x) => x.id), ["b_2"]);
});

test("eine neu eingesprochene Aufnahme ersetzt die alte droben", () => {
  const plan = medienPlan({
    lokal: [ton("k1", "d", 2000)],
    droben: ["ton_k1_d@1000"],
    gebraucht: new Set(["ton_k1_d"]),
  });
  assert.deepEqual(plan.hoch.map((x) => x.name), ["ton_k1_d@2000"]);
  assert.deepEqual(plan.weg, ["ton_k1_d@1000"]);
  assert.equal(plan.runter.length, 0);
});

test("eine anderswo neu eingesprochene Aufnahme kommt herunter", () => {
  const plan = medienPlan({
    lokal: [ton("k1", "d", 1000)],
    droben: ["ton_k1_d@3000"],
    gebraucht: new Set(["ton_k1_d"]),
  });
  assert.deepEqual(plan.runter.map((x) => x.stand), [3000]);
  assert.equal(plan.hoch.length, 0);
});

test("eine gelöschte Aufnahme verschwindet auch droben und kommt nicht zurück", () => {
  const plan = medienPlan({
    lokal: [ton("k1", "d", 5000, { deleted: true, blob: null })],
    droben: ["ton_k1_d@4000"],
    gebraucht: new Set(["ton_k1_d"]),
  });
  assert.deepEqual(plan.weg, ["ton_k1_d@4000"]);
  assert.equal(plan.runter.length, 0);
  assert.equal(plan.hoch.length, 0);
});

test("wurde sie anderswo nach dem Löschen neu eingesprochen, gewinnt die neue", () => {
  const plan = medienPlan({
    lokal: [ton("k1", "d", 1000, { deleted: true, blob: null })],
    droben: ["ton_k1_d@6000"],
    gebraucht: new Set(["ton_k1_d"]),
  });
  assert.deepEqual(plan.runter.map((x) => x.stand), [6000]);
  assert.equal(plan.weg.length, 0);
});

test("was niemand mehr braucht, wird weder geholt noch geschickt", () => {
  const plan = medienPlan({
    lokal: [bild("b_alt"), ton("weg", "d", 2000)],
    droben: ["b_fremd"],
    gebraucht: new Set(),
  });
  assert.deepEqual(plan, { hoch: [], runter: [], weg: [] });
});

test("mehrere Stände derselben Aufnahme droben: der jüngste bleibt", () => {
  const plan = medienPlan({
    lokal: [ton("k1", "d", 3000)],
    droben: ["ton_k1_d@1000", "ton_k1_d@3000", "ton_k1_d@2000"],
    gebraucht: new Set(["ton_k1_d"]),
  });
  assert.equal(plan.hoch.length, 0, "hier ist derselbe Stand");
  assert.deepEqual(plan.weg.sort(), ["ton_k1_d@1000", "ton_k1_d@2000"]);
});
