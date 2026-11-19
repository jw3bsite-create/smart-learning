/*
 * Ruhende Stapel (vom Nutzer entschieden am 19. November 2026): Sie kommen
 * im Abrufen nicht dran und zählen nirgends als fällig. Der Lernstand
 * bleibt, und beim Zurückholen steht da, was dann wartet.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { neuerZustand, bewerteKarte } from "../src/core/fsrs.js";
import { baueSitzung, fachZaehlung, zustaendeImPlan, rueckkehrStand, baueCramSitzung } from "../src/core/warteschlange.js";
import { ruht } from "../src/core/model.js";

const JETZT = new Date(2026, 10, 19, 15).getTime();
const TAG = 86400000;

const stapelListe = [
  { id: "aktiv", subjectId: "de", title: "Märchen" },
  { id: "ruhig", subjectId: "de", title: "Romantik", ruht: { seit: JETZT - 10 * TAG, tage: 50 } },
];
const stapelVon = (id) => stapelListe.find((s) => s.id === id) || null;
const karten = ["a1", "a2", "r1", "r2", "r3"].map((id) => ({
  id, setId: id.startsWith("a") ? "aktiv" : "ruhig", term: id, definition: id,
}));
/* Alle einmal vor zwanzig Tagen gelernt — heute also fällig. */
const zustaende = Object.fromEntries(karten.map((k) => {
  const z = bewerteKarte(neuerZustand(k.id, "td", k.setId, "de", JETZT - 20 * TAG), 3, { zeit: JETZT - 20 * TAG });
  return [k.id + ":td", z];
}));

test("ruht: nur mit Zeitpunkt", () => {
  assert.equal(ruht(stapelListe[1]), true);
  assert.equal(ruht(stapelListe[0]), false);
  assert.equal(ruht({ ruht: null }), false);
});

test("ein ruhender Stapel kommt im Abrufen nicht dran", () => {
  const s = baueSitzung({ karten, zustaende, stapelVon, fach: { id: "de" }, zeit: JETZT });
  const stapelDerAufgaben = new Set(s.aufgaben.map((a) => a.stapel.id));
  assert.ok(s.aufgaben.length > 0);
  assert.deepEqual([...stapelDerAufgaben], ["aktiv"]);
  const cram = baueCramSitzung({ karten, zustaende, stapelVon, fach: { id: "de" } });
  assert.ok(cram.aufgaben.every((a) => a.stapel.id === "aktiv"), "auch nicht im Endspurt");
});

test("und er zählt nirgends als fällig", () => {
  const z = fachZaehlung(karten, zustaende, stapelVon, "de", JETZT);
  assert.equal(z.gesamt, 2);
  assert.equal(zustaendeImPlan(karten, zustaende, stapelVon).length, 2, "auch nicht in der Vorschau für die Erinnerung");
});

test("beim Zurückholen steht da, was dann wartet", () => {
  assert.deepEqual(rueckkehrStand(karten, zustaende, stapelListe[1], JETZT), { faellig: 3, neu: 0 });
});
