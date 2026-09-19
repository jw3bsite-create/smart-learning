/*
 * Die Regeln des Abgleichs — ohne Netz und ohne Datenbank, darum prüfbar.
 *
 * Zwei Uhren sind im Spiel, und sie dürfen nicht verwechselt werden:
 *
 *   updatedAt / updated_at   wann etwas geändert wurde, auf dem Gerät.
 *                            Entscheidet, welcher Stand gewinnt.
 *   geaendert                wann eine Zeile beim Server ankam, von ihm
 *                            gestempelt. Entscheidet, was man schon geholt hat.
 *
 * Früher entschied die Geräteuhr beides. Dann holte ein Gerät nie, was ein
 * anderes offline geändert und erst später hochgeladen hatte: Dessen
 * Änderungszeit lag vor dem, was es schon gesehen hatte.
 */

import { VORSATZ } from "./ton.js";

/** So weit wird beim Holen zurückgegriffen — gegen Zeilen, die gleichzeitig ankamen. */
export const UEBERLAPPUNG = 5 * 60 * 1000;

/**
 * Welche geholten Zeilen hier geschrieben werden: nur, was fehlt oder neuer
 * ist. `vorhanden` bildet Kennung auf `updatedAt` ab.
 */
export function zuUebernehmen(vorhanden, eintraege) {
  return eintraege.filter((e) => {
    const hier = vorhanden.get(e.id);
    return hier === undefined || (hier || 0) < (e.updatedAt || 0);
  });
}

/** Die neue Marke nach dem Holen: der späteste Serverstempel, nie rückwärts. */
export function neueMarke(alt, zeilen) {
  return zeilen.reduce((m, z) => Math.max(m, Number(z.geaendert) || 0), Number(alt) || 0);
}

/* ------------------------------- Medien -------------------------------- */

/*
 * Bilder haben eine Kennung je Datei und ändern sich nie: fehlt eins, wird
 * es übertragen, sonst nichts.
 *
 * Aufnahmen dagegen hängen an Karte und Seite und lassen sich neu einsprechen
 * oder löschen — die Kennung bleibt dieselbe. Darum trägt der Dateiname in
 * der Wolke den Stand mit: `ton_<karte>_<seite>@<updatedAt>`. Der jüngere
 * gewinnt, wie bei allem anderen; eine gelöschte Aufnahme ist ein Grabstein
 * und löscht die Datei droben, solange diese nicht jünger ist.
 */

export const istTonKennung = (id) => String(id || "").startsWith(VORSATZ);

/** Der Dateiname in der Wolke. */
export function drobenName(id, updatedAt) {
  return istTonKennung(id) ? id + "@" + (Number(updatedAt) || 0) : id;
}

/** Aus einem Dateinamen Kennung und Stand. */
export function drobenLesen(name) {
  const text = String(name || "");
  const at = text.lastIndexOf("@");
  if (istTonKennung(text) && at > 0)
    return { id: text.slice(0, at), stand: Number(text.slice(at + 1)) || 0, name: text };
  return { id: text, stand: 0, name: text };
}

/**
 * Was mit den Medien zu tun ist.
 *
 * `lokal`      Einträge der Ablage `media`: { id, updatedAt, deleted, blob }
 * `droben`     Dateinamen im Speicher der Wolke
 * `gebraucht`  Kennungen, die hier gebraucht werden (Bilder von Karten und
 *              Entwürfen, Aufnahmen vorhandener Karten)
 *
 * → { hoch: [{id, name}], runter: [{id, name, stand}], weg: [name] }
 */
export function medienPlan({ lokal, droben, gebraucht }) {
  const hier = new Map((lokal || []).map((m) => [m.id, m]));
  // Je Kennung nur der jüngste Stand droben; ältere Fassungen räumt `weg` fort.
  const oben = new Map();
  const weg = [];
  for (const d of (droben || []).map(drobenLesen)) {
    const bisher = oben.get(d.id);
    if (!bisher) { oben.set(d.id, d); continue; }
    if (d.stand > bisher.stand) { weg.push(bisher.name); oben.set(d.id, d); } else weg.push(d.name);
  }

  const hoch = [], runter = [];
  for (const m of hier.values()) {
    if (!gebraucht.has(m.id)) continue;
    const o = oben.get(m.id);
    if (m.deleted) {
      // Gelöscht und droben nicht jünger: droben auch weg.
      if (o && istTonKennung(m.id) && (m.updatedAt || 0) >= o.stand) { weg.push(o.name); oben.delete(m.id); }
      continue;
    }
    if (!m.blob) continue;
    if (!o) hoch.push({ id: m.id, name: drobenName(m.id, m.updatedAt) });
    else if (istTonKennung(m.id) && (m.updatedAt || 0) > o.stand) {
      hoch.push({ id: m.id, name: drobenName(m.id, m.updatedAt) });
      weg.push(o.name);
    }
  }
  for (const o of oben.values()) {
    if (!gebraucht.has(o.id)) continue;
    const m = hier.get(o.id);
    if (!m) runter.push({ id: o.id, name: o.name, stand: o.stand });
    else if (istTonKennung(o.id) && o.stand > (m.updatedAt || 0))
      runter.push({ id: o.id, name: o.name, stand: o.stand });
  }
  return { hoch, runter, weg: [...new Set(weg)] };
}
