/*
 * Mehrere Karten: Was geht mit einer Kopie mit, was nicht?
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { kopienVon, naechsteStelle, tonKopien } from "../src/core/auswahl.js";

let n = 0;
const neueId = () => "k_neu" + (++n);
const karte = (a = {}) => ({
  id: "k1", setId: "s1", order: 0, term: "la casa", definition: "das Haus",
  hint: "Femininum", termImage: "b_1", defImage: null, starred: true, art: "normal",
  nichtRelevant: false, createdAt: 1, updatedAt: 2, deleted: false, ...a,
});

test("eine Kopie nimmt den Inhalt mit", () => {
  const [k] = kopienVon([karte()], "s2", { start: 5, neueId, jetzt: 99 });
  assert.equal(k.term, "la casa");
  assert.equal(k.definition, "das Haus");
  assert.equal(k.hint, "Femininum");
  assert.equal(k.termImage, "b_1", "das Bild wird geteilt, nicht verdoppelt");
  assert.equal(k.starred, true);
  assert.equal(k.setId, "s2");
  assert.equal(k.order, 5);
  assert.equal(k.createdAt, 99);
});

/* Der Lernstand haengt an der Kennung. Eine neue Kennung heisst: neu lernen. */
test("eine Kopie bekommt eine eigene Kennung", () => {
  const kopien = kopienVon([karte(), karte({ id: "k2", order: 1 })], "s1", { start: 2, neueId });
  assert.equal(new Set(kopien.map((k) => k.id)).size, 2);
  assert.ok(kopien.every((k) => k.id !== "k1" && k.id !== "k2"));
  assert.deepEqual(kopien.map((k) => k.order), [2, 3], "hinten angehängt, Reihenfolge bleibt");
});

test("eine Kopie ist nie gelöscht, auch wenn das Original im Papierkorb lag", () => {
  const [k] = kopienVon([karte({ deleted: true })], "s1", { neueId });
  assert.equal(k.deleted, false);
});

test("das Original bleibt unberührt", () => {
  const original = karte();
  kopienVon([original], "s2", { neueId });
  assert.equal(original.id, "k1");
  assert.equal(original.setId, "s1");
});

test("die nächste freie Stelle zählt Gelöschtes nicht mit", () => {
  const liste = [karte({ order: 0 }), karte({ id: "k2", order: 7, deleted: true }),
    karte({ id: "k3", order: 3 }), karte({ id: "k4", setId: "s2", order: 50 })];
  assert.equal(naechsteStelle(liste, "s1"), 4);
  assert.equal(naechsteStelle(liste, "leer"), 0);
});

test("Tonaufnahmen wandern mit, soweit es welche gibt", () => {
  const paare = [{ alt: "k1", neu: "k9" }, { alt: "k2", neu: "k8" }];
  const medien = ["ton_k1_d", "ton_k1_t", "b_bild", "ton_k7_d"];
  assert.deepEqual(tonKopien(paare, medien), [
    { von: "ton_k1_t", nach: "ton_k9_t" },
    { von: "ton_k1_d", nach: "ton_k9_d" },
  ]);
});
