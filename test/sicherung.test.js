/*
 * Sicherung: Namen, Inhaltsangabe und die Prüfung einer eingelesenen Datei.
 *
 * Der teuerste Fehler wäre „Alles ersetzen" mit einer halben Datei: Der
 * Bestand wäre weg, und an seiner Stelle stünde nichts. Darum prüft die App
 * vorher, und darum steht diese Prüfung unter Test.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FASSUNG, ERINNERUNG_TAGE, dateiname, inhaltsangabe, angabeText, groesseText,
  pruefeSicherung, tageSeit, sicherungFaellig, letzteText,
} from "../src/core/sicherung.js";

const TAG = 86400000;
const jetzt = new Date(2026, 8, 17, 12).getTime();

const gute = () => ({
  fassung: FASSUNG, erzeugt: jetzt - TAG,
  ordner: [{ id: "o1" }],
  stapel: [{ id: "s1" }, { id: "s2" }],
  karten: [{ id: "k1" }, { id: "k2" }, { id: "k3" }],
  faecher: [{ id: "f1" }],
  zustaende: [], reviews: [], entwuerfe: [], erklaerungen: [], pruefungen: [],
  notenfaecher: [{ id: "n1" }], lernzeiten: [{ id: "lz1" }],
  bilder: [{ id: "b_1" }, { id: "b_2" }, { id: "ton_k1_d" }],
  einstellungen: {},
});

test("der Dateiname trägt das Datum und sagt, was drin ist", () => {
  assert.equal(dateiname("voll", jetzt), "smart-learning-2026-09-17.json");
  assert.equal(dateiname("daten", jetzt), "smart-learning-2026-09-17-nur-daten.json");
  assert.equal(dateiname("karten", jetzt), "smart-learning-2026-09-17-karten.csv");
  assert.equal(dateiname("vorher", jetzt), "smart-learning-2026-09-17-vor-dem-einlesen.json");
});

test("die Inhaltsangabe trennt Bilder und Aufnahmen", () => {
  const a = inhaltsangabe(gute());
  assert.equal(a.stapel, 2);
  assert.equal(a.karten, 3);
  assert.equal(a.bilder, 2);
  assert.equal(a.toene, 1, "Tonaufnahmen liegen in derselben Liste wie Bilder");
  assert.equal(a.lernzeiten, 1);
  assert.match(angabeText(a), /2 Stapel, 3 Karten/);
  assert.match(angabeText(a), /1 Aufnahme/);
});

test("eine leere Angabe stürzt nicht ab", () => {
  const a = inhaltsangabe(undefined);
  assert.equal(a.karten, 0);
  assert.equal(angabeText(a), "0 Stapel, 0 Karten");
});

test("Größen lesen sich lesbar", () => {
  assert.equal(groesseText(512), "512 B");
  assert.equal(groesseText(2048), "2 KB");
  assert.equal(groesseText(8_800_000), "8,4 MB");
});

test("eine vollständige Sicherung wird angenommen", () => {
  const ergebnis = pruefeSicherung(gute());
  assert.equal(ergebnis.gut, true);
  assert.deepEqual(ergebnis.probleme, []);
});

test("Unfug wird abgelehnt, ehe er etwas anfasst", () => {
  for (const unfug of [null, 42, "text", [1, 2, 3]])
    assert.equal(pruefeSicherung(unfug).gut, false, String(unfug));
});

test("eine halbe Datei wird erkannt", () => {
  const ohneKarten = gute(); delete ohneKarten.karten;
  assert.equal(pruefeSicherung(ohneKarten).gut, false);
  assert.match(pruefeSicherung(ohneKarten).probleme.join(" "), /Karten/);

  const ohneStapel = { ...gute(), stapel: [] };
  assert.equal(pruefeSicherung(ohneStapel).gut, false);
  assert.match(pruefeSicherung(ohneStapel).probleme.join(" "), /keine Stapel/);
});

/* Eine Datei aus einer neueren Fassung koennte Ablagen enthalten, die diese
   App nicht kennt — sie einzulesen hiesse, sie beim naechsten Schreiben zu
   verlieren. */
test("eine Datei aus einer neueren Fassung wird nicht angenommen", () => {
  const neuer = { ...gute(), fassung: FASSUNG + 1 };
  const ergebnis = pruefeSicherung(neuer);
  assert.equal(ergebnis.gut, false);
  assert.match(ergebnis.probleme.join(" "), /neueren Fassung/);
});

test("eine Datei ohne Fassungsangabe gilt als unvollständig", () => {
  const ohne = gute(); delete ohne.fassung;
  assert.equal(pruefeSicherung(ohne).gut, false);
});

test("die Erinnerung zählt Tage, nicht Stunden", () => {
  assert.equal(tageSeit(jetzt - 3 * TAG, jetzt), 3);
  assert.equal(tageSeit(0, jetzt), null);
  assert.equal(letzteText(0, jetzt), "noch keine");
  assert.equal(letzteText(jetzt - 3600000, jetzt), "heute");
  assert.equal(letzteText(jetzt - TAG, jetzt), "gestern");
  assert.equal(letzteText(jetzt - 5 * TAG, jetzt), "vor 5 Tagen");
});

test("ohne Sicherung ist sofort eine fällig", () => {
  assert.equal(sicherungFaellig(0, jetzt), true);
  assert.equal(sicherungFaellig(jetzt - TAG, jetzt), false);
  assert.equal(sicherungFaellig(jetzt - (ERINNERUNG_TAGE - 1) * TAG, jetzt), false);
  assert.equal(sicherungFaellig(jetzt - ERINNERUNG_TAGE * TAG, jetzt), true);
});
