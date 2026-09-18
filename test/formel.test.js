/*
 * Formeln: Zerlegen, Brüche, Hoch- und Tiefstellung, Klartext.
 *
 * Der wichtigste Fall ist der unscheinbare: gewöhnlicher Text ohne Formel
 * muss genau so bleiben, wie er war. Tausende Karten haben kein einziges
 * Dollarzeichen, und die dürfen durch diese Änderung nicht anders aussehen.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import katex from "katex";
import {
  teile, hatFormel, bruch, hoch, tief, alsKlartext, alsSprache, hochAlsPotenz,
} from "../src/core/formel.js";
import { normalisiere, formelStimmt, pruefe } from "../src/core/text.js";

test("Text ohne Formel bleibt ein einziges Stück", () => {
  assert.deepEqual(teile("Kategorischer Imperativ"), [{ formel: false, inhalt: "Kategorischer Imperativ" }]);
  assert.deepEqual(teile(""), []);
  assert.equal(hatFormel("x² + 1"), false);
});

test("Formeln zwischen Dollarzeichen werden erkannt", () => {
  assert.deepEqual(teile("f(x) = $\\frac{1}{x}$ für x ≠ 0"), [
    { formel: false, inhalt: "f(x) = " },
    { formel: true, inhalt: "\\frac{1}{x}" },
    { formel: false, inhalt: " für x ≠ 0" },
  ]);
});

/* „Kostet 5 $" soll kein halber Formelsatz werden. */
test("ein einzelnes Dollarzeichen bleibt Text, \\$ ist ein echtes", () => {
  assert.deepEqual(teile("Kostet 5 $"), [{ formel: false, inhalt: "Kostet 5 $" }]);
  assert.deepEqual(teile("von \\$3 auf \\$5"), [{ formel: false, inhalt: "von $3 auf $5" }]);
  assert.equal(hatFormel("$$"), false, "leere Formel ist keine");
});

test("ein Bruch wird zur Formel, die KaTeX setzen kann", () => {
  const b = bruch("x+1", "x−1");
  assert.equal(b, "$\\frac{x+1}{x−1}$");
  const [stueck] = teile(b);
  assert.doesNotThrow(() => katex.renderToString(stueck.inhalt, { throwOnError: true, strict: "ignore" }));
  // Mit Hochzahl im Zähler
  assert.doesNotThrow(() => katex.renderToString(teile(bruch("x²", "2"))[0].inhalt,
    { throwOnError: true, strict: "ignore" }));
});

/* Geschweifte Klammern im Zaehler duerfen die Formel nicht zerbrechen. */
test("Klammern und Sonderzeichen im Bruch werden geschützt", () => {
  const b = bruch("{a}", "50 %");
  assert.doesNotThrow(() => katex.renderToString(teile(b)[0].inhalt, { throwOnError: true, strict: "ignore" }));
});

test("Hochzahlen: beliebige Ziffern und Vorzeichen", () => {
  assert.deepEqual(hoch("12"), { text: "¹²", fehlt: [] });
  assert.deepEqual(hoch("-3"), { text: "⁻³", fehlt: [] });
  assert.deepEqual(hoch("n+1"), { text: "ⁿ⁺¹", fehlt: [] });
  assert.deepEqual(hoch("2x"), { text: "²ˣ", fehlt: [] });
});

test("was sich nicht hochstellen lässt, bleibt stehen und wird genannt", () => {
  const e = hoch("2q");
  assert.equal(e.text, "²q");
  assert.deepEqual(e.fehlt, ["q"]);
  assert.deepEqual(hoch("A").fehlt, ["A"], "Großbuchstaben gibt es hochgestellt nicht");
});

test("Tiefstellung für Indizes", () => {
  assert.deepEqual(tief("12"), { text: "₁₂", fehlt: [] });
  assert.deepEqual(tief("n-1"), { text: "ₙ₋₁", fehlt: [] });
});

test("Klartext für Vergleich und Vorlesen", () => {
  assert.equal(alsKlartext("$\\frac{1}{2}$"), "1/2");
  assert.equal(alsKlartext("$\\frac{x+1}{2}$"), "(x+1)/2");
  assert.equal(alsKlartext("f(x) = $\\frac{1}{x^{2}}$"), "f(x) = 1/x²");
  assert.equal(alsKlartext("$\\frac{\\frac{1}{2}}{3}$"), "(1/2)/3", "verschachtelt");
  assert.equal(alsKlartext("ohne Formel"), "ohne Formel");
  assert.equal(alsSprache("$\\frac{1}{2}$"), "1 durch 2");
  assert.match(alsSprache("x²"), /x hoch 2/);
});

test("hochgestellte Ziffern werden beim Vergleich zu ^", () => {
  assert.equal(hochAlsPotenz("x²+y¹²"), "x^2+y^12");
});

/* Wer bei einer Karte mit Bruch „1/2" tippt, hat richtig geantwortet. */
test("getippte Antworten treffen die Formel", () => {
  assert.equal(pruefe("1/2", "$\\frac{1}{2}$").status, "richtig");
  assert.ok(formelStimmt("x^2", "x²"), "Hochzahl getippt oder als Zeichen");
  assert.ok(formelStimmt("(x+1)/2", "$\\frac{x+1}{2}$"));
  assert.equal(normalisiere("Haus"), normalisiere("Haus"), "gewöhnlicher Text unverändert");
});
