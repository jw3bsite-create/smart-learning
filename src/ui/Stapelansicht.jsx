/*
 * Ein einzelner Stapel: Überblick, Wahl des Lernmodus, Liste aller Karten.
 */

import React, { useMemo, useState } from "react";
import { useDaten } from "../core/store.jsx";
import { anteileNachStufe, stufe, STUFEN } from "../core/fsrs.js";
import { stapelStand } from "../core/warteschlange.js";
import { anzahl, datumKurz, mische } from "../core/util.js";
import { alsCsv, alsText, alsAnkiText, alsCsvMitPlan } from "../core/importer.js";
import { sprich, SPRACHEN } from "../core/speech.js";
import { gehe, MODI, zurueck, ersetze, vorigerWeg } from "../App.jsx";
import { wegName } from "../core/verlauf.js";
import { alsStapeldatei } from "../core/stapeldatei.js";
import {
  Symbol, SymbolKnopf, Knopf, Menue, MenuePunkt, Balken, Bild, Stern, Leer, Dialog, Rueckfrage,
} from "./basis.jsx";
import Formel from "./Formel.jsx";
import Auswahlleiste from "./Kartenauswahl.jsx";
import { useZiehen } from "./ziehen.js";

function herunterladen(name, inhalt, art = "text/plain") {
  const blob = new Blob([inhalt], { type: art + ";charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export default function Stapelansicht({ setId }) {
  const {
    stapel, ordner, kartenVon, karteAendern, stapelAendern,
    stapelLoeschen, stapelVervielfaeltigen, kartenOrdnen, seitenTauschen,
    zustandZuruecksetzen,
    faecher, zustaende, stapelVon, fachVon,
  } = useDaten();
  const [sortierung, setSortierung] = useState("eigen");
  const [nurMarkierte, setNurMarkierte] = useState(false);
  const [loescht, setLoescht] = useState(false);
  const [setztZurueck, setSetztZurueck] = useState(false);
  const [angaben, setAngaben] = useState(false);
  const [waehlt, setWaehlt] = useState(false);
  const [ausgewaehlt, setAusgewaehlt] = useState(() => new Set());

  const derStapel = stapel.find((s) => s.id === setId);
  const karten = kartenVon(setId);

  const sortiert = useMemo(() => {
    let liste = nurMarkierte ? karten.filter((k) => k.starred) : karten;
    if (sortierung === "alphabetisch")
      liste = [...liste].sort((a, b) => (a.term || "").localeCompare(b.term || "", "de"));
    else if (sortierung === "schwierig")
      liste = [...liste].sort((a, b) =>
        ((zustaende[a.id + ":td"]?.stability) ?? -1) - ((zustaende[b.id + ":td"]?.stability) ?? -1));
    return liste;
  }, [karten, sortierung, nurMarkierte, zustaende]);

  /* Ziehen zum Umordnen — nur in der eigenen Reihenfolge und ohne Filter:
     In einer alphabetischen Liste hiesse Verschieben nichts. Der Hook steht
     vor der Pruefung unten, weil React Hooks in fester Zahl erwartet. */
  const { griff, zeile } = useZiehen({
    kennungen: karten.map((k) => k.id), aufOrdnen: kartenOrdnen, abstand: 8,
  });
  const ziehbar = sortierung === "eigen" && !nurMarkierte && !waehlt;

  if (!derStapel) {
    return <div className="mitte"><Leer titel="Stapel nicht gefunden"
      text="Vielleicht wurde er gelöscht."><Knopf onClick={() => gehe("/")}>Zur Übersicht</Knopf></Leer></div>;
  }

  const stand = stapelStand(karten, zustaende, derStapel);
  const anteile = anteileNachStufe(stand.zustaende);
  const derOrdner = ordner.find((o) => o.id === derStapel.folderId);
  const vorherName = wegName(vorigerWeg(), {
    fach: (id) => fachVon(id)?.name,
    ordner: (id) => ordner.find((o) => o.id === id)?.name,
    stapel: (id) => stapel.find((x) => x.id === id)?.title,
  });
  const ersatzWeg = derOrdner ? "/ordner/" + derOrdner.id
    : derStapel.subjectId && fachVon(derStapel.subjectId) ? "/fach/" + derStapel.subjectId : "/";
  const ersatzName = derOrdner ? derOrdner.name
    : fachVon(derStapel.subjectId)?.name || "Alle Stapel";
  const markierte = karten.filter((k) => k.starred).length;

  const ausfuhr = (art) => {
    const name = (derStapel.title || "stapel").replace(/[^\p{L}\p{N} _-]/gu, "").trim() || "stapel";
    if (art === "csv") herunterladen(name + ".csv", alsCsv(karten), "text/csv");
    else if (art === "text") herunterladen(name + ".txt", alsText(karten));
    else if (art === "anki")
      herunterladen(name + "-anki.txt", alsAnkiText(karten, { stapelName: derStapel.title }));
    else if (art === "plan")
      herunterladen(name + "-lernstand.csv",
        alsCsvMitPlan(karten, zustaende, { stapelVon, fachVon }), "text/csv");
    else herunterladen(name + ".json",
      alsStapeldatei(derStapel, karten, fachVon(derStapel.subjectId)), "application/json");
  };

  return (
    <div className="mitte">
      <div className="kopfzeile">
        {/* Zurueck dorthin, wo man herkam — Fach, Ordner, Start, Fehlerheft.
            Ohne bekannten Vorgaenger (etwa nach dem Neuladen) zum Ordner des
            Stapels, sonst zu seinem Fach, sonst zu allen Stapeln. */}
        <div style={{ width: "100%" }}>
          <button type="button" className="zurueck-verweis"
            onClick={() => (vorherName ? zurueck(ersatzWeg) : ersetze(ersatzWeg))}>
            <Symbol name="zurueck" groesse={15} />
            {vorherName || ersatzName}
          </button>
        </div>
        <h1 style={{ flex: 1 }}>{derStapel.title || "Ohne Titel"}</h1>
        <Knopf symbol="stift" onClick={() => gehe("/stapel/" + setId + "/bearbeiten")}>
          Bearbeiten</Knopf>
        <Menue knopf={<SymbolKnopf symbol="mehr" titel="Mehr" art="" />}>
          <MenuePunkt symbol="mischen" onClick={() => kartenOrdnen(mische(karten).map((k) => k.id))}>
            Reihenfolge mischen</MenuePunkt>
          <MenuePunkt symbol="tauschen" onClick={() => seitenTauschen(setId)}>
            Vorder- und Rückseite tauschen</MenuePunkt>
          <MenuePunkt symbol="auge" onClick={() => gehe("/vorab/" + setId)}>
            Vorab abfragen …</MenuePunkt>
          <MenuePunkt symbol="zahnrad" onClick={() => setAngaben(true)}>
            Titel und Sprachen …</MenuePunkt>
          <hr />
          <MenuePunkt symbol="herunter" onClick={() => ausfuhr("stapeldatei")}>
            Als Stapeldatei sichern</MenuePunkt>
          <MenuePunkt symbol="herunter" onClick={() => ausfuhr("csv")}>Als CSV sichern</MenuePunkt>
          <MenuePunkt symbol="herunter" onClick={() => ausfuhr("anki")}>Für Anki sichern</MenuePunkt>
          <MenuePunkt symbol="herunter" onClick={() => ausfuhr("plan")}>
            Mit Lernstand sichern</MenuePunkt>
          <MenuePunkt symbol="drucken" onClick={() => window.print()}>Drucken</MenuePunkt>
          <MenuePunkt symbol="stapel" onClick={async () => {
            const kopie = await stapelVervielfaeltigen(setId);
            if (kopie) gehe("/stapel/" + kopie.id);
          }}>Kopie anlegen</MenuePunkt>
          <hr />
          <MenuePunkt symbol="zurueckSetzen" onClick={() => setSetztZurueck(true)}>
            Lernstand zurücksetzen</MenuePunkt>
          <MenuePunkt symbol="muell" gefahr onClick={() => setLoescht(true)}>
            In den Papierkorb</MenuePunkt>
        </Menue>
      </div>

      {derStapel.description && (
        <p className="matt" style={{ marginTop: -6 }}>{derStapel.description}</p>
      )}

      {karten.length === 0 ? (
        <Leer titel="Dieser Stapel ist noch leer"
          text="Trage Karten ein, füge eine Liste aus der Zwischenablage ein oder lies sie aus einem Foto.">
          <Knopf art="voll gross" symbol="plus"
            onClick={() => gehe("/stapel/" + setId + "/bearbeiten")}>Karten anlegen</Knopf>
        </Leer>
      ) : (
        <>
          {/* ------------------------- Der Lernweg ---------------------- */}
          <div className="kachel" style={{ marginBottom: 20, minHeight: 0,
            borderColor: "var(--akzent)" }}
            onClick={() => gehe(derStapel.subjectId
              ? "/abrufen/" + derStapel.subjectId : "/faecher")}>
            <div className="reihe">
              <Symbol name="blitz" groesse={20} />
              <div className="dehnen">
                <div className="titel">Abrufen</div>
                <div className="klein matt">
                  {derStapel.subjectId
                    ? "Tippen, einschätzen, bewerten: Hier entscheidet sich, wann diese Karten wiederkommen."
                    : "Noch keinem Fach zugeordnet. Ohne Fach kann der Plan nicht rechnen."}
                </div>
              </div>
              <select className="feld" style={{ width: "auto" }} value={derStapel.subjectId || ""}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => stapelAendern(setId, { subjectId: e.target.value || null })}>
                <option value="">(ohne Fach)</option>
                {faecher.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
          </div>

          {/* --------------------------- Übungsmodi --------------------- */}
          <div className="klein blass" style={{ marginBottom: 8 }}>
            Zum Üben, zählt für die Statistik, verschiebt aber keine Termine
          </div>
          <div className="gitter" style={{ marginBottom: 24, gridTemplateColumns: "repeat(auto-fill, minmax(215px, 1fr))" }}>
            {MODI.map((m) => (
              <div key={m.id} className="kachel" style={{ minHeight: 96 }}
                onClick={() => gehe("/stapel/" + setId + "/" + m.id)}>
                <div className="reihe">
                  <Symbol name={m.symbol} groesse={19} />
                  <div className="titel dehnen">{m.name}</div>
                </div>
                <div className="klein matt">{m.text}</div>
              </div>
            ))}
          </div>

          {/* ------------------------ Fortschritt ------------------------ */}
          <div className="zahl-kachel" style={{ marginBottom: 24 }}>
            <div className="reihe" style={{ marginBottom: 10, flexWrap: "wrap" }}>
              <h3 className="dehnen">Fortschritt</h3>
              <span className="klein matt">
                {stand.faellig > 0
                  ? anzahl(stand.faellig, "Karte ist fällig", "Karten sind fällig")
                  : stand.neu > 0
                    ? anzahl(stand.neu, "Karte ist noch neu", "Karten sind noch neu")
                    : stand.naechste && stand.naechste > Date.now()
                      ? "Nächste Wiederholung " + datumKurz(stand.naechste)
                      : "Alles auf dem Laufenden"}
              </span>
            </div>
            <Balken anteile={anteile} hoehe={12} />
            <div className="reihe klein matt" style={{ marginTop: 10, flexWrap: "wrap", gap: 14 }}>
              {STUFEN.map((name, i) => (
                <span key={name} className="reihe" style={{ gap: 6 }}>
                  <i style={{
                    width: 10, height: 10, borderRadius: 3, display: "block",
                    background: ["var(--rand)", "var(--gelb)", "var(--akzent)", "var(--gruen)"][i],
                  }} />
                  {name}: {anteile[i]}
                </span>
              ))}
            </div>
          </div>

          {/* -------------------------- Karten -------------------------- */}
          <div className="reihe umbruch" style={{ marginBottom: 12 }}>
            <h3 className="dehnen">{anzahl(karten.length, "Karte", "Karten")}</h3>
            {markierte > 0 && (
              <Knopf art={"klein" + (nurMarkierte ? " voll" : "")} symbol="stern"
                onClick={() => setNurMarkierte((x) => !x)}>
                {markierte} markiert
              </Knopf>
            )}
            {karten.length > 0 && (
              <Knopf art={"klein" + (waehlt ? " voll" : "")} symbol="haken"
                aria-pressed={waehlt}
                onClick={() => { setWaehlt((w) => !w); setAusgewaehlt(new Set()); }}>
                Auswählen
              </Knopf>
            )}
            <select className="feld" style={{ width: "auto" }} value={sortierung}
              onChange={(e) => setSortierung(e.target.value)}>
              <option value="eigen">Eigene Reihenfolge</option>
              <option value="alphabetisch">Alphabetisch</option>
              <option value="schwierig">Schwerste zuerst</option>
            </select>
          </div>

          {waehlt && (
            <Auswahlleiste setId={setId} ausgewaehlt={ausgewaehlt}
              alleKennungen={sortiert.map((k) => k.id)}
              setAusgewaehlt={setAusgewaehlt}
              aufBeenden={() => { setWaehlt(false); setAusgewaehlt(new Set()); }} />
          )}

          <div style={{ display: "grid", gap: 8 }}>
            {sortiert.map((k, i) => {
              const zug = ziehbar ? zeile(k.id, i) : {};
              /* Die schwächere der beiden Richtungen entscheidet, wie eine
                 Karte hier dasteht. */
              const zTd = zustaende[k.id + ":td"];
              const zDt = zustaende[k.id + ":dt"];
              const s = (derStapel.richtungen || ["td"]).includes("dt")
                ? Math.min(stufe(zTd), stufe(zDt)) : stufe(zTd);
              return (
                <div key={k.id} data-zieh={zug["data-zieh"]}
                  className={"karten-zeile" + (waehlt ? " waehlbar" : "")
                    + (ausgewaehlt.has(k.id) ? " gewaehlt" : "")
                    + (zug.className ? " " + zug.className : "")}
                  style={{ ...(k.nichtRelevant && !waehlt ? { opacity: 0.45 } : {}), ...(zug.style || {}) }}
                  role={waehlt ? "checkbox" : undefined}
                  aria-checked={waehlt ? ausgewaehlt.has(k.id) : undefined}
                  onClick={waehlt ? () => setAusgewaehlt((alt) => {
                    const neu = new Set(alt);
                    if (neu.has(k.id)) neu.delete(k.id); else neu.add(k.id);
                    return neu;
                  }) : undefined}>
                  {waehlt && (
                    <span className="auswahl-haken" aria-hidden="true">
                      {ausgewaehlt.has(k.id) && <Symbol name="haken" groesse={16} />}
                    </span>
                  )}
                  <div className="seite">
                    <div className="inhalt"
                      style={k.nichtRelevant ? { textDecoration: "line-through" } : undefined}>
                      <Formel text={k.term} />
                    </div>
                    {k.termImage && <Bild kennung={k.termImage} klasse="" stil={{ maxHeight: 90, borderRadius: 8, marginTop: 8 }} />}
                  </div>
                  <div className="seite">
                    <div className="inhalt matt"><Formel text={k.definition} /></div>
                    {k.defImage && <Bild kennung={k.defImage} klasse="" stil={{ maxHeight: 90, borderRadius: 8, marginTop: 8 }} />}
                    {k.hint && <div className="klein blass" style={{ marginTop: 6 }}>Hinweis: {k.hint}</div>}
                  </div>
                  {!waehlt && <div className="werkzeuge">
                    {ziehbar && (
                      <span className="griff" {...griff(k.id)}><Symbol name="griff" groesse={18} /></span>
                    )}
                    <span className="marke klein" title="Beherrschung"
                      style={{ color: ["var(--schrift-blass)", "var(--gelb)", "var(--akzent)", "var(--gruen)"][s] }}>
                      {STUFEN[s]}
                    </span>
                    <SymbolKnopf symbol="laut" titel="Vorlesen"
                      onClick={() => sprich(k.term, derStapel.termLang)} />
                    <Stern an={k.starred} aufKlick={() => karteAendern(k.id, { starred: !k.starred })} />
                    {/* Abhaken heisst: kommt nicht dran. Nicht: kann ich schon —
                        darueber entscheidet der Planer aus dem, was beim Abrufen
                        wirklich geschieht. */}
                    <SymbolKnopf symbol={k.nichtRelevant ? "zurueckSetzen" : "haken"}
                      titel={k.nichtRelevant
                        ? "Wieder mitlernen"
                        : "Abhaken, kommt nicht dran"}
                      style={k.nichtRelevant ? undefined : { opacity: 0.55 }}
                      onClick={() => karteAendern(k.id, { nichtRelevant: !k.nichtRelevant })} />
                    <SymbolKnopf symbol="stift" titel="Bearbeiten"
                      onClick={() => gehe("/stapel/" + setId + "/bearbeiten")} />
                  </div>}
                </div>
              );
            })}
          </div>
        </>
      )}

      {angaben && (
        <Dialog titel="Angaben zum Stapel" aufSchliessen={() => setAngaben(false)}
          fuss={<Knopf art="voll" onClick={() => setAngaben(false)}>Fertig</Knopf>}>
          <label className="beschriftung">Titel</label>
          <input className="feld" value={derStapel.title}
            onChange={(e) => stapelAendern(setId, { title: e.target.value })} />
          <label className="beschriftung" style={{ marginTop: 14 }}>Beschreibung</label>
          <textarea className="feld" value={derStapel.description || ""} style={{ minHeight: 70 }}
            onChange={(e) => stapelAendern(setId, { description: e.target.value })} />
          <div className="antwort-gitter" style={{ marginTop: 14 }}>
            <div>
              <label className="beschriftung">Sprache der Vorderseite</label>
              <select className="feld" value={derStapel.termLang}
                onChange={(e) => stapelAendern(setId, { termLang: e.target.value })}>
                {SPRACHEN.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="beschriftung">Sprache der Rückseite</label>
              <select className="feld" value={derStapel.defLang}
                onChange={(e) => stapelAendern(setId, { defLang: e.target.value })}>
                {SPRACHEN.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
              </select>
            </div>
          </div>
          <p className="klein matt" style={{ marginTop: 12 }}>
            Die Sprachen bestimmen, welche Stimme vorliest, wichtig für Vokabeln
            und für den Modus „Buchstabieren“.
          </p>
        </Dialog>
      )}

      {loescht && (
        <Rueckfrage titel="Stapel löschen?"
          text="Der Stapel wandert in den Papierkorb und lässt sich von dort zurückholen."
          aufNein={() => setLoescht(false)}
          aufJa={() => { stapelLoeschen(setId); gehe("/"); }} />
      )}

      {setztZurueck && (
        <Rueckfrage titel="Lernstand zurücksetzen?" bestaetigung="Zurücksetzen"
          text="Alle Fächer und Wiederholungstermine dieses Stapels beginnen wieder von vorn. Die Karten selbst bleiben."
          aufNein={() => setSetztZurueck(false)}
          aufJa={() => { zustandZuruecksetzen(setId); setSetztZurueck(false); }} />
      )}
    </div>
  );
}
