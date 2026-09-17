/*
 * Quizlet-Einfuhr: Die Trennzeichen werden geraten, nicht erfragt.
 *
 * Quizlet gibt den Text in der Form heraus, die man dort eingestellt hat.
 * Raet die App falsch, entsteht eine einzige Karte mit der ganzen Liste darin
 * — nicht falsch im Sinne eines Absturzes, aber unbrauchbar. Darum steht das
 * Raten unter Test, mit den Formen, die Quizlet wirklich liefert.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { quizletLesen } from "../src/core/importer.js";

const TAB = "\t";

test("Tabulator und neue Zeile, die Vorgabe bei Quizlet", () => {
  const e = quizletLesen(
    "la casa" + TAB + "das Haus\n"
    + "el perro" + TAB + "der Hund\n"
    + "la ventana" + TAB + "das Fenster");
  assert.equal(e.spalte, "tab");
  assert.equal(e.zeile, "zeile");
  assert.deepEqual(e.paare, [
    { term: "la casa", definition: "das Haus" },
    { term: "el perro", definition: "der Hund" },
    { term: "la ventana", definition: "das Fenster" },
  ]);
  assert.deepEqual(e.uebrig, []);
});

test("Gedankenstrich und Leerzeile, die zweite gängige Einstellung", () => {
  const e = quizletLesen("la casa - das Haus\n\nel perro - der Hund\n\nla mesa - der Tisch");
  assert.equal(e.paare.length, 3);
  assert.deepEqual(e.paare[2], { term: "la mesa", definition: "der Tisch" });
});

test("eine Kopfzeile wird nicht zur Karte", () => {
  const e = quizletLesen("Begriff" + TAB + "Definition\nel libro" + TAB + "das Buch");
  assert.deepEqual(e.paare, [{ term: "el libro", definition: "das Buch" }]);
  const englisch = quizletLesen("Term,Definition\nel libro,das Buch");
  assert.deepEqual(englisch.paare, [{ term: "el libro", definition: "das Buch" }]);
});

test("Nummerierung aus abgeschriebenen Listen fällt weg", () => {
  const e = quizletLesen("1. la casa" + TAB + "das Haus\n2) el perro" + TAB + "der Hund");
  assert.deepEqual(e.paare.map((p) => p.term), ["la casa", "el perro"]);
});

/* Bei Komma als Trenner setzt Quizlet Anfuehrungszeichen um Felder, die
   selbst ein Komma enthalten. */
test("Komma mit Anführungszeichen", () => {
  const e = quizletLesen('la casa,das Haus\n"el perro, el gato","der Hund, die Katze"');
  assert.equal(e.spalte, "komma");
  assert.deepEqual(e.paare[1], { term: "el perro, el gato", definition: "der Hund, die Katze" });
});

test("doppelte Karten werden einmal übernommen und gezählt", () => {
  const e = quizletLesen("la casa" + TAB + "das Haus\nLA CASA" + TAB + "das Haus\nla mesa" + TAB + "der Tisch");
  assert.equal(e.paare.length, 2);
  assert.equal(e.doppelte, 1, "Groß- und Kleinschreibung macht keine neue Karte");
});

test("mehrzeilige Rückseiten bleiben eine Karte", () => {
  const e = quizletLesen(
    "ser - sein\n(unregelmäßig)\n\nestar - sich befinden\n(Zustand)");
  assert.equal(e.paare.length, 2);
  assert.match(e.paare[0].definition, /sein \(unregelmäßig\)/);
});

test("Zeilen ohne Rückseite werden gemeldet, nicht verschluckt", () => {
  const e = quizletLesen("la casa" + TAB + "das Haus\nnur ein Wort\nla mesa" + TAB + "der Tisch");
  assert.equal(e.paare.length, 2);
  assert.deepEqual(e.uebrig, ["nur ein Wort"]);
});

test("nichts hinein, nichts heraus", () => {
  for (const leer of ["", "   \n\n", null, undefined]) {
    const e = quizletLesen(leer);
    assert.deepEqual(e.paare, []);
    assert.deepEqual(e.uebrig, []);
  }
});

/* Der Fall, in dem das Raten schadet: ein Text ohne jedes Trennzeichen. Dann
   soll nichts geteilt werden, statt an Leerzeichen zu zerfallen. */
test("eine gewöhnliche Liste ohne Trennzeichen ergibt keine falschen Karten", () => {
  const e = quizletLesen("la casa\nel perro\nla mesa");
  assert.equal(e.paare.length, 0);
  assert.equal(e.uebrig.length, 3);
});
