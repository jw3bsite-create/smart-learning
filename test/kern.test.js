/*
 * Prüfungen für den rechnenden Kern — alles, was ohne Browser auskommt.
 * Aufruf: npm test
 */

import test from "node:test";
import assert from "node:assert/strict";

import { pruefe, normalisiere, antwortVarianten, schablone } from "../src/core/text.js";
import { bewerte, faellig, baueRunde, frageArt, faelligZaehlen } from "../src/core/scheduler.js";
import { neuerStand, baueBaum, ordnerZweig, anteileNachStufe, neueKarte } from "../src/core/model.js";
import { zerlege, csvLesen, rateTrenner, alsCsv } from "../src/core/importer.js";
import { zuKarten } from "../src/core/ocr.js";
import { straehne, tagesSchluessel, mische } from "../src/core/util.js";

/* ------------------------------ Antworten ------------------------------ */

test("richtige Antwort wird erkannt", () => {
  assert.equal(pruefe("die Umwelt", "die Umwelt").status, "richtig");
  assert.equal(pruefe("umwelt", "die Umwelt").status, "richtig");
  assert.equal(pruefe("  Die   Umwelt ", "die Umwelt").status, "richtig");
});

test("Artikel und Betonungszeichen sind entbehrlich", () => {
  assert.equal(pruefe("Haus", "das Haus").status, "richtig");
  assert.equal(pruefe("cafe", "café").status, "richtig");
  assert.equal(pruefe("schoen", "schön").status, "richtig");
});

test("ein Tippfehler zählt als fast richtig, nicht als falsch", () => {
  assert.equal(pruefe("Umvelt", "die Umwelt").status, "fast");
  assert.equal(pruefe("Gesellschaft", "die Verantwortung").status, "falsch");
});

test("Strenge lässt sich abstellen", () => {
  assert.equal(pruefe("Umvelt", "die Umwelt", { tippfehlerErlauben: false }).status, "falsch");
  assert.equal(pruefe("Haus", "das Haus", { ohneArtikel: false }).status, "falsch");
});

test("mehrere zulässige Antworten", () => {
  assert.deepEqual(antwortVarianten("gehen, laufen / spazieren"), ["gehen", "laufen", "spazieren"]);
  assert.equal(pruefe("laufen", "gehen, laufen / spazieren").status, "richtig");
  assert.equal(pruefe("spazieren", "gehen, laufen / spazieren").status, "richtig");
});

test("leere Eingabe ist immer falsch", () => {
  assert.equal(pruefe("", "die Umwelt").status, "falsch");
  assert.equal(pruefe("   ", "die Umwelt").status, "falsch");
});

test("Klammerzusätze sind entbehrlich", () => {
  assert.equal(pruefe("Vertrag", "der Vertrag (völkerrechtlich)").status, "richtig");
});

test("Schablone verrät nur die Anfangsbuchstaben", () => {
  assert.equal(schablone("das Haus"), "d__ H___");
});

test("Normalisierung lässt einzelne Artikel stehen", () => {
  // „die“ allein bleibt „die“ — sonst bliebe nichts übrig.
  assert.equal(normalisiere("die"), "die");
});

/* ------------------------------ Lernplan ------------------------------- */

test("richtige Antwort hebt das Fach, falsche senkt es", () => {
  let stand = neuerStand("k1", "s1");
  stand = bewerte(stand, "td", 2);
  assert.equal(stand.td.box, 1);
  stand = bewerte(stand, "td", 2);
  assert.equal(stand.td.box, 2);
  stand = bewerte(stand, "td", 0);
  assert.equal(stand.td.box, 1);
  assert.equal(stand.td.lapses, 1);
});

test("fast richtig hält das Fach, senkt aber die Leichtigkeit", () => {
  let stand = bewerte(bewerte(neuerStand("k1", "s1"), "td", 2), "td", 2);
  const vorher = { box: stand.td.box, ease: stand.td.ease };
  stand = bewerte(stand, "td", 1);
  assert.equal(stand.td.box, vorher.box);
  assert.ok(stand.td.ease < vorher.ease);
});

test("mit dem Fach wächst der Abstand", () => {
  let stand = neuerStand("k1", "s1");
  const abstaende = [];
  for (let i = 0; i < 5; i++) {
    stand = bewerte(stand, "td", 2);
    abstaende.push(stand.td.interval);
  }
  for (let i = 1; i < abstaende.length; i++)
    assert.ok(abstaende[i] > abstaende[i - 1], "Abstand " + i + " wächst");
});

test("frische Karten sind fällig, eben gelernte nicht", () => {
  const frisch = neuerStand("k1", "s1");
  assert.equal(faellig(frisch, "td"), true);
  const gelernt = bewerte(bewerte(frisch, "td", 2), "td", 2);
  assert.equal(faellig(gelernt, "td"), false);
});

test("die Runde nimmt zuerst, was neu oder überfällig ist", () => {
  const karten = Array.from({ length: 10 }, (_, i) => neueKarte("s1", "v" + i, "r" + i, i));
  const staende = {};
  // Fünf Karten sind schon gelernt und noch nicht wieder fällig.
  for (let i = 0; i < 5; i++)
    staende[karten[i].id] = bewerte(bewerte(neuerStand(karten[i].id, "s1"), "td", 2), "td", 2);
  const runde = baueRunde(karten, staende, { groesse: 5, richtung: "td" });
  assert.equal(runde.length, 5);
  for (const eintrag of runde)
    assert.ok(!staende[eintrag.card.id], "nur ungelernte Karten in der ersten Runde");
});

test("Fragenart richtet sich nach dem Fach", () => {
  assert.equal(frageArt(0), "auswahl");
  assert.equal(frageArt(1), "auswahl");
  assert.equal(frageArt(3), "schreiben");
  assert.equal(frageArt(3, { auswahl: true, schreiben: false }), "auswahl");
});

test("Zählung trennt neu, fällig und beherrscht", () => {
  const karten = [neueKarte("s1", "a", "b", 0), neueKarte("s1", "c", "d", 1)];
  const staende = {};
  let stand = neuerStand(karten[0].id, "s1");
  for (let i = 0; i < 6; i++) { stand = bewerte(stand, "td", 2); stand = bewerte(stand, "dt", 2); }
  staende[karten[0].id] = stand;
  const z = faelligZaehlen(karten, staende);
  assert.equal(z.neu, 1);
  assert.equal(z.beherrscht, 1);
  assert.equal(z.gesamt, 2);
});

/* ------------------------------- Einfuhr ------------------------------- */

test("Text mit Tabulator wird zerlegt", () => {
  const { paare, uebrig } = zerlege("Haus\tmaison\nBaum\tarbre", { spalte: "tab" });
  assert.deepEqual(paare, [
    { term: "Haus", definition: "maison" },
    { term: "Baum", definition: "arbre" },
  ]);
  assert.equal(uebrig.length, 0);
});

test("Zeilen ohne Trennzeichen fallen auf", () => {
  const { paare, uebrig } = zerlege("Haus\tmaison\nnur eine Zeile", { spalte: "tab" });
  assert.equal(paare.length, 1);
  assert.deepEqual(uebrig, ["nur eine Zeile"]);
});

test("Gedankenstrich als Trennung, auch als Halbgeviertstrich", () => {
  const { paare } = zerlege("Haus - maison\nBaum – arbre", { spalte: "strich" });
  assert.deepEqual(paare, [
    { term: "Haus", definition: "maison" },
    { term: "Baum", definition: "arbre" },
  ]);
});

test("Seiten lassen sich beim Einlesen tauschen", () => {
  const { paare } = zerlege("Haus\tmaison", { spalte: "tab", tauschen: true });
  assert.deepEqual(paare, [{ term: "maison", definition: "Haus" }]);
});

test("das Trennzeichen wird geraten", () => {
  assert.equal(rateTrenner("a\tb\nc\td"), "tab");
  assert.equal(rateTrenner("a - b\nc - d"), "strich");
});

test("CSV mit Anführungszeichen", () => {
  const zeilen = csvLesen('"Haus, das","maison"\n"Baum","arbre"');
  assert.deepEqual(zeilen[0], ["Haus, das", "maison"]);
  assert.equal(zeilen.length, 2);
});

test("Ausfuhr und Einfuhr passen zusammen", () => {
  const karten = [{ term: 'sagen: "hallo"', definition: "dire" }];
  const zeilen = csvLesen(alsCsv(karten));
  assert.deepEqual(zeilen[0], ['sagen: "hallo"', "dire"]);
});

/* ---------------------------- Texterkennung ---------------------------- */

test("zwei Spalten im Bild werden an der großen Lücke getrennt", () => {
  // Wortkästen: schmale Lücken innerhalb der Spalte, eine breite dazwischen.
  const zeilen = [
    { text: "the treaty der Vertrag", woerter: [
      { text: "the", x0: 40, x1: 90 }, { text: "treaty", x0: 100, x1: 200 },
      { text: "der", x0: 480, x1: 530 }, { text: "Vertrag", x0: 540, x1: 660 }] },
    { text: "to negotiate verhandeln", woerter: [
      { text: "to", x0: 40, x1: 70 }, { text: "negotiate", x0: 80, x1: 230 },
      { text: "verhandeln", x0: 480, x1: 650 }] },
  ];
  const paare = zuKarten({ zeilen }, "spalten");
  assert.deepEqual(paare, [
    { term: "the treaty", definition: "der Vertrag" },
    { term: "to negotiate", definition: "verhandeln" },
  ]);
});

test("ohne erkennbare Spalte greift das Trennzeichen", () => {
  const zeilen = [{ text: "Haus - maison", woerter: [
    { text: "Haus", x0: 10, x1: 60 }, { text: "-", x0: 66, x1: 72 },
    { text: "maison", x0: 78, x1: 150 }] }];
  const paare = zuKarten({ zeilen }, "spalten");
  assert.deepEqual(paare, [{ term: "Haus", definition: "maison" }]);
});

test("abwechselnde Zeilen", () => {
  const zeilen = ["Haus", "maison", "Baum", "arbre"].map((t) => ({ text: t, woerter: [] }));
  assert.deepEqual(zuKarten({ zeilen }, "wechselnd"), [
    { term: "Haus", definition: "maison" },
    { term: "Baum", definition: "arbre" },
  ]);
});

/* ------------------------------- Ordnung ------------------------------- */

test("Ordnerbaum entsteht aus flacher Liste", () => {
  const ordner = [
    { id: "a", name: "Deutsch", parentId: null },
    { id: "b", name: "Lyrik", parentId: "a" },
    { id: "c", name: "Verwaist", parentId: "gibtesnicht" },
  ];
  const baum = baueBaum(ordner);
  assert.equal(baum.length, 2);
  const deutsch = baum.find((o) => o.id === "a");
  assert.equal(deutsch.kinder.length, 1);
  assert.equal(deutsch.kinder[0].id, "b");
});

test("der Zweig eines Ordners umfasst alles darunter", () => {
  const ordner = [
    { id: "a", parentId: null }, { id: "b", parentId: "a" },
    { id: "c", parentId: "b" }, { id: "d", parentId: null },
  ];
  const zweig = ordnerZweig(ordner, "a");
  assert.deepEqual([...zweig].sort(), ["a", "b", "c"]);
});

test("Anteile nach Stufe zählen die schwächere Richtung", () => {
  const karte = neueKarte("s1", "a", "b", 0);
  let stand = neuerStand(karte.id, "s1");
  for (let i = 0; i < 3; i++) stand = bewerte(stand, "td", 2);
  const anteile = anteileNachStufe([karte], { [karte.id]: stand });
  assert.deepEqual(anteile, [1, 0, 0, 0]); // dt ist noch unberührt
});

/* -------------------------------- Kleines ------------------------------ */

test("Strähne zählt zusammenhängende Tage", () => {
  const tag = (versatz) => {
    const d = new Date();
    d.setDate(d.getDate() - versatz);
    return tagesSchluessel(d.getTime());
  };
  assert.equal(straehne([tag(0), tag(1), tag(2)]), 3);
  assert.equal(straehne([tag(0), tag(2)]), 1);
  assert.equal(straehne([tag(5)]), 0);
  assert.equal(straehne([]), 0);
});

test("Mischen behält alle Stücke", () => {
  const vorher = [1, 2, 3, 4, 5];
  const nachher = mische(vorher);
  assert.deepEqual([...nachher].sort(), vorher);
  assert.deepEqual(vorher, [1, 2, 3, 4, 5]);
});
