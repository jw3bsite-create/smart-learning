/*
 * Kartentext mit Formeln anzeigen.
 *
 * Gewöhnlicher Text läuft unverändert durch — kein zusätzliches Element,
 * keine andere Schrift. Nur was zwischen `$…$` steht, setzt KaTeX. So sieht
 * keine der vielen Karten ohne Formel durch diese Komponente anders aus.
 *
 * KaTeX maskiert, was es bekommt, und führt ohne `trust` keine Befehle aus,
 * die Adressen oder Stile einschleusen könnten. Darum ist das Einsetzen als
 * HTML hier unbedenklich, auch bei Karten, die aus fremden Quellen kommen.
 */

import React, { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { teile } from "../core/formel.js";

const gesetzt = new Map();

function setze(formel) {
  if (gesetzt.has(formel)) return gesetzt.get(formel);
  let html;
  try {
    /* throwOnError aus: Eine halb getippte Formel (etwa beim Bearbeiten)
       erscheint rot statt die ganze Karte abstürzen zu lassen. */
    html = katex.renderToString(formel, { throwOnError: false, strict: "ignore", output: "html" });
  } catch (e) {
    html = formel.replace(/[&<>"]/g, (z) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[z]));
  }
  if (gesetzt.size > 500) gesetzt.clear();
  gesetzt.set(formel, html);
  return html;
}

/*
 * `aufFormel` macht jede Formel antippbar — im Editor, um sie zu ändern.
 * Gezählt wird nur über die Formeln, nicht über den Text dazwischen.
 */
export default function Formel({ text, aufFormel = null }) {
  const stuecke = useMemo(() => teile(text), [text]);
  if (!stuecke.some((s) => s.formel)) return text ?? null;
  let nummer = -1;
  return (
    <>
      {stuecke.map((s, i) => {
        if (!s.formel) return <React.Fragment key={i}>{s.inhalt}</React.Fragment>;
        nummer += 1;
        const n = nummer;
        return aufFormel
          ? <span key={i} className="formel klickbar" role="button" tabIndex={0}
              title="Formel bearbeiten"
              onClick={() => aufFormel(n)}
              onKeyDown={(e) => { if (e.key === "Enter") aufFormel(n); }}
              dangerouslySetInnerHTML={{ __html: setze(s.inhalt) }} />
          : <span key={i} className="formel" dangerouslySetInnerHTML={{ __html: setze(s.inhalt) }} />;
      })}
    </>
  );
}
