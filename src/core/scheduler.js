/*
 * Der Lernplan.
 *
 * Zwei Dinge zugleich:
 *
 * 1. Fächer (nach Leitner). Jede Karte sitzt je Abfragerichtung in einem Fach
 *    von 0 bis 6. Richtig beantwortet steigt sie ein Fach auf, falsch fällt sie
 *    zurück. Daraus ergibt sich, wie eine Karte abgefragt wird: frisch als
 *    Auswahlfrage, später als Schreibaufgabe.
 * 2. Abstände. Mit dem Fach wächst der Abstand bis zur nächsten Wiederholung
 *    (10 Minuten, 1 Tag, 3, 7, 16, 35, 90). Der Faktor `ease` dehnt oder staucht
 *    diese Abstände je nachdem, wie sicher eine Karte sitzt — das ist der Kern
 *    von SM-2 und der Grund, warum verteiltes Üben mehr bringt als Pauken.
 */

const TAG = 24 * 3600 * 1000;
/** Abstand je Fach, in Tagen. */
export const ABSTAENDE = [0, 10 / 1440, 1, 3, 7, 16, 35, 90];
export const HOECHSTES_FACH = 7;

/** Fach → Art der Abfrage im Lernmodus. */
export function frageArt(box, erlaubt = { auswahl: true, schreiben: true, wahrFalsch: false }) {
  const moeglich = [];
  if (erlaubt.auswahl) moeglich.push("auswahl");
  if (erlaubt.schreiben) moeglich.push("schreiben");
  if (erlaubt.wahrFalsch) moeglich.push("wahrFalsch");
  if (!moeglich.length) return "auswahl";
  if (box <= 1) return moeglich.includes("auswahl") ? "auswahl" : moeglich[0];
  if (box === 2 && moeglich.includes("wahrFalsch")) return "wahrFalsch";
  return moeglich.includes("schreiben") ? "schreiben" : moeglich[moeglich.length - 1];
}

/**
 * Verbucht eine Antwort und gibt den neuen Stand zurück (ohne den alten zu
 * verändern). `qualitaet`: 0 falsch, 1 fast richtig, 2 richtig.
 */
export function bewerte(stand, richtung, qualitaet, zeit = Date.now()) {
  const alt = stand[richtung];
  const r = { ...alt };
  r.reps += 1;

  if (qualitaet >= 2) {
    r.box = Math.min(HOECHSTES_FACH, r.box + 1);
    r.correct += 1;
    r.ease = Math.min(3.2, r.ease + 0.08);
  } else if (qualitaet === 1) {
    // Fast richtig: die Karte bleibt, wo sie ist, kommt aber bald wieder.
    r.correct += 1;
    r.ease = Math.max(1.3, r.ease - 0.05);
  } else {
    r.box = r.box >= 4 ? r.box - 2 : Math.max(0, r.box - 1);
    r.wrong += 1;
    r.lapses += 1;
    r.ease = Math.max(1.3, r.ease - 0.2);
  }

  const tage = (ABSTAENDE[Math.min(r.box, ABSTAENDE.length - 1)] || 0) *
    (r.box >= 2 ? r.ease / 2.5 : 1);
  r.interval = tage;
  r.due = zeit + Math.max(qualitaet >= 2 ? 60 * 1000 : 30 * 1000, tage * TAG);

  return { ...stand, [richtung]: r, seen: (stand.seen || 0) + 1, lastSeen: zeit,
    updatedAt: zeit };
}

export function faellig(stand, richtung, zeit = Date.now()) {
  if (!stand) return true;
  const r = stand[richtung];
  return !r || r.reps === 0 || (r.due || 0) <= zeit;
}

/** Wie dringend eine Karte drankommen sollte — größer heißt dringlicher. */
function dringlichkeit(stand, richtung, zeit) {
  if (!stand) return 1e9;
  const r = stand[richtung];
  if (!r || r.reps === 0) return 1e8;              // Neues zuerst
  const ueberfaellig = zeit - (r.due || 0);
  if (ueberfaellig < 0) return -1 / (1 - ueberfaellig / TAG);
  return ueberfaellig / TAG + (HOECHSTES_FACH - r.box) * 0.5 + r.lapses * 0.3;
}

/**
 * Stellt die nächste Lernrunde zusammen.
 * `richtung`: "td", "dt" oder "beide" (dann wird je Karte gewürfelt).
 */
export function baueRunde(karten, staende, opt = {}) {
  const {
    groesse = 7, richtung = "td", zeit = Date.now(),
    nurFaellige = false, nurMarkierte = false, gemischt = true,
  } = opt;

  let liste = karten.filter((k) => !k.deleted);
  if (nurMarkierte) liste = liste.filter((k) => k.starred);

  const kandidaten = [];
  for (const k of liste) {
    const stand = staende[k.id];
    const richtungen = richtung === "beide" ? ["td", "dt"] : [richtung];
    for (const r of richtungen) {
      if (nurFaellige && !faellig(stand, r, zeit)) continue;
      kandidaten.push({ card: k, richtung: r, rang: dringlichkeit(stand, r, zeit) });
    }
  }

  kandidaten.sort((a, b) => b.rang - a.rang);
  const gewaehlt = kandidaten.slice(0, groesse);
  return gemischt ? gewaehlt.sort(() => Math.random() - 0.5) : gewaehlt;
}

/** Zählt, was heute ansteht. */
export function faelligZaehlen(karten, staende, zeit = Date.now()) {
  let neu = 0, faellige = 0, beherrscht = 0;
  for (const k of karten) {
    const s = staende[k.id];
    if (!s || (!s.td.reps && !s.dt.reps)) { neu++; continue; }
    if (s.td.box >= 5 && s.dt.box >= 5) { beherrscht++; continue; }
    if (faellig(s, "td", zeit) || faellig(s, "dt", zeit)) faellige++;
  }
  return { neu, faellige, beherrscht, gesamt: karten.length };
}

/** Wann die nächste Karte wieder ansteht (oder null). */
export function naechsteFaelligkeit(karten, staende, zeit = Date.now()) {
  let frueh = null;
  for (const k of karten) {
    const s = staende[k.id];
    if (!s) return zeit;
    for (const r of ["td", "dt"]) {
      const d = s[r].reps ? s[r].due : zeit;
      if (d <= zeit) return zeit;
      if (frueh === null || d < frueh) frueh = d;
    }
  }
  return frueh;
}
