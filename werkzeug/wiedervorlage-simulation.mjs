/*
 * Simulierter Durchlauf der Wiedervorlage (core/wiedervorlage.js).
 *
 *   node werkzeug/wiedervorlage-simulation.mjs [karten] [startwert] [sekunden]
 *
 * Jede Karte hat eine eigene Schwierigkeit: Schwere Karten sind öfter falsch
 * und langsamer. Ergebnisse und Zeiten sind zufällig, aber mit festem
 * Startwert wiederholbar. Ausgegeben wird die Reihenfolge, wie sie entstand.
 */

import {
  sitzungBeginnen, antworten, zusammenfassung, stapelMedian, referenz, kappen, abstandFuer, WERTE,
} from "../src/core/wiedervorlage.js";

const [anzahl = 20, startwert = 7, sekunden = 6] = process.argv.slice(2).map(Number);

/* Ein kleiner Zufallsgenerator mit Startwert (mulberry32). */
let s = startwert >>> 0;
const zufall = () => {
  s = (s + 0x6D2B79F5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const karten = Array.from({ length: anzahl }, (_, i) => ({
  id: "K" + String(i + 1).padStart(2, "0"),
  schwer: zufall(),                                 // 0 leicht … 1 schwer
}));
const schwierigkeit = Object.fromEntries(karten.map((k) => [k.id, k.schwer]));

let sitzung = sitzungBeginnen(karten.map((k) => k.id));
const richtigeStapel = [];        // in dieser Sitzung gemessene richtige Zeiten
const richtigeKarte = {};
const zeilen = [];

for (let stelle = 0; stelle < sitzung.folge.length; stelle++) {
  const { id, grund } = sitzung.folge[stelle];
  const schwer = schwierigkeit[id];
  // Nach einem Fehler kennt man die Antwort eben gesehen — höhere Trefferquote.
  const quote = grund === "falsch" ? 0.75 - 0.3 * schwer : 0.9 - 0.6 * schwer;
  const richtig = zufall() < quote;
  const roh = sekunden * 1000 * (0.6 + 1.6 * schwer) * (0.5 + zufall());
  const stapelMs = stapelMedian(richtigeStapel);
  const zeitMs = Math.round(kappen(roh, stapelMs));
  const referenzMs = referenz(richtigeKarte[id] || [], stapelMs);

  const vorher = sitzung;
  const { sitzung: neu, ergebnis } = antworten(sitzung, stelle, { richtig, zeitMs, referenzMs, stapelMs });
  sitzung = neu;
  if (richtig) {
    richtigeStapel.push(zeitMs);
    (richtigeKarte[id] ||= []).push(zeitMs);
  }

  const wo = ergebnis.abstand
    ? " → wieder an Stelle " + (sitzung.folge.findIndex((e, j) => j > stelle && e.id === id) + 1)
      + " (Abstand " + ergebnis.abstand + ")"
    : "";
  zeilen.push([
    String(stelle + 1).padStart(3), id,
    { erst: "      ", falsch: "↻ falsch", langsam: "↻ langsam" }[grund].padEnd(9),
    (richtig ? "richtig" : "FALSCH ").padEnd(7),
    (zeitMs / 1000).toFixed(1).padStart(5) + " s",
    "Ref " + (referenzMs / 1000).toFixed(1).padStart(4) + " s",
    "Median " + (stapelMs / 1000).toFixed(1).padStart(4) + " s",
    { fertig: "fertig", falsch: "falsch", langsam: "langsam", problem: "PROBLEMKARTE" }[ergebnis.art] + wo,
  ].join("  "));
  if (vorher.folge.length !== sitzung.folge.length && sitzung.folge.length > anzahl * 6) break;
}

console.log("Simulation: " + anzahl + " Karten, Startwert " + startwert + ", Grundzeit " + sekunden + " s");
console.log("Abstand am Anfang: " + abstandFuer(WERTE.START_MEDIAN_MS) + " Karten (Startwert-Median "
  + WERTE.START_MEDIAN_MS / 1000 + " s)\n");
console.log("  #  Karte  Grund      Antwort  Zeit     Referenz    Stapel        Folge");
for (const z of zeilen) console.log(z);

/* Prüfungen der Reihenfolge, die man nicht übersehen soll. */
const folge = sitzung.folge.map((e) => e.id);
const direkt = folge.filter((id, i) => i > 0 && id === folge[i - 1]
  && folge.slice(i + 1).some((x) => x !== id));
const z = zusammenfassung(sitzung, () => "Stapel");
console.log("\nReihenfolge: " + folge.join(" "));
console.log("Länge: " + folge.length + " (davon " + z.wiedervorlagen + " Wiedervorlagen)");
console.log("Dieselbe Karte direkt hintereinander (obwohl andere übrig): " + (direkt.length ? direkt.join(", ") : "nie"));
console.log("Fehler: " + z.fehler + " | Problemkarten: " + (z.problem.join(", ") || "keine")
  + " | erste Versuche richtig: " + z.ersteRichtig + " von " + z.ersteGesamt
  + " | Ø Erinnerungszeit (richtig): " + (z.mittel[0] ? (z.mittel[0].ms / 1000).toFixed(1) + " s" : "–"));
