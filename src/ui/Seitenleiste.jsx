/*
 * Die Seitenleiste: Suche, Ordnerbaum, Zugänge zu Statistik, Papierkorb und
 * Einstellungen. Stapel lassen sich mit der Maus auf einen Ordner ziehen.
 */

import React, { useMemo, useState } from "react";
import { useDaten } from "../core/store.jsx";
import { baueBaum } from "../core/model.js";
import { istFaellig } from "../core/fsrs.js";
import { gehe, START } from "../App.jsx";
import { Symbol, SymbolKnopf, Knopf, useMerker } from "./basis.jsx";
import Flamme from "./Flamme.jsx";

function Zweig({ ordner, tiefe, aktiv, offen, umschalten, aufAblegen }) {
  const [ziel, setZiel] = useState(false);
  const hatKinder = ordner.kinder.length > 0;
  const istOffen = offen.includes(ordner.id);

  return (
    <div>
      <div
        className={"baum-zeile" + (aktiv === ordner.id ? " aktiv" : "") + (ziel ? " ziel" : "")}
        style={{ paddingLeft: 8 + tiefe * 14 }}
        onClick={() => gehe("/ordner/" + ordner.id)}
        onDragOver={(e) => { e.preventDefault(); setZiel(true); }}
        onDragLeave={() => setZiel(false)}
        onDrop={(e) => {
          e.preventDefault(); setZiel(false);
          const nutzlast = e.dataTransfer.getData("text/kk");
          if (nutzlast) aufAblegen(nutzlast, ordner.id);
        }}
      >
        <span className="pfeil" onClick={(e) => { e.stopPropagation(); umschalten(ordner.id); }}>
          {hatKinder ? <Symbol name={istOffen ? "runter" : "weiter"} groesse={14} /> : null}
        </span>
        <Symbol name="ordner" groesse={16} />
        <span className="name" style={{ flex: 1 }}>{ordner.name}</span>
      </div>
      {istOffen && ordner.kinder.map((k) => (
        <Zweig key={k.id} ordner={k} tiefe={tiefe + 1} aktiv={aktiv} offen={offen}
          umschalten={umschalten} aufAblegen={aufAblegen} />
      ))}
    </div>
  );
}

export default function Seitenleiste({ offen, aufSchliessen, aufAbgleich }) {
  const {
    ordner, stapel, ordnerAnlegen, stapelAnlegen, stapelAendern, wolkeStand,
    faecher, zustaende,
  } = useDaten();
  const [aufgeklappt, setAufgeklappt] = useMerker("aufgeklappt", []);
  const [faecherOffen, setFaecherOffen] = useMerker("faecherOffen", true);
  const [suche, setSuche] = useState("");
  const weg = window.location.hash.slice(1) || START;
  const aktiverOrdner = weg.startsWith("/ordner/") ? weg.split("/")[2] : null;

  const baum = useMemo(() => baueBaum(ordner), [ordner]);
  const ohneOrdner = stapel.filter((s) => !s.folderId).length;

  const faellig = useMemo(
    () => Object.values(zustaende).filter((z) => istFaellig(z)).length, [zustaende]);

  const umschalten = (id) =>
    setAufgeklappt((alt) => alt.includes(id) ? alt.filter((x) => x !== id) : [...alt, id]);

  const suchen = (e) => {
    e.preventDefault();
    if (suche.trim()) gehe("/suche/" + encodeURIComponent(suche.trim()));
  };

  const neuerOrdner = async () => {
    const name = window.prompt("Name des Ordners");
    if (name === null) return;
    const o = await ordnerAnlegen(name.trim() || "Neuer Ordner", aktiverOrdner);
    if (aktiverOrdner) setAufgeklappt((alt) => [...alt, aktiverOrdner]);
    gehe("/ordner/" + o.id);
  };

  const neuerStapel = async () => {
    const s = await stapelAnlegen("Neuer Stapel", aktiverOrdner);
    gehe("/stapel/" + s.id + "/bearbeiten");
  };

  const ablegen = (setId, ordnerId) => {
    stapelAendern(setId, { folderId: ordnerId });
    setAufgeklappt((alt) => alt.includes(ordnerId) ? alt : [...alt, ordnerId]);
  };

  const punktKlasse = "wolke-punkt " +
    (wolkeStand.zustand === "gut" ? "gut" : wolkeStand.zustand === "arbeitet" ? "arbeitet"
      : wolkeStand.zustand === "fehler" ? "fehler" : "");

  return (
    <aside className={"leiste" + (offen ? " offen" : "")}>
      <div className="leiste-kopf">
        {/* Logo und Name fuehren zur Startseite — wie auf den meisten Seiten. */}
        <button type="button" className="logo-knopf dehnen" title="Zur Startseite"
          onClick={() => gehe(START)}>
          <Symbol name="stapel" groesse={22} />
          <span>Smart Learning</span>
        </button>
        <SymbolKnopf symbol="kreuz" titel="Menü schließen" art="leer klein nur-schmal"
          onClick={aufSchliessen} />
      </div>

      <form onSubmit={suchen} style={{ padding: "0 12px 10px" }}>
        <div style={{ position: "relative" }}>
          <input className="feld" placeholder="Suchen …" value={suche}
            style={{ paddingLeft: 34 }}
            onChange={(e) => setSuche(e.target.value)} />
          <span style={{ position: "absolute", left: 10, top: 10, color: "var(--schrift-blass)" }}>
            <Symbol name="suche" groesse={17} />
          </span>
        </div>
      </form>

      <div className="leiste-inhalt">
        {/* Der Lernweg steht oben — er ist der Zweck der App. */}
        <div className={"baum-zeile" + (weg.startsWith("/abrufen") ? " aktiv" : "")}
          onClick={() => gehe("/abrufen")}>
          <span className="pfeil" />
          <Symbol name="blitz" groesse={16} />
          <span className="name dehnen">Abrufen</span>
          {faellig > 0 && <span className="marke gelb klein">{faellig}</span>}
        </div>
        <div className={"baum-zeile" + (weg.startsWith("/faecher") ? " aktiv" : "")}
          onClick={() => gehe("/faecher")}>
          {/* Der Pfeil klappt nur die Liste auf, die Zeile selbst fuehrt zur
              Uebersicht — wie beim Ordnerbaum darunter. */}
          <span className="pfeil"
            onClick={(e) => { e.stopPropagation(); setFaecherOffen((o) => !o); }}>
            {faecher.length > 0 && (
              <Symbol name={faecherOffen ? "runter" : "weiter"} groesse={14} />
            )}
          </span>
          <Symbol name="buch" groesse={16} />
          <span className="name dehnen">Fächer</span>
          {faecher.length > 0 && <span className="klein blass">{faecher.length}</span>}
        </div>
        {/* Die Faecher selbst, eingerueckt: Ein Klick auf "Ethik" oeffnet das
            Material dieses Fachs, ohne Umweg ueber die Uebersicht. */}
        {faecherOffen && [...faecher]
          .sort((a, b) => (a.name || "").localeCompare(b.name || "", "de"))
          .map((f) => (
            <div key={f.id}
              className={"baum-zeile" + (weg === "/fach/" + f.id ? " aktiv" : "")}
              style={{ paddingLeft: 30 }}
              onClick={() => gehe("/fach/" + f.id)}>
              <span style={{ width: 8, height: 8, borderRadius: 2, flex: "none",
                background: f.farbe || "var(--akzent)", display: "inline-block" }} />
              <span className="name dehnen">{f.name}</span>
            </div>
          ))}
        <div className={"baum-zeile" + (weg.startsWith("/erklaeren") ? " aktiv" : "")}
          onClick={() => gehe("/erklaeren")}>
          <span className="pfeil" />
          <Symbol name="buch" groesse={16} />
          <span className="name">Erklären</span>
        </div>
        <div className={"baum-zeile" + (weg.startsWith("/pruefung") ? " aktiv" : "")}
          onClick={() => gehe("/pruefung")}>
          <span className="pfeil" />
          <Symbol name="papier" groesse={16} />
          <span className="name">Prüfungen</span>
        </div>
        <div className={"baum-zeile" + (weg.startsWith("/tutor") ? " aktiv" : "")}
          onClick={() => gehe("/tutor")}>
          <span className="pfeil" />
          <Symbol name="schreiben" groesse={16} />
          <span className="name">Tutoren</span>
        </div>
        <div className={"baum-zeile" + (weg.startsWith("/kalibrierung") ? " aktiv" : "")}
          onClick={() => gehe("/kalibrierung")}>
          <span className="pfeil" />
          <Symbol name="auge" groesse={16} />
          <span className="name">Kalibrierung</span>
        </div>
        <div className={"baum-zeile" + (weg.startsWith("/fragen") ? " aktiv" : "")}
          onClick={() => gehe("/fragen")}>
          <span className="pfeil" />
          <Symbol name="wuerfel" groesse={16} />
          <span className="name">Fragen</span>
        </div>
        <div className={"baum-zeile" + (weg.startsWith("/punkte") ? " aktiv" : "")}
          onClick={() => gehe("/punkte")}>
          <span className="pfeil" />
          <Symbol name="statistik" groesse={16} />
          <span className="name">Punkte</span>
        </div>

        <Flamme knapp />

        <hr className="trennlinie" style={{ margin: "12px 0" }} />
        <div className="klein blass" style={{ padding: "0 8px 6px" }}>Stapel verwalten</div>

        <div className={"baum-zeile" + (weg === "/" ? " aktiv" : "")}
          onClick={() => gehe("/")}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            const nutzlast = e.dataTransfer.getData("text/kk");
            if (nutzlast) stapelAendern(nutzlast, { folderId: null });
          }}>
          <span className="pfeil" />
          <Symbol name="buch" groesse={16} />
          <span className="name" style={{ flex: 1 }}>Alle Stapel</span>
          <span className="klein blass">{stapel.length}</span>
        </div>

        {baum.map((o) => (
          <Zweig key={o.id} ordner={o} tiefe={0} aktiv={aktiverOrdner}
            offen={aufgeklappt} umschalten={umschalten} aufAblegen={ablegen} />
        ))}

        {ohneOrdner > 0 && (
          <div className="baum-zeile" style={{ opacity: 0.75 }} onClick={() => gehe("/")}>
            <span className="pfeil" />
            <Symbol name="stapel" groesse={16} />
            <span className="name" style={{ flex: 1 }}>Ohne Ordner</span>
            <span className="klein blass">{ohneOrdner}</span>
          </div>
        )}

        <div className="reihe" style={{ marginTop: 14, gap: 6 }}>
          <Knopf art="klein" symbol="plus" onClick={neuerOrdner}>Ordner</Knopf>
          <Knopf art="klein voll" symbol="plus" onClick={neuerStapel}>Stapel</Knopf>
        </div>
      </div>

      <div className="leiste-fuss">
        <div className="baum-zeile" onClick={() => gehe("/statistik")}>
          <Symbol name="statistik" groesse={16} /><span className="name">Fortschritt</span>
        </div>
        <div className="baum-zeile" onClick={() => gehe("/papierkorb")}>
          <Symbol name="papierkorb" groesse={16} /><span className="name">Papierkorb</span>
        </div>
        <div className="baum-zeile" onClick={() => gehe("/einstellungen")}>
          <Symbol name="zahnrad" groesse={16} /><span className="name">Einstellungen</span>
        </div>
        {wolkeStand.zustand !== "aus" && (
          <div className="baum-zeile klein" title={wolkeStand.text} onClick={aufAbgleich}>
            <span className={punktKlasse} />
            <span className="name">{wolkeStand.zustand === "arbeitet" ? wolkeStand.text : "Cloud"}</span>
          </div>
        )}
      </div>
    </aside>
  );
}
