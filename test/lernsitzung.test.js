/*
 * Lernen nach Quizlet-Art: erst erkennen, dann schreiben, dann gemeistert;
 * falsch heißt eine Stufe zurück; die Runde nimmt Begonnenes zuerst.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { frageArtFuer, rundeBauen, nachAntwort, fortschritt, NEU, BEKANNT, GEMEISTERT } from "../src/core/lernsitzung.js";

const karten = Array.from({ length: 10 }, (_, i) => ({ id: "k" + i }));
const alle = { auswahl: true, schreiben: true, wahrFalsch: false };

test("erst erkennen, dann schreiben", () => {
  assert.equal(frageArtFuer(NEU, alle), "auswahl");
  assert.equal(frageArtFuer(BEKANNT, alle), "schreiben");
  assert.equal(frageArtFuer(NEU, { schreiben: true }), "schreiben", "ohne Auswahl wird gleich geschrieben");
  assert.equal(frageArtFuer(BEKANNT, { auswahl: true }), "auswahl", "ohne Schreiben bleibt es bei der Auswahl");
  assert.equal(frageArtFuer(NEU, { auswahl: true, wahrFalsch: true }, () => 0.9), "wahrFalsch");
});

test("richtig: eine Stufe hinauf, falsch: eine hinunter, nie darüber hinaus", () => {
  let s = {};
  s = nachAntwort(s, "k0", true); assert.equal(s.k0, BEKANNT);
  s = nachAntwort(s, "k0", true); assert.equal(s.k0, GEMEISTERT);
  s = nachAntwort(s, "k0", true); assert.equal(s.k0, GEMEISTERT);
  s = nachAntwort(s, "k0", false); assert.equal(s.k0, BEKANNT);
  s = nachAntwort(s, "k1", false); assert.equal(s.k1, NEU);
});

test("die Runde: Begonnenes zuerst, Gemeistertes nie, höchstens die Rundengröße", () => {
  const stufen = { k3: BEKANNT, k5: GEMEISTERT, k7: BEKANNT };
  const r = rundeBauen(karten, stufen, { groesse: 4, arten: alle });
  assert.deepEqual(r.map((a) => a.karte.id), ["k3", "k7", "k0", "k1"]);
  assert.deepEqual(r.map((a) => a.art), ["schreiben", "schreiben", "auswahl", "auswahl"]);
});

test("fertig, wenn alles gemeistert ist", () => {
  const stufen = Object.fromEntries(karten.map((k) => [k.id, GEMEISTERT]));
  assert.deepEqual(fortschritt(karten, stufen), { neu: 0, bekannt: 0, gemeistert: 10, gesamt: 10, fertig: true });
  assert.equal(rundeBauen(karten, stufen).length, 0);
  assert.equal(fortschritt(karten, { k0: BEKANNT }).neu, 9);
});
