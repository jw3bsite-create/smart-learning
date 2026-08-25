/*
 * Texterkennung auf Bildern (Tesseract).
 *
 * Läuft vollständig im Browser. Beim ersten Mal lädt Tesseract die Sprachdatei
 * (einige Megabyte) aus dem Netz und legt sie im Browser ab; danach geht es
 * auch ohne Verbindung. Gedruckte Listen erkennt es gut, Handschrift nur
 * mäßig — darum wird das Ergebnis vor dem Anlegen immer zur Durchsicht gezeigt.
 *
 * Der heikle Teil ist nicht das Lesen, sondern das Aufteilen: Woher weiß man,
 * wo die Vokabel aufhört und die Übersetzung anfängt? Auf einem Foto steht
 * dazwischen kein Tabulator, sondern nur weißer Raum — und den verschluckt der
 * Erkenner, wenn man bloß seinen Text liest. Darum wird hier nicht der Text
 * zerlegt, sondern die Lage der Wörter im Bild: Wo innerhalb einer Zeile die
 * größte Lücke klafft, verläuft die Spaltengrenze.
 */

let werkzeug = null;
let geladeneSprache = "";

async function hole(sprache, aufFortschritt) {
  if (werkzeug && geladeneSprache === sprache) return werkzeug;
  const { createWorker } = await import("tesseract.js");
  if (werkzeug) { try { await werkzeug.terminate(); } catch (e) {} werkzeug = null; }
  werkzeug = await createWorker(sprache, 1, {
    logger: (m) => {
      if (!aufFortschritt) return;
      if (m.status === "recognizing text") aufFortschritt(0.3 + 0.7 * m.progress, "Lese Text");
      else aufFortschritt(0.3 * (m.progress || 0), "Bereite vor");
    },
  });
  geladeneSprache = sprache;
  return werkzeug;
}

/**
 * Erkennt ein Bild. `sprache` etwa "deu", "eng" oder "deu+eng".
 * Zurück kommen der Rohtext und die Zeilen samt Lage der einzelnen Wörter.
 */
export async function erkenne(bild, sprache = "deu+eng", aufFortschritt = null) {
  const w = await hole(sprache, aufFortschritt);
  const { data } = await w.recognize(bild, {}, { text: true, blocks: true });
  aufFortschritt?.(1, "Fertig");

  const zeilen = [];
  for (const block of data.blocks || [])
    for (const absatz of block.paragraphs || [])
      for (const zeile of absatz.lines || []) {
        const woerter = (zeile.words || [])
          .filter((wo) => (wo.text || "").trim())
          .map((wo) => ({ text: wo.text.trim(), x0: wo.bbox?.x0 ?? 0, x1: wo.bbox?.x1 ?? 0 }));
        const text = (zeile.text || "").replace(/\s+/g, " ").trim();
        if (text) zeilen.push({ text, woerter });
      }

  return { text: data.text || "", zeilen };
}

export async function beenden() {
  if (werkzeug) { try { await werkzeug.terminate(); } catch (e) {} }
  werkzeug = null; geladeneSprache = "";
}

export const OCR_SPRACHEN = [
  ["deu", "Deutsch"], ["eng", "Englisch"], ["deu+eng", "Deutsch und Englisch"],
  ["fra", "Französisch"], ["spa", "Spanisch"], ["lat", "Latein"],
  ["ita", "Italienisch"], ["rus", "Russisch"],
];

/** Die Lücken zwischen benachbarten Wörtern einer Zeile. */
function luecken(zeile) {
  const w = zeile.woerter || [];
  const liste = [];
  for (let i = 0; i < w.length - 1; i++) liste.push({ i, breite: w[i + 1].x0 - w[i].x1 });
  return liste;
}

function mittelwert(zahlen) {
  if (!zahlen.length) return 0;
  const sortiert = [...zahlen].sort((a, b) => a - b);
  return sortiert[Math.floor(sortiert.length / 2)];
}

/**
 * Teilt Zeilen an der Spaltengrenze.
 *
 * Maßstab ist die übliche Wortlücke des ganzen Blattes: Was mehr als das
 * Zweieinhalbfache misst, ist keine Wortlücke mehr, sondern der Zwischenraum
 * zweier Spalten.
 */
export function nachSpalten(zeilen) {
  const alleLuecken = [];
  for (const z of zeilen) for (const l of luecken(z)) alleLuecken.push(l.breite);
  const ueblich = mittelwert(alleLuecken.filter((b) => b > 0)) || 10;
  const schwelle = Math.max(ueblich * 2.5, 14);

  return zeilen.map((z) => {
    const l = luecken(z);
    if (!l.length) return { term: z.text, definition: "" };
    const groesste = l.reduce((a, b) => (b.breite > a.breite ? b : a), l[0]);
    if (groesste.breite < schwelle) return { term: z.text, definition: "" };
    const w = z.woerter;
    return {
      term: w.slice(0, groesste.i + 1).map((x) => x.text).join(" "),
      definition: w.slice(groesste.i + 1).map((x) => x.text).join(" "),
    };
  });
}

/** Teilt jede Zeile an einem Trennzeichen (Tabulator, Strich, Doppelpunkt). */
export function nachZeichen(zeilen) {
  return zeilen.map((z) => {
    const treffer = z.text.match(/^(.+?)(?:\t+| {2,}| [-–—=] |\s*[:=]\s*)(.+)$/);
    return treffer
      ? { term: treffer[1].trim(), definition: treffer[2].trim() }
      : { term: z.text, definition: "" };
  });
}

/** Zeile eins ist die Vorderseite, Zeile zwei die Rückseite. */
function wechselnd(zeilen) {
  const paare = [];
  for (let i = 0; i + 1 < zeilen.length; i += 2)
    paare.push({ term: zeilen[i].text, definition: zeilen[i + 1].text });
  return paare;
}

/**
 * Macht aus dem Erkennungsergebnis Kartenpaare.
 * `art`: "spalten" (Lücke im Bild), "zeichen" (Trennzeichen im Text),
 * "wechselnd" (Zeile für Zeile).
 */
export function zuKarten(ergebnis, art = "spalten") {
  const zeilen = (ergebnis?.zeilen || []).filter((z) => (z.text || "").trim().length > 1);
  if (!zeilen.length) return [];
  if (art === "wechselnd") return wechselnd(zeilen);
  if (art === "zeichen") return nachZeichen(zeilen);
  const paare = nachSpalten(zeilen);
  // Ergibt die Spaltensuche nichts, lieber die Trennzeichen versuchen.
  return paare.some((p) => p.definition) ? paare : nachZeichen(zeilen);
}

/** Aus bloßem Text (etwa nach Bearbeitung des Rohtextes) Paare bilden. */
export function ausText(text, art = "zeichen") {
  const zeilen = String(text || "").split(/\n/)
    .map((z) => ({ text: z.trim(), woerter: [] }))
    .filter((z) => z.text.length > 1);
  if (art === "wechselnd") return wechselnd(zeilen);
  return nachZeichen(zeilen);
}
