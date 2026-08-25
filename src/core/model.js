/*
 * Datenmodell.
 *
 * Ordner  → beliebig tief geschachtelt (parentId)
 * Stapel  → gehört in höchstens einen Ordner, enthält Karten
 * Karte   → Vorderseite (term) und Rückseite (definition), je mit Bild
 * Stand   → Lernstand je Karte, getrennt nach Abfragerichtung
 */

/** Kennungen: Zeitanteil vorn, damit sie grob nach Alter sortieren. */
export function id(praefix = "k") {
  return praefix + "_" + Date.now().toString(36) + "_" +
    Math.random().toString(36).slice(2, 8);
}

export const jetzt = () => Date.now();

export function neuerOrdner(name, parentId = null) {
  return { id: id("o"), name, parentId, color: null, updatedAt: jetzt(), deleted: false };
}

export function neuerStapel(title, folderId = null) {
  return {
    id: id("s"), title, description: "", folderId,
    termLang: "de", defLang: "de",          // Sprachen für das Vorlesen
    termLabel: "Begriff", defLabel: "Erklärung",
    updatedAt: jetzt(), deleted: false, createdAt: jetzt(),
  };
}

export function neueKarte(setId, term = "", definition = "", order = 0) {
  return {
    id: id("k"), setId, term, definition, hint: "",
    termImage: null, defImage: null,        // Kennung eines Bildes in der Ablage `media`
    starred: false, order,
    updatedAt: jetzt(), deleted: false,
  };
}

/** Frischer Lernstand. `td` = Begriff → Erklärung, `dt` = Erklärung → Begriff. */
export function neuerStand(cardId, setId) {
  return {
    id: cardId, cardId, setId,
    td: neueRichtung(), dt: neueRichtung(),
    seen: 0, lastSeen: 0,
    updatedAt: jetzt(), deleted: false,
  };
}

function neueRichtung() {
  return { box: 0, ease: 2.5, interval: 0, due: 0, reps: 0, lapses: 0, correct: 0, wrong: 0 };
}

/** Fach 0–5 → Stufe der Beherrschung. */
export const STUFEN = ["Neu", "Am Lernen", "Vertraut", "Beherrscht"];

export function stufe(stand, richtung = "td") {
  if (!stand) return 0;
  const box = stand[richtung]?.box || 0;
  if (box <= 0) return 0;
  if (box <= 2) return 1;
  if (box <= 4) return 2;
  return 3;
}

/** Mittlere Beherrschung einer Karte über beide Richtungen (0–1). */
export function beherrschung(stand) {
  if (!stand) return 0;
  return (Math.min(stand.td.box, 6) + Math.min(stand.dt.box, 6)) / 12;
}

/** Karten eines Stapels in ihrer Reihenfolge. */
export function sortiereKarten(karten) {
  return [...karten].sort((a, b) => (a.order - b.order) || a.id.localeCompare(b.id));
}

/** Baut den Ordnerbaum. Verwaiste Ordner hängen an der Wurzel. */
export function baueBaum(ordner) {
  const nachEltern = new Map();
  const bekannt = new Set(ordner.map((o) => o.id));
  for (const o of ordner) {
    const eltern = o.parentId && bekannt.has(o.parentId) ? o.parentId : "__wurzel__";
    if (!nachEltern.has(eltern)) nachEltern.set(eltern, []);
    nachEltern.get(eltern).push(o);
  }
  const bauen = (schluessel) =>
    (nachEltern.get(schluessel) || [])
      .sort((a, b) => a.name.localeCompare(b.name, "de"))
      .map((o) => ({ ...o, kinder: bauen(o.id) }));
  return bauen("__wurzel__");
}

/** Alle Ordnerkennungen unterhalb (und einschließlich) eines Ordners. */
export function ordnerZweig(ordner, wurzelId) {
  const ergebnis = new Set([wurzelId]);
  let gewachsen = true;
  while (gewachsen) {
    gewachsen = false;
    for (const o of ordner)
      if (o.parentId && ergebnis.has(o.parentId) && !ergebnis.has(o.id)) {
        ergebnis.add(o.id); gewachsen = true;
      }
  }
  return ergebnis;
}

/**
 * Verteilt Karten auf die vier Stufen — Grundlage für die Fortschrittsbalken.
 * Gewertet wird die schwächere der beiden Richtungen.
 */
export function anteileNachStufe(karten, staende) {
  const anteile = [0, 0, 0, 0];
  for (const k of karten) {
    const stand = staende[k.id];
    const s = Math.min(stufe(stand, "td"), stufe(stand, "dt"));
    anteile[s] += 1;
  }
  return anteile;
}
