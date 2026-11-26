/*
 * Erstellen — ein Blatt von unten mit allem, was man neu anlegen kann
 * (Wunsch des Nutzers, 26.11.2026: „Erstellen und Lernen sind das Wichtigste“).
 *
 * Erreichbar je nach Einstellung über den runden +-Knopf über der
 * Navigierleiste oder über „Erstellen“ in der Navigierleiste selbst
 * (Fächer und Stapel dann vereint). Steht man in einem Fach, ist es
 * vorausgewählt — so entstehen keine Stapel ohne Fach aus Versehen.
 */

import React, { useMemo, useState } from "react";
import { useDaten } from "../core/store.jsx";
import { gehe } from "../App.jsx";
import { Dialog, Sinnbild, Symbol, FachPunkt } from "./basis.jsx";
import { TextEinfuhr, BildEinfuhr, QuizletEinfuhr } from "./Einfuhr.jsx";
import { NeuesFach } from "./Faecher.jsx";
import { KlausurDialog, klausurSpeichern } from "./Klausuren.jsx";

function Zeile({ symbol, ton, titel, text, onClick }) {
  return (
    <button type="button" className="listenzeile erstellen-zeile" onClick={onClick}>
      <Sinnbild name={symbol} ton={ton} />
      <span className="dehnen">
        <span>{titel}</span>
        {text && <span className="klein blass" style={{ display: "block" }}>{text}</span>}
      </span>
      <Symbol name="weiter" groesse={16} className="blass" />
    </button>
  );
}

export default function ErstellenBlatt({ fachId = null, aufSchliessen }) {
  const { stapel, faecher, fachVon, stapelAnlegen, stapelAendern, fachAendern } = useDaten();
  const fach = fachId ? fachVon(fachId) : null;
  const [schritt, setSchritt] = useState(null);   // null | "karten" | "klausur" | "fach"
  const [einfuhr, setEinfuhr] = useState(null);   // { art, setId }
  const [klausurFach, setKlausurFach] = useState(null);

  /* Für „Karten hinzufügen“: zuletzt geänderte Stapel, im Fach nur dessen. */
  const juengste = useMemo(() => stapel
    .filter((s) => !s.deleted && (!fachId || s.subjectId === fachId))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, 6), [stapel, fachId]);

  const neuerStapel = async () => {
    const s = await stapelAnlegen("Neuer Stapel", null);
    if (fachId) await stapelAendern(s.id, { subjectId: fachId });
    return s;
  };

  const leer = async () => { const s = await neuerStapel(); aufSchliessen(); gehe("/stapel/" + s.id + "/bearbeiten"); };
  const aus = async (art) => { const s = await neuerStapel(); setEinfuhr({ art, setId: s.id }); };
  const einfuhrFertig = () => { const id = einfuhr.setId; setEinfuhr(null); aufSchliessen(); gehe("/stapel/" + id); };

  if (einfuhr) {
    const Teil = { text: TextEinfuhr, bild: BildEinfuhr, quizlet: QuizletEinfuhr }[einfuhr.art];
    return <Teil setId={einfuhr.setId} aufSchliessen={einfuhrFertig} />;
  }
  if (schritt === "fach") return <NeuesFach aufSchliessen={aufSchliessen} />;
  if (klausurFach) {
    return (
      <KlausurDialog fach={klausurFach} klausur={null}
        aufSpeichern={(k) => klausurSpeichern(klausurFach, k, fachAendern)}
        aufSchliessen={() => { setKlausurFach(null); aufSchliessen(); }} />
    );
  }

  return (
    <Dialog titel={fach ? "Erstellen in " + fach.name : "Erstellen"} aufSchliessen={aufSchliessen}>
      {!schritt && (
        <div className="liste">
          <Zeile symbol="stapel" ton="lila" titel="Neuer Stapel" text="leer, Karten von Hand" onClick={leer} />
          <Zeile symbol="plus" ton="blau" titel="Karten zu einem Stapel" onClick={() => setSchritt("karten")} />
          <Zeile symbol="hinauf" ton="tuerkis" titel="Aus Text oder Liste" text="einfügen, auch aus Word oder einer Tabelle" onClick={() => aus("text")} />
          <Zeile symbol="kamera" ton="orange" titel="Aus Bild" text="Foto eines Arbeitsblatts" onClick={() => aus("bild")} />
          <Zeile symbol="stapel" ton="blau" titel="Aus Quizlet" onClick={() => aus("quizlet")} />
          <Zeile symbol="buch" ton="gruen" titel="Fach" onClick={() => setSchritt("fach")} />
          <Zeile symbol="papier" ton="rot" titel="Klausur" text={fach ? "in " + fach.name : "Fach wählen"}
            onClick={() => (fach ? setKlausurFach(fach) : setSchritt("klausur"))} />
        </div>
      )}

      {schritt === "karten" && (
        <>
          <div className="klein matt unten-8">In welchen Stapel?</div>
          <div className="liste">
            {juengste.map((s) => (
              <button key={s.id} type="button" className="listenzeile"
                onClick={() => { aufSchliessen(); gehe("/stapel/" + s.id + "/bearbeiten"); }}>
                <Sinnbild name="stapel" ton="lila" />
                <span className="dehnen">{s.title || "Ohne Titel"}</span>
              </button>
            ))}
            {!juengste.length && <div className="klein blass">Noch keine Stapel.</div>}
          </div>
        </>
      )}

      {schritt === "klausur" && (
        <>
          <div className="klein matt unten-8">Für welches Fach?</div>
          <div className="liste">
            {faecher.filter((f) => !f.deleted).map((f) => (
              <button key={f.id} type="button" className="listenzeile" onClick={() => setKlausurFach(f)}>
                <FachPunkt farbe={f.farbe} />
                <span className="dehnen">{f.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </Dialog>
  );
}
