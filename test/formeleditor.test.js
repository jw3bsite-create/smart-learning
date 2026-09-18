/*
 * Formel-Editor: Was er schreibt, muss die Anzeige setzen können.
 *
 * Der Editor (MathLive) und die Anzeige (KaTeX) sind zwei Programme. Kennt
 * die Anzeige einen Befehl nicht, den der Editor schreibt, steht auf der
 * Karte eine rote Fehlermeldung — und zwar erst beim Lernen, nicht beim
 * Anlegen. Darum wird hier jeder Baustein und jedes Zeichen gesetzt.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import katex from "katex";
import { FORMEL_BAUSTEINE, FORMEL_ZEICHEN } from "../src/core/zeichen.js";
import { editorZuKatex, formelStellen, ersetzeFormel, teile } from "../src/core/formel.js";

const setzbar = (latex) => {
  katex.renderToString(latex, { throwOnError: true, strict: "ignore" });
  return true;
};

/* Platzhalter so füllen, wie der Nutzer es täte. */
const ausgefuellt = (vorlage) => vorlage.replace(/#[@?0]/g, "x");

test("jedes Knopfbild lässt sich setzen", () => {
  for (const [name, , bild] of FORMEL_BAUSTEINE)
    assert.ok(setzbar(bild), name);
});

test("jeder Baustein ergibt ausgefüllt gültiges LaTeX", () => {
  for (const [name, vorlage] of FORMEL_BAUSTEINE)
    assert.doesNotThrow(() => setzbar(ausgefuellt(vorlage)), name + ": " + ausgefuellt(vorlage));
});

test("jedes Zeichen lässt sich setzen", () => {
  for (const g of FORMEL_ZEICHEN)
    for (const [zeichen, latex] of g.zeichen)
      assert.doesNotThrow(() => setzbar(ausgefuellt(latex)), g.gruppe + " " + zeichen + ": " + latex);
});

test("die Gruppen des Editors decken die Zeichenleiste ab", () => {
  const namen = FORMEL_ZEICHEN.map((g) => g.gruppe);
  for (const g of ["Rechnen", "Analysis", "Mengen & Logik", "Griechisch"])
    assert.ok(namen.includes(g), g);
  assert.ok(FORMEL_ZEICHEN.find((g) => g.gruppe === "Griechisch").zeichen.some(([z]) => z === "π"));
});

/* Der Fall aus der Rückmeldung: π im Bruch. */
test("π im Bruch geht durch Editor und Anzeige", () => {
  const vomEditor = "\\frac{2\\pi}{3}";
  assert.ok(setzbar(editorZuKatex(vomEditor)));
});

test("Sonderbefehle des Editors werden für die Anzeige übersetzt", () => {
  assert.equal(editorZuKatex("\\int_0^1 x\\,\\differentialD x"), "\\int_0^1 x\\,\\mathrm{d} x");
  assert.equal(editorZuKatex("\\exponentialE^{x}"), "\\mathrm{e}^{x}");
  assert.equal(editorZuKatex("\\frac{\\placeholder{}}{2}"), "\\frac{}{2}");
  assert.ok(setzbar(editorZuKatex("\\exponentialE^{\\imaginaryI\\pi}")));
});

test("Formeln im Text werden gefunden, mit Stelle", () => {
  const text = "f(x) = $\\frac{1}{x}$ und g = $x^{2}$.";
  const stellen = formelStellen(text);
  assert.equal(stellen.length, 2);
  assert.equal(text.slice(stellen[0].anfang, stellen[0].ende), "$\\frac{1}{x}$");
  assert.equal(stellen[1].inhalt, "x^{2}");
  assert.deepEqual(formelStellen("kostet 5 $"), [], "einzelnes Dollarzeichen ist keine Formel");
  // Stellen und Zerlegung zählen dieselben Formeln
  assert.equal(stellen.length, teile(text).filter((t) => t.formel).length);
});

test("eine Formel wird an ihrer Stelle ersetzt, der Text drumherum bleibt", () => {
  const text = "f(x) = $\\frac{1}{x}$ und g = $x^{2}$.";
  const [erste, zweite] = formelStellen(text);
  assert.equal(ersetzeFormel(text, zweite, "x^{3}"), "f(x) = $\\frac{1}{x}$ und g = $x^{3}$.");
  assert.equal(ersetzeFormel(text, erste, "\\frac{\\pi}{x}"), "f(x) = $\\frac{\\pi}{x}$ und g = $x^{2}$.");
  assert.equal(ersetzeFormel(text, erste, ""), "f(x) =  und g = $x^{2}$.", "leer entfernt die Formel");
});
