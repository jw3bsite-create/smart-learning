/*
 * Dialoge übereinander, der Fokus darin, und welche Fehler oben erscheinen.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { auflegen, obenauf, anzahlOffen, naechstesZiel } from "../src/ui/dialogstapel.js";
import { stoerungsText } from "../src/core/stoerung.js";

/* ============================= Der Stapel ============================== */

/*
 * Eine Rückfrage über einem Fenster: Escape gilt nur ihr. Vorher schloss ein
 * Druck beide, und was im Fenster darunter stand, war weg.
 */
test("nur der oberste Dialog ist obenauf", () => {
  const fenster = {};
  const rueckfrage = {};
  const weg1 = auflegen(fenster);
  assert.equal(obenauf(fenster), true);
  const weg2 = auflegen(rueckfrage);
  assert.equal(obenauf(fenster), false, "das Fenster darunter darf nicht reagieren");
  assert.equal(obenauf(rueckfrage), true);
  weg2();
  assert.equal(obenauf(fenster), true, "nach der Rückfrage ist das Fenster wieder dran");
  weg1();
  assert.equal(anzahlOffen(), 0);
});

test("ein Dialog, der in der Mitte schließt, bringt die Reihenfolge nicht durcheinander", () => {
  const a = {}, b = {}, c = {};
  const wegA = auflegen(a);
  const wegB = auflegen(b);
  const wegC = auflegen(c);
  wegB();
  assert.equal(obenauf(c), true);
  wegC();
  assert.equal(obenauf(a), true);
  wegA();
  assert.equal(anzahlOffen(), 0);
});

test("doppeltes Abnehmen schadet nicht", () => {
  const a = {};
  const weg = auflegen(a);
  weg();
  weg();
  assert.equal(anzahlOffen(), 0);
});

/* ============================ Der Tabulator ============================ */

test("vom letzten Ziel geht es zum ersten", () => {
  const ziele = ["feld", "abbrechen", "ok"];
  assert.equal(naechstesZiel(ziele, "ok", false), "feld");
});

test("mit Umschalt vom ersten zum letzten", () => {
  const ziele = ["feld", "abbrechen", "ok"];
  assert.equal(naechstesZiel(ziele, "feld", true), "ok");
});

test("in der Mitte macht der Browser es selbst", () => {
  const ziele = ["feld", "abbrechen", "ok"];
  assert.equal(naechstesZiel(ziele, "abbrechen", false), null);
  assert.equal(naechstesZiel(ziele, "abbrechen", true), null);
});

test("steht der Fokus außerhalb, holt der Dialog ihn herein", () => {
  const ziele = ["feld", "ok"];
  assert.equal(naechstesZiel(ziele, "irgendwo", false), "feld");
  assert.equal(naechstesZiel(ziele, "irgendwo", true), "ok");
});

test("ohne Ziele bleibt der Fokus beim Dialog selbst", () => {
  assert.equal(naechstesZiel([], "irgendwo", false, "kasten"), "kasten");
});

/* =========================== Die Störungen ============================= */

test("ein gewöhnlicher Fehler wird gezeigt", () => {
  assert.equal(stoerungsText(new Error("Netz weg")), "Netz weg");
  assert.equal(stoerungsText("schlicht ein Text"), "schlicht ein Text");
});

test("gewollte Abbrüche des Browsers bleiben still", () => {
  const abgebrochen = Object.assign(new Error("The play() request was interrupted"), { name: "AbortError" });
  const verweigert = Object.assign(new Error("play() failed"), { name: "NotAllowedError" });
  assert.equal(stoerungsText(abgebrochen), null);
  assert.equal(stoerungsText(verweigert), null);
});

test("ohne Grund oder mit leerem Text kommt nichts", () => {
  assert.equal(stoerungsText(undefined), null);
  assert.equal(stoerungsText(null), null);
  assert.equal(stoerungsText(new Error("   ")), null);
});
