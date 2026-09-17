/*
 * Eigene Stimme: Kennungen, Formatwahl — und der Fall, der Aufnahmen
 * lautlos vernichten würde: das Aufräumen verwaister Mediendateien.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  tonSchluessel, tonTeile, istTon, seitenFuerRichtung, waehleTyp, TYPEN,
  dauerAnzeige, HOECHSTDAUER,
} from "../src/core/ton.js";
import { verwaisteMedien } from "../src/core/media.js";

test("die Kennung trägt Karte und Seite in sich", () => {
  const k = tonSchluessel("k_mu1_abc", "d");
  assert.equal(k, "ton_k_mu1_abc_d");
  assert.deepEqual(tonTeile(k), { cardId: "k_mu1_abc", seite: "d" });
  assert.ok(istTon(k));
});

/* Bilder heißen "b_…" und dürfen nicht als Aufnahme gelesen werden. */
test("andere Kennungen sind keine Aufnahmen", () => {
  for (const x of ["b_mu1_abc", "", null, undefined, "ton_", "ton_ohneseite"])
    assert.equal(tonTeile(x), null, String(x));
});

test("die Aufnahme gehört zur Kartenseite, nicht zur Richtung", () => {
  assert.deepEqual(seitenFuerRichtung("td"), { frage: "t", loesung: "d" });
  assert.deepEqual(seitenFuerRichtung("dt"), { frage: "d", loesung: "t" });
  // Dieselben Worte, dieselbe Aufnahme — egal, in welcher Richtung gefragt wird.
  assert.equal(tonSchluessel("k1", seitenFuerRichtung("td").loesung),
    tonSchluessel("k1", seitenFuerRichtung("dt").frage));
});

/* Ohne MP4 nimmt Safari auf iPhone und iPad gar nichts auf. */
test("die Formatwahl nimmt das erste, was der Browser kann", () => {
  assert.equal(waehleTyp(TYPEN, () => true), "audio/webm;codecs=opus");
  assert.equal(waehleTyp(TYPEN, (t) => t === "audio/mp4"), "audio/mp4");
  assert.equal(waehleTyp(TYPEN, () => false), "", "leer heißt: der Browser entscheidet");
  assert.ok(TYPEN.includes("audio/mp4"));
});

test("Dauern lesen sich als m:ss", () => {
  assert.equal(dauerAnzeige(0), "0:00");
  assert.equal(dauerAnzeige(7), "0:07");
  assert.equal(dauerAnzeige(75), "1:15");
  assert.equal(dauerAnzeige(HOECHSTDAUER), "1:30");
});

/* ===================== Aufräumen darf nichts fressen ==================== */

const karte = (id, extra = {}) => ({ id, termImage: null, defImage: null, ...extra });

test("Aufnahmen bleiben, solange ihre Karte da ist", () => {
  const karten = [karte("k1"), karte("k2", { defImage: "b_bild" })];
  const medien = [
    { id: "ton_k1_d" }, { id: "ton_k1_t" }, { id: "ton_k2_d" }, { id: "b_bild" },
  ];
  assert.deepEqual(verwaisteMedien(karten, [], medien), []);
});

/*
 * Der Fall, auf den es ankommt: Nach dem Abgleich kennt das zweite Gerät nur
 * die Datei, nicht ihre Zusatzangaben. Steckte die Zuordnung nicht in der
 * Kennung, wäre hier alles verwaist — und die eigene Stimme beim nächsten
 * Aufräumen weg.
 */
test("eine abgeglichene Aufnahme ohne Zusatzangaben bleibt erhalten", () => {
  const medien = [{ id: "ton_k1_d", blob: {}, type: "audio/mp4" }];   // kein cardId, kein sekunden
  assert.deepEqual(verwaisteMedien([karte("k1")], [], medien), []);
});

test("die Aufnahme einer gelöschten Karte wird erst mit dem Grabstein weggeräumt", () => {
  const grabstein = karte("k1", { deleted: true });
  assert.deepEqual(verwaisteMedien([grabstein], [], [{ id: "ton_k1_d" }]), [],
    "solange der Grabstein lebt, kann die Karte zurückkommen");
  assert.deepEqual(verwaisteMedien([], [], [{ id: "ton_k1_d" }]).map((m) => m.id),
    ["ton_k1_d"]);
});

test("verwaiste Bilder werden weiter erkannt", () => {
  const medien = [{ id: "b_alt" }, { id: "b_benutzt" }, { id: "b_entwurf" }];
  const verwaist = verwaisteMedien(
    [karte("k1", { termImage: "b_benutzt" })],
    [{ id: "e1", termImage: "b_entwurf" }],
    medien);
  assert.deepEqual(verwaist.map((m) => m.id), ["b_alt"]);
});
