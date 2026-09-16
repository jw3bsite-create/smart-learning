/*
 * Lernzeit: wie lange wirklich gelernt und wie lange Material erstellt wurde.
 *
 * Gemessen wird nicht, wie lange die App offen ist. Ein offenes Fenster im
 * Hintergrund, ein Handy, das mit der App auf dem Tisch liegt, ein Tab hinter
 * dem Browser — all das wäre gezählte Zeit, in der nichts gelernt wurde.
 *
 * Stattdessen zählt nur Zeit zwischen zwei eigenen Handlungen (Tippen,
 * Klicken, Scrollen, Tastendruck), und das nur,
 *   - solange die App sichtbar ist und den Fokus hat,
 *   - solange man auf einer Seite ist, die Lernen oder Erstellen ist, und
 *   - solange zwischen zwei Handlungen nicht mehr als LEERLAUF vergeht.
 * Wer länger nichts tut, hat aufgehört; die Pause zählt nicht, auch nicht
 * nachträglich. Das unterschätzt eher, als dass es schönt — eine lange
 * Denkpause vor einer Antwort fällt heraus. Das ist gewollt: Eine Zahl, die
 * man sich nicht schönreden kann, ist mehr wert als eine, die schmeichelt.
 *
 * Abgelegt werden Zeitblöcke, keine Tagessummen. Ein Block hat eine eigene
 * Kennung und wird nur von dem Gerät geschrieben, auf dem er entstand — zwei
 * Geräte können sich beim Abgleich also nicht gegenseitig Minuten wegnehmen,
 * wie es bei einer gemeinsamen Tagessumme passieren würde.
 */

import { id as neueKennung } from "./model.js";
import { tagesSchluessel } from "./util.js";

/** Längste Pause zwischen zwei Handlungen, die noch mitzählt. */
export const LEERLAUF = 2 * 60 * 1000;
/** Kürzere Blöcke sind Durchklicken, kein Lernen, und werden verworfen. */
export const MINDEST = 5 * 1000;

/** Wird ausgelöst, wenn sich Zeitblöcke geändert haben — Anzeigen lesen dann neu. */
export const LERNZEIT_EREIGNIS = "lernzeit-geaendert";

export const ARTEN = {
  lernen: "Lernen",
  erstellen: "Erstellen",
};

const LERNMODI = new Set(["karten", "lernen", "schreiben", "buchstabieren",
  "test", "zuordnen", "meteor"]);

/**
 * Was auf einem Weg der App getan wird — oder `null`, wenn dort nichts zählt.
 *
 * Nicht gezählt werden Übersichten (Start, Fächer, Stapelliste, Fortschritt,
 * Punkte, Einstellungen): Dort wird geschaut, nicht gelernt.
 *
 * `teile`       der Weg, zerlegt ("/stapel/s1/lernen" → ["stapel","s1","lernen"])
 * `fachVonStapel` setId → subjectId
 */
export function taetigkeitFuer(teile, fachVonStapel = () => null) {
  const [a, b, c] = teile || [];
  const lernen = (bereich, extra = {}) => ({ art: "lernen", bereich, setId: null, subjectId: null, ...extra });
  const mitStapel = (art, bereich, setId) =>
    ({ art, bereich, setId, subjectId: fachVonStapel(setId) || null });

  switch (a) {
    case "abrufen": return lernen("abrufen", { subjectId: b || null });
    case "fragen": return lernen("fragen", { subjectId: b || null });
    case "erklaeren": return lernen("erklaeren");
    case "pruefung": return lernen("pruefung");
    case "tutor": return lernen("tutor");
    case "vorab": return b ? mitStapel("lernen", "vorab", b) : null;
    case "stapel":
      if (!b || !c) return null;
      if (c === "bearbeiten" || c === "entwuerfe") return mitStapel("erstellen", c, b);
      if (LERNMODI.has(c)) return mitStapel("lernen", c, b);
      return null;
    default: return null;
  }
}

const gleich = (x, y) => x && y && x.art === y.art && x.bereich === y.bereich
  && x.setId === y.setId && x.subjectId === y.subjectId;

/**
 * Die Stoppuhr. Rein und ohne Browser — die Zeit wird hereingereicht.
 *
 * Jede Methode gibt die Blöcke zurück, die jetzt zu speichern sind (einen
 * abgeschlossenen oder keinen). Den laufenden Block liefert `stand()`, damit
 * er zwischendurch gesichert werden kann und ein Absturz nicht die ganze
 * Sitzung kostet.
 */
export class Stoppuhr {
  constructor({ leerlauf = LEERLAUF, mindest = MINDEST, kennung = () => neueKennung("lz") } = {}) {
    this.leerlauf = leerlauf;
    this.mindest = mindest;
    this.kennung = kennung;
    this.block = null;
  }

  /** Eine Handlung des Nutzers. `taetigkeit` null heißt: hier zählt nichts. */
  regung(zeit, taetigkeit) {
    if (!taetigkeit) return this.anhalten();
    const b = this.block;
    if (b && gleich(b, taetigkeit) && zeit - b.ende <= this.leerlauf) {
      if (zeit > b.ende) b.ende = zeit;
      return [];
    }
    const fertig = this.anhalten();
    this.block = { id: this.kennung(), ...taetigkeit, beginn: zeit, ende: zeit };
    return fertig;
  }

  /** Fenster verdeckt, Fokus weg, Seite gewechselt: der Block endet sofort. */
  anhalten() {
    const b = this.block;
    this.block = null;
    return b && b.ende - b.beginn >= this.mindest ? [alsDatensatz(b)] : [];
  }

  /** Der laufende Block, sofern er schon zählt. */
  stand() {
    const b = this.block;
    return b && b.ende - b.beginn >= this.mindest ? alsDatensatz(b) : null;
  }
}

export function alsDatensatz(b, jetzt = Date.now()) {
  return {
    id: b.id, art: b.art, bereich: b.bereich,
    setId: b.setId || null, subjectId: b.subjectId || null,
    beginn: b.beginn, ende: b.ende,
    sekunden: Math.round((b.ende - b.beginn) / 1000),
    tag: tagesSchluessel(b.beginn),
    updatedAt: jetzt, deleted: false,
  };
}

/* ===================================================================== */
/*  Auswerten                                                            */
/* ===================================================================== */

const leer = () => ({ lernen: 0, erstellen: 0 });

function addiere(summe, block) {
  if (block.art in summe) summe[block.art] += block.sekunden || 0;
  return summe;
}

const gueltig = (b) => b && !b.deleted && typeof b.beginn === "number";

export function tagesBeginn(zeit) {
  const d = new Date(zeit); d.setHours(0, 0, 0, 0); return d.getTime();
}

/** Montag, 0 Uhr — so zählt man in Deutschland Wochen. */
export function wochenBeginn(zeit) {
  const d = new Date(zeit); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

export function monatsBeginn(zeit) {
  const d = new Date(zeit); d.setHours(0, 0, 0, 0); d.setDate(1); return d.getTime();
}

export function jahresBeginn(zeit) {
  const d = new Date(zeit); d.setHours(0, 0, 0, 0); d.setMonth(0, 1); return d.getTime();
}

/** Summe in Sekunden je Art, für Blöcke, die in [von, bis) beginnen. */
export function summe(bloecke, von = -Infinity, bis = Infinity) {
  const s = leer();
  for (const b of bloecke) if (gueltig(b) && b.beginn >= von && b.beginn < bis) addiere(s, b);
  return s;
}

/** Heute, diese Woche, dieser Monat, dieses Jahr, insgesamt. */
export function zeitraeume(bloecke, jetzt = Date.now()) {
  return {
    heute: summe(bloecke, tagesBeginn(jetzt)),
    woche: summe(bloecke, wochenBeginn(jetzt)),
    monat: summe(bloecke, monatsBeginn(jetzt)),
    jahr: summe(bloecke, jahresBeginn(jetzt)),
    gesamt: summe(bloecke),
  };
}

const MONATE = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
const WOCHENTAGE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

/** Kalenderwoche nach ISO 8601. */
export function kalenderwoche(zeit) {
  const d = new Date(zeit); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const erste = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - erste) / 86400000 - 3 + ((erste.getDay() + 6) % 7)) / 7);
}

/**
 * Der Verlauf als Säulen: die letzten `anzahl` Tage, Wochen oder Monate,
 * die älteste zuerst. Jede Säule: { beginn, ende, kurz, lang, lernen, erstellen }.
 */
export function verlauf(bloecke, einheit = "tag", anzahl = 14, jetzt = Date.now()) {
  const grenzen = [];
  if (einheit === "monat") {
    const d = new Date(monatsBeginn(jetzt));
    d.setMonth(d.getMonth() - (anzahl - 1));
    for (let i = 0; i <= anzahl; i++) {
      grenzen.push(d.getTime());
      d.setMonth(d.getMonth() + 1);
    }
  } else {
    const d = new Date(einheit === "woche" ? wochenBeginn(jetzt) : tagesBeginn(jetzt));
    const schritt = einheit === "woche" ? 7 : 1;
    d.setDate(d.getDate() - (anzahl - 1) * schritt);
    for (let i = 0; i <= anzahl; i++) {
      grenzen.push(d.getTime());
      d.setDate(d.getDate() + schritt);   // über setDate, damit die Zeitumstellung nicht verrutscht
    }
  }

  const saeulen = [];
  for (let i = 0; i < anzahl; i++) {
    const beginn = grenzen[i];
    const d = new Date(beginn);
    let kurz, lang;
    if (einheit === "monat") {
      kurz = MONATE[d.getMonth()];
      lang = d.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
    } else if (einheit === "woche") {
      kurz = "KW " + kalenderwoche(beginn);
      const bis = new Date(grenzen[i + 1] - 1);
      lang = "KW " + kalenderwoche(beginn) + " · " + d.toLocaleDateString("de-DE",
        { day: "numeric", month: "numeric" }) + "–" + bis.toLocaleDateString("de-DE",
        { day: "numeric", month: "numeric" });
    } else {
      kurz = WOCHENTAGE[d.getDay()] + " " + d.getDate() + ".";
      lang = d.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });
    }
    saeulen.push({ beginn, ende: grenzen[i + 1], kurz, lang, ...leer() });
  }

  const erste = grenzen[0];
  const letzte = grenzen[anzahl];
  for (const b of bloecke) {
    if (!gueltig(b) || b.beginn < erste || b.beginn >= letzte) continue;
    // Binäre Suche wäre schneller; bei höchstens ein paar Tausend Blöcken lohnt es nicht.
    const s = saeulen.find((x) => b.beginn >= x.beginn && b.beginn < x.ende);
    if (s) addiere(s, b);
  }
  return saeulen;
}

/** Je Fach im Zeitraum, das meiste zuerst. Blöcke ohne Fach unter `null`. */
export function jeFach(bloecke, von = -Infinity, bis = Infinity) {
  const karte = new Map();
  for (const b of bloecke) {
    if (!gueltig(b) || b.beginn < von || b.beginn >= bis) continue;
    const schluessel = b.subjectId || null;
    if (!karte.has(schluessel)) karte.set(schluessel, { subjectId: schluessel, ...leer() });
    addiere(karte.get(schluessel), b);
  }
  return [...karte.values()]
    .sort((x, y) => (y.lernen + y.erstellen) - (x.lernen + x.erstellen));
}

/** "unter 1 Min.", "25 Min.", "1 Std. 5 Min.", "12 Std." */
export function dauerText(sekunden) {
  const s = Math.max(0, Math.round(sekunden || 0));
  if (s === 0) return "0 Min.";
  if (s < 60) return "unter 1 Min.";
  const minuten = Math.round(s / 60);
  if (minuten < 60) return minuten + " Min.";
  const stunden = Math.floor(minuten / 60);
  const rest = minuten % 60;
  if (stunden >= 10 || rest === 0) return stunden + " Std.";
  return stunden + " Std. " + rest + " Min.";
}

/** Kurz für Achsen und enge Stellen: "25 m", "1,5 h". */
export function dauerKurz(sekunden) {
  const minuten = Math.round((sekunden || 0) / 60);
  if (minuten < 60) return minuten + " m";
  const stunden = minuten / 60;
  return (stunden < 10 ? stunden.toFixed(1).replace(".", ",") : Math.round(stunden)) + " h";
}
