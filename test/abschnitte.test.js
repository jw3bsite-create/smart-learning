/*
 * Abschnitte in einem Stapel: Zwischenüberschriften, die keine Karten sind.
 */

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import * as db from "../src/core/db.js";
import { erzeugeBestand } from "../src/core/bestand.js";
import {
  gliederung, folgeVon, ausFolge, abschnittEntfernen, abschnittRuecken, abschnitteAusNamen,
  abschnittKennung, kartenInFolge,
} from "../src/core/abschnitte.js";
import { stapeldateiLesen, alsStapeldatei } from "../src/core/stapeldatei.js";

/* ============================ Die Regeln ================================ */

const abschnitte = [{ id: "m", titel: "Merkmale" }, { id: "w", titel: "Werke" }];
const karten = [
  { id: "k1", order: 0 },
  { id: "k2", order: 1, abschnitt: "w" },
  { id: "k3", order: 2, abschnitt: "m" },
  { id: "k4", order: 3, abschnitt: "weg" },          // Abschnitt gibt es nicht mehr
];

test("erst die Karten ohne Abschnitt, dann jeder Abschnitt mit seinen Karten", () => {
  assert.deepEqual(folgeVon(gliederung(karten, abschnitte)),
    ["k1", "k4", abschnittKennung("m"), "k3", abschnittKennung("w"), "k2"]);
});

test("eine Karte mit verschwundenem Abschnitt steht oben, nicht nirgends", () => {
  assert.ok(kartenInFolge(karten, abschnitte).some((k) => k.id === "k4"));
});

test("ohne Abschnitte bleibt alles, wie es war", () => {
  assert.deepEqual(folgeVon(gliederung(karten.slice(0, 1), [])), ["k1"]);
  assert.deepEqual(folgeVon(gliederung([{ id: "a", order: 2 }, { id: "b", order: 1 }])), ["b", "a"]);
});

test("aus der gezogenen Folge: Reihenfolge und Abschnitt jeder Karte", () => {
  const { reihenfolge, abschnittVon } = ausFolge(
    ["k1", abschnittKennung("m"), "k3", "k4", abschnittKennung("w"), "k2"]);
  assert.deepEqual(reihenfolge, ["k1", "k3", "k4", "k2"]);
  assert.equal(abschnittVon.get("k1"), null);
  assert.equal(abschnittVon.get("k4"), "m", "unter die Überschrift gezogen heißt: dort hinein");
  assert.equal(abschnittVon.get("k2"), "w");
});

test("eine entfernte Überschrift gibt ihre Karten an den Abschnitt davor", () => {
  assert.deepEqual(abschnittEntfernen(abschnitte, "w"), { abschnitte: [abschnitte[0]], ziel: "m" });
  assert.equal(abschnittEntfernen(abschnitte, "m").ziel, null, "der erste gibt sie nach oben");
});

test("Abschnitte rücken, aber nicht über den Rand", () => {
  assert.deepEqual(abschnittRuecken(abschnitte, "w", -1).map((a) => a.id), ["w", "m"]);
  assert.deepEqual(abschnittRuecken(abschnitte, "m", -1).map((a) => a.id), ["m", "w"]);
});

test("aus Namen werden Abschnitte, gleiche Namen einer", () => {
  let n = 0;
  const { abschnitte: neu, idVon } = abschnitteAusNamen(
    ["Merkmale", "", "Werke", " Merkmale ", undefined], () => "a" + ++n);
  assert.deepEqual(neu.map((a) => a.titel), ["Merkmale", "Werke"]);
  assert.equal(idVon("Merkmale"), idVon(" Merkmale"));
  assert.equal(idVon(""), null);
});

/* ============================ Stapeldatei =============================== */

test("die Stapeldatei trägt Überschriften hin und zurück", () => {
  const datei = JSON.stringify({
    format: "anchor-stapel", fassung: 1, titel: "Romantik",
    karten: [
      { vorderseite: "Epoche", rueckseite: "um 1795 bis 1835" },
      { abschnitt: "Merkmale", vorderseite: "Sehnsuchtsmotiv", rueckseite: "blaue Blume" },
    ],
  });
  const { stapel, fehler } = stapeldateiLesen(datei);
  assert.deepEqual(fehler, []);
  assert.equal(stapel.karten[0].abschnitt, undefined);
  assert.equal(stapel.karten[1].abschnitt, "Merkmale");

  const zurueck = JSON.parse(alsStapeldatei(
    { title: "Romantik", abschnitte: [{ id: "m", titel: "Merkmale" }] },
    [{ term: "a", definition: "b", abschnitt: "m" }, { term: "c", definition: "d" }]));
  assert.equal(zurueck.karten[0].abschnitt, "Merkmale");
  assert.equal(zurueck.karten[1].abschnitt, undefined);
});

/* ========================= Der ganze Weg ================================ */

let uhr = Date.now();
const jetzt = () => uhr;

beforeEach(async () => {
  await db._zuruecksetzen();
  globalThis.indexedDB = new IDBFactory();
  uhr = Date.now();
});

async function oeffnen() {
  const b = erzeugeBestand({ jetzt });
  await b.aktionen.laden();
  return b;
}

test("Abschnitte überstehen den Neustart; Entfernen behält die Karten", async () => {
  const b = await oeffnen();
  const s = await b.aktionen.stapelAnlegen("Romantik");
  await b.aktionen.karteAnlegen(s.id, "Epoche", "1795–1835");
  const m = await b.aktionen.abschnittAnlegen(s.id, "Merkmale");
  await b.aktionen.karteAnlegen(s.id, "Sehnsucht", "blaue Blume", m.id);
  const w = await b.aktionen.abschnittAnlegen(s.id, "Werke");
  await b.aktionen.karteAnlegen(s.id, "Novalis", "Heinrich von Ofterdingen", w.id);
  // Eine Karte, nachträglich in den ersten Abschnitt gelegt, rückt nach vorn.
  await b.aktionen.karteAnlegen(s.id, "Ironie", "romantische Ironie", m.id);

  const namen = (bestand) => {
    const st = bestand.lesen();
    const derStapel = st.stapel.find((x) => x.id === s.id);
    const ks = st.karten.filter((k) => k.setId === s.id);
    return gliederung(ks, derStapel.abschnitte || [])
      .map((e) => (e.art === "karte" ? e.karte.term : "# " + e.abschnitt.titel));
  };
  assert.deepEqual(namen(b), ["Epoche", "# Merkmale", "Sehnsucht", "Ironie", "# Werke", "Novalis"]);

  // Die Übungsmodi fragen nach `order` ab: Die muss der Anzeige folgen.
  const nachOrder = b.lesen().karten.filter((k) => k.setId === s.id)
    .sort((x, y) => x.order - y.order).map((k) => k.term);
  assert.deepEqual(nachOrder, ["Epoche", "Sehnsucht", "Ironie", "Novalis"]);

  await db._zuruecksetzen();
  let n = await oeffnen();
  assert.deepEqual(namen(n), ["Epoche", "# Merkmale", "Sehnsucht", "Ironie", "# Werke", "Novalis"]);

  uhr += 1000;
  await n.aktionen.abschnittEntfernen(s.id, w.id);
  await db._zuruecksetzen();
  n = await oeffnen();
  assert.deepEqual(namen(n), ["Epoche", "# Merkmale", "Sehnsucht", "Ironie", "Novalis"],
    "Novalis ist noch da, jetzt unter „Merkmale“");
  assert.equal(n.lesen().karten.filter((k) => k.setId === s.id && !k.deleted).length, 4);
});

test("Ziehen unter eine andere Überschrift ordnet die Karte dort ein", async () => {
  const b = await oeffnen();
  const s = await b.aktionen.stapelAnlegen("Romantik");
  const k1 = await b.aktionen.karteAnlegen(s.id, "Epoche", "x");
  const m = await b.aktionen.abschnittAnlegen(s.id, "Merkmale");
  const folge = [abschnittKennung(m.id), k1.id];
  await b.aktionen.kartenGliedern(s.id, folge);
  assert.equal(b.lesen().karten.find((k) => k.id === k1.id).abschnitt, m.id);
});
