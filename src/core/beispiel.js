/*
 * Beispielbestand zum Ausprobieren.
 *
 * Legt einen vollständigen, in sich stimmigen Bestand an: Fächer, Ordner,
 * Stapel, alle vier Kartenarten, Bilder, Entwürfe, Erklärungen,
 * Prüfungssimulationen — und, das ist der Kern, eine erfundene Lernhistorie
 * über zwölf Wochen.
 *
 * Warum die Historie mitgerechnet wird und nicht bloß ein paar Zahlen
 * hingeschrieben werden: Strähne, Behaltenskurve, Kalibrierung, Lastprognose
 * und Fälligkeitsplan lesen alle aus denselben Rohdaten. Hingeschriebene
 * Kennzahlen wären untereinander widersprüchlich, und man sähe beim Ausprobieren
 * nicht, ob die Rechnung stimmt. Darum läuft hier der echte Planer über eine
 * erfundene Vergangenheit — Tag für Tag, Karte für Karte, mit denselben
 * Aufrufen, die auch das Abrufen benutzt.
 *
 * Jeder erzeugte Datensatz trägt `beispiel: true`. Daran, und nur daran,
 * erkennt `beispieldatenEntfernen` ihn wieder. Eigene Karten bleiben unberührt.
 */

import * as db from "./db.js";
import * as model from "./model.js";
import { neuerZustand, bewerteKarte, NOTEN, KONFIDENZ } from "./fsrs.js";
import {
  KANT_GRUND, KANT_AESTHETIK, KANT_ANALYTIK, KANT_DIALEKTIK,
  KANT_LUECKEN, KANT_SCHRITTE,
  EUROPA, SUEDAMERIKA, AFRIKA, ASIEN, NORDAMERIKA, VORGEMERKT, FLAGGEN,
} from "./beispiel-stoff.js";

/*
 * Mathematik bleibt hier stehen und wandert nicht in die Stoffdatei: Es sind
 * drei Handvoll Karten, die nur dazu da sind, die Kartenart Mehrschritt auch
 * dort zu zeigen, wo man sie erwartet - beim Rechnen.
 */
const MATHE_SCHRITTE = [
  ["Leite f(x) = (3x² + 1)⁵ ab.", [
    { frage: "Welche Regel greift hier?", antwort: "Die Kettenregel — äußere Ableitung mal innere Ableitung." },
    { frage: "Äußere Ableitung", antwort: "5 · (3x² + 1)⁴" },
    { frage: "Innere Ableitung", antwort: "6x" },
    { frage: "Zusammengesetzt", antwort: "f'(x) = 30x · (3x² + 1)⁴" },
  ]],
  ["Bestimme die Extremstellen von f(x) = x³ − 3x.", [
    { frage: "Erste Ableitung", antwort: "f'(x) = 3x² − 3" },
    { frage: "Notwendige Bedingung", antwort: "3x² − 3 = 0, also x = 1 und x = −1" },
    { frage: "Zweite Ableitung", antwort: "f''(x) = 6x" },
    { frage: "Art der Stellen", antwort: "f''(1) = 6 > 0 → Minimum; f''(−1) = −6 < 0 → Maximum" },
  ]],
  ["Berechne das bestimmte Integral von 2x + 3 zwischen 0 und 1.", [
    { frage: "Stammfunktion", antwort: "F(x) = x² + 3x" },
    { frage: "Obere Grenze einsetzen", antwort: "F(1) = 1 + 3 = 4" },
    { frage: "Untere Grenze einsetzen", antwort: "F(0) = 0" },
    { frage: "Ergebnis", antwort: "4" },
  ]],
  ["Leite f(x) = x² · e^x ab.", [
    { frage: "Welche Regel greift hier?", antwort: "Die Produktregel." },
    { frage: "Die beiden Ableitungen", antwort: "u = x², u' = 2x; v = e^x, v' = e^x" },
    { frage: "Einsetzen", antwort: "f'(x) = 2x · e^x + x² · e^x" },
    { frage: "Ausklammern", antwort: "f'(x) = e^x · (x² + 2x)" },
  ]],
  ["Untersuche f(x) = x⁴ − 4x² auf Symmetrie und Nullstellen.", [
    { frage: "Symmetrie", antwort: "Nur gerade Exponenten → achsensymmetrisch zur y-Achse." },
    { frage: "Ansatz für die Nullstellen", antwort: "x²·(x² − 4) = 0" },
    { frage: "Nullstellen", antwort: "x = 0 (doppelt), x = 2 und x = −2" },
  ]],
];

const MATHE_LUECKEN = [
  ["Die Ableitung von sin(x) ist {{cos(x)}}, die von cos(x) ist {{−sin(x)}}.", "Grundableitungen, auswendig."],
  ["Die Kettenregel lautet: die Ableitung von u(v(x)) ist {{u'(v(x)) · v'(x)}}.", "Äußere mal innere Ableitung."],
  ["Notwendig für eine Extremstelle ist {{f'(x) = 0}}, hinreichend ein {{Vorzeichenwechsel}} von f'.", "Die zweite Ableitung ist der bequemere, aber nicht der allgemeinere Weg."],
];

const MATHE_FREI = [
  ["Produktregel", "(u · v)' = u' · v + u · v'"],
  ["Quotientenregel", "(u / v)' = (u' · v − u · v') / v²"],
  ["Hauptsatz der Differential- und Integralrechnung", "Ist F eine Stammfunktion von f, so ist das bestimmte Integral von a bis b gleich F(b) − F(a)."],
  ["Wendestelle — notwendig und hinreichend", "Notwendig: die zweite Ableitung ist null. Hinreichend: die dritte ist es nicht, oder die zweite wechselt das Vorzeichen."],
];

/**
 * Eine Flagge als Blob.
 *
 * Wird im Browser erzeugt und abgelegt wie ein hochgeladenes Bild auch — der
 * einzige Weg, Bildkarten ohne Dateiauswahl zu prüfen.
 */
function flaggenBlob(inhalt) {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 60" width="270" height="180">'
    + '<rect width="90" height="60" fill="#fff"/>' + inhalt
    + '<rect width="90" height="60" fill="none" stroke="#00000022" stroke-width="1"/></svg>';
  return new Blob([svg], { type: "image/svg+xml" });
}

const TAG = 24 * 3600 * 1000;

/** Die Marke, an der Beispieldaten erkannt werden. */
export const MARKE = "beispiel";

/* ===================================================================== */
/*  Zufall mit Gedächtnis                                                */
/* ===================================================================== */

/**
 * Ein kleiner Zufallsgenerator mit festem Startwert (mulberry32).
 *
 * `Math.random` wäre einfacher, aber dann sähe jeder Durchlauf anders aus.
 * Mit festem Startwert bleiben Verlauf, Noten und Termine reproduzierbar — ein
 * Fehler in der Anzeige lässt sich zweimal hintereinander gleich hervorrufen.
 * Die Kennungen selbst sind es nicht: Sie kommen aus `id()` und müssen bei
 * jedem Anlegen neu sein, sonst überschriebe ein zweiter Bestand den ersten.
 */
function zufall(startwert = 20270601) {
  let a = startwert >>> 0;
  return function naechste() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ===================================================================== */
/*  Die erfundene Vergangenheit                                          */
/* ===================================================================== */

/**
 * Spielt für eine Karte und eine Richtung eine Lernhistorie durch.
 *
 * Gerechnet wird mit `bewerteKarte`, also mit demselben Planer wie im Betrieb.
 * Was hier herauskommt, ist deshalb kein geschätzter, sondern ein tatsächlich
 * erreichbarer Zustand.
 *
 * `koennen` ist die Wahrscheinlichkeit, die Karte zu wissen — je Karte fest,
 * damit sich zähe und leichte Karten voneinander unterscheiden.
 */
function historieFuer({ karte, richtung, setId, subjectId, fach, beginn, ende, koennen,
  ueberschaetzt, wuerfel }) {
  const reviews = [];
  let zustand = neuerZustand(karte.id, richtung, setId, subjectId, beginn);
  let zeit = beginn;
  let runden = 0;

  while (zeit <= ende && runden < 60) {
    runden += 1;
    const w = wuerfel();
    const note = w < koennen * 0.3 ? NOTEN.LEICHT
      : w < koennen ? NOTEN.GUT
        : w < koennen + (1 - koennen) * 0.55 ? NOTEN.SCHWER
          : NOTEN.NOCHMAL;

    /* Die Selbsteinschätzung hängt mit der Note zusammen, aber nicht starr —
       sonst wäre die Kalibrierungsseite eine gerade Linie und zeigte nichts.
       Ein Fach ist absichtlich überschätzt: dort wird öfter „sicher" gesagt,
       als es die Trefferquote hergibt. */
    const s = wuerfel();
    let konfidenz;
    if (note >= NOTEN.GUT)
      konfidenz = s < 0.78 ? KONFIDENZ.SICHER
        : s < 0.96 ? KONFIDENZ.UNSICHER
          : KONFIDENZ.KEINE_AHNUNG;   // geraten und getroffen — kommt vor
    else if (ueberschaetzt) konfidenz = s < 0.45 ? KONFIDENZ.SICHER
      : s < 0.85 ? KONFIDENZ.UNSICHER : KONFIDENZ.KEINE_AHNUNG;
    else konfidenz = s < 0.12 ? KONFIDENZ.SICHER
      : s < 0.7 ? KONFIDENZ.UNSICHER : KONFIDENZ.KEINE_AHNUNG;

    // Antwortzeit: gewusste Karten gehen schneller. Nie unter der
    // Plausibilitätsschwelle — sonst würde die App die eigenen Beispieldaten
    // zu Recht als Durchklicken verwerfen.
    const antwortzeit = Math.round(2200 + wuerfel() * (note >= NOTEN.GUT ? 6000 : 13000));

    // Innerhalb des Tages eine Uhrzeit zwischen 15 und 21 Uhr.
    const tagesBeginn = new Date(zeit); tagesBeginn.setHours(15, 0, 0, 0);
    const zeitpunkt = Math.min(ende, Math.max(zeit,
      tagesBeginn.getTime() + Math.round(wuerfel() * 6 * 3600 * 1000)));

    reviews.push({
      ...model.neuesReview({
        cardId: karte.id, richtung, setId, subjectId,
        bewertung: note, antwortzeit, konfidenz, flag: "normal",
        modus: "abrufen", zeit: zeitpunkt,
      }),
      // Ohne diese Marke bliebe die Historie beim Entfernen liegen und
      // fütterte Strähne, Kalibrierung und Behaltenskurve weiter mit
      // Antworten auf Karten, die es nicht mehr gibt.
      [MARKE]: true,
    });

    zustand = bewerteKarte(zustand, note, {
      zielRetention: fach.zielRetention, maximalTage: fach.maximalTage,
      zeit: zeitpunkt,
    });

    const naechste = zustand.due;
    if (!naechste || naechste <= zeitpunkt) break;
    zeit = naechste;
  }

  // Kein Zustand ohne Review — sonst stünde eine Karte als „gelernt" da,
  // ohne dass je etwas geschehen wäre.
  if (!reviews.length) return null;
  return { zustand: { ...zustand, [MARKE]: true }, reviews };
}

/* ===================================================================== */
/*  Anlegen                                                              */
/* ===================================================================== */

const mitMarke = (rec) => ({ ...rec, [MARKE]: true });

/**
 * Karten, die im Beispielverlauf immer wieder danebengehen.
 *
 * Sie erreichen dadurch die Leech-Schwelle und werden von der App
 * stillgelegt. Das ist Absicht: Die Sperre ist eine der nützlichsten
 * Vorrichtungen des Systems — sie sagt, dass eine Karte zu groß geschnitten
 * ist — und wäre sonst am Beispielbestand nie zu sehen.
 */
const ZAEH = new Set([
  "Benin", "Eswatini", "Elfenbeinküste", "Äquatorialguinea",
  "Amphibolie der Reflexionsbegriffe", "quid facti und quid juris",
]);

/**
 * Baut den ganzen Beispielbestand — ohne ihn zu schreiben.
 *
 * Getrennt vom Schreiben, damit sich das Ergebnis ohne Browser prüfen lässt.
 * Genau daran fehlte es zuerst: Die Reviews trugen die Marke nicht, und beim
 * Entfernen blieben tausend Antworten auf Karten liegen, die es nicht mehr
 * gab. Eine Prüfung hätte das in einer Sekunde gezeigt.
 */
export function baueBeispieldaten({ jetzt = Date.now() } = {}) {
  const wuerfel = zufall();
  const stapelListe = [];
  const kartenListe = [];
  const bilder = [];

  /* ------------------------------ Fächer ------------------------------- */
  /* Der Termin liegt in vier Tagen. Damit steht dieses Fach im Endspurt: Die
     App bietet dann die Cram-Warteschlange an — alles quer durch, ohne
     Rücksicht auf Termine, ohne Wirkung auf den Lernstand. Ohne einen nahen
     Termin bekäme man diesen Modus nie zu Gesicht. */
  const philosophie = mitMarke({
    ...model.neuesFach("Philosophie", "#8b6bb1"),
    zielRetention: 0.9, neuProTag: 8,
    pruefungsdatum: jetzt + 4 * TAG,
  });
  const geographie = mitMarke({
    ...model.neuesFach("Geographie", "#3a8f5f"),
    zielRetention: 0.88, neuProTag: 20, richtungen: ["td", "dt"],
  });
  const mathe = mitMarke({
    ...model.neuesFach("Mathematik", "#c2643a"),
    zielRetention: 0.92, neuProTag: 12,
    // Ein Termin in sechs Wochen: daran lässt sich die Verdichtung vor der
    // Prüfung ansehen, ohne auf sie warten zu müssen.
    pruefungsdatum: jetzt + 42 * TAG,
  });
  const faecher = [philosophie, geographie, mathe];

  /* ------------------------------ Ordner ------------------------------- */
  const wurzel = mitMarke(model.neuerOrdner("Beispiele"));
  const oPhil = mitMarke(model.neuerOrdner("Philosophie", wurzel.id));
  const oKant = mitMarke(model.neuerOrdner("Kant — Kritik der reinen Vernunft", oPhil.id));
  const oGeo = mitMarke(model.neuerOrdner("Erdkunde", wurzel.id));
  const oMathe = mitMarke(model.neuerOrdner("Mathematik", wurzel.id));
  const ordner = [wurzel, oPhil, oKant, oGeo, oMathe];

  /** Legt einen Stapel an und merkt ihn vor. */
  const neuerStapel = (titel, ordnerId, fach, zusatz = {}) => {
    const s = mitMarke({
      ...model.neuerStapel(titel, ordnerId),
      subjectId: fach.id,
      ...zusatz,
    });
    stapelListe.push(s);
    return s;
  };

  /** Legt eine Karte an und merkt sie vor. */
  const neueKarte = (stapel, felder) => {
    const k = mitMarke({
      ...model.neueKarte(stapel.id, felder.term || "", felder.definition || "",
        kartenListe.filter((x) => x.setId === stapel.id).length),
      ...felder,
    });
    kartenListe.push(k);
    return k;
  };

  /* ------------------------------- Kant --------------------------------- */
  /*
   * Vier Stapel statt eines einzigen, den Abschnitten der Kritik nach. Das ist
   * keine Ordnungsliebe: Die Warteschlange mischt innerhalb eines Fachs
   * ohnehin, aber ein Stapel ist die Einheit, in der man übt, sucht und einen
   * Test schreibt. Wer die Dialektik nachholen will, will nicht die Ästhetik
   * mitgeliefert bekommen.
   */
  const kantStapel = [
    ["Grundbegriffe", "Die Begriffe, ohne die kein Satz der Kritik verständlich wird.", KANT_GRUND],
    ["Transzendentale Ästhetik", "Raum und Zeit als Formen der Anschauung — der erste Hauptteil.", KANT_AESTHETIK],
    ["Transzendentale Analytik", "Kategorien, Deduktion, Schematismus, Grundsätze.", KANT_ANALYTIK],
    ["Transzendentale Dialektik", "Schein, Ideen, Paralogismen, Antinomien, Gottesbeweise.", KANT_DIALEKTIK],
  ].map(([name, beschreibung, stoff]) => {
    const st = neuerStapel("KrV — " + name, oKant.id, philosophie, {
      description: beschreibung,
      termLabel: "Begriff", defLabel: "Bedeutung",
    });
    for (const [begriff, erklaerung] of stoff)
      neueKarte(st, {
        term: begriff, definition: erklaerung,
        quelle: "Kritik der reinen Vernunft",
      });
    return st;
  });
  const sKant = kantStapel[0];

  /* Zitate und Argumentgänge in einen eigenen Stapel: Sie gehören zu allen
     Abschnitten und wären in jedem einzelnen falsch aufgehoben. */
  const sKantZitate = neuerStapel("KrV — Zitate und Argumentgänge", oKant.id, philosophie, {
    description: "Die Sätze, die man wörtlich können sollte, und die Gedankengänge Schritt für Schritt.",
    termLabel: "Stelle", defLabel: "Nachweis",
  });
  for (const [text, anmerkung] of KANT_LUECKEN)
    neueKarte(sKantZitate, { term: text, definition: anmerkung, art: "cloze" });
  for (const [frage, schritte] of KANT_SCHRITTE)
    neueKarte(sKantZitate, {
      term: frage, definition: "", art: "mehrschritt", schritte,
    });

  /* --------------------------- Hauptstädte ------------------------------ */
  /*
   * Fünf Stapel nach Erdteilen. Afrika ist mit vierundfünfzig Staaten der
   * größte — und darum der eigentliche Prüfstein: An ihm zeigt sich, ob
   * Zuordnen, Meteor und die Warteschlange auch dann noch brauchbar sind,
   * wenn ein Stapel nicht mehr an einem Abend durchzugehen ist.
   */
  const geoStapel = [
    ["Hauptstädte Europas", "Achtunddreißig Staaten. Die strittigen Fälle stehen im Hinweisfeld.", EUROPA],
    ["Hauptstädte Südamerikas", "Zwölf Staaten — überschaubar genug für einen Abend.", SUEDAMERIKA],
    ["Hauptstädte Afrikas", "Alle vierundfünfzig Staaten der Afrikanischen Union. Der größte Stapel des Bestands.", AFRIKA],
    ["Hauptstädte Asiens und Ozeaniens", "Von der Türkei bis Fidschi.", ASIEN],
    ["Hauptstädte Nord- und Mittelamerikas", "Festland und Inseln.", NORDAMERIKA],
  ].map(([name, beschreibung, stoff]) => {
    const st = neuerStapel(name, oGeo.id, geographie, {
      description: beschreibung,
      termLabel: "Land", defLabel: "Hauptstadt",
      richtungen: ["td", "dt"],
    });
    for (const [land, stadt, anmerkung] of stoff)
      neueKarte(st, {
        term: land, definition: stadt, hint: anmerkung || "",
        starred: VORGEMERKT.has(land),
      });
    return st;
  });
  const sAfrika = geoStapel[2];

  /* ----------------------------- Flaggen -------------------------------- */
  const sFlaggen = neuerStapel("Flaggen erkennen", oGeo.id, geographie, {
    description: "Bildkarten: Die Frage ist das Bild.",
    termLabel: "Flagge", defLabel: "Land und Hauptstadt",
  });
  for (const [land, stadt, svg] of FLAGGEN) {
    const kennung = model.id("b");
    bilder.push({ id: kennung, blob: flaggenBlob(svg), type: "image/svg+xml",
      breite: 270, hoehe: 180, updatedAt: jetzt, [MARKE]: true });
    neueKarte(sFlaggen, {
      term: "", definition: land + " — " + stadt,
      termImage: kennung, art: "bild",
    });
  }

  /* ----------------------------- Papierkorb ----------------------------- */
  /*
   * Auch der Papierkorb soll etwas enthalten. Gelöschtes bleibt vierzehn Tage
   * als Grabstein liegen und lässt sich zurückholen — das kann man nur
   * ausprobieren, wenn etwas darin liegt. Die Grabsteine bekommen keinen
   * Lernstand: Sie sind gelöscht, nicht bloß verborgen.
   */
  const verworfen = neuerStapel("Hauptstädte Ozeaniens", oGeo.id, geographie, {
    description: "Versehentlich gelöscht — liegt im Papierkorb und lässt sich zurückholen.",
    termLabel: "Land", defLabel: "Hauptstadt",
    deleted: true, updatedAt: jetzt - 2 * TAG,
  });
  for (const [land, stadt] of [["Samoa", "Apia"], ["Tonga", "Nukuʻalofa"],
    ["Vanuatu", "Port Vila"], ["Salomonen", "Honiara"]])
    neueKarte(verworfen, {
      term: land, definition: stadt,
      deleted: true, updatedAt: jetzt - 2 * TAG,
    });

  // Dazu zwei einzeln verworfene Karten aus einem lebenden Stapel.
  for (const [land, stadt] of [["Westsahara", "El Aaiún"], ["Somaliland", "Hargeysa"]])
    neueKarte(sAfrika, {
      term: land, definition: stadt,
      hint: "Kein Mitglied der Afrikanischen Union in eigenem Recht — darum verworfen.",
      deleted: true, updatedAt: jetzt - 5 * TAG,
    });

  /* ----------------------------- Mathematik ----------------------------- */
  const sMathe = neuerStapel("Analysis — Ableiten und Integrieren", oMathe.id, mathe, {
    description: "Rechenwege in Schritten, dazu die Regeln als Lückentext.",
    termLabel: "Aufgabe", defLabel: "Weg",
  });
  for (const [aufgabe, schritte] of MATHE_SCHRITTE)
    neueKarte(sMathe, { term: aufgabe, definition: "", art: "mehrschritt", schritte });
  for (const [text, anmerkung] of MATHE_LUECKEN)
    neueKarte(sMathe, { term: text, definition: anmerkung, art: "cloze" });
  for (const [frage, antwort] of MATHE_FREI)
    neueKarte(sMathe, { term: frage, definition: antwort });

  /* ========================== Die Vergangenheit ========================= */

  const zustaende = [];
  const reviews = [];
  /* Welches Fach zu welchem Stapel gehört — aus den Stapeln selbst gelesen,
     damit ein neuer Stapel nicht vergessen werden kann. */
  const fachNachId = Object.fromEntries(faecher.map((f) => [f.id, f]));
  const fachNach = Object.fromEntries(
    stapelListe.map((st) => [st.id, fachNachId[st.subjectId]]));
  const stapelNach = Object.fromEntries(
    stapelListe.filter((st) => !st.deleted).map((st) => [st.id, st]));

  for (const karte of kartenListe) {
    // Verworfenes bekommt keinen Lernstand — es ist gelöscht, nicht verborgen.
    if (karte.deleted) continue;
    const stapel = stapelNach[karte.setId];
    const fach = fachNach[karte.setId];
    if (!stapel || !fach) continue;

    // Ein Sechstel bleibt unangetastet: In jedem Fach soll auch Neues warten.
    if (wuerfel() < 0.17) continue;

    /* Ein paar Karten sind ausdrücklich zäh angelegt. Nach sechsmal „Nochmal"
       legt die App eine Karte still — die Sperre und das Entsperren lassen
       sich sonst nicht ansehen, weil man dafür wochenlang scheitern müsste. */
    const koennen = ZAEH.has(karte.term) ? 0.12 : 0.66 + wuerfel() * 0.3;
    // Wie weit die Karte zurückliegt — verteilt über zwölf Wochen.
    const beginn = jetzt - Math.round((10 + wuerfel() * 74) * TAG);
    /* Vier von zehn Karten wurden zuletzt vor einigen Tagen gesehen. Dadurch
       ist heute etwas fällig — sonst stünde die Warteschlange leer da und man
       könnte den Abrufmodus gar nicht ausprobieren. */
    const ende = wuerfel() < 0.42 ? jetzt - Math.round((1 + wuerfel() * 11) * TAG) : jetzt;

    for (const richtung of model.richtungenFuer(karte, stapel)) {
      const ergebnis = historieFuer({
        karte, richtung, setId: karte.setId, subjectId: fach.id, fach,
        beginn, ende, koennen,
        ueberschaetzt: fach.id === mathe.id,
        wuerfel,
      });
      if (!ergebnis) continue;
      zustaende.push(ergebnis.zustand);
      reviews.push(...ergebnis.reviews);
    }
  }

  /* ---------------------- Übung auffüllen, Strähne ---------------------- */
  /*
   * Die Strähne verlangt ein Tagespensum. Das Abrufen allein erreicht es an
   * vielen Tagen nicht — im Betrieb kommt die Übung dazu. Also wird sie hier
   * ebenfalls erzeugt: als `practice`, das heißt ohne jede Wirkung auf Termine
   * und Kennzahlen. Zwei Lücken bleiben absichtlich stehen, damit sich die
   * Ruhetagsregel ansehen lässt.
   */
  const sitzungen = [];
  const uebbar = kartenListe.filter((k) =>
    !k.deleted && model.kartenArt(k) !== "cloze");
  const proTag = new Map();
  for (const r of reviews) {
    const tag = new Date(r.zeit); tag.setHours(0, 0, 0, 0);
    const s = tag.getTime();
    proTag.set(s, (proTag.get(s) || 0) + 1);
  }

  const MODI = ["lernen", "schreiben", "zuordnen", "karten", "meteor", "test",
    "buchstabieren"];
  /* Das Tagespensum der Strähne. Steht auch in straehne.js; hier noch einmal,
     damit der Bestand nicht von einer Einstellung abhängt, die der Nutzer
     später verstellen kann. */
  const PENSUM = 15;
  const heute = new Date(jetzt); heute.setHours(0, 0, 0, 0);
  const lueckenTage = new Set([9, 23]);      // zwei Ruhetage

  for (let vor = 0; vor < 60; vor++) {
    if (lueckenTage.has(vor)) continue;
    const tag = heute.getTime() - vor * TAG;
    const vorhanden = proTag.get(tag) || 0;

    /*
     * Zwei Gründe, an einem Tag zu üben, und sie sind verschieden:
     *
     * Der eine ist Neigung — an gut der Hälfte der Tage wird zusätzlich geübt,
     * gleichgültig ob das Abrufen schon genug hergab. Ohne das stünde in
     * „Zuletzt gelernt" und unter „Nur geübt" nichts.
     *
     * Der andere ist das Pensum: An einem Tag, den die Strähne zählen soll,
     * müssen genug Karten zusammenkommen. Diese Bedingung ausdrücklich
     * hinzuschreiben ist besser, als sie aus dem Auffüllen hervorgehen zu
     * lassen — beim ersten Anlauf hing die Strähne unbemerkt daran, wie viele
     * Karten der Bestand gerade hatte, und fiel von achtundfünfzig auf drei
     * Tage, als er wuchs.
     */
    const geuebt = wuerfel() < 0.55;
    const untermPensum = vorhanden < PENSUM + 2;
    if (!geuebt && !untermPensum) continue;

    const ziel = Math.max(PENSUM + 3,
      vorhanden + (geuebt ? 12 + Math.round(wuerfel() * 14) : 0));
    const fehlen = Math.max(0, ziel - vorhanden);
    if (fehlen <= 0) continue;

    const modus = MODI[Math.floor(wuerfel() * MODI.length)];
    const lebende = stapelListe.filter((st) => !st.deleted);
    const stapelWahl = lebende[Math.floor(wuerfel() * lebende.length)];
    const auswahl = uebbar.filter((k) => k.setId === stapelWahl.id);
    if (!auswahl.length) continue;

    /* Die Uhrzeit muss beim heutigen Tag an der jetzigen enden. Vorher lag
       die Übung fest zwischen sechzehn und einundzwanzig Uhr — wer den
       Bestand am Vormittag anlegte, bekam Antworten aus der Zukunft, und die
       Behaltenskurve rechnete mit negativen Abständen. */
    const frueh = tag + 8 * 3600 * 1000;
    const spaet = Math.min(jetzt, tag + 21 * 3600 * 1000);
    const spanne = Math.max(60000, spaet - frueh);
    const wann = () => frueh + Math.round(wuerfel() * spanne);

    let richtig = 0;
    for (let i = 0; i < fehlen; i++) {
      const karte = auswahl[Math.floor(wuerfel() * auswahl.length)];
      const gewusst = wuerfel() < 0.76;
      if (gewusst) richtig += 1;
      reviews.push(mitMarke(model.neuesReview({
        cardId: karte.id, richtung: "td", setId: karte.setId,
        subjectId: fachNach[karte.setId].id,
        bewertung: gewusst ? NOTEN.GUT : NOTEN.NOCHMAL,
        antwortzeit: Math.round(2000 + wuerfel() * 7000),
        konfidenz: null, flag: "practice", modus,
        zeit: wann(),
      })));
    }
    sitzungen.push(mitMarke({
      id: model.id("z"), setId: stapelWahl.id, modus,
      zeit: spaet,
      tag: new Date(tag).toISOString().slice(0, 10),
      gesamt: fehlen, richtig, dauer: fehlen * 9000,
      ...(modus === "meteor" ? { punkte: richtig * 12 } : {}),
    }));
  }

  /* ------------------------------ Entwürfe ------------------------------ */
  /*
   * Entwürfe sind Karten ohne Rückseite. Der Vorschlag bleibt verborgen, bis
   * der Nutzer seine eigene Fassung geschrieben hat — wer ihn sich vorher
   * zeigen lässt, kann das, es wird nur vermerkt. Ohne diesen Umweg wäre der
   * Generator eine Maschine, die Stapel füllt und nichts lernt.
   */
  const entwuerfe = [
    [sKant, "Ideal der reinen Vernunft",
      "Kritik der reinen Vernunft, Transzendentale Dialektik",
      "Der Begriff eines durchgängig bestimmten einzelnen Wesens, gedacht aus der bloßen Idee — bei Kant die Wurzel der Gottesbeweise, die er anschließend verwirft."],
    [sKant, "regulativer Gebrauch der Ideen",
      "Kritik der reinen Vernunft, Anhang zur Dialektik",
      "Ideen leiten die Forschung als Aufgabe, ohne einen Gegenstand zu bezeichnen. Der konstitutive Gebrauch wäre der Fehler."],
    [sKant, "Postulate des empirischen Denkens",
      "Kritik der reinen Vernunft, Analytik der Grundsätze",
      "Die Grundsätze zur Modalität: möglich, wirklich, notwendig — jeweils in Bezug auf die Bedingungen der Erfahrung, nie auf das Ding selbst."],
    [sKant, "Architektonik der reinen Vernunft",
      "Kritik der reinen Vernunft, Methodenlehre",
      "Die Kunst der Systeme: Erkenntnis wird erst durch die Idee des Ganzen zur Wissenschaft, nicht durch Anhäufung."],
    [sAfrika, "Sahelzone",
      "Erdkunde, Klimazonen",
      "Der Übergangsgürtel zwischen Sahara und Feuchtsavanne — von Mauretanien bis in den Sudan."],
    [sAfrika, "Afrikanische Union",
      "Erdkunde, Staatenbünde",
      "Zusammenschluss von 55 Mitgliedern mit Sitz in Addis Abeba, 2002 aus der Organisation für Afrikanische Einheit hervorgegangen."],
  ].map(([stapel, term, quelle, vorschlag], i) => mitMarke({
    ...model.neuerEntwurf({
      setId: stapel.id, term, quelle, vorschlag, herkunft: "ki_vorderseite",
    }),
    createdAt: jetzt - (6 - i) * 3600 * 1000,
  }));

  /* ----------------------------- Erklärungen ---------------------------- */
  const erklaerungen = [
    mitMarke({
      ...model.neueErklaerung({
        thema: "Warum Kant synthetische Urteile a priori braucht",
        subjectId: philosophie.id, setId: sKant.id,
      }),
      fassungen: [
        { text: "Kant will zeigen, dass Mathematik und Naturwissenschaft sicher sind. Analytische Urteile sind sicher, sagen aber nichts Neues. Erfahrungsurteile sagen etwas Neues, sind aber nicht sicher. Also braucht er eine dritte Art.",
          zeit: jetzt - 9 * TAG, lueckenZahl: 3 },
        { text: "Kant sucht nach Urteilen, die zugleich notwendig gelten und die Erkenntnis erweitern. Analytische Urteile gelten notwendig, weil das Prädikat schon im Subjektbegriff steckt — sie erweitern nichts. Urteile aus Erfahrung erweitern, gelten aber nur so weit, wie die Erfahrung reicht, und nie mit Notwendigkeit. Sätze wie „7 + 5 = 12“ oder „jede Veränderung hat eine Ursache“ sind aber beides zugleich. Wie das möglich ist, ist die Leitfrage der Kritik; die Antwort liegt darin, dass Raum, Zeit und die Kategorien Bedingungen jeder möglichen Erfahrung sind und darum von jedem Gegenstand der Erfahrung im Voraus gelten.",
          zeit: jetzt - 2 * TAG, lueckenZahl: 2 },
      ],
      offeneLuecken: [
        { art: "luecke", stelle: "Bedingungen jeder möglichen Erfahrung",
          frage: "Woher weißt du, dass es die Bedingungen der Erfahrung sind und nicht bloß Gewohnheiten des Denkens? Was ist Kants Argument an dieser Stelle?" },
        { art: "ungenau", stelle: "7 + 5 = 12",
          frage: "Warum ist dieses Urteil nach Kant nicht analytisch? Der Begriff der Summe von 7 und 5 enthält doch die 12 — wie begründet Kant das Gegenteil?" },
      ],
      runden: 2,
      createdAt: jetzt - 9 * TAG,
    }),
    mitMarke({
      ...model.neueErklaerung({
        thema: "Was die Kettenregel anschaulich bedeutet",
        subjectId: mathe.id, setId: sMathe.id,
      }),
      fassungen: [
        { text: "Wenn eine Größe von einer zweiten abhängt und die zweite von einer dritten, dann multiplizieren sich die Änderungsraten. Fährt ein Auto doppelt so schnell wie ein anderes und verbraucht bei jeder Geschwindigkeit dreimal so viel, ändert sich der Verbrauch sechsmal so schnell. Genau das steht in der Kettenregel: die äußere Ableitung an der Stelle der inneren Funktion, mal der inneren Ableitung.",
          zeit: jetzt - 16 * TAG, lueckenZahl: 0 },
      ],
      offeneLuecken: [],
      runden: 1, erledigt: true,
      createdAt: jetzt - 16 * TAG,
    }),
  ];

  /* ---------------------------- Prüfungen ------------------------------- */
  const pruefungen = [
    mitMarke({
      ...model.neuePruefung({
        subjectId: mathe.id,
        titel: "Analysis — Kurvendiskussion",
        aufgabe: "Gegeben ist f(x) = x³ − 6x² + 9x.\n\n"
          + "a) Bestimmen Sie die Nullstellen von f.\n"
          + "b) Berechnen Sie die Extrempunkte und weisen Sie ihre Art nach.\n"
          + "c) Bestimmen Sie den Wendepunkt.\n"
          + "d) Skizzieren Sie den Graphen und beschreiben Sie das Verhalten für "
          + "x gegen plus und minus unendlich.",
        kriterien: [
          "Nullstellen vollständig: x = 0 und x = 3 (doppelt)",
          "Erste Ableitung korrekt gebildet: f'(x) = 3x² − 12x + 9",
          "Beide Extremstellen bestimmt: x = 1 und x = 3",
          "Art der Extrema über die zweite Ableitung nachgewiesen",
          "Wendepunkt bei x = 2 mit Funktionswert berechnet",
          "Verhalten im Unendlichen beschrieben und begründet",
          "Skizze mit beschrifteten Achsen und eingetragenen Punkten",
        ],
        minuten: 45,
        hilfsmittelfrei: true,
      }),
      zeit: jetzt,
    }),
    mitMarke({
      ...model.neuePruefung({
        subjectId: philosophie.id,
        titel: "Kant — Erörterung der kopernikanischen Wende",
        aufgabe: "Erläutern Sie, was Kant unter der kopernikanischen Wende "
          + "versteht, und erörtern Sie, welchen Preis diese Wende für den "
          + "Erkenntnisanspruch der Metaphysik hat.",
        kriterien: [
          "Umkehrung des Verhältnisses von Erkenntnis und Gegenstand benannt",
          "Bezug auf die Frage nach synthetischen Urteilen a priori",
          "Unterscheidung von Erscheinung und Ding an sich erläutert",
          "Der Preis benannt: keine Erkenntnis des Übersinnlichen",
          "Eigene Stellungnahme mit Begründung",
        ],
        minuten: 60,
      }),
      text: "Kant kehrt das gewohnte Verhältnis um. Bisher galt: unsere Erkenntnis muss sich nach den Gegenständen richten, und ob sie das trifft, bleibt ungewiss. Kant versucht das Gegenteil: die Gegenstände, sofern wir sie erfahren, richten sich nach den Bedingungen unserer Erkenntnis. Raum und Zeit sind dann keine Eigenschaften der Dinge, sondern Formen unserer Anschauung, und die Kategorien sind keine Funde in der Welt, sondern Regeln des Verstandes.\n\nDaraus folgt, dass allgemeine und notwendige Sätze über Gegenstände der Erfahrung möglich sind, ohne aus der Erfahrung zu stammen. Der Preis ist hoch: Erkenntnis reicht genau so weit wie mögliche Erfahrung. Über das Ding an sich, über Gott, Freiheit und Unsterblichkeit lässt sich nichts wissen.\n\nIch halte den Preis für angemessen, weil die Metaphysik vorher Behauptungen aufstellte, gegen die sich mit gleichem Recht das Gegenteil behaupten ließ.",
      begonnen: jetzt - 6 * TAG,
      abgegeben: jetzt - 6 * TAG + 52 * 60000,
      gebrauchteZeit: 52 * 60000,
      ergebnis: [
        { kriterium: "Umkehrung des Verhältnisses von Erkenntnis und Gegenstand benannt",
          stand: "ja", stelle: "die Gegenstände, sofern wir sie erfahren, richten sich nach den Bedingungen unserer Erkenntnis" },
        { kriterium: "Bezug auf die Frage nach synthetischen Urteilen a priori",
          stand: "unklar", stelle: "allgemeine und notwendige Sätze über Gegenstände der Erfahrung" },
        { kriterium: "Unterscheidung von Erscheinung und Ding an sich erläutert",
          stand: "unklar", stelle: "Über das Ding an sich … lässt sich nichts wissen" },
        { kriterium: "Der Preis benannt: keine Erkenntnis des Übersinnlichen",
          stand: "ja", stelle: "Erkenntnis reicht genau so weit wie mögliche Erfahrung" },
        { kriterium: "Eigene Stellungnahme mit Begründung",
          stand: "ja", stelle: "Ich halte den Preis für angemessen, weil" },
      ],
      selbstpruefung: { 2: "nein" },
      zeit: jetzt - 6 * TAG,
    }),
  ];

  /* ---------------------------- KI-Protokoll ---------------------------- */
  const tagText = (ms) => new Date(ms).toISOString().slice(0, 10);
  const kilog = [
    { id: model.id("p"), zeit: jetzt - 2 * TAG, tag: tagText(jetzt - 2 * TAG),
      zweck: "Lücken in einer Erklärung", prompt: "feynman (Fassung 1)",
      modell: "lokal (LM Studio)", zeichenHin: 1180, zeichenZurueck: 460,
      [MARKE]: true },
    { id: model.id("p"), zeit: jetzt - 5 * TAG, tag: tagText(jetzt - 5 * TAG),
      zweck: "Kartenvorschläge aus einem Text", prompt: "kartengenerator (Fassung 1)",
      modell: "lokal (LM Studio)", zeichenHin: 2960, zeichenZurueck: 1240,
      [MARKE]: true },
    { id: model.id("p"), zeit: jetzt - 6 * TAG, tag: tagText(jetzt - 6 * TAG),
      zweck: "Abgleich mit dem Erwartungshorizont", prompt: "kriterien (Fassung 1)",
      modell: "lokal (LM Studio)", zeichenHin: 2140, zeichenZurueck: 720,
      [MARKE]: true },
  ];

  return {
    subjects: faecher, folders: ordner, sets: stapelListe, cards: kartenListe,
    media: bilder, cardstates: zustaende, reviews, sessions: sitzungen,
    drafts: entwuerfe, explanations: erklaerungen, exams: pruefungen, kilog,
  };
}

/**
 * Legt den Beispielbestand an.
 * → Zusammenfassung dessen, was geschrieben wurde.
 */
export async function beispieldatenAnlegen({ jetzt = Date.now() } = {}) {
  const bestand = baueBeispieldaten({ jetzt });
  for (const [ablage, saetze] of Object.entries(bestand))
    await db.putMany(ablage, saetze);

  return {
    faecher: bestand.subjects.length, ordner: bestand.folders.length,
    stapel: bestand.sets.length, karten: bestand.cards.length,
    bilder: bestand.media.length, zustaende: bestand.cardstates.length,
    reviews: bestand.reviews.length, sitzungen: bestand.sessions.length,
    entwuerfe: bestand.drafts.length, erklaerungen: bestand.explanations.length,
    pruefungen: bestand.exams.length,
  };
}

/* ===================================================================== */
/*  Entfernen                                                            */
/* ===================================================================== */

/** Ablagen, in denen Beispieldaten liegen können. */
const ABLAGEN = ["subjects", "folders", "sets", "cards", "media", "cardstates",
  "reviews", "sessions", "drafts", "explanations", "exams", "kilog", "progress"];

/**
 * Entfernt alles Angelegte wieder — endgültig, ohne Grabstein.
 *
 * Ohne Grabstein deshalb, weil Beispieldaten nie in der Wolke sein sollten und
 * ein Grabstein sie nur unnötig durch jeden Abgleich schleifen würde. `trocken`
 * zählt bloß, ohne zu löschen.
 */
export async function beispieldatenEntfernen({ trocken = false } = {}) {
  let anzahl = 0;
  const jeAblage = {};
  const zeit = Date.now();

  for (const ablage of ABLAGEN) {
    const alle = await db.all(ablage, { mitGeloeschten: true });
    // Was schon einen Grabstein hat, ist weg — es noch einmal zu zaehlen
    // ergaebe die Meldung, es sei etwas entfernt worden, wo nichts mehr war.
    const treffer = alle.filter((r) => r && r[MARKE] === true && !r.deleted);
    jeAblage[ablage] = treffer.length;
    anzahl += treffer.length;
    if (trocken) continue;

    /*
     * Abzugleichende Ablagen bekommen einen Grabstein statt einer Loeschung.
     *
     * Der Grund ist derselbe wie ueberall sonst in dieser App: Wer auf einem
     * Geraet ersatzlos loescht, hat es beim naechsten Abgleich wieder da —
     * das andere Geraet kennt die Zeile ja noch und schickt sie zurueck. Beim
     * Beispielbestand faellt das besonders auf, weil es dreitausend Zeilen
     * sind und niemand versteht, warum sie wiederkommen.
     *
     * Was nicht abgeglichen wird — Bilder, das Protokoll, Sitzungen —, kann
     * ersatzlos weg. Die Grabsteine selbst raeumt `pruneTombstones` nach
     * sechzig Tagen fort.
     */
    const abgeglichen = db.SYNCED.includes(ablage);
    for (const rec of treffer) {
      if (abgeglichen)
        await db.put(ablage, { ...rec, deleted: true, updatedAt: zeit });
      else
        await db.remove(ablage, rec.id ?? rec.key);
    }
  }
  return { anzahl, jeAblage };
}

/** Liegt schon ein Beispielbestand vor? */
export async function beispieldatenVorhanden() {
  // Ohne `mitGeloeschten` — ein Grabstein ist kein vorhandener Bestand.
  const stapel = await db.all("sets");
  return stapel.some((s) => s[MARKE] === true);
}
