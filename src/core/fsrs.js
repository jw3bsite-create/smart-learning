/*
 * Der Wiederholungsplaner: FSRS.
 *
 * Diese Datei ist eine dünne Hülle um `ts-fsrs`. Gerechnet wird dort, hier
 * wird nur übersetzt: zwischen der Form, die die Bibliothek erwartet (Card mit
 * Date-Objekten), und der Form, die wir ablegen und mit der Wolke abgleichen
 * (schlichte Zahlen, JSON-tauglich).
 *
 * Warum FSRS und nicht das alte Fächersystem: Fächer haben feste Abstände für
 * alle Karten. FSRS schätzt je Karte drei Größen —
 *
 *   Stability      wie lange das Wissen hält, in Tagen
 *   Difficulty     wie zäh die Karte für diesen Menschen ist
 *   Retrievability wie wahrscheinlich der Abruf gerade jetzt gelingt
 *
 * — und setzt den nächsten Termin genau dorthin, wo die Abrufwahrscheinlichkeit
 * auf die gewünschte Marke gefallen ist (Ziel-Retention). Eine Karte, die
 * sitzt, kommt darum Monate später wieder; eine zähe in Tagen.
 *
 * Der alte Planer in `scheduler.js` bleibt unangetastet — er versorgt weiterhin
 * die sieben Übungsmodi. Über Termine entscheidet ausschließlich diese Datei.
 */

import { fsrs, createEmptyCard, generatorParameters, Rating, State } from "ts-fsrs";

/** Die vier Bewertungen nach dem Aufdecken. */
export const NOTEN = {
  NOCHMAL: 1,   // Rating.Again — nicht gewusst
  SCHWER: 2,    // Rating.Hard  — gewusst, aber mühsam
  GUT: 3,       // Rating.Good  — gewusst
  LEICHT: 4,    // Rating.Easy  — sofort und sicher gewusst
};

export const NOTEN_NAMEN = {
  1: "Nochmal", 2: "Schwer", 3: "Gut", 4: "Leicht",
};

/** Die drei Selbsteinschätzungen vor dem Aufdecken. */
export const KONFIDENZ = {
  SICHER: 1,
  UNSICHER: 2,
  KEINE_AHNUNG: 3,
};

export const KONFIDENZ_NAMEN = {
  1: "sicher", 2: "unsicher", 3: "keine Ahnung",
};

export const ZUSTAENDE = {
  0: "Neu", 1: "Am Lernen", 2: "Wiederholung", 3: "Nachlernen",
};

/** Grenzen des Kalibrierungsaufschlags. */
export const AUFSCHLAG_MIN = 0.7;
export const AUFSCHLAG_MAX = 1.0;

/*
 * Wann eine Karte stillgelegt wird: nach so vielen Rückfällen.
 *
 * Ein Rückfall ist ein „Nochmal" bei einer Karte, die schon im
 * Wiederholungsstand war — also etwas Gelerntes, das wieder vergessen wurde.
 * Das „Nochmal" in den ersten Lernschritten zählt nicht: Dass man eine neue
 * Karte am ersten Tag dreimal nicht kann, ist Lernen, kein Zeichen einer zu
 * großen Karte. Früher zählte jedes „Nochmal", schon ab sechs — damit fielen
 * gerade die schweren Abiturkarten nach wenigen Wochen still aus dem Plan.
 *
 * Gezählt wird seit der letzten Freigabe (`lapsesFreigabe`), damit eine
 * überarbeitete Karte eine echte zweite Chance bekommt.
 */
export const LEECH_AB = 8;

const TAG = 24 * 3600 * 1000;
const planer = new Map();

/**
 * Eine Planerinstanz je Ziel-Retention. Die Bibliothek ist zustandslos, das
 * Erzeugen aber nicht umsonst — darum merken wir uns die Instanzen.
 */
function hole(zielRetention = 0.9, maximalTage = 3650) {
  const schluessel = zielRetention + ":" + maximalTage;
  if (!planer.has(schluessel)) {
    planer.set(schluessel, fsrs(generatorParameters({
      request_retention: zielRetention,
      maximum_interval: maximalTage,
      enable_fuzz: true,        // streut Termine leicht, damit keine Klumpen entstehen
      enable_short_term: true,  // Lernschritte am selben Tag
    })));
  }
  return planer.get(schluessel);
}

/* --------------------------- Hin und her übersetzen --------------------- */

/** Aus unserem abgelegten Zustand die Card der Bibliothek machen. */
function alsCard(zustand) {
  return {
    due: new Date(zustand.due || Date.now()),
    stability: zustand.stability || 0,
    difficulty: zustand.difficulty || 0,
    elapsed_days: zustand.elapsed_days || 0,
    scheduled_days: zustand.scheduled_days || 0,
    learning_steps: zustand.learning_steps || 0,
    reps: zustand.reps || 0,
    lapses: zustand.lapses || 0,
    state: zustand.state || State.New,
    last_review: zustand.last_review ? new Date(zustand.last_review) : undefined,
  };
}

/** Und zurück in die ablegbare Form. */
function ausCard(card) {
  return {
    due: card.due instanceof Date ? card.due.getTime() : Number(card.due),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review
      ? (card.last_review instanceof Date ? card.last_review.getTime() : Number(card.last_review))
      : null,
  };
}

/**
 * Frischer Kartenzustand.
 * `id` ist `<kartenkennung>:<richtung>` — jede Abfragerichtung wird eigenständig
 * geplant, denn Deutsch→Spanisch kann sitzen, während Spanisch→Deutsch hakt.
 */
export function neuerZustand(cardId, richtung, setId, subjectId, zeit = Date.now()) {
  return {
    id: cardId + ":" + richtung,
    cardId, richtung, setId, subjectId,
    ...ausCard(createEmptyCard(new Date(zeit))),
    aufschlag: AUFSCHLAG_MAX,   // Kalibrierungsaufschlag, siehe unten
    gesperrt: false,            // Leech-Sperre, siehe unten
    nochmalGesamt: 0,           // wie oft „Nochmal" überhaupt nötig war
    nochmalZaehler: 0,          // und wie oft davon zuletzt hintereinander
    lapsesFreigabe: 0,          // Rückfälle beim letzten Freigeben, siehe LEECH_AB
    eingefuehrt: null,          // wann die Karte zum ersten Mal gewertet wurde
    updatedAt: zeit,
    deleted: false,
  };
}

/* ------------------------------- Bewerten ------------------------------- */

/**
 * Verbucht eine Bewertung und gibt den neuen Zustand zurück.
 *
 * `note` ist 1–4 (siehe NOTEN). `wirksam: false` lässt den Zustand unberührt —
 * so verlangen es Pretest, Cram-Warteschlange und die Übungsmodi (§3.6, §5).
 */
export function bewerteKarte(zustand, note, opt = {}) {
  const {
    zielRetention = 0.9, maximalTage = 3650, zeit = Date.now(),
    wirksam = true, aufschlag = null,
  } = opt;

  if (!wirksam) return zustand;

  const planer = hole(zielRetention, maximalTage);
  const { card } = planer.next(alsCard(zustand), new Date(zeit), note);
  const neu = ausCard(card);

  // Der Kalibrierungsaufschlag greift erst nach dem Rechnen und nur auf den
  // Termin, nie auf die Parameter. Sonst wäre die Historie für eine spätere
  // Nachoptimierung der Parameter unbrauchbar (§3.3).
  const wirkenderAufschlag = aufschlag ?? zustand.aufschlag ?? AUFSCHLAG_MAX;
  if (wirkenderAufschlag < AUFSCHLAG_MAX && neu.state === State.Review) {
    const abstand = neu.due - zeit;
    if (abstand > TAG) neu.due = zeit + Math.max(TAG, abstand * wirkenderAufschlag);
  }

  const nochmal = note === NOTEN.NOCHMAL;
  const nochmalGesamt = (zustand.nochmalGesamt || 0) + (nochmal ? 1 : 0);
  const nochmalZaehler = nochmal ? (zustand.nochmalZaehler || 0) + 1 : 0;

  return {
    ...zustand, ...neu,
    aufschlag: wirkenderAufschlag,
    nochmalGesamt, nochmalZaehler,
    // Leech: Wer etwas Gelerntes immer wieder vergisst, hat meist eine zu
    // große Karte, kein zu schlechtes Gedächtnis. Sie wird stillgelegt, bis
    // sie überarbeitet oder freigegeben ist — sichtbar im Fehlerheft.
    gesperrt: Boolean(zustand.gesperrt) || (nochmal && rueckfaelle(neu, zustand) >= LEECH_AB),
    // Für das Tageslimit neuer Karten: wann die Karte eingeführt wurde.
    eingefuehrt: zustand.eingefuehrt || (zustand.reps ? null : zeit),
    updatedAt: zeit,
  };
}

/** Rückfälle seit der letzten Freigabe. */
function rueckfaelle(neu, vorher) {
  return (neu.lapses || 0) - (vorher.lapsesFreigabe || 0);
}

/** Wie viele Rückfälle eine Karte seit ihrer letzten Freigabe hat. */
export function rueckfaelleSeitFreigabe(zustand) {
  return Math.max(0, (zustand?.lapses || 0) - (zustand?.lapsesFreigabe || 0));
}

/**
 * Gibt eine stillgelegte Karte wieder frei. Der Lernstand bleibt, wie er
 * ist; nur die Zählung der Rückfälle beginnt von vorn.
 */
export function freigeben(zustand, zeit = Date.now()) {
  return {
    ...zustand, gesperrt: false, nochmalZaehler: 0,
    lapsesFreigabe: zustand.lapses || 0, updatedAt: zeit,
  };
}

/**
 * Wurde die Karte nur nach der alten, zu strengen Regel gesperrt?
 * Solche Karten gibt die Umstellung der Daten einmalig frei.
 */
export function nachAlterRegelGesperrt(zustand) {
  return Boolean(zustand?.gesperrt) && rueckfaelleSeitFreigabe(zustand) < LEECH_AB;
}

/** Was die vier Knöpfe bewirken würden — für die Vorschau auf den Knöpfen. */
export function vorschau(zustand, opt = {}) {
  const { zielRetention = 0.9, maximalTage = 3650, zeit = Date.now() } = opt;
  const planer = hole(zielRetention, maximalTage);
  const ergebnis = {};
  for (const note of [1, 2, 3, 4]) {
    const { card } = planer.next(alsCard(zustand), new Date(zeit), note);
    const abstand = (card.due instanceof Date ? card.due.getTime() : Number(card.due)) - zeit;
    ergebnis[note] = abstand;
  }
  return ergebnis;
}

/* ------------------------------- Abfragen ------------------------------- */

export function istFaellig(zustand, zeit = Date.now()) {
  if (!zustand || zustand.gesperrt) return false;
  return (zustand.due || 0) <= zeit;
}

export function istNeu(zustand) {
  return !zustand || zustand.state === State.New || !zustand.reps;
}

/** Abrufwahrscheinlichkeit gerade jetzt (0–1). */
export function behaltenswahrscheinlichkeit(zustand, zeit = Date.now()) {
  if (!zustand || !zustand.reps || !zustand.stability) return 0;
  try {
    return hole().get_retrievability(alsCard(zustand), new Date(zeit), false);
  } catch (e) {
    return 0;
  }
}

/** Grobe Stufe für Balken und Farben — ersetzt die alten Fächerstufen. */
export const STUFEN = ["Neu", "Am Lernen", "Vertraut", "Beherrscht"];

export function stufe(zustand) {
  if (istNeu(zustand)) return 0;
  const s = zustand.stability || 0;
  if (s < 7) return 1;      // hält weniger als eine Woche
  if (s < 30) return 2;     // hält weniger als einen Monat
  return 3;                 // hält länger als einen Monat
}

export function anteileNachStufe(zustaende) {
  const anteile = [0, 0, 0, 0];
  for (const z of zustaende) anteile[stufe(z)] += 1;
  return anteile;
}

/** Menschenlesbarer Abstand: „in 3 Tagen", „in 8 Minuten". */
export function abstandLang(ms) {
  const min = ms / 60000;
  if (min < 1) return "gleich";
  if (min < 60) return "in " + Math.round(min) + " min";
  const std = min / 60;
  if (std < 24) return "in " + Math.round(std) + " h";
  const tage = std / 24;
  if (tage < 31) return "in " + Math.round(tage) + (Math.round(tage) === 1 ? " Tag" : " Tagen");
  const monate = tage / 30.44;
  if (monate < 12) return "in " + Math.round(monate) + (Math.round(monate) === 1 ? " Monat" : " Monaten");
  return "in " + (tage / 365.25).toFixed(1).replace(".", ",") + " Jahren";
}

export { Rating, State };
