/*
 * Stapeldatei: lesen, prüfen, zurückschreiben.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  stapeldateiLesen, alsStapeldatei, passendesFach, artenZaehlen, FORMAT,
} from "../src/core/stapeldatei.js";

const beispiel = {
  format: FORMAT, fassung: 1, titel: "Ableitungen", fach: "Mathematik",
  karten: [
    { vorderseite: "Ableitung von $x^n$", rueckseite: "$n \\cdot x^{n-1}$", hinweis: "Hochzahl nach vorn" },
    { art: "mehrschritt", vorderseite: "Leite $f(x)=(2x+1)^3$ ab.",
      schritte: [{ frage: "Äußere Ableitung", antwort: "$3(2x+1)^2$" }, "$6(2x+1)^2$"] },
    { art: "cloze", vorderseite: "Die {{Kettenregel}} gilt für Verkettungen." },
  ],
};

test("eine gute Datei wird vollständig gelesen", () => {
  const { stapel, fehler } = stapeldateiLesen(JSON.stringify(beispiel));
  assert.deepEqual(fehler, []);
  assert.equal(stapel.titel, "Ableitungen");
  assert.equal(stapel.fach, "Mathematik");
  assert.equal(stapel.karten.length, 3);
  const [frei, weg, luecke] = stapel.karten;
  assert.equal(frei.term, "Ableitung von $x^n$");
  assert.equal(frei.definition, "$n \\cdot x^{n-1}$");
  assert.equal(frei.hint, "Hochzahl nach vorn");
  assert.equal(weg.art, "mehrschritt");
  assert.deepEqual(weg.schritte[1], { frage: "", antwort: "$6(2x+1)^2$" }, "Schritt als bloßer Text");
  assert.equal(luecke.art, "cloze");
  assert.deepEqual(artenZaehlen(stapel.karten), { frei: 1, mehrschritt: 1, cloze: 1 });
});

test("aus dem Chat kopiert, samt Codeblock", () => {
  const text = "```json\n" + JSON.stringify(beispiel) + "\n```";
  assert.ok(stapeldateiLesen(text).stapel);
});

test("eine fehlerhafte Datei legt nichts an und sagt, wo es hakt", () => {
  const schlecht = { ...beispiel, karten: [
    { vorderseite: "ohne Rückseite" },
    { art: "cloze", vorderseite: "keine Lücke" },
    { art: "mehrschritt", vorderseite: "Weg", schritte: [] },
    { art: "bild", vorderseite: "x" },
    { art: "quatsch", vorderseite: "x", rueckseite: "y" },
    { vorderseite: "gut", rueckseite: "gut" },
  ] };
  const { stapel, fehler } = stapeldateiLesen(JSON.stringify(schlecht));
  assert.equal(stapel, null);
  assert.equal(fehler.length, 5);
  assert.match(fehler[0], /^Karte 1 /);
  assert.match(fehler[1], /Lücke/);
  assert.match(fehler[4], /quatsch/);
});

test("kein JSON, keine Karten, fremdes Format, neuere Fassung", () => {
  assert.match(stapeldateiLesen("Hallo").fehler[0], /JSON/);
  assert.match(stapeldateiLesen(JSON.stringify({ titel: "x", karten: [] })).fehler[0], /keine Karten/);
  assert.match(stapeldateiLesen(JSON.stringify({ format: "anki", karten: [{}] })).fehler[0], /Format/);
  assert.match(stapeldateiLesen(JSON.stringify({ ...beispiel, fassung: 99 })).fehler[0], /neueren/);
});

test("Schritte ohne Antwort fallen weg, mit Hinweis", () => {
  const d = { karten: [{ art: "mehrschritt", vorderseite: "W",
    schritte: [{ frage: "a", antwort: "1" }, { frage: "leer", antwort: "" }] }] };
  const { stapel, hinweise } = stapeldateiLesen(JSON.stringify(d));
  assert.equal(stapel.karten[0].schritte.length, 1);
  assert.equal(hinweise.length, 1);
  assert.equal(stapel.titel, "Eingelesener Stapel");
});

test("das Fach wird ohne Rücksicht auf Groß- und Kleinschreibung gefunden", () => {
  const faecher = [{ id: "f1", name: "Mathematik" }, { id: "f2", name: "Alt", deleted: true }];
  assert.equal(passendesFach("mathematik", faecher).id, "f1");
  assert.equal(passendesFach("Alt", faecher), null, "gelöschte Fächer zählen nicht");
  assert.equal(passendesFach("", faecher), null);
});

test("hin und zurück: sichern und wieder einlesen ergibt dieselben Karten", () => {
  const { stapel } = stapeldateiLesen(JSON.stringify(beispiel));
  const karten = stapel.karten.map((k, i) => ({ ...k, id: "k" + i, order: i }));
  const text = alsStapeldatei({ title: "Ableitungen" }, karten, { name: "Mathematik" });
  const zurueck = stapeldateiLesen(text).stapel;
  assert.equal(zurueck.fach, "Mathematik");
  assert.deepEqual(zurueck.karten, stapel.karten);
});

test("die frühere Ausfuhr der App lässt sich auch einlesen", () => {
  const alt = { stapel: { title: "Alt", description: "" }, karten: [
    { term: "a", definition: "b", hint: "" }, { term: "weg", definition: "x", deleted: true },
  ] };
  const { stapel } = stapeldateiLesen(JSON.stringify(alt));
  assert.equal(stapel.titel, "Alt");
  assert.equal(stapel.karten.length, 1);
});
