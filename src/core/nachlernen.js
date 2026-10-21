/*
 * Nachlernen in derselben Sitzung.
 *
 * Wer eine Karte mit „Nochmal" bewertet, sah sie bisher erst in der nächsten
 * Sitzung wieder — oft am nächsten Tag. Dazwischen liegt kein zweiter
 * Abrufversuch, nur das Vergessen. Hier kommt die Karte ein paar Karten
 * später noch einmal dran, wie bei den Lernschritten in Anki. FSRS verbucht
 * den zweiten Versuch als Wiederholung im Neulernen.
 *
 * Zwei Grenzen: höchstens zweimal nachlernen je Karte und Sitzung (sonst
 * kreist eine harte Karte endlos), und nie direkt hintereinander — mit
 * ein paar Karten Abstand wird wirklich abgerufen, nicht nachgesprochen.
 *
 * Eine nachgereihte Karte kommt ohne Selbsteinschätzung: Wer die Antwort
 * eben gesehen hat, ist „sicher", und das hätte mit Kalibrierung nichts zu
 * tun. Ohne Einschätzung zählt der Versuch dort nicht mit.
 */

export const ABSTAND = 4;       // so viele Karten liegen dazwischen
export const HOECHSTENS = 2;    // so oft kommt eine Karte je Sitzung zurück

/**
 * Reiht eine eben verfehlte Aufgabe wieder ein. Zurück kommt die neue Liste
 * (oder die alte, wenn die Karte schon oft genug zurückkam).
 */
export function wiederEinreihen(aufgaben, stelle, aufgabe, { abstand = ABSTAND, hoechstens = HOECHSTENS } = {}) {
  const schon = aufgabe.wiederholung || 0;
  if (schon >= hoechstens) return aufgaben;
  const kopie = { ...aufgabe, wiederholung: schon + 1 };
  const ziel = Math.min(stelle + 1 + abstand, aufgaben.length);
  // Am Ende der Liste, wenn nicht mehr genug Karten folgen — aber nie
  // unmittelbar danach, solange es eine andere Karte gibt.
  const neu = [...aufgaben];
  neu.splice(ziel, 0, kopie);
  return neu;
}

/** Nimmt die zuletzt eingereihte Kopie wieder heraus (für „Rückgängig"). */
export function einreihungZuruecknehmen(aufgaben, stelle, schluessel, wiederholung) {
  const i = aufgaben.findIndex((a, j) => j > stelle && a.schluessel === schluessel
    && (a.wiederholung || 0) === wiederholung);
  if (i < 0) return aufgaben;
  return [...aufgaben.slice(0, i), ...aufgaben.slice(i + 1)];
}

/** Nur erste Versuche zählen für das Ergebnis der Sitzung. */
export const ersterVersuch = (e) => !e.wiederholung;
