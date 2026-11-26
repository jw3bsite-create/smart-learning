/*
 * Prüfungen für die Punkte der Kursstufe.
 *
 * Hier wird gerechnet, was am Ende auf einem Zeugnis steht. Eine Rechnung,
 * die daneben liegt, fällt nicht auf — man glaubt ihr ja. Darum stehen die
 * Fälle hier, an denen sich eine falsche Rechnung erkennen lässt: die Art
 * ohne Leistungen, das frisch angelegte Fach, die von Hand gesetzte
 * Zeugnisnote und das Fach mit zwölf mündlichen Kleinigkeiten neben einer
 * Klausur.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  HALBJAHRE, HALBJAHR_IDS, ART_IDS, PUNKTE_MAX,
  neuesNotenfach, neueLeistung, begrenze,
  artSchnitt, fachPunkte, halbjahrSchnitt, gesamtSchnitt,
  alsNote, noteText, punkteText, punkteStufe,
  faecherIm, bekannteFaecher, verlaufVon, uebersicht,
  STANDARD_SORTEN, neueSorte, sortenVon, gewichtVon, leistungsName, zahlLesen, zahlZeigen,
  uebernahmeVorschlaege,
} from "../src/core/noten.js";

/** Ein Fach mit Leistungen, kurz geschrieben. */
function fach(halbjahr, name, leistungen = [], zusatz = {}) {
  return {
    ...neuesNotenfach({ halbjahr, fach: name }),
    leistungen: leistungen.map((l) => neueLeistung(l)),
    ...zusatz,
  };
}

/* ------------------------------- Grundlagen ----------------------------- */

test("die vier Halbjahre stehen fest und in der richtigen Reihenfolge", () => {
  assert.deepEqual(HALBJAHR_IDS, ["12.1", "12.2", "13.1", "13.2"]);
  assert.equal(HALBJAHRE[0].stufe, "TGG12");
  assert.equal(HALBJAHRE[3].stufe, "TGG13");
});

test("Punkte bleiben zwischen null und fünfzehn", () => {
  assert.equal(begrenze(-3), 0);
  assert.equal(begrenze(99), PUNKTE_MAX);
  assert.equal(begrenze(11), 11);
  // Aus einem Eingabefeld kommt Text, und in Deutschland mit Komma.
  assert.equal(begrenze("10,5"), 10.5);
  assert.equal(begrenze("Unfug"), 0);
});

/* --------------------------- Der Schnitt eines Fachs -------------------- */

test("ohne Leistungen gibt es keine Punkte, keine Null", () => {
  const f = fach("12.1", "Mathematik");
  assert.equal(fachPunkte(f).punkte, null,
    "ein frisch angelegtes Fach mit null Punkten würde jeden Schnitt verhageln");
});

test("eine Art ohne Leistungen zählt nicht mit", () => {
  const f = fach("12.1", "Deutsch", [
    { art: "schriftlich", punkte: 10 },
    { art: "schriftlich", punkte: 12 },
  ]);
  const stand = fachPunkte(f);
  assert.equal(stand.proArt.schriftlich, 11);
  assert.equal(stand.proArt.muendlich, null);
  assert.equal(stand.punkte, 11, "die leere mündliche Note darf nicht als Null einfließen");
});

/*
 * Der Grund, warum erst je Art gemittelt wird: Sonst entscheidet die Menge
 * statt des Gewichts. Zwölf mündliche Kleinigkeiten und eine Klausur — wer
 * alles in einen Topf wirft, bekommt praktisch die mündliche Note.
 */
test("erst je Art mitteln, dann die Arten zusammenfassen", () => {
  const viele = Array.from({ length: 12 }, () => ({ art: "muendlich", punkte: 4 }));
  const f = fach("12.1", "Chemie", [...viele, { art: "schriftlich", punkte: 14 }]);
  const stand = fachPunkte(f);
  assert.equal(stand.proArt.muendlich, 4);
  assert.equal(stand.proArt.schriftlich, 14);
  assert.equal(stand.punkte, 9, "bei gleichem Gewicht ist es das Mittel aus 4 und 14");
});

test("das Gewicht einer einzelnen Leistung wirkt", () => {
  const f = fach("12.1", "Physik", [
    { art: "schriftlich", punkte: 6, gewicht: 3 },
    { art: "schriftlich", punkte: 14, gewicht: 1 },
  ]);
  assert.equal(artSchnitt(f.leistungen, "schriftlich"), 8);
});

test("das Gewicht der Arten wirkt", () => {
  const f = fach("12.1", "Informatik", [
    { art: "schriftlich", punkte: 12 },
    { art: "muendlich", punkte: 6 },
  ], { artGewicht: { schriftlich: 3, muendlich: 1, praktisch: 1 } });
  assert.equal(fachPunkte(f).punkte, 10.5);
});

test("ein Gewicht von null lässt eine Leistung außen vor, ohne sie zu löschen", () => {
  const f = fach("12.1", "Sport", [
    { art: "praktisch", punkte: 15, gewicht: 0 },
    { art: "praktisch", punkte: 9, gewicht: 1 },
  ]);
  assert.equal(fachPunkte(f).proArt.praktisch, 9);
});

/*
 * Am Ende zählt, was der Lehrer eingetragen hat. Eine Rechnung, die das
 * überstimmt, wäre schlimmer als keine.
 */
test("die Zeugnispunkte stechen die Rechnung", () => {
  const f = fach("12.1", "Deutsch", [
    { art: "schriftlich", punkte: 8 },
  ], { endpunkte: 11 });
  const stand = fachPunkte(f);
  assert.equal(stand.gerechnet, 8);
  assert.equal(stand.vonHand, 11);
  assert.equal(stand.punkte, 11);
});

test("Zeugnispunkte von null sind eine Zahl, kein fehlender Wert", () => {
  const f = fach("13.2", "Sport", [{ art: "praktisch", punkte: 9 }], { endpunkte: 0 });
  assert.equal(fachPunkte(f).punkte, 0,
    "null Punkte müssen sich eintragen lassen — sonst fehlt der wichtigste Fall");
});

/* ------------------------------ Halbjahr und Ganzes --------------------- */

test("im Halbjahr zählt jedes Fach einmal", () => {
  const faecher = [
    fach("12.1", "Mathematik", [{ art: "schriftlich", punkte: 12 }]),
    fach("12.1", "Deutsch", [
      { art: "schriftlich", punkte: 8 }, { art: "schriftlich", punkte: 8 },
      { art: "schriftlich", punkte: 8 }, { art: "schriftlich", punkte: 8 },
    ]),
  ];
  assert.equal(halbjahrSchnitt(faecher), 10,
    "vier Klausuren in Deutsch dürfen das Fach nicht viermal zählen lassen");
});

test("Fächer ohne Leistungen bleiben im Halbjahrsschnitt außen vor", () => {
  const faecher = [
    fach("12.1", "Mathematik", [{ art: "schriftlich", punkte: 12 }]),
    fach("12.1", "Frisch angelegt"),
  ];
  assert.equal(halbjahrSchnitt(faecher), 12);
});

test("gelöschte Fächer zählen nirgends mit", () => {
  const faecher = [
    fach("12.1", "Mathematik", [{ art: "schriftlich", punkte: 12 }]),
    { ...fach("12.1", "Weg", [{ art: "schriftlich", punkte: 0 }]), deleted: true },
  ];
  assert.equal(halbjahrSchnitt(faecher), 12);
  assert.equal(faecherIm(faecher, "12.1").length, 1);
});

/*
 * Über alles wird nach Halbjahresleistungen gemittelt, nicht nach
 * Halbjahresschnitten: Ein Halbjahr mit drei Fächern darf nicht so schwer
 * wiegen wie eines mit zehn.
 */
test("der Gesamtschnitt mittelt Leistungen, nicht Halbjahre", () => {
  const alle = [
    fach("12.1", "A", [{ art: "schriftlich", punkte: 15 }]),
    fach("12.2", "A", [{ art: "schriftlich", punkte: 3 }]),
    fach("12.2", "B", [{ art: "schriftlich", punkte: 3 }]),
    fach("12.2", "C", [{ art: "schriftlich", punkte: 3 }]),
  ];
  const g = gesamtSchnitt(alle);
  assert.equal(g.leistungen, 4);
  assert.equal(g.punkte, 6, "(15 + 3 + 3 + 3) / 4 — nicht (15 + 3) / 2");
});

test("ein Halbjahr, das es nicht gibt, zählt nicht mit", () => {
  const alle = [
    fach("12.1", "A", [{ art: "schriftlich", punkte: 10 }]),
    fach("11.1", "Vorjahr", [{ art: "schriftlich", punkte: 0 }]),
  ];
  assert.equal(gesamtSchnitt(alle).punkte, 10);
});

/* ------------------------------- Umrechnung ----------------------------- */

/*
 * Die geläufige Tabelle: 15 Punkte sind eine 1+, 5 Punkte eine 4, 0 Punkte
 * eine 6. Die Formel (17 − P) / 3 trifft sie an jeder Stelle.
 */
test("Punkte werden nach der üblichen Formel in eine Note übersetzt", () => {
  const paare = [[15, 0.67], [14, 1.0], [13, 1.33], [11, 2.0], [8, 3.0], [5, 4.0], [2, 5.0]];
  for (const [punkte, erwartet] of paare) {
    const n = (17 - punkte) / 3;
    assert.ok(Math.abs(n - erwartet) < 0.01, punkte + " Punkte ergäben " + n);
  }
  // Angezeigt wird nie besser als 1,0 und nie schlechter als 6,0.
  assert.equal(alsNote(15), 1);
  assert.equal(alsNote(0), 5.666666666666667);
  assert.equal(noteText(11), "2,0");
  assert.equal(noteText(null), "—");
});

test("Punkte werden mit Komma angezeigt", () => {
  assert.equal(punkteText(10.55), "10,6");
  assert.equal(punkteText(11), "11");
  assert.equal(punkteText(null), "—");
});

/* Fünf Punkte sind die Schwelle: darunter gilt ein Kurs als nicht bestanden. */
test("die Einordnung kennt die Fünf-Punkte-Schwelle", () => {
  assert.equal(punkteStufe(4.9), "schlecht");
  assert.equal(punkteStufe(5), "wacklig");
  assert.equal(punkteStufe(8), "solide");
  assert.equal(punkteStufe(11), "gut");
  assert.equal(punkteStufe(null), "leer");
});

/* ------------------------------- Zusammenstellen ------------------------ */

test("der Verlauf eines Fachs geht über alle vier Halbjahre", () => {
  const alle = [
    fach("12.1", "Mathematik", [{ art: "schriftlich", punkte: 7 }]),
    fach("13.1", "Mathematik", [{ art: "schriftlich", punkte: 11 }]),
  ];
  const v = verlaufVon(alle, "mathematik");   // Groß und klein darf egal sein
  assert.deepEqual(v.map((x) => x.punkte), [7, null, 11, null]);
});

test("bekannte Fachnamen kommen ohne Dopplung", () => {
  const alle = [
    fach("12.1", "Mathematik", []),
    fach("12.2", "Mathematik", []),
    fach("12.2", "Deutsch", []),
  ];
  assert.deepEqual(bekannteFaecher(alle), ["Deutsch", "Mathematik"]);
});

test("die Übersicht liefert alle vier Halbjahre, auch die leeren", () => {
  const alle = [fach("13.2", "Deutsch", [{ art: "schriftlich", punkte: 9 }])];
  const u = uebersicht(alle);
  assert.equal(u.halbjahre.length, 4);
  assert.equal(u.halbjahre[0].schnitt, null);
  assert.equal(u.halbjahre[3].schnitt, 9);
  assert.equal(u.gesamt.punkte, 9);
});

test("ohne einen einzigen Eintrag gibt es keinen Gesamtschnitt", () => {
  assert.equal(gesamtSchnitt([]), null);
  assert.equal(uebersicht([]).gesamt, null);
});

/* ---------------------------- Frische Datensätze ------------------------ */

test("ein neues Fach ist leer, aber vollständig", () => {
  const f = neuesNotenfach({ halbjahr: "12.1", fach: "  Mathematik  " });
  assert.equal(f.fach, "Mathematik", "Leerzeichen am Rand gehören nicht in den Namen");
  assert.deepEqual(f.leistungen, []);
  assert.equal(f.endpunkte, null);
  assert.equal(f.deleted, false);
  for (const art of ART_IDS) assert.equal(f.artGewicht[art], 1);
});

test("eine neue Leistung nimmt nur, was sie kennt", () => {
  const l = neueLeistung({ art: "gesungen", punkte: 99, gewicht: -5 });
  assert.equal(l.art, "schriftlich", "eine unbekannte Art fällt auf die häufigste zurück");
  assert.equal(l.punkte, PUNKTE_MAX);
  assert.equal(l.gewicht, 0);
});

/* ------------------- Sorten, Namen, Kommazahlen (24.11.) ----------------- */

test("Kommazahlen gelten mit Komma wie mit Punkt", () => {
  assert.equal(zahlLesen("0,5"), 0.5);
  assert.equal(zahlLesen("0.5"), 0.5);
  assert.equal(zahlLesen(" 2 "), 2);
  assert.equal(zahlLesen("0,"), 0, "mitten im Tippen ist „0,“ schon null");
  assert.equal(zahlLesen(""), null);
  assert.equal(zahlLesen(","), null);
  assert.equal(zahlLesen("Unfug"), null);
  assert.equal(zahlZeigen(0.5), "0,5");
  assert.equal(zahlZeigen(null), "");
});

test("eine Sorte gibt allen ihren Leistungen das Gewicht", () => {
  const f = fach("12.1", "Deutsch");
  const [ka, tst] = sortenVon(f);
  f.leistungen = [
    neueLeistung({ art: "schriftlich", punkte: 12, sorte: ka.id }),
    neueLeistung({ art: "schriftlich", punkte: 6, sorte: tst.id }),
  ];
  // Klassenarbeit 1, Test 0,5: (12·1 + 6·0,5) / 1,5 = 10
  assert.equal(fachPunkte(f).proArt.schriftlich, 10);
  f.sorten = f.sorten.map((x) => (x.id === tst.id ? { ...x, gewicht: 1 } : x));
  assert.equal(fachPunkte(f).proArt.schriftlich, 9, "Gewicht der Sorte geändert, alle Tests ziehen mit");
});

test("ohne Sorte zählt das eigene Gewicht, auch wenn die Sorte gelöscht wurde", () => {
  assert.equal(gewichtVon({ gewicht: 2 }, STANDARD_SORTEN), 2);
  assert.equal(gewichtVon({ gewicht: 0.5, sorte: "weg" }, STANDARD_SORTEN), 0.5);
  assert.equal(gewichtVon({ gewicht: 3, sorte: "test" }, STANDARD_SORTEN), 0.5);
});

test("ältere Fächer ohne eigene Sorten bekommen Klassenarbeit und Test", () => {
  const alt = fach("12.1", "Mathe");
  delete alt.sorten;
  assert.deepEqual(sortenVon(alt).map((x) => x.name), ["Klassenarbeit", "Test"]);
  assert.equal(neuesNotenfach({ halbjahr: "12.1", fach: "X" }).sorten.length, 2);
});

test("eine angelegte Leistung ohne Punkte zieht den Schnitt nicht herunter", () => {
  const f = fach("12.1", "Bio", [{ art: "schriftlich", punkte: 12 }]);
  f.leistungen.push(neueLeistung({ art: "schriftlich" }));
  assert.equal(f.leistungen[1].punkte, null);
  assert.equal(fachPunkte(f).punkte, 12);
  assert.equal(fachPunkte(f).anzahl, 1);
});

test("Leistungen ohne Bezeichnung werden je Sorte durchgezählt", () => {
  const f = fach("12.1", "Deutsch");
  const a = neueLeistung({ art: "schriftlich", sorte: "klassenarbeit" });
  const b = neueLeistung({ art: "schriftlich", sorte: "test" });
  const c = neueLeistung({ art: "schriftlich", sorte: "klassenarbeit" });
  const d = neueLeistung({ art: "muendlich" });
  const e = neueLeistung({ art: "schriftlich", sorte: "test", was: "Gedichtanalyse" });
  f.leistungen = [a, b, c, d, e];
  assert.equal(leistungsName(f, a), "Klassenarbeit 1");
  assert.equal(leistungsName(f, b), "Test 1");
  assert.equal(leistungsName(f, c), "Klassenarbeit 2");
  assert.equal(leistungsName(f, d), "Mündlich 1");
  assert.equal(leistungsName(f, e), "Gedichtanalyse");
  f.leistungen = [b, c, d, e];
  assert.equal(leistungsName(f, c), "Klassenarbeit 1", "nach dem Löschen rückt die Zählung nach");
});

test("Übernehmen bringt die Fächer des vorigen Halbjahres samt Sorten mit", () => {
  const deutsch = fach("12.1", "Deutsch", [], { subjectId: "lf-d",
    sorten: [neueSorte({ name: "Aufsatz", gewicht: 2 })], artGewicht: { schriftlich: 2, muendlich: 1, praktisch: 1 } });
  const alle = [deutsch, fach("12.1", "Mathe"), fach("12.2", "Mathe"), fach("13.2", "Deutsch")];
  const v = uebernahmeVorschlaege(alle, "12.2", [{ id: "lf-s", name: "Spanisch" }, { id: "lf-d", name: "deutsch" }]);
  assert.deepEqual(v.map((x) => x.fach), ["Deutsch", "Spanisch"], "Mathe steht schon da");
  assert.equal(v[0].herkunft, "12.1", "das frühere Halbjahr vor dem späteren");
  assert.equal(v[0].sorten[0].name, "Aufsatz");
  assert.equal(v[0].artGewicht.schriftlich, 2);
  assert.equal(v[1].subjectId, "lf-s");
  assert.equal(v[1].herkunft, "lernfach");
});

/* ---------------------- Ziele und Bedarf (25.11.) ----------------------- */

import { abiNote, abiPunkteFuer, punkteFuerNote, abiStand, halbjahrBedarf, naechsteArbeit } from "../src/core/noten.js";

test("Abiturnote und Gesamtpunkte nach N = 17/3 − P/180", () => {
  assert.equal(abiNote(900), 1);
  assert.equal(abiNote(300).toFixed(1), "4.0");
  assert.equal(abiPunkteFuer(1.8), 696);
  assert.equal(abiPunkteFuer(4), 300);
  assert.equal(punkteFuerNote(2), 11);
  assert.equal(punkteFuerNote(1), 14, "1,0 entspricht 14 Punkten nach der Tabelle 17 − 3N");
});

test("der Abi-Balken füllt sich je Halbjahr und rechnet den Rest mit dem Schnitt hoch", () => {
  const alle = [
    fach("12.1", "Deutsch", [{ art: "schriftlich", punkte: 12 }]),
    fach("12.1", "Mathe", [{ art: "schriftlich", punkte: 10 }]),
  ];
  const s = abiStand(alle, 700);
  assert.equal(s.erreicht, 110, "Schnitt 11 × 10");
  assert.equal(s.rest, 3 * 10 + 20);
  assert.equal(s.hochgerechnet, 110 + 11 * 50);
  assert.equal(s.noetig, (700 - 110) / 50);
  assert.equal(abiStand([], null).hochgerechnet, null);
});

test("Fächer ohne Note gleichen aus, was die anderen unter dem Ziel liegen", () => {
  const faecher = [
    fach("12.1", "Deutsch", [{ art: "schriftlich", punkte: 11 }]),
    fach("12.1", "Mathe", [{ art: "schriftlich", punkte: 12 }]),
    fach("12.1", "GGK"),
  ];
  const b = halbjahrBedarf(faecher, 12);
  assert.equal(b.offen, 1);
  assert.equal(b.offeneBrauchen, 13, "36 − 23");
  assert.equal(halbjahrBedarf(faecher, null), null);
});

test("die nächste Klassenarbeit: welche Punktzahl bringt das Fach aufs Ziel", () => {
  const f = fach("12.1", "Deutsch", [{ art: "schriftlich", punkte: 9, sorte: "klassenarbeit" }]);
  // (9 + x) / 2 ≥ 12 → x = 15
  assert.deepEqual(naechsteArbeit(f, 12), { punkte: 15, name: "Klassenarbeit" });
  assert.equal(naechsteArbeit(f, 13).unerreichbar, true);
  assert.equal(naechsteArbeit(f, 4).sicher, true);
  assert.equal(naechsteArbeit(fach("12.1", "Leer"), 12), null, "ohne Punkte zählt der Ausgleich im Halbjahr");
  assert.equal(naechsteArbeit({ ...f, endpunkte: 10 }, 12), null, "Zeugnis steht fest");
});

import { halbjahrZielAusAbi, halbjahrZiel } from "../src/core/noten.js";

test("Halbjahresziele folgen dem Abi-Ziel und rechnen frühere Halbjahre ein", () => {
  assert.equal(halbjahrZielAusAbi([], "12.1", 720), 12, "720 / 60");
  const gut = [fach("12.1", "Deutsch", [{ art: "schriftlich", punkte: 15 }])];
  // 12.1 bringt 150 ein; Rest 3 Halbjahre + Prüfungen = 50 Einheiten: (720 − 150) / 50
  assert.equal(halbjahrZielAusAbi(gut, "12.2", 720), 11.4, "ein starkes 12.1 senkt das Ziel für 12.2");
  const schwach = [fach("12.1", "Deutsch", [{ art: "schriftlich", punkte: 9 }])];
  assert.equal(halbjahrZielAusAbi(schwach, "12.2", 720), 12.6);
  assert.equal(halbjahrZielAusAbi(gut, "12.2", null), null);
  assert.deepEqual(halbjahrZiel(gut, "12.2", { abi: 720, "12.2": 13 }), { wert: 13, automatisch: false },
    "ein eigenes Ziel hat Vorrang");
  assert.equal(halbjahrZiel(gut, "12.2", { abi: 720 }).automatisch, true);
});

test("ab jetzt im Schnitt: das laufende Halbjahr zählt als offen, nicht als fertig", () => {
  const alle = [fach("12.1", "Deutsch", [{ art: "schriftlich", punkte: 11 }])];
  // 12.1 läuft: alles bis zum Abi ist offen → 720 / 60 = 12
  assert.equal(abiStand(alle, 720, "12.1").noetig, 12);
  // Ohne Angabe wie früher: 12.1 gilt als fertig, (720 − 110) / 50
  assert.equal(abiStand(alle, 720).noetig, 12.2);
});

test("der Bestfall: 15 Punkte in jedem offenen Fach", () => {
  const b = halbjahrBedarf([
    fach("12.1", "Deutsch", [{ art: "schriftlich", punkte: 9 }]),
    fach("12.1", "GGK"), fach("12.1", "Bio"),
  ], 14);
  assert.equal(b.offeneBrauchen, 16.5);
  assert.equal(b.bestfall, 13);
});

import { halbjahrVerschenkt } from "../src/core/noten.js";

test("verschenkte Punkte: was die Noten unter 15 liegen, auf alle Fächer umgelegt", () => {
  const faecher = [
    fach("12.1", "Deutsch", [{ art: "schriftlich", punkte: 12 }]),
    fach("12.1", "Mathe", [{ art: "schriftlich", punkte: 9 }]),
    fach("12.1", "GGK"),
  ];
  assert.equal(halbjahrVerschenkt(faecher), 3, "(3 + 6) / 3");
  assert.equal(abiStand(faecher, null).verschenkt, 30, "× 10 fürs Abi");
  // Erreicht + verschenkt + Hochrechnung passen zusammen in 900.
  const s = abiStand(faecher, null);
  assert.ok(s.hochgerechnet + s.verschenkt <= 900);
});
