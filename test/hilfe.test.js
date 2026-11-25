/*
 * Fragen zur App (core/hilfe.js): Jedes „?“ in der Oberfläche muss auf eine
 * Frage zeigen, die es gibt — sonst landet man auf einer Seite ohne Antwort.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { FRAGEN, GRUPPEN, frageMit } from "../src/core/hilfe.js";

function dateien(ordner) {
  const liste = [];
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name);
    if (statSync(pfad).isDirectory()) liste.push(...dateien(pfad));
    else if (/\.(jsx?|mjs)$/.test(name)) liste.push(pfad);
  }
  return liste;
}

test("jede Kennung gibt es genau einmal, jede Frage hat eine Gruppe und eine Antwort", () => {
  const ids = FRAGEN.map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length);
  const gruppen = new Set(GRUPPEN.map((g) => g.id));
  for (const f of FRAGEN) {
    assert.ok(gruppen.has(f.gruppe), f.id + ": unbekannte Gruppe");
    assert.ok(f.frage.endsWith("?"), f.id + ": eine Frage endet mit ?");
    assert.ok(f.antwort.length > 0 && f.antwort.every((a) => a.trim()), f.id + ": leere Antwort");
  }
});

test("jedes „?“ in der Oberfläche zeigt auf eine vorhandene Frage", () => {
  const verweise = [];
  for (const datei of dateien(join(process.cwd(), "src"))) {
    const text = readFileSync(datei, "utf-8");
    for (const m of text.matchAll(/HilfeLink[^>]*?frage="([^"]+)"/g)) verweise.push([datei, m[1]]);
  }
  assert.ok(verweise.length >= 5, "es gibt „?“-Verweise");
  for (const [datei, id] of verweise) assert.ok(frageMit(id), datei + " verweist auf „" + id + "“, die es nicht gibt");
});
