/*
 * Mehrere Karten auf einmal: kopieren, duplizieren, verschieben, löschen.
 *
 * Was eine Kopie mitnimmt und was nicht, ist hier festgelegt und nicht beim
 * Knopf, weil es eine Frage des Lernens ist:
 *
 * Mit geht der Inhalt — Vorder- und Rückseite, Bilder, Hinweis, Kartenart,
 * Rechenweg, Markierung, auch „abgehakt". Nicht mit geht der Lernstand. Eine
 * Kopie ist eine neue Karte; ob man sie kann, muss sich an ihr selbst zeigen.
 * Übernähme sie die Termine des Originals, stünde sie womöglich erst in
 * einem halben Jahr zum ersten Mal da.
 *
 * Beim Verschieben ist es umgekehrt: Die Karte bleibt dieselbe, also bleibt
 * auch ihr Lernstand. Nur der Stapel ändert sich.
 */

import { VORSATZ, tonSchluessel } from "./ton.js";

/** Felder, die zur Karte gehören und nicht zu ihrer Geschichte. */
const BLEIBT_WEG = ["id", "setId", "order", "updatedAt", "createdAt", "deleted"];

/**
 * Baut Kopien der Karten für einen Zielstapel, hinten angehängt.
 * `neueId` wird hereingereicht, damit sich das prüfen lässt.
 */
export function kopienVon(karten, zielSetId, { start = 0, neueId, jetzt = Date.now() }) {
  return karten.map((k, i) => {
    const inhalt = { ...k };
    for (const feld of BLEIBT_WEG) delete inhalt[feld];
    return {
      ...inhalt,
      id: neueId(),
      setId: zielSetId,
      order: start + i,
      createdAt: jetzt,
      updatedAt: jetzt,
      deleted: false,
    };
  });
}

/** Die nächste freie Stelle am Ende eines Stapels. */
export function naechsteStelle(karten, setId) {
  return karten.filter((k) => k.setId === setId && !k.deleted)
    .reduce((m, k) => Math.max(m, Number.isFinite(k.order) ? k.order : -1), -1) + 1;
}

/**
 * Welche Tonaufnahmen mit einer Kopie mitwandern.
 * → Liste von { von, nach } Kennungen. Die Aufnahme hängt an der Kennung der
 * Karte (siehe core/ton.js); ohne diesen Schritt hätte eine Kopie keine
 * eigene Stimme mehr.
 */
export function tonKopien(paare, vorhandeneMedien) {
  const da = new Set(vorhandeneMedien.filter((id) => String(id).startsWith(VORSATZ)));
  const aus = [];
  for (const { alt, neu } of paare)
    for (const seite of ["t", "d"]) {
      const von = tonSchluessel(alt, seite);
      if (da.has(von)) aus.push({ von, nach: tonSchluessel(neu, seite) });
    }
  return aus;
}
