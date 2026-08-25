/*
 * Prüfungen für die Strähne.
 *
 * Die Fallstricke stehen hier, nicht die Selbstverständlichkeiten: Zählt
 * Durchklicken? Reißt eine Lücke die Strähne? Rettet ein halbes Pensum den
 * Tag? Genau an diesen Stellen entscheidet sich, ob die Flamme Lernen misst
 * oder nur Gewohnheit.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  straehne, laengsteStraehne, abrufeJeTag, istLerntag, tagesLage,
  TAGESPENSUM, RUHETAGE_JE_MONAT,
} from "../src/core/straehne.js";

const TAG = 86400000;

/** Baut Reviews für einen Tag, `versatz` Tage in der Vergangenheit. */
function tagesReviews(versatz, anzahl, flag = "normal") {
  const zeit = Date.now() - versatz * TAG;
  return Array.from({ length: anzahl }, (_, i) => ({
    cardId: "k" + i, zeit: zeit + i * 1000, bewertung: 3, flag,
  }));
}

test("ein Tag zählt erst ab dem Pensum", () => {
  assert.equal(istLerntag(TAGESPENSUM - 1), false);
  assert.equal(istLerntag(TAGESPENSUM), true);
  assert.equal(istLerntag(100), true);
});

test("drei Tage in Folge ergeben eine Strähne von drei", () => {
  const reviews = [
    ...tagesReviews(0, TAGESPENSUM),
    ...tagesReviews(1, TAGESPENSUM),
    ...tagesReviews(2, TAGESPENSUM),
  ];
  const s = straehne(reviews);
  assert.equal(s.laenge, 3);
  assert.equal(s.heuteGeschafft, true);
  assert.equal(s.fehlendHeute, 0);
});

test("ein halbes Pensum rettet den Tag nicht", () => {
  const reviews = [
    ...tagesReviews(0, 5),
    ...tagesReviews(1, TAGESPENSUM),
  ];
  const s = straehne(reviews);
  assert.equal(s.heuteGeschafft, false);
  assert.equal(s.fehlendHeute, TAGESPENSUM - 5);
  assert.equal(s.laenge, 1, "gestern zählt weiter, heute noch nicht");
});

test("ein leerer heutiger Tag bricht die Strähne nicht — er ist noch nicht vorbei", () => {
  const reviews = [
    ...tagesReviews(1, TAGESPENSUM),
    ...tagesReviews(2, TAGESPENSUM),
  ];
  const s = straehne(reviews);
  assert.equal(s.laenge, 2);
  assert.equal(s.heuteGeschafft, false);
});

test("Durchgeklicktes zählt nicht", () => {
  const reviews = [
    ...tagesReviews(0, 30, "implausible"),
    ...tagesReviews(1, TAGESPENSUM),
  ];
  const s = straehne(reviews);
  assert.equal(s.heuteAbrufe, 0, "dreißig zu schnelle Antworten sind kein Lerntag");
  assert.equal(s.heuteGeschafft, false);
});

test("Vorabfragen zählen ebenfalls nicht", () => {
  const s = straehne(tagesReviews(0, 40, "pretest"));
  assert.equal(s.heuteAbrufe, 0);
  assert.equal(s.laenge, 0);
});

test("Üben zählt für die Strähne mit", () => {
  const reviews = [
    ...tagesReviews(0, 8, "normal"),
    ...tagesReviews(0, 8, "practice"),
  ];
  const s = straehne(reviews);
  assert.equal(s.heuteAbrufe, 16);
  assert.equal(s.heuteGeschafft, true,
    "wer Zuordnen spielt, hat auch abgerufen — nur nicht für den Plan");
});

test("eine Lücke wird mit einem Ruhetag überbrückt", () => {
  const reviews = [
    ...tagesReviews(0, TAGESPENSUM),
    // Tag 1 fehlt
    ...tagesReviews(2, TAGESPENSUM),
    ...tagesReviews(3, TAGESPENSUM),
  ];
  const s = straehne(reviews);
  assert.equal(s.laenge, 3, "drei Lerntage, der Ausfall dazwischen wird verziehen");
  assert.equal(s.verbrauchteRuhetage, 1);
});

test("mehr Lücken als Ruhetage reißen die Strähne", () => {
  const reviews = [
    ...tagesReviews(0, TAGESPENSUM),
    // Tage 1, 2, 3 fehlen — das sind drei Ruhetage, erlaubt sind zwei
    ...tagesReviews(4, TAGESPENSUM),
  ];
  const s = straehne(reviews);
  assert.equal(s.laenge, 1);
  assert.ok(RUHETAGE_JE_MONAT === 2);
});

test("die längste Strähne wird über die ganze Zeit gesucht", () => {
  const reviews = [
    ...tagesReviews(0, TAGESPENSUM),
    ...tagesReviews(10, TAGESPENSUM),
    ...tagesReviews(11, TAGESPENSUM),
    ...tagesReviews(12, TAGESPENSUM),
    ...tagesReviews(13, TAGESPENSUM),
  ];
  assert.equal(laengsteStraehne(reviews), 4);
});

test("Abrufe werden je Tag gezählt", () => {
  const jeTag = abrufeJeTag([...tagesReviews(0, 3), ...tagesReviews(1, 5)]);
  assert.equal([...jeTag.values()].reduce((a, b) => a + b, 0), 8);
  assert.equal(jeTag.size, 2);
});

test("die Tageslage sagt, was noch fehlt", () => {
  const lage = tagesLage(tagesReviews(0, 3), 12);
  assert.equal(lage.heuteGeschafft, false);
  assert.match(lage.text, /12 Karten warten/);

  const fertig = tagesLage(tagesReviews(0, TAGESPENSUM), 0);
  assert.equal(fertig.text, "Heute erledigt.");
});

test("ohne Reviews steht die Strähne bei null, ohne Absturz", () => {
  const s = straehne([]);
  assert.equal(s.laenge, 0);
  assert.equal(s.heuteAbrufe, 0);
  assert.equal(laengsteStraehne([]), 0);
});
