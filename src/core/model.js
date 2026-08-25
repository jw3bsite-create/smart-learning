/*
 * Datenmodell.
 *
 * Ordner  → beliebig tief geschachtelt (parentId)
 * Stapel  → gehört in höchstens einen Ordner, enthält Karten
 * Karte   → Vorderseite (term) und Rückseite (definition), je mit Bild
 * Stand   → Lernstand je Karte, getrennt nach Abfragerichtung
 */

/** Kennungen: Zeitanteil vorn, damit sie grob nach Alter sortieren. */
export function id(praefix = "k") {
  return praefix + "_" + Date.now().toString(36) + "_" +
    Math.random().toString(36).slice(2, 8);
}

export const jetzt = () => Date.now();

export function neuerOrdner(name, parentId = null) {
  return { id: id("o"), name, parentId, color: null, updatedAt: jetzt(), deleted: false };
}

export function neuerStapel(title, folderId = null) {
  return {
    id: id("s"), title, description: "", folderId,
    termLang: "de", defLang: "de",          // Sprachen für das Vorlesen
    termLabel: "Begriff", defLabel: "Erklärung",
    updatedAt: jetzt(), deleted: false, createdAt: jetzt(),
  };
}

export function neueKarte(setId, term = "", definition = "", order = 0) {
  return {
    id: id("k"), setId, term, definition, hint: "",
    termImage: null, defImage: null,        // Kennung eines Bildes in der Ablage `media`
    starred: false, order,
    updatedAt: jetzt(), deleted: false,
  };
}

/** Frischer Lernstand. `td` = Begriff → Erklärung, `dt` = Erklärung → Begriff. */
export function neuerStand(cardId, setId) {
  return {
    id: cardId, cardId, setId,
    td: neueRichtung(), dt: neueRichtung(),
    seen: 0, lastSeen: 0,
    updatedAt: jetzt(), deleted: false,
  };
}

function neueRichtung() {
  return { box: 0, ease: 2.5, interval: 0, due: 0, reps: 0, lapses: 0, correct: 0, wrong: 0 };
}

/** Fach 0–5 → Stufe der Beherrschung. */
export const STUFEN = ["Neu", "Am Lernen", "Vertraut", "Beherrscht"];

export function stufe(stand, richtung = "td") {
  if (!stand) return 0;
  const box = stand[richtung]?.box || 0;
  if (box <= 0) return 0;
  if (box <= 2) return 1;
  if (box <= 4) return 2;
  return 3;
}

/** Mittlere Beherrschung einer Karte über beide Richtungen (0–1). */
export function beherrschung(stand) {
  if (!stand) return 0;
  return (Math.min(stand.td.box, 6) + Math.min(stand.dt.box, 6)) / 12;
}

/** Karten eines Stapels in ihrer Reihenfolge. */
export function sortiereKarten(karten) {
  return [...karten].sort((a, b) => (a.order - b.order) || a.id.localeCompare(b.id));
}

/** Baut den Ordnerbaum. Verwaiste Ordner hängen an der Wurzel. */
export function baueBaum(ordner) {
  const nachEltern = new Map();
  const bekannt = new Set(ordner.map((o) => o.id));
  for (const o of ordner) {
    const eltern = o.parentId && bekannt.has(o.parentId) ? o.parentId : "__wurzel__";
    if (!nachEltern.has(eltern)) nachEltern.set(eltern, []);
    nachEltern.get(eltern).push(o);
  }
  const bauen = (schluessel) =>
    (nachEltern.get(schluessel) || [])
      .sort((a, b) => a.name.localeCompare(b.name, "de"))
      .map((o) => ({ ...o, kinder: bauen(o.id) }));
  return bauen("__wurzel__");
}

/** Alle Ordnerkennungen unterhalb (und einschließlich) eines Ordners. */
export function ordnerZweig(ordner, wurzelId) {
  const ergebnis = new Set([wurzelId]);
  let gewachsen = true;
  while (gewachsen) {
    gewachsen = false;
    for (const o of ordner)
      if (o.parentId && ergebnis.has(o.parentId) && !ergebnis.has(o.id)) {
        ergebnis.add(o.id); gewachsen = true;
      }
  }
  return ergebnis;
}

/**
 * Verteilt Karten auf die vier Stufen — Grundlage für die Fortschrittsbalken.
 * Gewertet wird die schwächere der beiden Richtungen.
 */
export function anteileNachStufe(karten, staende) {
  const anteile = [0, 0, 0, 0];
  for (const k of karten) {
    const stand = staende[k.id];
    const s = Math.min(stufe(stand, "td"), stufe(stand, "dt"));
    anteile[s] += 1;
  }
  return anteile;
}

/* ===================================================================== */
/*  Fassung 2 — Fächer, Kartenarten, Reviews                             */
/* ===================================================================== */

/**
 * Die Kartenarten (§3.2). Bewusst wenige.
 *
 * frei        Vorderseite zeigen, Antwort tippen — der Standard
 * cloze       Lückentext, jede Lücke wird eigenständig geplant
 * bild        wie `frei`, aber die Frage ist ein Bild
 * mehrschritt Rechenweg oder Mechanismus, Zwischenschritte einzeln
 */
export const KARTENARTEN = {
  frei: "Freies Abrufen",
  cloze: "Lückentext",
  bild: "Bildkarte",
  mehrschritt: "Mehrschritt",
};

/** Karten aus Fassung 1 haben kein `art`-Feld — sie sind freies Abrufen. */
export function kartenArt(karte) {
  return karte?.art && KARTENARTEN[karte.art] ? karte.art : "frei";
}

export function neuesFach(name, farbe = null) {
  return {
    id: id("f"), name, farbe,
    zielRetention: 0.9,        // Ziel-Behaltenswahrscheinlichkeit (§3.1)
    maximalTage: 3650,
    pruefungsdatum: null,      // Zeitstempel oder null
    neuProTag: 15,             // Bremse gegen den Rückstau
    richtungen: ["td"],        // bei Sprachen: ["td", "dt"]
    updatedAt: jetzt(), deleted: false,
  };
}

/**
 * Ein einzelnes Review — der wichtigste Datensatz der App.
 *
 * `flag` trennt, was zählt, von dem, was nur geübt wurde:
 *   normal      zählt, verändert den Kartenzustand
 *   practice    aus den Übungsmodi — zählt für die Strähne, nicht für Termine
 *   cram        Endspurt vor der Klausur, lässt den Zustand unberührt
 *   pretest     Fragen vor dem Lernen, fließen in keine Statistik
 *   implausible zu schnell beantwortet, um echt zu sein
 */
export function neuesReview({
  cardId, richtung = "td", setId = null, subjectId = null,
  bewertung, antwortzeit = 0, konfidenz = null, flag = "normal",
  modus = "abrufen", zeit = Date.now(),
}) {
  return {
    id: id("r"), cardId, richtung, setId, subjectId,
    zeit, bewertung, antwortzeit, konfidenz, flag, modus,
    updatedAt: zeit, deleted: false,
  };
}

/**
 * Zerlegt einen Lückentext.
 * „Das {{Ohmsche Gesetz}} lautet U = R · I" → Stücke mit Lücken.
 */
export function clozeTeile(text) {
  const stuecke = [];
  const muster = /\{\{(.+?)\}\}/g;
  let letzte = 0, treffer, nummer = 0;
  while ((treffer = muster.exec(String(text || "")))) {
    if (treffer.index > letzte)
      stuecke.push({ art: "text", text: text.slice(letzte, treffer.index) });
    nummer += 1;
    stuecke.push({ art: "luecke", nummer, text: treffer[1] });
    letzte = treffer.index + treffer[0].length;
  }
  if (letzte < String(text || "").length)
    stuecke.push({ art: "text", text: text.slice(letzte) });
  return stuecke;
}

export function clozeAnzahl(text) {
  return clozeTeile(text).filter((s) => s.art === "luecke").length;
}

/**
 * Welche Abfragerichtungen eine Karte hat.
 * Bei Lückentexten ist jede Lücke eine eigene Richtung (`c1`, `c2`, …),
 * sonst entscheidet der Stapel: nur vorwärts oder beide Wege.
 */
export function richtungenFuer(karte, stapel) {
  if (kartenArt(karte) === "cloze") {
    const anzahl = clozeAnzahl(karte.term) || 1;
    return Array.from({ length: anzahl }, (_, i) => "c" + (i + 1));
  }
  const eigene = stapel?.richtungen;
  return Array.isArray(eigene) && eigene.length ? eigene : ["td"];
}

/** Menschenlesbarer Name einer Richtung. */
export function richtungName(richtung, stapel) {
  if (richtung?.startsWith("c")) return "Lücke " + richtung.slice(1);
  return richtung === "dt"
    ? (stapel?.defLabel || "Rückseite") + " → " + (stapel?.termLabel || "Vorderseite")
    : (stapel?.termLabel || "Vorderseite") + " → " + (stapel?.defLabel || "Rückseite");
}

/* ===================================================================== */
/*  Fassung 3 — Entwürfe und Herkunft                                    */
/* ===================================================================== */

/**
 * Woher eine Karte stammt. Das ist keine Buchhaltung, sondern ein Warnzeiger:
 * Ein Deck, das überwiegend aus `ki_uebernommen` besteht, ist voll und das
 * Gedächtnis leer. Der Anteil steht darum in der Statistik.
 */
export const HERKUNFT = {
  selbst: "selbst geschrieben",
  ki_vorderseite: "Vorderseite von der KI, Rückseite selbst",
  ki_uebernommen: "Vorschlag der KI übernommen",
  einfuhr: "aus einer Liste übernommen",
};

export function herkunftVon(karte) {
  return karte?.created_by && HERKUNFT[karte.created_by] ? karte.created_by : "selbst";
}

/**
 * Ein Kartenentwurf.
 *
 * Der Kern der Sache steht in `vorschlag` und `gesehen`: Die vorgeschlagene
 * Rückseite bleibt verborgen, bis der Nutzer seine eigene geschrieben hat.
 * Wer sie sich vorher zeigen lässt, kann das tun — es wird nur vermerkt.
 * Ohne diesen Umweg wäre der Generator eine Maschine, die Decks füllt und
 * nichts lernt.
 */
export function neuerEntwurf({
  setId, term = "", quelle = "", vorschlag = "", termImage = null,
  herkunft = "ki_vorderseite",
}) {
  return {
    id: id("e"), setId, term, quelle, vorschlag, termImage,
    eigene: "",           // was der Nutzer selbst schreibt
    gesehen: false,       // wurde der Vorschlag schon eingeblendet?
    herkunft,
    createdAt: jetzt(), updatedAt: jetzt(), deleted: false,
  };
}

/** Aus einem fertig bearbeiteten Entwurf wird eine Karte. */
export function karteAusEntwurf(entwurf, rueckseite, herkunft) {
  return {
    ...neueKarte(entwurf.setId, entwurf.term, rueckseite, 0),
    termImage: entwurf.termImage || null,
    quelle: entwurf.quelle || "",
    created_by: herkunft,
  };
}

/* ===================================================================== */
/*  Fassung 4 — Erklärungen (Feynman)                                    */
/* ===================================================================== */

/**
 * Eine Erklärung zu einem Thema, in Fassungen.
 *
 * Aufgehoben wird jede Überarbeitung, nicht nur die letzte. Wie sich eine
 * Erklärung über Wochen verändert, sagt mehr über den Lernfortschritt als
 * jede Prozentzahl: Wer im Oktober vier Sätze schrieb und im Januar zwölf,
 * mit den richtigen Begriffen darin, hat etwas gelernt.
 */
export function neueErklaerung({ thema, subjectId = null, setId = null }) {
  return {
    id: id("x"), themaId: id("t"), thema, subjectId, setId,
    fassungen: [],          // [{ text, zeit, lueckenZahl }]
    offeneLuecken: [],      // die letzte Rückmeldung
    runden: 0,
    erledigt: false,
    createdAt: jetzt(), updatedAt: jetzt(), deleted: false,
  };
}

/** Hängt eine überarbeitete Fassung an. */
export function mitFassung(erklaerung, text, luecken) {
  return {
    ...erklaerung,
    fassungen: [...erklaerung.fassungen,
      { text, zeit: jetzt(), lueckenZahl: (luecken || []).length }],
    offeneLuecken: luecken || [],
    runden: erklaerung.runden + 1,
    erledigt: Array.isArray(luecken) && luecken.length === 0,
    updatedAt: jetzt(),
  };
}

/** Wie viele Wörter die jüngste Fassung hat — ein grober Wachstumsmesser. */
export function umfangDerErklaerung(erklaerung) {
  const letzte = erklaerung?.fassungen?.[erklaerung.fassungen.length - 1];
  if (!letzte) return 0;
  return letzte.text.trim().split(/\s+/).filter(Boolean).length;
}

/* ===================================================================== */
/*  Fassung 5 — Prüfungssimulationen                                     */
/* ===================================================================== */

/**
 * Die Formate der schriftlichen Abiturprüfung.
 *
 * **Die Zeiten sind Platzhalter.** Der Agent kennt die gültigen Vorgaben für
 * den Jahrgang 2027 nicht und rät sie nicht. Der Nutzer trägt sie ein, sobald
 * er sie hat — bis dahin steht in der Oberfläche ein Hinweis darauf.
 */
export function neuesFormat(name, minuten = 0) {
  return { id: id("fm"), name, minuten, hilfsmittelfrei: false, geprueft: false };
}

export const FORMAT_VORLAGEN = [
  { fach: "Mathematik", teile: [
    { name: "Pflichtteil (hilfsmittelfrei)", minuten: 0, hilfsmittelfrei: true },
    { name: "Wahlteil", minuten: 0, hilfsmittelfrei: false }] },
  { fach: "Deutsch", teile: [{ name: "nach Aufgabenart", minuten: 0 }] },
  { fach: "GMT", teile: [{ name: "Profilprüfung", minuten: 0 }] },
  { fach: "Chemie", teile: [{ name: "schriftlich", minuten: 0 }] },
  { fach: "Informatik", teile: [{ name: "schriftlich", minuten: 0 }] },
  { fach: "Gemeinschaftskunde", teile: [{ name: "schriftlich", minuten: 0 }] },
];

/**
 * Eine Prüfungssimulation.
 *
 * Der Erwartungshorizont kommt vom Nutzer, nicht vom Modell: eine Liste von
 * Kriterien, wie sie im Unterricht besprochen oder aus einer Musterlösung
 * abgeschrieben wurde. Die KI prüft nur, ob ein Kriterium im Text vorkommt —
 * Punkte vergibt niemand.
 */
export function neuePruefung({ subjectId = null, titel, aufgabe = "",
  kriterien = [], minuten = 0, hilfsmittelfrei = false }) {
  return {
    id: id("pr"), subjectId, titel, aufgabe,
    kriterien: kriterien.map((k) => (typeof k === "string" ? k : k.text)).filter(Boolean),
    minuten, hilfsmittelfrei,
    text: "",                   // was der Nutzer geschrieben hat
    begonnen: 0, abgegeben: 0,
    gebrauchteZeit: 0,
    ergebnis: null,             // [{ kriterium, stand, stelle }]
    selbstpruefung: {},         // was der Nutzer selbst abgehakt hat
    zeit: jetzt(), updatedAt: jetzt(), deleted: false,
  };
}

/** Wie viele Kriterien der Nutzer selbst als erfüllt ansieht. */
export function pruefungsStand(pruefung) {
  const gesamt = (pruefung?.kriterien || []).length;
  if (!gesamt) return { gesamt: 0, ja: 0, unklar: 0, nein: 0, anteil: 0 };
  const eintraege = pruefung.kriterien.map((k, i) => {
    const eigen = pruefung.selbstpruefung?.[i];
    if (eigen) return eigen;
    const gefunden = (pruefung.ergebnis || []).find((e) => e.kriterium === k);
    return gefunden ? gefunden.stand : "offen";
  });
  const zaehle = (was) => eintraege.filter((e) => e === was).length;
  return {
    gesamt, ja: zaehle("ja"), unklar: zaehle("unklar"), nein: zaehle("nein"),
    anteil: zaehle("ja") / gesamt, eintraege,
  };
}
