/*
 * Klausuren eines Fachs anlegen und ihnen Ordner und Stapel zuordnen
 * (core/klausuren.js, seit dem 25. November 2026).
 */

import React, { useState } from "react";
import { useDaten } from "../core/store.jsx";
import {
  klausurenVon, kommendeKlausuren, neueKlausur, ganzesFach, stapelDerKlausur, tageBis, tageText,
} from "../core/klausuren.js";
import { ordnerImFach, stapelImFach, fachordnerZweig } from "../core/fachordner.js";
import { anzahl, datumKurz } from "../core/util.js";
import { Knopf, Dialog, Symbol } from "./basis.jsx";
import { bestaetigen } from "./Rueckfragen.jsx";

const alsEingabe = (zeit) => {
  if (!zeit) return "";
  const d = new Date(zeit);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
};
/* Ein Datum aus dem Feld als Mitternacht Ortszeit — nicht UTC, sonst rutscht es. */
const ausEingabe = (text) => {
  if (!text) return null;
  const [j, m, t] = text.split("-").map(Number);
  return new Date(j, m - 1, t).getTime();
};

/** Wie dringend die Marke aussieht. */
export function klausurMarke(tage) {
  if (tage === null) return "marke";
  if (tage <= 3) return "marke rot";
  if (tage <= 14) return "marke gelb";
  return "marke";
}

/** Was einer Klausur zugeordnet ist, in Worten. */
function zuordnungText(k, fach, stapel, ordner) {
  if (ganzesFach(k)) return "ganzes Fach";
  const n = stapelDerKlausur(k, fach, stapel, ordner).size;
  return anzahl(n, "Stapel", "Stapel");
}

/* ------------------------------ Der Dialog ----------------------------- */

function KlausurDialog({ fach, klausur, aufSpeichern, aufLoeschen, aufSchliessen }) {
  const { ordner, stapel } = useDaten();
  const [name, setName] = useState(klausur?.name || "");
  const [datum, setDatum] = useState(alsEingabe(klausur?.datum));
  const [ordnerIds, setOrdnerIds] = useState(new Set(klausur?.ordnerIds || []));
  const [stapelIds, setStapelIds] = useState(new Set(klausur?.stapelIds || []));
  const ganz = ordnerIds.size === 0 && stapelIds.size === 0;

  /* Stapel, die über einen gewählten Ordner schon dabei sind. */
  const ueberOrdner = new Set();
  const eigeneOrdner = ordner.filter((o) => o.subjectId === fach.id && !o.deleted);
  for (const oid of ordnerIds) for (const z of fachordnerZweig(eigeneOrdner, oid)) ueberOrdner.add(z);

  const umschalten = (menge, setzen, kennung) => {
    const neu = new Set(menge);
    if (neu.has(kennung)) neu.delete(kennung); else neu.add(kennung);
    setzen(neu);
  };

  /* Eine Funktion, keine innere Komponente: sonst baute React den Baum bei
     jedem Haken neu auf, und die Felder sprangen. */
  const ebene = (elternId, tiefe) => (
    <>
      {ordnerImFach(ordner, fach.id, elternId).map((o) => {
        const ueber = ueberOrdner.has(o.id) && !ordnerIds.has(o.id);
        return (
          <React.Fragment key={o.id}>
            <label className="schalter klausur-zeile" style={{ paddingLeft: tiefe * 18 }}>
              <input type="checkbox" checked={ordnerIds.has(o.id) || ueber} disabled={ueber}
                onChange={() => umschalten(ordnerIds, setOrdnerIds, o.id)} />
              <span><Symbol name="ordner" groesse={14} /> {o.name}</span>
            </label>
            {ebene(o.id, tiefe + 1)}
          </React.Fragment>
        );
      })}
      {stapelImFach(stapel, ordner, fach.id, elternId).map((s) => {
        const ueber = ueberOrdner.has(s.folderId);
        return (
          <label key={s.id} className="schalter klausur-zeile" style={{ paddingLeft: tiefe * 18 }}>
            <input type="checkbox" checked={ueber || stapelIds.has(s.id)} disabled={ueber}
              onChange={() => umschalten(stapelIds, setStapelIds, s.id)} />
            <span className="matt">{s.title || "Ohne Titel"}</span>
          </label>
        );
      })}
    </>
  );

  const speichern = () => {
    aufSpeichern({
      ...(klausur || neueKlausur()),
      name: name.trim() || "Klausur",
      datum: ausEingabe(datum),
      ordnerIds: [...ordnerIds],
      /* Stapel, die schon über einen Ordner dabei sind, nicht doppelt. */
      stapelIds: [...stapelIds].filter((sid) => !ueberOrdner.has(stapel.find((s) => s.id === sid)?.folderId)),
    });
    aufSchliessen();
  };

  return (
    <Dialog titel={klausur ? "Klausur bearbeiten" : "Neue Klausur in " + fach.name} aufSchliessen={aufSchliessen}
      fuss={<>
        {klausur && aufLoeschen && <Knopf onClick={aufLoeschen}>Löschen</Knopf>}
        <span className="dehnen" />
        <Knopf onClick={aufSchliessen}>Abbrechen</Knopf>
        <Knopf art="voll" disabled={!datum} onClick={speichern}>Speichern</Knopf>
      </>}>
      <div className="gitter" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        <label className="beschriftung">Name
          <input className="feld" value={name} placeholder="z. B. Klausur 2" autoFocus
            onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="beschriftung">Datum
          <input className="feld" type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
        </label>
      </div>

      <div className="reihe oben-16 unten-8">
        <strong className="dehnen">Was drankommt</strong>
        <span className="klein matt">{ganz ? "ganzes Fach"
          : anzahl(stapelDerKlausur({ ordnerIds: [...ordnerIds], stapelIds: [...stapelIds] }, fach, stapel, ordner).size,
            "Stapel", "Stapel")}</span>
      </div>
      <p className="klein blass oben-0 erklaerung">
        Ordner bringen ihre Unterordner mit. Nichts angekreuzt heißt: das ganze Fach.
      </p>
      <div className="klausur-baum">
        {ebene(null, 0)}
      </div>
    </Dialog>
  );
}

/* ------------------------------ Die Liste ------------------------------ */

/**
 * Die Klausuren eines Fachs: die kommenden, darunter die vergangenen
 * zugeklappt. Antippen öffnet den Dialog.
 */
export default function KlausurenTeil({ fach, knapp = false }) {
  const { fachAendern, stapel, ordner } = useDaten();
  const [offen, setOffen] = useState(null);       // "neu" | Klausur
  const alle = klausurenVon(fach);
  const kommend = kommendeKlausuren(fach);
  const kommendIds = new Set(kommend.map((k) => k.id));
  const vergangen = alle.filter((k) => !kommendIds.has(k.id)).sort((a, b) => b.datum - a.datum);

  const speichern = (liste) => fachAendern(fach.id, { klausuren: liste });
  const ersetzen = (k) => {
    const da = alle.some((x) => x.id === k.id);
    /* Der alte Prüfungstermin ist noch keine echte Klausur: beim ersten
       Speichern bekommt er eine eigene Kennung. */
    const liste = (da ? alle.map((x) => (x.id === k.id ? k : x)) : [...alle, k])
      .map((x) => (x.id === "termin" ? { ...neueKlausur(x), name: x.name } : x));
    speichern(liste);
  };
  const loeschen = async (k) => {
    if (!(await bestaetigen({ titel: "„" + (k.name || "Klausur") + "“ löschen?", ja: "Löschen",
      text: "Nur der Termin verschwindet, die Stapel bleiben, wie sie sind." }))) return;
    speichern(alle.filter((x) => x.id !== k.id).map((x) => (x.id === "termin" ? { ...neueKlausur(x), name: x.name } : x)));
    setOffen(null);
  };

  const zeile = (k) => {
    const tage = tageBis(k);
    return (
      <button key={k.id} type="button" className="listenzeile" onClick={() => setOffen(k)}>
        <Symbol name="papier" groesse={16} />
        <span className="dehnen">
          {k.name || "Klausur"}
          <span className="klein blass"> · {zuordnungText(k, fach, stapel, ordner)}</span>
        </span>
        <span className={tage !== null && tage >= 0 ? klausurMarke(tage) : "klein blass"}>
          {tage !== null && tage >= 0 ? tageText(tage) : datumKurz(k.datum)}
        </span>
        <span className="klein blass nur-breit">{datumKurz(k.datum)}</span>
      </button>
    );
  };

  return (
    <div className={knapp ? "" : "unten-16"}>
      <div className="reihe unten-8">
        <h3 className="dehnen" style={{ margin: 0 }}>Klausuren</h3>
        <Knopf art="klein" symbol="plus" onClick={() => setOffen("neu")}>Klausur</Knopf>
      </div>
      {kommend.length === 0 && (
        <div className="klein blass unten-8">Keine Klausur geplant.</div>
      )}
      <div className="liste">
        {kommend.map(zeile)}
      </div>
      {vergangen.length > 0 && (
        <details className="oben-8">
          <summary className="klein matt" style={{ cursor: "pointer" }}>
            {anzahl(vergangen.length, "vergangene Klausur", "vergangene Klausuren")}
          </summary>
          <div className="liste oben-8">{vergangen.map(zeile)}</div>
        </details>
      )}
      {offen && (
        <KlausurDialog fach={fach} klausur={offen === "neu" ? null : offen}
          aufSpeichern={ersetzen} aufLoeschen={offen === "neu" ? null : () => loeschen(offen)}
          aufSchliessen={() => setOffen(null)} />
      )}
    </div>
  );
}
