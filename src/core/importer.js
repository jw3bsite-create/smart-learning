/*
 * Einfuhr und Ausfuhr von Karten als Text.
 *
 * Vorlage ist die Einfuhr bei Quizlet: ein Kasten zum Hineinkopieren, dazu die
 * Wahl, was Vorder- von Rückseite trennt und was eine Karte von der nächsten.
 */

export const SPALTEN_TRENNER = [
  ["tab", "Tabulator", "\t"],
  ["komma", "Komma", ","],
  ["semikolon", "Semikolon", ";"],
  ["strich", "Gedankenstrich", " - "],
  ["doppelpunkt", "Doppelpunkt", ":"],
  ["gleich", "Gleichheitszeichen", "="],
  ["eigen", "Eigenes Zeichen", null],
];

export const ZEILEN_TRENNER = [
  ["zeile", "Neue Zeile", "\n"],
  ["leerzeile", "Leerzeile", "\n\n"],
  ["semikolon", "Semikolon", ";"],
  ["eigen", "Eigenes Zeichen", null],
];

function zeichenFuer(liste, schluessel, eigen) {
  if (schluessel === "eigen") return eigen || "\t";
  const treffer = liste.find((t) => t[0] === schluessel);
  return treffer ? treffer[2] : "\t";
}

/** Rät, womit die Vorderseite von der Rückseite getrennt ist. */
export function rateTrenner(text) {
  const zeilen = text.split(/\r?\n/).filter((z) => z.trim()).slice(0, 40);
  if (!zeilen.length) return "tab";
  const treffer = (zeichen) => zeilen.filter((z) => z.includes(zeichen)).length / zeilen.length;
  if (treffer("\t") > 0.6) return "tab";
  if (treffer(" - ") > 0.6 || treffer(" – ") > 0.6) return "strich";
  if (treffer(";") > 0.6) return "semikolon";
  if (treffer(":") > 0.6) return "doppelpunkt";
  if (treffer(",") > 0.6) return "komma";
  return "tab";
}

/**
 * Zerlegt einen Textblock in Kartenpaare.
 * Gibt `{ paare, uebrig }` zurück — `uebrig` sind Zeilen ohne erkennbare Rückseite.
 */
export function zerlege(text, opt = {}) {
  const {
    spalte = "tab", spalteEigen = "", zeile = "zeile", zeileEigen = "",
    tauschen = false,
  } = opt;
  const spaltenZeichen = zeichenFuer(SPALTEN_TRENNER, spalte, spalteEigen);
  const zeilenZeichen = zeichenFuer(ZEILEN_TRENNER, zeile, zeileEigen);

  const roh = String(text || "").replace(/\r\n/g, "\n");
  const stuecke = zeilenZeichen === "\n\n"
    ? roh.split(/\n{2,}/)
    : roh.split(zeilenZeichen);

  const paare = [], uebrig = [];
  for (const stueck of stuecke) {
    const s = stueck.trim();
    if (!s) continue;
    let stelle = s.indexOf(spaltenZeichen);
    // Der Gedankenstrich kommt auch als Halbgeviertstrich vor.
    if (stelle < 0 && spaltenZeichen === " - ") stelle = s.indexOf(" – ");
    if (stelle < 0) { uebrig.push(s); continue; }
    const laenge = s.slice(stelle).startsWith(" – ") ? 3 : spaltenZeichen.length;
    const vorn = s.slice(0, stelle).trim();
    const hinten = s.slice(stelle + laenge).trim().replace(/\n/g, " ");
    if (!vorn && !hinten) continue;
    paare.push(tauschen ? { term: hinten, definition: vorn } : { term: vorn, definition: hinten });
  }
  return { paare, uebrig };
}

/** Vollwertiges CSV-Lesen samt Anführungszeichen. */
export function csvLesen(text) {
  const zeilen = [];
  let feld = "", zeile = [], inAnfuehrung = false;
  const s = String(text || "").replace(/\r\n/g, "\n");
  for (let i = 0; i < s.length; i++) {
    const z = s[i];
    if (inAnfuehrung) {
      if (z === '"') {
        if (s[i + 1] === '"') { feld += '"'; i++; } else inAnfuehrung = false;
      } else feld += z;
    } else if (z === '"') inAnfuehrung = true;
    else if (z === "," || z === ";" || z === "\t") { zeile.push(feld); feld = ""; }
    else if (z === "\n") { zeile.push(feld); zeilen.push(zeile); zeile = []; feld = ""; }
    else feld += z;
  }
  if (feld || zeile.length) { zeile.push(feld); zeilen.push(zeile); }
  return zeilen.filter((z) => z.some((f) => f.trim()));
}

/** Karten als CSV, tauglich für Tabellenkalkulation und für Quizlet selbst. */
export function alsCsv(karten) {
  const feld = (t) => '"' + String(t || "").replace(/"/g, '""') + '"';
  return karten.map((k) => feld(k.term) + "," + feld(k.definition)).join("\n");
}

/** Karten als schlichter Text mit Tabulator — das Format, das Quizlet erwartet. */
export function alsText(karten) {
  return karten.map((k) => `${k.term}\t${k.definition}`).join("\n");
}
