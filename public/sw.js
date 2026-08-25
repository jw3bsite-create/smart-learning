/*
 * Dienst-Arbeiter für den Offline-Betrieb.
 *
 * Bewusst schlicht: alle eigenen Dateien werden beim Abruf zwischengespeichert
 * und beim nächsten Mal zuerst aus dem Speicher bedient, während im Hintergrund
 * eine frische Fassung geholt wird. So läuft die App ohne Netz weiter, ohne
 * dass wir die Dateinamen des Bauwerkzeugs kennen müssen.
 */
const CACHE = "karteikasten-v1";

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/", "/index.html"]).catch(() => {})));
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
  // Die Bausteine der Texterkennung kommen von einem fremden Rechner. Sie
  // werden beim ersten Mal eingelagert und danach bevorzugt von dort bedient,
  // sonst bliebe die Texterkennung ohne Netz stehen.
  const texterkennung = /tesseract/i.test(url.href) &&
    /(unpkg|jsdelivr|cdn)/i.test(url.hostname);

  if (!eigen && !texterkennung) return;

  if (texterkennung) {
    e.respondWith(caches.match(req).then((treffer) => treffer || fetch(req).then((antwort) => {
      const kopie = antwort.clone();
      caches.open(CACHE).then((c) => c.put(req, kopie));
      return antwort;
    })));
    return;
  }

  // Seitenaufrufe: erst Netz, sonst die abgelegte Startseite.
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match("/index.html")));
    return;
  }

  e.respondWith(
    caches.match(req).then((treffer) => {
      const frisch = fetch(req).then((antwort) => {
        if (antwort && antwort.status === 200)
          caches.open(CACHE).then((c) => c.put(req, antwort.clone()));
        return antwort;
      }).catch(() => treffer);
      return treffer || frisch;
    })
  );
});
