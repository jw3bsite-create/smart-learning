/* Die Seitentasten der Maus: zurück, vor, und erst den Dialog schließen. */

import test from "node:test";
import assert from "node:assert/strict";
import { handlungFuer, ZURUECK, VOR } from "../src/core/maustasten.js";

test("hinten heißt zurück, vorn heißt vor", () => {
  assert.equal(handlungFuer(ZURUECK), "zurueck");
  assert.equal(handlungFuer(VOR), "vor");
});

test("ist ein Dialog offen, schließt zurück erst ihn, und vor tut nichts", () => {
  assert.equal(handlungFuer(ZURUECK, { dialogOffen: true }), "dialog");
  assert.equal(handlungFuer(VOR, { dialogOffen: true }), null);
});

test("die übrigen Tasten bleiben, was sie sind", () => {
  for (const taste of [0, 1, 2]) assert.equal(handlungFuer(taste), null);
});
