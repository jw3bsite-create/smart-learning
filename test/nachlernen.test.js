/*
 * Nachlernen in derselben Sitzung und das Zurücknehmen einer Bewertung.
 */

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import * as db from "../src/core/db.js";
import { erzeugeBestand } from "../src/core/bestand.js";
import { wiederEinreihen, einreihungZuruecknehmen, ersterVersuch, ABSTAND } from "../src/core/nachlernen.js";

const liste = (n) => Array.from({ length: n }, (_, i) => ({ schluessel: "k" + i + ":td" }));

test("eine verfehlte Karte kommt ein paar Karten später zurück", () => {
  const a = liste(10);
  const neu = wiederEinreihen(a, 2, a[2]);
  assert.equal(neu.length, 11);
  assert.equal(neu[2 + 1 + ABSTAND].schluessel, "k2:td");
  assert.equal(neu[2 + 1 + ABSTAND].wiederholung, 1);
});

test("gegen Ende der Sitzung kommt sie ans Ende, nicht ins Leere", () => {
  const a = liste(4);
  const neu = wiederEinreihen(a, 2, a[2]);
  assert.equal(neu.at(-1).schluessel, "k2:td");
  assert.equal(neu[3].schluessel, "k3:td", "die übrige Karte kommt noch dazwischen");
});

test("höchstens zweimal je Karte", () => {
  let a = liste(3);
  a = wiederEinreihen(a, 0, a[0]);
  const zweite = a.find((x) => x.wiederholung === 1);
  a = wiederEinreihen(a, a.indexOf(zweite), zweite);
  const dritte = a.find((x) => x.wiederholung === 2);
  assert.equal(wiederEinreihen(a, a.indexOf(dritte), dritte), a);
});

test("Zurücknehmen entfernt genau die eingereihte Kopie", () => {
  const a = liste(6);
  const neu = wiederEinreihen(a, 1, a[1]);
  assert.deepEqual(einreihungZuruecknehmen(neu, 1, "k1:td", 1), a);
});

test("das Ergebnis zählt nur erste Versuche", () => {
  assert.equal([{ note: 1 }, { note: 3, wiederholung: 1 }].filter(ersterVersuch).length, 1);
});

/* ======================= Zurücknehmen im Speicher ======================= */

let uhr = Date.now();
const jetzt = () => uhr;
beforeEach(async () => {
  await db._zuruecksetzen();
  globalThis.indexedDB = new IDBFactory();
  uhr = Date.now();
});

test("eine zurückgenommene Bewertung ist weg, der Zustand wie zuvor — auch nach Neustart", async () => {
  let b = erzeugeBestand({ jetzt });
  await b.aktionen.laden();
  const s = await b.aktionen.stapelAnlegen("Englisch");
  const k = await b.aktionen.karteAnlegen(s.id, "Haus", "house");
  const karte = b.lesen().karten.find((x) => x.id === k.id);

  // Erste Bewertung: Gut. Die bleibt.
  await b.aktionen.abrufVerbuchen({ karte, stapel: s, bewertung: 3, antwortzeit: 4000 });
  const nachErster = b.lesen().zustaende[k.id + ":td"];

  // Zweite, aus Versehen: Leicht — und zurück.
  uhr += 2 * 86400000;
  const v = await b.aktionen.abrufVerbuchen({ karte, stapel: s, bewertung: 4, antwortzeit: 4000 });
  assert.notEqual(b.lesen().zustaende[k.id + ":td"].due, nachErster.due);
  uhr += 1000;
  await b.aktionen.abrufZuruecknehmen(v);

  for (const bestand of [b, await (async () => { await db._zuruecksetzen(); const n = erzeugeBestand({ jetzt }); await n.aktionen.laden(); return n; })()]) {
    const st = bestand.lesen();
    assert.equal(st.reviews.filter((r) => r.cardId === k.id).length, 1, "nur die erste Bewertung bleibt");
    const z = st.zustaende[k.id + ":td"];
    assert.equal(z.due, nachErster.due);
    assert.equal(z.reps, nachErster.reps);
  }
});

test("war die Karte vorher neu, ist sie es nach dem Zurücknehmen wieder", async () => {
  const b = erzeugeBestand({ jetzt });
  await b.aktionen.laden();
  const s = await b.aktionen.stapelAnlegen("Englisch");
  const k = await b.aktionen.karteAnlegen(s.id, "Baum", "tree");
  const karte = b.lesen().karten.find((x) => x.id === k.id);
  const v = await b.aktionen.abrufVerbuchen({ karte, stapel: s, bewertung: 3, antwortzeit: 4000 });
  await b.aktionen.abrufZuruecknehmen(v);
  const z = b.lesen().zustaende[k.id + ":td"];
  assert.ok(!z.reps, "keine Wiederholung mehr verbucht");
});
