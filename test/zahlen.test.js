/*
 * Dieselbe Sache, dieselbe Zahl (Wunsch des Nutzers, 27.11.2026).
 *
 * Vorher sagte die Startseite „101 offen“, „Alles abrufen“ zeigte 47, das
 * Abrufen selbst brachte eine dritte Zahl. Jetzt rechnet jede Stelle, die
 * sagt, wie viel wartet, mit `heuteAnstehend` — und das ist die Sitzung
 * selbst: alles Fällige und neue Karten bis zum Tageslimit. Stapel ohne Fach
 * kommen nirgends vor, wie es auf der Fächerseite steht.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { neuerZustand, bewerteKarte } from "../src/core/fsrs.js";
import { baueSitzung, baueWeitere, fachZaehlung, heuteAnstehend } from "../src/core/warteschlange.js";

const JETZT = new Date(2026, 10, 27, 15).getTime();
const TAG = 86400000;

const faecher = [{ id: "de", neuProTag: 3 }, { id: "ma", neuProTag: 2 }];
const faecherVon = () => faecher;
const stapelListe = [
  { id: "s-de", subjectId: "de", title: "Deutsch" },
  { id: "s-ma", subjectId: "ma", title: "Mathe" },
  { id: "s-los", subjectId: null, title: "Ohne Fach" },
];
const stapelVon = (id) => stapelListe.find((s) => s.id === id) || null;

/* Je Stapel zehn Karten: vier vor zwanzig Tagen gelernt (heute fällig), sechs nie gesehen. */
const karten = [];
const zustaende = {};
for (const s of stapelListe) {
  for (let i = 0; i < 10; i++) {
    const k = { id: s.id + "-" + i, setId: s.id, term: "t" + i, definition: "d" + i };
    karten.push(k);
    if (i < 4) {
      zustaende[k.id + ":td"] = bewerteKarte(
        neuerZustand(k.id, "td", s.id, s.subjectId, JETZT - 20 * TAG), 3, { zeit: JETZT - 20 * TAG });
    }
  }
}
const eingaben = { karten, zustaende, stapelVon, faecherVon, zeit: JETZT };

test("heute anstehend = fällig + neue bis zum Tageslimit, ohne Stapel ohne Fach", () => {
  const h = heuteAnstehend(eingaben);
  assert.equal(h.faellig, 8, "je vier fällig in Deutsch und Mathe — der Stapel ohne Fach zählt nicht");
  assert.equal(h.ungesehen, 12, "je sechs nie gesehen in beiden Fächern");
  assert.equal(h.neu, 5, "Tageslimit 3 + 2");
  assert.equal(h.gesamt, 13);
});

test("die Zahl ist genau die Größe der Sitzung, die das Abrufen baut", () => {
  const s = baueSitzung({ ...eingaben, umfang: 100000 });
  assert.equal(s.aufgaben.length, heuteAnstehend(eingaben).gesamt);
  assert.ok(s.aufgaben.every((a) => a.fachId), "keine Aufgabe ohne Fach");
});

test("je Fach gilt dessen eigenes Tageslimit", () => {
  const de = heuteAnstehend({ ...eingaben, fach: faecher[0] });
  assert.deepEqual([de.faellig, de.neu, de.gesamt, de.ungesehen], [4, 3, 7, 6]);
  const ma = heuteAnstehend({ ...eingaben, fach: faecher[1] });
  assert.deepEqual([ma.faellig, ma.neu, ma.gesamt], [4, 2, 6]);
});

test("Stapel ohne Fach kommen nirgends vor", () => {
  const ueberAlles = fachZaehlung(karten, zustaende, stapelVon, null, JETZT);
  assert.equal(ueberAlles.faellig, 8);
  assert.equal(ueberAlles.neu, 12);
  const weitere = baueWeitere({ karten, zustaende, stapelVon, art: "neu", umfang: 100, zeit: JETZT });
  assert.ok(weitere.aufgaben.every((a) => a.fachId), "auch „weitermachen“ nimmt sie nicht");
});

test("ein Stapel, dessen Fach es nicht mehr gibt, zählt nicht mit", () => {
  const verwaist = { id: "s-weg", subjectId: "geloescht", title: "Verwaist" };
  const mehr = [...stapelListe, verwaist];
  const k = { id: "w-1", setId: "s-weg", term: "x", definition: "y" };
  const h = heuteAnstehend({ ...eingaben, karten: [...karten, k], stapelVon: (id) => mehr.find((s) => s.id === id) || null });
  assert.equal(h.gesamt, 13);
});

test("jedes Fach bekommt höchstens sein eigenes Limit, auch über „alle Fächer“", () => {
  /* Mathe hat nur eine nie gesehene Karte, aber ein großes Limit. Dessen
     Rest darf nicht an Deutsch gehen — früher wurden die Limits addiert. */
  const grosszuegig = [{ id: "de", neuProTag: 3 }, { id: "ma", neuProTag: 15 }];
  const nurEineNeue = karten.filter((k) => k.setId !== "s-ma" || zustaende[k.id + ":td"] || k.id === "s-ma-9");
  const e = { ...eingaben, karten: nurEineNeue, faecherVon: () => grosszuegig };
  const h = heuteAnstehend(e);
  assert.equal(h.neu, 4, "3 aus Deutsch + 1 aus Mathe, nicht 7");
  const summeJeFach = grosszuegig
    .map((f) => heuteAnstehend({ ...e, fach: f }).gesamt)
    .reduce((a, b) => a + b, 0);
  assert.equal(summeJeFach, h.gesamt, "die Fächer zusammen ergeben genau die Gesamtzahl");
  const s = baueSitzung({ ...e, umfang: 100000 });
  assert.equal(s.aufgaben.filter((a) => a.fachId === "de" && !a.zustand).length, 3);
});

test("„hängt“ zählt Karten, nicht Richtungen — wie das Fehlerheft", () => {
  const zwei = { id: "z-1", setId: "s-de", term: "a", definition: "b" };
  const stapelBeide = [{ id: "s-de", subjectId: "de", title: "Deutsch", richtung: "beide" }];
  const z = {
    "z-1:td": { gesperrt: true, cardId: "z-1", richtung: "td" },
    "z-1:dt": { gesperrt: true, cardId: "z-1", richtung: "dt" },
  };
  const zaehlung = fachZaehlung([zwei], z, (id) => stapelBeide.find((s) => s.id === id) || null, "de", JETZT);
  assert.equal(zaehlung.gesperrtKarten, 1, "eine Karte, auch wenn beide Richtungen hängen");
  assert.ok(zaehlung.gesperrt >= 1);
});

test("wie lange eine Abfrage dauert: Median der letzten echten Antworten", async () => {
  const { sekundenJeAbfrage } = await import("../src/core/warteschlange.js");
  assert.equal(sekundenJeAbfrage([]), null, "ohne Antworten keine Schätzung");
  const r = (ms, i, flag = "normal") => ({ antwortzeit: ms, zeit: 1000 + i, flag });
  const reviews = [...Array(11)].map((_, i) => r(10000, i));
  reviews.push(r(500, 99, "implausible"));             // Durchklicken zählt nicht
  reviews.push(r(600000, 100));                         // zehn Minuten: gekappt
  assert.equal(sekundenJeAbfrage(reviews), 10);
});
