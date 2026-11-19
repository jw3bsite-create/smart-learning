/*
 * Die Mitteilungen hinter der Glocke (ui/Glocke.jsx).
 *
 * Wenige und nur, wenn sie etwas zu tun geben — sonst gewöhnt man sich an
 * die rote Zahl und sieht sie nicht mehr. Drei Arten, vom Nutzer gewählt am
 * 19. November 2026:
 *
 *   pruefung  Eine Prüfung ist höchstens eine Woche entfernt, und im Fach ist
 *             noch etwas offen.
 *   ruht      Ein Stapel ruht länger als die Zeit, nach der er erinnert
 *             werden wollte (core/model.js, `ruht`).
 *   lange     In einem Fach, in dem schon abgerufen wurde, seit drei Wochen
 *             nicht mehr — und es ist etwas fällig.
 *
 * Höchstens vier zugleich, die dringendsten zuerst. „Ausblenden“ legt eine
 * Mitteilung für eine Weile weg (`verworfen`: Kennung → bis wann); besteht
 * der Anlass danach noch, kommt sie wieder.
 */

import { ruht } from "./model.js";
import { fachZaehlung, rueckkehrStand, tageBisPruefung } from "./warteschlange.js";

const TAG = 86400000;
export const HOECHSTENS = 4;
export const LANGE_TAGE = 21;
export const PRUEFUNG_TAGE = 7;

/* Wie lange „Ausblenden“ hält, je Art. */
export const RUHE = { pruefung: 2 * TAG, ruht: 14 * TAG, lange: 7 * TAG };

const RANG = { pruefung: 0, ruht: 1, lange: 2 };

const karten1 = (n, eine, viele) => (n === 1 ? eine : n + " " + viele);

export function mitteilungenBilden({
  stapel = [], faecher = [], karten = [], zustaende = {}, reviews = [], stapelVon,
  verworfen = {}, zeit = Date.now(),
}) {
  const aus = [];
  const lebendeFaecher = faecher.filter((f) => !f.deleted);

  /* Prüfung naht */
  for (const fach of lebendeFaecher) {
    const tage = tageBisPruefung(fach, zeit);
    if (tage === null || tage < 0 || tage > PRUEFUNG_TAGE) continue;
    const z = fachZaehlung(karten, zustaende, stapelVon, fach.id, zeit);
    const offen = z.faellig + z.neu;
    if (!offen) continue;
    aus.push({
      id: "pruefung:" + fach.id + ":" + fach.pruefungsdatum, art: "pruefung", weg: "/fach/" + fach.id,
      text: fach.name + ": Prüfung " + (tage === 0 ? "heute" : tage === 1 ? "morgen" : "in " + tage + " Tagen")
        + ", " + karten1(offen, "eine Karte", "Karten") + " offen.",
      dringend: tage,
    });
  }

  /* Ruhende Stapel, deren Zeit um ist */
  for (const s of stapel) {
    if (s.deleted || !ruht(s) || !s.ruht.tage) continue;
    const tage = Math.floor((zeit - s.ruht.seit) / TAG);
    if (tage < s.ruht.tage) continue;
    const { faellig } = rueckkehrStand(karten, zustaende, s, zeit);
    aus.push({
      id: "ruht:" + s.id + ":" + s.ruht.seit, art: "ruht", weg: "/stapel/" + s.id, stapelId: s.id,
      text: "„" + (s.title || "Ohne Titel") + "“ ruht seit " + tage + " Tagen."
        + (faellig ? " Zurückgeholt " + (faellig === 1 ? "wäre eine Karte" : "wären " + faellig + " Karten")
          + " fällig." : ""),
      dringend: -tage,
    });
  }

  /* Lange nicht abgerufen — gezählt werden nur echte Abrufe, keine Übung. */
  const zuletzt = new Map();
  for (const r of reviews) {
    if (r.deleted || r.flag !== "normal" || !r.subjectId) continue;
    if ((zuletzt.get(r.subjectId) || 0) < r.zeit) zuletzt.set(r.subjectId, r.zeit);
  }
  for (const fach of lebendeFaecher) {
    const letzte = zuletzt.get(fach.id);
    if (!letzte) continue;                         // nie begonnen: kein „seit“
    const tage = Math.floor((zeit - letzte) / TAG);
    if (tage < LANGE_TAGE) continue;
    const { faellig } = fachZaehlung(karten, zustaende, stapelVon, fach.id, zeit);
    if (!faellig) continue;
    const wochen = Math.floor(tage / 7);
    aus.push({
      id: "lange:" + fach.id, art: "lange", weg: "/fach/" + fach.id,
      text: fach.name + ": seit " + wochen + " Wochen nicht abgerufen, "
        + karten1(faellig, "eine Karte", "Karten") + " fällig.",
      dringend: -tage,
    });
  }

  return aus
    .filter((m) => !((verworfen[m.id] || 0) > zeit))
    .sort((a, b) => RANG[a.art] - RANG[b.art] || a.dringend - b.dringend)
    .slice(0, HOECHSTENS);
}

/** Abgelaufenes aus der Liste der ausgeblendeten Mitteilungen werfen. */
export function verworfenAufraeumen(verworfen = {}, zeit = Date.now()) {
  return Object.fromEntries(Object.entries(verworfen).filter(([, bis]) => bis > zeit));
}
