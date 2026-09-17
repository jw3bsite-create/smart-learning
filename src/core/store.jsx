/*
 * Der gemeinsame Datenbestand.
 *
 * Alles liegt im Speicher des Browsers und wird beim Start einmal vollständig
 * geladen — für ein paar Tausend Karten ist das nichts. Bilder bleiben außen
 * vor und werden erst geholt, wenn sie gezeigt werden.
 *
 * Jede Änderung geht denselben Weg: Zustand ändern und im selben Atemzug in
 * IndexedDB schreiben. Kein Zwischenspeicher, kein Abgleich von Hand.
 */

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from "react";
import * as db from "./db.js";
import * as model from "./model.js";
import * as noten from "./noten.js";
import { bewerte } from "./scheduler.js";
import { neuerZustand, bewerteKarte } from "./fsrs.js";
import { aufschlagFuer, istPlausibel } from "./kalibrierung.js";
import { wirksameRetention } from "./warteschlange.js";
import { tagesSchluessel } from "./util.js";
import { STANDARD_GESTALTUNG } from "./gestaltung.js";
import { LERNZEIT_EREIGNIS } from "./lernzeit.js";

const Zusammenhang = createContext(null);

export const STANDARD_EINSTELLUNGEN = {
  /* Gestaltung — die einzelnen Werte stehen in core/gestaltung.js. Sie liegen
     hier mit den übrigen Einstellungen, damit sie mit gesichert und
     abgeglichen werden. */
  ...STANDARD_GESTALTUNG,
  schriftGross: false,           // aus Fassung 1; wirkt nicht mehr, wird beim
                                 // ersten Start in schriftgroesse überführt
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
};

export function DatenSpeicher({ children }) {
  const [bereit, setBereit] = useState(false);
  const [ordner, setOrdner] = useState([]);
  const [stapel, setStapel] = useState([]);
  const [karten, setKarten] = useState([]);
  const [staende, setStaende] = useState({});
  const [sitzungen, setSitzungen] = useState([]);
  const [einstellungen, setEinstellungen] = useState(STANDARD_EINSTELLUNGEN);
  const [wolkeStand, setWolkeStand] = useState({ zustand: "aus", zeit: 0, text: "" });
  // Fassung 2: Fächer, FSRS-Kartenzustände und die Review-Historie.
  const [faecher, setFaecher] = useState([]);
  const [zustaende, setZustaende] = useState({});
  const [reviews, setReviews] = useState([]);
  // Fassung 3: Kartenentwürfe, die noch auf ihre Rückseite warten.
  const [entwuerfe, setEntwuerfe] = useState([]);
  // Fassung 4: Erklärungen aus dem Feynman-Modus.
  const [erklaerungen, setErklaerungen] = useState([]);
  // Fassung 5: Prüfungssimulationen.
  const [pruefungen, setPruefungen] = useState([]);
  const [notenfaecher, setNotenfaecher] = useState([]);
  const merkeAenderung = useRef(() => {});

  /* ------------------------------ Laden ------------------------------ */
  useEffect(() => {
    (async () => {
      const [o, s, k, f, si, e, fa, cs, rv, en, xk, pr, nt] = await Promise.all([
        db.all("folders"), db.all("sets"), db.all("cards"),
        db.all("progress"), db.all("sessions"),
        db.getSetting("einstellungen", null),
        db.all("subjects"), db.all("cardstates"), db.all("reviews"), db.all("drafts"),
        db.all("explanations"), db.all("exams"), db.all("noten"),
      ]);
      setOrdner(o); setStapel(s); setKarten(k);
      setStaende(Object.fromEntries(f.map((x) => [x.id, x])));
      setSitzungen(si);
      /* Aus Fassung 1 gab es nur einen Schalter für größere Schrift. Wer ihn
         an hatte, bekommt jetzt die entsprechende Punktgröße — sonst stünde
         die Oberfläche nach dem Umstieg plötzlich wieder klein da. */
      const gespeichert = e || {};
      if (gespeichert.schriftGross && gespeichert.schriftgroesse === undefined)
        gespeichert.schriftgroesse = 17;
      setEinstellungen({ ...STANDARD_EINSTELLUNGEN, ...gespeichert });
      setFaecher(fa);
      setZustaende(Object.fromEntries(cs.map((x) => [x.id, x])));
      setReviews(rv);
      setEntwuerfe(en); setErklaerungen(xk); setPruefungen(pr); setNotenfaecher(nt);
      setBereit(true);
      db.pruneTombstones().catch(() => {});
    })();
  }, []);

  /* --------------------------- Einstellungen -------------------------- */
  const setzeEinstellung = useCallback((schluessel, wert) => {
    setEinstellungen((alt) => {
      const neu = { ...alt, [schluessel]: wert };
      db.setSetting("einstellungen", neu);
      return neu;
    });
  }, []);

  /* ------------------------------ Ordner ------------------------------ */
  const ordnerAnlegen = useCallback(async (name, parentId = null) => {
    const o = model.neuerOrdner(name || "Neuer Ordner", parentId);
    await db.put("folders", o);
    setOrdner((alt) => [...alt, o]);
    return o;
  }, []);

  const ordnerAendern = useCallback(async (kennung, aenderung) => {
    setOrdner((alt) => alt.map((o) => {
      if (o.id !== kennung) return o;
      const neu = { ...o, ...aenderung, updatedAt: Date.now() };
      db.put("folders", neu);
      return neu;
    }));
  }, []);

  /** Löscht einen Ordner samt allem darunter. */
  const ordnerLoeschen = useCallback(async (kennung) => {
    const zweig = model.ordnerZweig(ordner, kennung);
    const zeit = Date.now();
    const betroffene = stapel.filter((s) => zweig.has(s.folderId));
    const ids = new Set(betroffene.map((s) => s.id));
    setOrdner((alt) => alt.filter((o) => {
      if (!zweig.has(o.id)) return true;
      db.put("folders", { ...o, deleted: true, updatedAt: zeit });
      return false;
    }));
    setStapel((alt) => alt.filter((s) => {
      if (!zweig.has(s.folderId)) return true;
      db.put("sets", { ...s, deleted: true, updatedAt: zeit });
      return false;
    }));
    setKarten((alt) => alt.filter((k) => {
      if (!ids.has(k.setId)) return true;
      db.put("cards", { ...k, deleted: true, updatedAt: zeit });
      return false;
    }));
    merkeAenderung.current();
  }, [ordner, stapel]);

  /* ------------------------------ Stapel ------------------------------ */
  const stapelAnlegen = useCallback(async (titel, folderId = null) => {
    const s = model.neuerStapel(titel || "Neuer Stapel", folderId);
    await db.put("sets", s);
    setStapel((alt) => [...alt, s]);
    return s;
  }, []);

  const stapelAendern = useCallback(async (kennung, aenderung) => {
    setStapel((alt) => alt.map((s) => {
      if (s.id !== kennung) return s;
      const neu = { ...s, ...aenderung, updatedAt: Date.now() };
      db.put("sets", neu);
      return neu;
    }));
    merkeAenderung.current();
  }, []);

  const stapelLoeschen = useCallback(async (kennung) => {
    const zeit = Date.now();
    setStapel((alt) => alt.filter((s) => {
      if (s.id !== kennung) return true;
      db.put("sets", { ...s, deleted: true, updatedAt: zeit });
      return false;
    }));
    setKarten((alt) => alt.filter((k) => {
      if (k.setId !== kennung) return true;
      db.put("cards", { ...k, deleted: true, updatedAt: zeit });
      return false;
    }));
    merkeAenderung.current();
  }, []);

  /** Legt eine Kopie eines Stapels samt Karten an. */
  const stapelVervielfaeltigen = useCallback(async (kennung) => {
    const vorlage = stapel.find((s) => s.id === kennung);
    if (!vorlage) return null;
    const kopie = {
      ...model.neuerStapel(vorlage.title + " (Kopie)", vorlage.folderId),
      description: vorlage.description, termLang: vorlage.termLang,
      defLang: vorlage.defLang, termLabel: vorlage.termLabel, defLabel: vorlage.defLabel,
    };
    const neueKarten = karten.filter((k) => k.setId === kennung).map((k) => ({
      ...k, id: model.id("k"), setId: kopie.id, updatedAt: Date.now(),
    }));
    await db.put("sets", kopie);
    await db.putMany("cards", neueKarten);
    setStapel((alt) => [...alt, kopie]);
    setKarten((alt) => [...alt, ...neueKarten]);
    return kopie;
  }, [stapel, karten]);

  /* ------------------------------ Karten ------------------------------ */
  const karteAnlegen = useCallback(async (setId, term = "", definition = "") => {
    const hoechste = karten.filter((k) => k.setId === setId)
      .reduce((m, k) => Math.max(m, k.order), -1);
    const k = model.neueKarte(setId, term, definition, hoechste + 1);
    await db.put("cards", k);
    setKarten((alt) => [...alt, k]);
    merkeAenderung.current();
    return k;
  }, [karten]);

  const kartenAnlegenViele = useCallback(async (setId, paare) => {
    const start = karten.filter((k) => k.setId === setId)
      .reduce((m, k) => Math.max(m, k.order), -1) + 1;
    const neue = paare.map((p, i) => ({
      ...model.neueKarte(setId, p.term || "", p.definition || "", start + i),
      termImage: p.termImage || null, defImage: p.defImage || null, hint: p.hint || "",
    }));
    await db.putMany("cards", neue);
    setKarten((alt) => [...alt, ...neue]);
    merkeAenderung.current();
    return neue;
  }, [karten]);

  const karteAendern = useCallback(async (kennung, aenderung) => {
    setKarten((alt) => alt.map((k) => {
      if (k.id !== kennung) return k;
      const neu = { ...k, ...aenderung, updatedAt: Date.now() };
      db.put("cards", neu);
      return neu;
    }));
    merkeAenderung.current();
  }, []);

  const karteLoeschen = useCallback(async (kennung) => {
    setKarten((alt) => alt.filter((k) => {
      if (k.id !== kennung) return true;
      db.put("cards", { ...k, deleted: true, updatedAt: Date.now() });
      return false;
    }));
    merkeAenderung.current();
  }, []);

  /** Neue Reihenfolge festlegen (Liste von Kartenkennungen). */
  const kartenOrdnen = useCallback(async (reihenfolge) => {
    const rang = new Map(reihenfolge.map((k, i) => [k, i]));
    const zeit = Date.now();
    setKarten((alt) => alt.map((k) => {
      if (!rang.has(k.id) || k.order === rang.get(k.id)) return k;
      const neu = { ...k, order: rang.get(k.id), updatedAt: zeit };
      db.put("cards", neu);
      return neu;
    }));
  }, []);

  /** Vorder- und Rückseite aller Karten eines Stapels tauschen. */
  const seitenTauschen = useCallback(async (setId) => {
    const zeit = Date.now();
    setKarten((alt) => alt.map((k) => {
      if (k.setId !== setId) return k;
      const neu = { ...k, term: k.definition, definition: k.term,
        termImage: k.defImage, defImage: k.termImage, updatedAt: zeit };
      db.put("cards", neu);
      return neu;
    }));
  }, []);

  /* ------------------------------ Lernstand --------------------------- */
  /**
   * Der Lernstand der sieben Übungsmodi — unverändert wie in Fassung 1.
   *
   * Zusätzlich wandert seit Fassung 2 jede Übungsantwort als Review mit dem
   * Vermerk `practice` in die Historie. Sie füllt Statistik und Strähne,
   * verschiebt aber keinen Wiederholungstermin: Üben ist nicht Messen.
   */
  const antwortVerbuchen = useCallback((karte, richtung, qualitaet, zusatz = {}) => {
    setStaende((alt) => {
      const vorher = alt[karte.id] || model.neuerStand(karte.id, karte.setId);
      const nachher = bewerte(vorher, richtung, qualitaet);
      db.put("progress", nachher);
      return { ...alt, [karte.id]: nachher };
    });

    const zeit = Date.now();
    const derStapel = stapel.find((s) => s.id === karte.setId);
    const review = model.neuesReview({
      cardId: karte.id, richtung, setId: karte.setId,
      subjectId: zusatz.subjectId || derStapel?.subjectId || null,
      bewertung: qualitaet >= 2 ? 3 : qualitaet === 1 ? 2 : 1,
      antwortzeit: zusatz.antwortzeit || 0,
      konfidenz: null, flag: "practice", modus: zusatz.modus || "uebung", zeit,
    });
    db.put("reviews", review);
    setReviews((alt) => [...alt, review]);

    merkeAenderung.current();
  }, [stapel]);

  const standZuruecksetzen = useCallback(async (setId) => {
    const zeit = Date.now();
    setStaende((alt) => {
      const neu = { ...alt };
      for (const [kennung, stand] of Object.entries(alt)) {
        if (stand.setId !== setId) continue;
        const leer = { ...model.neuerStand(kennung, setId), updatedAt: zeit };
        db.put("progress", leer);
        neu[kennung] = leer;
      }
      return neu;
    });
    merkeAenderung.current();
  }, []);

  /* ------------------------------ Entwürfe ------------------------------ */

  const entwuerfeAnlegen = useCallback(async (neue) => {
    if (!neue.length) return [];
    await db.putMany("drafts", neue);
    setEntwuerfe((alt) => [...alt, ...neue]);
    merkeAenderung.current();
    return neue;
  }, []);

  const entwurfAendern = useCallback(async (kennung, aenderung) => {
    setEntwuerfe((alt) => alt.map((e) => {
      if (e.id !== kennung) return e;
      const neu = { ...e, ...aenderung, updatedAt: Date.now() };
      db.put("drafts", neu);
      return neu;
    }));
  }, []);

  const entwurfVerwerfen = useCallback(async (kennung) => {
    setEntwuerfe((alt) => alt.filter((e) => {
      if (e.id !== kennung) return true;
      db.put("drafts", { ...e, deleted: true, updatedAt: Date.now() });
      return false;
    }));
    merkeAenderung.current();
  }, []);

  /**
   * Aus einem Entwurf wird eine Karte.
   * `herkunft` hält fest, wer die Rückseite geschrieben hat — das ist die
   * einzige Zahl, an der später abzulesen ist, ob die App noch beim Lernen
   * hilft oder nur noch Decks füllt.
   */
  const entwurfUebernehmen = useCallback(async (entwurf, rueckseite, herkunft) => {
    const hoechste = karten.filter((k) => k.setId === entwurf.setId)
      .reduce((m, k) => Math.max(m, k.order), -1);
    const karte = {
      ...model.karteAusEntwurf(entwurf, rueckseite, herkunft),
      order: hoechste + 1,
    };
    await db.put("cards", karte);
    setKarten((alt) => [...alt, karte]);
    setEntwuerfe((alt) => alt.filter((e) => {
      if (e.id !== entwurf.id) return true;
      db.put("drafts", { ...e, deleted: true, updatedAt: Date.now() });
      return false;
    }));
    merkeAenderung.current();
    return karte;
  }, [karten]);

  /* ----------------------------- Erklärungen ---------------------------- */

  const erklaerungAnlegen = useCallback(async ({ thema, subjectId = null, setId = null }) => {
    const x = model.neueErklaerung({ thema, subjectId, setId });
    await db.put("explanations", x);
    setErklaerungen((alt) => [...alt, x]);
    merkeAenderung.current();
    return x;
  }, []);

  /** Hängt eine überarbeitete Fassung an — nichts wird überschrieben. */
  const erklaerungFortschreiben = useCallback(async (kennung, text, luecken) => {
    let ergebnis = null;
    setErklaerungen((alt) => alt.map((x) => {
      if (x.id !== kennung) return x;
      ergebnis = model.mitFassung(x, text, luecken);
      db.put("explanations", ergebnis);
      return ergebnis;
    }));
    merkeAenderung.current();
    return ergebnis;
  }, []);

  const erklaerungLoeschen = useCallback(async (kennung) => {
    setErklaerungen((alt) => alt.filter((x) => {
      if (x.id !== kennung) return true;
      db.put("explanations", { ...x, deleted: true, updatedAt: Date.now() });
      return false;
    }));
    merkeAenderung.current();
  }, []);

  /* --------------------------- Prüfungssimulation ----------------------- */

  const pruefungAnlegen = useCallback(async (angaben) => {
    const p = model.neuePruefung(angaben);
    await db.put("exams", p);
    setPruefungen((alt) => [...alt, p]);
    merkeAenderung.current();
    return p;
  }, []);

  const pruefungAendern = useCallback(async (kennung, aenderung) => {
    let ergebnis = null;
    setPruefungen((alt) => alt.map((p) => {
      if (p.id !== kennung) return p;
      ergebnis = { ...p, ...aenderung, updatedAt: Date.now() };
      db.put("exams", ergebnis);
      return ergebnis;
    }));
    merkeAenderung.current();
    return ergebnis;
  }, []);

  const pruefungLoeschen = useCallback(async (kennung) => {
    setPruefungen((alt) => alt.filter((p) => {
      if (p.id !== kennung) return true;
      db.put("exams", { ...p, deleted: true, updatedAt: Date.now() });
      return false;
    }));
    merkeAenderung.current();
  }, []);

  /* ----------------------------- Punkte (Noten) ------------------------- */

  /*
   * Ein Datensatz je Fach und Halbjahr. Die Leistungen liegen als Liste
   * darin — sie gehoeren untrennbar zum Fach, und einzeln abgelegt waeren sie
   * beim Abgleich eine Quelle halber Zustaende.
   */
  const notenfachAnlegen = useCallback(async (angaben) => {
    const n = noten.neuesNotenfach(angaben);
    await db.put("noten", n);
    setNotenfaecher((alt) => [...alt, n]);
    merkeAenderung.current();
    return n;
  }, []);

  const notenfachAendern = useCallback(async (kennung, aenderung) => {
    let ergebnis = null;
    setNotenfaecher((alt) => alt.map((n) => {
      if (n.id !== kennung) return n;
      ergebnis = { ...n, ...aenderung, updatedAt: Date.now() };
      db.put("noten", ergebnis);
      return ergebnis;
    }));
    merkeAenderung.current();
    return ergebnis;
  }, []);

  const notenfachLoeschen = useCallback(async (kennung) => {
    setNotenfaecher((alt) => alt.filter((n) => {
      if (n.id !== kennung) return true;
      db.put("noten", { ...n, deleted: true, updatedAt: Date.now() });
      return false;
    }));
    merkeAenderung.current();
  }, []);

  /** Eine Leistung anhaengen, aendern oder entfernen. */
  const leistungAnlegen = useCallback(async (fachId, angaben) => {
    const l = noten.neueLeistung(angaben);
    let ergebnis = null;
    setNotenfaecher((alt) => alt.map((n) => {
      if (n.id !== fachId) return n;
      ergebnis = { ...n, leistungen: [...(n.leistungen || []), l], updatedAt: Date.now() };
      db.put("noten", ergebnis);
      return ergebnis;
    }));
    merkeAenderung.current();
    return l;
  }, []);

  const leistungAendern = useCallback(async (fachId, leistungId, aenderung) => {
    setNotenfaecher((alt) => alt.map((n) => {
      if (n.id !== fachId) return n;
      const neu = {
        ...n,
        leistungen: (n.leistungen || []).map((l) =>
          (l.id === leistungId ? { ...l, ...aenderung } : l)),
        updatedAt: Date.now(),
      };
      db.put("noten", neu);
      return neu;
    }));
    merkeAenderung.current();
  }, []);

  const leistungLoeschen = useCallback(async (fachId, leistungId) => {
    setNotenfaecher((alt) => alt.map((n) => {
      if (n.id !== fachId) return n;
      const neu = {
        ...n,
        leistungen: (n.leistungen || []).filter((l) => l.id !== leistungId),
        updatedAt: Date.now(),
      };
      db.put("noten", neu);
      return neu;
    }));
    merkeAenderung.current();
  }, []);

  /* ------------------------------- Fächer ------------------------------- */

  const fachAnlegen = useCallback(async (name, farbe = null, zusatz = {}) => {
    const f = { ...model.neuesFach(name || "Neues Fach", farbe), ...zusatz };
    await db.put("subjects", f);
    setFaecher((alt) => [...alt, f]);
    merkeAenderung.current();
    return f;
  }, []);

  const fachAendern = useCallback(async (kennung, aenderung) => {
    setFaecher((alt) => alt.map((f) => {
      if (f.id !== kennung) return f;
      const neu = { ...f, ...aenderung, updatedAt: Date.now() };
      db.put("subjects", neu);
      return neu;
    }));
    merkeAenderung.current();
  }, []);

  /** Das Fach verschwindet; die Stapel darin bleiben und werden fachlos. */
  const fachLoeschen = useCallback(async (kennung) => {
    const zeit = Date.now();
    setFaecher((alt) => alt.filter((f) => {
      if (f.id !== kennung) return true;
      db.put("subjects", { ...f, deleted: true, updatedAt: zeit });
      return false;
    }));
    setStapel((alt) => alt.map((s) => {
      if (s.subjectId !== kennung) return s;
      const neu = { ...s, subjectId: null, updatedAt: zeit };
      db.put("sets", neu);
      return neu;
    }));
    merkeAenderung.current();
  }, []);

  /* --------------------------- Abrufen (FSRS) --------------------------- */

  /**
   * Verbucht einen Abruf: schreibt das Review und — wenn es zählt — den neuen
   * Kartenzustand. Das ist der einzige Weg, auf dem sich Wiederholungstermine
   * ändern.
   */
  const abrufVerbuchen = useCallback(async ({
    karte, stapel, richtung = "td", bewertung, konfidenz = null,
    antwortzeit = 0, eingabeLeer = false, flag = "normal", modus = "abrufen",
    fach = null, zeit = Date.now(),
  }) => {
    const subjectId = fach?.id || stapel?.subjectId || null;
    const schluessel = karte.id + ":" + richtung;

    // Durchklicken wird festgehalten, zählt aber nicht (§5).
    const echt = istPlausibel({ antwortzeit, bewertung, eingabeLeer });
    const wirklichesFlag = flag === "normal" && !echt ? "implausible" : flag;

    const review = model.neuesReview({
      cardId: karte.id, richtung, setId: karte.setId, subjectId,
      bewertung, antwortzeit, konfidenz, flag: wirklichesFlag, modus, zeit,
    });
    await db.put("reviews", review);
    setReviews((alt) => [...alt, review]);

    const wirksam = wirklichesFlag === "normal";
    let neuerStand = null;
    setZustaende((alt) => {
      const vorher = alt[schluessel] ||
        neuerZustand(karte.id, richtung, karte.setId, subjectId, zeit);
      if (!wirksam) {
        // Zustand unberührt lassen, aber die Zugehörigkeit festhalten,
        // damit die Karte in Übersichten auftaucht.
        if (alt[schluessel]) return alt;
        db.put("cardstates", vorher);
        return { ...alt, [schluessel]: vorher };
      }
      const aufschlag = aufschlagFuer(
        [...reviews, review].filter((r) => r.cardId === karte.id && r.richtung === richtung));
      neuerStand = bewerteKarte(vorher, bewertung, {
        zielRetention: wirksameRetention(fach),
        maximalTage: fach?.maximalTage ?? 3650,
        zeit, wirksam: true, aufschlag,
      });
      db.put("cardstates", neuerStand);
      return { ...alt, [schluessel]: neuerStand };
    });

    merkeAenderung.current();
    return { review, zustand: neuerStand };
  }, [reviews]);

  /**
   * Die sieben Übungsmodi melden hierher. Sie füllen die Historie und die
   * Strähne, verschieben aber keinen Termin — Üben ist nicht Messen.
   */
  const uebungVerbuchen = useCallback(async ({
    karte, stapel, richtung = "td", gewusst, antwortzeit = 0, modus,
  }) => {
    return abrufVerbuchen({
      karte, stapel, richtung, bewertung: gewusst ? 3 : 1,
      antwortzeit, flag: "practice", modus,
    });
  }, [abrufVerbuchen]);

  /** Eine gesperrte Karte (Leech) nach der Überarbeitung wieder freigeben. */
  const karteEntsperren = useCallback(async (cardId, richtung = "td") => {
    const schluessel = cardId + ":" + richtung;
    setZustaende((alt) => {
      const z = alt[schluessel];
      if (!z) return alt;
      const neu = { ...z, gesperrt: false, nochmalZaehler: 0, lapses: 0,
        updatedAt: Date.now() };
      db.put("cardstates", neu);
      return { ...alt, [schluessel]: neu };
    });
    merkeAenderung.current();
  }, []);

  /** Lernstand eines Stapels im neuen Sinne verwerfen. */
  const zustandZuruecksetzen = useCallback(async (setId) => {
    const zeit = Date.now();
    setZustaende((alt) => {
      const neu = { ...alt };
      for (const [schluessel, z] of Object.entries(alt)) {
        if (z.setId !== setId) continue;
        const leer = neuerZustand(z.cardId, z.richtung, z.setId, z.subjectId, zeit);
        db.put("cardstates", leer);
        neu[schluessel] = leer;
      }
      return neu;
    });
    merkeAenderung.current();
  }, []);

  /** Ergebnis einer Sitzung festhalten — Grundlage für Statistik und Strähne. */
  const sitzungMerken = useCallback(async (eintrag) => {
    const rec = { id: model.id("z"), zeit: Date.now(), tag: tagesSchluessel(), ...eintrag };
    await db.put("sessions", rec);
    setSitzungen((alt) => [...alt, rec]);
    return rec;
  }, []);

  /* ----------------------------- Papierkorb --------------------------- */
  const papierkorbLesen = useCallback(async () => {
    const [o, s, k] = await Promise.all([
      db.all("folders", { mitGeloeschten: true }),
      db.all("sets", { mitGeloeschten: true }),
      db.all("cards", { mitGeloeschten: true }),
    ]);
    return {
      ordner: o.filter((x) => x.deleted),
      stapel: s.filter((x) => x.deleted),
      karten: k.filter((x) => x.deleted),
    };
  }, []);

  const wiederherstellen = useCallback(async (art, kennung) => {
    const ablage = art === "ordner" ? "folders" : art === "stapel" ? "sets" : "cards";
    const rec = await db.get(ablage, kennung);
    if (!rec) return;
    const neu = { ...rec, deleted: false, updatedAt: Date.now() };
    await db.put(ablage, neu);
    if (art === "ordner") setOrdner((alt) => [...alt, neu]);
    else if (art === "stapel") {
      setStapel((alt) => [...alt, neu]);
      const alleKarten = await db.all("cards", { mitGeloeschten: true });
      const zurueck = alleKarten.filter((k) => k.setId === kennung && k.deleted)
        .map((k) => ({ ...k, deleted: false, updatedAt: Date.now() }));
      await db.putMany("cards", zurueck);
      setKarten((alt) => [...alt, ...zurueck]);
    } else setKarten((alt) => [...alt, neu]);
  }, []);

  /* ------------------------- Sicherung als Datei ---------------------- */
  /*
   * Die Sicherung, auf Wunsch ohne Medien.
   *
   * Bilder und Tonaufnahmen machen den Groessten Teil der Datei aus. Wer
   * schnell und oft sichern will, nimmt die kleine Fassung; sie enthaelt
   * alles, woran Jahre Arbeit haengen, nur eben keine Fotos und Aufnahmen.
   */
  const alsSicherung = useCallback(async ({ mitMedien = true } = {}) => {
    /* Ueber die Liste in db.js, nicht ueber eine eigene: Eine neue Ablage darf
       nicht deshalb aus der Sicherung fallen, weil jemand hier das Nachtragen
       vergisst. Genau so ist es beim Hinzufuegen von `noten` beinahe
       geschehen. */
    const eintraege = {};
    for (const [ablage, feld] of Object.entries(db.SICHERUNG_FELDER))
      eintraege[feld] = await db.all(ablage, { mitGeloeschten: true });
    const bilder = mitMedien ? await db.all("media", { mitGeloeschten: true }) : [];
    const eingepackt = await Promise.all(bilder.map(async (b) => ({
      id: b.id, type: b.type,
      daten: await new Promise((fertig) => {
        const leser = new FileReader();
        leser.onload = () => fertig(leser.result);
        leser.onerror = () => fertig(null);
        leser.readAsDataURL(b.blob);
      }),
    })));
    return {
      fassung: 7, erzeugt: Date.now(), ...eintraege,
      bilder: eingepackt.filter((b) => b.daten), einstellungen,
      ohneMedien: !mitMedien,
    };
  }, [einstellungen]);

  const ausSicherung = useCallback(async (daten, ersetzen = false) => {
    if (!daten || !Array.isArray(daten.stapel)) throw new Error("Unbekanntes Format");
    if (ersetzen) {
      for (const ablage of Object.keys(db.SICHERUNG_FELDER)) await db.clear(ablage);
      await db.clear("media");
    }
    /* Fehlt ein Feld — etwa, weil die Sicherung aelter ist als die Ablage —,
       bleibt es leer, statt dass das Einlesen darueber stolpert. */
    for (const [ablage, feld] of Object.entries(db.SICHERUNG_FELDER))
      await db.putMany(ablage, daten[feld] || []);
    for (const b of daten.bilder || []) {
      try {
        const antwort = await fetch(b.daten);
        const blob = await antwort.blob();
        await db.put("media", { id: b.id, blob, type: b.type, updatedAt: Date.now() });
      } catch (e) { /* einzelnes Bild überspringen */ }
    }
    const [o, s, k, f, fa, cs, rv, en, xk, pr, nt] = await Promise.all([
      db.all("folders"), db.all("sets"), db.all("cards"), db.all("progress"),
      db.all("subjects"), db.all("cardstates"), db.all("reviews"), db.all("drafts"),
      db.all("explanations"), db.all("exams"), db.all("noten"),
    ]);
    setOrdner(o); setStapel(s); setKarten(k);
    setStaende(Object.fromEntries(f.map((x) => [x.id, x])));
    setFaecher(fa);
    setZustaende(Object.fromEntries(cs.map((x) => [x.id, x])));
    setReviews(rv);
    setEntwuerfe(en); setErklaerungen(xk); setPruefungen(pr); setNotenfaecher(nt);
    window.dispatchEvent(new Event(LERNZEIT_EREIGNIS));
  }, []);

  const neuLaden = useCallback(async () => {
    const [o, s, k, f, fa, cs, rv, en, xk, pr, nt] = await Promise.all([
      db.all("folders"), db.all("sets"), db.all("cards"), db.all("progress"),
      db.all("subjects"), db.all("cardstates"), db.all("reviews"), db.all("drafts"),
      db.all("explanations"), db.all("exams"), db.all("noten"),
    ]);
    setOrdner(o); setStapel(s); setKarten(k);
    setStaende(Object.fromEntries(f.map((x) => [x.id, x])));
    setFaecher(fa);
    setZustaende(Object.fromEntries(cs.map((x) => [x.id, x])));
    setReviews(rv);
    setEntwuerfe(en); setErklaerungen(xk); setPruefungen(pr); setNotenfaecher(nt);
    window.dispatchEvent(new Event(LERNZEIT_EREIGNIS));
  }, []);

  /* ------------------------------- Lernzeit ---------------------------- */

  /*
   * Die Zeitbloecke liegen bewusst nicht im gemeinsamen Zustand. Waehrend des
   * Lernens wird alle halbe Minute gesichert; laege das im Zustand, wuerde die
   * ganze App jedes Mal neu gezeichnet — mitten im Tippen einer Antwort.
   * Wer die Zahlen braucht, liest sie und horcht auf das Ereignis.
   */
  const lernzeitSpeichern = useCallback(async (saetze) => {
    if (!saetze?.length) return;
    const jetzt = Date.now();
    await db.putMany("lernzeit", saetze.map((s) => ({ ...s, updatedAt: jetzt })));
    window.dispatchEvent(new Event(LERNZEIT_EREIGNIS));
    merkeAenderung.current();
  }, []);

  const lernzeitLesen = useCallback(() => db.all("lernzeit"), []);

  /* ------------------------------ Ableitungen ------------------------- */
  const kartenNachStapel = useMemo(() => {
    const karte = new Map();
    for (const k of karten) {
      if (!karte.has(k.setId)) karte.set(k.setId, []);
      karte.get(k.setId).push(k);
    }
    for (const liste of karte.values())
      liste.sort((a, b) => (a.order - b.order) || a.id.localeCompare(b.id));
    return karte;
  }, [karten]);

  const kartenVon = useCallback((setId) => kartenNachStapel.get(setId) || [],
    [kartenNachStapel]);

  const stapelNachId = useMemo(
    () => new Map(stapel.map((s) => [s.id, s])), [stapel]);
  const stapelVon = useCallback((setId) => stapelNachId.get(setId) || null,
    [stapelNachId]);

  const fachNachId = useMemo(
    () => new Map(faecher.map((f) => [f.id, f])), [faecher]);
  const fachVon = useCallback((subjectId) => fachNachId.get(subjectId) || null,
    [fachNachId]);

  /** Das Fach eines Stapels — über die Zuordnung des Stapels. */
  const fachDesStapels = useCallback((setId) => {
    const s = stapelNachId.get(setId);
    return s?.subjectId ? fachNachId.get(s.subjectId) || null : null;
  }, [stapelNachId, fachNachId]);

  const setAenderungsMelder = useCallback((fn) => {
    merkeAenderung.current = fn || (() => {});
  }, []);

  const wert = {
    bereit, ordner, stapel, karten, staende, sitzungen, einstellungen,
    kartenNachStapel, kartenVon, stapelVon,
    setzeEinstellung,
    ordnerAnlegen, ordnerAendern, ordnerLoeschen,
    stapelAnlegen, stapelAendern, stapelLoeschen, stapelVervielfaeltigen,
    karteAnlegen, kartenAnlegenViele, karteAendern, karteLoeschen, kartenOrdnen,
    seitenTauschen,
    antwortVerbuchen, standZuruecksetzen, sitzungMerken,
    papierkorbLesen, wiederherstellen,
    alsSicherung, ausSicherung, neuLaden,
    wolkeStand, setWolkeStand, setAenderungsMelder,
    // Fassung 2
    faecher, zustaende, reviews, fachVon, fachDesStapels,
    fachAnlegen, fachAendern, fachLoeschen,
    abrufVerbuchen, uebungVerbuchen, karteEntsperren, zustandZuruecksetzen,
    // Fassung 3
    entwuerfe, entwuerfeAnlegen, entwurfAendern, entwurfVerwerfen, entwurfUebernehmen,
    // Fassung 4
    erklaerungen, erklaerungAnlegen, erklaerungFortschreiben, erklaerungLoeschen,
    // Fassung 5
    pruefungen, pruefungAnlegen, pruefungAendern, pruefungLoeschen,
    // Fassung 6
    notenfaecher, notenfachAnlegen, notenfachAendern, notenfachLoeschen,
    leistungAnlegen, leistungAendern, leistungLoeschen,
    // Fassung 7
    lernzeitSpeichern, lernzeitLesen,
  };

  return <Zusammenhang.Provider value={wert}>{children}</Zusammenhang.Provider>;
}

export function useDaten() {
  const wert = useContext(Zusammenhang);
  if (!wert) throw new Error("useDaten außerhalb des Datenspeichers");
  return wert;
}
