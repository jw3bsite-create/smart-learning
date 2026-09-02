/*
 * Prüfungen für den Abgleich mit der Wolke.
 *
 * Der Abgleich hat eine Eigenart, die ihn gefährlich macht: Er läuft über
 * `db.SYNCED`, übersetzt aber jede Ablage über eine zweite Liste in einen
 * Namen für die Tabelle. Fehlt dort ein Eintrag, merkt das niemand beim
 * Programmieren — es fällt erst auf, wenn jemand seine Geräte abgleicht und
 * der Lernstand nicht mitkommt.
 *
 * Genau so war es: Vier von zehn Ablagen standen in der Übersetzung. Ordner,
 * Stapel und Karten wären gewandert, der ganze Lernstand nicht.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { SYNCED, STORES } from "../src/core/db.js";
import { ARTEN } from "../src/core/cloud.js";

test("jede abzugleichende Ablage hat einen Namen in der Tabelle", () => {
  for (const ablage of SYNCED)
    assert.ok(ARTEN[ablage],
      `"${ablage}" wird abgeglichen, hat aber keinen Namen in ARTEN — `
      + "die Spalte `art` ist `not null`, der Abgleich bräche ab");
});

test("kein Name in der Übersetzung ohne zugehörige Ablage", () => {
  for (const ablage of Object.keys(ARTEN)) {
    assert.ok(STORES.includes(ablage), `ARTEN nennt "${ablage}", das es nicht gibt`);
    assert.ok(SYNCED.includes(ablage),
      `"${ablage}" steht in ARTEN, wird aber gar nicht abgeglichen`);
  }
});

/*
 * Die Namen stehen als Text in der Wolke. Ein geänderter Name macht die
 * bereits abgelegten Zeilen unauffindbar — sie wären nicht gelöscht, aber
 * niemand fände sie wieder. Darum stehen sie hier ein zweites Mal.
 */
test("die Namen in der Tabelle liegen fest", () => {
  assert.deepEqual(ARTEN, {
    folders: "ordner",
    sets: "stapel",
    cards: "karte",
    progress: "stand",
    subjects: "fach",
    cardstates: "zustand",
    reviews: "abruf",
    drafts: "entwurf",
    explanations: "erklaerung",
    exams: "pruefung",
  });
});

test("die Namen sind untereinander verschieden", () => {
  const namen = Object.values(ARTEN);
  assert.equal(new Set(namen).size, namen.length,
    "zwei Ablagen unter demselben Namen würden einander überschreiben");
});

/* ------------------------------ Die Tabelle ----------------------------- */

const sql = readFileSync(new URL("../wolke.sql", import.meta.url), "utf8");

test("die Tabelle steht unter Zeilenschutz", () => {
  assert.match(sql, /enable row level security/i,
    "ohne Zeilenschutz käme jede angemeldete Kennung an alle Zeilen");
});

/*
 * Vier Regeln, für jede Art des Zugriffs eine. Fehlte etwa die für das
 * Löschen, könnte ein Fremder zwar nichts lesen, aber alles wegräumen.
 */
test("für jeden Zugriff gibt es eine eigene Regel auf die eigene Kennung", () => {
  for (const zugriff of ["select", "insert", "update", "delete"])
    assert.match(sql, new RegExp("for\\s+" + zugriff, "i"),
      "keine Regel für " + zugriff);
  const treffer = sql.match(/auth\.uid\(\)\s*=\s*user_id/g) || [];
  assert.ok(treffer.length >= 5,
    "zu wenige Bedingungen auf die eigene Kennung — gefunden: " + treffer.length);
});

test("die Bilder liegen nicht öffentlich", () => {
  assert.match(sql, /values\s*\(\s*'bilder',\s*'bilder',\s*false\s*\)/i,
    "der Eimer für Bilder wäre öffentlich lesbar");
  assert.match(sql, /storage\.foldername\(name\)\)\[1\]\s*=\s*auth\.uid\(\)::text/i,
    "ohne diese Bedingung käme jede Kennung an fremde Bilder");
});

test("der Schlüssel der Tabelle ist Kennung und Datensatz zusammen", () => {
  assert.match(sql, /primary key\s*\(\s*user_id\s*,\s*id\s*\)/i,
    "sonst schlägt das Zusammenführen beim Abgleich fehl (onConflict user_id,id)");
});
