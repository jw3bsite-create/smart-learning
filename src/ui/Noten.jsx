/*
 * Punkte der Kursstufe.
 *
 * Vier Halbjahre, je Halbjahr die Fächer, je Fach die einzelnen Leistungen —
 * schriftlich, mündlich, praktisch, jede mit eigenem Gewicht.
 *
 * Warum das in einer Lern-App steht: Der Lernstand sagt, wie gut eine Karte
 * sitzt; die Punkte sagen, ob das Lernen ankommt. Nebeneinander sieht man,
 * was man an keiner der beiden Zahlen allein sieht — dass ein Fach fleißig
 * geübt wird und trotzdem abrutscht, oder dass das Fach ohne eine einzige
 * Karte am besten läuft.
 */

import React, { useMemo, useState } from "react";
import { useDaten } from "../core/store.jsx";
import {
  HALBJAHRE, ARTEN, ART_IDS, PUNKTE_MAX,
  fachPunkte, halbjahrSchnitt, uebersicht, verlaufVon, bekannteFaecher,
  faecherIm, punkteText, noteText, punkteStufe, begrenze,
} from "../core/noten.js";
import { SymbolKnopf, Knopf, Leer, Dialog, Rueckfrage } from "./basis.jsx";
import { anzahl } from "../core/util.js";

/* ----------------------------- Kleinteile ------------------------------ */

const STUFEN_FARBE = {
  gut: "var(--gruen)",
  solide: "var(--akzent)",
  wacklig: "var(--gelb)",
  schlecht: "var(--rot)",
  leer: "var(--schrift-blass)",
};

/** Eine Punktzahl, in der Farbe ihrer Lage. */
function Punkte({ wert, gross = false }) {
  const farbe = STUFEN_FARBE[punkteStufe(wert)];
  return (
    <span style={{
      color: farbe, fontFamily: "var(--schrift-karten)",
      fontSize: gross ? 26 : 17, fontWeight: 600,
    }}>
      {punkteText(wert)}
      <span className="klein blass" style={{ fontWeight: 400 }}>
        {wert === null ? "" : " P"}
      </span>
    </span>
  );
}

/** Ein Balken von null bis fünfzehn Punkten. */
function Leiste({ wert }) {
  if (wert === null || wert === undefined) return null;
  return (
    <div className="balken" style={{ height: 6 }}>
      <span style={{
        width: (100 * wert / PUNKTE_MAX) + "%",
        background: STUFEN_FARBE[punkteStufe(wert)],
      }} />
    </div>
  );
}

/* ------------------------- Ein Fach im Halbjahr ------------------------- */

function FachZeile({ notenfach, aufOeffnen }) {
  const stand = fachPunkte(notenfach);
  return (
    <div className="karten-zeile" style={{ display: "block", padding: 14, cursor: "pointer" }}
      onClick={aufOeffnen}>
      <div className="reihe" style={{ marginBottom: 8 }}>
        <div className="dehnen" style={{ fontFamily: "var(--schrift-karten)", fontSize: 17 }}>
          {notenfach.fach || "Ohne Namen"}
        </div>
        {stand.vonHand !== null && (
          <span className="marke" title="Von Hand gesetzt: sticht die Rechnung">
            Zeugnis
          </span>
        )}
        <Punkte wert={stand.punkte} />
      </div>
      <Leiste wert={stand.punkte} />
      <div className="reihe klein blass" style={{ marginTop: 6, gap: 12, flexWrap: "wrap" }}>
        {ART_IDS.filter((a) => stand.proArt[a] !== null).map((a) => (
          <span key={a}>{ARTEN[a].name}: {punkteText(stand.proArt[a])}</span>
        ))}
        {stand.anzahl === 0 && <span>noch keine Leistung eingetragen</span>}
      </div>
    </div>
  );
}

/* --------------------------- Eine Leistung ----------------------------- */

function LeistungZeile({ leistung, aufAendern, aufLoeschen }) {
  const [offen, setOffen] = useState(false);
  return (
    <div className="karten-zeile" style={{ display: "block", padding: "10px 14px" }}>
      <div className="reihe">
        <span className="marke">{ARTEN[leistung.art]?.kurz || "?"}</span>
        <div className="dehnen klein">
          {leistung.was || ARTEN[leistung.art]?.name || "Leistung"}
          {Number(leistung.gewicht) !== 1 && (
            <span className="blass"> · Gewicht {punkteText(leistung.gewicht)}</span>
          )}
        </div>
        <Punkte wert={leistung.punkte} />
        <SymbolKnopf symbol="stift" titel="Ändern" art="leer klein"
          onClick={() => setOffen((w) => !w)} />
        <SymbolKnopf symbol="muell" titel="Entfernen" art="leer klein"
          onClick={aufLoeschen} />
      </div>
      {offen && (
        <div className="gitter" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", marginTop: 10 }}>
          <label className="beschriftung">Bezeichnung
            <input className="feld" value={leistung.was}
              onChange={(e) => aufAendern({ was: e.target.value })} />
          </label>
          <label className="beschriftung">Art
            <select className="feld" value={leistung.art}
              onChange={(e) => aufAendern({ art: e.target.value })}>
              {ART_IDS.map((a) => <option key={a} value={a}>{ARTEN[a].name}</option>)}
            </select>
          </label>
          <label className="beschriftung">Punkte
            <input className="feld" type="number" min="0" max="15" step="0.5"
              value={leistung.punkte}
              onChange={(e) => aufAendern({ punkte: begrenze(e.target.value) })} />
          </label>
          <label className="beschriftung">Gewicht
            <input className="feld" type="number" min="0" step="0.5" value={leistung.gewicht}
              onChange={(e) => aufAendern({ gewicht: Math.max(0, Number(e.target.value) || 0) })} />
          </label>
        </div>
      )}
    </div>
  );
}

/* --------------------------- Ein Fach im Ganzen ------------------------- */

function FachAnsicht({ notenfach, aufSchliessen }) {
  const {
    notenfaecher, faecher, notenfachAendern, notenfachLoeschen,
    leistungAnlegen, leistungAendern, leistungLoeschen,
  } = useDaten();
  const [loeschen, setLoeschen] = useState(false);

  const stand = fachPunkte(notenfach);
  const verlauf = useMemo(
    () => verlaufVon(notenfaecher, notenfach.fach), [notenfaecher, notenfach.fach]);
  const halbjahr = HALBJAHRE.find((h) => h.id === notenfach.halbjahr);

  return (
    <div className="mitte">
      <div className="kopfzeile">
        <SymbolKnopf symbol="zurueck" titel="Zurück" art="leer" onClick={aufSchliessen} />
        <div className="dehnen">
          <h1 style={{ marginBottom: 2 }}>{notenfach.fach}</h1>
          <div className="klein matt">{halbjahr?.name}</div>
        </div>
        <Punkte wert={stand.punkte} gross />
      </div>

      {/* ------------------------- Der Verlauf --------------------------- */}
      {verlauf.some((v) => v.punkte !== null) && (
        <div className="zahl-kachel" style={{ marginBottom: 22 }}>
          <div className="klein matt" style={{ marginBottom: 10 }}>
            Dieses Fach über die Halbjahre
          </div>
          <div className="reihe" style={{ gap: 16, flexWrap: "wrap" }}>
            {verlauf.map((v) => (
              <div key={v.halbjahr} style={{ minWidth: 74 }}>
                <div className="klein blass">{v.halbjahr}</div>
                <Punkte wert={v.punkte} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------- Die Leistungen ------------------------ */}
      {ART_IDS.map((art) => {
        const eigene = (notenfach.leistungen || []).filter((l) => l.art === art);
        return (
          <div key={art} style={{ marginBottom: 20 }}>
            <div className="reihe" style={{ marginBottom: 8 }}>
              <h3 className="dehnen">{ARTEN[art].name}</h3>
              {stand.proArt[art] !== null && <Punkte wert={stand.proArt[art]} />}
              <Knopf art="klein" symbol="plus"
                onClick={() => leistungAnlegen(notenfach.id, { art })}>
                Eintragen
              </Knopf>
            </div>
            {eigene.length === 0 ? (
              <div className="klein blass">Nichts eingetragen.</div>
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                {eigene.map((l) => (
                  <LeistungZeile key={l.id} leistung={l}
                    aufAendern={(aend) => leistungAendern(notenfach.id, l.id, aend)}
                    aufLoeschen={() => leistungLoeschen(notenfach.id, l.id)} />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* -------------------------- Gewichtung --------------------------- */}
      <h3 style={{ marginBottom: 4 }}>Wie die Arten zählen</h3>
      <p className="klein matt" style={{ marginTop: 0 }}>
        Erst wird je Art gemittelt, dann werden die Arten nach diesen Zahlen
        zusammengefasst. Was an deiner Schule gilt, weiß die App nicht, darum
        stehen alle drei auf eins, bis du es änderst. Eine Art ohne Leistungen
        zählt nicht mit.
      </p>
      <div className="reihe umbruch" style={{ marginBottom: 22 }}>
        {ART_IDS.map((art) => (
          <label key={art} className="beschriftung" style={{ minWidth: 110 }}>
            {ARTEN[art].name}
            <input className="feld" type="number" min="0" step="0.5"
              value={notenfach.artGewicht?.[art] ?? 1}
              onChange={(e) => notenfachAendern(notenfach.id, {
                artGewicht: {
                  ...notenfach.artGewicht,
                  [art]: Math.max(0, Number(e.target.value) || 0),
                },
              })} />
          </label>
        ))}
      </div>

      {/* ------------------------- Zeugnispunkte ------------------------- */}
      <h3 style={{ marginBottom: 4 }}>Punkte auf dem Zeugnis</h3>
      <p className="klein matt" style={{ marginTop: 0 }}>
        Steht hier eine Zahl, gilt sie statt der Rechnung, am Ende zählt, was
        der Lehrer eingetragen hat, nicht was wir uns ausgerechnet haben.
        {stand.gerechnet !== null && (
          <> Gerechnet wären es <strong>{punkteText(stand.gerechnet)}</strong>.</>
        )}
      </p>
      <div className="reihe" style={{ marginBottom: 26 }}>
        <input className="feld" type="number" min="0" max="15" step="1"
          style={{ width: 120 }}
          placeholder="—"
          value={notenfach.endpunkte ?? ""}
          onChange={(e) => notenfachAendern(notenfach.id, {
            endpunkte: e.target.value === "" ? null : begrenze(e.target.value),
          })} />
        {notenfach.endpunkte !== null && notenfach.endpunkte !== undefined && (
          <Knopf art="klein leer"
            onClick={() => notenfachAendern(notenfach.id, { endpunkte: null })}>
            Wieder rechnen lassen
          </Knopf>
        )}
      </div>

      {/* ------------------------- Lernfach dazu ------------------------- */}
      {faecher.length > 0 && (
        <>
          <h3 style={{ marginBottom: 4 }}>Zugehöriges Lernfach</h3>
          <p className="klein matt" style={{ marginTop: 0 }}>
            Verknüpft, erscheinen die Punkte auch beim Fortschritt neben dem
            Lernstand, dort sieht man, ob das Üben ankommt.
          </p>
          <select className="feld" style={{ maxWidth: 320, marginBottom: 26 }}
            value={notenfach.subjectId || ""}
            onChange={(e) => notenfachAendern(notenfach.id,
              { subjectId: e.target.value || null })}>
            <option value="">(keines)</option>
            {faecher.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </>
      )}

      <div className="reihe">
        <Knopf symbol="muell" onClick={() => setLoeschen(true)}>Fach entfernen</Knopf>
      </div>

      {loeschen && (
        <Rueckfrage titel={"„" + notenfach.fach + "“ entfernen?"}
          text="Die eingetragenen Leistungen dieses Halbjahres gehen mit."
          bestaetigung="Entfernen"
          aufNein={() => setLoeschen(false)}
          aufJa={async () => {
            await notenfachLoeschen(notenfach.id);
            aufSchliessen();
          }} />
      )}
    </div>
  );
}

/* ------------------------------ Übersicht ------------------------------ */

export default function Noten() {
  const { notenfaecher, notenfachAnlegen } = useDaten();
  const [halbjahr, setHalbjahr] = useState(HALBJAHRE[0].id);
  const [offen, setOffen] = useState(null);
  const [anlegen, setAnlegen] = useState(false);
  const [neuerName, setNeuerName] = useState("");

  const alles = useMemo(() => uebersicht(notenfaecher), [notenfaecher]);
  const dasFach = offen ? notenfaecher.find((n) => n.id === offen) : null;

  if (dasFach) {
    return <FachAnsicht notenfach={dasFach} aufSchliessen={() => setOffen(null)} />;
  }

  const gewaehlt = alles.halbjahre.find((h) => h.id === halbjahr);
  const vorschlaege = bekannteFaecher(notenfaecher)
    .filter((n) => !faecherIm(notenfaecher, halbjahr)
      .some((f) => f.fach.toLowerCase() === n.toLowerCase()));

  const anlegenAusfuehren = async (name) => {
    const sauber = String(name || "").trim();
    if (!sauber) return;
    const n = await notenfachAnlegen({ halbjahr, fach: sauber });
    setAnlegen(false); setNeuerName("");
    setOffen(n.id);
  };

  return (
    <div className="mitte">
      <div className="kopfzeile">
        <h1 className="dehnen">Punkte</h1>
        <Knopf art="voll" symbol="plus" onClick={() => setAnlegen(true)}>Fach</Knopf>
      </div>

      {/* --------------------------- Der Schnitt -------------------------- */}
      {alles.gesamt && (
        <div className="gitter"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", marginBottom: 24 }}>
          <div className="zahl-kachel">
            <div className="klein matt">Schnitt über alles</div>
            <Punkte wert={alles.gesamt.punkte} gross />
            <div className="klein blass">
              aus {alles.gesamt.leistungen} Halbjahresleistungen
            </div>
          </div>
          <div className="zahl-kachel">
            <div className="klein matt">Umgerechnet</div>
            <div className="zahl">{noteText(alles.gesamt.punkte)}</div>
            <div className="klein blass">nach der üblichen Formel</div>
          </div>
        </div>
      )}

      {/* -------------------------- Die Halbjahre ------------------------- */}
      <div className="reihe umbruch" style={{ marginBottom: 18, gap: 8 }}>
        {alles.halbjahre.map((h) => (
          <button key={h.id}
            className={"knopf klein" + (h.id === halbjahr ? " voll" : "")}
            onClick={() => setHalbjahr(h.id)}>
            {h.stufe} · {h.kurz}
            {h.schnitt !== null && (
              <span className="klein" style={{ opacity: 0.75 }}>
                {" "}· {punkteText(h.schnitt)}
              </span>
            )}
          </button>
        ))}
      </div>

      {gewaehlt && gewaehlt.faecher.length > 0 && (
        <div className="zahl-kachel" style={{ marginBottom: 18 }}>
          <div className="reihe">
            <div className="dehnen klein matt">
              Schnitt in {gewaehlt.name} · {anzahl(gewaehlt.anzahl, "Fach", "Fächer")}
            </div>
            <Punkte wert={gewaehlt.schnitt} />
            <span className="klein blass">≙ {noteText(gewaehlt.schnitt)}</span>
          </div>
        </div>
      )}

      {!gewaehlt || gewaehlt.faecher.length === 0 ? (
        <Leer symbol="statistik" titel="Noch keine Fächer in diesem Halbjahr"
          text="Trag deine Fächer ein und dann die einzelnen Leistungen, schriftlich, mündlich, praktisch, jede mit eigenem Gewicht.">
          <Knopf art="voll gross" symbol="plus" onClick={() => setAnlegen(true)}>
            Erstes Fach anlegen
          </Knopf>
        </Leer>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {gewaehlt.faecher.map((f) => (
            <FachZeile key={f.id} notenfach={f} aufOeffnen={() => setOffen(f.id)} />
          ))}
        </div>
      )}

      {/* ---------------------------- Der Hinweis ------------------------- */}
      <p className="klein blass" style={{ marginTop: 28, maxWidth: "60ch" }}>
        Der Schnitt hier ist der schlichte Durchschnitt deiner
        Halbjahresleistungen, <strong>nicht</strong> die Abiturnote. Die
        entsteht in Baden-Württemberg aus Block I und Block II, mit
        Einbringungspflichten und doppelt gewichteten Kursen. Welche Kurse in
        welcher Zahl zählen, steht in der Verordnung für deinen Jahrgang; die
        kennt diese App nicht und rät sie auch nicht.
      </p>

      {anlegen && (
        <Dialog titel={"Fach in " + (gewaehlt?.name || "")}
          aufSchliessen={() => setAnlegen(false)}
          fuss={<>
            <Knopf onClick={() => setAnlegen(false)}>Abbrechen</Knopf>
            <Knopf art="voll" onClick={() => anlegenAusfuehren(neuerName)}>Anlegen</Knopf>
          </>}>
          <label className="beschriftung">Name des Fachs</label>
          <input className="feld" autoFocus value={neuerName}
            placeholder="Mathematik"
            onChange={(e) => setNeuerName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") anlegenAusfuehren(neuerName); }} />
          {vorschlaege.length > 0 && (
            <>
              <div className="klein matt" style={{ margin: "14px 0 6px" }}>
                Schon in anderen Halbjahren:
              </div>
              <div className="reihe umbruch">
                {vorschlaege.map((n) => (
                  <Knopf key={n} art="klein" onClick={() => anlegenAusfuehren(n)}>{n}</Knopf>
                ))}
              </div>
            </>
          )}
        </Dialog>
      )}
    </div>
  );
}

/* ===================================================================== */
/*  Für andere Seiten                                                    */
/* ===================================================================== */

/**
 * Die Punkte eines Lernfachs, über alle Halbjahre und im jüngsten.
 * Wird auf der Fortschrittsseite neben den Lernstand gestellt.
 */
export function punkteZuLernfach(notenfaecher, subjectId) {
  const eigene = (notenfaecher || [])
    .filter((n) => n && !n.deleted && n.subjectId === subjectId);
  if (!eigene.length) return null;
  const mitPunkten = eigene
    .map((n) => ({ halbjahr: n.halbjahr, punkte: fachPunkte(n).punkte }))
    .filter((x) => x.punkte !== null)
    .sort((a, b) => a.halbjahr.localeCompare(b.halbjahr));
  if (!mitPunkten.length) return null;
  return {
    schnitt: mitPunkten.reduce((s, x) => s + x.punkte, 0) / mitPunkten.length,
    juengste: mitPunkten[mitPunkten.length - 1],
    anzahl: mitPunkten.length,
  };
}

export { halbjahrSchnitt };
