/*
 * Prüfungen für die ausgebesserten Stellen.
 *
 * Jede davon steht für einen Fehler, der in der App war: Lückentexte mit
 * sichtbaren Klammern, verschwundene Rechenwege, zwei widersprüchliche
 * Lernstände. Die Prüfungen halten fest, dass sie nicht zurückkommen.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { seitenFuer } from "../src/core/kartenseiten.js";
import { stapelStand } from "../src/core/warteschlange.js";
import { neuerZustand, bewerteKarte, NOTEN, stufe } from "../src/core/fsrs.js";
import { neueKarte, neueMehrschrittKarte, schritteVon } from "../src/core/model.js";

const TAG = 86400000;

/* ------------------------ Kartenarten in den Modi ---------------------- */

test("ein Lückentext zeigt in den Übungsmodi keine Klammern", () => {
  const karte = { art: "cloze", term: "Das {{Ohmsche Gesetz}} lautet {{U = R · I}}.",
    definition: "Grundgesetz der Elektrizitätslehre" };
  const s = seitenFuer(karte, "td");
  assert.doesNotMatch(s.frage, /[{}]/, "keine geschweiften Klammern auf der Vorderseite");
  assert.match(s.frage, /Das _+ lautet _+\./);
  assert.match(s.antwort, /Ohmsche Gesetz/);
  assert.match(s.antwort, /U = R · I/);
  assert.match(s.antwort, /Grundgesetz/, "die Erläuterung steht mit dabei");
});

test("der Lückentext lässt sich auch rückwärts abfragen", () => {
  const karte = { art: "cloze", term: "Die {{Ableitung}} misst die Steigung.", definition: "" };
  const s = seitenFuer(karte, "dt");
  assert.match(s.frage, /Ableitung/);
  assert.doesNotMatch(s.antwort, /[{}]/);
});

test("ein Rechenweg hat in den Übungsmodi eine Rückseite", () => {
  const karte = neueMehrschrittKarte("s1", "Extremstelle von f(x)=x²−4x", [
    { frage: "ableiten", antwort: "f'(x) = 2x - 4" },
    { antwort: "2x - 4 = 0" },
    { antwort: "x = 2" },
  ]);
  const s = seitenFuer(karte, "td");
  assert.match(s.frage, /Extremstelle/);
  assert.match(s.antwort, /1\. ableiten: f'\(x\) = 2x - 4/);
  assert.match(s.antwort, /3\. x = 2/);
  assert.ok(s.antwort.trim().length > 0,
    "ohne Rückseite fiele die Karte aus allen Übungsmodi heraus");
});

test("gewöhnliche Karten bleiben, wie sie waren", () => {
  const karte = { term: "to achieve", definition: "erreichen" };
  assert.deepEqual(seitenFuer(karte, "td"),
    { frage: "to achieve", frageBild: undefined,
      antwort: "erreichen", antwortBild: undefined });
  assert.equal(seitenFuer(karte, "dt").frage, "erreichen");
});

/* --------------------------- Ein Lernstand ----------------------------- */

test("der Stapelstand rechnet mit den FSRS-Zuständen", () => {
  const jetzt = Date.now();
  const karten = [0, 1, 2].map((i) => ({
    ...neueKarte("s1", "F" + i, "A" + i, i), id: "k" + i,
  }));
  const stapel = { id: "s1", richtungen: ["td"] };

  // k0 gelernt und fällig, k1 gelernt und noch nicht fällig, k2 unberührt
  let faellig = neuerZustand("k0", "td", "s1", "f1", jetzt - 30 * TAG);
  faellig = bewerteKarte(faellig, NOTEN.GUT, { zeit: jetzt - 30 * TAG });
  faellig = bewerteKarte(faellig, NOTEN.GUT, { zeit: jetzt - 28 * TAG });
  let spaeter = neuerZustand("k1", "td", "s1", "f1", jetzt);
  spaeter = bewerteKarte(spaeter, NOTEN.LEICHT, { zeit: jetzt });

  const zustaende = { "k0:td": faellig, "k1:td": spaeter };
  const stand = stapelStand(karten, zustaende, stapel, jetzt);

  assert.equal(stand.gesamt, 3);
  assert.equal(stand.neu, 1, "k2 wurde nie abgerufen");
  assert.equal(stand.faellig, 1, "k0 ist längst überfällig");
  assert.ok(stand.naechste > jetzt, "für k1 steht ein Termin in der Zukunft");
  assert.equal(stand.zustaende.length, 3, "auch die unberührte Karte zählt mit");
});

test("beidseitige Stapel zählen jede Richtung einzeln", () => {
  const karten = [{ ...neueKarte("s1", "Haus", "maison", 0), id: "k0" }];
  const einseitig = stapelStand(karten, {}, { id: "s1", richtungen: ["td"] });
  const beidseitig = stapelStand(karten, {}, { id: "s1", richtungen: ["td", "dt"] });
  assert.equal(einseitig.gesamt, 1);
  assert.equal(beidseitig.gesamt, 2);
});

test("gesperrte Karten gelten weder als fällig noch als neu", () => {
  const karten = [{ ...neueKarte("s1", "F", "A", 0), id: "k0" }];
  const zustaende = {
    "k0:td": { ...neuerZustand("k0", "td", "s1", "f1"), gesperrt: true, reps: 3, state: 2 },
  };
  const stand = stapelStand(karten, zustaende, { id: "s1" });
  assert.equal(stand.gesperrt, 1);
  assert.equal(stand.faellig, 0);
  assert.equal(stand.neu, 0);
});

test("die Stufe einer Karte hängt an ihrer Stabilität", () => {
  assert.equal(stufe(null), 0, "ohne Zustand ist eine Karte neu");
  assert.equal(stufe({ reps: 3, state: 2, stability: 2 }), 1);
  assert.equal(stufe({ reps: 5, state: 2, stability: 14 }), 2);
  assert.equal(stufe({ reps: 9, state: 2, stability: 120 }), 3);
});

/* --------------------------- Beschädigte Daten -------------------------- */

test("beschädigte Schritte werfen die App nicht um", () => {
  assert.deepEqual(schritteVon({ art: "mehrschritt", schritte: "keine Liste" }), []);
  assert.deepEqual(schritteVon({ art: "mehrschritt", schritte: null }), []);
  assert.deepEqual(schritteVon({ art: "mehrschritt" }), []);
  const gemischt = schritteVon({ art: "mehrschritt",
    schritte: [null, { antwort: "x = 2" }, "Unfug", { frage: "leer", antwort: "  " }] });
  assert.equal(gemischt.length, 1, "nur der brauchbare Schritt bleibt");
  assert.equal(gemischt[0].antwort, "x = 2");
});

test("auch eine kaputte Mehrschritt-Karte lässt sich anzeigen", () => {
  const s = seitenFuer({ art: "mehrschritt", term: "Aufgabe",
    definition: "Ersatzantwort", schritte: "kaputt" }, "td");
  assert.equal(s.frage, "Aufgabe");
  assert.equal(s.antwort, "Ersatzantwort", "ohne Schritte greift die Rückseite");
});

test("ein Lückentext ohne Lücken bleibt lesbar", () => {
  const s = seitenFuer({ art: "cloze", term: "Kein Loch weit und breit.",
    definition: "Erläuterung" }, "td");
  assert.equal(s.frage, "Kein Loch weit und breit.");
  assert.equal(s.antwort, "Erläuterung");
});
