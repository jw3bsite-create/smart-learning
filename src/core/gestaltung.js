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

/** Die Schriften, die auf einem gewöhnlichen Rechner vorhanden sind. */
export const SCHRIFTEN = {
  system: { name: "System", stapel:
    'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' },
  serifen: { name: "Serifen", stapel:
    '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif' },
  humanistisch: { name: "Humanistisch", stapel:
    'Calibri, Candara, "Segoe UI", "Trebuchet MS", sans-serif' },
  schmal: { name: "Schmal", stapel:
    '"Segoe UI Semilight", "Roboto Condensed", "Arial Narrow", sans-serif' },
  schreibmaschine: { name: "Schreibmaschine", stapel:
    'ui-monospace, "Cascadia Mono", Consolas, "Courier New", monospace' },
  buch: { name: "Buchschrift", stapel:
    'Constantia, "Book Antiqua", "Times New Roman", Georgia, serif' },
};

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
      schriftKarten: "serifen", dichte: "normal", rundung: 14, schriftgroesse: 15 } },
  { name: "Papier", beschreibung: "hell, warm, Buchschrift",
    werte: { design: "hell", akzent: "#a9743f", schriftOberflaeche: "humanistisch",
      schriftKarten: "buch", dichte: "luftig", rundung: 6, schriftgroesse: 16 } },
  { name: "Nacht", beschreibung: "tiefes Schwarz, sparsam",
    werte: { design: "tief", akzent: "#7c9cff", schriftOberflaeche: "system",
      schriftKarten: "system", dichte: "eng", rundung: 4, schriftgroesse: 15 } },
  { name: "Heft", beschreibung: "grün, eng, viel auf einen Blick",
    werte: { design: "dunkel", akzent: "#3fbf7f", schriftOberflaeche: "schmal",
      schriftKarten: "schmal", dichte: "eng", rundung: 10, schriftgroesse: 14 } },
  { name: "Groß", beschreibung: "für müde Augen",
    werte: { design: "system", akzent: "#e8b84b", schriftOberflaeche: "humanistisch",
      schriftKarten: "serifen", dichte: "luftig", rundung: 18, schriftgroesse: 19 } },
];

/** Die Vorgaben — dieselben Werte wie in `stil.css`. */
export const STANDARD_GESTALTUNG = {
  design: "system",              // system | hell | dunkel | tief
  akzent: "#5b8bff",
  schriftgroesse: 15,            // 12 bis 22
  zeilenhoehe: 1.5,              // 1.3 bis 1.9
  schriftOberflaeche: "system",
  schriftKarten: "serifen",
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
    (SCHRIFTEN[w.schriftKarten] || SCHRIFTEN.serifen).stapel);
  s.setProperty("--dichte", String((DICHTEN[w.dichte] || DICHTEN.normal).wert));
  s.setProperty("--breite", (BREITEN[w.breite] || BREITEN.normal).wert);
  s.setProperty("--rund", w.rundung + "px");
  s.setProperty("--kartenhoehe", w.kartenhoehe + "px");
  s.setProperty("--wechsel", w.ruhig ? "0s" : "0.12s");
}
