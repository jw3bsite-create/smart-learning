/*
 * Mehrere Karten eines Stapels auf einmal: duplizieren, kopieren,
 * verschieben, löschen.
 *
 * Die Leiste steht oben und klebt beim Scrollen, damit man durch eine lange
 * Liste Häkchen setzen kann, ohne für die Aktion wieder hochzumüssen.
 */

import React, { useMemo, useState } from "react";
import { useDaten } from "../core/store.jsx";
import { anzahl } from "../core/util.js";
import { gehe } from "../App.jsx";
import { Knopf, SymbolKnopf, Dialog, Rueckfrage, Symbol } from "./basis.jsx";

/* ------------------------------ Zielwahl ------------------------------- */

/*
 * Wohin kopieren oder verschieben? Alle Fächer mit ihren Stapeln — auch
 * Fächer, die noch gar keinen Stapel haben. Sonst ließe sich ausgerechnet
 * dort nichts anlegen, wo man gerade anfangen will.
 *
 * Jedes Fach hat seinen eigenen Knopf für einen neuen Stapel. Der neue
 * Stapel gehört dann zu genau diesem Fach, ohne dass man die Auswahl
 * verlassen und alle Häkchen neu setzen muss.
 */
function Zielwahl({ art, setArt, anzahlKarten, vonSetId, aufWaehlen, aufAbbrechen }) {
  const { stapel, faecher, stapelAnlegen, stapelAendern } = useDaten();
  const [neuIn, setNeuIn] = useState(null);        // Fachkennung, "" für ohne Fach, null zu
  const [neuerName, setNeuerName] = useState("");
  const von = stapel.find((s) => s.id === vonSetId);

  const gruppen = useMemo(() => {
    const brauchbar = stapel.filter((s) => !s.deleted
      && !(art === "verschieben" && s.id === vonSetId));
    const sortiert = (liste) =>
      liste.sort((a, b) => (a.title || "").localeCompare(b.title || "", "de"));
    const mitFach = faecher
      .filter((f) => !f.deleted)
      .sort((a, b) => (a.name || "").localeCompare(b.name || "", "de"))
      .map((f) => ({
        id: f.id, name: f.name, farbe: f.farbe,
        liste: sortiert(brauchbar.filter((s) => s.subjectId === f.id)),
      }));
    const bekannt = new Set(faecher.map((f) => f.id));
    const ohne = sortiert(brauchbar.filter((s) => !s.subjectId || !bekannt.has(s.subjectId)));
    return [...mitFach, { id: "", name: "Ohne Fach", liste: ohne }];
  }, [stapel, faecher, art, vonSetId]);

  const oeffnen = (fachId) => { setNeuIn(fachId); setNeuerName(""); };

  const neuAnlegen = async (e) => {
    e.preventDefault();
    const titel = neuerName.trim();
    if (!titel || neuIn === null) return;
    /* Im selben Fach landet der neue Stapel neben dem alten im Ordner;
       in einem anderen Fach gehört er dort nicht hin. */
    const gleichesFach = (von?.subjectId || "") === neuIn;
    const neu = await stapelAnlegen(titel, gleichesFach ? von?.folderId || null : null);
    if (neuIn) await stapelAendern(neu.id, { subjectId: neuIn });
    aufWaehlen(neu);
  };

  return (
    <Dialog titel={(art === "kopieren" ? "Kopieren nach" : "Verschieben nach") + " …"}
      aufSchliessen={aufAbbrechen}
      fuss={<Knopf onClick={aufAbbrechen}>Abbrechen</Knopf>}>
      {/* Kopieren oder verschieben laesst sich hier noch umentscheiden, ohne
          den Dialog zu schliessen und die Auswahl neu zu treffen. */}
      <div className="reihe" style={{ gap: 6, marginBottom: 10 }} role="group">
        {[["kopieren", "Kopieren"], ["verschieben", "Verschieben"]].map(([k, name]) => (
          <Knopf key={k} art={"klein" + (art === k ? " voll" : "")} aria-pressed={art === k}
            onClick={() => setArt(k)}>
            {name}
          </Knopf>
        ))}
      </div>
      <p className="klein matt" style={{ marginTop: 0 }}>
        {anzahl(anzahlKarten, "Karte", "Karten")}
        {art === "kopieren"
          ? " werden kopiert. Die Kopien lernst du neu, das Original bleibt."
          : " wechseln den Stapel und behalten ihren Lernstand."}
        {" "}Wähle einen Stapel oder lege in einem Fach einen neuen an.
      </p>

      <div style={{ display: "grid", gap: 16 }}>
        {gruppen.map((g) => (
          <div key={g.id || "ohne"}>
            <div className="reihe" style={{ gap: 8, marginBottom: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, flex: "none",
                background: g.farbe || "var(--rand)" }} />
              <strong className="dehnen klein">{g.name}</strong>
              {neuIn !== g.id && (
                <Knopf art="klein" symbol="plus" onClick={() => oeffnen(g.id)}>
                  Neuer Stapel
                </Knopf>
              )}
            </div>

            {neuIn === g.id && (
              <form className="reihe" style={{ gap: 8, marginBottom: 8 }} onSubmit={neuAnlegen}>
                <input className="feld" autoFocus value={neuerName}
                  placeholder={"Neuer Stapel in " + g.name}
                  onChange={(e) => setNeuerName(e.target.value)} />
                <Knopf art="voll" type="submit" disabled={!neuerName.trim()}>Anlegen</Knopf>
                <SymbolKnopf symbol="kreuz" titel="Abbrechen" art="leer klein"
                  onClick={() => setNeuIn(null)} />
              </form>
            )}

            <div style={{ display: "grid", gap: 6 }}>
              {g.liste.map((s) => (
                <button key={s.id} type="button" className="kachel auswahl-ziel"
                  onClick={() => aufWaehlen(s)}>
                  <Symbol name="stapel" groesse={16} />
                  <span className="dehnen">{s.title || "Ohne Titel"}</span>
                  {s.id === vonSetId && <span className="marke klein">dieser Stapel</span>}
                </button>
              ))}
              {g.liste.length === 0 && neuIn !== g.id && (
                <div className="klein blass">Noch kein Stapel in diesem Fach.</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Dialog>
  );
}

/* ------------------------------- Leiste -------------------------------- */

export default function Auswahlleiste({ setId, ausgewaehlt, alleKennungen, setAusgewaehlt, aufBeenden }) {
  const { kartenKopieren, kartenVerschieben, kartenLoeschenViele } = useDaten();
  const [ziel, setZiel] = useState(null);          // "kopieren" | "verschieben" | null
  const [loescht, setLoescht] = useState(false);
  const [meldung, setMeldung] = useState(null);

  const zahl = ausgewaehlt.size;
  const alle = zahl > 0 && zahl === alleKennungen.length;

  const fertig = (text, zielStapel) => {
    setMeldung({ text, zielStapel });
    setAusgewaehlt(new Set());
  };

  const duplizieren = async () => {
    const neue = await kartenKopieren([...ausgewaehlt], setId);
    fertig(anzahl(neue.length, "Karte dupliziert", "Karten dupliziert")
      + ". Die Kopien stehen am Ende des Stapels.", null);
  };

  const zielGewaehlt = async (s) => {
    const art = ziel;
    setZiel(null);
    if (art === "kopieren") {
      const neue = await kartenKopieren([...ausgewaehlt], s.id);
      fertig(anzahl(neue.length, "Karte", "Karten") + " nach „" + s.title + "“ kopiert.", s);
    } else {
      const n = await kartenVerschieben([...ausgewaehlt], s.id);
      fertig(anzahl(n, "Karte", "Karten") + " nach „" + s.title + "“ verschoben.", s);
    }
  };

  const loeschen = async () => {
    const n = await kartenLoeschenViele([...ausgewaehlt]);
    setLoescht(false);
    fertig(anzahl(n, "Karte liegt", "Karten liegen") + " jetzt im Papierkorb.", null);
  };

  return (
    <>
      <div className="auswahl-leiste">
        <div className="reihe umbruch" style={{ gap: 8 }}>
          <strong className="dehnen">
            {zahl ? anzahl(zahl, "Karte ausgewählt", "Karten ausgewählt") : "Karten antippen, um sie auszuwählen"}
          </strong>
          <Knopf art="klein" onClick={() => setAusgewaehlt(alle ? new Set() : new Set(alleKennungen))}>
            {alle ? "Keine" : "Alle"}
          </Knopf>
          <SymbolKnopf symbol="kreuz" titel="Auswahl beenden" art="leer klein" onClick={aufBeenden} />
        </div>
        <div className="reihe umbruch" style={{ gap: 6, marginTop: 8 }}>
          <Knopf art="klein" symbol="stapel" disabled={!zahl} onClick={duplizieren}>Duplizieren</Knopf>
          <Knopf art="klein" symbol="hinauf" disabled={!zahl} onClick={() => setZiel("kopieren")}>
            Kopieren nach …
          </Knopf>
          <Knopf art="klein" symbol="ordner" disabled={!zahl} onClick={() => setZiel("verschieben")}>
            Verschieben nach …
          </Knopf>
          <Knopf art="klein gefahr" symbol="muell" disabled={!zahl} onClick={() => setLoescht(true)}>
            Löschen
          </Knopf>
        </div>
        {meldung && (
          <div className="rueckmeldung gut klein reihe umbruch" style={{ gap: 8, marginTop: 10 }}>
            <span className="dehnen">{meldung.text}</span>
            {meldung.zielStapel && (
              <Knopf art="klein" onClick={() => gehe("/stapel/" + meldung.zielStapel.id)}>Ansehen</Knopf>
            )}
          </div>
        )}
      </div>

      {ziel && (
        <Zielwahl art={ziel} setArt={setZiel} anzahlKarten={zahl} vonSetId={setId}
          aufWaehlen={zielGewaehlt} aufAbbrechen={() => setZiel(null)} />
      )}
      {loescht && (
        <Rueckfrage titel={anzahl(zahl, "Karte löschen?", "Karten löschen?")}
          bestaetigung="In den Papierkorb"
          text="Sie liegen danach sechzig Tage im Papierkorb und lassen sich dort zurückholen, samt Lernstand."
          aufNein={() => setLoescht(false)} aufJa={loeschen} />
      )}
    </>
  );
}
