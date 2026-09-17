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

/* ===================================================================== */
/*  Anki — Ein- und Ausfuhr                                              */
/* ===================================================================== */

/**
 * Karten im Anki-Textformat: Tabulator zwischen den Feldern, Kopfzeilen mit
 * Rautezeichen. Anki liest das ohne Umstände ein.
 *
 * Warum überhaupt: Zwei Jahre Wiederholungen dürfen nicht in einer selbst
 * gebauten App gefangen sein. Wer diese App eines Tages nicht mehr will, soll
 * seinen Bestand mitnehmen können.
 */
export function alsAnkiText(karten, { stapelName = "Smart Learning" } = {}) {
  const sauber = (t) => String(t || "").replace(/\t/g, " ").replace(/\r?\n/g, "<br>");
  const kopf = [
    "#separator:tab",
    "#html:true",
    "#deck:" + stapelName,
    "#columns:Vorderseite\tRückseite\tHinweis\tMarkierung",
  ];
  const zeilen = karten.map((k) => [
    sauber(k.term), sauber(k.definition), sauber(k.hint),
    k.starred ? "markiert" : "",
  ].join("\t"));
  return [...kopf, ...zeilen].join("\n");
}

/**
 * Vollständige Ausfuhr als CSV — mit dem Lernstand, nicht nur mit dem Text.
 * Diese Datei ist die eigentliche Versicherung gegen das Eingesperrtsein.
 */
export function alsCsvMitPlan(karten, zustaende = {}, { stapelVon, fachVon } = {}) {
  const feld = (t) => '"' + String(t ?? "").replace(/"/g, '""') + '"';
  const kopf = ["kennung", "richtung", "vorderseite", "rueckseite", "hinweis",
    "stapel", "fach", "herkunft", "faellig", "stabilitaet", "schwierigkeit",
    "wiederholungen", "rueckfaelle", "zustand"];
  const zeilen = [];
  for (const k of karten) {
    const stapel = stapelVon ? stapelVon(k.setId) : null;
    const fach = fachVon && stapel?.subjectId ? fachVon(stapel.subjectId) : null;
    const passende = Object.values(zustaende).filter((z) => z.cardId === k.id);
    const liste = passende.length ? passende : [null];
    for (const z of liste) {
      zeilen.push([
        k.id, z?.richtung || "td", k.term, k.definition, k.hint || "",
        stapel?.title || "", fach?.name || "", k.created_by || "selbst",
        z?.due ? new Date(z.due).toISOString() : "",
        z?.stability ?? "", z?.difficulty ?? "", z?.reps ?? 0, z?.lapses ?? 0,
        z?.state ?? 0,
      ].map(feld).join(","));
    }
  }
  return [kopf.map(feld).join(","), ...zeilen].join("\n");
}

/**
 * Liest eine Anki-Textausfuhr.
 * Erkennt die Kopfzeilen mit Rautezeichen und das dort genannte Trennzeichen.
 */
export function ankiLesen(text) {
  const roh = String(text || "").replace(/\r\n/g, "\n");
  let trenner = "\t";
  const zeilen = [];
  for (const zeile of roh.split("\n")) {
    if (zeile.startsWith("#")) {
      const treffer = zeile.match(/^#separator:\s*(.+)$/i);
      if (treffer) {
        const name = treffer[1].trim().toLowerCase();
        trenner = name === "tab" ? "\t" : name === "comma" ? ","
          : name === "semicolon" ? ";" : name === "pipe" ? "|" : name;
      }
      continue;
    }
    if (!zeile.trim()) continue;
    zeilen.push(zeile);
  }

  return zeilen.map((zeile) => {
    const felder = zeile.split(trenner);
    const entkleiden = (t) => String(t || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .trim();
    return {
      term: entkleiden(felder[0]),
      definition: entkleiden(felder[1]),
      hint: entkleiden(felder[2]),
      starred: /markiert|marked|starred/i.test(felder[3] || ""),
    };
  }).filter((k) => k.term || k.definition);
}

/* ===================================================================== */
/*  Quizlet                                                              */
/* ===================================================================== */

/*
 * Ein Stapel aus Quizlet.
 *
 * Quizlet gibt unter „Exportieren" einen Textblock heraus, und zwar in der
 * Form, die dort gerade eingestellt ist: Tabulator oder Komma zwischen den
 * Seiten, neue Zeile oder Leerzeile zwischen den Karten. Wer das nicht weiss,
 * waehlt hier falsch und bekommt eine einzige Karte mit dem ganzen Text.
 *
 * Darum raet diese Funktion beides selbst: Sie probiert die ueblichen
 * Kombinationen durch und nimmt die, bei der die meisten Zeilen aufgehen.
 * Nebenbei fallen Kopfzeilen, Nummerierungen und doppelte Karten weg.
 *
 * Eine Adresse hilft nicht: Quizlet gibt seine Inhalte nicht an fremde Seiten
 * heraus. Kopieren (oder die heruntergeladene Datei) ist der einzige Weg.
 */

const KOPFZEILE = /^\s*(begriff|term|vorderseite|front|frage)\s*[\t;,|-]+\s*(definition|erkl\u00e4rung|erklaerung|r\u00fcckseite|rueckseite|back|antwort)\s*$/i;

/** Nummerierung am Zeilenanfang: „1. ", „12) " */
const NUMMER = /^\s*\d{1,3}\s*[.)]\s+/;

function saeubereFeld(text) {
  let s = String(text || "").trim();
  s = s.replace(NUMMER, "");
  // Anfuehrungszeichen, wie CSV sie um Felder legt
  if (/^".*"$/s.test(s)) s = s.slice(1, -1).replace(/""/g, '"');
  return s.replace(/\s*\n\s*/g, " ").replace(/[ \t]{2,}/g, " ").trim();
}

export function quizletLesen(text) {
  const roh = String(text || "").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").trim();
  if (!roh) return { paare: [], uebrig: [], spalte: "tab", zeile: "zeile", doppelte: 0 };

  // Eine Kopfzeile wie „Begriff — Definition" gehoert nicht in die Karten.
  const zeilen = roh.split("\n");
  const ohneKopf = KOPFZEILE.test(zeilen[0]) ? zeilen.slice(1).join("\n") : roh;

  /*
   * Bewertung: Jedes erkannte Paar zaehlt, jede uebrige Zeile zaehlt doppelt
   * dagegen. Ein Trennzeichen, das nur die Haelfte der Zeilen trifft, ist
   * schlechter als keins — dann bleibt lieber alles ungeteilt stehen, und man
   * sieht es in der Durchsicht.
   */
  const kandidaten = [];

  /*
   * Die Leerzeile kommt nur in Frage, wenn es ueberhaupt eine gibt.
   * Sonst gewinnt sie jeden Vergleich: Ohne Leerzeile ist der ganze Text ein
   * Stueck, das erste Trennzeichen darin ergibt genau ein Paar und keine
   * uebrige Zeile — eine einzige Karte mit der ganzen Vokabelliste als
   * Rueckseite, und nach der Bewertung waere das die beste Lesart.
   */
  const zeilenArten = /\n\s*\n/.test(ohneKopf) ? ["zeile", "leerzeile"] : ["zeile"];

  for (const zeile of zeilenArten) {
    for (const spalte of ["tab", "strich", "semikolon", "komma", "doppelpunkt", "gleich"]) {
      const e = zerlege(ohneKopf, { spalte, zeile });
      const halbe = e.paare.filter((pp) => !pp.term || !pp.definition).length;
      kandidaten.push({
        spalte, zeile, ...e,
        punkte: e.paare.length - halbe - 2 * e.uebrig.length,
      });
    }
  }

  /*
   * Bei Komma als Trenner legt Quizlet Anfuehrungszeichen um Felder, die
   * selbst ein Komma enthalten. Nach dem ersten Komma zu teilen zerschneidet
   * dann mitten im Feld, darum hier das vollwertige CSV-Lesen als eigene
   * Lesart.
   */
  if (/"/.test(ohneKopf) && /[,;\t]/.test(ohneKopf)) {
    const reihen = csvLesen(ohneKopf).filter((r) => r.length >= 2);
    const paare = reihen.map((r) => ({ term: r[0], definition: r.slice(1).join(", ") }));
    kandidaten.push({
      spalte: "komma", zeile: "zeile", paare, uebrig: [],
      punkte: paare.length + 1,        // knapp vor dem einfachen Teilen
    });
  }

  kandidaten.sort((a, b) => b.punkte - a.punkte);
  let beste = kandidaten[0];

  /*
   * Geht nichts auf, wird nach Zeilen berichtet, nicht nach Bloecken: „drei
   * Zeilen ohne Rueckseite" sagt, was zu tun ist; ein einziger Klumpen nicht.
   */
  if (!beste.paare.length)
    beste = kandidaten.find((k) => k.zeile === "zeile" && k.spalte === "tab") || beste;

  const gesehen = new Set();
  const paare = [];
  let doppelte = 0;
  for (const paar of beste.paare) {
    const term = saeubereFeld(paar.term);
    const definition = saeubereFeld(paar.definition);
    if (!term && !definition) continue;
    const schluessel = term.toLowerCase() + "\u0001" + definition.toLowerCase();
    if (gesehen.has(schluessel)) { doppelte += 1; continue; }
    gesehen.add(schluessel);
    paare.push({ term, definition });
  }

  return {
    paare,
    uebrig: beste.uebrig.map(saeubereFeld).filter(Boolean),
    spalte: beste.spalte,
    zeile: beste.zeile,
    doppelte,
  };
}
