/*
 * Lernzeit auf der Seite Fortschritt: heute, diese Woche, dieser Monat,
 * dieses Jahr — getrennt nach Lernen und Erstellen, als Verlauf und je Fach.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useDaten } from "../core/store.jsx";
import {
  LERNZEIT_EREIGNIS, LEERLAUF_TEXT, zeitraeume, verlauf, jeFach, dauerText, dauerKurz,
  wochenBeginn, monatsBeginn, jahresBeginn,
} from "../core/lernzeit.js";
import { Knopf, Symbol, useMerker } from "./basis.jsx";

/** Die Zeitblöcke aus der Ablage — neu gelesen, sobald sich etwas ändert. */
export function useLernzeiten() {
  const { lernzeitLesen } = useDaten();
  const [bloecke, setBloecke] = useState(null);
  useEffect(() => {
    let aus = false;
    const laden = () => lernzeitLesen()
      .then((b) => { if (!aus) setBloecke(b); })
      .catch(() => { if (!aus) setBloecke([]); });
    laden();
    window.addEventListener(LERNZEIT_EREIGNIS, laden);
    return () => { aus = true; window.removeEventListener(LERNZEIT_EREIGNIS, laden); };
  }, [lernzeitLesen]);
  return bloecke;
}

const EINHEITEN = {
  tag: { name: "Tage", anzahl: 14 },
  woche: { name: "Wochen", anzahl: 12 },
  monat: { name: "Monate", anzahl: 12 },
};

const FACH_ZEITRAUM = {
  woche: { name: "Woche", von: wochenBeginn },
  monat: { name: "Monat", von: monatsBeginn },
  jahr: { name: "Jahr", von: jahresBeginn },
  gesamt: { name: "Gesamt", von: () => -Infinity },
};

function Wahl({ werte, wert, setWert }) {
  return (
    <div className="reihe" style={{ gap: 4 }} role="group">
      {Object.entries(werte).map(([k, v]) => (
        <Knopf key={k} art={"klein" + (wert === k ? " voll" : "")}
          aria-pressed={wert === k} onClick={() => setWert(k)}>
          {v.name}
        </Knopf>
      ))}
    </div>
  );
}

/* Achsenschritte in Sekunden: runde Minuten- und Stundenwerte. */
const SCHRITTE = [5, 10, 15, 30, 60, 120, 180, 300, 600, 1200, 1800, 3000, 6000]
  .map((m) => m * 60);

function achse(hoechst) {
  const schritt = SCHRITTE.find((s) => s * 4 >= hoechst) || SCHRITTE[SCHRITTE.length - 1];
  const oben = Math.max(schritt, Math.ceil(hoechst / schritt) * schritt);
  const linien = [];
  for (let w = 0; w <= oben; w += schritt) linien.push(w);
  return { oben, linien };
}

/* Gestapelte Säulen: Lernen unten, Erstellen darauf. */
function Verlauf({ saeulen }) {
  const [aktiv, setAktiv] = useState(null);
  const hoechst = Math.max(0, ...saeulen.map((s) => s.lernen + s.erstellen));
  const { oben, linien } = achse(hoechst);
  const jedes = saeulen.length > 12 ? 2 : 1;       // jede zweite Beschriftung, wenn es eng wird
  const a = aktiv === null ? null : saeulen[aktiv];

  return (
    <div className="lz-diagramm">
      <div className="lz-flaeche">
        {linien.map((w) => (
          <div key={w} className="lz-linie" style={{ bottom: (100 * w / oben) + "%" }}>
            <span>{dauerKurz(w)}</span>
          </div>
        ))}
        <div className="lz-saeulen" onPointerLeave={() => setAktiv(null)}>
          {saeulen.map((s, i) => {
            const leer = s.lernen + s.erstellen === 0;
            return (
              <button key={s.beginn} type="button"
                className={"lz-saeule" + (aktiv === i ? " aktiv" : "")}
                aria-label={s.lang + ": " + dauerText(s.lernen) + " Lernen, "
                  + dauerText(s.erstellen) + " Erstellen"}
                onPointerEnter={() => setAktiv(i)} onFocus={() => setAktiv(i)}
                onBlur={() => setAktiv(null)} onClick={() => setAktiv(i)}>
                {!leer && (
                  <span className="lz-stapel" style={{ height: (100 * (s.lernen + s.erstellen) / oben) + "%" }}>
                    {s.erstellen > 0 && <i className="lz-erstellen" style={{ flexGrow: s.erstellen }} />}
                    {s.lernen > 0 && <i className="lz-lernen" style={{ flexGrow: s.lernen }} />}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {a && (
          /* Rechte Hälfte: Der Hinweis hängt links von der Säule, sonst rechts —
             so bleibt er auch auf dem Handy ganz im Bild. */
          <div className="lz-hinweis" style={{
            left: (100 * (aktiv + 0.5) / saeulen.length) + "%",
            transform: aktiv >= saeulen.length / 2
              ? "translateX(calc(-100% + 12px))" : "translateX(-12px)",
          }}>
            <div className="klein matt">{a.lang}</div>
            <div className="reihe" style={{ gap: 8 }}>
              <i className="lz-strich lz-lernen" /><strong>{dauerText(a.lernen)}</strong>
              <span className="klein matt">Lernen</span>
            </div>
            <div className="reihe" style={{ gap: 8 }}>
              <i className="lz-strich lz-erstellen" /><strong>{dauerText(a.erstellen)}</strong>
              <span className="klein matt">Erstellen</span>
            </div>
          </div>
        )}
      </div>
      <div className="lz-achse">
        {saeulen.map((s, i) => (
          <span key={s.beginn}>{(saeulen.length - 1 - i) % jedes === 0 ? s.kurz : ""}</span>
        ))}
      </div>
    </div>
  );
}

export default function Lernzeit() {
  const { faecher } = useDaten();
  const bloecke = useLernzeiten();
  const [einheit, setEinheit] = useMerker("lernzeitEinheit", "tag");
  const [fachZeitraum, setFachZeitraum] = useMerker("lernzeitFach", "monat");

  const jetzt = Date.now();
  const liste = bloecke || [];
  const raeume = useMemo(() => zeitraeume(liste, jetzt), [bloecke]);
  const saeulen = useMemo(() => verlauf(liste, einheit,
    (EINHEITEN[einheit] || EINHEITEN.tag).anzahl, jetzt), [bloecke, einheit]);
  const nachFach = useMemo(() => jeFach(liste,
    (FACH_ZEITRAUM[fachZeitraum] || FACH_ZEITRAUM.monat).von(jetzt)), [bloecke, fachZeitraum]);

  if (bloecke === null) return null;

  const fachName = (id) => id ? faecher.find((f) => f.id === id)?.name || "Gelöschtes Fach"
    : "Ohne Fach";
  const fachFarbe = (id) => faecher.find((f) => f.id === id)?.farbe || "var(--rand)";
  const fachHoechst = Math.max(1, ...nachFach.map((f) => f.lernen + f.erstellen));

  const kacheln = [
    ["Heute", raeume.heute], ["Diese Woche", raeume.woche],
    ["Dieser Monat", raeume.monat], ["Dieses Jahr", raeume.jahr],
  ];

  return (
    <section style={{ marginBottom: 30 }}>
      <h3 style={{ marginBottom: 4 }}>Lernzeit</h3>
      <p className="klein blass" style={{ marginTop: 0, maxWidth: "70ch" }}>
        Gezählt wird nur, solange du in einem Lernmodus oder beim Bearbeiten eines
        Stapels wirklich etwas tust und die App im Vordergrund ist. Nach
        {" " + LEERLAUF_TEXT} ohne Tippen oder Klicken hält die Uhr an; der
        nächste Klick setzt sie fort. Offen im Hintergrund zählt nichts.
      </p>

      {liste.length === 0 ? (
        <div className="zahl-kachel klein matt">
          Noch keine Zeit gemessen. Sobald du lernst oder Karten anlegst, steht sie hier.
        </div>
      ) : (
        <>
          <div className="gitter" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", marginBottom: 18 }}>
            {kacheln.map(([name, s]) => (
              <div key={name} className="zahl-kachel">
                <div className="reihe klein matt"><Symbol name="uhr" groesse={15} /> {name}</div>
                <div className="zahl">{dauerText(s.lernen)}</div>
                <div className="klein blass">gelernt · {dauerText(s.erstellen)} erstellt</div>
              </div>
            ))}
          </div>

          <div className="reihe umbruch" style={{ gap: 12, marginBottom: 10 }}>
            <Wahl werte={EINHEITEN} wert={einheit} setWert={setEinheit} />
            <div className="dehnen" />
            <div className="reihe klein matt" style={{ gap: 14 }}>
              <span className="reihe" style={{ gap: 6 }}><i className="lz-muster lz-lernen" /> Lernen</span>
              <span className="reihe" style={{ gap: 6 }}><i className="lz-muster lz-erstellen" /> Erstellen</span>
            </div>
          </div>
          <Verlauf saeulen={saeulen} />

          <details style={{ marginTop: 8 }}>
            <summary className="klein matt" style={{ cursor: "pointer" }}>Als Tabelle</summary>
            <div style={{ overflowX: "auto" }}>
              <table className="lz-tabelle">
                <thead><tr><th>Zeitraum</th><th>Lernen</th><th>Erstellen</th></tr></thead>
                <tbody>
                  {[...saeulen].reverse().map((s) => (
                    <tr key={s.beginn}>
                      <td>{s.lang}</td><td>{dauerText(s.lernen)}</td><td>{dauerText(s.erstellen)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          <div className="reihe umbruch" style={{ gap: 12, margin: "22px 0 10px" }}>
            <h3 className="dehnen" style={{ margin: 0, fontSize: "1em" }}>Nach Fach</h3>
            <Wahl werte={FACH_ZEITRAUM} wert={fachZeitraum} setWert={setFachZeitraum} />
          </div>
          {nachFach.length === 0 ? (
            <div className="klein blass">In diesem Zeitraum noch nichts.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {nachFach.map((f) => (
                <div key={f.subjectId || "ohne"}>
                  <div className="reihe" style={{ gap: 8 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 2, flex: "none",
                      background: fachFarbe(f.subjectId) }} />
                    <span className="dehnen">{fachName(f.subjectId)}</span>
                    <span className="klein">{dauerText(f.lernen)}</span>
                    <span className="klein blass">+ {dauerText(f.erstellen)} erstellt</span>
                  </div>
                  <div className="lz-fachbalken">
                    {f.lernen > 0 && <i className="lz-lernen" style={{ width: (100 * f.lernen / fachHoechst) + "%" }} />}
                    {f.erstellen > 0 && <i className="lz-erstellen" style={{ width: (100 * f.erstellen / fachHoechst) + "%" }} />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
