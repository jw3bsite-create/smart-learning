/*
 * Lernzeit: Die Zahl soll ehrlich sein. Geprüft wird vor allem, was NICHT
 * zählen darf — Pausen, Übersichtsseiten, Durchklicken.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Stoppuhr, taetigkeitFuer, LEERLAUF, MINDEST, summe, zeitraeume, verlauf, jeFach,
  dauerText, dauerKurz, wochenBeginn, kalenderwoche,
} from "../src/core/lernzeit.js";

const SEK = 1000;
const MIN = 60 * SEK;
let zaehler = 0;
const neueUhr = () => new Stoppuhr({ kennung: () => "b" + (++zaehler) });
const abrufen = taetigkeitFuer(["abrufen"]);
const bearbeiten = taetigkeitFuer(["stapel", "s1", "bearbeiten"], () => "f1");

/* ============================== Was zählt ============================== */

test("Lernmodi zählen als Lernen, Bearbeiten als Erstellen", () => {
  assert.equal(taetigkeitFuer(["abrufen", "f2"]).art, "lernen");
  assert.equal(taetigkeitFuer(["abrufen", "f2"]).subjectId, "f2");
  for (const modus of ["karten", "lernen", "schreiben", "buchstabieren", "test", "zuordnen", "meteor"])
    assert.equal(taetigkeitFuer(["stapel", "s1", modus]).art, "lernen", modus);
  for (const weg of [["erklaeren"], ["pruefung"], ["tutor"], ["fragen"], ["vorab", "s1"]])
    assert.equal(taetigkeitFuer(weg).art, "lernen", weg.join("/"));
  assert.equal(bearbeiten.art, "erstellen");
  assert.equal(bearbeiten.subjectId, "f1", "das Fach kommt über den Stapel");
  assert.equal(taetigkeitFuer(["stapel", "s1", "entwuerfe"]).art, "erstellen");
});

test("Übersichten zählen nicht", () => {
  for (const weg of [[], ["start"], ["faecher"], ["fach", "f1"], ["stapel", "s1"], ["ordner", "o1"],
    ["statistik"], ["punkte"], ["einstellungen"], ["papierkorb"], ["suche", "x"], ["kalibrierung"]])
    assert.equal(taetigkeitFuer(weg), null, "/" + weg.join("/"));
});

/* ============================== Die Stoppuhr ============================ */

test("durchgehendes Lernen wird ganz gezählt", () => {
  const uhr = neueUhr();
  for (let t = 0; t <= 10 * MIN; t += 30 * SEK) assert.deepEqual(uhr.regung(t, abrufen), []);
  const [b] = uhr.anhalten();
  assert.equal(b.sekunden, 600);
  assert.equal(b.art, "lernen");
});

test("eine lange Pause zählt nicht — auch nicht nachträglich", () => {
  const uhr = neueUhr();
  for (let t = 0; t <= 5 * MIN; t += 30 * SEK) uhr.regung(t, abrufen);   // 5 Min. gelernt
  const fertig = uhr.regung(5 * MIN + LEERLAUF + SEK, abrufen); // dann weg vom Tisch
  assert.equal(fertig.length, 1);
  assert.equal(fertig[0].sekunden, 300, "die Pause gehört nicht dazu");
  uhr.regung(5 * MIN + LEERLAUF + SEK + MIN, abrufen);
  const [zweiter] = uhr.anhalten();
  assert.equal(zweiter.sekunden, 60);
  assert.notEqual(zweiter.id, fertig[0].id);
});

test("eine kurze Denkpause gehört dazu", () => {
  const uhr = neueUhr();
  uhr.regung(0, abrufen);
  uhr.regung(LEERLAUF, abrufen);                           // genau an der Grenze
  assert.equal(uhr.anhalten()[0].sekunden, LEERLAUF / SEK);
});

test("offen ohne Handlung ergibt nichts", () => {
  const uhr = neueUhr();
  uhr.regung(0, abrufen);                                  // nur geöffnet
  assert.equal(uhr.stand(), null);
  assert.deepEqual(uhr.anhalten(), [], "ein einzelner Klick ist kein Lernen");
});

test("Durchklicken unter der Mindestdauer wird verworfen", () => {
  const uhr = neueUhr();
  uhr.regung(0, abrufen);
  uhr.regung(MINDEST - SEK, abrufen);
  assert.deepEqual(uhr.anhalten(), []);
});

test("ein Seitenwechsel schließt den Block und beginnt einen neuen", () => {
  const uhr = neueUhr();
  uhr.regung(0, abrufen);
  uhr.regung(LEERLAUF, abrufen);
  const fertig = uhr.regung(LEERLAUF + SEK, bearbeiten);
  assert.equal(fertig.length, 1);
  assert.equal(fertig[0].art, "lernen");
  assert.equal(fertig[0].sekunden, LEERLAUF / SEK);
  for (let t = LEERLAUF + MIN; t <= LEERLAUF + 3 * MIN; t += MIN) uhr.regung(t, bearbeiten);
  const [b] = uhr.anhalten();
  assert.equal(b.art, "erstellen");
  assert.equal(b.setId, "s1");
  assert.equal(b.sekunden, 179, "der erste Klick zaehlt erst ab seinem Zeitpunkt");
});

test("auf eine Übersicht zu wechseln hält die Uhr an", () => {
  const uhr = neueUhr();
  uhr.regung(0, abrufen);
  uhr.regung(MIN, abrufen);
  const fertig = uhr.regung(MIN + SEK, null);
  assert.equal(fertig[0].sekunden, 60);
  assert.equal(uhr.block, null);
  assert.deepEqual(uhr.regung(2 * MIN, null), [], "Klicken auf der Übersicht zählt nicht");
});

test("der laufende Block lässt sich zwischendurch sichern, unter derselben Kennung", () => {
  const uhr = neueUhr();
  uhr.regung(0, abrufen);
  uhr.regung(MIN, abrufen);
  const erst = uhr.stand();
  uhr.regung(2 * MIN, abrufen);
  const dann = uhr.stand();
  assert.equal(erst.id, dann.id);
  assert.equal(dann.sekunden, 120);
  assert.equal(uhr.anhalten()[0].id, erst.id, "am Ende wird derselbe Satz überschrieben, kein zweiter angelegt");
});

test("eine Uhr, die rückwärts geht, verkürzt nichts", () => {
  const uhr = neueUhr();
  uhr.regung(0, abrufen);
  uhr.regung(MIN, abrufen);
  uhr.regung(30 * SEK, abrufen);
  assert.equal(uhr.anhalten()[0].sekunden, 60);
});

/* ============================== Auswerten ============================== */

const block = (beginn, sekunden, art = "lernen", extra = {}) =>
  ({ id: "x" + (++zaehler), art, beginn, ende: beginn + sekunden * SEK, sekunden, deleted: false, ...extra });

const jetzt = new Date(2026, 8, 16, 18, 0).getTime();   // Mittwoch, 16. September 2026
const tag = (d, h = 17) => new Date(2026, 8, d, h).getTime();

test("die Woche beginnt am Montag", () => {
  assert.equal(new Date(wochenBeginn(jetzt)).getDate(), 14);
  assert.equal(new Date(wochenBeginn(tag(14, 0))).getDate(), 14);
  assert.equal(new Date(wochenBeginn(tag(13))).getDate(), 7, "Sonntag gehört zur alten Woche");
  assert.equal(kalenderwoche(jetzt), 38);
  assert.equal(kalenderwoche(new Date(2027, 0, 1).getTime()), 53);
});

test("heute, Woche, Monat, Jahr und insgesamt", () => {
  const bloecke = [
    block(tag(16), 600), block(tag(16), 300, "erstellen"),
    block(tag(14), 1200),                  // Montag dieser Woche
    block(tag(13), 900),                   // Sonntag davor
    block(tag(2), 60),                     // Anfang des Monats
    block(new Date(2026, 0, 5).getTime(), 100),
    block(new Date(2025, 11, 31).getTime(), 5000),
    block(tag(16), 999, "lernen", { deleted: true }),
  ];
  const r = zeitraeume(bloecke, jetzt);
  assert.deepEqual(r.heute, { lernen: 600, erstellen: 300 });
  assert.deepEqual(r.woche, { lernen: 1800, erstellen: 300 });
  assert.deepEqual(r.monat, { lernen: 2760, erstellen: 300 });
  assert.deepEqual(r.jahr, { lernen: 2860, erstellen: 300 });
  assert.deepEqual(r.gesamt, { lernen: 7860, erstellen: 300 });
});

test("der Verlauf hat die richtige Länge und endet heute", () => {
  const bloecke = [block(tag(16), 600), block(tag(3), 60), block(tag(2, 23), 30, "erstellen")];
  const tage = verlauf(bloecke, "tag", 14, jetzt);
  assert.equal(tage.length, 14);
  assert.equal(new Date(tage[13].beginn).getDate(), 16);
  assert.equal(new Date(tage[0].beginn).getDate(), 3);
  assert.equal(tage[13].lernen, 600);
  assert.equal(tage[0].lernen, 60);
  assert.equal(tage.reduce((s, t) => s + t.erstellen, 0), 0, "der 2. liegt außerhalb");

  const wochen = verlauf(bloecke, "woche", 3, jetzt);
  assert.equal(wochen[2].kurz, "KW 38");
  assert.equal(wochen[0].lernen + wochen[0].erstellen, 90, "2. und 3. September: KW 36");

  const monate = verlauf(bloecke, "monat", 12, jetzt);
  assert.equal(monate.length, 12);
  assert.equal(monate[11].kurz, "Sep");
  assert.equal(monate[0].kurz, "Okt");
  assert.deepEqual([monate[11].lernen, monate[11].erstellen], [660, 30]);
});

test("über die Zeitumstellung hinweg bleiben die Tage Tage", () => {
  const ende = new Date(2026, 9, 27, 12).getTime();       // nach der Umstellung am 25. Oktober
  const tage = verlauf([], "tag", 5, ende);
  for (const t of tage) assert.equal(new Date(t.beginn).getHours(), 0);
  assert.deepEqual(tage.map((t) => new Date(t.beginn).getDate()), [23, 24, 25, 26, 27]);
});

test("je Fach, das meiste zuerst, ohne Fach für sich", () => {
  const bloecke = [
    block(tag(16), 100, "lernen", { subjectId: "a" }),
    block(tag(16), 500, "lernen", { subjectId: "b" }),
    block(tag(16), 50, "erstellen", { subjectId: "a" }),
    block(tag(16), 70, "lernen", { subjectId: null }),
    block(tag(1), 9999, "lernen", { subjectId: "a" }),
  ];
  const liste = jeFach(bloecke, tag(10));
  assert.deepEqual(liste.map((f) => f.subjectId), ["b", "a", null]);
  assert.deepEqual(liste[1], { subjectId: "a", lernen: 100, erstellen: 50 });
  assert.equal(summe(bloecke).lernen, 10669);
});

test("Dauern lesen sich natürlich", () => {
  assert.equal(dauerText(0), "0 Min.");
  assert.equal(dauerText(40), "unter 1 Min.");
  assert.equal(dauerText(90), "2 Min.");
  assert.equal(dauerText(3600), "1 Std.");
  assert.equal(dauerText(3900), "1 Std. 5 Min.");
  assert.equal(dauerText(12 * 3600 + 600), "12 Std.");
  assert.equal(dauerKurz(1800), "30 m");
  assert.equal(dauerKurz(5400), "1,5 h");
  assert.equal(dauerKurz(15 * 3600), "15 h");
});
