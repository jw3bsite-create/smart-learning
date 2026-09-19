/*
 * Fehlerheft: Was zählt als Fehler, und in welcher Reihenfolge steht es da?
 *
 * Die Reihenfolge ist keine Kosmetik. Wer eine halbe Stunde hat, soll oben
 * finden, was am meisten kostet: die Karten, die er für sicher hielt und doch
 * nicht wusste.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ZEITRAEUME, von, fehlerListe, sortiere, nurFach, nurUeberschaetzt, nachFach,
  zahlen, schluessel, fehlerZahlKurz,
} from "../src/core/fehler.js";
import { NOTEN, KONFIDENZ } from "../src/core/fsrs.js";

const TAG = 86400000;
const jetzt = new Date(2026, 8, 17, 12).getTime();

let zaehler = 0;
const abruf = (a = {}) => ({
  id: "r" + (++zaehler), cardId: "k1", richtung: "td", setId: "s1", subjectId: "f1",
  zeit: jetzt - TAG, bewertung: NOTEN.NOCHMAL, konfidenz: KONFIDENZ.UNSICHER,
  flag: "normal", modus: "abrufen", deleted: false, ...a,
});

test("nur Nochmal zählt als Fehler", () => {
  const liste = fehlerListe([
    abruf(), abruf({ bewertung: NOTEN.GUT }), abruf({ bewertung: NOTEN.SCHWER }),
    abruf({ bewertung: NOTEN.LEICHT }),
  ]);
  assert.equal(liste.length, 1);
  assert.equal(liste[0].fehler, 1);
});

/* Im Vorabtest wird geraten, dort sind Fehler ausdruecklich erwuenscht. */
test("Fehler im Vorabtest kommen nicht ins Heft", () => {
  assert.deepEqual(fehlerListe([abruf({ flag: "pretest" })]), []);
  assert.equal(fehlerListe([abruf({ flag: "practice" })]).length, 1,
    "beim Üben zählt der Fehler, wird aber als Übung vermerkt");
  assert.equal(fehlerListe([abruf({ flag: "practice" })])[0].imLernen, 1);
});

test("Karte und Richtung werden getrennt geführt", () => {
  const liste = fehlerListe([abruf(), abruf({ richtung: "dt" }), abruf()]);
  assert.equal(liste.length, 2);
  const td = liste.find((e) => e.richtung === "td");
  assert.equal(td.fehler, 2);
  assert.equal(td.schluessel, "k1:td");
});

test("sicher gesagt und doch falsch wird eigens gezählt", () => {
  const liste = fehlerListe([
    abruf({ konfidenz: KONFIDENZ.SICHER }),
    abruf({ konfidenz: KONFIDENZ.KEINE_AHNUNG }),
  ]);
  assert.equal(liste[0].fehler, 2);
  assert.equal(liste[0].ueberschaetzt, 1);
  assert.equal(nurUeberschaetzt(liste).length, 1);
});

test("der Zeitraum schneidet Ältere ab", () => {
  const reviews = [
    abruf({ zeit: jetzt - 2 * TAG }),
    abruf({ cardId: "k2", zeit: jetzt - 40 * TAG }),
    abruf({ cardId: "k3", zeit: jetzt - 200 * TAG }),
  ];
  assert.equal(fehlerListe(reviews, { seit: von("woche", jetzt) }).length, 1);
  assert.equal(fehlerListe(reviews, { seit: von("monat", jetzt) }).length, 1);
  assert.equal(fehlerListe(reviews, { seit: von("quartal", jetzt) }).length, 2);
  assert.equal(fehlerListe(reviews, { seit: von("alles", jetzt) }).length, 3);
  assert.equal(ZEITRAEUME.monat.tage, 30);
});

test("die Reihenfolge stellt das Überschätzte nach oben", () => {
  const liste = [
    { schluessel: "a", fehler: 5, ueberschaetzt: 0, zuletzt: jetzt },
    { schluessel: "b", fehler: 1, ueberschaetzt: 1, zuletzt: jetzt - TAG },
    { schluessel: "c", fehler: 3, ueberschaetzt: 0, zuletzt: jetzt - 2 * TAG },
  ];
  assert.deepEqual(sortiere(liste).map((e) => e.schluessel), ["b", "a", "c"]);
});

test("je Fach gebündelt, das schwerste Fach zuerst", () => {
  const liste = fehlerListe([
    abruf({ cardId: "k1", subjectId: "f1" }),
    abruf({ cardId: "k2", subjectId: "f2" }),
    abruf({ cardId: "k3", subjectId: "f2" }),
    abruf({ cardId: "k4", subjectId: null }),
  ]);
  const gruppen = nachFach(liste);
  assert.deepEqual(gruppen.map((g) => g.subjectId), ["f2", "f1", null]);
  assert.equal(gruppen[0].eintraege.length, 2);
  assert.equal(nurFach(liste, "f2").length, 2);
  assert.equal(nurFach(liste, null).length, 4, "ohne Fachwahl bleibt alles");
});

test("die Zahlen über dem Heft", () => {
  const liste = fehlerListe([
    abruf({ konfidenz: KONFIDENZ.SICHER }),
    abruf(),
    abruf({ cardId: "k2" }),
  ]);
  assert.deepEqual(zahlen(liste), { karten: 2, fehler: 3, ueberschaetzt: 1 });
  assert.equal(fehlerZahlKurz([abruf()], { jetzt }), 1);
});

/* Die Schluessel gehen an den Fragemodus. Passt das Format nicht, uebt man
   entweder nichts oder alles. */
test("die Schlüssel für die Übungsrunde haben das Format der Zustände", () => {
  const liste = fehlerListe([abruf(), abruf({ cardId: "k2", richtung: "dt" })]);
  const menge = schluessel(liste);
  assert.ok(menge.has("k1:td"));
  assert.ok(menge.has("k2:dt"));
  assert.equal(menge.size, 2);
});

test("kein Absturz ohne Daten", () => {
  for (const nichts of [null, undefined, []]) {
    assert.deepEqual(fehlerListe(nichts), []);
    assert.deepEqual(zahlen(fehlerListe(nichts)), { karten: 0, fehler: 0, ueberschaetzt: 0 });
  }
});

test("Einträge aus dem alten Fragemodus bleiben draußen, neue zählen", async () => {
  const { fehlerListe } = await import("../src/core/fehler.js");
  const { neuesReview } = await import("../src/core/model.js");
  const alt = { id: "r1", cardId: "k1", richtung: "td", bewertung: 1, flag: "practice",
    modus: "fragen", zeit: 1000 };
  const neu = neuesReview({ cardId: "k2", bewertung: 1, flag: "practice", modus: "fragen", zeit: 2000 });
  const liste = fehlerListe([alt, neu]);
  assert.deepEqual(liste.map((e) => e.cardId), ["k2"]);
});
