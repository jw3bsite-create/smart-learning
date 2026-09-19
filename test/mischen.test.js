/*
 * Prüfungen für den Fragemodus.
 *
 * Eine Gewichtung ist die undankbarste Sorte Code: Sie sieht immer plausibel
 * aus. Ob ein Fach mit naher Prüfung wirklich öfter drankommt, sieht man einer
 * einzelnen Runde nicht an — man müsste hundert Runden zählen. Also zählen
 * wir hundert Runden.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  terminGewicht, punkteGewicht, prioritaetsGewicht, fachGewicht,
  kartenGewicht, baueFragen, TERMIN_HORIZONT_TAGE,
} from "../src/core/mischen.js";
import { neueKarte, neuesFach, istRelevant } from "../src/core/model.js";
import { neuerZustand, bewerteKarte, NOTEN } from "../src/core/fsrs.js";

const TAG = 86400000;
const JETZT = new Date(2026, 8, 3, 12, 0, 0).getTime();

/* ------------------------------- Die Gewichte --------------------------- */

test("ein ferner oder fehlender Termin gibt keinen Zuschlag", () => {
  assert.equal(terminGewicht({ pruefungsdatum: null }, JETZT), 1);
  assert.equal(terminGewicht({ pruefungsdatum: JETZT + 200 * TAG }, JETZT), 1);
});

/*
 * Kein Termin heisst kein Zuschlag — und ausdruecklich kein Abschlag. Sonst
 * käme ein Fach seltener dran, bloß weil man vergessen hat, den Termin
 * einzutragen. Das wäre eine Folge des Nichteintragens, keine Entscheidung.
 */
test("ohne Termin steht ein Fach nicht schlechter da als mit fernem Termin", () => {
  assert.equal(terminGewicht({ pruefungsdatum: null }, JETZT),
    terminGewicht({ pruefungsdatum: JETZT + 300 * TAG }, JETZT));
});

test("je näher der Termin, desto schwerer das Fach", () => {
  const fern = terminGewicht({ pruefungsdatum: JETZT + 50 * TAG }, JETZT);
  const nah = terminGewicht({ pruefungsdatum: JETZT + 5 * TAG }, JETZT);
  const heute = terminGewicht({ pruefungsdatum: JETZT }, JETZT);
  assert.ok(fern < nah && nah < heute, `${fern} < ${nah} < ${heute}`);
  assert.equal(heute, 3, "am Prüfungstag dreifach");
  assert.equal(terminGewicht({ pruefungsdatum: JETZT + TERMIN_HORIZONT_TAGE * TAG }, JETZT), 1);
});

test("ein vergangener Termin zieht nicht mehr", () => {
  assert.equal(terminGewicht({ pruefungsdatum: JETZT - TAG }, JETZT), 1);
});

test("schwache Punkte ziehen ein Fach nach vorn, gute nicht", () => {
  assert.equal(punkteGewicht(15), 1);
  assert.equal(punkteGewicht(0), 2);
  assert.equal(punkteGewicht(null), 1, "ohne Punkte kein Zuschlag und kein Abschlag");
  assert.ok(punkteGewicht(4) > punkteGewicht(11));
});

test("die Dringlichkeit wirkt in beide Richtungen", () => {
  assert.ok(prioritaetsGewicht({ prioritaet: 3 }) > 1);
  assert.equal(prioritaetsGewicht({ prioritaet: 2 }), 1);
  assert.ok(prioritaetsGewicht({ prioritaet: 1 }) < 1);
  assert.equal(prioritaetsGewicht({}), 1, "ohne Angabe gilt normal");
  assert.equal(prioritaetsGewicht({ prioritaet: 99 }), 1, "Unfug gilt als normal");
});

/* Die Gründe müssen mitkommen — eine Gewichtung, die man nicht nachvollziehen
   kann, ist von Willkür nicht zu unterscheiden. */
test("die Gründe für ein Gewicht werden mitgeliefert", () => {
  const g = fachGewicht(
    { pruefungsdatum: JETZT + 3 * TAG, prioritaet: 3 },
    { punkte: 4, zeit: JETZT });
  assert.ok(g.gewicht > 3);
  assert.equal(g.gruende.length, 3);
  assert.ok(g.gruende.some((x) => /Prüfung in 3 Tagen/.test(x)));
  assert.ok(g.gruende.includes("schwache Punkte"));
  assert.ok(g.gruende.includes("vordringlich"));
});

test("ein unauffälliges Fach hat Gewicht eins und keine Gründe", () => {
  const g = fachGewicht({ prioritaet: 2 }, { punkte: null, zeit: JETZT });
  assert.equal(g.gewicht, 1);
  assert.deepEqual(g.gruende, []);
});

/* ---------------------------- Gewicht je Karte -------------------------- */

/*
 * Die Zustände werden mit dem echten Planer erzeugt, nicht von Hand
 * hingeschrieben. Beim ersten Anlauf hatte ich sie erfunden und `reps`
 * vergessen — `istNeu` prüft das mit, und schon galt eine seit Tagen
 * überfällige Karte als ungesehen. Die Prüfung war falsch, nicht der Code;
 * gemerkt hätte man es an einem erfundenen Zustand nie.
 */
test("Überfälliges wiegt schwerer als Ungesehenes, Sitzendes am wenigsten", () => {
  const gelernt = (male, letzteNote) => {
    let z = neuerZustand("k", "td", "s", "f", JETZT - 200 * TAG);
    for (let i = 0; i < male; i++)
      z = bewerteKarte(z, letzteNote, { zeit: JETZT - (190 - i * 10) * TAG });
    return z;
  };

  const neu = kartenGewicht(null, JETZT);
  const faellig = kartenGewicht(gelernt(3, NOTEN.GUT), JETZT);
  const sitzt = kartenGewicht(
    { ...gelernt(6, NOTEN.LEICHT), due: JETZT + 200 * TAG, last_review: JETZT }, JETZT);

  assert.ok(faellig > neu, `fällig ${faellig} > neu ${neu}`);
  assert.ok(neu > sitzt, `neu ${neu} > sitzt ${sitzt}`);
});

test("stillgelegte Karten kommen gar nicht vor", () => {
  assert.equal(kartenGewicht({ gesperrt: true }, JETZT), 0);
});

/* ------------------------------ Die Auswahl ----------------------------- */

/** Ein kleiner Bestand: zwei Fächer, je ein Stapel, je zehn Karten. */
function bestand({ nichtRelevant = [] } = {}) {
  const faecher = [
    { ...neuesFach("Mathematik"), id: "f_mathe" },
    { ...neuesFach("Deutsch"), id: "f_deutsch" },
  ];
  const stapel = [
    { id: "s_mathe", title: "Mathe", subjectId: "f_mathe", folderId: "o1" },
    { id: "s_deutsch", title: "Deutsch", subjectId: "f_deutsch", folderId: "o2" },
  ];
  const karten = [];
  for (const s of stapel)
    for (let i = 0; i < 10; i++)
      karten.push({
        ...neueKarte(s.id, s.id + "-frage-" + i, "antwort", i),
        id: s.id + "-k" + i,
        nichtRelevant: nichtRelevant.includes(s.id + "-k" + i),
      });
  return {
    faecher, stapel, karten,
    stapelVon: (id) => stapel.find((s) => s.id === id) || null,
    faecherVon: () => faecher,
  };
}

/** Ein Zufallsgenerator mit festem Startwert — sonst wackeln die Zahlen. */
function wuerfelMit(startwert) {
  let a = startwert >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("es kommen genau so viele Fragen wie bestellt", () => {
  const b = bestand();
  const r = baueFragen({
    ...b, zustaende: {}, umfang: 7, zeit: JETZT, wuerfel: wuerfelMit(1),
  });
  assert.equal(r.aufgaben.length, 7);
  assert.equal(r.vorrat, 20);
});

test("mehr bestellt als vorhanden gibt, was da ist", () => {
  const b = bestand();
  const r = baueFragen({
    ...b, zustaende: {}, umfang: 500, zeit: JETZT, wuerfel: wuerfelMit(2),
  });
  assert.equal(r.aufgaben.length, 20);
});

test("keine Karte kommt in einer Runde zweimal", () => {
  const b = bestand();
  const r = baueFragen({
    ...b, zustaende: {}, umfang: 20, zeit: JETZT, wuerfel: wuerfelMit(3),
  });
  const schluessel = r.aufgaben.map((a) => a.schluessel);
  assert.equal(new Set(schluessel).size, schluessel.length);
});

/*
 * Der eigentliche Punkt des ganzen Moduls: Abgehaktes kommt nicht mehr dran.
 * Es wird nicht geloescht — es wird uebergangen und gezaehlt.
 */
test("abgehakte Karten kommen nicht vor, werden aber gezählt", () => {
  const weg = ["s_mathe-k0", "s_mathe-k1", "s_mathe-k2"];
  const b = bestand({ nichtRelevant: weg });
  const r = baueFragen({
    ...b, zustaende: {}, umfang: 20, zeit: JETZT, wuerfel: wuerfelMit(4),
  });
  assert.equal(r.abgehakt, 3);
  assert.equal(r.vorrat, 17);
  for (const a of r.aufgaben)
    assert.ok(!weg.includes(a.karte.id), "abgehakte Karte gezogen: " + a.karte.id);
  // Und die Karte selbst gilt als nicht relevant.
  assert.equal(istRelevant(b.karten.find((k) => k.id === weg[0])), false);
});

test("ein Bereich schränkt die Auswahl ein", () => {
  const b = bestand();
  const r = baueFragen({
    ...b, zustaende: {}, umfang: 20, zeit: JETZT, wuerfel: wuerfelMit(5),
    bereich: { art: "fach", id: "f_mathe" },
  });
  assert.equal(r.aufgaben.length, 10);
  for (const a of r.aufgaben) assert.equal(a.fachId, "f_mathe");
});

/*
 * Und nun das, was man einer einzelnen Runde nicht ansieht: Wirkt die
 * Gewichtung? Hundert Runden zu je vier Fragen, dann zählen. Bei einem Fach
 * mit Prüfung in fünf Tagen und vier Punkten gegen ein unauffälliges muss der
 * Unterschied deutlich sein — sonst ist die Gewichtung Zierrat.
 */
test("ein bedrängtes Fach kommt über viele Runden deutlich häufiger dran", () => {
  const b = bestand();
  b.faecher[0].pruefungsdatum = JETZT + 5 * TAG;
  const punkteVon = (id) => (id === "f_mathe" ? 4 : 12);

  let mathe = 0, deutsch = 0;
  for (let runde = 0; runde < 100; runde++) {
    const r = baueFragen({
      ...b, zustaende: {}, punkteVon, umfang: 4, zeit: JETZT,
      wuerfel: wuerfelMit(1000 + runde),
    });
    for (const a of r.aufgaben) {
      if (a.fachId === "f_mathe") mathe += 1; else deutsch += 1;
    }
  }
  assert.ok(mathe > deutsch * 1.5,
    `Mathematik ${mathe} gegen Deutsch ${deutsch} — die Gewichtung wirkt zu schwach`);
  assert.ok(deutsch > 0, "das andere Fach darf nicht ganz verschwinden");
});

test("ohne Gewichtung kommen beide Fächer etwa gleich oft", () => {
  const b = bestand();
  b.faecher[0].pruefungsdatum = JETZT + 2 * TAG;
  const punkteVon = (id) => (id === "f_mathe" ? 0 : 15);

  let mathe = 0, deutsch = 0;
  for (let runde = 0; runde < 100; runde++) {
    const r = baueFragen({
      ...b, zustaende: {}, punkteVon, umfang: 4, zeit: JETZT, gewichten: false,
      wuerfel: wuerfelMit(2000 + runde),
    });
    for (const a of r.aufgaben) {
      if (a.fachId === "f_mathe") mathe += 1; else deutsch += 1;
    }
  }
  const abweichung = Math.abs(mathe - deutsch) / (mathe + deutsch);
  assert.ok(abweichung < 0.15,
    `${mathe} gegen ${deutsch} — ohne Gewichtung sollte es ausgeglichen sein`);
});

test("die Begründung nennt die beteiligten Fächer und ihre Anzahl", () => {
  const b = bestand();
  b.faecher[0].pruefungsdatum = JETZT + 3 * TAG;
  const r = baueFragen({
    ...b, zustaende: {}, umfang: 12, zeit: JETZT, wuerfel: wuerfelMit(7),
  });
  assert.ok(r.beteiligt.length >= 1);
  const summe = r.beteiligt.reduce((s, x) => s + x.anzahl, 0);
  assert.equal(summe, r.aufgaben.length);
  const mathe = r.beteiligt.find((x) => x.fach.id === "f_mathe");
  assert.ok(mathe.gruende.some((g) => /Prüfung/.test(g)));
});

test("ohne Gewichtung gibt es keine Begründung zu zeigen", () => {
  const b = bestand();
  const r = baueFragen({
    ...b, zustaende: {}, umfang: 5, zeit: JETZT, gewichten: false,
    wuerfel: wuerfelMit(8),
  });
  assert.deepEqual(r.beteiligt, []);
});

/* Eine stillgelegte Karte darf auch hier nicht auftauchen — sie wartet auf
   ihre Überarbeitung, nicht auf noch eine Runde Scheitern. */
test("stillgelegte Karten bleiben auch im Fragemodus draußen", () => {
  const b = bestand();
  const zustaende = {};
  const z = { ...neuerZustand("s_mathe-k0", "td", "s_mathe", "f_mathe", JETZT - 40 * TAG),
    gesperrt: true, reps: 20, lapses: 8, state: 2 };
  assert.equal(z.gesperrt, true, "die Vorbereitung stimmt nicht: Karte ist nicht gesperrt");
  zustaende["s_mathe-k0:td"] = z;

  const r = baueFragen({
    ...b, zustaende, umfang: 20, zeit: JETZT, wuerfel: wuerfelMit(9),
  });
  assert.ok(!r.aufgaben.some((a) => a.schluessel === "s_mathe-k0:td"));
  assert.equal(r.vorrat, 19);
});
