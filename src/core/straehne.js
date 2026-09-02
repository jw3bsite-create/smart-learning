/*
 * Die Strähne — und warum sie hier anders gebaut ist.
 *
 * Eine Flamme, die das Öffnen der App belohnt, produziert genau das: geöffnete
 * Apps. Wer seine Strähne mit dreißig Sekunden Durchklicken retten kann, tut es
 * irgendwann jeden Abend, und die Zahl misst dann Gewohnheit statt Lernen.
 *
 * Darum gelten hier drei Regeln:
 *
 * 1. Gezählt werden **abgerufene Karten**, nicht Sitzungen und nicht Aufrufe.
 * 2. Zu schnell Beantwortetes zählt nicht — es trägt den Vermerk
 *    `implausible` und bleibt draußen.
 * 3. Zwei Ruhetage im Monat werden automatisch verbraucht, ehe eine Strähne
 *    reißt. Eine gerissene Strähne nach achtzig Tagen ist ein Grund
 *    aufzuhören, kein Ansporn.
 *
 * Und: Neben der Strähne steht immer die Kalibrierung. Die Strähne misst
 * Beharrlichkeit, die Kalibrierung misst Können. Wer nur auf die erste sieht,
 * lernt fleißig am Ziel vorbei.
 */

import { tagesSchluessel } from "./util.js";

/** So viele echte Abrufe machen einen Tag zum Lerntag. */
export const TAGESPENSUM = 15;

/** So viele Ruhetage stehen je Monat zur Verfügung. */
export const RUHETAGE_JE_MONAT = 2;

/** Zählt für die Strähne: gewertete Abrufe und Übung, aber nichts Unechtes. */
const zaehltFuerTag = (r) =>
  r.flag === "normal" || r.flag === "practice" || r.flag === "cram";

/**
 * Wie viele echte Abrufe an jedem Tag.
 * → Map von Tagesschlüssel auf Anzahl.
 */
export function abrufeJeTag(reviews) {
  const nach = new Map();
  for (const r of reviews) {
    if (!zaehltFuerTag(r)) continue;
    const tag = tagesSchluessel(r.zeit);
    nach.set(tag, (nach.get(tag) || 0) + 1);
  }
  return nach;
}

/** Ein Tag zählt, wenn das Pensum erreicht ist oder alles Fällige weg war. */
export function istLerntag(anzahl, pensum = TAGESPENSUM) {
  return anzahl >= pensum;
}

function tagVor(schluessel, tage) {
  const [j, m, t] = schluessel.split("-").map(Number);
  const d = new Date(j, m - 1, t);
  d.setDate(d.getDate() - tage);
  return tagesSchluessel(d.getTime());
}

/**
 * Die Strähne, rückwärts vom heutigen Tag.
 *
 * Ist heute noch nichts geschehen, bricht das die Strähne nicht — der Tag ist
 * ja noch nicht vorbei. Gezählt wird dann ab gestern.
 *
 * Lücken werden mit Ruhetagen überbrückt, solange im betreffenden Monat noch
 * welche übrig sind.
 */
export function straehne(reviews, { pensum = TAGESPENSUM, jetzt = Date.now() } = {}) {
  const jeTag = abrufeJeTag(reviews);
  const heute = tagesSchluessel(jetzt);
  const heuteZahl = jeTag.get(heute) || 0;

  let tag = istLerntag(heuteZahl, pensum) ? heute : tagVor(heute, 1);
  let laenge = 0;
  let verbrauchteRuhetage = 0;
  const ruhetageJeMonat = new Map();

  /* Ruhetage werden erst gültig, wenn danach wieder ein Lerntag kommt. Sonst
     würde das bloße Ende der Aufzeichnung Ruhetage aufbrauchen — und wer erst
     seit gestern lernt, stünde schon mit leerem Konto da. */
  let schwebend = [];

  /* Wie viele Tage die laufende Lücke schon zählt. Das Monatskontingent allein
     genügt nicht: Eine Lücke über den Monatswechsel läge in zwei Monaten und
     bekäme das Kontingent doppelt — vier ausgelassene Tage am Stück hätten die
     Strähne dann überstanden, dieselben vier Tage in der Monatsmitte nicht.
     Wie lang eine Unterbrechung sein darf, kann nicht vom Kalender abhängen. */
  let luecke = 0;

  for (let schritte = 0; schritte < 400; schritte++) {
    const zahl = jeTag.get(tag) || 0;
    if (istLerntag(zahl, pensum)) {
      laenge += 1;
      luecke = 0;
      // Alles, was seit dem letzten Lerntag übersprungen wurde, gilt jetzt.
      for (const monat of schwebend) {
        ruhetageJeMonat.set(monat, (ruhetageJeMonat.get(monat) || 0) + 1);
        verbrauchteRuhetage += 1;
      }
      schwebend = [];
      tag = tagVor(tag, 1);
      continue;
    }
    // Lücke: Lässt sie sich mit einem Ruhetag überbrücken?
    const monat = tag.slice(0, 7);
    const schonVerbraucht = (ruhetageJeMonat.get(monat) || 0)
      + schwebend.filter((m) => m === monat).length;
    if (schonVerbraucht < RUHETAGE_JE_MONAT && luecke < RUHETAGE_JE_MONAT
      && laenge > 0) {
      schwebend.push(monat);
      luecke += 1;
      tag = tagVor(tag, 1);
      continue;
    }
    break;
  }

  const monat = heute.slice(0, 7);
  return {
    laenge,
    heuteGeschafft: istLerntag(heuteZahl, pensum),
    heuteAbrufe: heuteZahl,
    fehlendHeute: Math.max(0, pensum - heuteZahl),
    verbrauchteRuhetage,
    ruhetageUebrig: Math.max(0,
      RUHETAGE_JE_MONAT - (ruhetageJeMonat.get(monat) || 0)),
  };
}

/** Die längste Strähne, die je zustande kam — für den Rückblick. */
export function laengsteStraehne(reviews, pensum = TAGESPENSUM) {
  const jeTag = abrufeJeTag(reviews);
  const tage = [...jeTag.keys()].filter((t) => istLerntag(jeTag.get(t), pensum)).sort();
  let beste = 0, laufend = 0, vorige = null;
  for (const t of tage) {
    laufend = (vorige && tagVor(t, 1) === vorige) ? laufend + 1 : 1;
    beste = Math.max(beste, laufend);
    vorige = t;
  }
  return beste;
}

/** Wie viele Karten heute noch fehlen — für die ruhige Tagesbenachrichtigung. */
export function tagesLage(reviews, faellig, pensum = TAGESPENSUM) {
  const s = straehne(reviews, { pensum });
  return {
    ...s, faellig,
    text: s.heuteGeschafft
      ? "Heute erledigt."
      : faellig > 0
        ? faellig + (faellig === 1 ? " Karte wartet" : " Karten warten")
        : s.fehlendHeute + " Abrufe fehlen für heute",
  };
}
