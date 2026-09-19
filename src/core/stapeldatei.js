/*
 * Die Stapeldatei: ein ganzer Stapel in einer Datei.
 *
 * CSV und Text kennen nur Vorderseite und Rückseite. Für Mathematik reicht
 * das nicht: Ein Rechenweg hat Schritte, ein Lückentext Lücken, und eine
 * Aufgabe braucht manchmal einen Hinweis. Die Stapeldatei trägt all das —
 * dazu Titel und Fach, damit der Stapel gleich dort landet, wo er hingehört.
 *
 * Gedacht ist sie vor allem für Stapel, die außerhalb der App entstehen,
 * etwa aus einem Arbeitsblatt im Chat. Darum ist sie von Hand lesbar und
 * schreibbar, mit deutschen Schlüsseln:
 *
 *   {
 *     "format": "smart-learning-stapel", "fassung": 1,
 *     "titel": "Ableitungen", "fach": "Mathematik",
 *     "karten": [
 *       { "vorderseite": "Ableitung von $x^n$", "rueckseite": "$n \\cdot x^{n-1}$" },
 *       { "art": "mehrschritt", "vorderseite": "Leite $f(x)=(2x+1)^3$ ab.",
 *         "schritte": [ { "frage": "Äußere Ableitung", "antwort": "$3(2x+1)^2$" },
 *                       { "frage": "Mal innere", "antwort": "$6(2x+1)^2$" } ] },
 *       { "art": "cloze", "vorderseite": "Die {{Kettenregel}} gilt für Verkettungen." }
 *     ]
 *   }
 *
 * Eine Datei, die nicht stimmt, wird nicht halb eingelesen: Der Leser sagt,
 * was fehlt, und legt nichts an.
 */

import { KARTENARTEN, clozeAnzahl } from "./model.js";

export const FORMAT = "smart-learning-stapel";
export const FASSUNG = 1;

const text = (w) => (w === undefined || w === null ? "" : String(w)).trim();

/** Eine Karte der Datei prüfen und in die Form der App bringen. */
function karteLesen(roh, nr, meldungen) {
  const wo = "Karte " + nr;
  if (!roh || typeof roh !== "object" || Array.isArray(roh)) {
    meldungen.fehler.push(wo + " ist keine Karte.");
    return null;
  }
  const art = text(roh.art || "frei").toLowerCase();
  if (art === "bild") {
    meldungen.fehler.push(wo + ": Bildkarten lassen sich nicht über eine Stapeldatei anlegen.");
    return null;
  }
  if (!KARTENARTEN[art]) {
    meldungen.fehler.push(wo + ": unbekannte Art „" + art + "“.");
    return null;
  }
  const vorderseite = text(roh.vorderseite ?? roh.term);
  const rueckseite = text(roh.rueckseite ?? roh.definition);
  const hinweis = text(roh.hinweis ?? roh.hint);

  if (!vorderseite) {
    meldungen.fehler.push(wo + " hat keine Vorderseite.");
    return null;
  }

  if (art === "mehrschritt") {
    const liste = Array.isArray(roh.schritte) ? roh.schritte : [];
    const schritte = liste
      .map((s) => (typeof s === "string" ? { frage: "", antwort: text(s) }
        : { frage: text(s?.frage), antwort: text(s?.antwort) }))
      .filter((s) => s.antwort);
    if (!schritte.length) {
      meldungen.fehler.push(wo + " ist ein Rechenweg ohne Schritte.");
      return null;
    }
    if (schritte.length < liste.length)
      meldungen.hinweise.push(wo + ": Schritte ohne Antwort wurden weggelassen.");
    return { art, term: vorderseite, definition: rueckseite, hint: hinweis, schritte };
  }

  if (art === "cloze") {
    if (!clozeAnzahl(vorderseite)) {
      meldungen.fehler.push(wo + " ist ein Lückentext ohne Lücke. Lücken stehen in {{doppelten Klammern}}.");
      return null;
    }
    return { art, term: vorderseite, definition: rueckseite, hint: hinweis };
  }

  if (!rueckseite) {
    meldungen.fehler.push(wo + " hat keine Rückseite.");
    return null;
  }
  return { art, term: vorderseite, definition: rueckseite, hint: hinweis };
}

/**
 * Liest eine Stapeldatei.
 * Ergebnis: `{ stapel: { titel, fach, beschreibung, karten }, fehler, hinweise }`.
 * `stapel` ist null, sobald es einen Fehler gibt.
 */
export function stapeldateiLesen(inhalt) {
  const meldungen = { fehler: [], hinweise: [] };
  const aus = () => ({ stapel: null, ...meldungen });

  let daten;
  try {
    /* Aus dem Chat kopiert, steckt die Datei gern noch in einem Codeblock. */
    const roh = String(inhalt || "").trim()
      .replace(/^```[a-z]*\s*/i, "").replace(/\s*```$/, "");
    daten = JSON.parse(roh);
  } catch (e) {
    meldungen.fehler.push("Das ist keine lesbare Stapeldatei (kein gültiges JSON).");
    return aus();
  }

  /* Die frühere Ausfuhr der App: { stapel, karten } in ihrer eigenen Form. */
  if (daten && daten.stapel && Array.isArray(daten.karten) && !daten.format) {
    daten = {
      format: FORMAT, fassung: FASSUNG,
      titel: daten.stapel.title, beschreibung: daten.stapel.description,
      karten: daten.karten.filter((k) => k && !k.deleted),
    };
  }

  if (!daten || typeof daten !== "object" || Array.isArray(daten)) {
    meldungen.fehler.push("Das ist keine Stapeldatei.");
    return aus();
  }
  if (daten.format && daten.format !== FORMAT) {
    meldungen.fehler.push("Unbekanntes Format „" + daten.format + "“.");
    return aus();
  }
  if (Number(daten.fassung) > FASSUNG) {
    meldungen.fehler.push("Die Datei stammt aus einer neueren Fassung der App.");
    return aus();
  }
  if (!Array.isArray(daten.karten) || daten.karten.length === 0) {
    meldungen.fehler.push("Die Datei enthält keine Karten.");
    return aus();
  }

  const karten = daten.karten.map((k, i) => karteLesen(k, i + 1, meldungen));
  if (meldungen.fehler.length) return aus();

  return {
    stapel: {
      titel: text(daten.titel) || "Eingelesener Stapel",
      fach: text(daten.fach),
      beschreibung: text(daten.beschreibung),
      karten,
    },
    ...meldungen,
  };
}

/** Das Fach der Datei unter den vorhandenen finden, ohne auf Groß und klein zu achten. */
export function passendesFach(name, faecher) {
  const gesucht = text(name).toLocaleLowerCase("de");
  if (!gesucht) return null;
  return faecher.find((f) => !f.deleted && text(f.name).toLocaleLowerCase("de") === gesucht) || null;
}

/** Wie viele Karten welcher Art — für die Vorschau vor dem Anlegen. */
export function artenZaehlen(karten) {
  const zahl = {};
  for (const k of karten) zahl[k.art] = (zahl[k.art] || 0) + 1;
  return zahl;
}

/** Ein Stapel der App als Stapeldatei. Lernstand und Bilder bleiben draußen. */
export function alsStapeldatei(stapel, karten, fach = null) {
  const aus = {
    format: FORMAT, fassung: FASSUNG,
    titel: stapel?.title || "",
    ...(fach?.name ? { fach: fach.name } : {}),
    ...(stapel?.description ? { beschreibung: stapel.description } : {}),
    karten: karten.filter((k) => !k.deleted).map((k) => {
      // Bilder reisen nicht mit; eine Bildkarte wird so zur gewöhnlichen.
      const art = k.art && KARTENARTEN[k.art] && k.art !== "bild" ? k.art : "frei";
      const karte = { ...(art !== "frei" ? { art } : {}), vorderseite: k.term || "" };
      if (k.definition) karte.rueckseite = k.definition;
      if (art === "mehrschritt")
        karte.schritte = (k.schritte || []).map((s) => ({ frage: s.frage || "", antwort: s.antwort || "" }));
      if (k.hint) karte.hinweis = k.hint;
      return karte;
    }),
  };
  return JSON.stringify(aus, null, 2);
}
