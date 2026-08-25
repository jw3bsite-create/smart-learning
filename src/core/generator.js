/*
 * Der Kartengenerator — die Regeln, nicht die Verbindung.
 *
 * Ein Sprachmodell liefert williges, gefälliges Rohmaterial: Fragen, die man
 * durch Ausschluss beantworten kann, Fragen über zwei Absätze, Dutzende
 * Wiederholungen desselben Gedankens. Diese Datei siebt das aus, ehe es dem
 * Nutzer überhaupt gezeigt wird. Was die Anweisung in `prompts/` verlangt,
 * wird hier nachgeprüft — Anweisungen sind Bitten, kein Zwang.
 *
 * Geprüft wird ohne Modell und ohne Netz; darum steht es hier im Kern und
 * nicht in der Oberfläche.
 */

import { normalisiere } from "./text.js";
import { neuerEntwurf } from "./model.js";

/** Längste zulässige Frage. Was darüber hinausgeht, ist keine Karte. */
export const FRAGE_HOECHSTENS = 160;

/** Anfänge, die auf eine Ja-Nein-Frage hindeuten. */
const JA_NEIN = /^(ist|sind|war|waren|hat|haben|kann|können|darf|dürfen|muss|müssen|gibt es|stimmt es|gilt)\b/i;

/**
 * Siebt Vorschläge.
 * → { brauchbar: [...], verworfen: [{ grund, vorschlag }] }
 */
export function pruefeVorschlaege(rohe, vorhandeneKarten = []) {
  const bekannt = new Set(vorhandeneKarten.map((k) => normalisiere(k.term)));
  const gesehen = new Set();
  const brauchbar = [];
  const verworfen = [];

  for (const roh of Array.isArray(rohe) ? rohe : []) {
    const frage = String(roh?.frage ?? roh?.term ?? "").trim();
    const antwort = String(roh?.antwort ?? roh?.definition ?? "").trim();
    const quelle = String(roh?.quelle ?? "").trim();

    if (!frage || !antwort) {
      verworfen.push({ grund: "unvollständig", vorschlag: { frage, antwort } });
      continue;
    }
    if (frage.length > FRAGE_HOECHSTENS) {
      verworfen.push({ grund: "zu lang", vorschlag: { frage, antwort } });
      continue;
    }
    if (JA_NEIN.test(frage)) {
      verworfen.push({ grund: "mit Ja oder Nein zu beantworten", vorschlag: { frage, antwort } });
      continue;
    }
    const schluessel = normalisiere(frage);
    if (bekannt.has(schluessel)) {
      verworfen.push({ grund: "gibt es schon", vorschlag: { frage, antwort } });
      continue;
    }
    if (gesehen.has(schluessel)) {
      verworfen.push({ grund: "doppelt", vorschlag: { frage, antwort } });
      continue;
    }
    gesehen.add(schluessel);
    brauchbar.push({ frage, antwort, quelle });
  }

  return { brauchbar, verworfen };
}

/**
 * Macht aus geprüften Vorschlägen Entwürfe.
 * Die vorgeschlagene Antwort wandert nach `vorschlag` und bleibt dort
 * verborgen, bis der Nutzer seine eigene geschrieben hat.
 */
export function alsEntwuerfe(setId, vorschlaege, herkunft = "ki_vorderseite") {
  return vorschlaege.map((v) => neuerEntwurf({
    setId, term: v.frage, quelle: v.quelle || "", vorschlag: v.antwort, herkunft,
  }));
}

/**
 * Zerlegt eine lange Vorlage in Häppchen, die ein Modell am Stück verarbeiten
 * kann. Geschnitten wird an Absatzgrenzen, damit kein Gedanke zerreißt.
 */
export function inHaeppchen(text, hoechstens = 3000) {
  const absaetze = String(text || "").split(/\n{2,}/).map((a) => a.trim()).filter(Boolean);
  const stuecke = [];
  let laufend = "";
  for (const absatz of absaetze) {
    if (laufend && (laufend.length + absatz.length + 2) > hoechstens) {
      stuecke.push(laufend);
      laufend = absatz;
    } else {
      laufend = laufend ? laufend + "\n\n" + absatz : absatz;
    }
  }
  if (laufend) stuecke.push(laufend);
  // Ein einzelner Absatz kann für sich zu lang sein — dann hart schneiden.
  return stuecke.flatMap((s) => hartTeilen(s, hoechstens))
    .map((s) => s.trim()).filter(Boolean);
}

/**
 * Schneidet ein zu langes Stück, möglichst an einem Zwischenraum.
 *
 * Bewusst von Hand statt mit einem Suchmuster: Ein Muster, das auf eine
 * Wortgrenze besteht, findet in einer Zeichenkette ohne Zwischenräume gar
 * nichts und lässt Text stillschweigend unter den Tisch fallen. Hier geht
 * nichts verloren — im Zweifel wird mitten im Wort getrennt.
 */
function hartTeilen(text, hoechstens) {
  const stuecke = [];
  let rest = String(text || "");
  while (rest.length > hoechstens) {
    const zwischenraum = rest.lastIndexOf(" ", hoechstens);
    // Liegt der letzte Zwischenraum ganz vorn, taugt er nicht als Schnittstelle.
    const schnitt = zwischenraum > hoechstens * 0.5 ? zwischenraum : hoechstens;
    stuecke.push(rest.slice(0, schnitt));
    rest = rest.slice(schnitt).replace(/^\s+/, "");
  }
  if (rest) stuecke.push(rest);
  return stuecke;
}

/**
 * Wie viel Eigenleistung steckt im Stapel?
 * Der Anteil übernommener KI-Rückseiten ist der Verfallsindikator der App.
 */
export function eigenleistung(karten) {
  const zaehler = { selbst: 0, ki_vorderseite: 0, ki_uebernommen: 0, einfuhr: 0 };
  for (const k of karten) {
    const h = k.created_by || "selbst";
    if (zaehler[h] === undefined) zaehler.selbst += 1;
    else zaehler[h] += 1;
  }
  const gesamt = karten.length || 1;
  return {
    ...zaehler, gesamt: karten.length,
    anteilUebernommen: zaehler.ki_uebernommen / gesamt,
    anteilSelbst: (zaehler.selbst + zaehler.ki_vorderseite) / gesamt,
  };
}
