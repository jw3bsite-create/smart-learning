/*
 * Ordner in Fächern: wo ein Stapel erscheint, und dass beim Aufräumen nichts
 * verloren geht.
 */

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import * as db from "../src/core/db.js";
import { erzeugeBestand } from "../src/core/bestand.js";
import {
  allgemeineOrdner, ordnerImFach, stapelImFach, aufloesenPlan,
  ordnerNachFachwechsel, fachordnerPfad,
} from "../src/core/fachordner.js";

/* ============================ Die Regeln ================================ */

const faecher = [{ id: "mathe" }, { id: "bio" }];
const ordner = [
  { id: "allg", name: "Schule", parentId: null },
  { id: "ana", name: "Analysis", parentId: null, subjectId: "mathe" },
  { id: "abl", name: "Ableitungen", parentId: "ana", subjectId: "mathe" },
  { id: "geo", name: "Geometrie", parentId: null, subjectId: "mathe" },
  { id: "zell", name: "Zelle", parentId: null, subjectId: "bio" },
  { id: "waise", name: "Altes Fach", parentId: null, subjectId: "geloescht" },
];
const stapel = [
  { id: "s1", subjectId: "mathe", folderId: null },
  { id: "s2", subjectId: "mathe", folderId: "ana" },
  { id: "s3", subjectId: "mathe", folderId: "abl" },
  { id: "s4", subjectId: "mathe", folderId: "allg" },   // in einem allgemeinen Ordner
  { id: "s5", subjectId: "bio", folderId: "zell" },
  { id: "s6", subjectId: "mathe", folderId: "ana", deleted: true },
];

test("Fachordner stehen nicht im allgemeinen Ordnerbaum", () => {
  const ids = allgemeineOrdner(ordner, faecher).map((o) => o.id);
  assert.deepEqual(ids.sort(), ["allg", "waise"]);
});

test("ein Ordner, dessen Fach gelöscht ist, wird wieder ein gewöhnlicher", () => {
  assert.ok(allgemeineOrdner(ordner, faecher).some((o) => o.id === "waise"),
    "sonst wären er und seine Stapel nirgends mehr zu sehen");
});

test("im Fach oben stehen nur seine obersten Ordner, alphabetisch", () => {
  assert.deepEqual(ordnerImFach(ordner, "mathe").map((o) => o.id), ["ana", "geo"]);
  assert.deepEqual(ordnerImFach(ordner, "mathe", "ana").map((o) => o.id), ["abl"]);
});

test("oben im Fach stehen alle Stapel außerhalb seiner Ordner", () => {
  assert.deepEqual(stapelImFach(stapel, ordner, "mathe").map((s) => s.id), ["s1", "s4"],
    "auch der Stapel in einem allgemeinen Ordner gehört oben ins Fach");
});

test("im Ordner stehen genau seine Stapel, gelöschte nicht", () => {
  assert.deepEqual(stapelImFach(stapel, ordner, "mathe", "ana").map((s) => s.id), ["s2"]);
});

test("Auflösen rückt alles eine Ebene hinauf und löscht nur den Ordner", () => {
  const plan = aufloesenPlan(ordner, stapel, "ana", 99);
  const weg = plan.ordner.filter((o) => o.deleted).map((o) => o.id);
  assert.deepEqual(weg, ["ana"]);
  assert.equal(plan.ordner.find((o) => o.id === "abl").parentId, null);
  assert.deepEqual(plan.stapel.map((s) => [s.id, s.folderId]), [["s2", null]]);
  assert.ok(plan.stapel.every((s) => !s.deleted), "kein Stapel darf dabei verschwinden");
});

test("ein Unterordner rückt beim Auflösen in seinen Elternordner", () => {
  const plan = aufloesenPlan(ordner, stapel, "abl", 99);
  assert.deepEqual(plan.stapel.map((s) => [s.id, s.folderId]), [["s3", "ana"]]);
});

test("wer das Fach wechselt, verlässt den Fachordner, nicht aber einen allgemeinen", () => {
  assert.equal(ordnerNachFachwechsel(stapel[1], ordner, "bio"), null);
  assert.equal(ordnerNachFachwechsel(stapel[1], ordner, "mathe"), "ana");
  assert.equal(ordnerNachFachwechsel(stapel[3], ordner, "bio"), "allg");
});

test("der Pfad reicht vom obersten Fachordner bis hierher", () => {
  assert.deepEqual(fachordnerPfad(ordner, "abl").map((o) => o.name), ["Analysis", "Ableitungen"]);
});

test("ein Ring aus Ordnern hängt den Pfad nicht auf", () => {
  const ring = [
    { id: "a", parentId: "b", subjectId: "m" },
    { id: "b", parentId: "a", subjectId: "m" },
  ];
  assert.equal(fachordnerPfad(ring, "a").length, 2);
});

/* ========================= Der ganze Weg ================================ */

let uhr = Date.now();
const jetzt = () => uhr;

beforeEach(async () => {
  await db._zuruecksetzen();
  globalThis.indexedDB = new IDBFactory();
  uhr = Date.now();
});

async function oeffnen() {
  const b = erzeugeBestand({ jetzt });
  await b.aktionen.laden();
  return b;
}

test("Fachordner und Auflösen überstehen einen Neustart, Karten bleiben", async () => {
  const b = await oeffnen();
  const fach = await b.aktionen.fachAnlegen("Mathematik", "#5b8bff");
  const o = await b.aktionen.ordnerAnlegen("Analysis", null, fach.id);
  const s = await b.aktionen.stapelAnlegen("Ableitungen", o.id);
  await b.aktionen.stapelAendern(s.id, { subjectId: fach.id });
  await b.aktionen.karteAnlegen(s.id, "f(x)=x^2", "f'(x)=2x");

  await db._zuruecksetzen();
  let n = await oeffnen();
  assert.equal(n.lesen().ordner.find((x) => x.id === o.id).subjectId, fach.id);
  assert.equal(n.lesen().stapel.find((x) => x.id === s.id).folderId, o.id,
    "der Fachwechsel im selben Fach darf den Stapel nicht aus dem Ordner werfen");

  uhr += 1000;
  await n.aktionen.ordnerAufloesen(o.id);
  await db._zuruecksetzen();
  n = await oeffnen();
  const st = n.lesen();
  assert.equal(st.ordner.some((x) => x.id === o.id), false, "der Ordner ist weg");
  const derStapel = st.stapel.find((x) => x.id === s.id);
  assert.equal(derStapel.folderId, null, "der Stapel steht jetzt oben im Fach");
  assert.equal(derStapel.subjectId, fach.id);
  assert.equal(st.karten.filter((k) => k.setId === s.id).length, 1, "die Karte ist noch da");
});

test("wird das Fach gelöscht, bleiben seine Ordner als gewöhnliche Ordner", async () => {
  const b = await oeffnen();
  const fach = await b.aktionen.fachAnlegen("Bio", "#3fbf7f");
  const o = await b.aktionen.ordnerAnlegen("Zelle", null, fach.id);
  uhr += 1000;
  await b.aktionen.fachLoeschen(fach.id);
  await db._zuruecksetzen();
  const n = await oeffnen();
  const derOrdner = n.lesen().ordner.find((x) => x.id === o.id);
  assert.ok(derOrdner, "der Ordner existiert noch");
  assert.equal(derOrdner.subjectId, null);
});
