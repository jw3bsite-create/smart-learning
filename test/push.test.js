/*
 * Push-Erinnerung: die Vorschau, wann gesendet wird, das Geheimnis, der
 * Absender — und dass Schlüssel aus dem Browser beim Absender passen.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import webpush from "web-push";
import {
  tagesplan, ortszeit, sollSenden, nachricht, geheimnisZusammensetzen, geheimnisZerlegen,
  grundOhneSenden, letzterTermin, zeitplanOrdnen, fruehesteStunde, uhrzeitOrdnen,
} from "../src/core/pushplan.js";
import { senden } from "../werkzeug/push-senden.mjs";

const TAG = 86400000;
const jetzt = new Date(2026, 9, 15, 9, 0).getTime();   // 15. Oktober, 9 Uhr Ortszeit

/* ============================== Vorschau ================================ */

test("die Vorschau zählt auf: Liegengebliebenes bleibt fällig", () => {
  const z = [
    { reps: 3, state: 2, due: jetzt - 2 * TAG },          // überfällig
    { reps: 1, state: 2, due: jetzt + 3600000 },          // heute
    { reps: 2, state: 2, due: jetzt + 2 * TAG },          // übermorgen
  ];
  const plan = tagesplan(z, 4, jetzt);
  assert.deepEqual(Object.values(plan), [2, 2, 3, 3]);
  assert.equal(Object.keys(plan)[0], "2026-10-15");
});

test("neue und gesperrte Karten zählen nicht", () => {
  const z = [
    { reps: 0, state: 0, due: 0 },
    { reps: 4, state: 2, due: 0, gesperrt: true },
    { reps: 4, state: 2, due: 0 },
  ];
  assert.equal(tagesplan(z, 1, jetzt)["2026-10-15"], 1);
});

/* ============================== Ortszeit ================================ */

test("die Stunde gilt in der Zeitzone des Geräts, nicht in der des Servers", () => {
  // 15:30 UTC ist im Oktober (Sommerzeit) 17:30 in Berlin.
  assert.deepEqual(ortszeit(Date.UTC(2026, 9, 15, 15, 30), "Europe/Berlin"),
    { datum: "2026-10-15", stunde: 17 });
  // Im Dezember (Winterzeit) ist 15:30 UTC 16:30 in Berlin.
  assert.equal(ortszeit(Date.UTC(2026, 11, 15, 15, 30), "Europe/Berlin").stunde, 16);
  // 0:30 Uhr in Berlin gehört noch zum Lerntag davor (der beginnt um 4 Uhr) …
  assert.equal(ortszeit(Date.UTC(2026, 9, 15, 22, 30), "Europe/Berlin").datum, "2026-10-15");
  // … 4:30 Uhr schon zum neuen.
  assert.equal(ortszeit(Date.UTC(2026, 9, 16, 2, 30), "Europe/Berlin").datum, "2026-10-16");
});

test("eine unbekannte Zeitzone fällt auf Berlin zurück, statt abzubrechen", () => {
  assert.equal(ortszeit(Date.UTC(2026, 9, 15, 15, 30), "Mars/Olympus").stunde, 17);
});

/* ============================ Wann senden =============================== */

const abo = { stunde: 17, zeitzone: "Europe/Berlin", letzte: null };
const plan = { "2026-10-15": 12 };
const um = (stunde, minute = 10) => Date.UTC(2026, 9, 15, stunde - 2, minute);   // Berlin = UTC+2

test("vor der eingestellten Stunde kommt nichts", () => {
  assert.equal(sollSenden({ abo, plan, zeit: um(16, 50) }), null);
});

test("ab der Stunde kommt die Nachricht, einmal", () => {
  assert.deepEqual(sollSenden({ abo, plan, zeit: um(17) }),
    { datum: "2026-10-15", termin: "2026-10-15 17:00", anzahl: 12 });
  assert.equal(sollSenden({ abo: { ...abo, letzte: "2026-10-15 17:00" }, plan, zeit: um(18) }), null);
  assert.equal(sollSenden({ abo: { ...abo, letzte: "2026-10-15" }, plan, zeit: um(18) }), null);
});

test("sind keine Karten fällig, bleibt sie aus", () => {
  assert.equal(sollSenden({ abo, plan: { "2026-10-15": 0 }, zeit: um(17) }), null);
});

test("fehlt der Tag in der Vorschau, wird nicht geraten", () => {
  assert.equal(sollSenden({ abo, plan: { "2026-10-01": 30 }, zeit: um(17) }), null);
});

test("der Text ist ruhig und stimmt in der Einzahl", () => {
  assert.equal(nachricht(1).text, "Heute wartet eine Karte.");
  assert.equal(nachricht(7).text, "Heute warten 7 Karten.");
});

/* ============================= Geheimnis ================================ */

test("das Geheimnis übersteht den Weg durch GitHub", () => {
  const g = { token: "abc_DEF-123", oeffentlich: "BPub-_x", privat: "priv_-1" };
  assert.deepEqual(geheimnisZerlegen("  " + geheimnisZusammensetzen(g) + "\n"), g);
});

test("eine falsche Zeichenkette wird erkannt", () => {
  assert.equal(geheimnisZerlegen("irgendwas"), null);
  assert.equal(geheimnisZerlegen("anchor1.a.b"), null);
  assert.equal(geheimnisZerlegen("anchor2.a.b.c"), null);
});

/* ======================= Absender, ganz durchgespielt ==================== */

const b64u = (buf) => Buffer.from(buf).toString("base64url");

/* Schlüssel genau wie im Browser (core/push.js): ECDSA P-256 über WebCrypto. */
async function schluesselWieImBrowser() {
  const paar = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true,
    ["sign", "verify"]);
  return {
    oeffentlich: b64u(await crypto.subtle.exportKey("raw", paar.publicKey)),
    privat: (await crypto.subtle.exportKey("jwk", paar.privateKey)).d,
  };
}

/* Ein Abonnement, wie es ein Browser liefert: eigener ECDH-Schlüssel und Geheimnis. */
async function abonnement(endpoint) {
  const paar = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true,
    ["deriveBits"]);
  return {
    endpoint,
    keys: {
      p256dh: b64u(await crypto.subtle.exportKey("raw", paar.publicKey)),
      auth: b64u(crypto.getRandomValues(new Uint8Array(16))),
    },
  };
}

function wolkeAttrappe(auftraege) {
  const aufrufe = [];
  const holen = async (url, opt) => {
    const name = url.split("/rpc/")[1];
    aufrufe.push({ name, koerper: JSON.parse(opt.body), url });
    const daten = name === "anchor_push_auftraege" ? auftraege : null;
    return { ok: true, status: 200, text: async () => (daten ? JSON.stringify(daten) : "") };
  };
  return { holen, aufrufe };
}

const TOKEN = "t".repeat(43);
const zeile = (a) => ({ endpoint: a.endpoint, abo: a, stunde: 17, zeitzone: "Europe/Berlin",
  letzte: null, plan });

test("der Absender verschlüsselt mit Browserschlüsseln und vermerkt den Tag", async () => {
  const s = await schluesselWieImBrowser();
  const geheimnis = geheimnisZusammensetzen({ token: TOKEN, ...s });
  const a = await abonnement("https://push.beispiel/abo1");
  const { holen, aufrufe } = wolkeAttrappe([zeile(a)]);
  const geschickt = [];
  const stand = await senden({
    url: "https://projekt.supabase.co/", schluessel: "anon", geheimnis, zeit: um(17), holen,
    // Statt zu senden: die fertige Anfrage bauen lassen. Das prüft
    // Schlüssel, Unterschrift (VAPID) und Verschlüsselung wirklich.
    schicken: async (x, inhalt, opt) => { geschickt.push(webpush.generateRequestDetails(x, inhalt, opt)); },
  });
  assert.deepEqual({ ...stand, gruende: undefined }, { abos: 1, gesendet: 1, entfernt: 0, fehler: 0, gruende: undefined });
  assert.equal(geschickt[0].endpoint, a.endpoint);
  assert.match(geschickt[0].headers.Authorization, /^vapid t=.+, k=/);
  assert.equal(geschickt[0].headers["Content-Encoding"], "aes128gcm");
  assert.equal(aufrufe[0].url, "https://projekt.supabase.co/rest/v1/rpc/anchor_push_auftraege");
  const vermerk = aufrufe.find((x) => x.name === "anchor_push_vermerken");
  assert.deepEqual(vermerk.koerper, { geheimnis: TOKEN, endpunkt: a.endpoint, datum: "2026-10-15 17:00" });
  assert.ok(!JSON.stringify(aufrufe).includes(s.privat), "der private Schlüssel verlässt GitHub nie");
});

test("ein aufgegebenes Abonnement wird entfernt, ein Fehler bricht nicht ab", async () => {
  const s = await schluesselWieImBrowser();
  const geheimnis = geheimnisZusammensetzen({ token: TOKEN, ...s });
  const weg = await abonnement("https://push.beispiel/weg");
  const kaputt = await abonnement("https://push.beispiel/kaputt");
  const { holen, aufrufe } = wolkeAttrappe([zeile(weg), zeile(kaputt)]);
  const stand = await senden({
    url: "https://p.supabase.co", schluessel: "anon", geheimnis, zeit: um(17), holen,
    schicken: async (x) => {
      throw Object.assign(new Error("x"), { statusCode: x.endpoint.endsWith("weg") ? 410 : 500 });
    },
  });
  assert.deepEqual({ ...stand, gruende: undefined }, { abos: 2, gesendet: 0, entfernt: 1, fehler: 1, gruende: undefined });
  assert.deepEqual(aufrufe.filter((x) => x.koerper.entfernen).map((x) => x.koerper.endpunkt),
    [weg.endpoint]);
});

test("vor der Stunde wird nichts gesendet und nichts vermerkt", async () => {
  const s = await schluesselWieImBrowser();
  const geheimnis = geheimnisZusammensetzen({ token: TOKEN, ...s });
  const a = await abonnement("https://push.beispiel/frueh");
  const { holen, aufrufe } = wolkeAttrappe([zeile(a)]);
  const stand = await senden({ url: "https://p.supabase.co", schluessel: "anon", geheimnis,
    zeit: um(15), holen, schicken: async () => { throw new Error("darf nicht"); } });
  assert.equal(stand.gesendet, 0);
  assert.equal(aufrufe.length, 1);
});

/* ============================== wolke.sql =============================== */

const sql = readFileSync(new URL("../wolke.sql", import.meta.url), "utf8");

test("die Push-Tabellen sind durch Zeilenregeln geschützt", () => {
  for (const tabelle of ["anchor_push_zugang", "anchor_push_abo", "anchor_lage"])
    assert.match(sql, new RegExp("alter table public\\." + tabelle + "\\s+enable row level security"));
});

test("der Absender kommt nur mit dem Geheimnis an Daten", () => {
  assert.match(sql, /anchor_push_auftraege\(geheimnis text\)[\s\S]*?security definer[\s\S]*?geheimnis_hash = encode\(extensions\.digest\(geheimnis, 'sha256'\), 'hex'\)/);
  assert.match(sql, /anchor_push_vermerken[\s\S]*?if kennung is null then return/);
  const ohneKommentare = sql.split(/\r?\n/).filter((z) => !z.trim().startsWith("--")).join("\n");
  assert.doesNotMatch(ohneKommentare, /service_role/i, "kein service_role im SQL selbst");
});

/* Die Zusammenfassung des Absenders sagt, warum nichts kam. */
test("der Grund, wenn nichts gesendet wird", () => {
  assert.equal(grundOhneSenden({ abo, plan, zeit: um(16) }), "zeit");
  assert.equal(grundOhneSenden({ abo: { ...abo, letzte: "2026-10-15" }, plan, zeit: um(18) }), "heute");
  assert.equal(grundOhneSenden({ abo, plan: { "2026-10-15": 0 }, zeit: um(18) }), "nichts");
  assert.equal(grundOhneSenden({ abo, plan: { "2026-10-01": 3 }, zeit: um(18) }), "vorschau");
  assert.equal(grundOhneSenden({ abo, plan, zeit: um(18) }), null);
});

test("die Zählung der Gründe kommt im Ergebnis an", async () => {
  const s = await schluesselWieImBrowser();
  const geheimnis = geheimnisZusammensetzen({ token: TOKEN, ...s });
  const a = await abonnement("https://push.beispiel/frueh2");
  const { holen } = wolkeAttrappe([zeile(a)]);
  const stand = await senden({ url: "https://p.supabase.co", schluessel: "anon", geheimnis,
    zeit: um(15), holen, schicken: async () => {} });
  assert.deepEqual(stand.gruende, { frei: 0, zeit: 1, heute: 0, nichts: 0, vorschau: 0 });
});

/* ====================== Mehrere Uhrzeiten je Wochentag ==================== */

// 15. Oktober 2026 ist ein Donnerstag (4), der 16. ein Freitag (5).
const DO = 4, FR = 5;
const mitPlan = (zeitplan, letzte = null) => ({ ...abo, zeitplan, letzte });

test("der Zeitplan wird geordnet: sortiert, einmalig, alle sieben Tage", () => {
  const p = zeitplanOrdnen({ 4: ["17:00", "7:05", "17:00", "25:00", "x"] });
  assert.deepEqual(p[4], ["07:05", "17:00"]);
  assert.deepEqual(p[1], []);
  assert.equal(Object.keys(p).length, 7);
  assert.equal(uhrzeitOrdnen("7:5"), null);
});

test("ohne Zeitplan gilt die alte Stunde an jedem Tag", () => {
  const p = zeitplanOrdnen(null, 18);
  for (let w = 0; w < 7; w++) assert.deepEqual(p[w], ["18:00"]);
  assert.equal(fruehesteStunde({ 1: ["19:30"], 4: ["07:15", "20:00"] }), 7);
});

test("mehrmals am Tag: jede Uhrzeit erinnert einmal", () => {
  const zp = { [DO]: ["07:00", "12:30", "19:00"] };
  assert.equal(sollSenden({ abo: mitPlan(zp), plan, zeit: um(6, 50) }), null);
  assert.equal(sollSenden({ abo: mitPlan(zp), plan, zeit: um(7, 5) }).termin, "2026-10-15 07:00");
  assert.equal(sollSenden({ abo: mitPlan(zp, "2026-10-15 07:00"), plan, zeit: um(12, 10) }), null);
  assert.equal(sollSenden({ abo: mitPlan(zp, "2026-10-15 07:00"), plan, zeit: um(12, 40) }).termin,
    "2026-10-15 12:30");
  assert.equal(grundOhneSenden({ abo: mitPlan(zp, "2026-10-15 07:00"), plan, zeit: um(12, 10) }), "heute");
});

test("kam der Absender länger nicht dran, geht eine Nachricht hinaus, für die letzte Uhrzeit", () => {
  const zp = { [DO]: ["07:00", "12:30", "19:00"] };
  assert.equal(sollSenden({ abo: mitPlan(zp), plan, zeit: um(20) }).termin, "2026-10-15 19:00");
  assert.equal(sollSenden({ abo: mitPlan(zp, "2026-10-15 19:00"), plan, zeit: um(21) }), null);
});

test("der Wochentag zählt: ein freier Tag bleibt still", () => {
  const zp = { [FR]: ["17:00"] };
  assert.equal(sollSenden({ abo: mitPlan(zp), plan, zeit: um(18) }), null);
  assert.equal(grundOhneSenden({ abo: mitPlan(zp), plan, zeit: um(18) }), "frei");
});

test("eine Uhrzeit nach Mitternacht gehört zum Lerntag davor", () => {
  // Freitag 1:00 Uhr Berlin (Donnerstag 23:00 UTC) — Lerntag ist noch Donnerstag.
  const nachts = Date.UTC(2026, 9, 15, 23, 10);
  const t = letzterTermin({ zeitplan: { [FR]: ["01:00"] }, zeitzone: "Europe/Berlin", zeit: nachts });
  assert.deepEqual(t, { datum: "2026-10-15", termin: "2026-10-16 01:00", hatTermine: true });
  assert.equal(sollSenden({ abo: mitPlan({ [FR]: ["01:00"] }), plan, zeit: nachts }).anzahl, 12);
  // Donnerstag 1:00 gehört dagegen zum Mittwoch und zählt am Donnerstagabend nicht.
  assert.equal(grundOhneSenden({ abo: mitPlan({ [DO]: ["01:00"] }), plan, zeit: um(18) }), "frei");
});

test("ein Vermerk alter Art (nur der Tag) heißt: heute schon erinnert", () => {
  const zp = { [DO]: ["07:00", "19:00"] };
  assert.equal(sollSenden({ abo: mitPlan(zp, "2026-10-15"), plan, zeit: um(20) }), null);
  assert.equal(sollSenden({ abo: mitPlan(zp, "2026-10-14"), plan, zeit: um(20) }).termin, "2026-10-15 19:00");
});

test("die Uhrzeit gilt in der Zeitzone des Geräts", () => {
  // 17:30 UTC ist 19:30 in Berlin, aber 13:30 in New York.
  const zeit = Date.UTC(2026, 9, 15, 17, 30);
  const zp = { [DO]: ["19:00"] };
  assert.equal(letzterTermin({ zeitplan: zp, zeitzone: "Europe/Berlin", zeit }).termin, "2026-10-15 19:00");
  assert.equal(letzterTermin({ zeitplan: zp, zeitzone: "America/New_York", zeit }).termin, null);
});

test("wolke.sql liefert den Zeitplan an den Absender", () => {
  assert.match(sql, /add column if not exists zeitplan jsonb/);
  assert.match(sql, /drop function if exists public\.anchor_push_auftraege\(text\);\s*create function public\.anchor_push_auftraege/);
  assert.match(sql, /a\.letzte, coalesce\(l\.plan, '\{\}'::jsonb\), a\.zeitplan/);
});
