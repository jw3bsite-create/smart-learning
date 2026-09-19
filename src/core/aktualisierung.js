/*
 * Neue Fassungen: melden statt still umschalten.
 *
 * Bis hierher übernahm eine neue Fassung sofort (skipWaiting) und räumte
 * dabei die Dateien der alten weg. Ein Fenster, das noch mit der alten lief —
 * auf dem iPad bleibt die App tagelang im Hintergrund offen —, fand dann
 * Teile wie den Formel-Editor nicht mehr und brach ab.
 *
 * Jetzt wartet die neue Fassung, bis man „Jetzt neu laden" drückt oder alle
 * Fenster geschlossen sind. Die Oberfläche erfährt über `beobachteUpdate`,
 * dass eine wartet.
 */

const horcher = new Set();
let wartend = null;
let selbstAusgeloest = false;

/** Ruft `fn`, sobald eine neue Fassung bereitliegt. → Abmelden. */
export function beobachteUpdate(fn) {
  horcher.add(fn);
  if (wartend) fn();
  return () => horcher.delete(fn);
}

function melde(arbeiter) {
  wartend = arbeiter;
  for (const fn of horcher) fn();
}

/** Die wartende Fassung übernehmen lassen; die Seite lädt dann neu. */
export function updateAnwenden() {
  selbstAusgeloest = true;
  if (wartend) wartend.postMessage("SKIP_WAITING");
  else window.location.reload();
}

/*
 * Den Dienst-Arbeiter eintragen. Im Entwicklungslauf stört er nur.
 *
 * Der Pfad wird aus der Adresse der Seite abgeleitet, nicht fest verdrahtet:
 * Liegt die App in einem Unterordner, zeigt `/sw.js` sonst ins Leere — und ein
 * Dienst-Arbeiter, der nicht gefunden wird, nimmt die Offline-Fähigkeit mit
 * sich, ohne dass es jemand merkt.
 */
export function dienstArbeiterEinrichten() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if (!import.meta.env.PROD) return;

  // Neu laden nur, wenn wir selbst darum gebeten haben — beim allerersten
  // Besuch übernimmt der Dienst-Arbeiter ebenfalls, und da wäre ein
  // plötzliches Neuladen nur störend.
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (selbstAusgeloest) window.location.reload();
  });

  window.addEventListener("load", async () => {
    const wurzel = new URL(".", window.location.href);
    try {
      const reg = await navigator.serviceWorker.register(new URL("sw.js", wurzel),
        { scope: wurzel.pathname });
      const pruefe = (arbeiter) => {
        // Ohne bisherigen Dienst-Arbeiter ist es der erste Besuch, kein Update.
        if (arbeiter && navigator.serviceWorker.controller) melde(arbeiter);
      };
      if (reg.waiting) pruefe(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const neu = reg.installing;
        neu?.addEventListener("statechange", () => {
          if (neu.state === "installed") pruefe(neu);
        });
      });
      // Wer die App tagelang offen hat, soll trotzdem von neuen Fassungen hören.
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    } catch (e) {
      /* ohne Dienst-Arbeiter läuft die App weiter, nur nicht ohne Netz */
    }
  });
}
