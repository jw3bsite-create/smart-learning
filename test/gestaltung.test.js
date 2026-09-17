/*
 * Gestaltung: die Schriftliste und ihre Zusicherungen.
 *
 * Der stille Fehler, den es hier zu verhindern gilt: Ein umbenannter oder
 * entfernter Schlüssel steckt noch in gespeicherten Einstellungen. Die App
 * stünde dann plötzlich in einer anderen Schrift da — ohne Fehlermeldung.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SCHRIFTEN, SCHRIFT_GRUPPEN, PALETTEN, STANDARD_GESTALTUNG, DICHTEN, BREITEN,
  schriftenZurWahl, familienVon, stapelVorhanden, ersteFamilie, GATTUNGEN,
  istHell,
} from "../src/core/gestaltung.js";

test("die alten Schlüssel wirken weiter, stehen aber nicht zur Wahl", () => {
  for (const alt of ["serifen", "humanistisch", "schmal", "schreibmaschine", "buch"]) {
    assert.ok(SCHRIFTEN[alt], alt + " fehlt, gespeicherte Einstellungen zeigen ins Leere");
    assert.equal(SCHRIFTEN[alt].alt, true);
  }
  const zurWahl = Object.values(schriftenZurWahl()).flat().map((s) => s.schluessel);
  for (const alt of ["serifen", "humanistisch", "schmal", "buch"])
    assert.ok(!zurWahl.includes(alt), alt + " sollte nicht mehr angeboten werden");
});

test("jede Schrift zur Wahl trägt ihren wirklichen Namen und eine Gruppe", () => {
  for (const [schluessel, s] of Object.entries(SCHRIFTEN)) {
    if (s.alt) continue;
    assert.ok(s.name && s.name.length > 1, schluessel);
    assert.ok(SCHRIFT_GRUPPEN[s.gruppe], schluessel + ": Gruppe " + s.gruppe + " gibt es nicht");
    // Der Name soll der Schrift entsprechen, nicht einer Stilbeschreibung.
    if (!s.name.startsWith("System"))
      assert.equal(ersteFamilie(s.stapel), s.name, schluessel);
  }
});

/* Ohne Gattung am Ende steht die Seite auf einem fremden Gerät in der
   Standardschrift des Browsers — meist Times, und das ungewollt. */
test("jeder Stapel endet mit einer Gattung", () => {
  for (const [schluessel, s] of Object.entries(SCHRIFTEN)) {
    const letzte = s.stapel.split(",").pop().trim().toLowerCase();
    assert.ok(GATTUNGEN.has(letzte), schluessel + " endet auf " + letzte);
  }
});

test("die fertigen Zusammenstellungen zeigen auf vorhandene Werte", () => {
  for (const p of PALETTEN) {
    assert.ok(SCHRIFTEN[p.werte.schriftOberflaeche], p.name);
    assert.ok(SCHRIFTEN[p.werte.schriftKarten], p.name);
    assert.ok(DICHTEN[p.werte.dichte], p.name);
    assert.match(p.werte.akzent, /^#[0-9a-f]{6}$/i, p.name);
  }
  assert.ok(SCHRIFTEN[STANDARD_GESTALTUNG.schriftOberflaeche]);
  assert.ok(SCHRIFTEN[STANDARD_GESTALTUNG.schriftKarten]);
  assert.ok(BREITEN[STANDARD_GESTALTUNG.breite]);
});

test("Gattungsnamen zählen nicht als Schrift", () => {
  assert.deepEqual(familienVon('system-ui, -apple-system, "Segoe UI", sans-serif'),
    ["Segoe UI"]);
  assert.deepEqual(familienVon("ui-monospace, monospace"), []);
  assert.deepEqual(familienVon('Georgia, "Times New Roman", serif'),
    ["Georgia", "Times New Roman"]);
});

/* Ohne Fenster kann nichts gemessen werden; dann wird angeboten statt gewarnt. */
test("ohne Browser gilt jede Schrift als vorhanden", () => {
  assert.equal(typeof document, "undefined");
  assert.equal(stapelVorhanden('Georgia, "Times New Roman", serif'), true);
  assert.equal(stapelVorhanden("ui-monospace, monospace"), true);
});

test("die Schrift auf gefüllten Knöpfen richtet sich nach der Helligkeit", () => {
  assert.equal(istHell("#e8b84b"), true);      // Gelb braucht dunkle Schrift
  assert.equal(istHell("#5b8bff"), false);
});
