/*
 * Eigene Erscheinungsbilder: speichern, erkennen, ausblenden.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PALETTEN, STANDARD_GESTALTUNG, gestaltungAus, istAktiv, sichtbareBilder, neuesBild,
} from "../src/core/gestaltung.js";

test("gespeichert wird genau die Gestaltung, sonst nichts", () => {
  const einstellungen = { ...STANDARD_GESTALTUNG, akzent: "#ff0000", sitzungsUmfang: 30, letzteSicherung: 5 };
  const werte = gestaltungAus(einstellungen);
  assert.deepEqual(Object.keys(werte).sort(), Object.keys(STANDARD_GESTALTUNG).sort());
  assert.equal(werte.akzent, "#ff0000");
  assert.equal("sitzungsUmfang" in werte, false, "Lerneinstellungen gehören nicht dazu");
});

test("ein neues Bild trägt Namen und Werte", () => {
  const b = neuesBild("  Abends  ", { ...STANDARD_GESTALTUNG, design: "tief" }, 1000);
  assert.equal(b.name, "Abends");
  assert.equal(b.werte.design, "tief");
  assert.match(b.id, /^eb_/);
  assert.equal(neuesBild("", {}).name, "Eigenes");
});

test("das eingestellte Bild wird erkannt", () => {
  const papier = PALETTEN.find((p) => p.name === "Papier");
  assert.ok(istAktiv(papier.werte, { ...STANDARD_GESTALTUNG, ...papier.werte }));
  assert.ok(!istAktiv(papier.werte, STANDARD_GESTALTUNG));
  assert.ok(!istAktiv({}, STANDARD_GESTALTUNG), "ein leeres Bild ist nie eingestellt");
});

test("vorgegebene lassen sich ausblenden, eigene stehen dahinter", () => {
  const eigene = [{ id: "eb_1", name: "Abends", werte: { design: "tief" } }];
  const alle = sichtbareBilder(eigene, []);
  assert.equal(alle.length, PALETTEN.length + 1);
  assert.equal(alle[alle.length - 1].name, "Abends");
  assert.ok(alle[alle.length - 1].eigenes);

  const ohneNacht = sichtbareBilder(eigene, ["Nacht"]);
  assert.ok(!ohneNacht.some((b) => b.name === "Nacht"));
  assert.equal(ohneNacht.length, PALETTEN.length);
  // Die Vorgaben selbst bleiben unberührt, damit sie zurückkommen können.
  assert.ok(PALETTEN.some((p) => p.name === "Nacht"));
});

test("die Kennungen sind eindeutig", () => {
  const alle = sichtbareBilder([{ id: "eb_1", name: "A", werte: {} }, { id: "eb_2", name: "B", werte: {} }], []);
  assert.equal(new Set(alle.map((b) => b.id)).size, alle.length);
});
