/*
 * Rechnungen werden streng geprüft, Vokabeln nachsichtig.
 *
 * Anlass: Mit den Vokabelregeln galt „x = −3" als „x = 3" — der häufigste
 * Fehler in Mathematik bekam einen grünen Haken.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { istMathe, matheGleich, gleichwertig, pruefe } from "../src/core/text.js";

test("Rechnungen und Zahlen werden als solche erkannt", () => {
  for (const t of ["x = -3", "cos(2x)", "f(x) = 2x", "1789", "(a+b)²", "$\\frac{\\pi}{3}$",
    "x = 2 oder x = -2", "3(2x+1)^2", "H₂O", "f'(x)"])
    assert.ok(istMathe(t), t + " ist eine Rechnung");
});

test("Sätze und Vokabeln bleiben Sprache", () => {
  for (const t of ["(to) go", "(sich) erinnern", "Ludwig XIV (1638-1715)", "das Haus",
    "la casa", "Die Ableitung beschreibt die Steigung", "3. Person Singular", ""])
    assert.ok(!istMathe(t), JSON.stringify(t) + " ist keine Rechnung");
});

test("das Vorzeichen zählt", () => {
  assert.equal(gleichwertig("x = -3", "x = 3"), false);
  assert.equal(gleichwertig("x = −3", "x = -3"), true, "Minus in beiden Schreibweisen");
  assert.equal(pruefe("x=-3", "x = 3").status, "falsch");
});

test("Klammern zählen", () => {
  assert.equal(gleichwertig("(a-b)²", "(a+b)²"), false);
  assert.equal(gleichwertig("3(2x-1)^2", "3(2x+1)^2"), false);
  assert.equal(gleichwertig("cos(x)", "cos(2x)"), false);
});

test("Zahlen haben keinen Tippfehler", () => {
  assert.equal(pruefe("x=12", "x=13").status, "falsch");
  assert.equal(pruefe("1798", "1789").status, "falsch");
});

test("Schreibweisen, die dasselbe meinen, gelten gleich", () => {
  assert.ok(matheGleich("2*x", "2x"));
  assert.ok(matheGleich("2·x", "2x"));
  assert.ok(matheGleich("x = 1.5", "x = 1,5"), "Dezimalkomma");
  assert.ok(matheGleich("x²", "x^2"), "Hochzahl");
  assert.ok(matheGleich("H2O", "H₂O"), "Tiefzahl");
  assert.ok(matheGleich("1/2", "$\\frac{1}{2}$"), "Bruch als Formel");
  assert.ok(matheGleich("f'(x) = 2x", "f´(x)=2·x"));
});

test("mehrere Lösungen in beliebiger Reihenfolge, aber alle", () => {
  assert.ok(matheGleich("x = -2 oder x = 2", "x = 2 oder x = -2"));
  assert.ok(!matheGleich("x = 2", "x = 2 oder x = -2"), "eine fehlt");
  assert.ok(matheGleich("x1 = 1; x2 = 3", "x₁ = 1; x₂ = 3"));
});

test("eine Dezimalzahl wird nicht als zwei Antworten gelesen", () => {
  assert.equal(pruefe("x = 1", "x = 1,5").status, "falsch",
    "früher zerfiel 1,5 in die Antworten 1 und 5");
});

test("Vokabeln behalten ihre Nachsicht", () => {
  assert.equal(pruefe("go", "(to) go").status, "richtig");
  assert.equal(pruefe("Haus", "das Haus").status, "richtig");
  assert.equal(pruefe("Hauss", "Haus").status, "fast");
  assert.ok(gleichwertig("erinnern", "(sich) erinnern"));
});

test("leer ist nie gleichwertig", () => {
  assert.equal(gleichwertig("", "x = 3"), false);
  assert.equal(gleichwertig("  ", "Haus"), false);
});
