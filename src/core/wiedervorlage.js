/*
 * Wiedervorlage in derselben Sitzung — nach Richtigkeit und Erinnerungszeit.
 *
 * Angelehnt an die Lernschritte in Anki und an ARTS (Adaptive Response-Time-
 * based Sequencing, Mettler, Massey und Kellman): Wann eine Karte
 * wiederkommt, hängt davon ab, ob sie gewusst wurde und wie schnell —
 * gemessen nicht in Sekunden, sondern im Verhältnis zu dem, was für diesen
 * Stapel und diese Karte üblich ist. Vokabeln mit sechs Sekunden je Karte
 * und Rechenwege mit vierzig brauchen verschiedene Abstände.
 *
 *   falsch            nach A Karten wieder; erledigt erst nach einem
 *                     richtigen Versuch danach, wieder falsch beginnt von vorn
 *   richtig, langsam  einmal erneut, nach 2 · A Karten
 *   richtig, schnell  für diese Sitzung fertig
 *   FEHLER_PROBLEM-mal falsch   Problemkarte: nicht weiter wiederholen,
 *                     am Ende auflisten (umformulieren, aufteilen)
 *
 * Nur die Reihenfolge innerhalb einer Sitzung. Die Planung über Tage macht
 * FSRS (core/fsrs.js); dorthin gehen die Antworten wie bisher, die
 * Erinnerungszeit steht zusätzlich an jeder Antwort (`erinnerungszeit`).
 *
 * Vom Nutzer gewünscht am 24. November 2026, zuerst für die Karteikarten.
 */

/* ----------------------- Alle Zahlen an einer Stelle ---------------------- */

export const WERTE = {
  ZIEL_MS: 90000,              // Abstand A = ZIEL / Stapel-Median, in Karten
  ABSTAND_MIN: 3,
  ABSTAND_MAX: 10,
  LANGSAM_FAKTOR: 1.5,         // langsam heißt: über 1,5 × Referenz
  LANGSAM_ABSTAND_MIN: 6,      // Abstand nach „richtig, aber langsam“ = 2 · A,
  LANGSAM_ABSTAND_MAX: 20,     //   begrenzt auf 6 bis 20 Karten
  FEHLER_PROBLEM: 4,           // so viele Fehler machen eine Problemkarte
  START_MEDIAN_MS: 8000,       // Stapel-Median, solange zu wenig gemessen ist
  STAPEL_MIN_PUNKTE: 5,        // ab so vielen richtigen Antworten gilt der Stapel-Median
  KARTE_MIN_PUNKTE: 2,         // ab so vielen gilt der Median der Karte selbst
  KAPPUNG_FAKTOR: 3,           // Ausreißer: höchstens 3 × Stapel-Median …
  KAPPUNG_MAX_MS: 120000,      // … und nie über zwei Minuten
};

/* ------------------------------- Zeiten ---------------------------------- */

export function median(werte) {
  const s = werte.filter((w) => Number.isFinite(w)).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Der Median des Stapels aus den richtigen Antworten, mit Startwert. */
export function stapelMedian(richtigeZeiten, w = WERTE) {
  return richtigeZeiten.length >= w.STAPEL_MIN_PUNKTE ? median(richtigeZeiten) : w.START_MEDIAN_MS;
}

/** Die Referenz einer Karte: ihr eigener Median, sonst der des Stapels. */
export function referenz(karteZeiten, stapelMs, w = WERTE) {
  return karteZeiten.length >= w.KARTE_MIN_PUNKTE ? median(karteZeiten) : stapelMs;
}

/** Ausreißer kappen — wer abgelenkt war, soll nicht als „langsam“ gelten. */
export function kappen(ms, stapelMs, w = WERTE) {
  return Math.max(0, Math.min(ms, w.KAPPUNG_FAKTOR * stapelMs, w.KAPPUNG_MAX_MS));
}

const klemmen = (x, a, b) => Math.max(a, Math.min(b, x));

/** Abstand A in Karten: 90 s Erinnerungszeit dazwischen, 3 bis 10 Karten. */
export function abstandFuer(stapelMs, w = WERTE) {
  return klemmen(Math.round(w.ZIEL_MS / Math.max(1, stapelMs)), w.ABSTAND_MIN, w.ABSTAND_MAX);
}

export function langsamAbstandFuer(stapelMs, w = WERTE) {
  return klemmen(2 * abstandFuer(stapelMs, w), w.LANGSAM_ABSTAND_MIN, w.LANGSAM_ABSTAND_MAX);
}

/**
 * Die richtigen Erinnerungszeiten aus dem Verlauf (`reviews`) — für einen
 * Stapel, und je Karte. Falsche Antworten zählen für die Planung nicht.
 */
export function zeitenAusVerlauf(reviews, setId) {
  const stapel = [];
  const jeKarte = new Map();
  for (const r of reviews) {
    if (r.deleted || r.setId !== setId || !(r.erinnerungszeit > 0) || !(r.bewertung >= 2)) continue;
    stapel.push(r.erinnerungszeit);
    if (!jeKarte.has(r.cardId)) jeKarte.set(r.cardId, []);
    jeKarte.get(r.cardId).push(r.erinnerungszeit);
  }
  return { stapel, jeKarte };
}

/* -------------------------------- Sitzung -------------------------------- */

/**
 * Eine Sitzung beginnen. `folge`: was nacheinander drankommt, jeder Eintrag
 * `{ id, grund }` mit grund "erst", "falsch" oder "langsam".
 */
export function sitzungBeginnen(ids) {
  return {
    folge: ids.map((id) => ({ id, grund: "erst" })),
    fehler: {},            // je Karte: wie oft falsch in dieser Sitzung
    langsamSchon: {},      // je Karte: schon einmal wegen Langsamkeit erneut gezeigt
    problem: [],           // Problemkarten, in der Reihenfolge ihres Entstehens
    verlauf: [],           // jede Antwort: { id, richtig, zeit, grund, langsam }
  };
}

/*
 * Eine Wiedervorlage einschieben. Reichen die übrigen Karten nicht für den
 * Abstand, kommt sie ans Ende — so stehen die Wiedervorlagen dort in der
 * Reihenfolge ihres Fälligwerdens. Nie direkt hinter der Karte selbst,
 * solange noch eine andere übrig ist.
 */
function einschieben(folge, stelle, eintrag, abstand) {
  const rest = folge.length - (stelle + 1);
  let ziel = rest >= abstand ? stelle + 1 + abstand : folge.length;
  if (ziel === stelle + 1 && rest > 0) ziel = stelle + 2;
  return [...folge.slice(0, ziel), eintrag, ...folge.slice(ziel)];
}

/**
 * Die Antwort auf die Karte an `stelle` verbuchen. Zurück kommt die neue
 * Sitzung und als `ergebnis`, was mit der Karte geschieht:
 *   { art: "fertig" | "falsch" | "langsam" | "problem", abstand? }
 *
 * `zeitMs` ist die (schon gekappte) Erinnerungszeit, `referenzMs` die der
 * Karte, `stapelMs` der Stapel-Median.
 */
export function antworten(sitzung, stelle, { richtig, zeitMs = 0, referenzMs, stapelMs }, w = WERTE) {
  const eintrag = sitzung.folge[stelle];
  if (!eintrag) return { sitzung, ergebnis: { art: "fertig" } };
  const { id, grund } = eintrag;
  const langsam = richtig && zeitMs > w.LANGSAM_FAKTOR * referenzMs;
  const verlauf = [...sitzung.verlauf, { id, richtig, zeit: zeitMs, grund, langsam }];

  if (!richtig) {
    const fehler = { ...sitzung.fehler, [id]: (sitzung.fehler[id] || 0) + 1 };
    if (fehler[id] >= w.FEHLER_PROBLEM) {
      return { sitzung: { ...sitzung, fehler, verlauf,
        problem: sitzung.problem.includes(id) ? sitzung.problem : [...sitzung.problem, id] },
      ergebnis: { art: "problem" } };
    }
    const abstand = abstandFuer(stapelMs, w);
    return { sitzung: { ...sitzung, fehler, verlauf,
      folge: einschieben(sitzung.folge, stelle, { id, grund: "falsch" }, abstand) },
    ergebnis: { art: "falsch", abstand } };
  }

  /* Langsam, aber richtig: einmal erneut — nur beim ersten Zeigen. Nach
     einem Fehler ist die Karte mit dem richtigen Versuch erledigt; wer die
     Antwort eben gesehen hat, ist ohnehin nicht schnell. */
  if (langsam && grund === "erst" && !sitzung.langsamSchon[id]) {
    const abstand = langsamAbstandFuer(stapelMs, w);
    return { sitzung: { ...sitzung, verlauf, langsamSchon: { ...sitzung.langsamSchon, [id]: true },
      folge: einschieben(sitzung.folge, stelle, { id, grund: "langsam" }, abstand) },
    ergebnis: { art: "langsam", abstand } };
  }

  return { sitzung: { ...sitzung, verlauf }, ergebnis: { art: "fertig" } };
}

/**
 * Was am Ende der Sitzung gezeigt wird: Fehler, Problemkarten, und die
 * mittlere Erinnerungszeit je Stapel (nur richtige Antworten).
 * `stapelVonKarte`: id → Stapelkennung.
 */
export function zusammenfassung(sitzung, stapelVonKarte = () => null) {
  const fehler = sitzung.verlauf.filter((v) => !v.richtig).length;
  const zeiten = new Map();
  for (const v of sitzung.verlauf) {
    if (!v.richtig || !(v.zeit > 0)) continue;
    const s = stapelVonKarte(v.id);
    if (!zeiten.has(s)) zeiten.set(s, []);
    zeiten.get(s).push(v.zeit);
  }
  const mittel = [...zeiten].map(([stapel, z]) => ({
    stapel, ms: Math.round(z.reduce((a, b) => a + b, 0) / z.length), anzahl: z.length,
  }));
  const ersteVersuche = sitzung.verlauf.filter((v) => v.grund === "erst");
  return {
    fehler, problem: sitzung.problem, mittel,
    wiedervorlagen: sitzung.verlauf.filter((v) => v.grund !== "erst").length,
    ersteRichtig: ersteVersuche.filter((v) => v.richtig).length,
    ersteGesamt: ersteVersuche.length,
  };
}
