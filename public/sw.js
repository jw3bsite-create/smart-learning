/*
 * Dienst-Arbeiter für den Offline-Betrieb.
 *
 * Beim ersten Anlauf sammelte er nur ein, was ohnehin gerade über die Leitung
 * kam. Das klang sparsam und war falsch: Die Bausteine der App werden geladen,
 * ehe der Dienst-Arbeit überhaupt die Aufsicht übernimmt — sie landeten also nie
 * im Speicher. Ohne Netz kam die Startseite, und dahinter eine weiße Fläche.
 *
 * Darum wird jetzt beim Einrichten eingelagert, und zwar eine Liste, die das
 * Bauwerkzeug einsetzt (siehe `dienstArbeiter` in vite.config.js). Die Namen
 * der gebauten Dateien tragen ihren Inhalt als Kennung; eine einmal abgelegte
 * Datei kann darum nie veralten, und der Speicher wird bei jedem neuen Bau
 * unter neuem Namen angelegt und der alte weggeräumt.
 */

/* Beides setzt das Bauwerkzeug ein. Im Entwicklungslauf wird dieser
   Dienst-Arbeiter nicht eingetragen, die Platzhalter stören dort also nicht. */
const STAND = "__STAND__";
const DATEIEN = "__DATEIEN__";

const CACHE = "smart-learning-" + STAND;

/*
 * Die eigene Wurzel, aus dem Geltungsbereich abgeleitet statt fest verdrahtet.
 * Liegt die App in einem Unterordner, ist "/" nicht ihre Startseite, sondern
 * die des ganzen Anbieters.
 */
const WURZEL = new URL("./", self.registration.scope).pathname;
const STARTSEITE = WURZEL + "index.html";

/** Was beim Einrichten eingelagert wird. */
function vorrat() {
  const liste = Array.isArray(DATEIEN) ? DATEIEN : [];
  return [WURZEL, STARTSEITE, ...liste.map((d) => WURZEL + d)];
}

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) =>
    // Einzeln statt addAll: Ein fehlender Baustein soll nicht den ganzen
    // Vorrat verwerfen, sonst steht man wegen einer Kleinigkeit ohne alles da.
    Promise.all(vorrat().map((pfad) => c.add(pfad).catch(() => {})))
  ));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((namen) =>
      Promise.all(namen.filter((n) => n !== CACHE).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const eigen = url.origin === self.location.origin;

  /*
   * `ignoreVary` ist hier kein Beiwerk, sondern der Grund, warum es
   * überhaupt geht.
   *
   * Viele Anbieter setzen `Vary: Origin` auf ihre Antworten. Der Speicher
   * vergleicht dann beim Nachschlagen auch die Origin-Kopfzeile — und die
   * schickt der Browser bei einem `crossorigin`-Skript mit, beim Einlagern
   * durch den Dienst-Arbeiter aber nicht. Ergebnis: Alles liegt im Speicher,
   * und trotzdem findet der Browser nichts. Genau daran ist die erste Fassung
   * gescheitert, und zwar auf die unangenehmste Art — der Abruf aus dem
   * Programm heraus gelang, nur der des Browsers nicht.
   */
  const ausSpeicher = (was) => caches.match(was, { ignoreVary: true });


  // Die Bausteine der Texterkennung kommen von einem fremden Rechner. Sie
  // werden beim ersten Mal eingelagert und danach bevorzugt von dort bedient,
  // sonst bliebe die Texterkennung ohne Netz stehen.
  const texterkennung = /tesseract/i.test(url.href) &&
    /(unpkg|jsdelivr|cdn)/i.test(url.hostname);

  if (!eigen && !texterkennung) return;

  if (texterkennung) {
    e.respondWith(ausSpeicher(req).then((treffer) => treffer || fetch(req).then((antwort) => {
      const kopie = antwort.clone();
      caches.open(CACHE).then((c) => c.put(req, kopie));
      return antwort;
    })));
    return;
  }

  // Seitenaufrufe: erst Netz, sonst die abgelegte Startseite.
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => ausSpeicher(STARTSEITE)));
    return;
  }

  /*
   * Alles Übrige zuerst aus dem Speicher. Die gebauten Dateien tragen ihren
   * Inhalt im Namen — was einmal abgelegt ist, kann nicht veralten. Fehlt
   * etwas, wird es geholt und für das nächste Mal behalten.
   */
  e.respondWith(
    ausSpeicher(req).then((treffer) => treffer || fetch(req).then((antwort) => {
      if (antwort && antwort.status === 200 && antwort.type === "basic") {
        const kopie = antwort.clone();
        caches.open(CACHE).then((c) => c.put(req, kopie));
      }
      return antwort;
    }))
  );
});
