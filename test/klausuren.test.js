/*
 * Klausuren (core/klausuren.js): mehrere je Fach, mit Ordnern und Stapeln.
 * Hier steht, dass der alte Prüfungstermin nicht verloren geht, dass eine
 * vergangene Klausur aus dem Blick fällt und dass Ordner ihre Unterordner
 * mitbringen.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  klausurenVon, kommendeKlausuren, naechsteKlausur, mitKlausurTermin, stapelDerKlausur,
  klausurJeStapel, stapelSortieren, tageBis, tageText, neueKlausur,
} from "../src/core/klausuren.js";

const TAG = 86400000;
const JETZT = new Date("2026-11-25T10:00:00").getTime();
const tag = (n) => new Date(new Date(JETZT).setHours(0, 0, 0, 0) + n * TAG).getTime();

const ordner = [
  { id: "o1", name: "Klausur 1", subjectId: "f1", parentId: null },
  { id: "o2", name: "Teil", subjectId: "f1", parentId: "o1" },
  { id: "o3", name: "Klausur 2", subjectId: "f1", parentId: null },
];
const stapel = [
  { id: "s1", subjectId: "f1", folderId: "o1", title: "B" },
  { id: "s2", subjectId: "f1", folderId: "o2", title: "A" },
  { id: "s3", subjectId: "f1", folderId: "o3", title: "C" },
  { id: "s4", subjectId: "f1", folderId: null, title: "D" },
  { id: "s5", subjectId: "f2", folderId: null, title: "E" },
];

test("ein altes Fach behält seinen Termin als erste Klausur", () => {
  const alt = { id: "f1", pruefungsdatum: tag(10) };
  assert.equal(klausurenVon(alt).length, 1);
  assert.equal(naechsteKlausur(alt, JETZT).datum, tag(10));
  assert.equal(mitKlausurTermin(alt, JETZT), alt, "ohne Klausurliste unverändert");
});

test("der Termin des Fachs ist die nächste kommende Klausur; vergangene zählen nicht", () => {
  const fach = { id: "f1", pruefungsdatum: tag(99), klausuren: [
    neueKlausur({ name: "K1", datum: tag(-2) }),
    neueKlausur({ name: "K3", datum: tag(30) }),
    neueKlausur({ name: "K2", datum: tag(0) }),
  ] };
  assert.deepEqual(kommendeKlausuren(fach, JETZT).map((k) => k.name), ["K2", "K3"], "am Tag selbst zählt sie noch");
  assert.equal(mitKlausurTermin(fach, JETZT).pruefungsdatum, tag(0));
  assert.equal(mitKlausurTermin({ id: "f1", klausuren: [] }, JETZT).pruefungsdatum, null);
});

test("Ordner bringen Unterordner mit, einzelne Stapel kommen dazu, ohne Zuordnung das ganze Fach", () => {
  const fach = { id: "f1" };
  assert.deepEqual([...stapelDerKlausur({ ordnerIds: ["o1"], stapelIds: ["s4"] }, fach, stapel, ordner)].sort(),
    ["s1", "s2", "s4"]);
  assert.deepEqual([...stapelDerKlausur({ ordnerIds: [], stapelIds: [] }, fach, stapel, ordner)].sort(),
    ["s1", "s2", "s3", "s4"]);
  assert.ok(!stapelDerKlausur({ stapelIds: ["s5"] }, fach, stapel, ordner).has("s5"), "fremdes Fach nicht");
});

test("ein Ordner in zwei Klausuren: der Stapel zählt zur nächsten", () => {
  const fach = { id: "f1", klausuren: [
    neueKlausur({ name: "später", datum: tag(40), ordnerIds: ["o1"] }),
    neueKlausur({ name: "bald", datum: tag(5), ordnerIds: ["o1", "o3"] }),
  ] };
  const je = klausurJeStapel([fach], stapel, ordner, JETZT);
  assert.equal(je.get("s1").klausur.name, "bald");
  assert.equal(je.get("s3").klausur.name, "bald");
  assert.equal(je.has("s4"), false);
});

test("Sortieren: Klausur nach Datum, ohne Klausur ans Ende, Gleichstand nach Name", () => {
  const info = (s) => ({ klausurDatum: { s1: tag(5), s3: tag(2) }[s.id] ?? null, karten: 0, faellig: 0 });
  assert.deepEqual(stapelSortieren(stapel, "klausur", info).map((s) => s.id), ["s3", "s1", "s2", "s4", "s5"]);
  assert.deepEqual(stapelSortieren(stapel, "name", info).map((s) => s.title), ["A", "B", "C", "D", "E"]);
});

test("Tage in Worten", () => {
  assert.equal(tageBis({ datum: tag(6) }, JETZT), 6);
  assert.equal(tageText(0), "heute");
  assert.equal(tageText(1), "morgen");
  assert.equal(tageText(6), "in 6 Tagen");
});
