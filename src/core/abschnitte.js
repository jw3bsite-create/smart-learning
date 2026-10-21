/*
 * Abschnitte in einem Stapel.
 *
 * Ein Stapel „Romantik“ mit sechzig Karten liest sich besser mit
 * Zwischenüberschriften: „Merkmale“, „Autoren“, „Werke“. Ein Abschnitt ist
 * so eine Überschrift — keine Karte. Er wird nicht abgefragt und zählt
 * nirgends mit.
 *
 * Darum stehen Abschnitte nicht zwischen den Karten, sondern am Stapel
 * (`stapel.abschnitte`, eine geordnete Liste aus `{ id, titel }`), und jede
 * Karte weiß, zu welchem sie gehört (`karte.abschnitt`). Kein Lernmodus,
 * keine Zählung und kein Abgleich muss davon etwas wissen; alte Karten ohne
 * das Feld stehen einfach vor dem ersten Abschnitt.
 *
 * Gezeigt wird: erst die Karten ohne Abschnitt, dann jeder Abschnitt mit
 * seinen Karten, jeweils nach `order`. Wer in der Liste zieht, verschiebt
 * eine Karte unter eine andere Überschrift; `ausFolge` liest daraus
 * Reihenfolge und Zugehörigkeit zurück. Die Reihenfolge wird dabei immer
 * gleich der Anzeige gesetzt, damit die Übungsmodi in derselben Folge
 * abfragen, in der man die Karten sieht.
 */

export const PRAEFIX = "abschnitt:";

export const istAbschnittKennung = (kennung) => String(kennung).startsWith(PRAEFIX);
export const abschnittKennung = (id) => PRAEFIX + id;

const nachOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);

/**
 * Die Liste, wie sie angezeigt wird: Einträge `{ art: "karte", karte }` und
 * `{ art: "abschnitt", abschnitt }`. Karten mit einem Abschnitt, den es nicht
 * mehr gibt, stehen oben bei denen ohne.
 */
export function gliederung(karten, abschnitte = []) {
  const bekannt = new Set((abschnitte || []).map((a) => a.id));
  const ohne = karten.filter((k) => !k.abschnitt || !bekannt.has(k.abschnitt)).sort(nachOrder);
  const liste = ohne.map((karte) => ({ art: "karte", karte }));
  for (const abschnitt of abschnitte || []) {
    liste.push({ art: "abschnitt", abschnitt });
    for (const karte of karten.filter((k) => k.abschnitt === abschnitt.id).sort(nachOrder))
      liste.push({ art: "karte", karte });
  }
  return liste;
}

/** Die Kennungen der Liste — Abschnitte mit Vorsilbe, damit nichts verwechselt wird. */
export function folgeVon(liste) {
  return liste.map((e) => (e.art === "karte" ? e.karte.id : abschnittKennung(e.abschnitt.id)));
}

/** Nur die Karten, in der Reihenfolge der Anzeige. */
export function kartenInFolge(karten, abschnitte) {
  return gliederung(karten, abschnitte).filter((e) => e.art === "karte").map((e) => e.karte);
}

/**
 * Aus einer Folge von Kennungen (nach dem Ziehen): Reihenfolge der Karten
 * und zu welchem Abschnitt jede gehört — dem letzten, der vor ihr steht.
 */
export function ausFolge(folge) {
  const reihenfolge = [];
  const abschnittVon = new Map();
  let aktuell = null;
  for (const kennung of folge) {
    if (istAbschnittKennung(kennung)) {
      aktuell = kennung.slice(PRAEFIX.length);
      continue;
    }
    reihenfolge.push(kennung);
    abschnittVon.set(kennung, aktuell);
  }
  return { reihenfolge, abschnittVon };
}

/**
 * Was beim Entfernen eines Abschnitts mit seinen Karten geschieht: Sie gehen
 * in den Abschnitt davor (oder nach oben, wenn es der erste war). So bleiben
 * sie, wo sie in der Liste standen, nur ohne die Überschrift.
 */
export function abschnittEntfernen(abschnitte, id) {
  const i = abschnitte.findIndex((a) => a.id === id);
  if (i < 0) return { abschnitte, ziel: null };
  return {
    abschnitte: abschnitte.filter((a) => a.id !== id),
    ziel: i > 0 ? abschnitte[i - 1].id : null,
  };
}

/** Einen Abschnitt um eine Stelle nach oben (-1) oder unten (+1) rücken. */
export function abschnittRuecken(abschnitte, id, richtung) {
  const i = abschnitte.findIndex((a) => a.id === id);
  const j = i + richtung;
  if (i < 0 || j < 0 || j >= abschnitte.length) return abschnitte;
  const neu = [...abschnitte];
  [neu[i], neu[j]] = [neu[j], neu[i]];
  return neu;
}

/**
 * Abschnitte aus Namen, wie sie in einer Stapeldatei stehen: in der
 * Reihenfolge des ersten Auftretens, gleiche Namen ein Abschnitt.
 */
export function abschnitteAusNamen(namen, neueId) {
  const abschnitte = [];
  const nachName = new Map();
  for (const roh of namen) {
    const name = String(roh || "").trim();
    if (!name || nachName.has(name)) continue;
    const a = { id: neueId(), titel: name };
    abschnitte.push(a);
    nachName.set(name, a.id);
  }
  return { abschnitte, idVon: (name) => nachName.get(String(name || "").trim()) || null };
}
