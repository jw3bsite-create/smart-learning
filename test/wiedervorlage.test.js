/*
 * Wiedervorlage in der Sitzung nach Richtigkeit und Erinnerungszeit
 * (core/wiedervorlage.js): Abstände relativ zum Stapel, langsam richtig
 * kommt einmal wieder, falsch bis zum richtigen Versuch, nach vier Fehlern
 * Problemkarte, nie dieselbe Karte direkt hintereinander.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  WERTE, median, stapelMedian, referenz, kappen, abstandFuer, langsamAbstandFuer,
  zeitenAusVerlauf, sitzungBeginnen, antworten, zusammenfassung,
} from "../src/core/wiedervorlage.js";

const ids = (n) => Array.from({ length: n }, (_, i) => "k" + i);
const folge = (s) => s.folge.map((e) => e.id + (e.grund === "erst" ? "" : "*"));

test("Abstand aus dem Stapel-Median: Vokabeln weit, Rechnen eng", () => {
  assert.equal(abstandFuer(6000), 10);       // 90/6 = 15 → höchstens 10
  assert.equal(abstandFuer(40000), 3);       // 90/40 ≈ 2 → mindestens 3
  assert.equal(abstandFuer(15000), 6);
  assert.equal(langsamAbstandFuer(15000), 12);
  assert.equal(langsamAbstandFuer(40000), 6);
  assert.equal(langsamAbstandFuer(6000), 20);
});

test("Mediane mit Startwert, Referenz der Karte erst ab zwei Werten", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(stapelMedian([1000, 2000]), WERTE.START_MEDIAN_MS);
  assert.equal(stapelMedian([1000, 2000, 3000, 4000, 5000]), 3000);
  assert.equal(referenz([4000], 9000), 9000);
  assert.equal(referenz([4000, 6000], 9000), 5000);
});

test("Ausreißer gekappt: höchstens dreimal der Median, nie über zwei Minuten", () => {
  assert.equal(kappen(50000, 8000), 24000);
  assert.equal(kappen(500000, 60000), 120000);
  assert.equal(kappen(5000, 8000), 5000);
});

test("aus dem Verlauf nur richtige Zeiten des Stapels", () => {
  const z = zeitenAusVerlauf([
    { setId: "s", cardId: "a", bewertung: 3, erinnerungszeit: 4000 },
    { setId: "s", cardId: "a", bewertung: 1, erinnerungszeit: 9000 },   // falsch: zählt nicht
    { setId: "s", cardId: "b", bewertung: 3, antwortzeit: 5000 },       // ohne Erinnerungszeit
    { setId: "t", cardId: "c", bewertung: 3, erinnerungszeit: 7000 },   // anderer Stapel
  ], "s");
  assert.deepEqual(z.stapel, [4000]);
  assert.deepEqual(z.jeKarte.get("a"), [4000]);
});

test("falsch: nach A Karten wieder, erledigt erst nach einem richtigen Versuch", () => {
  let s = sitzungBeginnen(ids(12));
  let r = antworten(s, 0, { richtig: false, zeitMs: 5000, referenzMs: 6000, stapelMs: 9000 });
  assert.equal(r.ergebnis.abstand, 10);
  assert.equal(r.sitzung.folge[11].id, "k0");
  assert.equal(r.sitzung.folge[11].grund, "falsch");
  s = r.sitzung;
  r = antworten(s, 11, { richtig: false, zeitMs: 5000, referenzMs: 6000, stapelMs: 9000 });
  assert.equal(r.ergebnis.art, "falsch", "wieder falsch: von vorn");
  r = antworten(r.sitzung, 12, { richtig: true, zeitMs: 5000, referenzMs: 6000, stapelMs: 9000 });
  assert.equal(r.ergebnis.art, "fertig");
});

test("richtig, aber langsam: einmal erneut mit doppeltem Abstand; schnell: fertig", () => {
  const s = sitzungBeginnen(ids(30));
  const langsam = antworten(s, 0, { richtig: true, zeitMs: 9100, referenzMs: 6000, stapelMs: 9000 });
  assert.deepEqual(langsam.ergebnis, { art: "langsam", abstand: 20 });
  assert.equal(langsam.sitzung.folge[21].grund, "langsam");
  const nochmal = antworten(langsam.sitzung, 21, { richtig: true, zeitMs: 12000, referenzMs: 6000, stapelMs: 9000 });
  assert.equal(nochmal.ergebnis.art, "fertig", "nur einmal wegen Langsamkeit");
  const schnell = antworten(s, 0, { richtig: true, zeitMs: 8900, referenzMs: 6000, stapelMs: 9000 });
  assert.equal(schnell.ergebnis.art, "fertig", "bis 1,5 × Referenz ist schnell genug");
  const dannFalsch = antworten(langsam.sitzung, 21, { richtig: false, zeitMs: 5000, referenzMs: 6000, stapelMs: 9000 });
  assert.equal(dannFalsch.ergebnis.art, "falsch", "langsam und dann falsch: Falsch-Regel");
});

test("nach vier Fehlern Problemkarte, nicht weiter wiederholt", () => {
  let s = sitzungBeginnen(["a", "b"]);
  let stelle = 0;
  let art;
  for (let i = 0; i < 4; i++) {
    while (s.folge[stelle].id !== "a") stelle += 1;
    ({ sitzung: s, ergebnis: { art } } = antworten(s, stelle, { richtig: false, zeitMs: 1, referenzMs: 1, stapelMs: 8000 }));
    stelle += 1;
  }
  assert.equal(art, "problem");
  assert.deepEqual(s.problem, ["a"]);
  assert.equal(s.folge.slice(stelle).filter((e) => e.id === "a").length, 0);
});

test("am Ende: Wiedervorlagen in der Reihenfolge ihres Fälligwerdens, nie direkt hintereinander", () => {
  let s = sitzungBeginnen(["a", "b", "c"]);
  s = antworten(s, 0, { richtig: false, zeitMs: 1, referenzMs: 1, stapelMs: 8000 }).sitzung;
  s = antworten(s, 1, { richtig: false, zeitMs: 1, referenzMs: 1, stapelMs: 8000 }).sitzung;
  assert.deepEqual(folge(s), ["a", "b", "c", "a*", "b*"]);
  s = antworten(s, 3, { richtig: false, zeitMs: 1, referenzMs: 1, stapelMs: 8000 }).sitzung;
  assert.deepEqual(folge(s), ["a", "b", "c", "a*", "b*", "a*"], "b dazwischen, nicht a direkt nach a");
  // Ist nur noch sie selbst übrig, darf sie direkt folgen.
  let einzeln = sitzungBeginnen(["x"]);
  einzeln = antworten(einzeln, 0, { richtig: false, zeitMs: 1, referenzMs: 1, stapelMs: 8000 }).sitzung;
  assert.deepEqual(folge(einzeln), ["x", "x*"]);
});

test("die Übersicht: Fehler, Problemkarten, mittlere Zeit je Stapel", () => {
  let s = sitzungBeginnen(["a", "b"]);
  s = antworten(s, 0, { richtig: true, zeitMs: 4000, referenzMs: 8000, stapelMs: 8000 }).sitzung;
  s = antworten(s, 1, { richtig: false, zeitMs: 9000, referenzMs: 8000, stapelMs: 8000 }).sitzung;
  s = antworten(s, 2, { richtig: true, zeitMs: 6000, referenzMs: 8000, stapelMs: 8000 }).sitzung;
  const z = zusammenfassung(s, () => "s1");
  assert.equal(z.fehler, 1);
  assert.equal(z.wiedervorlagen, 1);
  assert.deepEqual(z.mittel, [{ stapel: "s1", ms: 5000, anzahl: 2 }]);
  assert.equal(z.ersteRichtig, 1);
});
