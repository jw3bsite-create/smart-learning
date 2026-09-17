/*
 * Die Gestaltung, wie der Nutzer sie einstellt.
 *
 * Alles hier landet als CSS-Veränderliche am Wurzelelement und überschreibt
 * damit die Vorgaben aus `stil.css`. Der Vorteil dieser Bauweise: Es gibt
 * keine zweite Wahrheit — dieselben Werte, die die App verwendet, stehen auch
 * in der Vorschau und in der Sicherungsdatei.
 *
 * Was hier NICHT einstellbar ist: die Farben für richtig, falsch und
 * unsicher. Grün, Gelb und Rot tragen in dieser App Bedeutung; wer sie frei
 * wählen dürfte, könnte sich eine Oberfläche bauen, in der man Zustände nicht
 * mehr auseinanderhält.
 */

/*
 * Die Schriften.
 *
 * Genannt werden sie nach ihrem wirklichen Namen, „Georgia" statt „Serifen".
 * Wer schon einmal in einem Textprogramm eine Schrift gewählt hat, weiß dann,
 * was er bekommt; „schmal humanistisch" muss man erst ausprobieren.
 *
 * Jeder Eintrag nennt zuerst die gewünschte Schrift und danach Rückfälle für
 * Geräte, die sie nicht haben: Windows, iPhone und iPad liefern verschiedene
 * Schriften mit, und die App läuft auf allen drei.
 *
 * Die alten Schlüssel (`serifen`, `humanistisch`, `schmal`, `buch`) bleiben
 * bestehen und wirken weiter, sie stehen nur nicht mehr zur Wahl: Sie stecken
 * in gespeicherten Einstellungen und in Sicherungen. Ohne sie stünde die App
 * nach dieser Änderung plötzlich in einer anderen Schrift da.
 */

export const SCHRIFT_GRUPPEN = {
  ohne: "Ohne Serifen",
  serifen: "Mit Serifen",
  gleichlauf: "Gleiche Zeichenbreite",
};

export const SCHRIFTEN = {
  /* ------------------------------ Ohne Serifen ------------------------- */
  system: { name: "System (wie das Gerät)", gruppe: "ohne", stapel:
    'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' },
  segoe: { name: "Segoe UI", gruppe: "ohne", stapel:
    '"Segoe UI", system-ui, sans-serif' },
  calibri: { name: "Calibri", gruppe: "ohne", stapel:
    'Calibri, Carlito, "Segoe UI", sans-serif' },
  candara: { name: "Candara", gruppe: "ohne", stapel:
    'Candara, Calibri, "Segoe UI", sans-serif' },
  verdana: { name: "Verdana", gruppe: "ohne", stapel:
    'Verdana, Geneva, "DejaVu Sans", sans-serif' },
  tahoma: { name: "Tahoma", gruppe: "ohne", stapel:
    'Tahoma, Geneva, Verdana, sans-serif' },
  trebuchet: { name: "Trebuchet MS", gruppe: "ohne", stapel:
    '"Trebuchet MS", "Lucida Grande", sans-serif' },
  arial: { name: "Arial", gruppe: "ohne", stapel:
    'Arial, Helvetica, sans-serif' },
  helvetica: { name: "Helvetica Neue", gruppe: "ohne", stapel:
    '"Helvetica Neue", Helvetica, Arial, sans-serif' },
  avenir: { name: "Avenir Next", gruppe: "ohne", stapel:
    '"Avenir Next", Avenir, "Segoe UI", sans-serif' },
  optima: { name: "Optima", gruppe: "ohne", stapel:
    'Optima, Candara, "Gill Sans", sans-serif' },
  gill: { name: "Gill Sans", gruppe: "ohne", stapel:
    '"Gill Sans", "Gill Sans MT", Calibri, sans-serif' },
  franklin: { name: "Franklin Gothic Book", gruppe: "ohne", stapel:
    '"Franklin Gothic Book", "Franklin Gothic Medium", "Libre Franklin", sans-serif' },
  arialschmal: { name: "Arial Narrow", gruppe: "ohne", stapel:
    '"Arial Narrow", "Roboto Condensed", "Segoe UI Semilight", sans-serif' },

  /* ------------------------------- Mit Serifen ------------------------- */
  georgia: { name: "Georgia", gruppe: "serifen", stapel:
    'Georgia, "Times New Roman", serif' },
  times: { name: "Times New Roman", gruppe: "serifen", stapel:
    '"Times New Roman", Times, serif' },
  palatino: { name: "Palatino", gruppe: "serifen", stapel:
    'Palatino, "Palatino Linotype", "Book Antiqua", serif' },
  garamond: { name: "Garamond", gruppe: "serifen", stapel:
    'Garamond, "EB Garamond", "Apple Garamond", Georgia, serif' },
  cambria: { name: "Cambria", gruppe: "serifen", stapel:
    'Cambria, Caladea, Georgia, serif' },
  constantia: { name: "Constantia", gruppe: "serifen", stapel:
    'Constantia, Georgia, serif' },
  baskerville: { name: "Baskerville", gruppe: "serifen", stapel:
    'Baskerville, "Libre Baskerville", "Baskerville Old Face", Georgia, serif' },
  iowan: { name: "Iowan Old Style", gruppe: "serifen", stapel:
    '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif' },
  charter: { name: "Charter", gruppe: "serifen", stapel:
    'Charter, "Bitstream Charter", Georgia, serif' },

  /* --------------------------- Gleiche Zeichenbreite ------------------- */
  consolas: { name: "Consolas", gruppe: "gleichlauf", stapel:
    'Consolas, "Cascadia Mono", monospace' },
  courier: { name: "Courier New", gruppe: "gleichlauf", stapel:
    '"Courier New", Courier, monospace' },
  menlo: { name: "Menlo", gruppe: "gleichlauf", stapel:
    'Menlo, Monaco, "SF Mono", monospace' },
  systemgleich: { name: "System (gleiche Breite)", gruppe: "gleichlauf", stapel:
    'ui-monospace, "Cascadia Mono", Consolas, "Courier New", monospace' },

  /* ------------------ Alte Schlüssel, nicht mehr zur Wahl -------------- */
  serifen: { name: "Serifen (alt)", alt: true, stapel:
    '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif' },
  humanistisch: { name: "Humanistisch (alt)", alt: true, stapel:
    'Calibri, Candara, "Segoe UI", "Trebuchet MS", sans-serif' },
  schmal: { name: "Schmal (alt)", alt: true, stapel:
    '"Segoe UI Semilight", "Roboto Condensed", "Arial Narrow", sans-serif' },
  schreibmaschine: { name: "Schreibmaschine (alt)", alt: true, stapel:
    'ui-monospace, "Cascadia Mono", Consolas, "Courier New", monospace' },
  buch: { name: "Buchschrift (alt)", alt: true, stapel:
    'Constantia, "Book Antiqua", "Times New Roman", Georgia, serif' },
};

/** Die Schriften zur Wahl, nach Gruppen. Die alten Schlüssel bleiben aussen. */
export function schriftenZurWahl() {
  const gruppen = {};
  for (const [schluessel, s] of Object.entries(SCHRIFTEN)) {
    if (s.alt) continue;
    if (!gruppen[s.gruppe]) gruppen[s.gruppe] = [];
    gruppen[s.gruppe].push({ schluessel, ...s });
  }
  return gruppen;
}

/** Der erste Name eines Stapels, ohne Anfuehrungszeichen. */
export function ersteFamilie(stapel) {
  const erster = String(stapel || "").split(",")[0].trim();
  return erster.replace(/^["']|["']$/g, "");
}

/*
 * Ist die Schrift auf diesem Gerät vorhanden?
 *
 * Gemessen, nicht gefragt: Ein Browser sagt zu jedem Namen bereitwillig „ja"
 * und setzt dann doch die Rückfallschrift. Darum wird ein Probetext zweimal
 * ausgemessen, einmal mit der Schrift vor einer Rückfallschrift und einmal
 * nur mit der Rückfallschrift. Unterscheiden sich die Breiten, ist sie da.
 *
 * Nützlich, weil dieselbe Einstellung für Rechner, iPhone und iPad gilt:
 * Cambria gibt es auf dem einen, Iowan Old Style nur auf dem anderen.
 */
const gemessen = new Map();
const PROBE = "Handgewebte Schrift 0123";

/* Gattungsnamen sind keine Schriften, sondern Auftraege an den Browser. */
export const GATTUNGEN = new Set(["system-ui", "ui-monospace", "ui-serif",
  "ui-sans-serif", "ui-rounded", "sans-serif", "serif", "monospace", "cursive",
  "fantasy", "-apple-system", "blinkmacsystemfont"]);

/** Alle Namen eines Stapels, ohne Anfuehrungszeichen und ohne Gattungen. */
export function familienVon(stapel) {
  return String(stapel || "").split(",")
    .map((t) => t.trim().replace(/^["']|["']$/g, ""))
    .filter((t) => t && !GATTUNGEN.has(t.toLowerCase()));
}

/**
 * Ist von einem Stapel ueberhaupt etwas da?
 *
 * Gewarnt wird nur, wenn keiner der genannten Namen auf dem Gerät liegt.
 * „Palatino" etwa gibt es auf Windows als „Palatino Linotype" — das sieht aus
 * wie gewuenscht, und eine Warnung waere dort nur Verwirrung. Ein Stapel ganz
 * ohne eigene Namen (nur Gattungen, etwa „System") gilt immer als vorhanden.
 */
export function stapelVorhanden(stapel) {
  const familien = familienVon(stapel);
  return familien.length === 0 || familien.some(schriftVorhanden);
}

export function schriftVorhanden(familie) {
  if (typeof document === "undefined" || !document.createElement) return true;
  if (GATTUNGEN.has(String(familie).toLowerCase())) return true;
  if (gemessen.has(familie)) return gemessen.get(familie);
  let ergebnis = true;
  try {
    const stift = document.createElement("canvas").getContext("2d");
    const breite = (schrift) => {
      stift.font = "32px " + schrift;
      return stift.measureText(PROBE).width;
    };
    ergebnis = ["monospace", "serif"].some((rueckfall) =>
      Math.abs(breite('"' + familie + '", ' + rueckfall) - breite(rueckfall)) > 0.5);
  } catch (e) {
    ergebnis = true;                  // im Zweifel anbieten
  }
  gemessen.set(familie, ergebnis);
  return ergebnis;
}

export const DICHTEN = {
  eng: { name: "Eng", wert: 0.8 },
  normal: { name: "Normal", wert: 1 },
  luftig: { name: "Luftig", wert: 1.25 },
};

export const BREITEN = {
  schmal: { name: "Schmal", wert: "820px" },
  normal: { name: "Normal", wert: "1120px" },
  breit: { name: "Breit", wert: "1500px" },
  voll: { name: "Ganze Breite", wert: "100%" },
};

/** Fertige Zusammenstellungen — ein Klick, und alles passt zueinander. */
export const PALETTEN = [
  { name: "Werkstatt", beschreibung: "die Vorgabe: dunkel, blau, ruhig",
    werte: { design: "system", akzent: "#5b8bff", schriftOberflaeche: "system",
      schriftKarten: "georgia", dichte: "normal", rundung: 14, schriftgroesse: 15 } },
  { name: "Papier", beschreibung: "hell, warm, Buchschrift",
    werte: { design: "hell", akzent: "#a9743f", schriftOberflaeche: "calibri",
      schriftKarten: "constantia", dichte: "luftig", rundung: 6, schriftgroesse: 16 } },
  { name: "Nacht", beschreibung: "tiefes Schwarz, sparsam",
    werte: { design: "tief", akzent: "#7c9cff", schriftOberflaeche: "system",
      schriftKarten: "system", dichte: "eng", rundung: 4, schriftgroesse: 15 } },
  { name: "Heft", beschreibung: "grün, eng, viel auf einen Blick",
    werte: { design: "dunkel", akzent: "#3fbf7f", schriftOberflaeche: "arialschmal",
      schriftKarten: "arialschmal", dichte: "eng", rundung: 10, schriftgroesse: 14 } },
  { name: "Groß", beschreibung: "für müde Augen",
    werte: { design: "system", akzent: "#e8b84b", schriftOberflaeche: "candara",
      schriftKarten: "georgia", dichte: "luftig", rundung: 18, schriftgroesse: 19 } },
];

/** Die Vorgaben — dieselben Werte wie in `stil.css`. */
export const STANDARD_GESTALTUNG = {
  design: "system",              // system | hell | dunkel | tief
  akzent: "#5b8bff",
  schriftgroesse: 15,            // 12 bis 22
  zeilenhoehe: 1.5,              // 1.3 bis 1.9
  schriftOberflaeche: "system",
  schriftKarten: "georgia",
  dichte: "normal",
  breite: "normal",
  rundung: 14,                   // 0 bis 24
  kartenhoehe: 340,              // 240 bis 520
  ruhig: false,                  // Übergänge abschalten
};

/** Etwas dunkler für den gedrückten Zustand eines Knopfes. */
function abdunkeln(farbe, anteil = 0.16) {
  const treffer = /^#?([0-9a-f]{6})$/i.exec(String(farbe || "").trim());
  if (!treffer) return farbe;
  const zahl = parseInt(treffer[1], 16);
  const teile = [(zahl >> 16) & 255, (zahl >> 8) & 255, zahl & 255]
    .map((k) => Math.max(0, Math.round(k * (1 - anteil))));
  return "#" + teile.map((k) => k.toString(16).padStart(2, "0")).join("");
}

/** Hell genug für dunkle Schrift darauf? Entscheidet über die Knopfbeschriftung. */
export function istHell(farbe) {
  const treffer = /^#?([0-9a-f]{6})$/i.exec(String(farbe || "").trim());
  if (!treffer) return false;
  const zahl = parseInt(treffer[1], 16);
  const [r, g, b] = [(zahl >> 16) & 255, (zahl >> 8) & 255, zahl & 255];
  // Wahrgenommene Helligkeit, nicht der arithmetische Mittelwert.
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150;
}

/**
 * Schreibt die Gestaltung an ein Element (üblicherweise das Wurzelelement).
 * Wird auch für die Vorschau benutzt — darum das Element als Argument.
 */
export function anwenden(el, g = {}) {
  if (!el) return;
  const w = { ...STANDARD_GESTALTUNG, ...g };

  const dunkelGewuenscht = w.design === "system"
    ? (typeof window !== "undefined"
      && window.matchMedia("(prefers-color-scheme: dark)").matches)
    : w.design !== "hell";
  el.dataset.design = w.design === "system"
    ? (dunkelGewuenscht ? "dunkel" : "hell")
    : w.design;

  const s = el.style;
  s.setProperty("--akzent", w.akzent);
  s.setProperty("--akzent-tief", abdunkeln(w.akzent));
  s.setProperty("--akzent-schrift", istHell(w.akzent) ? "#111418" : "#ffffff");
  s.setProperty("--schriftgroesse", w.schriftgroesse + "px");
  s.setProperty("--zeilenhoehe", String(w.zeilenhoehe));
  s.setProperty("--schrift-oberflaeche",
    (SCHRIFTEN[w.schriftOberflaeche] || SCHRIFTEN.system).stapel);
  s.setProperty("--schrift-karten",
    (SCHRIFTEN[w.schriftKarten] || SCHRIFTEN.georgia).stapel);
  s.setProperty("--dichte", String((DICHTEN[w.dichte] || DICHTEN.normal).wert));
  s.setProperty("--breite", (BREITEN[w.breite] || BREITEN.normal).wert);
  s.setProperty("--rund", w.rundung + "px");
  s.setProperty("--kartenhoehe", w.kartenhoehe + "px");
  s.setProperty("--wechsel", w.ruhig ? "0s" : "0.12s");
}
