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
 * Wohin kopieren oder verschieben? Alle Stapel, nach Fach geordnet, dazu
 * die Möglichkeit, gleich einen neuen anzulegen — sonst müsste man dafür
 * die Auswahl verlassen und alle Häkchen neu setzen.
 */
function Zielwahl({ art, anzahlKarten, vonSetId, aufWaehlen, aufAbbrechen }) {
  const { stapel, faecher, stapelAnlegen, stapelAendern } = useDaten();
  const [neuerName, setNeuerName] = useState("");
  const von = stapel.find((s) => s.id === vonSetId);

  const gruppen = useMemo(() => {
    const nachFach = new Map();
    for (const s of stapel) {
      if (s.deleted || (art === "verschieben" && s.id === vonSetId)) continue;
      const schluessel = s.subjectId || "";
      if (!nachFach.has(schluessel)) nachFach.set(schluessel, []);
      nachFach.get(schluessel).push(s);
    }
    const name = (id) => faecher.find((f) => f.id === id)?.name || "Ohne Fach";
    return [...nachFach.entries()]
      .map(([id, liste]) => ({
        id, name: name(id),
        liste: liste.sort((a, b) => (a.title || "").localeCompare(b.title || "", "de")),
      }))
      .sort((a, b) => (a.id === "" ? 1 : b.id === "" ? -1 : a.name.localeCompare(b.name, "de")));
  }, [stapel, faecher, art, vonSetId]);

  const neuAnlegen = async (e) => {
    e.preventDefault();
    const titel = neuerName.trim();
    if (!titel) return;
    const s = await stapelAnlegen(titel, von?.folderId || null);
    if (von?.subjectId) await stapelAendern(s.id, { subjectId: von.subjectId });
    aufWaehlen(s);
  };

  return (
    <Dialog titel={(art === "kopieren" ? "Kopieren nach" : "Verschieben nach") + " …"}
      aufSchliessen={aufAbbrechen}
      fuss={<Knopf onClick={aufAbbrechen}>Abbrechen</Knopf>}>
      <p className="klein matt" style={{ marginTop: 0 }}>
        {anzahl(anzahlKarten, "Karte", "Karten")}
        {art === "kopieren"
          ? " werden kopiert. Die Kopien lernst du neu, das Original bleibt."
          : " wechseln den Stapel und behalten ihren Lernstand."}
      </p>

      <form className="reihe" style={{ gap: 8, marginBottom: 16 }} onSubmit={neuAnlegen}>
        <input className="feld" value={neuerName} placeholder="Neuer Stapel, etwa Vokabeln Unit 6"
          onChange={(e) => setNeuerName(e.target.value)} />
        <Knopf art="voll" type="submit" symbol="plus" disabled={!neuerName.trim()}>Anlegen</Knopf>
      </form>

      <div style={{ display: "grid", gap: 14 }}>
        {gruppen.map((g) => (
          <div key={g.id || "ohne"}>
            <div className="klein blass" style={{ marginBottom: 6 }}>{g.name}</div>
            <div style={{ display: "grid", gap: 6 }}>
              {g.liste.map((s) => (
                <button key={s.id} type="button" className="kachel auswahl-ziel"
                  onClick={() => aufWaehlen(s)}>
                  <Symbol name="stapel" groesse={16} />
                  <span className="dehnen">{s.title || "Ohne Titel"}</span>
                  {s.id === vonSetId && <span className="marke klein">dieser Stapel</span>}
                </button>
              ))}
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
        <Zielwahl art={ziel} anzahlKarten={zahl} vonSetId={setId}
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
