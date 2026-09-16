/*
 * Prüfungen für den Abgleich mit der Wolke.
 *
 * Der Abgleich hat eine Eigenart, die ihn gefährlich macht: Er läuft über
 * `db.SYNCED`, übersetzt aber jede Ablage über eine zweite Liste in einen
 * Namen für die Tabelle. Fehlt dort ein Eintrag, merkt das niemand beim
 * Programmieren — es fällt erst auf, wenn jemand seine Geräte abgleicht und
 * der Lernstand nicht mitkommt.
 *
 * Genau so war es: Vier von zehn Ablagen standen in der Übersetzung. Ordner,
 * Stapel und Karten wären gewandert, der ganze Lernstand nicht.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { SYNCED, STORES, SICHERUNG_FELDER } from "../src/core/db.js";
import {
  ARTEN, normalisiereUrl, saeubereSchluessel, schluesselFehler, adressFehler,
  uebersetze, istKeinAnschluss, anmeldeRueckkehrLesen, passwortPruefen, PASSWORT_MINDEST,
} from "../src/core/cloud.js";

test("jede abzugleichende Ablage hat einen Namen in der Tabelle", () => {
  for (const ablage of SYNCED)
    assert.ok(ARTEN[ablage],
      `"${ablage}" wird abgeglichen, hat aber keinen Namen in ARTEN — `
      + "die Spalte `art` ist `not null`, der Abgleich bräche ab");
});

test("kein Name in der Übersetzung ohne zugehörige Ablage", () => {
  for (const ablage of Object.keys(ARTEN)) {
    assert.ok(STORES.includes(ablage), `ARTEN nennt "${ablage}", das es nicht gibt`);
    assert.ok(SYNCED.includes(ablage),
      `"${ablage}" steht in ARTEN, wird aber gar nicht abgeglichen`);
  }
});

/*
 * Die Namen stehen als Text in der Wolke. Ein geänderter Name macht die
 * bereits abgelegten Zeilen unauffindbar — sie wären nicht gelöscht, aber
 * niemand fände sie wieder. Darum stehen sie hier ein zweites Mal.
 */
test("die Namen in der Tabelle liegen fest", () => {
  assert.deepEqual(ARTEN, {
    folders: "ordner",
    sets: "stapel",
    cards: "karte",
    progress: "stand",
    subjects: "fach",
    cardstates: "zustand",
    reviews: "abruf",
    drafts: "entwurf",
    explanations: "erklaerung",
    exams: "pruefung",
    noten: "note",
    lernzeit: "lernzeit",
  });
});

test("die Namen sind untereinander verschieden", () => {
  const namen = Object.values(ARTEN);
  assert.equal(new Set(namen).size, namen.length,
    "zwei Ablagen unter demselben Namen würden einander überschreiben");
});

/* ------------------------------ Die Tabelle ----------------------------- */

const sql = readFileSync(new URL("../wolke.sql", import.meta.url), "utf8");

test("die Tabelle steht unter Zeilenschutz", () => {
  assert.match(sql, /enable row level security/i,
    "ohne Zeilenschutz käme jede angemeldete Kennung an alle Zeilen");
});

/*
 * Vier Regeln, für jede Art des Zugriffs eine. Fehlte etwa die für das
 * Löschen, könnte ein Fremder zwar nichts lesen, aber alles wegräumen.
 */
test("für jeden Zugriff gibt es eine eigene Regel auf die eigene Kennung", () => {
  for (const zugriff of ["select", "insert", "update", "delete"])
    assert.match(sql, new RegExp("for\\s+" + zugriff, "i"),
      "keine Regel für " + zugriff);
  const treffer = sql.match(/auth\.uid\(\)\s*=\s*user_id/g) || [];
  assert.ok(treffer.length >= 5,
    "zu wenige Bedingungen auf die eigene Kennung — gefunden: " + treffer.length);
});

test("die Bilder liegen nicht öffentlich", () => {
  assert.match(sql, /values\s*\(\s*'bilder',\s*'bilder',\s*false\s*\)/i,
    "der Eimer für Bilder wäre öffentlich lesbar");
  assert.match(sql, /storage\.foldername\(name\)\)\[1\]\s*=\s*auth\.uid\(\)::text/i,
    "ohne diese Bedingung käme jede Kennung an fremde Bilder");
});

test("der Schlüssel der Tabelle ist Kennung und Datensatz zusammen", () => {
  assert.match(sql, /primary key\s*\(\s*user_id\s*,\s*id\s*\)/i,
    "sonst schlägt das Zusammenführen beim Abgleich fehl (onConflict user_id,id)");
});

/* ============================ Die Projektadresse ========================= */

/*
 * Supabase zeigt im Verwaltungsbereich die REST-Adresse groß an —
 * `https://…supabase.co/rest/v1/`. Genau die trägt man ein, und dann geht
 * nichts: Die Bibliothek hängt ihre eigenen Wege hinten an. Zurück kommt ein
 * schlichtes „kein Anschluss", und man sucht den Fehler beim Schlüssel, bei
 * der Tabelle, bei den Schutzregeln — überall, nur nicht dort.
 */
test("die REST-Adresse wird auf die Projektadresse gekürzt", () => {
  const ziel = "https://beispiel.supabase.co";
  for (const eingabe of [
    "https://beispiel.supabase.co/rest/v1/",
    "https://beispiel.supabase.co/rest/v1",
    "https://beispiel.supabase.co/auth/v1/",
    "https://beispiel.supabase.co/storage/v1/",
    "https://beispiel.supabase.co/realtime/v1",
    "https://beispiel.supabase.co/",
    "https://beispiel.supabase.co",
    "  https://beispiel.supabase.co/rest/v1/  ",
  ])
    assert.equal(normalisiereUrl(eingabe), ziel, "nicht gekürzt: " + eingabe);
});

test("eine Adresse ohne Vorsatz bekommt https", () => {
  assert.equal(normalisiereUrl("beispiel.supabase.co"), "https://beispiel.supabase.co");
  assert.equal(normalisiereUrl("beispiel.supabase.co/rest/v1/"), "https://beispiel.supabase.co");
});

test("nichts bleibt nichts", () => {
  for (const leer of ["", "   ", null, undefined])
    assert.equal(normalisiereUrl(leer), "");
});

/*
 * Nur der letzte Wegabschnitt wird abgeschnitten. Läge ein Projekt hinter
 * einem eigenen Namen mit Unterpfad, dürfte der nicht verlorengehen.
 */
test("ein eigener Pfad bleibt erhalten", () => {
  assert.equal(normalisiereUrl("https://eigene.example/supabase/rest/v1/"),
    "https://eigene.example/supabase");
  assert.equal(normalisiereUrl("https://eigene.example/supabase"),
    "https://eigene.example/supabase");
});

/* ========================= Schlüssel und Meldungen ======================= */

/*
 * Der Browser wirft beim Abgleich eine Meldung, die niemand deuten kann:
 * „String contains non ISO-8859-1 code point". Sie bedeutet, dass im
 * Schlüssel ein Zeichen steht, das nicht in eine Kopfzeile passt — beim
 * Kopieren aus einem Fließtext mitgekommen. Der Browser nennt weder das Feld
 * noch die Stelle; die App muss das tun.
 */
test("ein tauglicher Schlüssel wird nicht beanstandet", () => {
  assert.equal(schluesselFehler("sb_publishable_mosruqnhrDJKUJpQu5aKVg_FQy8D-oe"), "");
  assert.equal(schluesselFehler("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc-_.def"), "");
});

test("ein fremdes Zeichen wird mit seiner Stelle genannt", () => {
  for (const zeichen of ["—", "…", "„", "ä", " "]) {
    const fehler = schluesselFehler("sb_publishable_abc" + zeichen + "defghijklmnop");
    assert.match(fehler, /Stelle 19/, "Stelle fehlt bei " + JSON.stringify(zeichen));
    assert.ok(fehler.includes(zeichen), "das Zeichen selbst wird nicht gezeigt");
  }
});

/*
 * Unsichtbares wird stillschweigend entfernt statt beanstandet: Man kann es
 * nicht sehen und darum auch nicht von Hand wegnehmen.
 */
test("unsichtbare Zeichen werden entfernt, nicht beanstandet", () => {
  const sauber = "sb_publishable_mosruqnhrDJKUJpQu5aKVg";
  for (const code of [0x200b, 0x200c, 0x200d, 0x2060, 0xfeff, 0x00ad]) {
    const verunreinigt = "sb_publishable_mosruq" + String.fromCodePoint(code)
      + "nhrDJKUJpQu5aKVg";
    assert.equal(saeubereSchluessel(verunreinigt), sauber,
      "nicht entfernt: U+" + code.toString(16));
    assert.equal(schluesselFehler(verunreinigt), "");
  }
});

test("Leerzeichen davor und dahinter stören nicht", () => {
  assert.equal(saeubereSchluessel("  sb_publishable_mosruqnhrDJKUJpQu5aKVg\n"),
    "sb_publishable_mosruqnhrDJKUJpQu5aKVg");
});

test("fehlender oder abgeschnittener Schlüssel wird erkannt", () => {
  assert.match(schluesselFehler(""), /fehlt/i);
  assert.match(schluesselFehler("sb_pub"), /zu kurz/i);
});

test("die Adresse wird auf Brauchbarkeit geprüft", () => {
  assert.equal(adressFehler("https://sqytpfqezmobqhrkwgdo.supabase.co/rest/v1/"), "");
  assert.equal(adressFehler("sqytpfqezmobqhrkwgdo.supabase.co"), "");
  assert.match(adressFehler(""), /fehlt/i);
  assert.match(adressFehler("supabase"), /Adresse aus/i);
  assert.match(adressFehler("https://beispiel….supabase.co"), /…/);
});

/* ============================ Die Sicherungsdatei ======================= */

/*
 * Dieselbe Sorte Fehler wie oben, nur an anderer Stelle: Beim Hinzufuegen der
 * Ablage `noten` fehlte sie in der Sicherung, im Einlesen und in der
 * Auffanglinie — drei von Hand gefuehrte Listen, alle drei vergessen. Eine
 * heruntergeladene Sicherung haette die Punkte kommentarlos nicht enthalten,
 * und gemerkt haette man es erst beim Wiederherstellen.
 */
test("die Sicherung deckt jede abzugleichende Ablage ab", () => {
  for (const ablage of SYNCED)
    assert.ok(SICHERUNG_FELDER[ablage],
      `"${ablage}" wird abgeglichen, steht aber in keiner Sicherung`);
});

test("kein Feld in der Sicherung ohne zugehörige Ablage", () => {
  for (const ablage of Object.keys(SICHERUNG_FELDER))
    assert.ok(STORES.includes(ablage), `Sicherung nennt "${ablage}", das es nicht gibt`);
});

/* Die Feldnamen stehen in jeder je geschriebenen Datei. Ein neuer Name macht
   alte Sicherungen unlesbar — lautlos, denn fehlende Felder werden übergangen. */
test("die Feldnamen der Sicherung liegen fest", () => {
  assert.deepEqual(SICHERUNG_FELDER, {
    folders: "ordner",
    sets: "stapel",
    cards: "karten",
    progress: "staende",
    subjects: "faecher",
    cardstates: "zustaende",
    reviews: "reviews",
    drafts: "entwuerfe",
    explanations: "erklaerungen",
    exams: "pruefungen",
    noten: "notenfaecher",
    lernzeit: "lernzeiten",
  });
});

test("die Feldnamen sind untereinander verschieden", () => {
  const felder = Object.values(SICHERUNG_FELDER);
  assert.equal(new Set(felder).size, felder.length,
    "zwei Ablagen unter demselben Feld würden einander in der Datei überschreiben");
});

/* ============================ Kein Anschluss ============================ */

/*
 * Jeder Browser sagt es anders, wenn eine Anfrage nicht ankommt. Übersetzt
 * wurde zuerst nur Chromes Fassung — auf dem iPad stand deshalb „Load failed"
 * roh da, ausgerechnet auf dem Gerät, auf dem man am wenigsten nachsehen kann.
 */
test("jede Browserfassung von kein Anschluss wird erkannt", () => {
  for (const meldung of [
    "Failed to fetch",
    "TypeError: Load failed",
    "NetworkError when attempting to fetch resource.",
    "Network request failed",
  ]) {
    assert.ok(istKeinAnschluss(meldung), "nicht erkannt: " + meldung);
    const text = uebersetze(meldung);
    assert.notEqual(text, meldung, "roh durchgereicht: " + meldung);
    assert.match(text, /pausiert/, "der häufigste Grund fehlt in: " + text);
  }
});

test("andere Meldungen gelten nicht als fehlender Anschluss", () => {
  assert.equal(istKeinAnschluss("Invalid login credentials"), false);
  assert.equal(istKeinAnschluss(""), false);
  assert.match(uebersetze("Invalid login credentials"), /Passwort/);
});

/*
 * Nach erfolgreicher Anmeldung kam auf dem Handy "Could not find the table
 * 'public.karteikasten' in the schema cache". Die Anmeldung stimmte, nur die
 * Tabelle fehlte im Projekt. Roh durchgereicht klingt das nach einem Defekt
 * der App; es ist ein fehlender Einrichtungsschritt.
 */
test("eine fehlende Tabelle wird als fehlender Einrichtungsschritt erklärt", () => {
  const text = uebersetze(
    "Could not find the table 'public.karteikasten' in the schema cache");
  assert.match(text, /SQL Editor/);
  assert.match(text, /wolke\.sql/);
  assert.equal(istKeinAnschluss(text), false);
});

test("der SQL-Text liest den Zwischenspeicher der Schnittstelle neu ein", () => {
  assert.match(sql, /notify\s+pgrst\s*,\s*'reload schema'/i);
});

/* ============================ Passwort und Rückkehr ===================== */

/*
 * Supabase hängt die Anmeldung aus einer Mail hinter das # — dort, wo auch
 * die Seitenwege der App liegen. Die Unterscheidung muss zuverlässig sein:
 * Hält die App einen Seitenweg für eine Rückkehr, verbiegt sie ihn; übersieht
 * sie eine Rückkehr, bleibt die Anmeldung ungelesen in der Adresse liegen.
 */
test("eine Rückkehr zum Zurücksetzen des Passworts wird erkannt", () => {
  assert.deepEqual(
    anmeldeRueckkehrLesen("#access_token=abc&expires_in=3600&refresh_token=def&token_type=bearer&type=recovery"),
    { art: "recovery" });
});

test("eine Rückkehr aus der Bestätigungsmail wird erkannt", () => {
  assert.deepEqual(anmeldeRueckkehrLesen("#access_token=abc&type=signup"), { art: "signup" });
});

/* Genau diese Adresse kam beim Nutzer an — abgelaufen und obendrein auf den
   falschen Rechner zeigend. */
test("ein abgelaufener Verweis wird als Fehler mit seinem Grund erkannt", () => {
  const r = anmeldeRueckkehrLesen(
    "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired&sb=");
  assert.equal(r.art, "fehler");
  assert.equal(r.code, "otp_expired");
  assert.match(uebersetze(r.code + " " + r.text), /abgelaufen/);
});

test("die eigenen Seitenwege der App sind keine Rückkehr", () => {
  for (const hash of ["", "#", "#/", "#/einstellungen", "#/stapel/s_abc/lernen", "#/fragen"])
    assert.equal(anmeldeRueckkehrLesen(hash), null, "fälschlich erkannt: " + hash);
});

test("ein neues Passwort wird vor dem Absenden geprüft", () => {
  assert.match(passwortPruefen("", ""), /fehlt/);
  assert.match(passwortPruefen("kurz", "kurz"), /zu kurz/);
  assert.match(passwortPruefen("langgenug1", "langgenug2"), /nicht .berein/);
  assert.equal(passwortPruefen("langgenug", "langgenug"), "");
  assert.equal(PASSWORT_MINDEST, 6);
});

test("die Meldungen rund ums Passwort kommen auf Deutsch", () => {
  assert.match(uebersetze("New password should be different from the old password."), /dasselbe/);
  assert.match(uebersetze("email rate limit exceeded"), /zu viele Mails/);
  assert.match(uebersetze("For security purposes, you can only request this after 42 seconds."),
    /zu viele Mails/);
  assert.match(uebersetze("Password update requires reauthentication."), /Bestätigung/);
});
