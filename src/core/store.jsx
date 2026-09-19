/*
 * Der gemeinsame Datenbestand — die Brücke zu React.
 *
 * Die Daten und jede Änderung daran stehen in core/bestand.js, ohne React
 * und darum prüfbar. Hier wird der Bestand nur angehängt: Jede Komponente,
 * die `useDaten()` ruft, bekommt den jetzigen Stand, die Befehle und ein paar
 * abgeleitete Nachschlagehilfen.
 *
 * Alles liegt im Speicher des Browsers und wird beim Start einmal vollständig
 * geladen. Bilder bleiben außen vor und werden erst geholt, wenn sie gezeigt
 * werden.
 */

import React, {
  createContext, useContext, useEffect, useMemo, useRef, useSyncExternalStore,
} from "react";
import { erzeugeBestand, STANDARD_EINSTELLUNGEN } from "./bestand.js";
import { fachZaehlung } from "./warteschlange.js";

export { STANDARD_EINSTELLUNGEN };

const Zusammenhang = createContext(null);

export function DatenSpeicher({ children }) {
  const bestand = useRef(null);
  if (!bestand.current) bestand.current = erzeugeBestand();
  const { lesen, abonnieren, aktionen } = bestand.current;
  const zustand = useSyncExternalStore(abonnieren, lesen);

  useEffect(() => { aktionen.laden(); }, []);

  const { karten, stapel, faecher, zustaende } = zustand;

  /* ------------------------------ Ableitungen ------------------------- */
  const kartenNachStapel = useMemo(() => {
    const karte = new Map();
    for (const k of karten) {
      if (!karte.has(k.setId)) karte.set(k.setId, []);
      karte.get(k.setId).push(k);
    }
    for (const liste of karte.values())
      liste.sort((a, b) => (a.order - b.order) || a.id.localeCompare(b.id));
    return karte;
  }, [karten]);

  const stapelNachId = useMemo(() => new Map(stapel.map((s) => [s.id, s])), [stapel]);
  const fachNachId = useMemo(() => new Map(faecher.map((f) => [f.id, f])), [faecher]);

  const nachschlagen = useMemo(() => ({
    kartenVon: (setId) => kartenNachStapel.get(setId) || [],
    stapelVon: (setId) => stapelNachId.get(setId) || null,
    fachVon: (subjectId) => fachNachId.get(subjectId) || null,
    /** Das Fach eines Stapels — über die Zuordnung des Stapels. */
    fachDesStapels: (setId) => {
      const s = stapelNachId.get(setId);
      return s?.subjectId ? fachNachId.get(s.subjectId) || null : null;
    },
  }), [kartenNachStapel, stapelNachId, fachNachId]);

  /*
   * Was insgesamt ansteht — eine Zählung für alle Stellen (Seitenleiste,
   * Tageserinnerung). Gezählt wird über die Karten, nicht über die
   * Lernstände: Lernstände gelöschter oder abgehakter Karten zählten sonst
   * mit, und oben stand „12 fällig", während das Abrufen nichts fand.
   */
  const offen = useMemo(() => {
    // Stapel ohne Fach kommen im Abrufen nicht vor, also auch nicht hier.
    const mitFach = (setId) => {
      const s = stapelNachId.get(setId);
      return s && s.subjectId && fachNachId.has(s.subjectId) ? s : null;
    };
    return fachZaehlung(karten, zustaende, mitFach, null);
  }, [karten, zustaende, stapelNachId, fachNachId]);

  const wert = useMemo(() => ({
    ...zustand, ...aktionen, ...nachschlagen, kartenNachStapel, offen,
  }), [zustand, nachschlagen, kartenNachStapel, offen]);

  return <Zusammenhang.Provider value={wert}>{children}</Zusammenhang.Provider>;
}

export function useDaten() {
  const wert = useContext(Zusammenhang);
  if (!wert) throw new Error("useDaten außerhalb des Datenspeichers");
  return wert;
}
