/*
 * Prüfungen für Phase 2 — Erzeugung, Sieb und Ausfuhr.
 *
 * Der wichtigste Block ist das Sieb: Was ein Sprachmodell liefert, ist
 * williges Rohmaterial, kein Lernstoff. Dass die Regeln aus `prompts/` auch
 * dann greifen, wenn das Modell sie überhört, wird hier festgehalten.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  pruefeVorschlaege, alsEntwuerfe, inHaeppchen, eigenleistung, FRAGE_HOECHSTENS,
} from "../src/core/generator.js";
import {
  alsAnkiText, ankiLesen, alsCsvMitPlan, csvLesen,
} from "../src/core/importer.js";
import {
  neuerEntwurf, karteAusEntwurf, herkunftVon, HERKUNFT,
  neueErklaerung, mitFassung, umfangDerErklaerung, neuePruefung, pruefungsStand,
  neueMehrschrittKarte, schritteVon, schrittBilanz,
} from "../src/core/model.js";
import { zerlege, fuelle } from "../prompts/zerlege.js";
import { behaltenskurve, behaltenGesamt } from "../src/core/kalibrierung.js";
import { formelStimmt } from "../src/core/text.js";

const HIER = dirname(fileURLToPath(import.meta.url));

/* ================================ Das Sieb ============================== */

test("unvollständige Vorschläge fallen durch", () => {
  const { brauchbar, verworfen } = pruefeVorschlaege([
    { frage: "Was ist Entropie?", antwort: "" },
    { frage: "", antwort: "irgendwas" },
    { frage: "Was ist Entropie?", antwort: "Maß der Unordnung" },
  ]);
  assert.equal(brauchbar.length, 1);
  assert.equal(verworfen.length, 2);
  assert.ok(verworfen.every((v) => v.grund === "unvollständig"));
});

test("zu lange Fragen fallen durch", () => {
  const lang = "Was".padEnd(FRAGE_HOECHSTENS + 10, "x") + "?";
  const { brauchbar, verworfen } = pruefeVorschlaege([{ frage: lang, antwort: "ja" }]);
  assert.equal(brauchbar.length, 0);
  assert.equal(verworfen[0].grund, "zu lang");
});

test("Ja-Nein-Fragen fallen durch", () => {
  const { brauchbar, verworfen } = pruefeVorschlaege([
    { frage: "Ist Wasser ein Dipol?", antwort: "Ja" },
    { frage: "Kann man Entropie messen?", antwort: "Ja" },
    { frage: "Wodurch unterscheidet sich ein Dipol von einem Ion?", antwort: "Ladungstrennung" },
  ]);
  assert.equal(brauchbar.length, 1);
  assert.equal(verworfen.length, 2);
  assert.ok(verworfen.every((v) => v.grund === "mit Ja oder Nein zu beantworten"));
});

test("was es schon gibt, kommt nicht noch einmal", () => {
  const vorhanden = [{ term: "Was ist Entropie?", definition: "Maß der Unordnung" }];
  const { brauchbar, verworfen } = pruefeVorschlaege(
    [{ frage: "was ist entropie", antwort: "etwas anderes" }], vorhanden);
  assert.equal(brauchbar.length, 0);
  assert.equal(verworfen[0].grund, "gibt es schon");
});

test("Dubletten im selben Schwung fallen durch", () => {
  const { brauchbar, verworfen } = pruefeVorschlaege([
    { frage: "Was misst die Entropie?", antwort: "Unordnung" },
    { frage: "Was misst die Entropie?", antwort: "Unordnung" },
  ]);
  assert.equal(brauchbar.length, 1);
  assert.equal(verworfen[0].grund, "doppelt");
});

test("kein Eingabefeld, kein Absturz", () => {
  assert.deepEqual(pruefeVorschlaege(null).brauchbar, []);
  assert.deepEqual(pruefeVorschlaege("Unfug").brauchbar, []);
});

/* =============================== Entwürfe =============================== */

test("die vorgeschlagene Rückseite bleibt im Entwurf verborgen", () => {
  const entwuerfe = alsEntwuerfe("s1", [
    { frage: "Was misst die Entropie?", antwort: "Unordnung", quelle: "S. 42" },
  ]);
  assert.equal(entwuerfe.length, 1);
  const e = entwuerfe[0];
  assert.equal(e.term, "Was misst die Entropie?");
  assert.equal(e.vorschlag, "Unordnung", "der Vorschlag wird mitgeführt");
  assert.equal(e.eigene, "", "aber das Feld des Nutzers ist leer");
  assert.equal(e.gesehen, false, "und niemand hat ihn gesehen");
  assert.equal(e.quelle, "S. 42");
});

test("aus einem Entwurf wird eine Karte mit vermerkter Herkunft", () => {
  const e = neuerEntwurf({ setId: "s1", term: "Frage", vorschlag: "KI-Antwort" });
  const eigene = karteAusEntwurf(e, "meine Antwort", "ki_vorderseite");
  assert.equal(eigene.term, "Frage");
  assert.equal(eigene.definition, "meine Antwort");
  assert.equal(eigene.created_by, "ki_vorderseite");
  assert.equal(eigene.setId, "s1");
});

test("Herkunft wird auch für alte Karten beantwortet", () => {
  assert.equal(herkunftVon({ term: "x" }), "selbst");
  assert.equal(herkunftVon({ created_by: "ki_uebernommen" }), "ki_uebernommen");
  assert.equal(herkunftVon({ created_by: "unfug" }), "selbst");
  assert.ok(HERKUNFT.ki_uebernommen);
});

test("die Eigenleistung wird ausgezählt", () => {
  const e = eigenleistung([
    { created_by: "selbst" }, { created_by: "selbst" },
    { created_by: "ki_vorderseite" },
    { created_by: "ki_uebernommen" },
    {},                                    // Karte aus Fassung 1
  ]);
  assert.equal(e.gesamt, 5);
  assert.equal(e.selbst, 3);
  assert.equal(e.ki_uebernommen, 1);
  assert.equal(Math.round(e.anteilUebernommen * 100), 20);
  assert.equal(Math.round(e.anteilSelbst * 100), 80);
});

/* ============================== Häppchen ================================ */

test("lange Vorlagen werden an Absatzgrenzen geteilt", () => {
  const absatz = "Satz. ".repeat(30).trim();       // rund 180 Zeichen
  const text = [absatz, absatz, absatz].join("\n\n");
  const stuecke = inHaeppchen(text, 400);
  assert.ok(stuecke.length >= 2, "es wird geteilt");
  assert.ok(stuecke.every((s) => s.length <= 400), "kein Stück ist zu groß");
  assert.equal(stuecke.join(" ").replace(/\s+/g, " ").trim(),
    text.replace(/\s+/g, " ").trim(), "nichts geht verloren");
});


test("ein einzelner überlanger Absatz wird hart geschnitten, ohne Verlust", () => {
  const text = "x".repeat(1000);
  const stuecke = inHaeppchen(text, 300);
  assert.ok(stuecke.length >= 4, "es wird in mehrere Stücke geteilt");
  assert.ok(stuecke.every((s) => s.length <= 300), "kein Stück ist zu groß");
  assert.equal(stuecke.join(""), text, "kein Zeichen geht verloren");
});

test("bei langem Fließtext wird an Wortgrenzen geschnitten", () => {
  const text = "Wort ".repeat(200).trim();
  const stuecke = inHaeppchen(text, 300);
  assert.ok(stuecke.every((s) => s.length <= 300));
  assert.ok(stuecke.every((s) => !s.startsWith(" ") && !s.endsWith(" ")));
  assert.equal(stuecke.join(" "), text, "der Text bleibt vollständig");
});

test("kurze Vorlagen bleiben ein Stück", () => {
  assert.deepEqual(inHaeppchen("Kurz und gut.", 3000), ["Kurz und gut."]);
  assert.deepEqual(inHaeppchen("", 3000), []);
});

/* ================================ Anki ================================== */

test("Anki-Ausfuhr und -Einfuhr passen zusammen", () => {
  const karten = [
    { term: "to achieve", definition: "erreichen", hint: "", starred: false },
    { term: "Zeile eins\nZeile zwei", definition: "mit Umbruch", hint: "Merkhilfe", starred: true },
  ];
  const text = alsAnkiText(karten, { stapelName: "Englisch" });
  assert.match(text, /^#separator:tab/m);
  assert.match(text, /^#deck:Englisch/m);

  const zurueck = ankiLesen(text);
  assert.equal(zurueck.length, 2);
  assert.equal(zurueck[0].term, "to achieve");
  assert.equal(zurueck[0].definition, "erreichen");
  assert.equal(zurueck[1].term, "Zeile eins\nZeile zwei", "der Umbruch überlebt");
  assert.equal(zurueck[1].hint, "Merkhilfe");
  assert.equal(zurueck[1].starred, true);
});

test("eine echte Anki-Ausfuhr mit Auszeichnung wird gelesen", () => {
  const roh = [
    "#separator:tab",
    "#html:true",
    "#notetype column:1",
    "der Vertrag\t<b>the treaty</b>&nbsp;",
    "die Grenze\tthe border<br>the boundary",
  ].join("\n");
  const karten = ankiLesen(roh);
  assert.equal(karten.length, 2);
  assert.equal(karten[0].definition, "the treaty", "Auszeichnung wird entfernt");
  assert.equal(karten[1].definition, "the border\nthe boundary", "<br> wird zum Umbruch");
});

test("andere Trennzeichen werden aus dem Kopf gelesen", () => {
  const roh = "#separator:semicolon\nvorn;hinten";
  assert.deepEqual(ankiLesen(roh)[0].term, "vorn");
  assert.deepEqual(ankiLesen(roh)[0].definition, "hinten");
});

test("die Ausfuhr mit Lernstand enthält die Planzahlen", () => {
  const karten = [{ id: "k1", setId: "s1", term: "Frage", definition: "Antwort",
    created_by: "selbst" }];
  const zustaende = {
    "k1:td": { id: "k1:td", cardId: "k1", richtung: "td", due: 1800000000000,
      stability: 12.5, difficulty: 4.2, reps: 3, lapses: 1, state: 2 },
  };
  const csv = alsCsvMitPlan(karten, zustaende, {
    stapelVon: () => ({ title: "Vokabeln", subjectId: "f1" }),
    fachVon: () => ({ name: "Englisch" }),
  });
  const zeilen = csvLesen(csv);
  assert.equal(zeilen.length, 2, "Kopfzeile und eine Karte");
  assert.deepEqual(zeilen[0].slice(0, 4), ["kennung", "richtung", "vorderseite", "rueckseite"]);
  assert.equal(zeilen[1][0], "k1");
  assert.equal(zeilen[1][5], "Vokabeln");
  assert.equal(zeilen[1][6], "Englisch");
  assert.equal(zeilen[1][9], "12.5", "die Stabilität wandert mit");
});

test("Karten ohne Lernstand kommen trotzdem in die Ausfuhr", () => {
  const csv = alsCsvMitPlan([{ id: "k1", term: "a", definition: "b" }], {});
  const zeilen = csvLesen(csv);
  assert.equal(zeilen.length, 2);
  assert.equal(zeilen[1][9], "", "leere Stabilität statt Absturz");
});

/* ============================== Anweisungen ============================= */

test("die Anweisung des Generators hat einen Kopf und Regeln", () => {
  const roh = readFileSync(join(HIER, "..", "prompts", "kartengenerator.md"), "utf8");
  const { kopf, text } = zerlege(roh);
  assert.equal(kopf.name, "kartengenerator");
  assert.ok(Number(kopf.fassung) >= 1, "die Fassung ist vermerkt");
  assert.match(text, /Eine Tatsache pro Karte/);
  assert.match(text, /\{\{ANZAHL\}\}/, "der Platzhalter ist vorhanden");
  assert.match(text, /JSON/, "das Ausgabeformat steht darin");
});

test("Platzhalter werden gefüllt, Unbekanntes bleibt stehen", () => {
  assert.equal(fuelle("Höchstens {{ANZAHL}} Karten.", { ANZAHL: 7 }), "Höchstens 7 Karten.");
  assert.equal(fuelle("{{FEHLT}} bleibt", {}), "{{FEHLT}} bleibt");
});

test("Text ohne Kopf wird trotzdem gelesen", () => {
  const { kopf, text } = zerlege("Nur Text, kein Kopf.");
  assert.deepEqual(kopf, {});
  assert.equal(text, "Nur Text, kein Kopf.");
});

/* ========================= Phase 3 — Erklärungen ======================== */

test("eine Erklärung beginnt leer und ohne Runden", () => {
  const x = neueErklaerung({ thema: "Kettenregel", subjectId: "f1" });
  assert.equal(x.thema, "Kettenregel");
  assert.deepEqual(x.fassungen, []);
  assert.equal(x.runden, 0);
  assert.equal(x.erledigt, false);
  assert.equal(umfangDerErklaerung(x), 0);
});

test("jede Überarbeitung wird angehängt, nichts überschrieben", () => {
  let x = neueErklaerung({ thema: "Kettenregel" });
  x = mitFassung(x, "Erste, kurze Fassung.", [{ stelle: "kurz", art: "luecke", frage: "Und dann?" }]);
  x = mitFassung(x, "Zweite, deutlich ausführlichere Fassung mit mehr Text.", []);
  assert.equal(x.fassungen.length, 2, "beide Fassungen bleiben erhalten");
  assert.equal(x.fassungen[0].text, "Erste, kurze Fassung.");
  assert.equal(x.fassungen[0].lueckenZahl, 1);
  assert.equal(x.runden, 2);
  assert.equal(x.erledigt, true, "leere Lückenliste heißt fertig");
  assert.equal(umfangDerErklaerung(x), 7);
});

test("ohne Rückmeldung gilt die Erklärung nicht als fertig", () => {
  let x = neueErklaerung({ thema: "Redoxreaktion" });
  x = mitFassung(x, "Nur aufgehoben, nicht geprüft.", null);
  assert.equal(x.erledigt, false);
  assert.deepEqual(x.offeneLuecken, []);
  assert.equal(x.fassungen.length, 1);
});

test("die Anweisung für das Erklären verbietet das Füllen der Lücken", () => {
  const roh = readFileSync(join(HIER, "..", "prompts", "feynman.md"), "utf8");
  const { kopf, text } = zerlege(roh);
  assert.equal(kopf.name, "feynman");
  assert.match(text, /korrigierst\s+nichts/);
  assert.match(text, /Fülle keine Lücke/);
  assert.match(text, /[Hh]öchstens\s+fünf/);
  assert.match(text, /JSON/);
});

/* ==================== Phase 5 — Prüfung und Behalten ==================== */

test("eine Prüfung beginnt leer und ohne Ergebnis", () => {
  const p = neuePruefung({ titel: "Analysis", kriterien: ["Ableitung", "Randwerte"] });
  assert.equal(p.titel, "Analysis");
  assert.deepEqual(p.kriterien, ["Ableitung", "Randwerte"]);
  assert.equal(p.begonnen, 0);
  assert.equal(p.abgegeben, 0);
  assert.equal(p.ergebnis, null);
});

test("der Stand einer Prüfung zählt, was behandelt wurde", () => {
  const p = {
    ...neuePruefung({ titel: "T", kriterien: ["A", "B", "C"] }),
    ergebnis: [
      { kriterium: "A", stand: "ja" },
      { kriterium: "B", stand: "nein" },
      { kriterium: "C", stand: "unklar" },
    ],
  };
  const s = pruefungsStand(p);
  assert.equal(s.gesamt, 3);
  assert.equal(s.ja, 1);
  assert.equal(s.nein, 1);
  assert.equal(s.unklar, 1);
});

test("die eigene Einschätzung überstimmt die der KI", () => {
  const p = {
    ...neuePruefung({ titel: "T", kriterien: ["A", "B"] }),
    ergebnis: [{ kriterium: "A", stand: "nein" }, { kriterium: "B", stand: "nein" }],
    selbstpruefung: { 0: "ja" },
  };
  const s = pruefungsStand(p);
  assert.equal(s.ja, 1, "wer sagt, es stehe da, hat recht — er kennt seinen Text");
  assert.equal(s.nein, 1);
});

test("ohne Kriterien gibt es nichts zu zählen", () => {
  const s = pruefungsStand(neuePruefung({ titel: "T" }));
  assert.equal(s.gesamt, 0);
  assert.equal(s.anteil, 0);
});

test("die Kriterien-Anweisung verbietet Noten und Verbesserungen", () => {
  const roh = readFileSync(join(HIER, "..", "prompts", "kriterien.md"), "utf8");
  const { kopf, text } = zerlege(roh);
  assert.equal(kopf.name, "kriterien");
  assert.match(text, /[Kk]eine Punkte, keine Note/);
  assert.match(text, /[Kk]eine Verbesserungsvorschläge/);
  assert.match(text, /ja.{0,10}nein.{0,10}unklar/s);
});

test("die Behaltenskurve misst über die Abstände", () => {
  const TAG = 86400000;
  const start = new Date("2026-01-01T09:00:00Z").getTime();
  const reviews = [
    // Karte 1: nach zwei Tagen gewusst, nach zwanzig nicht mehr
    { cardId: "k1", richtung: "td", zeit: start, bewertung: 3, flag: "normal" },
    { cardId: "k1", richtung: "td", zeit: start + 2 * TAG, bewertung: 3, flag: "normal" },
    { cardId: "k1", richtung: "td", zeit: start + 22 * TAG, bewertung: 1, flag: "normal" },
    // Karte 2: nach zwei Tagen gewusst
    { cardId: "k2", richtung: "td", zeit: start, bewertung: 3, flag: "normal" },
    { cardId: "k2", richtung: "td", zeit: start + 2 * TAG, bewertung: 4, flag: "normal" },
    // Übung zählt nicht mit
    { cardId: "k3", richtung: "td", zeit: start, bewertung: 3, flag: "practice" },
    { cardId: "k3", richtung: "td", zeit: start + 2 * TAG, bewertung: 1, flag: "practice" },
  ];
  const kurve = behaltenskurve(reviews);
  const kurz = kurve.find((k) => k.tage === 3);
  assert.equal(kurz.gesamt, 2, "zwei Wiederholungen im Abstand von zwei Tagen");
  assert.equal(kurz.gewusst, 2);
  assert.equal(kurz.quote, 1);
  const lang = kurve.find((k) => k.tage === 30);
  assert.equal(lang.gesamt, 1);
  assert.equal(lang.quote, 0, "nach zwanzig Tagen war sie weg");
});

test("Lernschritte am selben Tag verfälschen die Kurve nicht", () => {
  const start = Date.now();
  const reviews = [
    { cardId: "k1", richtung: "td", zeit: start, bewertung: 3, flag: "normal" },
    { cardId: "k1", richtung: "td", zeit: start + 600000, bewertung: 3, flag: "normal" },
  ];
  const kurve = behaltenskurve(reviews);
  assert.equal(kurve.reduce((n, k) => n + k.gesamt, 0), 0,
    "zehn Minuten Abstand sind keine Behaltensleistung");
});

test("ohne Daten bleibt die Kurve leer statt zu raten", () => {
  const kurve = behaltenskurve([]);
  assert.ok(kurve.every((k) => k.quote === null));
  assert.equal(behaltenGesamt([]), null);
});

/* ====================== Fachmodul Mathematik =========================== */

test("Schreibweisen einer Formel werden vereinheitlicht", () => {
  assert.equal(formelStimmt("f´(x)=2·x", "f'(x) = 2x"), true);
  assert.equal(formelStimmt("x**2", "x^2"), true);
  assert.equal(formelStimmt("0,5", "0.5"), true);
  assert.equal(formelStimmt("a÷b", "a/b"), true);
  assert.equal(formelStimmt("3−1", "3-1"), true);
});

test("gerechnet wird beim Vergleich nicht", () => {
  assert.equal(formelStimmt("2+2", "4"), false,
    "ob zwei Ausdrücke gleichwertig sind, entscheidet der Mensch");
  assert.equal(formelStimmt("", "x"), false);
});

test("eine Mehrschritt-Karte führt ihre Schritte mit", () => {
  const k = neueMehrschrittKarte("s1", "Extremstellen von f(x)=x²", [
    { frage: "ableiten", antwort: "f'(x) = 2x" },
    "f'(x) = 0",
    "x = 0",
  ]);
  assert.equal(k.art, "mehrschritt");
  assert.equal(k.schritte.length, 3);
  assert.equal(k.schritte[0].frage, "ableiten");
  assert.equal(k.schritte[1].frage, "", "eine bloße Zeile ist ein Schritt ohne Anweisung");
  assert.equal(schritteVon(k).length, 3);
});

test("leere Schritte fallen heraus", () => {
  const k = neueMehrschrittKarte("s1", "Aufgabe", [
    { antwort: "erster" }, { antwort: "   " }, { antwort: "zweiter" },
  ]);
  assert.equal(schritteVon(k).length, 2);
  assert.deepEqual(schritteVon({ term: "x", definition: "y" }), [],
    "eine gewöhnliche Karte hat keine Schritte");
});

test("die Bilanz nennt die erste Stelle, an der es kippt", () => {
  const b = schrittBilanz([true, true, false, false]);
  assert.equal(b.gesamt, 4);
  assert.equal(b.richtig, 2);
  assert.equal(b.erstesFalsch, 2);
  assert.equal(b.alleRichtig, false);

  const gut = schrittBilanz([true, true]);
  assert.equal(gut.alleRichtig, true);
  assert.equal(gut.erstesFalsch, null);
});
