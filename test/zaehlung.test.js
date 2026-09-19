/*
 * Eine Zählung für alle Stellen — und nur über Karten, die im Plan sind.
 *
 * Anlass: Die Seitenleiste zählte die Lernstände selbst, auch die gelöschter
 * und abgehakter Karten. Oben stand „12 fällig", und das Abrufen fand nichts.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { neuerZustand, bewerteKarte } from "../src/core/fsrs.js";
import { heuteEingefuehrt, zustaendeImPlan, fachZaehlung } from "../src/core/warteschlange.js";

const HEUTE = new Date(2026, 8, 19, 15).getTime();
const TAG = 86400000;

test("neu eingeführt heißt: heute zum ersten Mal gewertet", () => {
  const heute = bewerteKarte(neuerZustand("a", "td", "s", "f", HEUTE), 3, { zeit: HEUTE });
  let gestern = bewerteKarte(neuerZustand("b", "td", "s", "f", HEUTE - TAG), 3, { zeit: HEUTE - TAG });
  gestern = bewerteKarte(gestern, 3, { zeit: HEUTE });
  let zaeh = neuerZustand("c", "td", "s", "f", HEUTE);
  for (let i = 0; i < 6; i++) zaeh = bewerteKarte(zaeh, 1, { zeit: HEUTE + i * 60000 });
  assert.equal(heuteEingefuehrt([heute, gestern, zaeh], "f", HEUTE + 3600000), 2,
    "gestern Eingeführtes zählt nicht, oft Vergessenes zählt trotzdem");
});

test("alte Lernstände ohne das Feld werden weiter geschätzt", () => {
  const alt = { ...neuerZustand("a", "td", "s", "f", HEUTE), reps: 1, last_review: HEUTE };
  delete alt.eingefuehrt;
  assert.equal(heuteEingefuehrt([alt], "f", HEUTE), 1);
});

test("Lernstände gelöschter, abgehakter oder fachloser Karten zählen nicht", () => {
  const stapel = { s1: { id: "s1", subjectId: "f" }, s2: { id: "s2", subjectId: null } };
  const stapelVon = (id) => stapel[id] || null;
  const karten = [
    { id: "k1", setId: "s1" },
    { id: "k2", setId: "s1", nichtRelevant: true },
    { id: "k3", setId: "s2" },
  ];
  const faellig = (id) => ({ ...neuerZustand(id, "td", "s1", "f", HEUTE - 10 * TAG),
    reps: 3, state: 2, due: HEUTE - TAG });
  const zustaende = {
    "k1:td": faellig("k1"), "k2:td": faellig("k2"), "k3:td": faellig("k3"),
    "weg:td": faellig("weg"),
  };
  assert.deepEqual(zustaendeImPlan(karten, zustaende, stapelVon).map((z) => z.cardId), ["k1"]);
  assert.equal(fachZaehlung(karten, zustaende, stapelVon, "f", HEUTE).faellig, 1);
});
