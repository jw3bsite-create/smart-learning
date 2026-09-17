/*
 * „Selbst sprechen": die Lösung mit der eigenen Stimme aufnehmen.
 *
 * Steht immer erst dort, wo die Lösung schon offenliegt — siehe core/ton.js.
 * Ein Druck nimmt auf, der nächste beendet; danach lässt sich anhören, neu
 * aufnehmen oder löschen. Die Aufnahme gehört zur Kartenseite, nicht zur
 * Abfragerichtung: Einmal gesprochen, ist sie in beiden Richtungen da.
 */

import React, { useEffect, useRef, useState } from "react";
import {
  Tonband, HOECHSTDAUER, tonMoeglich, tonAblegen, tonLesen, tonAdresse,
  tonEntfernen, dauerAnzeige,
} from "../core/ton.js";
import { Knopf, SymbolKnopf } from "./basis.jsx";

export default function Tonaufnahme({ cardId, seite, autoAbspielen = false, knapp = false }) {
  const [zustand, setZustand] = useState("lade");   // lade | leer | laeuft | vorhanden
  const [dauer, setDauer] = useState(0);
  const [sekunden, setSekunden] = useState(0);
  const [spielt, setSpielt] = useState(false);
  const [fehler, setFehler] = useState("");
  const band = useRef(null);
  const klang = useRef(null);
  const takt = useRef(null);

  /* Beim Kartenwechsel neu nachsehen — und eine laufende Aufnahme abbrechen,
     damit das Mikrofon nicht offen bleibt. */
  useEffect(() => {
    let aus = false;
    setZustand("lade"); setFehler(""); setSpielt(false);
    tonLesen(cardId, seite).then((rec) => {
      if (aus) return;
      setDauer(rec?.sekunden || 0);
      setZustand(rec ? "vorhanden" : "leer");
    }).catch(() => { if (!aus) setZustand("leer"); });
    return () => {
      aus = true;
      clearInterval(takt.current);
      band.current?.abbrechen();
      band.current = null;
      if (klang.current) { klang.current.pause(); klang.current = null; }
    };
  }, [cardId, seite]);

  /* Von allein abspielen, sobald die Lösung offenliegt.
     Eigener Effekt, weil beim Umdrehen einer Karteikarte nichts neu geladen
     wird: Stünde das oben, spielte die Aufnahme nur beim Kartenwechsel. */
  useEffect(() => {
    if (autoAbspielen && zustand === "vorhanden") abspielen();
  }, [autoAbspielen, zustand, cardId, seite]);

  const abspielen = async () => {
    const url = await tonAdresse(cardId, seite);
    if (!url) return;
    if (!klang.current) klang.current = new Audio();
    klang.current.src = url;
    klang.current.onended = () => setSpielt(false);
    setSpielt(true);
    klang.current.play().catch(() => setSpielt(false));
  };

  const beenden = async () => {
    clearInterval(takt.current);
    const ergebnis = await band.current?.stop().catch(() => null);
    band.current = null;
    if (!ergebnis) { setZustand(dauer ? "vorhanden" : "leer"); return; }
    await tonAblegen(cardId, seite, ergebnis.blob, ergebnis.sekunden);
    setDauer(ergebnis.sekunden);
    setZustand("vorhanden");
  };

  const aufnehmen = async () => {
    setFehler("");
    band.current = new Tonband();
    try {
      await band.current.start();
    } catch (e) {
      band.current = null;
      /* Der häufigste Fall ist die verweigerte Freigabe — und die kommt auf
         dem iPad auch dann, wenn die Seite nicht über https läuft. */
      setFehler(e?.name === "NotAllowedError"
        ? "Kein Zugriff aufs Mikrofon. Erlaube ihn in den Browsereinstellungen für diese Seite."
        : "Aufnahme nicht möglich: " + (e?.message || "unbekannter Grund"));
      setZustand(dauer ? "vorhanden" : "leer");
      return;
    }
    setSekunden(0);
    setZustand("laeuft");
    takt.current = setInterval(() => {
      setSekunden((s) => {
        if (s + 1 >= HOECHSTDAUER) { beenden(); return HOECHSTDAUER; }
        return s + 1;
      });
    }, 1000);
  };

  const loeschen = async () => {
    await tonEntfernen(cardId, seite);
    setDauer(0); setZustand("leer");
  };

  if (!tonMoeglich()) return null;
  if (zustand === "lade") return null;

  const halt = (fn) => (e) => { e.stopPropagation(); fn(); };

  return (
    <div className="ton-zeile reihe umbruch" onClick={(e) => e.stopPropagation()}>
      {zustand === "laeuft" ? (
        <>
          <Knopf art="klein" symbol="stopp" onClick={halt(beenden)}>
            Aufnahme beenden
          </Knopf>
          <span className="ton-punkt" />
          <span className="klein mono">{dauerAnzeige(sekunden)}</span>
          <span className="klein blass">
            spricht … höchstens {dauerAnzeige(HOECHSTDAUER)}
          </span>
        </>
      ) : zustand === "vorhanden" ? (
        <>
          <Knopf art="klein" symbol={spielt ? "laut" : "abspielen"} onClick={halt(abspielen)}>
            Eigene Stimme
          </Knopf>
          <span className="klein blass mono">{dauerAnzeige(dauer)}</span>
          <SymbolKnopf symbol="mikro" titel="Neu aufnehmen" art="leer klein"
            onClick={halt(aufnehmen)} />
          <SymbolKnopf symbol="muell" titel="Aufnahme löschen" art="leer klein"
            onClick={halt(loeschen)} />
        </>
      ) : (
        <>
          <Knopf art="klein" symbol="mikro" onClick={halt(aufnehmen)}>
            Selbst sprechen
          </Knopf>
          {!knapp && (
            <span className="klein blass">
              Lies die Lösung laut vor, die eigene Stimme bleibt besser haften.
            </span>
          )}
        </>
      )}
      {fehler && <div className="klein" style={{ color: "var(--rot)", width: "100%" }}>{fehler}</div>}
    </div>
  );
}
