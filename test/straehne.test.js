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

/* ============================ Klausur-Modus ============================= */

import {
  wirksameRetention, tageBisPruefung, pensumPruefen, baueCramSitzung,
  VERDICHTUNG_AB_TAGEN, CRAM_AB_TAGEN,
} from "../src/core/warteschlange.js";
import { neuerZustand, bewerteKarte, NOTEN } from "../src/core/fsrs.js";
import { neueKarte } from "../src/core/model.js";

test("ohne Termin bleibt die Ziel-Retention, wie sie eingestellt ist", () => {
  assert.equal(wirksameRetention({ zielRetention: 0.85 }), 0.85);
  assert.equal(wirksameRetention(null), 0.9);
});

test("je näher die Prüfung, desto strenger das Ziel", () => {
  const jetzt = Date.now();
  const fach = (tage) => ({ zielRetention: 0.9, pruefungsdatum: jetzt + tage * TAG });
  const weit = wirksameRetention(fach(VERDICHTUNG_AB_TAGEN + 10), jetzt);
  const mittel = wirksameRetention(fach(30), jetzt);
  const nah = wirksameRetention(fach(3), jetzt);
  assert.equal(weit, 0.9, "außerhalb der Frist ändert sich nichts");
  assert.ok(mittel > weit, "in dreißig Tagen wird es strenger");
  assert.ok(nah > mittel, "kurz davor noch strenger");
  assert.ok(nah <= 0.97, "aber nie über 97 Prozent");
});

test("nach dem Termin gilt wieder die Grundeinstellung", () => {
  const fach = { zielRetention: 0.88, pruefungsdatum: Date.now() - 5 * TAG };
  assert.equal(wirksameRetention(fach), 0.88);
  assert.equal(tageBisPruefung(fach) < 0, true);
});

test("das Pensum wird ehrlich gerechnet", () => {
  const jetzt = Date.now();
  const fach = { id: "f1", zielRetention: 0.9, pruefungsdatum: jetzt + 10 * TAG };
  const karten = Array.from({ length: 40 }, (_, i) => ({
    ...neueKarte("s1", "F" + i, "A" + i, i), id: "k" + i,
  }));
  const stapelVon = () => ({ id: "s1", subjectId: "f1" });

  const machbar = pensumPruefen(karten, {}, stapelVon, fach, jetzt);
  assert.equal(machbar.tage, 10);
  assert.equal(machbar.offen, 40);
  assert.equal(machbar.jeTag, 4);
  assert.equal(machbar.machbar, true);

  const eng = pensumPruefen(karten, {}, stapelVon,
    { ...fach, pruefungsdatum: jetzt + TAG }, jetzt);
  assert.equal(eng.machbar, false, "vierzig Karten an einem Tag sind nicht machbar");
  assert.match(eng.text, /geht sich nicht aus/);
});

test("die Endspurt-Warteschlange nimmt das Wackligste zuerst", () => {
  const karten = [0, 1, 2].map((i) => ({
    ...neueKarte("s1", "F" + i, "A" + i, i), id: "k" + i,
  }));
  const stapelVon = () => ({ id: "s1", subjectId: "f1" });
  const zustaende = {};
  // k0 ist gut gefestigt, k1 wacklig, k2 unberührt
  let fest = neuerZustand("k0", "td", "s1", "f1");
  for (let i = 0; i < 4; i++)
    fest = bewerteKarte(fest, NOTEN.LEICHT, { zeit: Date.now() + i * 10 * TAG });
  zustaende["k0:td"] = fest;
  let wacklig = neuerZustand("k1", "td", "s1", "f1");
  wacklig = bewerteKarte(wacklig, NOTEN.NOCHMAL, { zeit: Date.now() });
  zustaende["k1:td"] = wacklig;

  const s = baueCramSitzung({ karten, zustaende, stapelVon, fach: { id: "f1" } });
  assert.equal(s.cram, true);
  assert.equal(s.aufgaben.length, 3, "alles kommt dran, auch was nicht fällig ist");
  assert.equal(s.aufgaben[s.aufgaben.length - 1].karte.id, "k0",
    "das Gefestigte steht hinten");
});

test("die Endspurt-Warteschlange lässt gesperrte Karten aus", () => {
  const karten = [{ ...neueKarte("s1", "F", "A", 0), id: "k0" }];
  const zustaende = { "k0:td": { ...neuerZustand("k0", "td", "s1", "f1"), gesperrt: true } };
  const s = baueCramSitzung({ karten, zustaende,
    stapelVon: () => ({ id: "s1", subjectId: "f1" }), fach: { id: "f1" } });
  assert.equal(s.aufgaben.length, 0);
  assert.ok(CRAM_AB_TAGEN > 0);
});

/*
 * Der Monatswechsel.
 *
 * Die Ruhetage werden je Kalendermonat gezählt. Eine Lücke, die über den
 * Monatswechsel läuft, verteilte sich früher auf zwei Kontingente — vier
 * ausgelassene Tage am Stück überstanden die Strähne, dieselben vier Tage
 * mitten im Monat nicht. Der Fehler zeigte sich nur an den ersten Tagen eines
 * Monats und blieb darum lange unentdeckt.
 */
test("eine Lücke über den Monatswechsel bekommt kein doppeltes Kontingent", () => {
  const zweiterSeptember = new Date(2026, 8, 2, 12, 0, 0).getTime();
  const amTag = (versatz, anzahl = TAGESPENSUM) => {
    const zeit = zweiterSeptember - versatz * TAG;
    return Array.from({ length: anzahl }, (_, i) => ({
      cardId: "k" + i, zeit: zeit + i * 1000, bewertung: 3, flag: "normal",
    }));
  };
  // Heute gelernt, dann 1. September, 31. und 30. August ausgelassen.
  const reviews = [...amTag(0), ...amTag(4)];
  const s = straehne(reviews, { jetzt: zweiterSeptember });
  assert.equal(s.laenge, 1, "drei Tage am Stück ausgelassen — die Strähne reißt");
});

test("zwei Tage am Stück werden auch über den Monatswechsel überbrückt", () => {
  const zweiterSeptember = new Date(2026, 8, 2, 12, 0, 0).getTime();
  const amTag = (versatz) => {
    const zeit = zweiterSeptember - versatz * TAG;
    return Array.from({ length: TAGESPENSUM }, (_, i) => ({
      cardId: "k" + i, zeit: zeit + i * 1000, bewertung: 3, flag: "normal",
    }));
  };
  // 1. September und 31. August ausgelassen — zwei Tage, das ist erlaubt.
  const reviews = [...amTag(0), ...amTag(3)];
  const s = straehne(reviews, { jetzt: zweiterSeptember });
  assert.equal(s.laenge, 2);
  assert.equal(s.verbrauchteRuhetage, 2);
});
