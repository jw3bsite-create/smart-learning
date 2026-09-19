/*
 * Eine Stapeldatei einlesen: Datei wählen oder Text einfügen, durchsehen,
 * anlegen. Der Stapel entsteht erst auf „Stapel anlegen“ — bis dahin ist
 * nichts gespeichert, und eine fehlerhafte Datei legt gar nichts an.
 */

import React, { useMemo, useRef, useState } from "react";
import { useDaten } from "../core/store.jsx";
import { KARTENARTEN } from "../core/model.js";
import { stapeldateiLesen, passendesFach, artenZaehlen } from "../core/stapeldatei.js";
import { anzahl } from "../core/util.js";
import { gehe } from "../App.jsx";
import { Dialog, Knopf, Symbol } from "./basis.jsx";
import { freieFarbe } from "./Faecher.jsx";
import Formel from "./Formel.jsx";

const NEU = "__neu__";

/* Die ersten Karten zur Ansicht — genug, um zu sehen, ob es die richtige Datei ist. */
function Kartenvorschau({ karten }) {
  const gezeigt = karten.slice(0, 6);
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {gezeigt.map((k, i) => (
        <div key={i} className="kachel" style={{ minHeight: 0, padding: "10px 12px", display: "block" }}>
          <div className="klein blass">{KARTENARTEN[k.art]}</div>
          <div><Formel text={k.term} /></div>
          {k.art === "mehrschritt" ? (
            <ol className="klein matt" style={{ margin: "4px 0 0", paddingLeft: 20 }}>
              {k.schritte.map((s, j) => (
                <li key={j}>{s.frage && <span>{s.frage}: </span>}<Formel text={s.antwort} /></li>
              ))}
            </ol>
          ) : k.definition ? (
            <div className="klein matt" style={{ marginTop: 2 }}>→ <Formel text={k.definition} /></div>
          ) : null}
        </div>
      ))}
      {karten.length > gezeigt.length && (
        <div className="klein blass">
          … und {anzahl(karten.length - gezeigt.length, "weitere Karte", "weitere Karten")}.
        </div>
      )}
    </div>
  );
}

export default function StapeldateiEinfuhr({ fachId = null, ordnerId = null, aufSchliessen }) {
  const { faecher, fachAnlegen, stapelAnlegen, stapelAendern, kartenAnlegenViele } = useDaten();
  const datei = useRef(null);
  const [inhalt, setInhalt] = useState("");
  const [titel, setTitel] = useState(null);        // null: den aus der Datei nehmen
  const [fachWahl, setFachWahl] = useState(null);  // null: aus Datei bzw. Aufruf ableiten
  const [legtAn, setLegtAn] = useState(false);

  const gelesen = useMemo(() => (inhalt.trim() ? stapeldateiLesen(inhalt) : null), [inhalt]);
  const stapel = gelesen?.stapel || null;
  const lebende = faecher.filter((f) => !f.deleted)
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", "de"));

  /* Welches Fach vorgewählt ist: das der Seite, von der man kommt; sonst das
     gleichnamige aus der Datei; gibt es das nicht, ein neues dieses Namens. */
  const vorschlag = (() => {
    if (fachId) return fachId;
    if (!stapel?.fach) return "";
    return passendesFach(stapel.fach, faecher)?.id || NEU;
  })();
  const fach = fachWahl ?? vorschlag;
  const derTitel = titel ?? stapel?.titel ?? "";

  const dateiGewaehlt = async (f) => {
    if (!f) return;
    setInhalt(await f.text());
    setTitel(null); setFachWahl(null);
  };

  const anlegen = async () => {
    if (!stapel || legtAn) return;
    setLegtAn(true);
    try {
      let subjectId = fach || null;
      if (fach === NEU) subjectId = (await fachAnlegen(stapel.fach, freieFarbe(faecher))).id;
      const s = await stapelAnlegen(derTitel.trim() || stapel.titel, ordnerId);
      await stapelAendern(s.id, {
        ...(subjectId ? { subjectId } : {}),
        ...(stapel.beschreibung ? { description: stapel.beschreibung } : {}),
      });
      await kartenAnlegenViele(s.id, stapel.karten);
      aufSchliessen();
      gehe("/stapel/" + s.id);
    } finally {
      setLegtAn(false);
    }
  };

  const arten = stapel ? artenZaehlen(stapel.karten) : {};

  return (
    <Dialog titel="Stapeldatei einlesen" weit aufSchliessen={aufSchliessen}
      fuss={<>
        <Knopf onClick={aufSchliessen}>Abbrechen</Knopf>
        <Knopf art="voll" disabled={!stapel || legtAn} onClick={anlegen}>
          {stapel ? "Stapel anlegen (" + anzahl(stapel.karten.length, "Karte", "Karten") + ")" : "Stapel anlegen"}
        </Knopf>
      </>}>
      <p className="klein blass" style={{ marginTop: 0 }}>
        Eine Stapeldatei (.json) trägt einen ganzen Stapel: Karten, Lückentexte,
        Rechenwege mit Schritten, Hinweise und Formeln. Wähle die Datei aus oder
        füge ihren Text ein.
      </p>

      <div className="reihe umbruch" style={{ gap: 8, marginBottom: 8 }}>
        <input ref={datei} type="file" accept=".json,application/json,text/plain"
          style={{ display: "none" }}
          onChange={(e) => { dateiGewaehlt(e.target.files[0]); e.target.value = ""; }} />
        <Knopf art="voll" symbol="hinauf" onClick={() => datei.current?.click()}>
          Datei auswählen
        </Knopf>
        {inhalt && (
          <Knopf art="klein leer" onClick={() => { setInhalt(""); setTitel(null); setFachWahl(null); }}>
            Leeren
          </Knopf>
        )}
      </div>

      {!stapel && (
        <textarea className="feld"
          style={{ minHeight: 120, fontFamily: "ui-monospace, monospace", fontSize: 13 }}
          placeholder="… oder den Text der Stapeldatei hier einfügen"
          value={inhalt}
          onChange={(e) => { setInhalt(e.target.value); setTitel(null); setFachWahl(null); }} />
      )}

      {gelesen && !stapel && (
        <div className="rueckmeldung schlecht klein" style={{ marginTop: 12 }}>
          <strong>Nichts angelegt.</strong>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {gelesen.fehler.slice(0, 8).map((f, i) => <li key={i}>{f}</li>)}
            {gelesen.fehler.length > 8 && <li>… und {gelesen.fehler.length - 8} weitere.</li>}
          </ul>
        </div>
      )}

      {stapel && (
        <>
          <div className="rueckmeldung gut klein" style={{ marginTop: 4 }}>
            <Symbol name="haken" groesse={15} />{" "}
            {Object.entries(arten)
              .map(([art, n]) => n + " × " + KARTENARTEN[art]).join(", ")}
            {gelesen.hinweise.length > 0 && (
              <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                {gelesen.hinweise.map((h, i) => <li key={i}>{h}</li>)}
              </ul>
            )}
          </div>

          <div className="antwort-gitter" style={{ gap: 12, marginTop: 14 }}>
            <div>
              <label className="beschriftung">Titel</label>
              <input className="feld" value={derTitel} onChange={(e) => setTitel(e.target.value)} />
            </div>
            <div>
              <label className="beschriftung">Fach</label>
              <select className="feld" value={fach} onChange={(e) => setFachWahl(e.target.value)}>
                <option value="">Kein Fach</option>
                {lebende.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                {stapel.fach && !passendesFach(stapel.fach, faecher) && (
                  <option value={NEU}>Neues Fach „{stapel.fach}“</option>
                )}
              </select>
            </div>
          </div>

          <label className="beschriftung" style={{ marginTop: 14 }}>Durchsicht</label>
          <Kartenvorschau karten={stapel.karten} />
        </>
      )}
    </Dialog>
  );
}
