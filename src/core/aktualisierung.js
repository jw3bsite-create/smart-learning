/*
 * Neue Fassungen: beim Start still übernehmen, im Betrieb melden.
 *
 * Zuerst übernahm eine neue Fassung sofort (skipWaiting) und räumte dabei die
 * Dateien der alten weg. Ein Fenster, das noch mit der alten lief — auf dem
 * iPad bleibt die App tagelang im Hintergrund offen —, fand dann Teile wie den
 * Formel-Editor nicht mehr und brach ab.
 *
 * Daraufhin wartete jede neue Fassung, bis man „Jetzt neu laden" drückte. Das
 * war zu viel Vorsicht: Auch wer die App schloss und neu öffnete, bekam weiter
 * die alte — denn ein Neuladen beendet das Fenster nicht, der alte
 * Dienst-Arbeiter blieb an der Aufsicht, und der Hinweis stand wieder da.
 *
 * Jetzt wird unterschieden. Der Dienst-Arbeiter nennt auf Anfrage seinen Stand
 * und die Zahl der offenen Fenster (siehe public/sw.js); daraus entscheidet
 * `aktualisierungsPlan`:
 *
 *   still     Die Seite läuft schon mit dem Code dieser Fassung (die Startseite
 *             kommt am Zwischenspeicher vorbei, siehe sw.js). Dann fehlt nur
 *             noch die Aufsicht — übernehmen, ohne jemanden zu behelligen.
 *   neuladen  Der Code ist älter, aber der Nutzer hat noch nichts getan.
 *             Übernehmen und einmal neu laden; es geht nichts verloren.
 *   melden    Die App ist in Gebrauch, oder ein zweites Fenster ist offen, dem
 *             das Wegräumen der alten Dateien den Boden entziehen würde. Also
 *             der Hinweis mit „Jetzt neu laden" und die Entscheidung beim
 *             Menschen.
 */

/* Das Bauwerkzeug setzt den Stand dieser Fassung ein (`define` in
   vite.config.js) — denselben, den der Dienst-Arbeiter trägt. Außerhalb eines
   Baus (Prüfungen, Node) gibt es ihn nicht; dann bleibt er leer. */
const EIGENER_STAND = typeof __ANCHOR_STAND__ === "string" ? __ANCHOR_STAND__ : null;

/** Wie lange nach dem Laden ein Neuladen als folgenlos gilt. */
const FRUEH_MS = 20000;

const horcher = new Set();
let wartend = null;
let behandelt = null;
let selbstAusgeloest = false;
let gearbeitet = false;
const geladen = Date.now();

/**
 * Was mit einer wartenden Fassung geschehen soll — reine Entscheidung,
 * damit sie prüfbar ist.
 *
 * `fenster` ist die Zahl der offenen Fenster dieser App; ohne Antwort des
 * Dienst-Arbeiters wird vorsichtshalber mit mehreren gerechnet.
 */
export function aktualisierungsPlan({ eigenerStand, swStand, fenster, fruehPhase }) {
  // Ein zweites Fenster läuft womöglich noch mit der alten Fassung. Deren
  // Dateien verschwinden beim Übernehmen — das entscheidet kein Automat.
  if (!(fenster >= 1) || fenster > 1) return "melden";
  if (eigenerStand && swStand && eigenerStand === swStand) return "still";
  return fruehPhase ? "neuladen" : "melden";
}

/** Ruft `fn`, sobald eine neue Fassung bereitliegt und gemeldet werden soll. */
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

/** Noch in der Anfangszeit und nichts angefasst? Dann kostet Neuladen nichts. */
function fruehPhase() {
  return !gearbeitet && Date.now() - geladen < FRUEH_MS;
}

/**
 * Den Dienst-Arbeiter etwas fragen und auf Antwort warten.
 *
 * Über einen eigenen Kanal, nicht über `navigator.serviceWorker.onmessage`:
 * Gefragt wird die *wartende* Fassung, die noch niemanden beaufsichtigt.
 * Antwortet sie nicht (eine ältere Fassung kennt die Frage nicht), gilt das
 * nach kurzer Zeit als „keine Auskunft".
 */
function frage(arbeiter, nachricht, zeit = 1500) {
  return new Promise((fertig) => {
    let offen = true;
    const schliesse = (wert) => {
      if (!offen) return;
      offen = false;
      clearTimeout(uhr);
      fertig(wert);
    };
    const uhr = setTimeout(() => schliesse(null), zeit);
    try {
      const kanal = new MessageChannel();
      kanal.port1.onmessage = (e) => schliesse(e.data);
      arbeiter.postMessage(nachricht, [kanal.port2]);
    } catch (e) {
      schliesse(null);
    }
  });
}

async function behandle(arbeiter) {
  // Ohne bisherigen Dienst-Arbeiter ist es der erste Besuch, kein Update.
  if (!arbeiter || !navigator.serviceWorker.controller) return;
  if (behandelt === arbeiter) return;
  behandelt = arbeiter;

  const antwort = await frage(arbeiter, { typ: "STAND" });
  const plan = aktualisierungsPlan({
    eigenerStand: EIGENER_STAND,
    swStand: antwort && antwort.stand,
    fenster: antwort ? antwort.fenster : 0,
    fruehPhase: fruehPhase(),
  });

  if (plan === "melden") {
    melde(arbeiter);
    return;
  }
  // `wartend` bleibt leer: Es ist das Zeichen für „es gibt etwas zu melden",
  // und `beobachteUpdate` ruft einen später dazukommenden Horcher sofort.
  // Stünde die übernommene Fassung darin, erschiene der Hinweis doch noch.
  if (plan === "neuladen") selbstAusgeloest = true;
  arbeiter.postMessage("SKIP_WAITING");
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

  // Die erste Berührung beendet die Anfangszeit: Ab hier wird nichts mehr
  // ungefragt neu geladen.
  for (const art of ["pointerdown", "keydown"]) {
    window.addEventListener(art, () => { gearbeitet = true; },
      { once: true, capture: true, passive: true });
  }

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
        // `updateViaCache: "none"`: sw.js nie aus dem Zwischenspeicher des
        // Browsers lesen. Sonst entscheidet dessen Lebensdauer beim Anbieter,
        // wann eine neue Fassung überhaupt bemerkt wird.
        { scope: wurzel.pathname, updateViaCache: "none" });
      if (reg.waiting) behandle(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const neu = reg.installing;
        neu?.addEventListener("statechange", () => {
          if (neu.state === "installed") behandle(neu);
        });
      });
      // Sofort nachsehen, nicht erst in einer Stunde: Genau das ist der Fall
      // „App geschlossen, neu geöffnet, bitte die neue Fassung".
      const nachsehen = () => reg.update().catch(() => {});
      nachsehen();
      // Wer die App tagelang offen hat, soll trotzdem von neuen Fassungen
      // hören — stündlich und jedes Mal, wenn sie wieder in den Vordergrund
      // kommt (auf dem iPhone bleibt sie dort oft wochenlang liegen).
      setInterval(nachsehen, 60 * 60 * 1000);
      let zuletzt = Date.now();
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState !== "visible") return;
        if (Date.now() - zuletzt < 10 * 60 * 1000) return;
        zuletzt = Date.now();
        nachsehen();
      });
    } catch (e) {
      /* ohne Dienst-Arbeiter läuft die App weiter, nur nicht ohne Netz */
    }
  });
}
