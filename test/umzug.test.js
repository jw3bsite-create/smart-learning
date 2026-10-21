/*
 * Der Umzug vom PC: Der Link bringt Zugang und Zahlen mit, und die neue
 * Fassung erkennt, ob alles angekommen ist.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { umzugLink, umzugAusLink, umzugPruefen, zaehlen, VEROEFFENTLICHT } from "../src/core/umzug.js";
import { zugangAusLink } from "../src/core/cloud.js";

const zugang = { url: "https://abcdefghijklmnop.supabase.co", key: "sb_publishable_AbC123xyz_456" };

test("der Link führt in die veröffentlichte Fassung und bringt Zugang und Zahlen mit", () => {
  const link = umzugLink(zugang, { stapel: 7, karten: 64, zeit: 1700000000000 });
  const url = new URL(link);
  assert.equal(url.origin + url.pathname, VEROEFFENTLICHT);
  assert.deepEqual(umzugAusLink(url.search), { stapel: 7, karten: 64, zeit: 1700000000000 });
  assert.deepEqual(zugangAusLink(url.search), zugang, "der Zugang zur Cloud kommt heil an");
});

test("ohne Cloud: nur die Zahlen, kein Zugang", () => {
  const url = new URL(umzugLink(null, { stapel: 2, karten: 10, zeit: 5 }));
  assert.equal(zugangAusLink(url.search), null);
  assert.equal(umzugAusLink(url.search).karten, 10);
});

test("Fremdes in der Adresse wird nicht als Umzug gelesen", () => {
  assert.equal(umzugAusLink("?umzug=7-x-1"), null);
  assert.equal(umzugAusLink(""), null);
});

test("gezählt wird ohne Gelöschtes", () => {
  assert.deepEqual(zaehlen({ stapel: [{}, { deleted: true }], karten: [{}, {}, { deleted: true }] }),
    { stapel: 1, karten: 2 });
});

test("vollständig erst, wenn alle Stapel und Karten da sind; mehr ist kein Fehler", () => {
  const soll = { stapel: 7, karten: 64 };
  assert.equal(umzugPruefen(soll, { stapel: 7, karten: 63 }).vollstaendig, false);
  assert.equal(umzugPruefen(soll, { stapel: 7, karten: 64 }).vollstaendig, true);
  assert.equal(umzugPruefen(soll, { stapel: 9, karten: 80 }).vollstaendig, true);
  assert.equal(umzugPruefen(null, { stapel: 1, karten: 1 }), null);
});
