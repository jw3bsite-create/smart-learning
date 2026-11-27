/*
 * Die Karte, die auf der Startseite (oder oben im Stapel) stand, muss im
 * Abrufen auch wirklich drankommen — mitsamt der Einschätzung.
 *
 * Vorher wurde sie in der gebauten Sitzung gesucht. Neue Karten werden aber
 * nur bis zum Tageslimit und dabei zufällig gezogen; die gesuchte fehlte
 * darum oft, und es kam eine andere Frage (Nutzer, 27.11.2026). Seither
 * baut `aufgabeAusSchluessel` sie geradewegs aus ihrem Schlüssel.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { aufgabeAusSchluessel, baueSitzung } from "../src/core/warteschlange.js";

const stapelListe = [
  { id: "s1", subjectId: "de", title: "Märchen" },
  { id: "ruhig", subjectId: "de", title: "Romantik", ruht: { seit: Date.now(), tage: 30 } },
];
const stapelVon = (id) => stapelListe.find((s) => s.id === id) || null;
const karten = [
  ...[...Array(20)].map((_, i) => ({ id: "k" + i, setId: "s1", term: "t" + i, definition: "d" + i })),
  { id: "weg", setId: "s1", term: "x", definition: "y", nichtRelevant: true },
  { id: "schlaeft", setId: "ruhig", term: "x", definition: "y" },
];
const eingaben = { karten, zustaende: {}, stapelVon };

test("eine Aufgabe entsteht aus ihrem Schlüssel", () => {
  const a = aufgabeAusSchluessel("k3:td", eingaben);
  assert.equal(a.karte.id, "k3");
  assert.equal(a.richtung, "td");
  assert.equal(a.fachId, "de");
  assert.equal(a.stapel.id, "s1");
  assert.equal(a.schluessel, "k3:td");
});

test("was nicht drankommt, gibt es auch hier nicht", () => {
  assert.equal(aufgabeAusSchluessel("weg:td", eingaben), null, "abgehakt");
  assert.equal(aufgabeAusSchluessel("schlaeft:td", eingaben), null, "ruhender Stapel");
  assert.equal(aufgabeAusSchluessel("gibtsnicht:td", eingaben), null);
  assert.equal(aufgabeAusSchluessel("k3:quatsch", eingaben), null, "keine solche Richtung");
  assert.equal(aufgabeAusSchluessel("", eingaben), null);
  assert.equal(aufgabeAusSchluessel("k3", eingaben), null, "ohne Richtung");
  assert.equal(aufgabeAusSchluessel("k3:td", { ...eingaben, zustaende: { "k3:td": { gesperrt: true } } }),
    null, "stillgelegt");
});

test("auch eine Karte, die keine Sitzung gezogen hätte, lässt sich voranstellen", () => {
  /* Das Tageslimit lässt nur drei neue Karten zu — siebzehn bleiben draußen. */
  const faecherVon = () => [{ id: "de", neuProTag: 3 }];
  const s = baueSitzung({ karten, zustaende: {}, stapelVon, faecherVon, umfang: 10 });
  assert.equal(s.aufgaben.length, 3, "mehr lässt das Tageslimit nicht zu");
  const draussen = karten.map((k) => k.id + ":td")
    .filter((k) => k.startsWith("k") && !s.aufgaben.some((a) => a.schluessel === k));
  assert.ok(draussen.length > 0);
  const a = aufgabeAusSchluessel(draussen[0], eingaben);
  assert.ok(a, "die Karte kommt trotzdem vorn hinein");
  assert.equal(a.schluessel, draussen[0]);
});
