/*
 * Probe-Modus bei den Punkten (Wunsch des Nutzers, 26.11.2026): Ein Tipp auf
 * das kleine Symbol schaltet ihn ein, dann eingetragene Noten sind nur zum
 * Ausprobieren — „Was wäre mein Schnitt, wenn …?“. Sie fließen in alle
 * Schnitte, Ziele und Balken der Punkte-Seite ein, landen aber nie in den
 * echten Daten und nicht im Abgleich. Ein zweiter Tipp löscht sie wieder.
 *
 * Gemerkt auf dem Gerät (localStorage), damit sie einen Wechsel ins Fach und
 * zurück überstehen. Die Startseite rechnet immer mit den echten Noten.
 */

import React, { createContext, useContext, useMemo } from "react";
import { useDaten } from "../core/store.jsx";
import { neueLeistung } from "../core/noten.js";
import { useMerker, Knopf } from "./basis.jsx";
import { anzahl } from "../core/util.js";

const Kontext = createContext(null);

export function ProbeAnbieter({ children }) {
  const { notenfaecher } = useDaten();
  /* null = aus; sonst { [notenfachId]: [Probe-Leistungen] } */
  const [probe, setProbe] = useMerker("punkteProbe", null);
  const aktiv = probe !== null && typeof probe === "object";

  const gemischt = useMemo(() => (!aktiv ? notenfaecher : notenfaecher.map((n) => (probe[n.id]?.length
    ? { ...n, leistungen: [...(n.leistungen || []), ...probe[n.id]] } : n))), [aktiv, probe, notenfaecher]);

  const wert = useMemo(() => ({
    aktiv,
    gemischt,
    anzahl: aktiv ? Object.values(probe).reduce((a, l) => a + l.length, 0) : 0,
    an: () => setProbe({}),
    aus: () => setProbe(null),
    anlegen: (fachId, angaben) => {
      const l = { ...neueLeistung(angaben), probe: true };
      setProbe((p) => ({ ...(p || {}), [fachId]: [...((p || {})[fachId] || []), l] }));
      return l;
    },
    aendern: (fachId, lid, aend) => setProbe((p) => ({
      ...(p || {}), [fachId]: ((p || {})[fachId] || []).map((l) => (l.id === lid ? { ...l, ...aend } : l)),
    })),
    loeschen: (fachId, lid) => setProbe((p) => ({
      ...(p || {}), [fachId]: ((p || {})[fachId] || []).filter((l) => l.id !== lid),
    })),
  }), [aktiv, gemischt, probe, setProbe]);

  return <Kontext.Provider value={wert}>{children}</Kontext.Provider>;
}

/** Der Probe-Modus, oder null außerhalb der Punkte-Seite. */
export const useProbe = () => useContext(Kontext);

/** Die Notenfächer, wie die Seite sie zeigen soll: mit Probenoten, wenn der Modus an ist. */
export function useNotenfaecher() {
  const probe = useContext(Kontext);
  const { notenfaecher } = useDaten();
  return probe?.aktiv ? probe.gemischt : notenfaecher;
}

/** Der Hinweis oben, solange der Probe-Modus an ist. */
export function ProbeHinweis() {
  const probe = useContext(Kontext);
  if (!probe?.aktiv) return null;
  return (
    <div className="rueckmeldung probe-hinweis unten-16">
      <div className="dehnen">
        <strong>Probe-Modus</strong>
        <div className="klein matt">
          Was du jetzt einträgst, ist nur zum Ausprobieren und zählt nicht wirklich.
          {probe.anzahl > 0 && " " + anzahl(probe.anzahl, "Probenote", "Probenoten") + " eingetragen."}
        </div>
      </div>
      <Knopf art="klein" onClick={probe.aus}>Beenden</Knopf>
    </div>
  );
}

