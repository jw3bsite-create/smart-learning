/*
 * Umstellungen am Datenbestand — nummeriert, einmalig, mit Sicherung davor.
 *
 * Wenn sich ändert, wie ein Eintrag aussehen soll (ein neues Feld, eine
 * andere Regel), dann nicht irgendwo beim Laden nebenbei flicken, sondern
 * hier eine Umstellung mit der nächsten Nummer anhängen. Der Speicher merkt
 * sich die zuletzt ausgeführte Nummer (`datenFassung`); beim Start laufen
 * nur die neueren, der Reihe nach.
 *
 * Vor der ersten ausstehenden Umstellung wird eine Kopie des Bestands in die
 * zweite Datenbank gelegt. Gelingt das nicht, wird nichts umgestellt — lieber
 * ein Start mit der alten Form als eine Umstellung ohne Netz.
 *
 * Jede Umstellung ist eine reine Rechnung: Sie bekommt die Einträge der
 * Ablagen, die sie braucht, und gibt zurück, was geschrieben werden soll.
 * So lässt sie sich ohne Browser prüfen. Geschrieben wird je Umstellung in
 * einem Zug, zusammen mit der neuen Nummer.
 *
 * Eine einmal veröffentlichte Umstellung wird nie mehr geändert — sie ist
 * auf manchem Gerät schon gelaufen. Wer etwas korrigieren muss, hängt eine
 * neue an.
 */

import { nachAlterRegelGesperrt, freigeben } from "./fsrs.js";

export const MIGRATIONEN = [
  {
    nummer: 1,
    name: "Karten freigeben, die nach der alten, zu strengen Regel gesperrt wurden",
    ablagen: ["cardstates"],
    anwenden({ cardstates }, jetzt) {
      /* Vorher genügten sechs „Nochmal" insgesamt, auch aus den ersten
         Lernschritten, und freigeben ließ sich nichts. Nach der neuen Regel
         zählen nur Rückfälle — was danach nicht gesperrt wäre, kommt frei. */
      const frei = cardstates
        .filter((z) => !z.deleted && nachAlterRegelGesperrt(z))
        .map((z) => ({ ...freigeben(z, jetzt), lapsesFreigabe: 0 }));
      return { schreiben: { cardstates: frei } };
    },
  },
  {
    nummer: 2,
    name: "Große Schrift aus Fassung 1 in eine Punktgröße übertragen",
    ablagen: [],
    anwenden({ einstellungen }) {
      /* Stand bis hierher als Flicken im Laden. Wer den alten Schalter an
         hatte, bekommt die entsprechende Größe — sonst stünde die Oberfläche
         plötzlich wieder klein da. */
      if (!einstellungen?.schriftGross || einstellungen.schriftgroesse !== undefined) return {};
      return { einstellungen: { ...einstellungen, schriftgroesse: 17 } };
    },
  },
];

export const LETZTE = MIGRATIONEN[MIGRATIONEN.length - 1].nummer;

/** Welche Umstellungen noch ausstehen, der Reihe nach. */
export function ausstehend(stand, liste = MIGRATIONEN) {
  return liste.filter((m) => m.nummer > (Number(stand) || 0))
    .sort((a, b) => a.nummer - b.nummer);
}

/**
 * Führt ausstehende Umstellungen aus. `db` ist das Speichermodul (oder ein
 * gleichgebauter Ersatz in den Prüfungen).
 * → Liste der Namen, die gelaufen sind.
 */
export async function migrieren(db, { jetzt = Date.now(), liste = MIGRATIONEN } = {}) {
  const stand = Number(await db.getSetting("datenFassung", 0)) || 0;
  const offen = ausstehend(stand, liste);
  if (!offen.length) return [];

  // Ein ganz neuer Speicher braucht keine Umstellung und keine Sicherung.
  const bestand = await db.lesenMehrere(["cards", "cardstates"], { mitGeloeschten: true });
  const leer = !bestand.cards.length && !bestand.cardstates.length
    && !(await db.getSetting("einstellungen", null));
  if (leer) {
    await db.setSetting("datenFassung", offen[offen.length - 1].nummer);
    return [];
  }

  await db.sicherungAnlegen("vor-umstellung-" + offen[0].nummer);

  const gelaufen = [];
  for (const m of offen) {
    const daten = await db.lesenMehrere(m.ablagen, { mitGeloeschten: true });
    daten.einstellungen = await db.getSetting("einstellungen", null);
    const ergebnis = m.anwenden(daten, jetzt) || {};
    const schreiben = { ...(ergebnis.schreiben || {}) };
    schreiben.settings = [
      ...(ergebnis.einstellungen ? [{ key: "einstellungen", value: ergebnis.einstellungen }] : []),
      { key: "datenFassung", value: m.nummer },
    ];
    await db.schreibeMehrere(schreiben);
    gelaufen.push(m.name);
  }
  return gelaufen;
}
