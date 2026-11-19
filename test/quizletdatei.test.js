/*
 * Quizlet-Stapel aus einer Datei: PDF (Tabelle vom Rechner, untereinander
 * vom Telefon), Safari-Webarchiv, MHTML, eine Datei mit nur dem Link.
 *
 * Die Dateien in test/daten sind nachgebaut (PyMuPDF, plistlib) — Quizlet
 * sperrt automatische Browser aus. Das Lesen der Seite selbst (DOMParser)
 * gibt es in Node nicht; das prüft der Quizlet-Knopf im Browser.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  artErkennen, bplistLesen, webarchivHtml, mhtmlHtml, zeilenBilden, paareAusZeilen, pdfStuecke, dateiLesen,
} from "../src/core/quizletdatei.js";

pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
  new URL("../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url).pathname
    .replace(/^\/([A-Za-z]:)/, "$1")).href;

const datei = (name) => new Uint8Array(readFileSync(new URL("./daten/" + name, import.meta.url)));
const ausPdf = async (name) => paareAusZeilen(zeilenBilden(await pdfStuecke(datei(name), pdfjs)));

test("die Art wird am Inhalt erkannt, nicht am Namen", () => {
  assert.equal(artErkennen(datei("quizlet-tabelle.pdf")), "pdf");
  assert.equal(artErkennen(datei("quizlet.webarchive")), "webarchiv");
  const text = (t) => new TextEncoder().encode(t);
  assert.equal(artErkennen(text("<!DOCTYPE html><html></html>")), "html");
  assert.equal(artErkennen(text("From: <Gespeichert von Microsoft Edge>\nMIME-Version: 1.0\n"
    + 'Content-Type: multipart/related; type="text/html"; boundary="----x"')), "mhtml");
  assert.equal(artErkennen(text("la casa\tdas Haus")), "text");
});

test("PDF als Tabelle: Begriff links, Definition rechts, auch über zwei Zeilen", async () => {
  const e = await ausPdf("quizlet-tabelle.pdf");
  assert.equal(e.spalte, "tabelle");
  assert.deepEqual(e.paare.map((p) => p.term), ["Novalis", "Eichendorff", "E. T. A. Hoffmann", "Brüder Grimm"]);
  assert.match(e.paare[2].definition, /^Der Sandmann, ein Nachtstück .* in drei Briefen beginnt$/);
  assert.ok(!e.paare.some((p) => /Ähnliche|Klassik|quizlet\.com|14:03/.test(p.term + p.definition)),
    "Kopf, Fuß und was nach der Liste kommt, bleiben draußen");
});

test("PDF vom Telefon: untereinander, eine Karte je Block", async () => {
  const e = await ausPdf("quizlet-telefon.pdf");
  assert.equal(e.spalte, "bloecke");
  assert.equal(e.paare.length, 4);
  assert.deepEqual(e.paare[0], { term: "Novalis", definition: "Heinrich von Ofterdingen, die blaue Blume" });
  assert.match(e.paare[2].definition, /Nachtstück über Wahn und Wirklichkeit/);
  assert.ok(!e.paare.some((p) => /Andere Lernsets/.test(p.term)));
});

test("Zeilen: eine weite Lücke trennt Spalten, eine enge nicht", () => {
  const z = zeilenBilden([
    { str: "la", x: 10, y: 100, w: 12, h: 10, seite: 1 },
    { str: "casa", x: 25, y: 100.5, w: 25, h: 10, seite: 1 },
    { str: "das Haus", x: 200, y: 100, w: 45, h: 10, seite: 1 },
  ]);
  assert.equal(z.length, 1);
  assert.deepEqual(z[0].teile.map((t) => t.text), ["la casa", "das Haus"]);
});

test("ohne Spalten und ohne Blöcke: abwechselnde Zeilen", () => {
  const zeilen = ["Begriffe in diesem Set (2)", "la casa", "das Haus", "el perro", "der Hund"]
    .map((t, i) => ({ seite: 1, y: 100 + i * 20, h: 10, teile: [{ text: t, x: 10, ende: 80 }] }));
  const e = paareAusZeilen(zeilen);
  assert.equal(e.spalte, "abwechselnd");
  assert.deepEqual(e.paare.map((p) => p.definition), ["das Haus", "der Hund"]);
});

test("Safari-Webarchiv: die Seite kommt unverändert heraus", () => {
  const html = webarchivHtml(datei("quizlet.webarchive"));
  assert.match(html, /class="TermText">Novalis</);
  assert.match(html, /Eichendorff/);
  assert.equal(typeof bplistLesen(datei("quizlet.webarchive")).WebMainResource, "object");
});

test("MHTML: der HTML-Teil, auch in quoted-printable", () => {
  const mhtml = [
    "From: <Gespeichert von Microsoft Edge>",
    "MIME-Version: 1.0",
    'Content-Type: multipart/related; type="text/html"; boundary="----Grenze"',
    "", "------Grenze",
    "Content-Type: text/html", "Content-Transfer-Encoding: quoted-printable", "",
    '<span class=3D"TermText">Br=C3=BCder Grimm</span><span class=3D"TermText">M=C3=A4rch=',
    "en</span>",
    "------Grenze",
    "Content-Type: image/png", "Content-Transfer-Encoding: base64", "", "iVBORw0KGgo=",
    "------Grenze--",
  ].join("\r\n");
  assert.equal(mhtmlHtml(mhtml).trim(), '<span class="TermText">Brüder Grimm</span><span class="TermText">Märchen</span>');
});

test("eine Datei mit nur dem Link sagt, was zu tun ist", async () => {
  const link = new Blob(["https://quizlet.com/de/123456789/romantik-flash-cards/"]);
  const e = await dateiLesen(link);
  assert.equal(e.art, "link");
  assert.equal(e.anzahl, 0);
  assert.match(e.hinweis, /nur der Link/);
  const verknuepfung = await dateiLesen(new Blob(["[InternetShortcut]\r\nURL=https://quizlet.com/_abc\r\n"]));
  assert.equal(verknuepfung.art, "link");
});
