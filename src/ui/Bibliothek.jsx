/*
 * Die Übersicht: Ordner und Stapel, dazu die Suche über alle Karten.
 */

import React, { useMemo, useState } from "react";
import { useDaten } from "../core/store.jsx";
import { anteileNachStufe } from "../core/model.js";
import { faelligZaehlen } from "../core/scheduler.js";
import { anzahl } from "../core/util.js";
import { gehe } from "../App.jsx";
import {
  Symbol, SymbolKnopf, Knopf, Menue, MenuePunkt, Balken, Leer, Dialog, Rueckfrage,
} from "./basis.jsx";

/* ---------------------------- Eine Stapelkachel ------------------------ */

function StapelKachel({ stapel, karten, staende, aufMenue }) {
  const anteile = anteileNachStufe(karten, staende);
  const { faellige, neu } = faelligZaehlen(karten, staende);
  return (
    <div className="kachel" draggable
      onDragStart={(e) => { e.dataTransfer.setData("text/kk", stapel.id); }}
      onClick={() => gehe("/stapel/" + stapel.id)}>
      <div className="reihe">
        <div className="titel dehnen">{stapel.title || "Ohne Titel"}</div>
        <Menue knopf={<SymbolKnopf symbol="mehr" titel="Mehr" />}>
          {aufMenue(stapel)}
        </Menue>
      </div>
      {stapel.description && (
        <div className="klein matt" style={{
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}>{stapel.description}</div>
      )}
      <div className="dehnen" />
      <Balken anteile={anteile} />
      <div className="reihe klein matt">
        <span>{anzahl(karten.length, "Karte", "Karten")}</span>
        {faellige > 0 && <span className="marke gelb">{faellige} fällig</span>}
        {neu > 0 && <span className="marke">{neu} neu</span>}
      </div>
    </div>
  );
}

/* -------------------------------- Suche -------------------------------- */

function Suchergebnis({ begriff }) {
  const { stapel, karten } = useDaten();
  const treffer = useMemo(() => {
    const b = begriff.toLowerCase();
    const stapelTreffer = stapel.filter((s) =>
      (s.title || "").toLowerCase().includes(b) || (s.description || "").toLowerCase().includes(b));
    const kartenTreffer = karten.filter((k) =>
      (k.term || "").toLowerCase().includes(b) || (k.definition || "").toLowerCase().includes(b))
      .slice(0, 200);
    return { stapelTreffer, kartenTreffer };
  }, [begriff, stapel, karten]);

  const nameVon = (setId) => stapel.find((s) => s.id === setId)?.title || "Ohne Titel";

  return (
    <div className="mitte">
      <div className="kopfzeile">
        <h1>Suche nach „{begriff}“</h1>
      </div>

      {treffer.stapelTreffer.length > 0 && (
        <>
          <h3 className="matt" style={{ marginBottom: 10 }}>Stapel</h3>
          <div className="gitter" style={{ marginBottom: 26 }}>
            {treffer.stapelTreffer.map((s) => (
              <div key={s.id} className="kachel" onClick={() => gehe("/stapel/" + s.id)}>
                <div className="titel">{s.title}</div>
                <div className="klein matt">{s.description}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {treffer.kartenTreffer.length > 0 ? (
        <>
          <h3 className="matt" style={{ marginBottom: 10 }}>
            Karten ({treffer.kartenTreffer.length})
          </h3>
          <div style={{ display: "grid", gap: 8 }}>
            {treffer.kartenTreffer.map((k) => (
              <div key={k.id} className="karten-zeile" style={{ cursor: "pointer" }}
                onClick={() => gehe("/stapel/" + k.setId)}>
                <div className="seite"><div className="inhalt">{k.term}</div></div>
                <div className="seite"><div className="inhalt matt">{k.definition}</div></div>
                <div className="klein blass">{nameVon(k.setId)}</div>
              </div>
            ))}
          </div>
        </>
      ) : treffer.stapelTreffer.length === 0 && (
        <Leer symbol="suche" titel="Nichts gefunden"
          text="Kein Stapel und keine Karte enthält diesen Text." />
      )}
    </div>
  );
}

/* ------------------------------ Übersicht ------------------------------ */

export default function Bibliothek({ ordnerId = null, suchbegriff = null }) {
  const daten = useDaten();
  const {
    ordner, stapel, kartenNachStapel, staende,
    ordnerAnlegen, ordnerAendern, ordnerLoeschen,
    stapelAnlegen, stapelAendern, stapelLoeschen, stapelVervielfaeltigen,
  } = daten;
  const [verschiebt, setVerschiebt] = useState(null);
  const [loescht, setLoescht] = useState(null);

  if (suchbegriff) return <Suchergebnis begriff={suchbegriff} />;

  const derOrdner = ordnerId ? ordner.find((o) => o.id === ordnerId) : null;
  const unterordner = ordner.filter((o) => o.parentId === (ordnerId || null))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
  const sichtbareStapel = (ordnerId
    ? stapel.filter((s) => s.folderId === ordnerId)
    : stapel)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  /* Pfad vom obersten Ordner herunter. */
  const pfad = [];
  let lauf = derOrdner;
  while (lauf) {
    pfad.unshift(lauf);
    lauf = lauf.parentId ? ordner.find((o) => o.id === lauf.parentId) : null;
  }

  const zuLernen = !ordnerId ? stapel.map((s) => {
    const karten = kartenNachStapel.get(s.id) || [];
    return { stapel: s, ...faelligZaehlen(karten, staende), karten };
  }).filter((x) => x.karten.length && (x.faellige > 0 || x.neu > 0))
    .sort((a, b) => b.faellige - a.faellige).slice(0, 4) : [];

  const neuerStapel = async () => {
    const s = await stapelAnlegen("Neuer Stapel", ordnerId);
    gehe("/stapel/" + s.id + "/bearbeiten");
  };

  const neuerUnterordner = async () => {
    const name = window.prompt("Name des Ordners");
    if (name === null) return;
    await ordnerAnlegen(name.trim() || "Neuer Ordner", ordnerId);
  };

  const menuePunkte = (s) => (
    <>
      <MenuePunkt symbol="blitz" onClick={() => gehe("/stapel/" + s.id + "/lernen")}>Lernen</MenuePunkt>
      <MenuePunkt symbol="stift" onClick={() => gehe("/stapel/" + s.id + "/bearbeiten")}>Bearbeiten</MenuePunkt>
      <MenuePunkt symbol="ordner" onClick={() => setVerschiebt(s)}>Verschieben …</MenuePunkt>
      <MenuePunkt symbol="stapel" onClick={() => stapelVervielfaeltigen(s.id)}>Kopie anlegen</MenuePunkt>
      <hr />
      <MenuePunkt symbol="muell" gefahr onClick={() => setLoescht({ art: "stapel", ...s })}>
        In den Papierkorb
      </MenuePunkt>
    </>
  );

  return (
    <div className="mitte">
      <div className="kopfzeile">
        {pfad.length > 0 && (
          <div className="klein matt" style={{ width: "100%" }}>
            <span style={{ cursor: "pointer" }} onClick={() => gehe("/")}>Alle Stapel</span>
            {pfad.map((o, i) => (
              <span key={o.id}>
                {" › "}
                <span style={{ cursor: "pointer", color: i === pfad.length - 1 ? "var(--schrift)" : undefined }}
                  onClick={() => gehe("/ordner/" + o.id)}>{o.name}</span>
              </span>
            ))}
          </div>
        )}
        <h1 style={{ flex: 1 }}>{derOrdner ? derOrdner.name : "Alle Stapel"}</h1>
        <Knopf symbol="plus" onClick={neuerUnterordner}>Ordner</Knopf>
        <Knopf art="voll" symbol="plus" onClick={neuerStapel}>Stapel</Knopf>
        {derOrdner && (
          <Menue knopf={<SymbolKnopf symbol="mehr" titel="Mehr" art="klein" />}>
            <MenuePunkt symbol="stift" onClick={() => {
              const name = window.prompt("Neuer Name", derOrdner.name);
              if (name) ordnerAendern(derOrdner.id, { name: name.trim() });
            }}>Umbenennen</MenuePunkt>
            <hr />
            <MenuePunkt symbol="muell" gefahr
              onClick={() => setLoescht({ art: "ordner", ...derOrdner })}>
              Ordner löschen
            </MenuePunkt>
          </Menue>
        )}
      </div>

      {zuLernen.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h3 className="matt" style={{ marginBottom: 10 }}>Heute dran</h3>
          <div className="gitter">
            {zuLernen.map((x) => (
              <div key={x.stapel.id} className="kachel" onClick={() => gehe("/stapel/" + x.stapel.id + "/lernen")}>
                <div className="reihe">
                  <Symbol name="blitz" />
                  <div className="titel dehnen">{x.stapel.title}</div>
                </div>
                <div className="klein matt">
                  {x.faellige > 0 ? anzahl(x.faellige, "Karte wartet", "Karten warten") : ""}
                  {x.faellige > 0 && x.neu > 0 ? ", " : ""}
                  {x.neu > 0 ? x.neu + " noch nie gesehen" : ""}
                </div>
                <div className="dehnen" />
                <Balken anteile={anteileNachStufe(x.karten, staende)} />
              </div>
            ))}
          </div>
        </div>
      )}

      {unterordner.length > 0 && (
        <div className="gitter" style={{ marginBottom: 22 }}>
          {unterordner.map((o) => {
            const drin = stapel.filter((s) => s.folderId === o.id).length;
            return (
              <div key={o.id} className="kachel" style={{ minHeight: 90 }}
                onClick={() => gehe("/ordner/" + o.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const nutzlast = e.dataTransfer.getData("text/kk");
                  if (nutzlast) stapelAendern(nutzlast, { folderId: o.id });
                }}>
                <div className="reihe">
                  <Symbol name="ordner" groesse={20} />
                  <div className="titel dehnen">{o.name}</div>
                </div>
                <div className="klein matt">{anzahl(drin, "Stapel", "Stapel")}</div>
              </div>
            );
          })}
        </div>
      )}

      {sichtbareStapel.length === 0 ? (
        <Leer titel="Noch nichts hier"
          text="Lege einen Stapel an und fülle ihn mit Karten — von Hand, aus einer Liste zum Einfügen oder aus einem Foto.">
          <Knopf art="voll gross" symbol="plus" onClick={neuerStapel}>Ersten Stapel anlegen</Knopf>
        </Leer>
      ) : (
        <div className="gitter">
          {sichtbareStapel.map((s) => (
            <StapelKachel key={s.id} stapel={s} karten={kartenNachStapel.get(s.id) || []}
              staende={staende} aufMenue={menuePunkte} />
          ))}
        </div>
      )}

      {verschiebt && (
        <Dialog titel={"„" + verschiebt.title + "“ verschieben"} aufSchliessen={() => setVerschiebt(null)}>
          <div className="baum-zeile" onClick={() => {
            stapelAendern(verschiebt.id, { folderId: null }); setVerschiebt(null);
          }}>
            <Symbol name="buch" groesse={16} /><span className="name">Ohne Ordner</span>
          </div>
          {ordner.sort((a, b) => a.name.localeCompare(b.name, "de")).map((o) => (
            <div key={o.id} className="baum-zeile" onClick={() => {
              stapelAendern(verschiebt.id, { folderId: o.id }); setVerschiebt(null);
            }}>
              <Symbol name="ordner" groesse={16} /><span className="name">{o.name}</span>
            </div>
          ))}
        </Dialog>
      )}

      {loescht && (
        <Rueckfrage
          titel={loescht.art === "ordner" ? "Ordner löschen?" : "Stapel löschen?"}
          text={loescht.art === "ordner"
            ? "Der Ordner wandert samt allen Stapeln darin in den Papierkorb. Von dort lässt sich alles zurückholen."
            : "Der Stapel wandert in den Papierkorb und lässt sich von dort zurückholen."}
          aufNein={() => setLoescht(null)}
          aufJa={() => {
            if (loescht.art === "ordner") { ordnerLoeschen(loescht.id); gehe("/"); }
            else stapelLoeschen(loescht.id);
            setLoescht(null);
          }} />
      )}
    </div>
  );
}
