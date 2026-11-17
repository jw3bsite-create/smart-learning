/*
 * Bildschirmfotos am Handymaß, zum Ansehen statt zum Prüfen.
 *
 *   node test-oberflaeche/fotos.mjs <Zielordner> [weg …]
 *
 * Läuft gegen den Entwicklungsserver (http://localhost:5180), lädt die
 * Beispieldaten in einen frischen Browser und fotografiert die genannten
 * Wege, etwa "/start" oder "/stapel/<id>/karten".
 */

import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const [ziel = ".", ...wege] = process.argv.slice(2);
mkdirSync(ziel, { recursive: true });
const ADRESSE = process.env.ANCHOR_ADRESSE || "http://localhost:5180/";
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ channel: "msedge", headless: true });
const kontext = await browser.newContext({
  viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2,
  locale: "de-DE", timezoneId: "Europe/Berlin",
});
const seite = await kontext.newPage();
const fehler = [];
seite.on("pageerror", (e) => fehler.push(String(e?.message || e)));

await seite.goto(ADRESSE + "#/");
await warte(1500);
await seite.getByText("Beispieldaten zum Ausprobieren").first().click().catch(() => {});
await warte(2500);

/* "/einstellungen@Kurzbefehle": nach dem Weg bis zu diesem Text blättern. */
for (const angabe of wege.length ? wege : ["/start"]) {
  const [weg, stelle] = angabe.split("@");
  await seite.evaluate((w) => { window.location.hash = w; }, weg);
  await warte(1200);
  if (stelle) {
    await seite.getByText(stelle).first().scrollIntoViewIfNeeded().catch(() => {});
    await seite.evaluate(() => window.scrollBy(0, -80));
    await warte(300);
  }
  const name = angabe.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "stapel";
  await seite.screenshot({ path: join(ziel, name + ".png") });
  console.log("Foto: " + name + ".png");
}
if (fehler.length) console.log("Fehler auf der Seite:\n" + fehler.join("\n"));
await browser.close();
