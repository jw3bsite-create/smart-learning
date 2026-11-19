/*
 * Die Mitteilungen hinter der Glocke: wenige, nur mit Anlass, die
 * dringendsten zuerst — und „Ausblenden“ hält eine Weile.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { neuerZustand, bewerteKarte } from "../src/core/fsrs.js";
import { mitteilungenBilden, verworfenAufraeumen, HOECHSTENS, RUHE } from "../src/core/mitteilungen.js";

const JETZT = new Date(2026, 10, 19, 15).getTime();
const TAG = 86400000;

function bestand({ ruhtSeit = null, pruefungIn = null, letzterAbruf = null } = {}) {
  const faecher = [{ id: "de", name: "Deutsch", ...(pruefungIn !== null ? { pruefungsdatum: JETZT + pruefungIn * TAG - 3600000 } : {}) }];
  const stapel = [
    { id: "s1", subjectId: "de", title: "Märchen" },
    { id: "s2", subjectId: "de", title: "Romantik", ...(ruhtSeit !== null ? { ruht: { seit: JETZT - ruhtSeit * TAG, tage: 50 } } : {}) },
  ];
  const karten = ["a", "b", "c"].map((id, i) => ({ id, setId: i < 2 ? "s1" : "s2", term: id, definition: id }));
  const zustaende = Object.fromEntries(karten.map((k) => [k.id + ":td",
    bewerteKarte(neuerZustand(k.id, "td", k.setId, "de", JETZT - 40 * TAG), 3, { zeit: JETZT - 40 * TAG })]));
  const reviews = letzterAbruf === null ? [] : [
    { id: "r1", cardId: "a", subjectId: "de", flag: "normal", zeit: JETZT - letzterAbruf * TAG },
    { id: "r2", cardId: "a", subjectId: "de", flag: "practice", zeit: JETZT - 1 * TAG },
  ];
  const stapelVon = (id) => stapel.find((s) => s.id === id) || null;
  return { faecher, stapel, karten, zustaende, reviews, stapelVon, zeit: JETZT };
}

test("ohne Anlass: keine Mitteilung", () => {
  assert.deepEqual(mitteilungenBilden(bestand({ letzterAbruf: 2, ruhtSeit: 10 })), []);
});

test("ein Stapel ruht länger als gewünscht", () => {
  const [m] = mitteilungenBilden(bestand({ ruhtSeit: 51 }));
  assert.equal(m.art, "ruht");
  assert.equal(m.stapelId, "s2");
  assert.match(m.text, /„Romantik“ ruht seit 51 Tagen\. Zurückgeholt wäre eine Karte fällig\./);
});

test("lange nicht abgerufen zählt nur echte Abrufe, nicht Übung", () => {
  const [m] = mitteilungenBilden(bestand({ letzterAbruf: 24 }));
  assert.equal(m.art, "lange");
  assert.equal(m.text, "Deutsch: seit 3 Wochen nicht abgerufen, 3 Karten fällig.");
  assert.deepEqual(mitteilungenBilden(bestand({ letzterAbruf: null })), [], "nie begonnen: kein seit");
});

test("die Prüfung steht vorn", () => {
  const liste = mitteilungenBilden(bestand({ pruefungIn: 4, ruhtSeit: 60, letzterAbruf: 30 }));
  assert.deepEqual(liste.map((m) => m.art), ["pruefung", "ruht", "lange"]);
  assert.equal(liste[0].text, "Deutsch: Prüfung in 4 Tagen, 2 Karten offen.", "der ruhende Stapel zählt nicht mit");
  assert.ok(liste.length <= HOECHSTENS);
});

test("Ausblenden hält eine Weile, danach kommt sie wieder", () => {
  const b = bestand({ letzterAbruf: 24 });
  const [m] = mitteilungenBilden(b);
  const verworfen = { [m.id]: JETZT + RUHE.lange };
  assert.deepEqual(mitteilungenBilden({ ...b, verworfen }), []);
  assert.equal(mitteilungenBilden({ ...b, verworfen, zeit: JETZT + RUHE.lange + 1 }).length, 1);
  assert.deepEqual(verworfenAufraeumen(verworfen, JETZT + RUHE.lange + 1), {});
});
