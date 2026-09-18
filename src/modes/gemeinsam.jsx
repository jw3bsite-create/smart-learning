/*
 * Gemeinsames für alle Lernmodi: Rahmen mit Kopfzeile, Anzeige einer
 * Kartenseite, Ergebnisbild am Ende und ein paar Beschaffungshelfer.
 */

import React, { useEffect, useMemo } from "react";
import { useDaten } from "../core/store.jsx";
import { sprich, schweig } from "../core/speech.js";
import { istUebbar } from "../core/kartenseiten.js";
import { istRelevant } from "../core/model.js";
import { gehe } from "../App.jsx";
import { Symbol, SymbolKnopf, Knopf, Bild } from "../ui/basis.jsx";
import Formel from "../ui/Formel.jsx";

/** Ein Notstapel, damit ein fehlender Stapel keinen Absturz auslöst. */
const LEERER_STAPEL = {
  id: null, title: "", description: "", termLabel: "Vorderseite",
  defLabel: "Rückseite", termLang: "de", defLang: "de", richtungen: ["td"],
};

/**
 * Stapel, Karten und die üblichen Handgriffe für einen Modus.
 *
 * Gibt es den Stapel nicht — ein alter Verweis, ein gelöschter Stapel —, kommt
 * ein leerer zurück statt `undefined`. Sonst stürzt der Modus beim ersten
 * Zugriff auf einen Namen ab und hinterlässt eine weiße Seite; die Modi
 * fangen den leeren Fall über ihre Abbruchbedingung ohnehin ab.
 */
export function useModus(setId) {
  const daten = useDaten();
  const gefunden = daten.stapel.find((s) => s.id === setId);
  const karten = daten.kartenVon(setId);
  useEffect(() => () => schweig(), []);
  return { ...daten, derStapel: gefunden || LEERER_STAPEL,
    stapelFehlt: !gefunden, karten };
}

/**
 * Karten, die sich üben lassen — leere Zeilen sollen keine Aufgabe werden.
 *
 * Geprüft wird auf der übersetzten Karte, nicht auf den Rohfeldern: Ein
 * Rechenweg hat keine Rückseite im alten Sinne, sehr wohl aber eine Antwort.
 * Vorher fielen solche Karten stillschweigend aus allen Übungsmodi heraus.
 */
export function useBrauchbar(karten, nurMarkierte = false) {
  return useMemo(() => karten.filter((k) =>
    (!nurMarkierte || k.starred) && istRelevant(k) && istUebbar(k)),
  [karten, nurMarkierte]);
}

export function ModusRahmen({ titel, symbol, aufSchliessen, anteil = null, rechts, children }) {
  return (
    <div>
      <div className="modus-kopf">
        <SymbolKnopf symbol="kreuz" titel="Beenden" art="leer" groesse={20}
          onClick={aufSchliessen} />
        <Symbol name={symbol} groesse={18} />
        <strong style={{ fontFamily: "var(--serifen)", fontWeight: 600 }}>{titel}</strong>
        <div className="dehnen" />
        {rechts}
      </div>
      {anteil !== null && (
        <div className="balken" style={{ height: 4, borderRadius: 0 }}>
          <span className="vertraut" style={{ width: Math.round(anteil * 100) + "%",
            transition: "width 0.3s" }} />
        </div>
      )}
      <div className="modus-flaeche">{children}</div>
    </div>
  );
}

/** Eine Kartenseite: Text, Bild und ein Knopf zum Vorlesen. */
export function Seite({ text, bild, sprache, vorlesen = true, klasse = "frage-text" }) {
  const lang = (text || "").length > 90;
  return (
    <>
      {bild && <Bild kennung={bild} />}
      {text && (
        <div className={klasse + (lang ? " lang" : "")}>
          <Formel text={text} />
          {vorlesen && (
            <SymbolKnopf symbol="laut" titel="Vorlesen" art="leer klein"
              onClick={(e) => { e.stopPropagation(); sprich(text, sprache); }} />
          )}
        </div>
      )}
    </>
  );
}

/** Abschlussbild mit Zahlen und den nächsten Schritten. */
export function Ergebnis({ titel, richtig, gesamt, kinder, children, setId, aufNochmal, aufWeiter }) {
  const anteil = gesamt ? Math.round(100 * richtig / gesamt) : 0;
  const lob = anteil === 100 ? "Fehlerlos."
    : anteil >= 85 ? "Das sitzt."
      : anteil >= 60 ? "Solide, der Rest kommt mit der Wiederholung."
        : "Noch wacklig. Bleib dran, die Wiederholung ist eingeplant.";
  return (
    <div style={{ textAlign: "center", paddingTop: 20 }}>
      <div style={{ fontFamily: "var(--serifen)", fontSize: 54 }}>{anteil}<span style={{ fontSize: 26 }}>%</span></div>
      <h2 style={{ marginTop: 6 }}>{titel}</h2>
      <p className="matt">{richtig} von {gesamt} richtig. {lob}</p>
      {children || kinder}
      <div className="reihe" style={{ justifyContent: "center", marginTop: 26, flexWrap: "wrap" }}>
        {aufNochmal && <Knopf art="voll gross" symbol="zurueckSetzen" onClick={aufNochmal}>Noch eine Runde</Knopf>}
        {aufWeiter}
        <Knopf art="gross" onClick={() => gehe("/stapel/" + setId)}>Zum Stapel</Knopf>
      </div>
    </div>
  );
}

/** Zeile mit Einstellungen über einem Modus (Richtung, Auswahl). */
export function ModusLeiste({ children }) {
  return <div className="reihe umbruch" style={{ marginBottom: 18, gap: 10 }}>{children}</div>;
}

export function Wahl({ beschriftung, wert, setzen, moeglichkeiten }) {
  return (
    <label className="reihe klein matt" style={{ gap: 6 }}>
      {beschriftung}
      <select className="feld klein" style={{ width: "auto", padding: "5px 26px 5px 9px" }}
        value={wert} onChange={(e) => setzen(e.target.value)}>
        {moeglichkeiten.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
      </select>
    </label>
  );
}

export const RICHTUNGEN = (derStapel) => [
  ["td", (derStapel?.termLabel || "Vorderseite") + " → " + (derStapel?.defLabel || "Rückseite")],
  ["dt", (derStapel?.defLabel || "Rückseite") + " → " + (derStapel?.termLabel || "Vorderseite")],
  ["beide", "Beide Richtungen"],
];

/* Die Übersetzung einer Karte in Frage und Antwort liegt im Kern, damit sie
   ohne Browser prüfbar ist. Hier nur weitergereicht, damit die Modi sich
   nicht ändern müssen. */
export { seitenFuer, sprachenFuer } from "../core/kartenseiten.js";
