/*
 * Der Modus „Lernen“ nach Art von Quizlet: in einer Sitzung, bis alles sitzt.
 *
 * Vom Nutzer gewünscht am 19. November 2026, an Stelle des alten „Lernen“,
 * das den Stoff über Tage verteilte (dafür ist das Abrufen da). Jede Karte
 * durchläuft drei Stufen:
 *
 *   0  neu         gefragt wird zum Wiedererkennen (Auswahl, wahr oder falsch)
 *   1  bekannt     einmal richtig erkannt — jetzt muss sie geschrieben werden
 *   2  gemeistert  auch geschrieben richtig; kommt in dieser Sitzung nicht mehr
 *
 * Falsch heißt eine Stufe zurück, und die Karte kommt am Ende der Runde noch
 * einmal. Gelernt wird in Runden (sieben Fragen, einstellbar): erst die schon
 * begonnenen Karten, dann neue — so wird ein Stück fertig, ehe das nächste
 * kommt. Zwischen den Runden steht, wie weit man ist.
 *
 * Ein Übungsmodus: Die Antworten tragen `practice` und verschieben keine
 * Termine (siehe CLAUDE.md, die zwei Wege).
 */

export const NEU = 0;
export const BEKANNT = 1;
export const GEMEISTERT = 2;

const stufeVon = (stufen, id) => Math.max(NEU, Math.min(GEMEISTERT, Number(stufen?.[id]) || 0));

/**
 * Welche Frage eine Karte auf ihrer Stufe bekommt. `arten`: welche der
 * Fragearten eingeschaltet sind. Fehlt die passende, nimmt sie die nächste.
 */
export function frageArtFuer(stufe, arten = {}, zufall = Math.random) {
  if (stufe >= BEKANNT) {
    if (arten.schreiben) return "schreiben";
    return arten.auswahl ? "auswahl" : "wahrFalsch";
  }
  const erkennen = [arten.auswahl && "auswahl", arten.wahrFalsch && "wahrFalsch"].filter(Boolean);
  if (!erkennen.length) return "schreiben";
  return erkennen[Math.floor(zufall() * erkennen.length) % erkennen.length];
}

/** Die nächste Runde: Begonnenes zuerst, dann Neues, je bis zur Rundengröße. */
export function rundeBauen(karten, stufen, { groesse = 7, arten = { auswahl: true, schreiben: true }, zufall } = {}) {
  const offen = karten.filter((k) => stufeVon(stufen, k.id) < GEMEISTERT);
  const begonnen = offen.filter((k) => stufeVon(stufen, k.id) === BEKANNT);
  const neu = offen.filter((k) => stufeVon(stufen, k.id) === NEU);
  return [...begonnen, ...neu].slice(0, Math.max(1, groesse))
    .map((karte) => ({ karte, art: frageArtFuer(stufeVon(stufen, karte.id), arten, zufall) }));
}

/** Die Stufen nach einer Antwort. */
export function nachAntwort(stufen, kartenId, richtig) {
  const alt = stufeVon(stufen, kartenId);
  return { ...stufen, [kartenId]: richtig ? Math.min(GEMEISTERT, alt + 1) : Math.max(NEU, alt - 1) };
}

/** Wie weit die Sitzung ist — für den Balken und die Zahlen. */
export function fortschritt(karten, stufen) {
  let neu = 0, bekannt = 0, gemeistert = 0;
  for (const k of karten) {
    const s = stufeVon(stufen, k.id);
    if (s === GEMEISTERT) gemeistert += 1; else if (s === BEKANNT) bekannt += 1; else neu += 1;
  }
  return { neu, bekannt, gemeistert, gesamt: karten.length, fertig: karten.length > 0 && gemeistert === karten.length };
}
