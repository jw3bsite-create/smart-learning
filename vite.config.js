import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Setzt in den fertigen Dienst-Arbeiter ein, was er einlagern soll.
 *
 * Die gebauten Dateien heissen nach ihrem Inhalt — `index-BgQ1IhB_.js` und so
 * fort. Diese Namen kennt niemand im Voraus, auch der Dienst-Arbeiter nicht.
 * Ohne Liste sammelte er nur ein, was ohnehin gerade ueber die Leitung kam, und
 * das ist zu spaet: Die Bausteine der App werden geladen, ehe er die Aufsicht
 * uebernimmt. Ohne Netz kam dann die Startseite und dahinter eine weisse
 * Flaeche — nachgeprueft, genau so war es.
 *
 * Ein fertiges Werkzeug dafuer gaebe es (vite-plugin-pwa). Es bringt ein
 * Dutzend weiterer Pakete mit, von denen wir keines braeuchten; diese
 * zwanzig Zeilen tun dasselbe und sind zu lesen.
 */
function dienstArbeiter() {
  return {
    name: "dienst-arbeiter-vorrat",
    apply: "build",
    closeBundle() {
      const wurzel = "dist";
      const sammeln = (ordner) => readdirSync(ordner).flatMap((name) => {
        const pfad = join(ordner, name);
        return statSync(pfad).isDirectory() ? sammeln(pfad) : [pfad];
      });

      const dateien = sammeln(wurzel)
        .map((pfad) => relative(wurzel, pfad).split("\\").join("/"))
        // Der Dienst-Arbeiter selbst gehoert nicht in seinen eigenen Vorrat,
        // die Startseite steht schon fest darin, und Dateien mit einem Punkt
        // vorn (etwa .nojekyll fuer GitHub Pages) sind Anweisungen an den
        // Anbieter, nicht Teil der App.
        .filter((d) => d !== "sw.js" && d !== "index.html" && !d.startsWith("."));

      const ziel = join(wurzel, "sw.js");
      const stand = Date.now().toString(36);
      const text = readFileSync(ziel, "utf8")
        .replace('"__STAND__"', JSON.stringify(stand))
        .replace('"__DATEIEN__"', JSON.stringify(dateien, null, 2));
      writeFileSync(ziel, text);
      console.log(`Dienst-Arbeiter: ${dateien.length} Dateien im Vorrat (Stand ${stand}).`);
    },
  };
}

export default defineConfig({
  plugins: [react(), dienstArbeiter()],
  /*
   * Alle Verweise relativ zur Seite, nicht zur Wurzel des Rechners.
   *
   * Liegt die App spaeter in einem Unterordner — was bei den meisten kostenlosen
   * Anbietern der Fall ist —, zeigt ein Verweis auf `/assets/…` ins Leere. Mit
   * `./` traegt derselbe Bau an jeder Stelle.
   */
  base: "./",
  // 5180 ist der gewohnte Platz; PORT setzt ihn um, wenn er schon belegt ist.
  // strictPort: Weicht der Server bei belegtem Port still auf einen anderen
  // aus, wartet der Starter auf 5180 und findet dort nie etwas.
  server: { port: Number(process.env.PORT) || 5180, strictPort: true, open: false },
  build: { target: "es2020" },
});
