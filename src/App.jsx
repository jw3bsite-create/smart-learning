/*
 * Das Gerüst: Wegweiser (über die Adresszeile), Erscheinungsbild, Seitenleiste
 * und der Abgleich mit der Wolke im Hintergrund.
 */

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useDaten } from "./core/store.jsx";
import * as wolke from "./core/cloud.js";
import { Symbol, SymbolKnopf } from "./ui/basis.jsx";
import Seitenleiste from "./ui/Seitenleiste.jsx";
import Bibliothek from "./ui/Bibliothek.jsx";
import Stapelansicht from "./ui/Stapelansicht.jsx";
import Bearbeiten from "./ui/Bearbeiten.jsx";
import Einstellungen from "./ui/Einstellungen.jsx";
import Statistik from "./ui/Statistik.jsx";
import Papierkorb from "./ui/Papierkorb.jsx";
import Faecher from "./ui/Faecher.jsx";
import Kalibrierung from "./ui/Kalibrierung.jsx";
import Abrufen from "./modes/Abrufen.jsx";
import Karteikarten from "./modes/Karteikarten.jsx";
import Lernen from "./modes/Lernen.jsx";
import Schreiben from "./modes/Schreiben.jsx";
import Buchstabieren from "./modes/Buchstabieren.jsx";
import Test from "./modes/Test.jsx";
import Zuordnen from "./modes/Zuordnen.jsx";
import Meteor from "./modes/Meteor.jsx";

export const MODI = [
  { id: "karten", name: "Karteikarten", symbol: "stapel",
    text: "Durchblättern und umdrehen — mit Vorlesen und Selbsteinschätzung." },
  { id: "lernen", name: "Lernen", symbol: "blitz",
    text: "Runden aus Auswahl und Schreiben, verteilt über die Tage." },
  { id: "schreiben", name: "Schreiben", symbol: "schreiben",
    text: "Antwort tippen. Verzeiht Tippfehler, nicht aber Unwissen." },
  { id: "buchstabieren", name: "Buchstabieren", symbol: "buchstaben",
    text: "Anhören und schreiben — für Vokabeln und Rechtschreibung." },
  { id: "test", name: "Test", symbol: "papier",
    text: "Klassenarbeit im Kleinen: gemischte Aufgaben, Note am Ende." },
  { id: "zuordnen", name: "Zuordnen", symbol: "raster",
    text: "Paare finden, auf Zeit. Die Bestzeit wird festgehalten." },
  { id: "meteor", name: "Meteor", symbol: "rakete",
    text: "Begriffe fallen, du tippst die Antwort. Wird schneller." },
];

/* ------------------------------ Wegweiser ------------------------------ */

export function gehe(weg) { window.location.hash = weg; }

function useWeg() {
  const [weg, setWeg] = useState(() => window.location.hash.slice(1) || "/");
  useEffect(() => {
    const f = () => setWeg(window.location.hash.slice(1) || "/");
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [weg]);
  return weg;
}

/* --------------------------------- App --------------------------------- */

export default function App() {
  const daten = useDaten();
  const { bereit, einstellungen, setWolkeStand, setAenderungsMelder, neuLaden } = daten;
  const weg = useWeg();
  const [leisteOffen, setLeisteOffen] = useState(false);
  const abgleichLaeuft = useRef(false);
  const anstoss = useRef(null);

  /* Erscheinungsbild an die Wurzel hängen. */
  useEffect(() => {
    const wurzel = document.documentElement;
    const dunkelGewuenscht = einstellungen.design === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : einstellungen.design === "dunkel";
    wurzel.dataset.design = dunkelGewuenscht ? "dunkel" : "hell";
    wurzel.dataset.gross = einstellungen.schriftGross ? "ja" : "nein";
    wurzel.style.setProperty("--akzent", einstellungen.akzent);
    if (einstellungen.design !== "system") return;
    const beobachter = window.matchMedia("(prefers-color-scheme: dark)");
    const f = () => { wurzel.dataset.design = beobachter.matches ? "dunkel" : "hell"; };
    beobachter.addEventListener("change", f);
    return () => beobachter.removeEventListener("change", f);
  }, [einstellungen.design, einstellungen.akzent, einstellungen.schriftGross]);

  /* ---------------------------- Wolkenabgleich --------------------------- */
  const abgleichen = useCallback(async (still = true) => {
    if (abgleichLaeuft.current) return;
    const zugang = await wolke.zugangLesen();
    if (!wolke.eingerichtet(zugang)) return;
    const sitz = await wolke.sitzung().catch(() => null);
    if (!sitz) return;
    abgleichLaeuft.current = true;
    setWolkeStand({ zustand: "arbeitet", zeit: Date.now(), text: "Gleiche ab …" });
    try {
      const ergebnis = await wolke.abgleichen((text) =>
        setWolkeStand({ zustand: "arbeitet", zeit: Date.now(), text }));
      await neuLaden();
      setWolkeStand({ zustand: "gut", zeit: ergebnis.zeit,
        text: `${ergebnis.geholt} geholt, ${ergebnis.geschickt} geschickt` });
    } catch (fehler) {
      setWolkeStand({ zustand: "fehler", zeit: Date.now(), text: fehler.message });
      if (!still) window.alert("Abgleich misslungen: " + fehler.message);
    } finally {
      abgleichLaeuft.current = false;
    }
  }, [neuLaden, setWolkeStand]);

  useEffect(() => {
    if (!bereit) return;
    abgleichen(true);
    // Änderungen stoßen den Abgleich verzögert an, damit nicht jede getippte
    // Karte eine Übertragung auslöst.
    setAenderungsMelder(() => {
      clearTimeout(anstoss.current);
      anstoss.current = setTimeout(() => abgleichen(true), 20000);
    });
    const beimVerlassen = () => { if (document.visibilityState === "hidden") abgleichen(true); };
    document.addEventListener("visibilitychange", beimVerlassen);
    return () => {
      document.removeEventListener("visibilitychange", beimVerlassen);
      clearTimeout(anstoss.current);
      setAenderungsMelder(null);
    };
  }, [bereit, abgleichen, setAenderungsMelder]);

  /* Beim Wechsel des Weges die Leiste auf schmalen Geräten schließen. */
  useEffect(() => { setLeisteOffen(false); }, [weg]);

  if (!bereit) {
    return (
      <div style={{ display: "grid", placeItems: "center", height: "100vh", gap: 10 }}>
        <Symbol name="stapel" groesse={34} />
        <div className="matt">Karteikasten wird geöffnet …</div>
      </div>
    );
  }

  const teile = weg.split("/").filter(Boolean);

  /* Das Abrufen ist der verbindliche Lernweg und bekommt die ganze Fläche. */
  if (teile[0] === "abrufen") {
    return <Abrufen fachId={teile[1] || null}
      aufSchliessen={() => gehe(teile[1] ? "/faecher" : "/faecher")} />;
  }

  /* Lernmodi bekommen die ganze Fläche. */
  if (teile[0] === "stapel" && teile[2] && teile[2] !== "bearbeiten") {
    const setId = teile[1];
    const modus = teile[2];
    const zurueck = () => gehe("/stapel/" + setId);
    const gemeinsam = { setId, aufSchliessen: zurueck };
    if (modus === "karten") return <Karteikarten {...gemeinsam} />;
    if (modus === "lernen") return <Lernen {...gemeinsam} />;
    if (modus === "schreiben") return <Schreiben {...gemeinsam} />;
    if (modus === "buchstabieren") return <Buchstabieren {...gemeinsam} />;
    if (modus === "test") return <Test {...gemeinsam} />;
    if (modus === "zuordnen") return <Zuordnen {...gemeinsam} />;
    if (modus === "meteor") return <Meteor {...gemeinsam} />;
  }

  let inhalt = <Bibliothek ordnerId={null} />;
  if (teile[0] === "ordner") inhalt = <Bibliothek ordnerId={teile[1]} />;
  else if (teile[0] === "suche") inhalt = <Bibliothek suchbegriff={decodeURIComponent(teile[1] || "")} />;
  else if (teile[0] === "stapel" && teile[2] === "bearbeiten") inhalt = <Bearbeiten setId={teile[1]} />;
  else if (teile[0] === "stapel") inhalt = <Stapelansicht setId={teile[1]} />;
  else if (teile[0] === "einstellungen") inhalt = <Einstellungen aufAbgleich={() => abgleichen(false)} />;
  else if (teile[0] === "statistik") inhalt = <Statistik />;
  else if (teile[0] === "papierkorb") inhalt = <Papierkorb />;
  else if (teile[0] === "faecher") inhalt = <Faecher />;
  else if (teile[0] === "kalibrierung") inhalt = <Kalibrierung />;

  return (
    <div className="huelle">
      <Seitenleiste offen={leisteOffen} aufSchliessen={() => setLeisteOffen(false)}
        aufAbgleich={() => abgleichen(false)} />
      {leisteOffen && (
        <div className="schleier nur-schmal" style={{ zIndex: 45 }}
          onClick={() => setLeisteOffen(false)} />
      )}
      <main className="buehne">
        <div className="nur-schmal" style={{ padding: "10px 12px 0" }}>
          <SymbolKnopf symbol="balken" titel="Menü" art="leer" groesse={22}
            onClick={() => setLeisteOffen(true)} />
        </div>
        {inhalt}
      </main>
    </div>
  );
}
