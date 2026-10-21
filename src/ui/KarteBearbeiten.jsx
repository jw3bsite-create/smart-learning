/*
 * Eine Karte bearbeiten, ohne den Modus zu verlassen.
 *
 * Beim Abrufen oder Durchblättern fällt einem am ehesten auf, was an einer
 * Karte unklar ist — eine bessere Formulierung, ein Hinweis, der die Teile
 * zusammenbringt. Bisher hieß das: Modus verlassen, Stapel öffnen, Karte
 * suchen. Hier geht es an Ort und Stelle.
 *
 * Im Abrufen erscheint der Knopf erst nach dem Aufdecken. Vorher würde das
 * Fenster die Antwort zeigen, und aus dem Abruf würde ein Wiedererkennen.
 */

import React, { useState } from "react";
import { useDaten } from "../core/store.jsx";
import { kartenArt, KARTENARTEN } from "../core/model.js";
import { schritteAlsText, textAlsSchritte } from "../core/schritte.js";
import { Dialog, Knopf } from "./basis.jsx";

export default function KarteBearbeiten({ karte, aufSchliessen, aufGespeichert }) {
  const { karteAendern } = useDaten();
  const art = kartenArt(karte);
  const [term, setTerm] = useState(karte.term || "");
  const [definition, setDefinition] = useState(karte.definition || "");
  const [hinweis, setHinweis] = useState(karte.hint || "");
  const [schritte, setSchritte] = useState(schritteAlsText(karte.schritte));
  const [speichert, setSpeichert] = useState(false);

  const aenderung = {};
  if (term !== (karte.term || "")) aenderung.term = term;
  if (art !== "cloze" && art !== "mehrschritt" && definition !== (karte.definition || ""))
    aenderung.definition = definition;
  if (hinweis !== (karte.hint || "")) aenderung.hint = hinweis;
  if (art === "mehrschritt" && schritte !== schritteAlsText(karte.schritte))
    aenderung.schritte = textAlsSchritte(schritte);
  const geaendert = Object.keys(aenderung).length > 0;

  const speichern = async () => {
    if (!geaendert) { aufSchliessen(); return; }
    setSpeichert(true);
    await karteAendern(karte.id, aenderung);
    aufGespeichert?.({ ...karte, ...aenderung });
    aufSchliessen();
  };

  return (
    <Dialog titel="Karte bearbeiten" aufSchliessen={aufSchliessen}
      fuss={<>
        <Knopf onClick={aufSchliessen}>Abbrechen</Knopf>
        <Knopf art="voll" disabled={speichert} onClick={speichern}>
          {geaendert ? "Speichern" : "Schließen"}
        </Knopf>
      </>}>
      <div className="klein blass unten-12">{KARTENARTEN[art]}</div>

      <label className="beschriftung">
        {art === "cloze" ? "Text — Lücken in {{doppelten Klammern}}"
          : art === "mehrschritt" ? "Aufgabe" : "Vorderseite"}
      </label>
      <textarea className="feld" value={term} autoFocus rows={art === "cloze" ? 4 : 2}
        onChange={(e) => setTerm(e.target.value)} />

      {art === "mehrschritt" ? (
        <>
          <label className="beschriftung oben-12">Schritte — eine Zeile je Schritt, etwa „ableiten: 2x“</label>
          <textarea className="feld mono" value={schritte} rows={5}
            onChange={(e) => setSchritte(e.target.value)} />
        </>
      ) : art !== "cloze" && (
        <>
          <label className="beschriftung oben-12">Rückseite</label>
          <textarea className="feld" value={definition} rows={3}
            onChange={(e) => setDefinition(e.target.value)} />
        </>
      )}

      <label className="beschriftung oben-12">Hinweis — erscheint beim Lernen erst auf Wunsch</label>
      <textarea className="feld" value={hinweis} rows={2}
        placeholder="Eine Eselsbrücke, ein Zusammenhang, der die Teile verbindet …"
        onChange={(e) => setHinweis(e.target.value)} />

      {(karte.termImage || karte.defImage) && (
        <p className="klein blass oben-12 unten-0">
          Bilder und Aufnahmen änderst du im Stapel unter „Bearbeiten“.
        </p>
      )}
    </Dialog>
  );
}
