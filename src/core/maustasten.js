/*
 * Die Seitentasten der Maus: zurück und vor.
 *
 * Im Browser-Tab blättern sie von selbst durch den Verlauf. Im Fenster der
 * installierten App (und in einem Edge-Fenster ohne Adresszeile) tun sie
 * es nicht verlässlich. Darum wertet Anchor sie selbst aus — und hält den
 * Browser davon ab, es zusätzlich zu tun, sonst ginge es zwei Schritte
 * zurück statt einem.
 *
 * Ist ein Dialog offen, schließt „zurück“ zuerst ihn, wie die Escape-Taste:
 * Man erwartet, dass die Taste das zuletzt Geöffnete zumacht, und nicht die
 * Seite dahinter verlässt.
 *
 * Tasten der Maus: 3 = hinten (zurück), 4 = vorn (vor).
 */

export const ZURUECK = 3;
export const VOR = 4;

/**
 * Was eine Maustaste auslöst. `dialogOffen` sagt, ob gerade ein Dialog
 * offen ist. Zurück kommt "dialog", "zurueck", "vor" oder null.
 */
export function handlungFuer(taste, { dialogOffen = false } = {}) {
  if (taste === ZURUECK) return dialogOffen ? "dialog" : "zurueck";
  if (taste === VOR) return dialogOffen ? null : "vor";
  return null;
}

/** Hängt die Tasten an das Fenster. Zurück kommt die Funktion zum Abhängen. */
export function maustastenEinrichten(fenster = window) {
  const dialogOffen = () => Boolean(fenster.document.querySelector(".schleier"));
  // Der Browser blättert sonst beim Loslassen selbst; das verhindert
  // preventDefault auf mousedown und mouseup gleichermaßen.
  const abfangen = (e) => {
    if (e.button === ZURUECK || e.button === VOR) e.preventDefault();
  };
  const loslassen = (e) => {
    const handlung = handlungFuer(e.button, { dialogOffen: dialogOffen() });
    if (e.button !== ZURUECK && e.button !== VOR) return;
    e.preventDefault();
    if (handlung === "dialog") {
      fenster.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    } else if (handlung === "zurueck") {
      fenster.history.back();
    } else if (handlung === "vor") {
      fenster.history.forward();
    }
  };
  fenster.addEventListener("mousedown", abfangen);
  fenster.addEventListener("mouseup", loslassen);
  fenster.addEventListener("auxclick", abfangen);
  return () => {
    fenster.removeEventListener("mousedown", abfangen);
    fenster.removeEventListener("mouseup", loslassen);
    fenster.removeEventListener("auxclick", abfangen);
  };
}
