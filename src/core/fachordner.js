/*
 * Ordner in Fächern.
 *
 * Ein Fach mit zwanzig Stapeln wird unübersichtlich: Analysis neben
 * Stochastik neben Geometrie, alphabetisch durcheinander. Darum lassen sich
 * in einem Fach Ordner anlegen — „Analysis", „Klausur 1", „Abiturthemen".
 *
 * Es gibt dafür kein zweites Ordnersystem. Ein Fachordner ist ein
 * gewöhnlicher Ordner mit `subjectId`. So laufen Abgleich, Sicherung und
 * Papierkorb ohne jede Änderung mit, und an den gespeicherten Daten ändert
 * sich nichts außer diesem einen Feld.
 *
 * Die Regeln:
 *
 * - Ein Fachordner gehört zu genau einem Fach und erscheint nur dort, nicht
 *   im allgemeinen Ordnerbaum unter „Stapel verwalten".
 * - Gibt es das Fach nicht mehr, ist der Ordner wieder ein gewöhnlicher
 *   Ordner. Nichts verschwindet, nur weil ein Fach gelöscht wurde.
 * - Ein Stapel liegt in einem Fachordner, wenn sein `folderId` dorthin zeigt
 *   und er zu diesem Fach gehört. Alle anderen Stapel des Fachs stehen auf
 *   der obersten Ebene des Fachs — auch die, die in einem allgemeinen Ordner
 *   liegen.
 * - „Abrufen“ nimmt das ganze Fach. Auf Wunsch nur ausgewählte Ordner
 *   (`abrufStapel` unten); die übrigen fälligen Karten bleiben fällig.
 */

/** Die Kennungen der Fächer, die es gibt. */
export function fachKennungen(faecher) {
  return new Set((faecher || []).filter((f) => !f.deleted).map((f) => f.id));
}

/** Gehört dieser Ordner zu einem bestehenden Fach? */
export function istFachordner(ordner, faecherIds) {
  return Boolean(ordner?.subjectId) && faecherIds.has(ordner.subjectId);
}

/** Die Ordner, die im allgemeinen Ordnerbaum erscheinen. */
export function allgemeineOrdner(ordner, faecher) {
  const ids = fachKennungen(faecher);
  return ordner.filter((o) => !istFachordner(o, ids));
}

/**
 * Die Ordner eines Fachs auf einer Ebene: oben (`elternId` null) oder in
 * einem anderen Fachordner. Ein Ordner, dessen Elternteil fehlt oder zu
 * einem anderen Fach gehört, steht oben — sonst wäre er unauffindbar.
 */
export function ordnerImFach(ordner, fachId, elternId = null) {
  const eigene = ordner.filter((o) => o.subjectId === fachId && !o.deleted);
  const ids = new Set(eigene.map((o) => o.id));
  return eigene
    .filter((o) => (elternId
      ? o.parentId === elternId
      : !o.parentId || !ids.has(o.parentId)))
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", "de"));
}

/**
 * Die Stapel eines Fachs auf einer Ebene. Oben stehen alle Stapel des Fachs,
 * die in keinem seiner Fachordner liegen.
 */
export function stapelImFach(stapel, ordner, fachId, ordnerId = null) {
  const eigeneOrdner = new Set(ordner.filter((o) => o.subjectId === fachId && !o.deleted)
    .map((o) => o.id));
  return stapel.filter((s) => !s.deleted && s.subjectId === fachId && (ordnerId
    ? s.folderId === ordnerId
    : !eigeneOrdner.has(s.folderId)));
}

/** Alle Ordner unterhalb eines Fachordners, ihn selbst eingeschlossen. */
export function fachordnerZweig(ordner, kennung) {
  const zweig = new Set([kennung]);
  let gewachsen = true;
  while (gewachsen) {
    gewachsen = false;
    for (const o of ordner)
      if (!o.deleted && o.parentId && zweig.has(o.parentId) && !zweig.has(o.id)) {
        zweig.add(o.id);
        gewachsen = true;
      }
  }
  return zweig;
}

/**
 * Was beim Auflösen eines Fachordners geschieht: Seine Stapel und
 * Unterordner rücken eine Ebene hinauf, er selbst geht in den Papierkorb.
 * Kein Stapel und keine Karte wird dabei gelöscht.
 *
 * Zurück kommen die geänderten Datensätze, fertig zum Schreiben.
 */
export function aufloesenPlan(ordner, stapel, kennung, zeit) {
  const derOrdner = ordner.find((o) => o.id === kennung);
  if (!derOrdner) return { ordner: [], stapel: [] };
  const hinauf = derOrdner.parentId || null;
  const unterordner = ordner.filter((o) => !o.deleted && o.parentId === kennung)
    .map((o) => ({ ...o, parentId: hinauf, updatedAt: zeit }));
  const umzug = stapel.filter((s) => !s.deleted && s.folderId === kennung)
    .map((s) => ({ ...s, folderId: hinauf, updatedAt: zeit }));
  return {
    ordner: [...unterordner, { ...derOrdner, deleted: true, updatedAt: zeit }],
    stapel: umzug,
  };
}

/**
 * Wechselt ein Stapel das Fach, verlässt er einen Fachordner des alten
 * Fachs — im neuen Fach stünde er sonst in einem Ordner, den es dort nicht
 * gibt. In einem allgemeinen Ordner bleibt er.
 */
export function ordnerNachFachwechsel(stapel, ordner, neuesFach) {
  const derOrdner = ordner.find((o) => o.id === stapel.folderId);
  if (!derOrdner?.subjectId) return stapel.folderId ?? null;
  return derOrdner.subjectId === (neuesFach || null) ? stapel.folderId : null;
}

/** Der Pfad vom obersten Fachordner bis zu diesem. */
export function fachordnerPfad(ordner, kennung) {
  const pfad = [];
  const gesehen = new Set();
  let lauf = ordner.find((o) => o.id === kennung);
  while (lauf && !gesehen.has(lauf.id)) {
    gesehen.add(lauf.id);
    pfad.unshift(lauf);
    const eltern = lauf.parentId ? ordner.find((o) => o.id === lauf.parentId) : null;
    lauf = eltern && eltern.subjectId === lauf.subjectId ? eltern : null;
  }
  return pfad;
}

/*
 * Abrufen nach Ordnern (vom Nutzer so entschieden, Oktober 2026).
 *
 * Grundsätzlich ruft Anchor das ganze Fach ab: Was fällig ist, ist fällig,
 * egal in welchem Ordner es steht. Wer aber gerade nur „Romantik“ braucht,
 * kann Ordner auswählen. Die übrigen fälligen Karten des Fachs bleiben dann
 * fällig und kommen beim nächsten Abrufen des ganzen Fachs dran.
 *
 * `auswahl` enthält Ordnerkennungen und optional OBEN für die Stapel, die
 * in keinem Fachordner liegen. Ein Ordner bringt seine Unterordner mit.
 * Zurück kommt die Menge der Stapelkennungen, die abgerufen werden.
 */
export const OBEN = "oben";

export function abrufStapel(stapel, ordner, fachId, auswahl) {
  const eigeneOrdner = ordner.filter((o) => o.subjectId === fachId && !o.deleted);
  const ids = new Set(eigeneOrdner.map((o) => o.id));
  const erlaubt = new Set();
  for (const wahl of auswahl || []) {
    if (wahl !== OBEN && ids.has(wahl)) for (const id of fachordnerZweig(eigeneOrdner, wahl)) erlaubt.add(id);
  }
  const oben = (auswahl || []).includes(OBEN);
  return new Set(stapel
    .filter((s) => !s.deleted && s.subjectId === fachId
      && (erlaubt.has(s.folderId) || (oben && !ids.has(s.folderId))))
    .map((s) => s.id));
}
