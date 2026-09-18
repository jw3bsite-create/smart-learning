/*
 * Reihenfolge durch Ziehen: die Rechnung ohne Browser.
 */

/** Verschiebt den Eintrag an Stelle `von` nach Stelle `nach`. → neue Liste. */
export function verschiebe(liste, von, nach) {
  const neu = [...liste];
  if (von < 0 || von >= neu.length) return neu;
  const ziel = Math.max(0, Math.min(nach, neu.length - 1));
  const [eintrag] = neu.splice(von, 1);
  neu.splice(ziel, 0, eintrag);
  return neu;
}

/**
 * Wohin eine gezogene Zeile fällt.
 *
 * `mitten`  die Mitten aller Zeilen beim Anfassen (Seitenkoordinaten), in
 *           der Reihenfolge der Liste
 * `von`     die Stelle der gezogenen Zeile
 * `y`       wo der Finger jetzt ist (Seitenkoordinaten)
 *
 * Gemessen wird an den Mitten vom Anfang des Zugs, nicht an den jetzigen:
 * Die anderen Zeilen rücken während des Ziehens zur Seite, und an ihren
 * verschobenen Mitten gemessen spränge das Ziel hin und her.
 */
export function zielStelle(mitten, von, y) {
  let stelle = 0;
  for (let i = 0; i < mitten.length; i++) {
    if (i === von) continue;
    if (y > mitten[i]) stelle += 1;
  }
  return stelle;
}

/**
 * Um wie viel eine andere Zeile beim Ziehen ausweicht: um die Höhe der
 * gezogenen, nach oben oder unten, wenn sie zwischen alter und neuer Stelle
 * liegt. Sonst gar nicht.
 */
export function ausweichen(index, von, nach, hoehe) {
  if (index === von) return 0;
  if (von < nach && index > von && index <= nach) return -hoehe;
  if (von > nach && index >= nach && index < von) return hoehe;
  return 0;
}
