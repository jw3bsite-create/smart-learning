/*
 * Der Oberflächentest: die gebaute App in einem echten Browser.
 *
 * Die Prüfungen unter test/ sichern den rechnenden Kern und den Speicher.
 * Was sie nicht sehen: ob eine Seite überhaupt aufgeht, ob ein Knopf noch
 * dort ist, wo man ihn sucht, ob am Telefon etwas über den Rand ragt. Das
 * prüft dieser Lauf — am Handymaß, mit Tippen statt Klicken, in einem
 * frischen Browser ohne Daten.
 *
 *   npm run test:oberflaeche
 *
 * Gesteuert wird ein vorhandener Browser (Edge unter Windows, sonst Chrome);
 * es wird keiner heruntergeladen. Ein anderer: BROWSER_KANAL=chrome.
 */

import { preview } from "vite";
import { chromium } from "playwright-core";

const KANAL = process.env.BROWSER_KANAL || (process.platform === "win32" ? "msedge" : "chrome");
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

let fehlgeschlagen = 0;
async function schritt(name, fn) {
  try {
    await fn();
    console.log("✔ " + name);
  } catch (e) {
    fehlgeschlagen += 1;
    console.log("✖ " + name + "\n    " + String(e?.message || e).split("\n")[0]);
  }
}
function soll(bedingung, text) { if (!bedingung) throw new Error(text); }

const server = await preview({ preview: { port: 4179, strictPort: false }, logLevel: "silent" });
const adresse = server.resolvedUrls.local[0];
const browser = await chromium.launch({ channel: KANAL, headless: true });
const kontext = await browser.newContext({
  viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2,
  locale: "de-DE", timezoneId: "Europe/Berlin",
});
const seite = await kontext.newPage();
const seitenfehler = [];
seite.on("pageerror", (e) => seitenfehler.push(String(e?.message || e)));
seite.on("console", (m) => { if (m.type() === "error") seitenfehler.push(m.text()); });

const gehe = async (weg) => {
  await seite.evaluate((w) => { window.location.hash = w; }, weg);
  await warte(700);
};
const ausDb = (ablage) => seite.evaluate((a) => new Promise((fertig) => {
  const q = indexedDB.open("karteikasten");
  q.onsuccess = () => {
    const r = q.result.transaction(a).objectStore(a).getAll();
    r.onsuccess = () => fertig(r.result.filter((x) => !x.deleted));
  };
}), ablage);

try {
  await seite.goto(adresse);

  await schritt("die Startseite geht auf und begrüßt einen leeren Bestand", async () => {
    await seite.getByText("Willkommen bei Anchor").waitFor({ timeout: 8000 });
  });

  await schritt("Beispieldaten lassen sich anlegen", async () => {
    await gehe("/einstellungen");
    await seite.getByRole("button", { name: "Beispieldaten anlegen" }).click();
    for (let i = 0; i < 40 && (await ausDb("sets")).length === 0; i++) await warte(250);
    soll((await ausDb("sets")).length > 0, "keine Stapel angelegt");
    await gehe("/start");
    await seite.getByText("Heute offen").waitFor({ timeout: 5000 });
  });

  await schritt("Abrufen: bewerten und die Bewertung zurücknehmen", async () => {
    const faecher = await ausDb("subjects");
    await gehe("/abrufen/" + faecher[0].id);
    const zaehler = seite.locator(".modus-kopf .mono");
    await seite.locator(".konfidenz-gitter").waitFor({ timeout: 5000 });
    const vorher = await zaehler.textContent();
    await seite.keyboard.press("1");
    await warte(1200);                       // keine Antwort unter einer Sekunde zählt
    await seite.keyboard.press("Enter");
    await seite.locator(".bewertung-gitter").waitFor();
    await seite.keyboard.press("3");
    await seite.locator(".rueckgaengig-leiste").waitFor();
    soll((await zaehler.textContent()) !== vorher, "die Sitzung ging nicht weiter");
    await seite.getByRole("button", { name: "Rückgängig" }).click();
    await seite.locator(".bewertung-gitter").waitFor();
    soll((await zaehler.textContent()) === vorher, "nach dem Zurücknehmen nicht wieder bei derselben Karte");
  });

  await schritt("Bearbeiten: eine neue Karte übersteht das Neuladen", async () => {
    const stapel = (await ausDb("sets"))[0];
    await gehe("/stapel/" + stapel.id + "/bearbeiten");
    await seite.getByRole("button", { name: "Karte hinzufügen" }).click();
    await warte(500);
    const felder = seite.locator(".karten-zeile textarea");
    const letzte = felder.nth((await felder.count()) - 2);   // Vorderseite der neuen Karte
    await letzte.fill("Oberflächentest");
    await seite.locator("h1").click();
    await warte(800);
    await seite.reload();
    await warte(1500);
    await gehe("/stapel/" + stapel.id + "/bearbeiten");
    const werte = await seite.locator(".karten-zeile textarea").evaluateAll((f) => f.map((x) => x.value));
    soll(werte.includes("Oberflächentest"), "die Karte ist nach dem Neuladen weg");
  });

  await schritt("Bearbeiten: eine Überschrift übersteht das Neuladen", async () => {
    const stapel = (await ausDb("sets"))[0];
    await gehe("/stapel/" + stapel.id + "/bearbeiten");
    await seite.getByRole("button", { name: "Überschrift" }).click();
    await seite.locator(".abschnitt-kopf input").last().fill("Abschnitt aus dem Test");
    await warte(800);
    await seite.reload();
    await warte(1500);
    await gehe("/stapel/" + stapel.id);
    await seite.getByText("Abschnitt aus dem Test").waitFor({ timeout: 4000 });
  });

  await schritt("am Handy ragt keine Seite über den Rand", async () => {
    const stapel = (await ausDb("sets"))[0];
    const wege = ["/start", "/", "/faecher", "/einstellungen", "/statistik", "/fehler", "/punkte",
      "/kalibrierung", "/pruefung", "/erklaeren", "/tutor", "/papierkorb",
      "/stapel/" + stapel.id, "/stapel/" + stapel.id + "/bearbeiten"];
    const zu = [];
    for (const w of wege) {
      await gehe(w);
      const ueber = await seite.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (ueber > 0) zu.push(w + " (" + ueber + " Punkte)");
    }
    soll(!zu.length, "zu breit: " + zu.join(", "));
  });

  await schritt("jede Seite geht auf, ohne abzustürzen", async () => {
    const stapel = (await ausDb("sets"))[0];
    const wege = ["karten", "lernen", "schreiben", "buchstabieren", "test", "zuordnen", "meteor"]
      .map((m) => "/stapel/" + stapel.id + "/" + m);
    const kaputt = [];
    for (const w of wege) {
      await gehe(w);
      await warte(500);
      if (await seite.locator("[role=alert] h2").count()) kaputt.push(w);
    }
    soll(!kaputt.length, "abgestürzt: " + kaputt.join(", "));
  });

  await schritt("keine Fehler in der Konsole", async () => {
    soll(!seitenfehler.length, seitenfehler.slice(0, 3).join(" | "));
  });
} finally {
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}

console.log(fehlgeschlagen ? "\n" + fehlgeschlagen + " Schritt(e) fehlgeschlagen." : "\nAlles bestanden.");
process.exit(fehlgeschlagen ? 1 : 0);
