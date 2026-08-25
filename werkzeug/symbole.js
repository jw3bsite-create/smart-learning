/*
 * Erzeugt die Symbole der App als PNG (für den Startbildschirm des Handys).
 *
 * Aufruf: npm run symbole
 *
 * Warum von Hand und nicht mit einem Zeichenwerkzeug: die App soll ohne
 * zusätzliche Abhängigkeiten auskommen. Ein PNG ist schnell geschrieben —
 * Kopfstück, ein gepackter Block Bildpunkte, Schluss.
 */

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HIER = dirname(fileURLToPath(import.meta.url));
const ZIEL = join(HIER, "..", "public");

/* ------------------------------ Zeichenfläche --------------------------- */

function flaeche(breite, hoehe) {
  return { breite, hoehe, punkte: new Uint8Array(breite * hoehe * 4) };
}

/** Legt eine Farbe über einen Punkt (einfaches Übereinanderlegen). */
function punkt(f, x, y, farbe, deckung) {
  if (x < 0 || y < 0 || x >= f.breite || y >= f.hoehe || deckung <= 0) return;
  const i = (y * f.breite + x) * 4;
  const alt = f.punkte[i + 3] / 255;
  const neu = deckung + alt * (1 - deckung);
  for (let k = 0; k < 3; k++)
    f.punkte[i + k] = Math.round(
      (farbe[k] * deckung + f.punkte[i + k] * alt * (1 - deckung)) / (neu || 1));
  f.punkte[i + 3] = Math.round(neu * 255);
}

/** Abstand eines Punktes zum abgerundeten Rechteck (negativ = innen). */
function abstand(px, py, x, y, b, h, r) {
  const qx = Math.abs(px - (x + b / 2)) - (b / 2 - r);
  const qy = Math.abs(py - (y + h / 2)) - (h / 2 - r);
  const ax = Math.max(qx, 0), ay = Math.max(qy, 0);
  return Math.sqrt(ax * ax + ay * ay) + Math.min(Math.max(qx, qy), 0) - r;
}

/** Abgerundetes Rechteck mit weichen Kanten. */
function rechteck(f, x, y, b, h, r, farbe, alpha = 1) {
  const von = { x: Math.floor(x - 1), y: Math.floor(y - 1) };
  const bis = { x: Math.ceil(x + b + 1), y: Math.ceil(y + h + 1) };
  for (let py = von.y; py < bis.y; py++)
    for (let px = von.x; px < bis.x; px++) {
      const d = abstand(px + 0.5, py + 0.5, x, y, b, h, r);
      const deckung = Math.min(1, Math.max(0, 0.5 - d));
      if (deckung > 0) punkt(f, px, py, farbe, deckung * alpha);
    }
}

/* --------------------------------- PNG --------------------------------- */

const CRC_TAFEL = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(puffer) {
  let c = 0xffffffff;
  for (const b of puffer) c = CRC_TAFEL[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function stueck(art, daten) {
  const laenge = Buffer.alloc(4);
  laenge.writeUInt32BE(daten.length);
  const kopf = Buffer.concat([Buffer.from(art, "latin1"), daten]);
  const pruef = Buffer.alloc(4);
  pruef.writeUInt32BE(crc32(kopf));
  return Buffer.concat([laenge, kopf, pruef]);
}

function alsPng(f) {
  const kopf = Buffer.alloc(13);
  kopf.writeUInt32BE(f.breite, 0);
  kopf.writeUInt32BE(f.hoehe, 4);
  kopf[8] = 8;    // acht Bit je Kanal
  kopf[9] = 6;    // Farbe mit Deckung (RGBA)

  const zeilen = Buffer.alloc((f.breite * 4 + 1) * f.hoehe);
  for (let y = 0; y < f.hoehe; y++) {
    zeilen[y * (f.breite * 4 + 1)] = 0;   // kein Vorfilter
    Buffer.from(f.punkte.buffer, y * f.breite * 4, f.breite * 4)
      .copy(zeilen, y * (f.breite * 4 + 1) + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    stueck("IHDR", kopf),
    stueck("IDAT", deflateSync(zeilen, { level: 9 })),
    stueck("IEND", Buffer.alloc(0)),
  ]);
}

/* -------------------------------- Symbol -------------------------------- */

const GRUND = [15, 17, 21];
const BLAU = [59, 110, 246];
const HELL = [91, 139, 255];

function symbol(groesse) {
  const f = flaeche(groesse, groesse);
  const e = groesse / 64;                       // Maßstab, Vorlage ist 64 Punkte
  rechteck(f, 0, 0, groesse, groesse, 14 * e, GRUND, 1);
  rechteck(f, 12 * e, 16 * e, 40 * e, 26 * e, 4 * e, BLAU, 0.35);
  rechteck(f, 15 * e, 21 * e, 40 * e, 26 * e, 4 * e, BLAU, 0.6);
  rechteck(f, 18 * e, 26 * e, 40 * e, 26 * e, 4 * e, HELL, 1);
  rechteck(f, 24 * e, 37.5 * e, 16 * e, 3 * e, 1.5 * e, GRUND, 1);
  rechteck(f, 24 * e, 42.5 * e, 10 * e, 3 * e, 1.5 * e, GRUND, 1);
  return alsPng(f);
}

mkdirSync(ZIEL, { recursive: true });
for (const groesse of [192, 512]) {
  const datei = join(ZIEL, `symbol-${groesse}.png`);
  writeFileSync(datei, symbol(groesse));
  console.log("geschrieben:", datei);
}
