/*
 * Eine Datei zum Herunterladen anbieten.
 *
 * Stand bis hierher viermal fast gleich in der App: in den Einstellungen, in
 * der Stapelansicht, bei der Kalenderausfuhr und in der Notsicherung. Viermal
 * dasselbe heißt: Eine Verbesserung (etwa das Aufräumen der Adresse) wirkt
 * an drei Stellen nicht.
 */

/** → Größe der Datei in Bytes. */
export function herunterladen(name, inhalt, art = "text/plain") {
  const blob = inhalt instanceof Blob
    ? inhalt : new Blob([inhalt], { type: art + ";charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Erst später freigeben: Manche Browser laden die Datei sonst gar nicht.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return blob.size;
}
