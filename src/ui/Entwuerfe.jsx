/*
 * Der Entwurfsbereich — hier entsteht die Eigenleistung.
 *
 * Ein Vorschlag der KI kommt hier nur zur Hälfte an: Die Vorderseite steht da,
 * daneben die Stelle aus der Vorlage, auf die sie sich stützt. Die Rückseite
 * ist verborgen. Wer sie sehen will, kann sie sich zeigen lassen — aber erst
 * dann, und es wird vermerkt.
 *
 * Das ist die unbequemste Stelle der ganzen App und die wichtigste. Wer
 * fünfzig Karten in einem Zug übernimmt, hat ein volles Deck und nichts
 * gelernt; wer fünfzig Rückseiten selbst formuliert, hat den Stoff einmal
 * durchdacht. Der Unterschied zwischen beidem ist das ganze Fach.
 */

import React, { useMemo, useState } from "react";
import { useDaten } from "../core/store.jsx";
import { normalisiere } from "../core/text.js";
import { anzahl } from "../core/util.js";
import { gehe, zurueckZu } from "../App.jsx";
import { Symbol, SymbolKnopf, Knopf, Bild, Leer, Dialog, useMerker } from "./basis.jsx";
import Zeichenleiste from "./Zeichenleiste.jsx";

/* ---------------------------- Ein einzelner Entwurf --------------------- */

function EntwurfKarte({ entwurf, aufFertig }) {
  const { entwurfAendern, entwurfVerwerfen, entwurfUebernehmen } = useDaten();
  const [eigene, setEigene] = useState(entwurf.eigene || "");
  const [gesehen, setGesehen] = useState(Boolean(entwurf.gesehen));
  const [term, setTerm] = useState(entwurf.term);

  const hatGeschrieben = eigene.trim().length > 0;

  const vorschlagZeigen = () => {
    setGesehen(true);
    entwurfAendern(entwurf.id, { gesehen: true, eigene });
  };

  const uebernehmen = (text) => {
    const endgueltig = String(text ?? eigene).trim();
    if (!endgueltig) return;
    // Ehrliche Buchführung: Deckt sich das Ergebnis mit dem Vorschlag, ist es
    // der Vorschlag — gleichgültig, über welchen Knopf es hereinkam.
    const wieVorschlag = entwurf.vorschlag &&
      normalisiere(endgueltig) === normalisiere(entwurf.vorschlag);
    const herkunft = wieVorschlag ? "ki_uebernommen" : "ki_vorderseite";
    entwurfUebernehmen({ ...entwurf, term }, endgueltig, herkunft);
    aufFertig?.();
  };

  return (
    <div className="karten-zeile" style={{ display: "block", padding: 18 }}>
      {/* Vorderseite und Quelle */}
      <div className="antwort-gitter" style={{ gap: 16, marginBottom: 14 }}>
        <div>
          <label className="beschriftung">Vorderseite</label>
          <textarea className="feld" rows={2} value={term}
            style={{ minHeight: 54, fontSize: 16 }}
            onChange={(e) => setTerm(e.target.value)}
            onBlur={(e) => entwurfAendern(entwurf.id, { term: e.target.value })} />
          {entwurf.termImage && <Bild kennung={entwurf.termImage} klasse=""
            stil={{ maxHeight: 110, borderRadius: 8, marginTop: 8 }} />}
        </div>
        <div>
          <label className="beschriftung">Aus der Vorlage</label>
          <div className="klein matt" style={{
            borderLeft: "3px solid var(--rand)", paddingLeft: 12, minHeight: 54,
            fontStyle: entwurf.quelle ? "italic" : "normal",
          }}>
            {entwurf.quelle || <span className="blass">kein Auszug hinterlegt</span>}
          </div>
        </div>
      </div>

      {/* Die eigene Rückseite */}
      <label className="beschriftung">
        Rückseite, schreib sie in deinen eigenen Worten
      </label>
      <textarea className="feld" rows={2} value={eigene} placeholder="Was gehört auf die Rückseite?"
        style={{ minHeight: 54, fontSize: 16 }}
        onChange={(e) => setEigene(e.target.value)}
        onBlur={(e) => entwurfAendern(entwurf.id, { eigene: e.target.value })} />

      {/* Der Vorschlag — erst auf Verlangen */}
      {entwurf.vorschlag && (
        gesehen ? (
          <div className="rueckmeldung fast" style={{ marginTop: 12 }}>
            <div className="reihe klein matt" style={{ marginBottom: 6 }}>
              <Symbol name="auge" groesse={15} />
              <span>Vorschlag der KI</span>
            </div>
            <div style={{ fontSize: 16 }}>{entwurf.vorschlag}</div>
            <div className="reihe" style={{ marginTop: 10, flexWrap: "wrap" }}>
              <Knopf art="klein" onClick={() => setEigene(entwurf.vorschlag)}>
                In mein Feld übernehmen
              </Knopf>
              <span className="klein blass">
(dann kannst du daran weiterschreiben)
              </span>
            </div>
          </div>
        ) : (
          <div className="reihe" style={{ marginTop: 10 }}>
            <Knopf art="leer klein" onClick={vorschlagZeigen}>
              <Symbol name="auge" groesse={15} />
              {hatGeschrieben ? "Vorschlag zum Vergleich zeigen" : "Vorschlag zeigen"}
            </Knopf>
            {!hatGeschrieben && (
              <span className="klein blass">
(besser erst selbst schreiben; das ist der halbe Lerneffekt)
              </span>
            )}
          </div>
        )
      )}

      <div className="reihe" style={{ marginTop: 14 }}>
        <Knopf art="leer klein gefahr" symbol="muell"
          onClick={() => entwurfVerwerfen(entwurf.id)}>Verwerfen</Knopf>
        <div className="dehnen" />
        <Knopf art="voll" disabled={!hatGeschrieben} onClick={() => uebernehmen()}>
          Als Karte anlegen
        </Knopf>
      </div>
    </div>
  );
}

/* ------------------------------- Die Ansicht ---------------------------- */

export default function Entwuerfe({ setId }) {
  const { entwuerfe, stapel, entwurfVerwerfen } = useDaten();
  const [alleVerwerfen, setAlleVerwerfen] = useState(false);
  const [zeichen, setZeichen] = useMerker("zeichenleisteOffen", false);

  const derStapel = stapel.find((s) => s.id === setId);
  const meine = useMemo(
    () => entwuerfe.filter((e) => e.setId === setId)
      .sort((a, b) => a.createdAt - b.createdAt),
    [entwuerfe, setId]);

  if (!derStapel) {
    return <div className="mitte"><Leer titel="Stapel nicht gefunden" /></div>;
  }

  return (
    <div className="mitte" style={{ maxWidth: 900 }}>
      <div className="kopfzeile">
        <SymbolKnopf symbol="zurueck" titel="Zurück" art="leer"
          onClick={() => zurueckZu("/stapel/" + setId)} />
        <div style={{ flex: 1 }}>
          <h1>Entwürfe</h1>
          <div className="klein matt">{derStapel.title}</div>
        </div>
        <Knopf art={"klein" + (zeichen ? " voll" : "")} symbol="sigma"
          aria-pressed={zeichen} title="Mathematische Zeichen"
          onClick={() => setZeichen((z) => !z)}>
          Zeichen
        </Knopf>
        {meine.length > 0 && (
          <Knopf art="leer klein gefahr" onClick={() => setAlleVerwerfen(true)}>
            Alle verwerfen
          </Knopf>
        )}
      </div>

      {zeichen && <Zeichenleiste aufSchliessen={() => setZeichen(false)} />}

      {meine.length === 0 ? (
        <Leer symbol="papier" titel="Keine Entwürfe"
          text="Entwürfe entstehen, wenn du Karten aus einer Vorlage erzeugen lässt. Sie warten hier, bis du ihnen eine Rückseite gegeben hast.">
          <Knopf art="voll" onClick={() => gehe("/stapel/" + setId + "/bearbeiten")}>
            Zum Bearbeiten
          </Knopf>
        </Leer>
      ) : (
        <>
          <p className="matt" style={{ marginTop: -6, marginBottom: 18 }}>
            {anzahl(meine.length, "Entwurf wartet", "Entwürfe warten")} auf eine
            Rückseite. Schreib sie selbst, den Vorschlag kannst du danach zum
            Vergleich einblenden.
          </p>
          <div style={{ display: "grid", gap: 14 }}>
            {meine.map((e) => <EntwurfKarte key={e.id} entwurf={e} />)}
          </div>
        </>
      )}

      {alleVerwerfen && (
        <Dialog titel="Alle Entwürfe verwerfen?" aufSchliessen={() => setAlleVerwerfen(false)}
          fuss={<>
            <Knopf onClick={() => setAlleVerwerfen(false)}>Abbrechen</Knopf>
            <Knopf art="voll" onClick={() => {
              meine.forEach((e) => entwurfVerwerfen(e.id));
              setAlleVerwerfen(false);
            }}>Verwerfen</Knopf>
          </>}>
          <p className="matt">
            {anzahl(meine.length, "Entwurf verschwindet", "Entwürfe verschwinden")}.
            Angelegte Karten sind davon nicht betroffen.
          </p>
        </Dialog>
      )}
    </div>
  );
}
