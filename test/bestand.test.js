/*
 * Der Weg der Daten, einmal ganz: anlegen, ändern, speichern, neu laden,
 * sichern, einlesen — gegen den echten Speichercode, mit einer Datenbank im
 * Arbeitsspeicher statt der des Browsers.
 *
 * Genau hier lagen die schwersten Fehler, und keiner war geprüft: Das
 * Dazulegen einer Sicherung setzte den Lernstand zurück, ein misslungenes
 * Speichern blieb unbemerkt, Antwort und Termin wurden getrennt geschrieben.
 */

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import * as db from "../src/core/db.js";
import { erzeugeBestand } from "../src/core/bestand.js";
import { LETZTE } from "../src/core/migrationen.js";
import { neuerZustand } from "../src/core/fsrs.js";

const TAG = 86400000;
let uhr = Date.now();
const jetzt = () => uhr;

beforeEach(async () => {
  await db._zuruecksetzen();
  globalThis.indexedDB = new IDBFactory();
  uhr = Date.now();
});

/** Ein Bestand wie beim Öffnen der App. */
async function oeffnen(optionen = {}) {
  const b = erzeugeBestand({ jetzt, ...optionen });
  await b.aktionen.laden();
  return b;
}

/** Wie ein Neustart: Verbindung zu, neuer Bestand, alles neu gelesen. */
async function neustart() {
  await db._zuruecksetzen();
  return oeffnen();
}

async function stapelMitKarte(b, term = "Haus", definition = "house") {
  const s = await b.aktionen.stapelAnlegen("Englisch");
  const k = await b.aktionen.karteAnlegen(s.id, term, definition);
  return { s, k };
}

test("eine Karte übersteht den Neustart, samt Änderung", async () => {
  const b = await oeffnen();
  const { k } = await stapelMitKarte(b);
  uhr += 1000;
  await b.aktionen.karteAendern(k.id, { definition: "the house" });
  const nachher = await neustart();
  const karte = nachher.lesen().karten.find((x) => x.id === k.id);
  assert.equal(karte.definition, "the house");
  assert.equal(nachher.lesen().speicherfehler, null);
});

test("Umlaute, Sonderzeichen, Formeln und sehr lange Texte kommen heil zurück", async () => {
  const b = await oeffnen();
  const lang = "Ä".repeat(20000);
  const term = "Ärger ß € 😀 „Zitat“\nzweite Zeile $\\frac{1}{2}$ <b>kein HTML</b>";
  const { k } = await stapelMitKarte(b, term, lang);
  const nachher = await neustart();
  const karte = nachher.lesen().karten.find((x) => x.id === k.id);
  assert.equal(karte.term, term);
  assert.equal(karte.definition.length, 20000);
});

test("ein Abruf schreibt Antwort und Termin zusammen", async () => {
  const b = await oeffnen();
  const { s, k } = await stapelMitKarte(b);
  const { zustand } = await b.aktionen.abrufVerbuchen({
    karte: k, stapel: s, bewertung: 3, antwortzeit: 5000, eingabeLeer: true, zeit: uhr,
  });
  assert.ok(zustand, "der neue Zustand kommt zurück");
  const nachher = await neustart();
  const z = nachher.lesen().zustaende[k.id + ":td"];
  const r = nachher.lesen().reviews.filter((x) => x.cardId === k.id);
  assert.equal(r.length, 1);
  assert.equal(r[0].flag, "normal", "im Kopf beantwortet zählt");
  assert.equal(r[0].ohneEingabe, true);
  assert.equal(z.reps, 1);
  assert.ok(z.due > uhr);
});

test("ein misslungenes Speichern wird gemeldet, nicht verschluckt", async () => {
  const kaputt = {
    ...db,
    schreibeMehrere: async () => {
      const e = new Error("voll"); e.name = "QuotaExceededError"; throw e;
    },
  };
  const b = await oeffnen({ db: kaputt });
  await b.aktionen.stapelAnlegen("Mathe");
  const f = b.lesen().speicherfehler;
  assert.ok(f, "der Fehler steht im Bestand");
  assert.match(f.text, /Speicher des Browsers ist voll/);
});

test("Schreiben über mehrere Ablagen gelingt ganz oder gar nicht", async () => {
  const b = await oeffnen();
  const { k } = await stapelMitKarte(b);
  await assert.rejects(db.ersetzeUndSchreibe({
    leeren: ["cards"], schreiben: { cards: [{ ohneKennung: true }] },
  }));
  const nachher = await neustart();
  assert.ok(nachher.lesen().karten.some((x) => x.id === k.id),
    "das Leeren wurde mit dem misslungenen Schreiben zurückgenommen");
});

test("Sicherung hin und zurück ergibt denselben Bestand", async () => {
  const b = await oeffnen();
  const { s, k } = await stapelMitKarte(b);
  await b.aktionen.abrufVerbuchen({ karte: k, stapel: s, bewertung: 3, antwortzeit: 5000, zeit: uhr });
  await b.aktionen.setzeEinstellung("eigeneErscheinungsbilder", [{ id: "eb_1", name: "Abends", werte: {} }]);
  const datei = JSON.parse(JSON.stringify(await b.aktionen.alsSicherung({ mitMedien: false })));

  // Ein anderes Gerät, leer.
  await db._zuruecksetzen();
  globalThis.indexedDB = new IDBFactory();
  const neu = await oeffnen();
  await neu.aktionen.ausSicherung(datei, true);
  const z = neu.lesen();
  assert.ok(z.karten.some((x) => x.id === k.id));
  assert.equal(z.zustaende[k.id + ":td"].reps, 1);
  assert.equal(z.reviews.length, 1);
  assert.equal(z.einstellungen.eigeneErscheinungsbilder[0].name, "Abends",
    "eigene Erscheinungsbilder kommen mit zurück");
});

test("Dazulegen einer alten Sicherung setzt den Lernstand nicht zurück", async () => {
  const b = await oeffnen();
  const { s, k } = await stapelMitKarte(b);
  const alt = JSON.parse(JSON.stringify(await b.aktionen.alsSicherung({ mitMedien: false })));

  uhr += TAG;
  await b.aktionen.karteAendern(k.id, { definition: "home" });
  await b.aktionen.abrufVerbuchen({ karte: k, stapel: s, bewertung: 3, antwortzeit: 5000, zeit: uhr });
  const bericht = await b.aktionen.ausSicherung(alt, false);

  const z = (await neustart()).lesen();
  assert.equal(z.karten.find((x) => x.id === k.id).definition, "home", "die neuere Karte bleibt");
  assert.equal(z.zustaende[k.id + ":td"].reps, 1, "der Lernstand bleibt");
  assert.ok(bericht.aelter >= 1);
});

test("Ersetzen legt das Bisherige in den Papierkorb statt es zu vernichten", async () => {
  const b = await oeffnen();
  const { k: behalten } = await stapelMitKarte(b, "alt", "old");
  const datei = JSON.parse(JSON.stringify(await b.aktionen.alsSicherung({ mitMedien: false })));
  uhr += TAG;
  const spaeter = await b.aktionen.karteAnlegen(behalten.setId, "neu", "new");

  await b.aktionen.ausSicherung(datei, true);
  const z = b.lesen();
  assert.ok(z.karten.some((x) => x.id === behalten.id));
  assert.ok(!z.karten.some((x) => x.id === spaeter.id), "die spätere Karte ist weg …");
  const korb = await b.aktionen.papierkorbLesen();
  assert.ok(korb.karten.some((x) => x.id === spaeter.id), "… aber im Papierkorb");
  assert.ok((await db.sicherungen()).some((x) => x.grund === "vor-ersetzen"),
    "davor liegt eine Kopie im Browser");
});

test("eine unbrauchbare Datei ändert nichts", async () => {
  const b = await oeffnen();
  await stapelMitKarte(b);
  await assert.rejects(b.aktionen.ausSicherung({ fassung: 8 }, true));
  assert.equal((await neustart()).lesen().karten.length, 1);
});

test("die erste Umstellung gibt nach alter Regel gesperrte Karten frei, mit Kopie davor", async () => {
  const b = await oeffnen();
  const { s, k } = await stapelMitKarte(b);
  // Ein Stand wie vor der Umstellung: gesperrt nach sechsmal Nochmal, ohne echte Rückfälle.
  const alt = { ...neuerZustand(k.id, "td", s.id, null, uhr), gesperrt: true, reps: 6,
    lapses: 1, nochmalGesamt: 6, state: 1 };
  await db.schreibeMehrere({ cardstates: [alt], settings: [{ key: "datenFassung", value: 0 }] });

  const nachher = await neustart();
  assert.equal(nachher.lesen().zustaende[k.id + ":td"].gesperrt, false);
  assert.equal(await db.getSetting("datenFassung", 0), LETZTE);
  assert.ok((await db.sicherungen()).some((x) => String(x.grund).startsWith("vor-umstellung")));
  assert.equal(nachher.lesen().umgestellt.length, LETZTE);

  // Ein zweiter Start stellt nichts mehr um.
  assert.deepEqual((await neustart()).lesen().umgestellt, []);
});

test("ein neuer, leerer Speicher braucht keine Umstellung und keine Kopie", async () => {
  await oeffnen();
  assert.equal(await db.getSetting("datenFassung", 0), LETZTE);
  assert.equal((await db.sicherungen()).length, 0);
});

test("eine automatische Kopie lässt sich wieder einlesen", async () => {
  const b = await oeffnen();
  const { k } = await stapelMitKarte(b);
  await db.sicherungAnlegen("hand");
  uhr += TAG;
  await b.aktionen.karteLoeschen(k.id);
  const [kopie] = await db.sicherungen();
  const datei = await db.kopieAlsSicherung(kopie.id);
  await b.aktionen.ausSicherung(datei, true);
  assert.ok(b.lesen().karten.some((x) => x.id === k.id));
});

test("eine überarbeitete Karte ist nicht mehr gesperrt", async () => {
  const b = await oeffnen();
  const { s, k } = await stapelMitKarte(b);
  const gesperrt = { ...neuerZustand(k.id, "td", s.id, null, uhr), gesperrt: true, lapses: 9, reps: 20 };
  await db.schreibeMehrere({ cardstates: [gesperrt] });
  const neu = await neustart();
  assert.equal(neu.lesen().zustaende[k.id + ":td"].gesperrt, true);
  await neu.aktionen.karteAendern(k.id, { starred: true });
  assert.equal(neu.lesen().zustaende[k.id + ":td"].gesperrt, true, "Markieren ist kein Überarbeiten");
  await neu.aktionen.karteAendern(k.id, { definition: "a house, a home" });
  assert.equal((await neustart()).lesen().zustaende[k.id + ":td"].gesperrt, false);
});

test("verschobene Karten nehmen ihren Lernstand mit, auch nach dem Neustart", async () => {
  const b = await oeffnen();
  const { s, k } = await stapelMitKarte(b);
  const fach = await b.aktionen.fachAnlegen("Spanisch");
  const ziel = await b.aktionen.stapelAnlegen("Vokabeln");
  await b.aktionen.stapelAendern(ziel.id, { subjectId: fach.id });
  await b.aktionen.abrufVerbuchen({ karte: k, stapel: s, bewertung: 3, antwortzeit: 5000, zeit: uhr });
  await b.aktionen.kartenVerschieben([k.id], ziel.id);
  const z = (await neustart()).lesen().zustaende[k.id + ":td"];
  assert.equal(z.setId, ziel.id);
  assert.equal(z.subjectId, fach.id);
});

test("ein zurückgeholter Stapel bringt nur die Karten mit, die mit ihm gingen", async () => {
  const b = await oeffnen();
  const { s, k } = await stapelMitKarte(b);
  const frueher = await b.aktionen.karteAnlegen(s.id, "weg", "gone");
  uhr += 1000;
  await b.aktionen.karteLoeschen(frueher.id);
  uhr += 1000;
  await b.aktionen.stapelLoeschen(s.id);
  await b.aktionen.wiederherstellen("stapel", s.id);
  const z = (await neustart()).lesen();
  assert.ok(z.stapel.some((x) => x.id === s.id));
  assert.ok(z.karten.some((x) => x.id === k.id));
  assert.ok(!z.karten.some((x) => x.id === frueher.id), "die vorher gelöschte bleibt im Papierkorb");
});

test("ein zurückgeholter Ordner bringt seine Stapel und Karten mit", async () => {
  const b = await oeffnen();
  const o = await b.aktionen.ordnerAnlegen("Abitur");
  const s = await b.aktionen.stapelAnlegen("Chemie", o.id);
  const k = await b.aktionen.karteAnlegen(s.id, "H2O", "Wasser");
  uhr += 1000;
  await b.aktionen.ordnerLoeschen(o.id);
  assert.equal(b.lesen().karten.length, 0);
  await b.aktionen.wiederherstellen("ordner", o.id);
  const z = (await neustart()).lesen();
  assert.ok(z.ordner.some((x) => x.id === o.id));
  assert.ok(z.stapel.some((x) => x.id === s.id));
  assert.ok(z.karten.some((x) => x.id === k.id));
});

test("ein kopierter Stapel behält Reihenfolge und Fach", async () => {
  const b = await oeffnen();
  const fach = await b.aktionen.fachAnlegen("Mathe");
  const s = await b.aktionen.stapelAnlegen("Ableitungen");
  await b.aktionen.stapelAendern(s.id, { subjectId: fach.id });
  const k1 = await b.aktionen.karteAnlegen(s.id, "eins", "1");
  const k2 = await b.aktionen.karteAnlegen(s.id, "zwei", "2");
  await b.aktionen.kartenOrdnen([k2.id, k1.id]);
  const kopie = await b.aktionen.stapelVervielfaeltigen(s.id);
  const z = (await neustart()).lesen();
  const karten = z.karten.filter((x) => x.setId === kopie.id).sort((a, c) => a.order - c.order);
  assert.deepEqual(karten.map((x) => x.term), ["zwei", "eins"]);
  assert.equal(z.stapel.find((x) => x.id === kopie.id).subjectId, fach.id);
});
