/*
 * Der Fragemodus: eine Handvoll Fragen, quer durch, gewichtet.
 *
 * Der Unterschied zum Abrufen ist wichtig genug, ihn hier hinzuschreiben.
 *
 * **Abrufen** ist der Plan. Was drankommt, entscheidet FSRS aus dem, was beim
 * letzten Mal geschehen ist; der Nutzer wählt Fach und Umfang, mehr nicht.
 * Nur dort entstehen Termine.
 *
 * **Der Fragemodus** ist das Gegenteil: Man sagt „gib mir zwanzig Fragen" und
 * bekommt zwanzig Fragen. Er verschiebt keine Termine — die Antworten tragen
 * den Vermerk `practice`. Sonst wäre er eine Hintertür, durch die man sich
 * seine Wiederholungen selbst zusammenstellt, und genau das soll die App
 * nicht zulassen.
 *
 * Was er darf: die Auswahl gewichten. Wer in vier Tagen eine Arbeit in Chemie
 * schreibt, soll mehr Chemie sehen. Wer in einem Fach schlechte Punkte hat,
 * soll es öfter sehen. Wer ein Fach als vordringlich markiert hat, auch. Das
 * ist keine Selbstauswahl von Karten — es ist eine Gewichtung von Fächern,
 * und die trifft der Nutzer ohnehin, nur bisher im Kopf.
 */

import { istRelevant, richtungenFuer, prioritaetVon, PRIORITAETEN } from "./model.js";
import { istNeu, istFaellig, behaltenswahrscheinlichkeit } from "./fsrs.js";

const TAG = 24 * 3600 * 1000;

/** Die angebotenen Umfänge. Eine eigene Zahl geht auch. */
export const UMFAENGE = [10, 20, 30, 50];

/** Ab hier gilt ein Termin als nah genug, um die Auswahl zu verschieben. */
export const TERMIN_HORIZONT_TAGE = 60;

/* ===================================================================== */
/*  Gewichte                                                             */
/* ===================================================================== */

/**
 * Wie sehr ein naher Termin ein Fach nach vorn zieht.
 *
 * Bei sechzig Tagen und mehr: gar nicht (1,0). Am Tag der Prüfung: dreifach.
 * Dazwischen gleichmäßig. Kein Termin heißt kein Zuschlag — nicht etwa ein
 * Abschlag, sonst würde ein Fach ohne eingetragenen Termin stillschweigend
 * seltener drankommen, und das wäre eine Folge des Nichteintragens, keine
 * Entscheidung.
 */
export function terminGewicht(fach, zeit = Date.now()) {
  const termin = Number(fach?.pruefungsdatum) || 0;
  if (!termin) return 1;
  const tage = (termin - zeit) / TAG;
  if (tage > TERMIN_HORIZONT_TAGE) return 1;
  if (tage < 0) return 1;          // vorbei — kein Zuschlag mehr
  return 1 + 2 * (1 - tage / TERMIN_HORIZONT_TAGE);
}

/**
 * Wie sehr schwache Punkte ein Fach nach vorn ziehen.
 *
 * Fünfzehn Punkte: kein Zuschlag. Null Punkte: doppelt. Ohne eingetragene
 * Punkte: kein Zuschlag — dasselbe Argument wie beim Termin.
 *
 * Das ist die Stelle, an der die Punkte auf das Lernen zurückwirken. Ohne sie
 * wären sie bloß Buchhaltung.
 */
export function punkteGewicht(punkte) {
  if (punkte === null || punkte === undefined) return 1;
  const p = Math.min(15, Math.max(0, Number(punkte)));
  return 1 + (15 - p) / 15;
}

/** Was der Nutzer selbst für vordringlich hält. */
export function prioritaetsGewicht(fach) {
  return PRIORITAETEN[prioritaetVon(fach)].faktor;
}

/**
 * Das Gewicht eines Fachs, aus allen drei Gründen zusammen.
 * → { gewicht, gruende } — die Gründe für die Anzeige, damit nicht
 * unerklärlich bleibt, warum ein Fach häufiger vorkommt.
 */
export function fachGewicht(fach, { punkte = null, zeit = Date.now() } = {}) {
  const termin = terminGewicht(fach, zeit);
  const punkt = punkteGewicht(punkte);
  const prio = prioritaetsGewicht(fach);
  const gruende = [];
  if (termin > 1.05) {
    const tage = Math.max(0, Math.round((fach.pruefungsdatum - zeit) / TAG));
    gruende.push(tage === 0 ? "Prüfung heute" : "Prüfung in " + tage + " Tagen");
  }
  if (punkt > 1.05) gruende.push("schwache Punkte");
  if (prio > 1.05) gruende.push("vordringlich");
  if (prio < 0.95) gruende.push("nebenbei");
  return { gewicht: termin * punkt * prio, gruende };
}

/* ===================================================================== */
/*  Auswählen                                                            */
/* ===================================================================== */

/**
 * Zieht `wieviel` Aufgaben ohne Zurücklegen, wobei jede ihr Gewicht hat.
 *
 * Ein schlichtes Sortieren nach Gewicht wäre keine Mischung, sondern eine
 * Rangliste: Man bekäme immer dieselben Karten. Darum wird gezogen — jede
 * Karte kann drankommen, die aus einem schweren Fach nur öfter.
 */
function ziehe(eintraege, wieviel, wuerfel = Math.random) {
  const topf = [...eintraege];
  const gezogen = [];
  let summe = topf.reduce((s, e) => s + e.gewicht, 0);
  while (gezogen.length < wieviel && topf.length) {
    let ziel = wuerfel() * summe;
    let i = 0;
    while (i < topf.length - 1 && ziel > topf[i].gewicht) {
      ziel -= topf[i].gewicht;
      i += 1;
    }
    summe -= topf[i].gewicht;
    gezogen.push(topf[i]);
    topf.splice(i, 1);
  }
  return gezogen;
}

/**
 * Wie dringend eine einzelne Karte ist — innerhalb ihres Fachs.
 *
 * Überfälliges zuerst, dann Wackliges, dann Ungesehenes, dann der Rest. Das
 * ist kein Ersatz für den Planer: Es entscheidet nur, welche Karte aus einem
 * Fach gezogen wird, wenn das Fach dran ist.
 */
export function kartenGewicht(zustand, zeit = Date.now()) {
  if (!zustand) return 1.4;                       // noch nie gesehen
  if (zustand.gesperrt) return 0;                 // stillgelegt, bleibt draußen
  if (istNeu(zustand)) return 1.4;
  if (istFaellig(zustand, zeit)) {
    const tageUeber = Math.max(0, (zeit - zustand.due) / TAG);
    return 2 + Math.min(2, tageUeber / 7);        // je überfälliger, desto eher
  }
  // Noch nicht fällig: je unsicherer, desto eher.
  const r = behaltenswahrscheinlichkeit(zustand, zeit);
  return 0.3 + (1 - r);
}

/**
 * Stellt eine Runde Fragen zusammen.
 *
 * `karten`      alle Karten
 * `zustaende`   Verzeichnis `<karte>:<richtung>` → Zustand
 * `stapelVon`   setId → Stapel
 * `faecherVon`  Liste der Fächer
 * `punkteVon`   fachId → Punktzahl oder null
 * `umfang`      wie viele Fragen
 * `bereich`     { art: "alles" | "fach" | "stapel" | "ordner", id }
 * `gewichten`   false = reiner Zufall, true = nach Termin, Punkten, Priorität
 */
export function baueFragen({
  karten, zustaende, stapelVon, faecherVon = () => [], punkteVon = () => null,
  umfang = 20, bereich = { art: "alles" }, gewichten = true,
  zeit = Date.now(), wuerfel = Math.random, ordnerZweigIds = null,
}) {
  const faecher = faecherVon() || [];
  const fachNach = Object.fromEntries(faecher.map((f) => [f.id, f]));

  const gewichtJeFach = {};
  for (const f of faecher)
    gewichtJeFach[f.id] = gewichten
      ? fachGewicht(f, { punkte: punkteVon(f.id), zeit }).gewicht
      : 1;

  const eintraege = [];
  let abgehakt = 0;

  for (const karte of karten) {
    if (karte.deleted) continue;
    if (!istRelevant(karte)) { abgehakt += 1; continue; }
    const stapel = stapelVon(karte.setId);
    if (!stapel) continue;

    if (bereich.art === "stapel" && stapel.id !== bereich.id) continue;
    if (bereich.art === "fach" && stapel.subjectId !== bereich.id) continue;
    if (bereich.art === "ordner"
      && !(ordnerZweigIds && ordnerZweigIds.has(stapel.folderId))) continue;

    const fachId = stapel.subjectId || null;
    const fachTeil = gewichten ? (gewichtJeFach[fachId] ?? 1) : 1;

    for (const richtung of richtungenFuer(karte, stapel)) {
      const zustand = zustaende[karte.id + ":" + richtung];
      const kartenTeil = gewichten ? kartenGewicht(zustand, zeit) : 1;
      if (kartenTeil <= 0) continue;              // stillgelegt
      eintraege.push({
        karte, stapel, richtung, zustand, fachId,
        fach: fachNach[fachId] || null,
        schluessel: karte.id + ":" + richtung,
        gewicht: fachTeil * kartenTeil,
      });
    }
  }

  const aufgaben = ziehe(eintraege, Math.min(umfang, eintraege.length), wuerfel);

  /* Die Gründe, warum die Mischung so aussieht — damit die Gewichtung nicht
     als Willkür erscheint. Sortiert nach Gewicht, das schwerste zuerst. */
  const beteiligt = [...new Set(aufgaben.map((a) => a.fachId))]
    .map((fid) => {
      const f = fachNach[fid];
      if (!f) return null;
      const { gewicht, gruende } = fachGewicht(f, { punkte: punkteVon(fid), zeit });
      return {
        fach: f, gewicht, gruende,
        anzahl: aufgaben.filter((a) => a.fachId === fid).length,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.anzahl - a.anzahl);

  return {
    aufgaben,
    vorrat: eintraege.length,
    abgehakt,
    beteiligt: gewichten ? beteiligt : [],
  };
}
