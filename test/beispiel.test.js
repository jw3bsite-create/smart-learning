/*
 * Prüfungen für den Beispielbestand.
 *
 * Der Bestand ist kein Beiwerk: An ihm werden Strähne, Behaltenskurve,
 * Kalibrierung und Warteschlange in Augenschein genommen, ehe eigener Stoff da
 * ist. Stimmt er nicht mit sich selbst überein, prüft man an ihm nicht die
 * App, sondern das Beispiel.
 *
 * Die erste Prüfung hier ist die wichtigste. Beim ersten Versuch trugen die
 * Reviews die Marke nicht — der Bestand ließ sich anlegen, aber nicht mehr
 * vollständig entfernen, und tausendfünfhundert Antworten auf nicht mehr
 * vorhandene Karten fütterten anschließend still die Statistik.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { baueBeispieldaten, MARKE } from "../src/core/beispiel.js";
import { kartenArt, clozeAnzahl, richtungenFuer, schritteVon } from "../src/core/model.js";
import { istPlausibel } from "../src/core/kalibrierung.js";
import { straehne, TAGESPENSUM } from "../src/core/straehne.js";
import { behaltenskurve, kalibrierung } from "../src/core/kalibrierung.js";

const JETZT = new Date(2026, 8, 2, 12, 0, 0).getTime();
const bestand = baueBeispieldaten({ jetzt: JETZT });

test("jeder einzelne Datensatz trägt die Marke", () => {
  for (const [ablage, saetze] of Object.entries(bestand)) {
    assert.ok(saetze.length > 0, ablage + " ist leer");
    for (const rec of saetze)
      assert.equal(rec[MARKE], true,
        "ohne Marke bliebe dieser Datensatz beim Entfernen liegen: "
        + ablage + " / " + rec.id);
  }
});

test("die Kennungen sind eindeutig", () => {
  for (const [ablage, saetze] of Object.entries(bestand)) {
    const kennungen = new Set(saetze.map((r) => r.id));
    assert.equal(kennungen.size, saetze.length, "doppelte Kennung in " + ablage);
  }
});

test("jede Karte gehört zu einem vorhandenen Stapel, jeder Stapel zu einem Fach", () => {
  const stapel = new Set(bestand.sets.map((s) => s.id));
  const faecher = new Set(bestand.subjects.map((f) => f.id));
  const ordner = new Set(bestand.folders.map((o) => o.id));
  for (const k of bestand.cards)
    assert.ok(stapel.has(k.setId), "Karte ohne Stapel: " + k.term);
  for (const s of bestand.sets) {
    assert.ok(faecher.has(s.subjectId), "Stapel ohne Fach: " + s.title);
    assert.ok(ordner.has(s.folderId), "Stapel ohne Ordner: " + s.title);
  }
});

test("alle vier Kartenarten kommen vor", () => {
  const arten = new Set(bestand.cards.map(kartenArt));
  for (const art of ["frei", "cloze", "bild", "mehrschritt"])
    assert.ok(arten.has(art), "keine Karte der Art " + art);
});

test("Lückentexte haben Lücken, Rechenwege haben Schritte, Bildkarten ein Bild", () => {
  const bildKennungen = new Set(bestand.media.map((b) => b.id));
  for (const k of bestand.cards) {
    const art = kartenArt(k);
    if (art === "cloze")
      assert.ok(clozeAnzahl(k.term) >= 1, "Lückentext ohne Lücke: " + k.term);
    if (art === "mehrschritt")
      assert.ok(schritteVon(k).length >= 2, "Rechenweg ohne Schritte: " + k.term);
    if (art === "bild")
      assert.ok(bildKennungen.has(k.termImage),
        "Bildkarte ohne abgelegtes Bild: " + k.definition);
  }
});

/*
 * Der Zustand entsteht aus `<Karte>:<Richtung>`. Steht dort eine Richtung, die
 * die Karte gar nicht hat, wird der Zustand nie gefunden: Die Karte gilt
 * dauerhaft als neu, obwohl eine Historie zu ihr existiert.
 */
test("jeder Kartenzustand gehört zu einer Karte und einer möglichen Richtung", () => {
  const nachId = new Map(bestand.cards.map((k) => [k.id, k]));
  const stapelNach = new Map(bestand.sets.map((s) => [s.id, s]));
  for (const z of bestand.cardstates) {
    const karte = nachId.get(z.cardId);
    assert.ok(karte, "Zustand ohne Karte: " + z.id);
    const moeglich = richtungenFuer(karte, stapelNach.get(karte.setId));
    assert.ok(moeglich.includes(z.richtung),
      "Zustand in einer Richtung, die es nicht gibt: " + z.id);
    assert.equal(z.id, z.cardId + ":" + z.richtung);
  }
});

test("kein Zustand ohne Historie und keine Historie ohne Karte", () => {
  const karten = new Set(bestand.cards.map((k) => k.id));
  const mitReview = new Set(bestand.reviews
    .filter((r) => r.flag === "normal")
    .map((r) => r.cardId + ":" + r.richtung));
  for (const z of bestand.cardstates)
    assert.ok(mitReview.has(z.id),
      "Zustand ohne einen einzigen Abruf — die Karte stünde als gelernt da: " + z.id);
  for (const r of bestand.reviews)
    assert.ok(karten.has(r.cardId), "Antwort auf eine nicht vorhandene Karte");
});

/*
 * Die App verwirft zu schnell Beantwortetes als Durchklicken. Beispieldaten,
 * die daran scheitern, würden auf der Seite „Sauberkeit der Daten" als
 * Durchklicken erscheinen — ein Beispiel, das sich selbst widerlegt.
 */
test("keine Antwort ist so schnell, dass die App sie verwerfen würde", () => {
  for (const r of bestand.reviews)
    assert.ok(istPlausibel({ antwortzeit: r.antwortzeit, bewertung: r.bewertung }),
      "unplausibel schnelle Antwort: " + r.antwortzeit + " ms");
});

test("nichts liegt in der Zukunft", () => {
  for (const r of bestand.reviews)
    assert.ok(r.zeit <= JETZT, "eine Antwort liegt in der Zukunft");
  for (const s of bestand.sessions)
    assert.ok(s.zeit <= JETZT, "eine Sitzung liegt in der Zukunft");
});

test("Übung verändert keine Termine — sie ist als solche gekennzeichnet", () => {
  const uebung = bestand.reviews.filter((r) => r.flag === "practice");
  assert.ok(uebung.length > 0, "ohne Übung erreicht die Strähne das Pensum nie");
  for (const r of uebung)
    assert.equal(r.konfidenz, null,
      "Übung kennt keine Selbsteinschätzung — sie käme sonst in die Kalibrierung");
});

/* ------------------------- Was die Seiten zeigen ------------------------ */

test("die Strähne kommt zustande und hat Ruhetage verbraucht", () => {
  const s = straehne(bestand.reviews, { jetzt: JETZT, pensum: TAGESPENSUM });
  assert.ok(s.laenge >= 20, "eine Strähne von " + s.laenge + " Tagen ist zu kurz zum Ansehen");
  assert.ok(s.verbrauchteRuhetage > 0, "kein Ruhetag — die Regel bliebe unsichtbar");
});

test("die Behaltenskurve ist über mehrere Abstände besetzt", () => {
  const kurve = behaltenskurve(bestand.reviews);
  const besetzt = kurve.filter((k) => k.gesamt >= 5);
  assert.ok(besetzt.length >= 4,
    "nur " + besetzt.length + " Abstände besetzt — die Kurve wäre nichtssagend");
});

/*
 * Die Kalibrierungsseite soll etwas zeigen, was der Rede wert ist: eine
 * fallende Treppe. Lägen die drei Stufen gleichauf, sähe man der Seite nicht
 * an, ob sie rechnet.
 */
test("die Kalibrierung ergibt eine fallende Treppe", () => {
  const k = kalibrierung(bestand.reviews);
  assert.ok(k.gesamt > 200, "zu wenige eingeschätzte Abrufe");
  assert.ok(k.stufen[1].quote > k.stufen[2].quote,
    "„sicher“ müsste öfter stimmen als „unsicher“");
  assert.ok(k.stufen[2].quote >= k.stufen[3].quote,
    "„unsicher“ müsste öfter stimmen als „keine Ahnung“");
});

test("es ist etwas fällig und etwas neu — sonst ließe sich das Abrufen nicht ansehen", () => {
  const faellig = bestand.cardstates.filter((z) => !z.gesperrt && z.due <= JETZT);
  assert.ok(faellig.length >= 5, "nur " + faellig.length + " fällige Karten");
  const beplant = new Set(bestand.cardstates.map((z) => z.cardId));
  const neu = bestand.cards.filter((k) => !beplant.has(k.id));
  assert.ok(neu.length >= 5, "keine ungesehenen Karten übrig");
});

test("derselbe Startwert ergibt denselben Bestand", () => {
  const nochmal = baueBeispieldaten({ jetzt: JETZT });
  assert.equal(nochmal.reviews.length, bestand.reviews.length);
  assert.equal(nochmal.cardstates.length, bestand.cardstates.length);
  assert.deepEqual(
    nochmal.cardstates.map((z) => Math.round(z.stability * 100)),
    bestand.cardstates.map((z) => Math.round(z.stability * 100)),
    "der Zufall muss reproduzierbar bleiben, sonst ist kein Fehler zweimal zu sehen");
});

/* ===================================================================== */
/*  Was der Bestand zeigen können muss                                   */
/* ===================================================================== */

test("alle fünf Erdteile sind vertreten, Afrika vollständig", () => {
  const titel = bestand.sets.filter((s) => !s.deleted).map((s) => s.title);
  for (const teil of ["Europas", "Südamerikas", "Afrikas", "Asiens", "Nord- und Mittelamerikas"])
    assert.ok(titel.some((t) => t.includes(teil)), "kein Stapel für " + teil);

  const afrika = bestand.sets.find((s) => s.title.includes("Afrikas"));
  const drin = bestand.cards.filter((k) => k.setId === afrika.id && !k.deleted);
  assert.equal(drin.length, 54,
    "die Afrikanische Union hat 54 Mitglieder — es sind " + drin.length);
  const doppelt = drin.length - new Set(drin.map((k) => k.term)).size;
  assert.equal(doppelt, 0, "ein Land steht doppelt im Stapel");
});

test("die Kritik ist nach ihren Abschnitten geteilt", () => {
  const titel = bestand.sets.map((s) => s.title);
  for (const teil of ["Grundbegriffe", "Ästhetik", "Analytik", "Dialektik", "Zitate"])
    assert.ok(titel.some((t) => t.startsWith("KrV") && t.includes(teil)),
      "kein Kant-Stapel für " + teil);
});

/*
 * Die Sperre nach wiederholten Rückfällen ist eine der nützlichsten Vorrichtungen
 * des Systems — sie sagt, dass eine Karte zu groß geschnitten ist. Am Beispiel
 * muss sie zu sehen sein, aber sie darf nicht um sich greifen: Wer im Mittel
 * gut zurechtkommt, hat keine zehn Prozent stillgelegter Karten.
 */
test("es gibt stillgelegte Karten, aber nicht zu viele", () => {
  const gesperrt = bestand.cardstates.filter((z) => z.gesperrt);
  assert.ok(gesperrt.length >= 3, "keine stillgelegte Karte — die Sperre bliebe unsichtbar");
  const anteil = gesperrt.length / bestand.cardstates.length;
  assert.ok(anteil < 0.08,
    Math.round(anteil * 100) + " % stillgelegt — das wäre kein gelungener Verlauf mehr");
});

test("im Papierkorb liegt etwas zum Zurückholen", () => {
  assert.ok(bestand.sets.some((s) => s.deleted), "kein verworfener Stapel");
  assert.ok(bestand.cards.filter((k) => k.deleted).length >= 2, "keine verworfenen Karten");
  // Grabsteine bekommen keinen Lernstand — sie sind gelöscht, nicht verborgen.
  const weg = new Set(bestand.cards.filter((k) => k.deleted).map((k) => k.id));
  for (const z of bestand.cardstates)
    assert.ok(!weg.has(z.cardId), "eine gelöschte Karte hat einen Lernstand");
});

/*
 * Der Endspurt greift erst, wenn ein Termin näher als fünf Tage ist, die
 * Verdichtung ab sechzig. Ohne je ein Fach in beiden Lagen bekäme man diese
 * zwei Rechnungen am Beispielbestand nie zu Gesicht.
 */
test("ein Fach steht im Endspurt, eines in der Verdichtung", () => {
  const tage = (f) => (f.pruefungsdatum - JETZT) / 86400000;
  const mitTermin = bestand.subjects.filter((f) => f.pruefungsdatum);
  assert.ok(mitTermin.some((f) => tage(f) > 0 && tage(f) <= 5), "kein Fach im Endspurt");
  assert.ok(mitTermin.some((f) => tage(f) > 5 && tage(f) <= 60), "kein Fach in der Verdichtung");
});

/*
 * Die Strähne hing beim ersten Anlauf unbemerkt daran, wie groß der Bestand
 * war: Die Übung füllte nur auf, was das Abrufen liegen ließ — und als der
 * Bestand von hundert auf zweihundertachtzig Karten wuchs, ließ es nichts mehr
 * liegen, und die Strähne fiel von achtundfünfzig auf drei Tage. Diese Prüfung
 * hält fest, dass sie am Verlauf hängt und nicht an der Menge.
 */
test("die Strähne hängt nicht an der Menge des Stoffs", () => {
  const s = straehne(bestand.reviews, { jetzt: JETZT, pensum: TAGESPENSUM });
  assert.ok(s.laenge >= 40,
    "nur " + s.laenge + " Tage — das Tagespensum wird nicht verlässlich erreicht");
});

test("jeder Übungsmodus kommt im Verlauf wenigstens einmal vor", () => {
  const modi = new Set(bestand.sessions.map((s) => s.modus));
  assert.ok(modi.size >= 5,
    "nur " + modi.size + " Modi in den Sitzungen — „Zuletzt gelernt“ sähe eintönig aus");
});

test("die Hinweise stehen dort, wo die Antwort strittig ist", () => {
  const mitHinweis = bestand.cards.filter((k) => (k.hint || "").trim());
  assert.ok(mitHinweis.length >= 25, "zu wenige Karten tragen einen Hinweis");
  // Die Fälle, an denen man sonst etwas Falsches lernt.
  for (const land of ["Bolivien", "Südafrika", "Tansania", "Elfenbeinküste", "Sri Lanka"]) {
    const k = bestand.cards.find((x) => x.term === land);
    assert.ok(k, "Land fehlt: " + land);
    assert.ok((k.hint || "").length > 10, "ohne Hinweis lehrt diese Karte etwas Falsches: " + land);
  }
});
