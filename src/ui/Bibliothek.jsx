/*
 * Die Übersicht: Ordner und Stapel, dazu die Suche über alle Karten.
 */

import React, { useMemo, useState } from "react";
import { useDaten } from "../core/store.jsx";
import { anteileNachStufe } from "../core/fsrs.js";
import { stapelStand } from "../core/warteschlange.js";
import { ordnerZweig } from "../core/model.js";
import * as beispiel from "../core/beispiel.js";
import { anzahl } from "../core/util.js";
import { gehe } from "../App.jsx";
import { erfragen } from "./Rueckfragen.jsx";
import {
  Symbol, SymbolKnopf, Knopf, Menue, MenuePunkt, Balken, Leer, Dialog, Rueckfrage, KLICKBAR,
} from "./basis.jsx";
import Formel from "./Formel.jsx";
import StapeldateiEinfuhr from "./Stapeldatei.jsx";

/* ---------------------------- Eine Stapelkachel ------------------------ */

/*
 * Die Kachel zeigt denselben Stand wie die Warteschlange, nicht den alten
 * Fächerplan: Sonst stünde auf der Startseite „30 neu“, während das Abrufen
 * dieselben Karten längst geplant hat. Dieselbe Karte darf nicht an zwei
 * Stellen zwei Wahrheiten haben.
 */
export function StapelKachel({ stapel, karten, zustaende, aufMenue }) {
  const stand = stapelStand(karten, zustaende, stapel);
  const anteile = anteileNachStufe(stand.zustaende);
  const { faellig: faellige, neu } = stand;
  return (
    <div {...KLICKBAR} className="kachel" draggable
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
              <div {...KLICKBAR} key={s.id} className="kachel" onClick={() => gehe("/stapel/" + s.id)}>
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
                <div className="seite"><div className="inhalt"><Formel text={k.term} /></div></div>
                <div className="seite"><div className="inhalt matt"><Formel text={k.definition} /></div></div>
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

/* --------------------------- Zum Ausprobieren --------------------------- */

/*
 * Auf einem leeren Bestand steht dieser Knopf neben dem ersten Stapel.
 *
 * Er stand zuerst nur in den Einstellungen — und war damit genau dort
 * versteckt, wo niemand nachsieht, der die App zum ersten Mal öffnet. Wer
 * nichts hat, will als Erstes sehen, was das Ding kann; wer schon Karten hat,
 * sieht diesen Knopf nie wieder.
 */
function BeispielKnopf() {
  const { neuLaden } = useDaten();
  const [laeuft, setLaeuft] = useState(false);
  return (
    <Knopf art="gross" symbol="stapel" disabled={laeuft}
      onClick={async () => {
        setLaeuft(true);
        try {
          await beispiel.beispieldatenAnlegen();
          await neuLaden();
        } finally { setLaeuft(false); }
      }}>
      {laeuft ? "Wird angelegt …" : "Beispieldaten zum Ausprobieren"}
    </Knopf>
  );
}

/* ------------------------------ Übersicht ------------------------------ */

export default function Bibliothek({ ordnerId = null, suchbegriff = null }) {
  const daten = useDaten();
  const {
    ordner, stapel, kartenNachStapel, zustaende,
    ordnerAnlegen, ordnerAendern, ordnerLoeschen,
    stapelAnlegen, stapelAendern, stapelLoeschen, stapelVervielfaeltigen,
  } = daten;
  const [verschiebt, setVerschiebt] = useState(null);
  const [liestEin, setLiestEin] = useState(false);
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
    const stand = stapelStand(karten, zustaende, s);
    return { stapel: s, karten, stand, faellige: stand.faellig, neu: stand.neu };
  }).filter((x) => x.karten.length && (x.faellige > 0 || x.neu > 0))
    .sort((a, b) => b.faellige - a.faellige).slice(0, 4) : [];

  const neuerStapel = async () => {
    const s = await stapelAnlegen("Neuer Stapel", ordnerId);
    gehe("/stapel/" + s.id + "/bearbeiten");
  };

  const neuerUnterordner = async () => {
    const name = await erfragen({ titel: "Neuer Ordner", platzhalter: "Name des Ordners",
      ja: "Anlegen", leerErlaubt: true });
    if (name === null) return;
    await ordnerAnlegen(name || "Neuer Ordner", ordnerId);
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
          <nav className="pfad klein matt" aria-label="Ablage">
            <button type="button" className="pfad-verweis" onClick={() => gehe("/")}>Alle Stapel</button>
            {pfad.map((o, i) => (
              <React.Fragment key={o.id}>
                <span aria-hidden="true">›</span>
                {i === pfad.length - 1
                  ? <span className="pfad-hier" aria-current="page">{o.name}</span>
                  : <button type="button" className="pfad-verweis"
                    onClick={() => gehe("/ordner/" + o.id)}>{o.name}</button>}
              </React.Fragment>
            ))}
          </nav>
        )}
        <h1>{derOrdner ? derOrdner.name : "Alle Stapel"}</h1>
        <div className="kopf-werkzeuge">
          <Knopf symbol="plus" onClick={neuerUnterordner}>Ordner</Knopf>
          <Knopf art="voll" symbol="plus" onClick={neuerStapel}>Stapel</Knopf>
        </div>
        <div className="kopf-mehr">
          <Menue knopf={<SymbolKnopf symbol="mehr" titel="Mehr" art="" />}>
            <MenuePunkt symbol="hinauf" onClick={() => setLiestEin(true)}>
              Stapeldatei einlesen …</MenuePunkt>
            {derOrdner && (
              <>
                <hr />
                <MenuePunkt symbol="stift" onClick={async () => {
                  const name = await erfragen({ titel: "Ordner umbenennen", vorgabe: derOrdner.name,
                    ja: "Umbenennen" });
                  if (name) ordnerAendern(derOrdner.id, { name });
                }}>Umbenennen</MenuePunkt>
                <MenuePunkt symbol="muell" gefahr
                  onClick={() => setLoescht({ art: "ordner", ...derOrdner })}>
                  Ordner löschen
                </MenuePunkt>
              </>
            )}
          </Menue>
        </div>
        {liestEin && (
          <StapeldateiEinfuhr ordnerId={ordnerId} aufSchliessen={() => setLiestEin(false)} />
        )}
      </div>

      {zuLernen.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h3 className="matt" style={{ marginBottom: 10 }}>Heute dran</h3>
          <div className="gitter">
            {zuLernen.map((x) => (
              <div {...KLICKBAR} key={x.stapel.id} className="kachel" onClick={() => gehe("/stapel/" + x.stapel.id + "/lernen")}>
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
                <Balken anteile={anteileNachStufe(x.stand.zustaende)} />
              </div>
            ))}
          </div>
        </div>
      )}

      {unterordner.length > 0 && (
        <div className="gitter" style={{ marginBottom: 22 }}>
          {unterordner.map((o) => {
            /* Auch die Stapel in Unterordnern zählen: Ein Ordner, der nur
               weitere Ordner enthält, meldete sonst „0 Stapel“ und sah aus wie
               ein Irrtum. */
            const zweig = ordnerZweig(ordner, o.id);
            const drin = stapel.filter((s) => zweig.has(s.folderId)).length;
            return (
              <div {...KLICKBAR} key={o.id} className="kachel" style={{ minHeight: 90 }}
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
          text="Lege einen Stapel an und fülle ihn mit Karten, von Hand, aus einer Liste zum Einfügen oder aus einem Foto.">
          <div className="reihe" style={{ justifyContent: "center", flexWrap: "wrap" }}>
            <Knopf art="voll gross" symbol="plus" onClick={neuerStapel}>Ersten Stapel anlegen</Knopf>
            {!ordnerId && <BeispielKnopf />}
          </div>
        </Leer>
      ) : (
        <div className="gitter">
          {sichtbareStapel.map((s) => (
            <StapelKachel key={s.id} stapel={s} karten={kartenNachStapel.get(s.id) || []}
              zustaende={zustaende} aufMenue={menuePunkte} />
          ))}
        </div>
      )}

      {verschiebt && (
        <Dialog titel={"„" + verschiebt.title + "“ verschieben"} aufSchliessen={() => setVerschiebt(null)}>
          <div {...KLICKBAR} className="baum-zeile" onClick={() => {
            stapelAendern(verschiebt.id, { folderId: null }); setVerschiebt(null);
          }}>
            <Symbol name="buch" groesse={16} /><span className="name">Ohne Ordner</span>
          </div>
          {ordner.sort((a, b) => a.name.localeCompare(b.name, "de")).map((o) => (
            <div {...KLICKBAR} key={o.id} className="baum-zeile" onClick={() => {
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
