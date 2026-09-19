/*
 * Der Bestand: alle Daten der App im Arbeitsspeicher, und jede Änderung daran.
 *
 * Bis hierher lebte das alles in einer React-Komponente (store.jsx). Das
 * hatte drei Folgen, die sich nicht wegflicken ließen:
 *
 * 1. Geschrieben wurde „nebenbei", innerhalb einer Zustandsänderung und ohne
 *    auf die Datenbank zu warten. Schlug das Schreiben fehl — Speicher voll,
 *    Browserfehler —, zeigte die App die Änderung trotzdem, und nach dem
 *    Neuladen war sie weg. Niemand erfuhr davon.
 * 2. Was zusammengehört, wurde getrennt geschrieben: die Antwort und der neue
 *    Termin, die verschobene Karte und ihr Lernstand.
 * 3. Ohne Browser ließ sich nichts davon prüfen.
 *
 * Jetzt gilt: Eine Änderung wird im Arbeitsspeicher sofort sichtbar (damit
 * die Oberfläche flüssig bleibt) und im selben Atemzug in einem Zug in die
 * Datenbank geschrieben. Misslingt das, steht es in `speicherfehler`, und die
 * Oberfläche sagt es.
 *
 * React hängt sich über `abonnieren` und `lesen` an (useSyncExternalStore);
 * die Befehle selbst kennen React nicht.
 */

import * as dbStandard from "./db.js";
import * as model from "./model.js";
import * as noten from "./noten.js";
import { bewerte } from "./scheduler.js";
import { neuerZustand, bewerteKarte, freigeben } from "./fsrs.js";
import { aufschlagFuer, istPlausibel } from "./kalibrierung.js";
import { wirksameRetention } from "./warteschlange.js";
import { tagesSchluessel } from "./util.js";
import { STANDARD_GESTALTUNG } from "./gestaltung.js";
import { LERNZEIT_EREIGNIS } from "./lernzeit.js";
import { kopienVon, naechsteStelle } from "./auswahl.js";
import { tonSchluessel } from "./ton.js";
import { migrieren } from "./migrationen.js";
import {
  FASSUNG, planDazulegen, planErsetzen, bilderZusammen, istEintrag,
} from "./sicherung.js";

export const STANDARD_EINSTELLUNGEN = {
  /* Gestaltung — die einzelnen Werte stehen in core/gestaltung.js. Sie liegen
     hier mit den übrigen Einstellungen, damit sie mit gesichert werden. */
  ...STANDARD_GESTALTUNG,
  schriftGross: false,           // aus Fassung 1, siehe Umstellung 2
  tippfehlerErlauben: true,
  ohneArtikel: true,
  zeichenEgal: true,
  satzzeichenEgal: true,
  rundenGroesse: 7,
  vorlesenAutomatisch: false,
  eigeneStimmeAutomatisch: false,   // eigene Aufnahme abspielen, sobald die Loesung steht
  sprechTempo: 1,
  ocrSprache: "deu+eng",
  zuletztStapel: null,
  sitzungsUmfang: 30,            // Aufgaben je Abrufsitzung
  faecherAngelegt: false,        // ob der Vorschlag der sechs Fächer schon kam
  letzteSicherung: 0,            // wann zuletzt eine Sicherungsdatei geschrieben wurde
  eigeneErscheinungsbilder: [],  // selbst gespeicherte Gestaltungen
  ausgeblendeteErscheinungsbilder: [],  // Namen vorgegebener, die weg sollen
};

/** Was beim Start und nach jedem Abgleich gelesen wird — Ablage → Feld. */
const LADEN = {
  folders: "ordner", sets: "stapel", cards: "karten", progress: "staende",
  sessions: "sitzungen", subjects: "faecher", cardstates: "zustaende",
  reviews: "reviews", drafts: "entwuerfe", explanations: "erklaerungen",
  exams: "pruefungen", noten: "notenfaecher",
};
/* Diese beiden liegen als Verzeichnis Kennung → Eintrag vor, nicht als Liste. */
const ALS_VERZEICHNIS = new Set(["staende", "zustaende"]);

/** Felder, deren Änderung eine Karte „überarbeitet" — sie gibt sie frei. */
const INHALT = ["term", "definition", "schritte", "art", "termImage", "defImage"];

const verzeichnis = (liste) => Object.fromEntries(liste.map((x) => [x.id, x]));

function ersetzeIn(liste, neue) {
  if (!neue.length) return liste;
  const nach = new Map(neue.map((r) => [r.id, r]));
  return liste.map((r) => nach.get(r.id) || r);
}

/** Eine Fehlermeldung, die man versteht. */
export function fehlerText(fehler) {
  const name = fehler?.name || "";
  const text = String(fehler?.message || fehler || "");
  if (name === "QuotaExceededError" || /quota/i.test(text))
    return "Der Speicher des Browsers ist voll. Räume Bilder und Aufnahmen weg "
      + "(Einstellungen → Sicherung → Verwaistes wegräumen) oder gib Platz auf dem Gerät frei.";
  if (name === "InvalidStateError" || /closing|closed/i.test(text))
    return "Die Verbindung zum Speicher wurde getrennt, meist durch eine neue Fassung der App "
      + "in einem anderen Fenster. Lade die Seite neu.";
  return text || "Unbekannter Fehler beim Speichern.";
}

const ereignis = (name) => {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(name));
};

/* ===================================================================== */

export function erzeugeBestand({ db = dbStandard, jetzt = () => Date.now() } = {}) {
  let zustand = {
    bereit: false,
    ladefehler: null,            // Text, wenn das Laden scheiterte
    speicherfehler: null,        // { text, zeit } nach einem misslungenen Schreiben
    dbHinweis: null,             // "blockiert" | "neueFassung" (siehe db.js)
    dauerhaft: null,             // hat der Browser dauerhaften Speicher gewährt?
    umgestellt: [],              // Namen der Umstellungen, die beim Start liefen
    ordner: [], stapel: [], karten: [], staende: {}, sitzungen: [],
    einstellungen: STANDARD_EINSTELLUNGEN,
    faecher: [], zustaende: {}, reviews: [], entwuerfe: [], erklaerungen: [],
    pruefungen: [], notenfaecher: [],
    wolkeStand: { zustand: "aus", zeit: 0, text: "" },
  };
  const horcher = new Set();
  let aenderungsMelder = () => {};
  let ladeVersprechen = null;

  const lesen = () => zustand;
  const abonnieren = (fn) => { horcher.add(fn); return () => horcher.delete(fn); };
  function setze(teil) {
    zustand = { ...zustand, ...teil };
    for (const fn of horcher) fn();
  }
  const melde = () => { try { aenderungsMelder(); } catch (e) { /* egal */ } };

  db.beobachte?.((art) => setze({ dbHinweis: art }));

  /**
   * Schreibt in einem Zug und meldet einen Fehler, statt ihn zu verschlucken.
   * → true, wenn es geklappt hat.
   */
  async function schreibe(eintraege) {
    try {
      await db.schreibeMehrere(eintraege);
      return true;
    } catch (fehler) {
      console.error("Speichern misslungen:", fehler);
      setze({ speicherfehler: { text: fehlerText(fehler), zeit: jetzt() } });
      return false;
    }
  }

  /* ------------------------------ Laden ------------------------------ */

  async function einlesen() {
    const roh = await db.lesenMehrere(Object.keys(LADEN));
    const teil = {};
    for (const [ablage, feld] of Object.entries(LADEN))
      teil[feld] = ALS_VERZEICHNIS.has(feld) ? verzeichnis(roh[ablage]) : roh[ablage];
    return teil;
  }

  /* Der Browser darf den Speicher einer Seite wegräumen, wenn der Platz knapp
     wird (Safari schon nach sieben Tagen ohne Besuch). Mit dieser Bitte
     behandelt er ihn wie den einer installierten App. */
  async function dauerhaftAnfordern() {
    const s = typeof navigator !== "undefined" ? navigator.storage : null;
    if (!s?.persisted) return;
    let ja = await s.persisted().catch(() => false);
    if (!ja && s.persist) ja = await s.persist().catch(() => false);
    setze({ dauerhaft: Boolean(ja) });
  }

  function laden() {
    if (ladeVersprechen) return ladeVersprechen;
    ladeVersprechen = (async () => {
      try {
        let umgestellt = [];
        try {
          umgestellt = await migrieren(db, { jetzt: jetzt() });
        } catch (e) {
          // Eine gescheiterte Umstellung soll den Start nicht verhindern:
          // Es wird nichts umgestellt, beim nächsten Start neu versucht.
          console.warn("Umstellung übersprungen:", e);
        }
        const teil = await einlesen();
        const e = await db.getSetting("einstellungen", null);
        setze({
          ...teil, einstellungen: { ...STANDARD_EINSTELLUNGEN, ...(e || {}) },
          bereit: true, ladefehler: null, umgestellt,
        });
        db.pruneTombstones().catch(() => {});
        dauerhaftAnfordern().catch(() => {});
      } catch (fehler) {
        console.error("Laden misslungen:", fehler);
        ladeVersprechen = null;
        setze({ ladefehler: fehlerText(fehler) });
      }
    })();
    return ladeVersprechen;
  }

  async function neuLaden() {
    setze(await einlesen());
    ereignis(LERNZEIT_EREIGNIS);
  }

  /* --------------------------- Einstellungen -------------------------- */

  function setzeEinstellung(schluessel, wert) {
    const neu = { ...zustand.einstellungen, [schluessel]: wert };
    setze({ einstellungen: neu });
    return schreibe({ settings: [{ key: "einstellungen", value: neu }] });
  }

  /* ------------------------------ Ordner ------------------------------ */

  async function ordnerAnlegen(name, parentId = null) {
    const o = model.neuerOrdner(name || "Neuer Ordner", parentId);
    setze({ ordner: [...zustand.ordner, o] });
    await schreibe({ folders: [o] });
    melde();
    return o;
  }

  async function ordnerAendern(kennung, aenderung) {
    const alt = zustand.ordner.find((o) => o.id === kennung);
    if (!alt) return;
    const neu = { ...alt, ...aenderung, updatedAt: jetzt() };
    setze({ ordner: ersetzeIn(zustand.ordner, [neu]) });
    await schreibe({ folders: [neu] });
    melde();
  }

  /**
   * Löscht einen Ordner samt allem darunter. Alles bekommt denselben
   * Zeitstempel — daran erkennt das Zurückholen, was zusammen weg ist.
   */
  async function ordnerLoeschen(kennung) {
    const zweig = model.ordnerZweig(zustand.ordner, kennung);
    const zeit = jetzt();
    const ordnerWeg = zustand.ordner.filter((o) => zweig.has(o.id));
    const stapelWeg = zustand.stapel.filter((s) => zweig.has(s.folderId));
    const ids = new Set(stapelWeg.map((s) => s.id));
    const kartenWeg = zustand.karten.filter((k) => ids.has(k.setId));
    const tot = (r) => ({ ...r, deleted: true, updatedAt: zeit });
    setze({
      ordner: zustand.ordner.filter((o) => !zweig.has(o.id)),
      stapel: zustand.stapel.filter((s) => !zweig.has(s.folderId)),
      karten: zustand.karten.filter((k) => !ids.has(k.setId)),
    });
    await schreibe({
      folders: ordnerWeg.map(tot), sets: stapelWeg.map(tot), cards: kartenWeg.map(tot),
    });
    melde();
  }

  /* ------------------------------ Stapel ------------------------------ */

  async function stapelAnlegen(titel, folderId = null) {
    const s = model.neuerStapel(titel || "Neuer Stapel", folderId);
    setze({ stapel: [...zustand.stapel, s] });
    await schreibe({ sets: [s] });
    melde();
    return s;
  }

  /*
   * Kartenzustaende tragen Stapel und Fach mit sich, und Tageslimit, Pensum
   * und Balken der Faecher lesen genau diese Felder. Wechselt eine Karte den
   * Stapel oder ein Stapel das Fach, muessen die Zustaende nachziehen — sonst
   * zaehlt die Karte stillschweigend weiter fuer das alte Fach.
   */
  function zustaendeMit(passt, aenderung, zeit) {
    return Object.values(zustand.zustaende).filter(passt)
      .map((z) => ({ ...z, ...aenderung, updatedAt: zeit }));
  }

  async function stapelAendern(kennung, aenderung) {
    const alt = zustand.stapel.find((s) => s.id === kennung);
    if (!alt) return;
    const zeit = jetzt();
    const neu = { ...alt, ...aenderung, updatedAt: zeit };
    const nach = "subjectId" in aenderung && (aenderung.subjectId || null) !== (alt.subjectId || null)
      ? zustaendeMit((z) => z.setId === kennung, { subjectId: aenderung.subjectId || null }, zeit)
      : [];
    setze({
      stapel: ersetzeIn(zustand.stapel, [neu]),
      ...(nach.length ? { zustaende: { ...zustand.zustaende, ...verzeichnis(nach) } } : {}),
    });
    await schreibe({ sets: [neu], cardstates: nach });
    melde();
  }

  async function stapelLoeschen(kennung) {
    const zeit = jetzt();
    const tot = (r) => ({ ...r, deleted: true, updatedAt: zeit });
    const s = zustand.stapel.find((x) => x.id === kennung);
    const kartenWeg = zustand.karten.filter((k) => k.setId === kennung);
    setze({
      stapel: zustand.stapel.filter((x) => x.id !== kennung),
      karten: zustand.karten.filter((k) => k.setId !== kennung),
    });
    await schreibe({ sets: s ? [tot(s)] : [], cards: kartenWeg.map(tot) });
    melde();
  }

  /* Tonaufnahmen haengen an der Kennung der Karte. Eine Kopie bekaeme ohne
     diesen Schritt die eigene Stimme nicht mit. Nachgesehen wird gezielt je
     Karte und Seite, statt alle Aufnahmen samt Inhalt zu laden. */
  async function toeneMitnehmen(paare) {
    const kopien = [];
    for (const { alt, neu } of paare) {
      for (const seite of ["t", "d"]) {
        const rec = await db.get("media", tonSchluessel(alt, seite)).catch(() => null);
        if (!rec?.blob || rec.deleted) continue;
        kopien.push({ ...rec, id: tonSchluessel(neu, seite), cardId: neu, updatedAt: jetzt() });
      }
    }
    if (kopien.length) await schreibe({ media: kopien });
  }

  /** Legt eine Kopie eines Stapels samt Karten an. */
  async function stapelVervielfaeltigen(kennung) {
    const vorlage = zustand.stapel.find((s) => s.id === kennung);
    if (!vorlage) return null;
    const kopie = {
      ...model.neuerStapel(vorlage.title + " (Kopie)", vorlage.folderId),
      description: vorlage.description, termLang: vorlage.termLang,
      defLang: vorlage.defLang, termLabel: vorlage.termLabel, defLabel: vorlage.defLabel,
      subjectId: vorlage.subjectId || null,
      ...(vorlage.richtungen ? { richtungen: vorlage.richtungen } : {}),
    };
    const alte = model.sortiereKarten(zustand.karten.filter((k) => k.setId === kennung));
    const neueKarten = kopienVon(alte, kopie.id, { start: 0, neueId: () => model.id("k"), jetzt: jetzt() });
    setze({ stapel: [...zustand.stapel, kopie], karten: [...zustand.karten, ...neueKarten] });
    await schreibe({ sets: [kopie], cards: neueKarten });
    await toeneMitnehmen(alte.map((k, i) => ({ alt: k.id, neu: neueKarten[i].id })));
    melde();
    return kopie;
  }

  /* ------------------------------ Karten ------------------------------ */

  const naechste = (setId) => naechsteStelle(zustand.karten, setId);

  async function karteAnlegen(setId, term = "", definition = "") {
    const k = model.neueKarte(setId, term, definition, naechste(setId));
    setze({ karten: [...zustand.karten, k] });
    await schreibe({ cards: [k] });
    melde();
    return k;
  }

  async function kartenAnlegenViele(setId, paare) {
    const start = naechste(setId);
    const neue = paare.map((p, i) => ({
      ...model.neueKarte(setId, p.term || "", p.definition || "", start + i),
      termImage: p.termImage || null, defImage: p.defImage || null, hint: p.hint || "",
      // Aus einer Stapeldatei: Lückentext oder Rechenweg samt Schritten.
      ...(p.art && p.art !== "frei" ? { art: p.art } : {}),
      ...(Array.isArray(p.schritte) ? { schritte: p.schritte } : {}),
      ...(p.starred ? { starred: true } : {}),
      ...(p.created_by ? { created_by: p.created_by } : {}),
    }));
    setze({ karten: [...zustand.karten, ...neue] });
    await schreibe({ cards: neue });
    melde();
    return neue;
  }

  /**
   * Ändert eine Karte. Wird dabei ihr Inhalt überarbeitet, sind ihre
   * gesperrten Richtungen wieder frei — genau dafür ist die Sperre da: Die
   * Karte war zu groß, jetzt ist sie es vielleicht nicht mehr.
   */
  async function karteAendern(kennung, aenderung) {
    const alt = zustand.karten.find((k) => k.id === kennung);
    if (!alt) return;
    const zeit = jetzt();
    const neu = { ...alt, ...aenderung, updatedAt: zeit };
    const ueberarbeitet = INHALT.some((f) => f in aenderung && aenderung[f] !== alt[f]);
    const frei = ueberarbeitet
      ? Object.values(zustand.zustaende)
        .filter((z) => z.cardId === kennung && z.gesperrt).map((z) => freigeben(z, zeit))
      : [];
    setze({
      karten: ersetzeIn(zustand.karten, [neu]),
      ...(frei.length ? { zustaende: { ...zustand.zustaende, ...verzeichnis(frei) } } : {}),
    });
    await schreibe({ cards: [neu], cardstates: frei });
    melde();
  }

  async function karteLoeschen(kennung) {
    const alt = zustand.karten.find((k) => k.id === kennung);
    if (!alt) return;
    setze({ karten: zustand.karten.filter((k) => k.id !== kennung) });
    await schreibe({ cards: [{ ...alt, deleted: true, updatedAt: jetzt() }] });
    melde();
  }

  /** Kopien in einen Stapel — derselbe fuers Duplizieren. Lernstand neu. */
  async function kartenKopieren(kennungen, zielSetId) {
    const menge = new Set(kennungen);
    const vorlagen = zustand.karten.filter((k) => menge.has(k.id))
      .sort((a, b) => (a.setId === b.setId ? a.order - b.order : a.setId.localeCompare(b.setId)));
    if (!vorlagen.length) return [];
    const neue = kopienVon(vorlagen, zielSetId, {
      start: naechste(zielSetId), neueId: () => model.id("k"), jetzt: jetzt(),
    });
    setze({ karten: [...zustand.karten, ...neue] });
    await schreibe({ cards: neue });
    await toeneMitnehmen(vorlagen.map((v, i) => ({ alt: v.id, neu: neue[i].id })));
    melde();
    return neue;
  }

  /** Karten wechseln den Stapel. Sie bleiben dieselben, samt Lernstand. */
  async function kartenVerschieben(kennungen, zielSetId) {
    const ziel = zustand.stapel.find((s) => s.id === zielSetId);
    if (!ziel) return 0;
    const menge = new Set(kennungen);
    let stelle = naechste(zielSetId);
    const zeit = jetzt();
    const bewegt = zustand.karten
      .filter((k) => menge.has(k.id) && k.setId !== zielSetId)
      .sort((a, b) => a.order - b.order)
      .map((k) => ({ ...k, setId: zielSetId, order: stelle++, updatedAt: zeit }));
    if (!bewegt.length) return 0;
    const ids = new Set(bewegt.map((k) => k.id));
    const nach = zustaendeMit((z) => ids.has(z.cardId),
      { setId: zielSetId, subjectId: ziel.subjectId || null }, zeit);
    setze({
      karten: ersetzeIn(zustand.karten, bewegt),
      zustaende: { ...zustand.zustaende, ...verzeichnis(nach) },
    });
    await schreibe({ cards: bewegt, cardstates: nach });
    melde();
    return bewegt.length;
  }

  /** Mehrere Karten in den Papierkorb — als Grabsteine, wie eine einzelne. */
  async function kartenLoeschenViele(kennungen) {
    const menge = new Set(kennungen);
    const zeit = jetzt();
    const weg = zustand.karten.filter((k) => menge.has(k.id))
      .map((k) => ({ ...k, deleted: true, updatedAt: zeit }));
    if (!weg.length) return 0;
    setze({ karten: zustand.karten.filter((k) => !menge.has(k.id)) });
    await schreibe({ cards: weg });
    melde();
    return weg.length;
  }

  /** Neue Reihenfolge festlegen (Liste von Kartenkennungen). */
  async function kartenOrdnen(reihenfolge) {
    const rang = new Map(reihenfolge.map((k, i) => [k, i]));
    const zeit = jetzt();
    const geaendert = zustand.karten
      .filter((k) => rang.has(k.id) && k.order !== rang.get(k.id))
      .map((k) => ({ ...k, order: rang.get(k.id), updatedAt: zeit }));
    if (!geaendert.length) return;
    setze({ karten: ersetzeIn(zustand.karten, geaendert) });
    await schreibe({ cards: geaendert });
    melde();
  }

  /** Vorder- und Rückseite aller Karten eines Stapels tauschen. */
  async function seitenTauschen(setId) {
    const zeit = jetzt();
    const neu = zustand.karten.filter((k) => k.setId === setId).map((k) => ({
      ...k, term: k.definition, definition: k.term,
      termImage: k.defImage, defImage: k.termImage, updatedAt: zeit,
    }));
    setze({ karten: ersetzeIn(zustand.karten, neu) });
    await schreibe({ cards: neu });
    melde();
  }

  /* ------------------------------ Lernstand --------------------------- */

  /**
   * Der Lernstand der sieben Übungsmodi — das alte Fächersystem.
   *
   * Zusätzlich wandert jede Übungsantwort als Review mit dem Vermerk
   * `practice` in die Historie. Sie füllt Statistik und Strähne, verschiebt
   * aber keinen Wiederholungstermin: Üben ist nicht Messen.
   */
  async function antwortVerbuchen(karte, richtung, qualitaet, zusatz = {}) {
    const zeit = jetzt();
    const vorher = zustand.staende[karte.id] || model.neuerStand(karte.id, karte.setId);
    const nachher = bewerte(vorher, richtung === "dt" ? "dt" : "td", qualitaet, zeit);
    const derStapel = zustand.stapel.find((s) => s.id === karte.setId);
    const review = model.neuesReview({
      cardId: karte.id, richtung, setId: karte.setId,
      subjectId: zusatz.subjectId || derStapel?.subjectId || null,
      bewertung: qualitaet >= 2 ? 3 : qualitaet === 1 ? 2 : 1,
      antwortzeit: zusatz.antwortzeit || 0,
      konfidenz: null, flag: "practice", modus: zusatz.modus || "uebung", zeit,
    });
    setze({
      staende: { ...zustand.staende, [karte.id]: nachher },
      reviews: [...zustand.reviews, review],
    });
    await schreibe({ progress: [nachher], reviews: [review] });
    melde();
  }

  async function standZuruecksetzen(setId) {
    const zeit = jetzt();
    const leer = Object.entries(zustand.staende)
      .filter(([, s]) => s.setId === setId)
      .map(([kennung]) => ({ ...model.neuerStand(kennung, setId), updatedAt: zeit }));
    setze({ staende: { ...zustand.staende, ...verzeichnis(leer) } });
    await schreibe({ progress: leer });
    melde();
  }

  /* --------------------------- Abrufen (FSRS) --------------------------- */

  /**
   * Verbucht einen Abruf: das Review und — wenn es zählt — den neuen
   * Kartenzustand, beides in einem Zug. Das ist der einzige Weg, auf dem sich
   * Wiederholungstermine ändern.
   */
  async function abrufVerbuchen({
    karte, stapel, richtung = "td", bewertung, konfidenz = null,
    antwortzeit = 0, eingabeLeer = false, flag = "normal", modus = "abrufen",
    fach = null, zeit = jetzt(),
  }) {
    const subjectId = fach?.id || stapel?.subjectId || null;
    const schluessel = karte.id + ":" + richtung;

    // Durchklicken wird festgehalten, zählt aber nicht (§5).
    const echt = istPlausibel({ antwortzeit });
    const wirklichesFlag = flag === "normal" && !echt ? "implausible" : flag;

    const review = model.neuesReview({
      cardId: karte.id, richtung, setId: karte.setId, subjectId,
      bewertung, antwortzeit, konfidenz, flag: wirklichesFlag, modus, zeit,
      ohneEingabe: eingabeLeer,
    });

    const vorher = zustand.zustaende[schluessel];
    let neuerStand = null;
    let zuSchreiben = null;
    if (wirklichesFlag === "normal") {
      const basis = vorher || neuerZustand(karte.id, richtung, karte.setId, subjectId, zeit);
      const aufschlag = aufschlagFuer([...zustand.reviews, review]
        .filter((r) => r.cardId === karte.id && r.richtung === richtung));
      neuerStand = bewerteKarte(basis, bewertung, {
        zielRetention: wirksameRetention(fach),
        maximalTage: fach?.maximalTage ?? 3650,
        zeit, wirksam: true, aufschlag,
      });
      zuSchreiben = neuerStand;
    } else if (!vorher) {
      // Zustand unberührt lassen, aber die Zugehörigkeit festhalten, damit
      // die Karte in Übersichten auftaucht.
      zuSchreiben = neuerZustand(karte.id, richtung, karte.setId, subjectId, zeit);
    }

    setze({
      reviews: [...zustand.reviews, review],
      ...(zuSchreiben ? { zustaende: { ...zustand.zustaende, [schluessel]: zuSchreiben } } : {}),
    });
    await schreibe({ reviews: [review], cardstates: zuSchreiben ? [zuSchreiben] : [] });
    melde();
    return { review, zustand: neuerStand };
  }

  /**
   * Die Übungsmodi melden hierher. Sie füllen die Historie und die Strähne,
   * verschieben aber keinen Termin — Üben ist nicht Messen.
   */
  function uebungVerbuchen({ karte, stapel, richtung = "td", gewusst, antwortzeit = 0, modus }) {
    return abrufVerbuchen({
      karte, stapel, richtung, bewertung: gewusst ? 3 : 1,
      antwortzeit, flag: "practice", modus,
    });
  }

  /** Eine gesperrte Karte wieder freigeben — alle ihre Richtungen. */
  async function karteEntsperren(cardId, richtung = null) {
    const zeit = jetzt();
    const frei = Object.values(zustand.zustaende)
      .filter((z) => z.cardId === cardId && z.gesperrt && (!richtung || z.richtung === richtung))
      .map((z) => freigeben(z, zeit));
    if (!frei.length) return;
    setze({ zustaende: { ...zustand.zustaende, ...verzeichnis(frei) } });
    await schreibe({ cardstates: frei });
    melde();
  }

  /** Lernstand eines Stapels im neuen Sinne verwerfen. */
  async function zustandZuruecksetzen(setId) {
    const zeit = jetzt();
    const leer = Object.values(zustand.zustaende).filter((z) => z.setId === setId)
      .map((z) => neuerZustand(z.cardId, z.richtung, z.setId, z.subjectId, zeit));
    setze({ zustaende: { ...zustand.zustaende, ...verzeichnis(leer) } });
    await schreibe({ cardstates: leer });
    melde();
  }

  /** Ergebnis einer Sitzung festhalten — Grundlage für die Statistik. */
  async function sitzungMerken(eintrag) {
    const zeit = jetzt();
    const rec = { id: model.id("z"), zeit, tag: tagesSchluessel(zeit), updatedAt: zeit, ...eintrag };
    setze({ sitzungen: [...zustand.sitzungen, rec] });
    await schreibe({ sessions: [rec] });
    return rec;
  }

  /* ------------------------------ Entwürfe ------------------------------ */

  const tot = (r, zeit = jetzt()) => ({ ...r, deleted: true, updatedAt: zeit });

  /** Allgemeines Muster: einen Eintrag einer Liste ändern und schreiben. */
  async function aendereIn(feld, ablage, kennung, aendern) {
    const alt = zustand[feld].find((x) => x.id === kennung);
    if (!alt) return null;
    const neu = { ...aendern(alt), updatedAt: jetzt() };
    setze({ [feld]: ersetzeIn(zustand[feld], [neu]) });
    await schreibe({ [ablage]: [neu] });
    melde();
    return neu;
  }
  async function entferneAus(feld, ablage, kennung) {
    const alt = zustand[feld].find((x) => x.id === kennung);
    if (!alt) return;
    setze({ [feld]: zustand[feld].filter((x) => x.id !== kennung) });
    await schreibe({ [ablage]: [tot(alt)] });
    melde();
  }
  async function fuegeHinzu(feld, ablage, neue) {
    const liste = Array.isArray(neue) ? neue : [neue];
    if (!liste.length) return liste;
    setze({ [feld]: [...zustand[feld], ...liste] });
    await schreibe({ [ablage]: liste });
    melde();
    return neue;
  }

  const entwuerfeAnlegen = (neue) => fuegeHinzu("entwuerfe", "drafts", neue);
  const entwurfAendern = (kennung, aenderung) =>
    aendereIn("entwuerfe", "drafts", kennung, (e) => ({ ...e, ...aenderung }));
  const entwurfVerwerfen = (kennung) => entferneAus("entwuerfe", "drafts", kennung);

  /**
   * Aus einem Entwurf wird eine Karte.
   * `herkunft` hält fest, wer die Rückseite geschrieben hat — das ist die
   * einzige Zahl, an der später abzulesen ist, ob die App noch beim Lernen
   * hilft oder nur noch Decks füllt.
   */
  async function entwurfUebernehmen(entwurf, rueckseite, herkunft) {
    const karte = { ...model.karteAusEntwurf(entwurf, rueckseite, herkunft), order: naechste(entwurf.setId) };
    const alt = zustand.entwuerfe.find((e) => e.id === entwurf.id);
    setze({
      karten: [...zustand.karten, karte],
      entwuerfe: zustand.entwuerfe.filter((e) => e.id !== entwurf.id),
    });
    await schreibe({ cards: [karte], drafts: alt ? [tot(alt)] : [] });
    melde();
    return karte;
  }

  /* ----------------------------- Erklärungen ---------------------------- */

  const erklaerungAnlegen = ({ thema, subjectId = null, setId = null }) =>
    fuegeHinzu("erklaerungen", "explanations", model.neueErklaerung({ thema, subjectId, setId }));
  /** Hängt eine überarbeitete Fassung an — nichts wird überschrieben. */
  const erklaerungFortschreiben = (kennung, text, luecken) =>
    aendereIn("erklaerungen", "explanations", kennung, (x) => model.mitFassung(x, text, luecken));
  const erklaerungLoeschen = (kennung) => entferneAus("erklaerungen", "explanations", kennung);

  /* --------------------------- Prüfungssimulation ----------------------- */

  const pruefungAnlegen = (angaben) => fuegeHinzu("pruefungen", "exams", model.neuePruefung(angaben));
  const pruefungAendern = (kennung, aenderung) =>
    aendereIn("pruefungen", "exams", kennung, (p) => ({ ...p, ...aenderung }));
  const pruefungLoeschen = (kennung) => entferneAus("pruefungen", "exams", kennung);

  /* ----------------------------- Punkte (Noten) ------------------------- */

  /*
   * Ein Datensatz je Fach und Halbjahr. Die Leistungen liegen als Liste
   * darin — sie gehoeren untrennbar zum Fach, und einzeln abgelegt waeren sie
   * beim Abgleich eine Quelle halber Zustaende.
   */
  const notenfachAnlegen = (angaben) => fuegeHinzu("notenfaecher", "noten", noten.neuesNotenfach(angaben));
  const notenfachAendern = (kennung, aenderung) =>
    aendereIn("notenfaecher", "noten", kennung, (n) => ({ ...n, ...aenderung }));
  const notenfachLoeschen = (kennung) => entferneAus("notenfaecher", "noten", kennung);

  async function leistungAnlegen(fachId, angaben) {
    const l = noten.neueLeistung(angaben);
    await aendereIn("notenfaecher", "noten", fachId,
      (n) => ({ ...n, leistungen: [...(n.leistungen || []), l] }));
    return l;
  }
  const leistungAendern = (fachId, leistungId, aenderung) =>
    aendereIn("notenfaecher", "noten", fachId, (n) => ({
      ...n, leistungen: (n.leistungen || []).map((l) => (l.id === leistungId ? { ...l, ...aenderung } : l)),
    }));
  const leistungLoeschen = (fachId, leistungId) =>
    aendereIn("notenfaecher", "noten", fachId, (n) => ({
      ...n, leistungen: (n.leistungen || []).filter((l) => l.id !== leistungId),
    }));

  /* ------------------------------- Fächer ------------------------------- */

  async function fachAnlegen(name, farbe = null, zusatz = {}) {
    const f = { ...model.neuesFach(name || "Neues Fach", farbe), ...zusatz };
    await fuegeHinzu("faecher", "subjects", f);
    return f;
  }
  const fachAendern = (kennung, aenderung) =>
    aendereIn("faecher", "subjects", kennung, (f) => ({ ...f, ...aenderung }));

  /** Das Fach verschwindet; die Stapel darin bleiben und werden fachlos. */
  async function fachLoeschen(kennung) {
    const zeit = jetzt();
    const f = zustand.faecher.find((x) => x.id === kennung);
    const stapelNeu = zustand.stapel.filter((s) => s.subjectId === kennung)
      .map((s) => ({ ...s, subjectId: null, updatedAt: zeit }));
    const nach = zustaendeMit((z) => z.subjectId === kennung, { subjectId: null }, zeit);
    setze({
      faecher: zustand.faecher.filter((x) => x.id !== kennung),
      stapel: ersetzeIn(zustand.stapel, stapelNeu),
      zustaende: { ...zustand.zustaende, ...verzeichnis(nach) },
    });
    await schreibe({ subjects: f ? [tot(f, zeit)] : [], sets: stapelNeu, cardstates: nach });
    melde();
  }

  /* ----------------------------- Papierkorb --------------------------- */

  async function papierkorbLesen() {
    const { folders, sets, cards } = await db.lesenMehrere(
      ["folders", "sets", "cards"], { mitGeloeschten: true });
    return {
      ordner: folders.filter((x) => x.deleted),
      stapel: sets.filter((x) => x.deleted),
      karten: cards.filter((x) => x.deleted),
    };
  }

  /**
   * Holt Gelöschtes zurück. Ein Stapel bringt die Karten mit, die mit ihm
   * gelöscht wurden (derselbe Zeitstempel) — nicht aber Karten, die schon
   * vorher einzeln im Papierkorb lagen. Ein Ordner bringt alles mit, was
   * mit ihm ging.
   */
  async function wiederherstellen(art, kennung) {
    const alles = await db.lesenMehrere(["folders", "sets", "cards"], { mitGeloeschten: true });
    const zeit = jetzt();
    const lebt = (r) => ({ ...r, deleted: false, updatedAt: zeit });
    const lebendeOrdner = new Set(alles.folders.filter((o) => !o.deleted).map((o) => o.id));
    let ordnerZurueck = [], stapelZurueck = [], kartenZurueck = [];

    if (art === "karte") {
      const k = alles.cards.find((x) => x.id === kennung);
      if (k) kartenZurueck = [lebt(k)];
    } else if (art === "stapel") {
      const s = alles.sets.find((x) => x.id === kennung);
      if (!s) return;
      const geloescht = s.updatedAt;
      stapelZurueck = [{ ...lebt(s), folderId: lebendeOrdner.has(s.folderId) ? s.folderId : null }];
      kartenZurueck = alles.cards
        .filter((k) => k.setId === kennung && k.deleted && k.updatedAt === geloescht).map(lebt);
    } else {
      const o = alles.folders.find((x) => x.id === kennung);
      if (!o) return;
      const geloescht = o.updatedAt;
      const mit = (r) => r.deleted && r.updatedAt === geloescht;
      const zweig = model.ordnerZweig(alles.folders.filter((x) => x.id === kennung || mit(x)), kennung);
      ordnerZurueck = alles.folders.filter((x) => zweig.has(x.id) && (x.id === kennung || mit(x)))
        .map((x) => (x.id === kennung && x.parentId && !lebendeOrdner.has(x.parentId)
          ? { ...lebt(x), parentId: null } : lebt(x)));
      stapelZurueck = alles.sets.filter((s) => zweig.has(s.folderId) && mit(s)).map(lebt);
      const ids = new Set(stapelZurueck.map((s) => s.id));
      kartenZurueck = alles.cards.filter((k) => ids.has(k.setId) && mit(k)).map(lebt);
    }

    setze({
      ordner: [...zustand.ordner, ...ordnerZurueck],
      stapel: [...zustand.stapel, ...stapelZurueck],
      karten: [...zustand.karten, ...kartenZurueck],
    });
    await schreibe({ folders: ordnerZurueck, sets: stapelZurueck, cards: kartenZurueck });
    melde();
  }

  /* ------------------------- Sicherung als Datei ---------------------- */

  /*
   * Die Sicherung, auf Wunsch ohne Medien. Gelesen wird in einem Zug, damit
   * die Datei einen Stand zeigt, der zusammenpasst.
   */
  async function alsSicherung({ mitMedien = true } = {}) {
    const felder = Object.entries(dbStandard.SICHERUNG_FELDER);
    const roh = await db.lesenMehrere(felder.map(([a]) => a), { mitGeloeschten: true });
    const eintraege = Object.fromEntries(felder.map(([ablage, feld]) => [feld, roh[ablage] || []]));
    const medien = mitMedien ? await db.all("media", { mitGeloeschten: true }) : [];
    const eingepackt = await Promise.all(medien.filter((m) => m.blob).map(async ({ blob, ...rest }) => ({
      ...rest,
      daten: await new Promise((fertig) => {
        const leser = new FileReader();
        leser.onload = () => fertig(leser.result);
        leser.onerror = () => fertig(null);
        leser.readAsDataURL(blob);
      }),
    })));
    return {
      fassung: FASSUNG, erzeugt: jetzt(), ...eintraege,
      bilder: eingepackt.filter((b) => b.daten), einstellungen: zustand.einstellungen,
      ohneMedien: !mitMedien,
    };
  }

  /**
   * Liest eine Sicherung ein — `ersetzen` oder dazulegen.
   *
   * Vorher liegt immer eine Kopie des jetzigen Stands in der zweiten
   * Datenbank. Geschrieben wird in einem Zug: Bricht es ab, ist nichts
   * verändert. → Bericht { geschrieben, aelter, ungueltig, medien }
   */
  async function ausSicherung(daten, ersetzen = false) {
    if (!daten || !Array.isArray(daten.stapel)) throw new Error("Unbekanntes Format");
    const zeit = jetzt();

    // Die Bilder erst auspacken — das geht nicht innerhalb eines Zugs.
    const medien = [];
    for (const b of daten.bilder || []) {
      if (!istEintrag(b) || typeof b.daten !== "string") continue;
      try {
        const blob = await (await fetch(b.daten)).blob();
        const rest = { ...b };
        delete rest.daten;
        medien.push({ ...rest, blob, type: b.type || blob.type, updatedAt: b.updatedAt || zeit });
      } catch (e) { /* einzelnes Bild überspringen */ }
    }

    await db.sicherungAnlegen(ersetzen ? "vor-ersetzen" : "vor-dazulegen");

    const felder = Object.entries(dbStandard.SICHERUNG_FELDER);
    const vorhanden = await db.lesenMehrere(felder.map(([a]) => a), { mitGeloeschten: true });
    const schreiben = {};
    const bericht = { geschrieben: 0, aelter: 0, ungueltig: 0, medien: 0 };
    for (const [ablage, feld] of felder) {
      // Fehlt ein Feld (ältere Datei), bleibt die Ablage, wie sie ist —
      // auch beim Ersetzen. Sonst verschwänden etwa alle Lernzeiten, nur
      // weil die Datei älter ist als diese Ablage.
      if (!Array.isArray(daten[feld])) continue;
      const plan = ersetzen
        ? planErsetzen(vorhanden[ablage], daten[feld], zeit)
        : planDazulegen(vorhanden[ablage], daten[feld]);
      schreiben[ablage] = plan.schreiben;
      bericht.geschrieben += plan.schreiben.length;
      bericht.aelter += plan.aelter || 0;
      bericht.ungueltig += plan.ungueltig || 0;
    }

    let leeren = [];
    if (ersetzen && !daten.ohneMedien) {
      leeren = ["media"];
      schreiben.media = medien;
    } else if (medien.length) {
      const da = new Set((await db.all("media", { mitGeloeschten: true })).map((m) => m.id));
      schreiben.media = medien.filter((m) => !da.has(m.id));
    }
    bericht.medien = (schreiben.media || []).length;

    const aus = daten.einstellungen && typeof daten.einstellungen === "object" ? daten.einstellungen : {};
    const einstellungen = ersetzen
      ? { ...STANDARD_EINSTELLUNGEN, ...aus, letzteSicherung: zustand.einstellungen.letzteSicherung }
      : { ...zustand.einstellungen,
        eigeneErscheinungsbilder: bilderZusammen(zustand.einstellungen.eigeneErscheinungsbilder,
          aus.eigeneErscheinungsbilder) };
    schreiben.settings = [{ key: "einstellungen", value: einstellungen }];

    await db.ersetzeUndSchreibe({ leeren, schreiben });
    setze({ einstellungen });
    await neuLaden();
    melde();
    return bericht;
  }

  /* ------------------------------- Lernzeit ---------------------------- */

  /*
   * Die Zeitbloecke liegen bewusst nicht im gemeinsamen Zustand. Waehrend des
   * Lernens wird alle halbe Minute gesichert; laege das im Zustand, wuerde die
   * ganze App jedes Mal neu gezeichnet — mitten im Tippen einer Antwort.
   * Wer die Zahlen braucht, liest sie und horcht auf das Ereignis.
   */
  async function lernzeitSpeichern(saetze) {
    if (!saetze?.length) return;
    const zeit = jetzt();
    await schreibe({ lernzeit: saetze.map((s) => ({ ...s, updatedAt: zeit })) });
    ereignis(LERNZEIT_EREIGNIS);
    melde();
  }
  const lernzeitLesen = () => db.all("lernzeit");

  /* ------------------------------ Sonstiges --------------------------- */

  const setWolkeStand = (wolkeStand) => setze({ wolkeStand });
  const setAenderungsMelder = (fn) => { aenderungsMelder = fn || (() => {}); };
  const speicherfehlerVergessen = () => setze({ speicherfehler: null });

  const aktionen = {
    laden, neuLaden, setzeEinstellung,
    ordnerAnlegen, ordnerAendern, ordnerLoeschen,
    stapelAnlegen, stapelAendern, stapelLoeschen, stapelVervielfaeltigen,
    karteAnlegen, kartenAnlegenViele, karteAendern, karteLoeschen, kartenOrdnen,
    kartenKopieren, kartenVerschieben, kartenLoeschenViele, seitenTauschen,
    antwortVerbuchen, standZuruecksetzen, sitzungMerken,
    papierkorbLesen, wiederherstellen,
    alsSicherung, ausSicherung,
    setWolkeStand, setAenderungsMelder, speicherfehlerVergessen,
    fachAnlegen, fachAendern, fachLoeschen,
    abrufVerbuchen, uebungVerbuchen, karteEntsperren, zustandZuruecksetzen,
    entwuerfeAnlegen, entwurfAendern, entwurfVerwerfen, entwurfUebernehmen,
    erklaerungAnlegen, erklaerungFortschreiben, erklaerungLoeschen,
    pruefungAnlegen, pruefungAendern, pruefungLoeschen,
    notenfachAnlegen, notenfachAendern, notenfachLoeschen,
    leistungAnlegen, leistungAendern, leistungLoeschen,
    lernzeitSpeichern, lernzeitLesen,
  };

  return { lesen, abonnieren, aktionen };
}
