/*
 * Meldungen, die über allem stehen: Speichern misslungen, Speicher
 * blockiert, neue Fassung da — und die Seite für ein Laden, das scheitert.
 *
 * Vorher blieb all das stumm. Ein misslungenes Speichern sah aus wie ein
 * gelungenes, bis nach dem Neuladen etwas fehlte; ein blockierter Speicher
 * hieß „wird geöffnet …" ohne Ende.
 */

import React, { useEffect, useState } from "react";
import { useDaten } from "../core/store.jsx";
import { notsicherungHerunterladen } from "../core/notsicherung.js";
import { beobachteUpdate, updateAnwenden } from "../core/aktualisierung.js";
import { stoerungsText } from "../core/stoerung.js";
import { Knopf } from "./basis.jsx";

/** Die Seite, wenn der Speicher sich nicht öffnen lässt. */
export function Ladefehler({ text }) {
  return (
    <div style={{ maxWidth: 620, margin: "60px auto", padding: "0 20px" }}>
      <h1 style={{ fontFamily: "var(--schrift-karten, serif)", fontSize: 28 }}>
        Anchor lässt sich gerade nicht öffnen
      </h1>
      <p className="matt">
        Der Speicher des Browsers hat nicht geantwortet. Deine Daten liegen dort
        weiter, nur kommt die App gerade nicht heran.
      </p>
      <div className="rueckmeldung schlecht klein" style={{ margin: "14px 0" }}>{text}</div>
      <p className="klein matt">
        Oft hilft es, andere Fenster mit Anchor zu schließen und neu zu laden.
      </p>
      <div className="reihe umbruch" style={{ gap: 10, marginTop: 18 }}>
        <Knopf art="voll" onClick={() => window.location.reload()}>Neu laden</Knopf>
        <Knopf onClick={() => notsicherungHerunterladen().catch(() => {})}>
          Notsicherung versuchen
        </Knopf>
      </div>
    </div>
  );
}

/** Die Laufschrift oben: nur, wenn es etwas zu sagen gibt. */
export function Hinweisleiste() {
  const { speicherfehler, dbHinweis, speicherfehlerVergessen } = useDaten();
  const [update, setUpdate] = useState(false);
  const [stoerung, setStoerung] = useState(null);
  useEffect(() => beobachteUpdate(() => setUpdate(true)), []);
  useEffect(() => {
    const auffangen = (e) => {
      const text = stoerungsText(e.reason);
      if (text) setStoerung(text);
    };
    window.addEventListener("unhandledrejection", auffangen);
    return () => window.removeEventListener("unhandledrejection", auffangen);
  }, []);

  if (dbHinweis === "neueFassung" || dbHinweis === "blockiert") {
    return (
      <div className="hinweisleiste">
        <span className="dehnen">
          {dbHinweis === "neueFassung"
            ? "Eine neue Fassung von Anchor läuft in einem anderen Fenster. Lade neu, damit beide dasselbe speichern."
            : "Anchor ist noch in einem anderen Fenster offen und hält den Speicher fest. Schließe es, dann geht es hier weiter."}
        </span>
        <Knopf art="klein voll" onClick={() => window.location.reload()}>Neu laden</Knopf>
      </div>
    );
  }
  if (speicherfehler) {
    return (
      <div className="hinweisleiste fehler" role="alert">
        <span className="dehnen">
          <strong>Speichern hat nicht geklappt.</strong> {speicherfehler.text} Deine
          letzte Änderung ist vielleicht nicht gesichert.
        </span>
        <Knopf art="klein" onClick={() => notsicherungHerunterladen().catch(() => {})}>
          Notsicherung
        </Knopf>
        <Knopf art="klein leer" onClick={speicherfehlerVergessen}>Ausblenden</Knopf>
      </div>
    );
  }
  if (stoerung) {
    return (
      <div className="hinweisleiste fehler" role="alert">
        <span className="dehnen">
          <strong>Das hat nicht geklappt.</strong> {stoerung}
        </span>
        <Knopf art="klein leer" onClick={() => setStoerung(null)}>Ausblenden</Knopf>
      </div>
    );
  }
  if (update) {
    return (
      <div className="hinweisleiste">
        <span className="dehnen">Eine neue Fassung von Anchor ist da.</span>
        <Knopf art="klein voll" onClick={updateAnwenden}>Jetzt neu laden</Knopf>
      </div>
    );
  }
  return null;
}
