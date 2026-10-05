/*
 * Das Fehlerheft.
 *
 * Eine Liste dessen, was zuletzt schiefging — mit der eigenen Einschätzung
 * daneben. Ganz oben steht, was man für sicher hielt und doch nicht wusste.
 *
 * Geübt wird von hier aus als Übung, nicht als Wiederholung: Die Termine im
 * Abrufen bleiben dem Plan überlassen (siehe core/fehler.js).
 */

import React, { useMemo, useState } from "react";
import { useDaten } from "../core/store.jsx";
import {
  ZEITRAEUME, von, fehlerListe, sortiere, nurFach, nurUeberschaetzt, nachFach, zahlen,
} from "../core/fehler.js";
import { richtungName, istRelevant } from "../core/model.js";
import { rueckfaelleSeitFreigabe } from "../core/fsrs.js";
import { anzahl, datumKurz } from "../core/util.js";
import { gehe } from "../App.jsx";
import { Symbol, Knopf, Leer, useMerker, FachPunkt } from "./basis.jsx";
import Formel from "./Formel.jsx";

function Wahl({ werte, wert, setWert }) {
  return (
    <div className="reihe" style={{ gap: 4, flexWrap: "wrap" }} role="group">
      {werte.map(([schluessel, name]) => (
        <Knopf key={schluessel} art={"klein" + (wert === schluessel ? " voll" : "")}
          aria-pressed={wert === schluessel} onClick={() => setWert(schluessel)}>
          {name}
        </Knopf>
      ))}
    </div>
  );
}

export default function Fehlerheft({ fachId = null }) {
  const { reviews, karten, faecher, stapelVon, fachVon, zustaende, karteEntsperren } = useDaten();
  const [zeitraum, setZeitraum] = useMerker("fehlerZeitraum", "monat");
  const [nurTeuer, setNurTeuer] = useState(false);
  const [fach, setFach] = useState(fachId);

  const kartenNachId = useMemo(
    () => new Map(karten.map((k) => [k.id, k])), [karten]);

  const alle = useMemo(
    () => fehlerListe(reviews, { seit: von(zeitraum) }), [reviews, zeitraum]);

  /* Karten, die inzwischen gelöscht oder abgehakt sind, gehören nicht ins
     Heft: Sie kommen nirgends mehr dran, und man kann nichts tun. */
  const vorhanden = useMemo(() => alle.filter((e) => {
    const k = kartenNachId.get(e.cardId);
    return k && !k.deleted && k.nichtRelevant !== true;
  }), [alle, kartenNachId]);

  const gefiltert = useMemo(() => {
    let liste = nurFach(vorhanden, fach);
    if (nurTeuer) liste = nurUeberschaetzt(liste);
    return sortiere(liste);
  }, [vorhanden, fach, nurTeuer]);

  const gruppen = useMemo(() => nachFach(gefiltert), [gefiltert]);

  /* Stillgelegte Karten, je Karte einmal — auch wenn beide Richtungen hängen. */
  const haengend = useMemo(() => {
    const nachKarte = new Map();
    for (const z of Object.values(zustaende)) {
      if (!z.gesperrt) continue;
      const k = kartenNachId.get(z.cardId);
      if (!istRelevant(k)) continue;
      const s = stapelVon(k.setId);
      if (fach && s?.subjectId !== fach) continue;
      const e = nachKarte.get(k.id) || { karte: k, stapel: s, rueckfaelle: 0 };
      e.rueckfaelle = Math.max(e.rueckfaelle, rueckfaelleSeitFreigabe(z));
      nachKarte.set(k.id, e);
    }
    return [...nachKarte.values()];
  }, [zustaende, kartenNachId, stapelVon, fach]);
  const z = zahlen(gefiltert);
  const teuer = zahlen(vorhanden).ueberschaetzt;

  const fachName = (id) => (id ? fachVon(id)?.name || "Gelöschtes Fach" : "Ohne Fach");

  return (
    <div className="mitte">
      <div className="kopfzeile">
        <h1>Fehlerheft</h1>
        {gefiltert.length > 0 && (
          <div className="kopf-werkzeuge">
            <Knopf art="voll" symbol="wuerfel"
              onClick={() => gehe("/fragen/fehler" + (fach ? "/" + fach : ""))}>
              Fehler üben
            </Knopf>
          </div>
        )}
      </div>

      <p className="klein matt" style={{ marginTop: 0, maxWidth: "70ch" }}>
        Alles, was du im gewählten Zeitraum mit <strong>Nochmal</strong> bewertet
        hast. Oben steht, was du für sicher hieltest und doch nicht wusstest, das
        ist die teuerste Sorte. Üben von hier zählt als Übung und verschiebt keine
        Termine.
      </p>

      <div className="reihe umbruch" style={{ gap: 12, margin: "16px 0 18px" }}>
        <Wahl werte={Object.entries(ZEITRAEUME).map(([k, v]) => [k, v.name])}
          wert={zeitraum} setWert={setZeitraum} />
        <div className="dehnen" />
        <Knopf art={"klein" + (nurTeuer ? " voll" : "")}
          aria-pressed={nurTeuer} onClick={() => setNurTeuer((x) => !x)}>
          Nur überschätzte
        </Knopf>
        {faecher.length > 0 && (
          <select className="feld klein" style={{ width: "auto" }} value={fach || ""}
            onChange={(e) => setFach(e.target.value || null)}>
            <option value="">Alle Fächer</option>
            {faecher.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        )}
      </div>

      {haengend.length > 0 && (
        <section className="zahl-kachel" style={{ marginBottom: 24 }}>
          <div className="reihe" style={{ marginBottom: 6 }}>
            <Symbol name="stopp" groesse={16} style={{ color: "var(--rot)" }} />
            <h3 className="dehnen" style={{ margin: 0 }}>
              {anzahl(haengend.length, "Karte hängt", "Karten hängen")}
            </h3>
          </div>
          <p className="klein matt" style={{ marginTop: 0 }}>
            Diese Karten hast du immer wieder gewusst und wieder vergessen. Die App legt
            sie still, weil dann meist die Karte zu groß ist, nicht dein Gedächtnis zu
            schlecht. Teile sie auf oder formuliere sie um, dann kommen sie von selbst
            wieder dran. Oder gib sie unverändert frei.
          </p>
          <div style={{ display: "grid", gap: 8 }}>
            {haengend.map(({ karte, stapel, rueckfaelle }) => (
              <div key={karte.id} className="reihe umbruch" style={{ gap: 8 }}>
                <span className="dehnen"><Formel text={karte.term || "(ohne Text)"} /></span>
                <span className="klein blass">
                  {stapel?.title || "Stapel gelöscht"} · {anzahl(rueckfaelle, "Rückfall", "Rückfälle")}
                </span>
                {stapel && (
                  <Knopf art="klein" symbol="stift"
                    onClick={() => gehe("/stapel/" + stapel.id + "/bearbeiten")}>
                    Bearbeiten
                  </Knopf>
                )}
                <Knopf art="klein" onClick={() => karteEntsperren(karte.id)}>Freigeben</Knopf>
              </div>
            ))}
          </div>
        </section>
      )}

      {gefiltert.length === 0 ? (
        <Leer symbol="haken" titel="Nichts im Heft"
          text={nurTeuer
            ? "Keine Karte, die du für sicher hieltest und doch nicht wusstest. Das ist ein gutes Zeichen."
            : "In diesem Zeitraum hast du nichts mit „Nochmal“ bewertet."}>
          <Knopf onClick={() => gehe("/abrufen")}>Zum Abrufen</Knopf>
        </Leer>
      ) : (
        <>
          <div className="gitter" style={{ gridTemplateColumns:
            "repeat(auto-fit, minmax(150px, 1fr))", marginBottom: 22 }}>
            <div className="zahl-kachel">
              <div className="reihe klein matt"><Symbol name="kreuz" groesse={15} /> Karten</div>
              <div className="zahl">{z.karten}</div>
              <div className="klein blass">{anzahl(z.fehler, "Fehler", "Fehler")} insgesamt</div>
            </div>
            <div className="zahl-kachel">
              <div className="reihe klein matt"><Symbol name="auge" groesse={15} /> Überschätzt</div>
              <div className="zahl" style={{ color: z.ueberschaetzt ? "var(--rot)" : undefined }}>
                {z.ueberschaetzt}
              </div>
              <div className="klein blass">„sicher“ gesagt und doch falsch</div>
            </div>
          </div>

          {!nurTeuer && teuer > 0 && (
            <p className="klein matt" style={{ marginTop: -10, marginBottom: 18 }}>
              Wenig Zeit? {anzahl(teuer, "Karte", "Karten")} davon sind überschätzt,
              die lohnen zuerst.
            </p>
          )}

          {gruppen.map((g) => (
            <section key={g.subjectId || "ohne"} style={{ marginBottom: 24 }}>
              <div className="reihe" style={{ marginBottom: 8 }}>
                <FachPunkt farbe={fachVon(g.subjectId)?.farbe || "var(--rand)"} />
                <h3 className="dehnen" style={{ margin: 0 }}>{fachName(g.subjectId)}</h3>
                <span className="klein blass">{anzahl(g.fehler, "Fehler", "Fehler")}</span>
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                {g.eintraege.map((e) => {
                  const karte = kartenNachId.get(e.cardId);
                  const stapel = stapelVon(e.setId);
                  const frage = e.richtung === "dt" ? karte.definition : karte.term;
                  const loesung = e.richtung === "dt" ? karte.term : karte.definition;
                  return (
                    <div key={e.schluessel} className="kachel" style={{ cursor: "default" }}>
                      <div className="reihe umbruch" style={{ gap: 8 }}>
                        <strong className="dehnen"><Formel text={frage || "(ohne Text)"} /></strong>
                        {e.ueberschaetzt > 0 && (
                          <span className="marke rot">
                            {e.ueberschaetzt}× „sicher“ und falsch
                          </span>
                        )}
                        <span className="marke">{anzahl(e.fehler, "Fehler", "Fehler")}</span>
                      </div>
                      <div className="matt"><Formel text={loesung} /></div>
                      <div className="reihe umbruch klein blass" style={{ gap: 8 }}>
                        <span>{stapel?.title || "Stapel gelöscht"}</span>
                        <span>· {richtungName(e.richtung, stapel)}</span>
                        <span>· zuletzt {datumKurz(e.zuletzt)}</span>
                        {e.imLernen > 0 && <span>· davon {e.imLernen} beim Üben</span>}
                        <div className="dehnen" />
                        {stapel && (
                          <Knopf art="klein leer" symbol="stapel"
                            onClick={() => gehe("/stapel/" + stapel.id)}>
                            Zum Stapel
                          </Knopf>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
