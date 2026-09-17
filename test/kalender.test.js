/*
 * Kalenderdatei: Apple und Google sind streng.
 *
 * Eine .ics-Datei mit zu langen Zeilen oder unmaskierten Sonderzeichen wird
 * nicht bemängelt, sondern stillschweigend halb oder gar nicht eingelesen —
 * man merkt es erst, wenn der Termin fehlt. Darum stehen Faltung und
 * Maskierung hier unter Test.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  alsTag, alsZeitpunkt, alsOrtszeit, maskiere, falte, pruefungsTermin,
  taeglicheErinnerung, alsKalender, termineDatei, dateiname,
} from "../src/core/kalender.js";

const jetzt = new Date(2026, 8, 17, 12, 30).getTime();
const fach = (a = {}) => ({
  id: "f1", name: "Mathematik", deleted: false,
  pruefungsdatum: new Date(2027, 3, 20).getTime(), ...a,
});

test("Datum und Zeitstempel im vorgeschriebenen Format", () => {
  assert.equal(alsTag(new Date(2027, 3, 20).getTime()), "20270420");
  assert.match(alsZeitpunkt(jetzt), /^\d{8}T\d{6}Z$/);
  assert.match(alsOrtszeit(jetzt), /^20260917T123000$/);
});

test("Sonderzeichen werden maskiert", () => {
  assert.equal(maskiere("a,b;c"), "a\\,b\\;c");
  assert.equal(maskiere("Zeile\nZeile"), "Zeile\\nZeile");
  assert.equal(maskiere("Pfad\\hier"), "Pfad\\\\hier");
  assert.equal(maskiere(null), "");
});

test("lange Zeilen werden gefaltet, Umlaute zählen doppelt", () => {
  const lang = "DESCRIPTION:" + "a".repeat(200);
  const gefaltet = falte(lang);
  for (const zeile of gefaltet.split("\r\n"))
    assert.ok(Buffer.byteLength(zeile, "utf8") <= 75, "zu lang: " + zeile.length);
  assert.ok(gefaltet.split("\r\n").slice(1).every((z) => z.startsWith(" ")),
    "Fortsetzungen beginnen mit einem Leerzeichen");
  // Ohne Faltung bleibt die Zeile unberührt.
  assert.equal(falte("SUMMARY:kurz"), "SUMMARY:kurz");
  const umlaute = falte("SUMMARY:" + "ä".repeat(60));
  for (const zeile of umlaute.split("\r\n"))
    assert.ok(Buffer.byteLength(zeile, "utf8") <= 75);
});

test("ein Prüfungstermin ist ganztägig und weckt zweimal vorher", () => {
  const t = pruefungsTermin(fach(), { jetzt });
  assert.match(t, /DTSTART;VALUE=DATE:20270420/);
  assert.match(t, /DTEND;VALUE=DATE:20270421/, "der Folgetag begrenzt den ganzen Tag");
  assert.match(t, /SUMMARY:Prüfung: Mathematik/);
  assert.equal((t.match(/BEGIN:VALARM/g) || []).length, 2);
  assert.match(t, /TRIGGER:-P7D/);
  assert.match(t, /TRIGGER:-P1D/);
  assert.match(t, /UID:pruefung-f1@smart-learning/);
});

/* Dieselbe Kennung bei jedem Erzeugen: Sonst liegen nach dem zweiten
   Einlesen zwei Termine uebereinander. */
test("die Kennung eines Termins bleibt gleich", () => {
  const a = pruefungsTermin(fach(), { jetzt });
  const b = pruefungsTermin(fach(), { jetzt: jetzt + 99999 });
  const kennung = (t) => t.match(/UID:[^\r\n]+/)[0];
  assert.equal(kennung(a), kennung(b));
});

test("ohne Termin kein Eintrag", () => {
  assert.equal(pruefungsTermin(fach({ pruefungsdatum: null }), { jetzt }), null);
  assert.equal(pruefungsTermin(null), null);
  assert.equal(alsKalender([]), null);
  assert.equal(termineDatei([], {}), null);
});

test("die tägliche Erinnerung wiederholt sich und weckt zur Zeit", () => {
  const e = taeglicheErinnerung({ stunde: 18, minute: 30, jetzt });
  assert.match(e, /RRULE:FREQ=DAILY/);
  assert.match(e, /DTSTART:20260917T183000/, "heute 18:30 liegt noch vor uns");
  assert.match(e, /TRIGGER:PT0M/);
  // Ist die Uhrzeit schon vorbei, beginnt sie morgen.
  const spaeter = taeglicheErinnerung({ stunde: 8, jetzt });
  assert.match(spaeter, /DTSTART:20260918T080000/);
});

test("die ganze Datei hat Kopf, Fuß und Zeilenenden nach Vorschrift", () => {
  const datei = termineDatei(
    [fach(), fach({ id: "f2", name: "Deutsch, Lyrik", pruefungsdatum: new Date(2027, 2, 1).getTime() })],
    { erinnerung: { stunde: 17 }, jetzt });
  assert.ok(datei.startsWith("BEGIN:VCALENDAR\r\n"));
  assert.ok(datei.endsWith("END:VCALENDAR\r\n"));
  assert.equal((datei.match(/BEGIN:VEVENT/g) || []).length, 3);
  assert.equal((datei.match(/END:VEVENT/g) || []).length, 3);
  assert.match(datei, /SUMMARY:Prüfung: Deutsch\\, Lyrik/, "das Komma ist maskiert");
  // Der frühere Termin steht zuerst.
  assert.ok(datei.indexOf("Deutsch") < datei.indexOf("Mathematik"));
  for (const zeile of datei.split("\r\n"))
    assert.ok(Buffer.byteLength(zeile, "utf8") <= 75, "zu lange Zeile: " + zeile);
  assert.ok(!datei.includes("\n\n"));
});

test("gelöschte Fächer kommen nicht mit", () => {
  const datei = termineDatei([fach({ deleted: true })], { jetzt });
  assert.equal(datei, null);
  assert.match(dateiname(jetzt), /^smart-learning-termine-20260917\.ics$/);
});
