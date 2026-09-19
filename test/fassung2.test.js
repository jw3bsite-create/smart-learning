/*
 * Prüfungen für das Fundament aus Phase 1.
 *
 * Der wichtigste Block sind die Golden-Tests: Unsere Hülle um `ts-fsrs`
 * übersetzt Zustände hin und her. Diese Übersetzung darf nichts verfälschen —
 * dieselbe Folge von Bewertungen muss bei uns und in der Bibliothek zu
 * denselben Terminen führen. Ein Fehler dort wäre unsichtbar und würde erst
 * nach Monaten als schlechtes Behalten auffallen.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { fsrs, createEmptyCard, generatorParameters, State } from "ts-fsrs";

import {
  neuerZustand, bewerteKarte, istFaellig, istNeu, vorschau, stufe, LEECH_AB,
  freigeben, nachAlterRegelGesperrt,
  behaltenswahrscheinlichkeit, abstandLang, NOTEN, KONFIDENZ, AUFSCHLAG_MIN,
} from "../src/core/fsrs.js";
import {
  kalibrierung, aufschlagFuer, istPlausibel, PLAUSIBEL_AB_MS, gewusst,
} from "../src/core/kalibrierung.js";
import {
  baueSitzung, fachZaehlung, faelligJeTag, heuteEingefuehrt,
} from "../src/core/warteschlange.js";
import {
  neuesFach, neuesReview, clozeTeile, clozeAnzahl, richtungenFuer, kartenArt, neueKarte,
} from "../src/core/model.js";

const TAG = 86400000;
const START = new Date("2026-01-01T09:00:00Z").getTime();

/* ======================= Golden-Tests gegen ts-fsrs ====================== */

test("eine Folge von Bewertungen ergibt dieselben Termine wie die Bibliothek", () => {
  const folge = [NOTEN.GUT, NOTEN.GUT, NOTEN.NOCHMAL, NOTEN.GUT, NOTEN.LEICHT, NOTEN.SCHWER];
  const parameter = generatorParameters({
    request_retention: 0.9, maximum_interval: 3650,
    enable_fuzz: true, enable_short_term: true,
  });
  const planer = fsrs(parameter);

  // Weg A: unmittelbar über die Bibliothek
  let bibliothek = createEmptyCard(new Date(START));
  // Weg B: über unsere Hülle
  let unser = neuerZustand("k1", "td", "s1", "f1", START);

  let zeit = START;
  for (const note of folge) {
    zeit += 2 * TAG;
    bibliothek = planer.next(bibliothek, new Date(zeit), note).card;
    unser = bewerteKarte(unser, note, { zielRetention: 0.9, maximalTage: 3650, zeit });

    assert.equal(unser.due, bibliothek.due.getTime(), "Termin nach Note " + note);
    assert.equal(unser.stability, bibliothek.stability, "Stabilität nach Note " + note);
    assert.equal(unser.difficulty, bibliothek.difficulty, "Schwierigkeit nach Note " + note);
    assert.equal(unser.state, bibliothek.state, "Zustand nach Note " + note);
    assert.equal(unser.reps, bibliothek.reps);
    assert.equal(unser.lapses, bibliothek.lapses);
  }
});

test("die Ziel-Retention wirkt: strenger heißt früher wieder", () => {
  const zeit = START;
  let locker = neuerZustand("k1", "td", "s1", "f1", zeit);
  let streng = neuerZustand("k1", "td", "s1", "f1", zeit);
  // Erst zwei gute Antworten, damit die Karte in den Wiederholungsstand kommt.
  for (const versatz of [0, 2 * TAG]) {
    locker = bewerteKarte(locker, NOTEN.GUT, { zielRetention: 0.85, zeit: zeit + versatz });
    streng = bewerteKarte(streng, NOTEN.GUT, { zielRetention: 0.97, zeit: zeit + versatz });
  }
  assert.ok(streng.due < locker.due,
    "bei 97 % Ziel-Retention muss die Karte früher wiederkommen als bei 85 %");
});

/* ============================ Unsere Zusätze ============================= */

test("ein frischer Zustand ist neu und sofort fällig", () => {
  const z = neuerZustand("k1", "td", "s1", "f1", START);
  assert.equal(istNeu(z), true);
  assert.equal(z.state, State.New);
  assert.equal(z.id, "k1:td");
  assert.equal(stufe(z), 0);
});

test("Gut hebt die Stabilität, Nochmal wirft zurück", () => {
  let z = neuerZustand("k1", "td", "s1", "f1", START);
  z = bewerteKarte(z, NOTEN.GUT, { zeit: START });
  z = bewerteKarte(z, NOTEN.GUT, { zeit: START + 2 * TAG });
  const stabil = z.stability;
  z = bewerteKarte(z, NOTEN.NOCHMAL, { zeit: START + 10 * TAG });
  assert.ok(z.stability < stabil, "nach Nochmal muss die Stabilität sinken");
  assert.equal(z.lapses, 1);
  assert.equal(z.state, State.Relearning);
});

test("unwirksame Bewertungen lassen den Zustand unberührt", () => {
  const z = neuerZustand("k1", "td", "s1", "f1", START);
  const nachher = bewerteKarte(z, NOTEN.LEICHT, { zeit: START, wirksam: false });
  assert.deepEqual(nachher, z, "Üben, Pretest und Cram dürfen nichts verschieben");
});

test("der Kalibrierungsaufschlag verkürzt, aber nie unter einen Tag", () => {
  let ohne = neuerZustand("k1", "td", "s1", "f1", START);
  let mit = neuerZustand("k1", "td", "s1", "f1", START);
  for (const versatz of [0, 2 * TAG, 8 * TAG]) {
    ohne = bewerteKarte(ohne, NOTEN.GUT, { zeit: START + versatz });
    mit = bewerteKarte(mit, NOTEN.GUT, { zeit: START + versatz, aufschlag: AUFSCHLAG_MIN });
  }
  const zeit = START + 8 * TAG;
  assert.ok(mit.due < ohne.due, "mit Aufschlag muss die Karte früher wiederkommen");
  assert.ok(mit.due - zeit >= TAG, "aber niemals früher als am nächsten Tag");
});

/* Bringt eine Karte in den Wiederholungsstand und lässt sie dann vergessen. */
function rueckfall(z, zeit) {
  let jetzt = zeit;
  for (let i = 0; i < 4 && z.state !== 2; i++) { jetzt += TAG; z = bewerteKarte(z, NOTEN.GUT, { zeit: jetzt }); }
  jetzt += 3 * TAG;
  return { z: bewerteKarte(z, NOTEN.NOCHMAL, { zeit: jetzt }), zeit: jetzt };
}

test("wiederholte Rückfälle sperren die Karte", () => {
  let z = neuerZustand("k1", "td", "s1", "f1", START);
  let zeit = START;
  for (let i = 0; i < LEECH_AB - 1; i++) {
    ({ z, zeit } = rueckfall(z, zeit));
    assert.equal(z.gesperrt, false, "nach " + (i + 1) + " Rückfällen noch nicht");
  }
  ({ z, zeit } = rueckfall(z, zeit));
  assert.equal(z.gesperrt, true, "nach " + LEECH_AB + " Rückfällen stillgelegt");
  assert.equal(istFaellig(z, zeit + 100 * TAG), false, "Gesperrtes kommt nicht mehr dran");
});

test("Nochmal in den ersten Lernschritten sperrt nicht", () => {
  let z = neuerZustand("k1", "td", "s1", "f1", START);
  for (let i = 0; i < 12; i++) z = bewerteKarte(z, NOTEN.NOCHMAL, { zeit: START + i * 60000 });
  assert.equal(z.gesperrt, false, "eine neue, schwere Karte ist kein Fall für die Sperre");
});

test("eine freigegebene Karte bleibt beim nächsten Gut frei", () => {
  let z = neuerZustand("k1", "td", "s1", "f1", START);
  let zeit = START;
  for (let i = 0; i < LEECH_AB; i++) ({ z, zeit } = rueckfall(z, zeit));
  assert.equal(z.gesperrt, true);
  z = freigeben(z, zeit);
  assert.equal(z.gesperrt, false);
  z = bewerteKarte(z, NOTEN.GUT, { zeit: zeit + TAG });
  assert.equal(z.gesperrt, false, "früher sperrte schon das nächste Gut die Karte wieder");
  z = bewerteKarte(z, NOTEN.NOCHMAL, { zeit: zeit + 5 * TAG });
  assert.equal(z.gesperrt, false, "ein einzelner Rückfall nach der Freigabe sperrt nicht");
});

test("nach der alten Regel gesperrte Karten werden erkannt", () => {
  const alt = { ...neuerZustand("k1", "td", "s1", "f1", START), gesperrt: true, lapses: 2, nochmalGesamt: 6 };
  assert.equal(nachAlterRegelGesperrt(alt), true);
  assert.equal(nachAlterRegelGesperrt({ ...alt, lapses: LEECH_AB }), false);
  assert.equal(nachAlterRegelGesperrt({ ...alt, gesperrt: false }), false);
});

test("die erste Wertung hält fest, wann die Karte eingeführt wurde", () => {
  let z = neuerZustand("k1", "td", "s1", "f1", START);
  z = bewerteKarte(z, NOTEN.GUT, { zeit: START + 5000 });
  assert.equal(z.eingefuehrt, START + 5000);
  z = bewerteKarte(z, NOTEN.GUT, { zeit: START + 2 * TAG });
  assert.equal(z.eingefuehrt, START + 5000, "bleibt beim ersten Mal");
});

test("aufeinanderfolgende Fehlversuche werden getrennt gezählt", () => {
  let z = neuerZustand("k1", "td", "s1", "f1", START);
  z = bewerteKarte(z, NOTEN.NOCHMAL, { zeit: START });
  z = bewerteKarte(z, NOTEN.NOCHMAL, { zeit: START + TAG });
  assert.equal(z.nochmalZaehler, 2);
  z = bewerteKarte(z, NOTEN.GUT, { zeit: START + 2 * TAG });
  assert.equal(z.nochmalZaehler, 0, "eine gute Antwort setzt die Serie zurück");
  assert.equal(z.nochmalGesamt, 2, "die Gesamtzahl bleibt stehen");
});

test("die Vorschau nennt für alle vier Knöpfe einen Abstand", () => {
  const z = neuerZustand("k1", "td", "s1", "f1", START);
  const v = vorschau(z, { zeit: START });
  assert.equal(Object.keys(v).length, 4);
  assert.ok(v[NOTEN.LEICHT] > v[NOTEN.NOCHMAL], "Leicht muss weiter hinausschieben als Nochmal");
});

test("Behaltenswahrscheinlichkeit fällt mit der Zeit", () => {
  let z = neuerZustand("k1", "td", "s1", "f1", START);
  z = bewerteKarte(z, NOTEN.GUT, { zeit: START });
  z = bewerteKarte(z, NOTEN.GUT, { zeit: START + 2 * TAG });
  const gleich = behaltenswahrscheinlichkeit(z, START + 2 * TAG);
  const spaeter = behaltenswahrscheinlichkeit(z, START + 60 * TAG);
  assert.ok(gleich > spaeter, "je länger her, desto unwahrscheinlicher der Abruf");
  assert.ok(spaeter >= 0 && gleich <= 1);
});

test("Abstände werden lesbar ausgegeben", () => {
  assert.equal(abstandLang(30 * 1000), "gleich");
  assert.equal(abstandLang(10 * 60000), "in 10 min");
  assert.equal(abstandLang(3 * TAG), "in 3 Tagen");
  assert.equal(abstandLang(TAG), "in 1 Tag");
  assert.match(abstandLang(400 * TAG), /Jahren/);
});

/* ============================= Kalibrierung ============================== */

function review(konfidenz, bewertung, zusatz = {}) {
  return neuesReview({ cardId: "k1", bewertung, konfidenz, ...zusatz });
}

test("Überschätzung wird gemessen", () => {
  const liste = [
    review(KONFIDENZ.SICHER, NOTEN.GUT),
    review(KONFIDENZ.SICHER, NOTEN.GUT),
    review(KONFIDENZ.SICHER, NOTEN.NOCHMAL),
    review(KONFIDENZ.SICHER, NOTEN.SCHWER),
    review(KONFIDENZ.KEINE_AHNUNG, NOTEN.GUT),
  ];
  const k = kalibrierung(liste);
  assert.equal(k.stufen[1].anzahl, 4);
  assert.equal(k.stufen[1].gewusst, 2);
  assert.equal(k.ueberschaetzung, 0.5);
  assert.equal(k.unterschaetzung, 1);
});

test("nur gewertete Abrufe zählen in die Kalibrierung", () => {
  const liste = [
    review(KONFIDENZ.SICHER, NOTEN.GUT),
    review(KONFIDENZ.SICHER, NOTEN.NOCHMAL, { flag: "practice" }),
    review(KONFIDENZ.SICHER, NOTEN.NOCHMAL, { flag: "pretest" }),
    review(KONFIDENZ.SICHER, NOTEN.NOCHMAL, { flag: "implausible" }),
  ];
  const k = kalibrierung(liste);
  assert.equal(k.stufen[1].anzahl, 1, "Üben, Vorabfragen und Durchklicken bleiben draußen");
  assert.equal(k.ueberschaetzung, 0);
});

test("wer sich oft überschätzt, bekommt einen Aufschlag", () => {
  const treu = Array.from({ length: 5 }, () => review(KONFIDENZ.SICHER, NOTEN.GUT));
  assert.equal(aufschlagFuer(treu), 1);

  const daneben = Array.from({ length: 5 }, () => review(KONFIDENZ.SICHER, NOTEN.NOCHMAL));
  assert.equal(aufschlagFuer(daneben), AUFSCHLAG_MIN);

  assert.equal(aufschlagFuer([review(KONFIDENZ.SICHER, NOTEN.NOCHMAL)]), 1,
    "zwei Datenpunkte sind keine Grundlage");
});

test("Durchklicken wird erkannt", () => {
  assert.equal(istPlausibel({ antwortzeit: 400, bewertung: NOTEN.GUT }), false);
  assert.equal(istPlausibel({ antwortzeit: PLAUSIBEL_AB_MS + 1, bewertung: NOTEN.GUT }), true);
  assert.equal(istPlausibel({ antwortzeit: 9000, bewertung: NOTEN.GUT, eingabeLeer: true }), true,
    "im Kopf beantwortet und ehrlich bewertet zählt");
  assert.equal(istPlausibel({ antwortzeit: 9000, bewertung: NOTEN.NOCHMAL, eingabeLeer: true }), true);
});

test("gewusst heißt Gut oder Leicht", () => {
  assert.equal(gewusst(NOTEN.NOCHMAL), false);
  assert.equal(gewusst(NOTEN.SCHWER), false);
  assert.equal(gewusst(NOTEN.GUT), true);
  assert.equal(gewusst(NOTEN.LEICHT), true);
});

/* ============================ Warteschlange ============================== */

function aufbau() {
  const fach = { ...neuesFach("Mathematik"), id: "f1", neuProTag: 2 };
  const stapel = { id: "s1", title: "Ableitungen", subjectId: "f1", richtungen: ["td"] };
  const karten = Array.from({ length: 6 }, (_, i) => ({
    ...neueKarte("s1", "Frage " + i, "Antwort " + i, i), id: "k" + i,
  }));
  return { fach, stapel, karten,
    stapelVon: (id) => (id === "s1" ? stapel : null),
    faecherVon: () => [fach] };
}

test("die Sitzung nimmt Fälliges zuerst und bremst Neues", () => {
  const { fach, karten, stapelVon, faecherVon } = aufbau();
  const jetzt = START + 30 * TAG;
  const zustaende = {};
  // Zwei Karten sind überfällig, der Rest ist unberührt.
  for (const i of [0, 1]) {
    let z = neuerZustand("k" + i, "td", "s1", "f1", START);
    z = bewerteKarte(z, NOTEN.GUT, { zeit: START });
    z = bewerteKarte(z, NOTEN.GUT, { zeit: START + 2 * TAG });
    zustaende[z.id] = { ...z, due: START + 5 * TAG };   // längst fällig
  }

  const sitzung = baueSitzung({
    karten, zustaende, stapelVon, faecherVon, fach, umfang: 10, zeit: jetzt,
  });

  assert.equal(sitzung.faellig, 2);
  assert.equal(sitzung.neu, 4);
  assert.equal(sitzung.neuHeuteMoeglich, 2, "das Tageslimit des Fachs greift");
  assert.equal(sitzung.aufgaben.length, 4, "zwei fällige und zwei neue");
});

test("gesperrte Karten kommen nicht in die Sitzung", () => {
  const { fach, karten, stapelVon, faecherVon } = aufbau();
  const zustaende = {};
  for (const k of karten)
    zustaende[k.id + ":td"] = { ...neuerZustand(k.id, "td", "s1", "f1", START), gesperrt: true };
  const sitzung = baueSitzung({
    karten, zustaende, stapelVon, faecherVon, fach, umfang: 10, zeit: START + TAG,
  });
  assert.equal(sitzung.aufgaben.length, 0);
});

test("ohne Fach am Stapel taucht nichts in der Sitzung auf", () => {
  const { fach, karten, faecherVon } = aufbau();
  const ohneFach = { id: "s1", title: "Lose", subjectId: null };
  const sitzung = baueSitzung({
    karten, zustaende: {}, stapelVon: () => ohneFach, faecherVon, fach,
    umfang: 10, zeit: START,
  });
  assert.equal(sitzung.aufgaben.length, 0);
});

test("die Fachzählung trennt fällig, neu und gesperrt", () => {
  const { karten, stapelVon } = aufbau();
  const zustaende = {
    "k0:td": { ...neuerZustand("k0", "td", "s1", "f1", START), reps: 3, state: 2,
      due: START, stability: 10 },
    "k1:td": { ...neuerZustand("k1", "td", "s1", "f1", START), gesperrt: true },
  };
  const z = fachZaehlung(karten, zustaende, stapelVon, "f1", START + TAG);
  assert.equal(z.faellig, 1);
  assert.equal(z.gesperrt, 1);
  assert.equal(z.neu, 4);
  assert.equal(z.gesamt, 6);
});

test("der Kalender zählt Überfälliges getrennt", () => {
  const zustaende = [
    { reps: 2, state: 2, stability: 5, due: START - 3 * TAG },
    { reps: 2, state: 2, stability: 5, due: START + 2 * TAG },
    { reps: 2, state: 2, stability: 5, due: START + 2 * TAG },
  ];
  const { eimer, ueberfaellig } = faelligJeTag(zustaende, 10, START);
  assert.equal(ueberfaellig, 1);
  assert.equal(eimer[2], 2);
});

test("heute eingeführte Karten werden gezählt", () => {
  const heute = Date.now();
  const zustaende = [
    { subjectId: "f1", reps: 1, last_review: heute },
    { subjectId: "f1", reps: 1, last_review: heute - 3 * TAG },
    { subjectId: "f2", reps: 1, last_review: heute },
  ];
  assert.equal(heuteEingefuehrt(zustaende, "f1", heute), 1);
});

/* ============================== Kartenarten ============================== */

test("Karten aus Fassung 1 gelten als freies Abrufen", () => {
  assert.equal(kartenArt({ term: "a", definition: "b" }), "frei");
  assert.equal(kartenArt({ art: "cloze" }), "cloze");
  assert.equal(kartenArt({ art: "unfug" }), "frei");
});

test("Lückentexte werden zerlegt", () => {
  const teile = clozeTeile("Das {{Ohmsche Gesetz}} lautet {{U = R · I}}.");
  assert.equal(teile.length, 5);   // Text, Lücke, Text, Lücke, Text
  assert.equal(teile[1].art, "luecke");
  assert.equal(teile[1].nummer, 1);
  assert.equal(teile[1].text, "Ohmsche Gesetz");
  assert.equal(teile[3].art, "luecke");
  assert.equal(teile[3].nummer, 2);
  assert.equal(clozeAnzahl("keine Lücke hier"), 0);
});

test("jede Lücke wird eigenständig geplant", () => {
  const karte = { art: "cloze", term: "{{a}} und {{b}} und {{c}}" };
  assert.deepEqual(richtungenFuer(karte, {}), ["c1", "c2", "c3"]);
  assert.deepEqual(richtungenFuer({ term: "x" }, { richtungen: ["td", "dt"] }), ["td", "dt"]);
  assert.deepEqual(richtungenFuer({ term: "x" }, {}), ["td"]);
});

test("ein neues Fach kommt mit brauchbaren Vorgaben", () => {
  const f = neuesFach("Chemie");
  assert.equal(f.zielRetention, 0.9);
  assert.equal(f.neuProTag, 15);
  assert.deepEqual(f.richtungen, ["td"]);
  assert.equal(f.pruefungsdatum, null);
});
