/*
 * Die Seite eines Fachs: sein Material an einem Ort.
 *
 * Bis hierher gab es zwei Wege zu den Stapeln eines Fachs, und beide waren
 * Umwege: über die Ordner, die mit dem Fach nichts zu tun haben müssen, oder
 * über „Stapel zuordnen" im Menü der Fachübersicht, eine lange Liste aller
 * Stapel. Wer auf „Ethik" klickt, will sehen, was er für Ethik hat — und dort
 * Neues anlegen.
 *
 * Zwei Begriffe bleiben dabei getrennt, weil sie Verschiedenes sagen:
 * Der **Ordner** sagt, wo ein Stapel liegt. Das **Fach** sagt, wofür er zählt —
 * im Abrufen, im Fragemodus, bei der Prüfung. Ein Stapel gehört zu genau einem
 * Fach, liegt aber in einem beliebigen Ordner.
 *
 * Mit der Regel „keine Selbstauswahl der Wiederholungskarten" verträgt sich
 * das: Diese Seite zeigt und ordnet Material. Was beim Abrufen drankommt,
 * entscheidet weiter der Plan.
 *
 * Innerhalb eines Fachs gibt es Ordner („Analysis", „Klausur 1"), damit
 * zwanzig Stapel nicht alphabetisch durcheinanderstehen. Sie ordnen nur;
 * abgerufen wird weiter das ganze Fach. Die Regeln stehen in
 * core/fachordner.js. Dieselbe Seite zeigt das Fach (`ordnerId` leer) und
 * jeden seiner Ordner.
 */

import React, { useMemo, useState } from "react";
import { useDaten } from "../core/store.jsx";
import { fachZaehlung, stapelStand } from "../core/warteschlange.js";
import { ordnerImFach, stapelImFach, fachordnerZweig, fachordnerPfad } from "../core/fachordner.js";
import { anzahl } from "../core/util.js";
import { punkteText } from "../core/noten.js";
import { gehe } from "../App.jsx";
import { StapelKachel } from "./Bibliothek.jsx";
import { FachEinstellungen } from "./Faecher.jsx";
import { punkteZuLernfach } from "./Noten.jsx";
import StapeldateiEinfuhr from "./Stapeldatei.jsx";
import { erfragen, bestaetigen } from "./Rueckfragen.jsx";
import {
  Symbol, SymbolKnopf, Knopf, Menue, MenuePunkt, Leer, Dialog, FachPunkt, KLICKBAR,
} from "./basis.jsx";

const nachTitel = (a, b) => (a.title || "").localeCompare(b.title || "", "de");
const pfadText = (ordner, kennung) => fachordnerPfad(ordner, kennung).map((o) => o.name).join(" › ");

export default function FachSeite({ fachId, ordnerId = null }) {
  const {
    faecher, ordner, stapel, karten, kartenNachStapel, zustaende, stapelVon,
    stapelAnlegen, stapelAendern, notenfaecher, ordnerAnlegen, ordnerAendern, ordnerAufloesen,
  } = useDaten();
  const [hinzufuegen, setHinzufuegen] = useState(false);
  const [einstellungen, setEinstellungen] = useState(false);
  const [liestEin, setLiestEin] = useState(false);
  const [verschiebt, setVerschiebt] = useState(null);

  const fach = faecher.find((f) => f.id === fachId) || null;
  const derOrdner = ordnerId
    ? ordner.find((o) => o.id === ordnerId && o.subjectId === fachId && !o.deleted) || null
    : null;
  const hier = derOrdner ? derOrdner.id : null;

  const alleImFach = useMemo(() => stapel.filter((s) => !s.deleted && s.subjectId === fachId),
    [stapel, fachId]);
  const eigene = useMemo(() => stapelImFach(stapel, ordner, fachId, hier).sort(nachTitel),
    [stapel, ordner, fachId, hier]);
  const unterordner = useMemo(() => ordnerImFach(ordner, fachId, hier), [ordner, fachId, hier]);
  const ordnerDesFachs = useMemo(() => ordner
    .filter((o) => o.subjectId === fachId && !o.deleted)
    .sort((a, b) => pfadText(ordner, a.id).localeCompare(pfadText(ordner, b.id), "de")),
  [ordner, fachId]);
  /* Was sich hierher holen lässt: im Fach alles aus anderen Fächern, im
     Ordner alles, was nicht schon in ihm liegt. */
  const andere = useMemo(() => stapel
    .filter((s) => !s.deleted && (hier ? s.folderId !== hier : s.subjectId !== fachId))
    .sort(nachTitel),
  [stapel, fachId, hier]);

  if (!fach || (ordnerId && !derOrdner)) {
    return (
      <div className="mitte">
        <Leer titel={fach ? "Ordner nicht gefunden" : "Fach nicht gefunden"}
          text="Vielleicht wurde er gelöscht oder aufgelöst.">
          <Knopf onClick={() => gehe(fach ? "/fach/" + fach.id : "/faecher")}>
            {fach ? "Zu " + fach.name : "Zu den Fächern"}
          </Knopf>
        </Leer>
      </div>
    );
  }

  const z = fachZaehlung(karten, zustaende, stapelVon, fach.id);
  const offen = z.faellig + z.neu;
  const punkte = punkteZuLernfach(notenfaecher, fach.id);
  const fachName = (id) => faecher.find((f) => f.id === id)?.name;
  const ordnerName = (id) => ordner.find((o) => o.id === id)?.name;
  const pfad = derOrdner ? fachordnerPfad(ordner, derOrdner.id) : [];
  const leer = eigene.length === 0 && unterordner.length === 0;
  const zumOrdner = (kennung) => gehe("/fach/" + fach.id + (kennung ? "/ordner/" + kennung : ""));

  /* Ein neuer Stapel gehoert sofort zum Fach und zum Ordner, in dem man
     steht — sonst muesste man ihn danach erst suchen und einsortieren. */
  const neuerStapel = async () => {
    const s = await stapelAnlegen("Neuer Stapel", hier);
    await stapelAendern(s.id, { subjectId: fach.id });
    gehe("/stapel/" + s.id + "/bearbeiten");
  };

  const neuerOrdner = async () => {
    const name = await erfragen({
      titel: "Neuer Ordner in " + (derOrdner ? derOrdner.name : fach.name),
      platzhalter: "etwa Analysis oder Klausur 1", ja: "Anlegen",
    });
    if (name) await ordnerAnlegen(name, hier, fach.id);
  };

  const umbenennen = async (o) => {
    const name = await erfragen({ titel: "Ordner umbenennen", vorgabe: o.name, ja: "Umbenennen" });
    if (name) await ordnerAendern(o.id, { name });
  };

  const aufloesen = async (o) => {
    const drin = stapel.filter((s) => !s.deleted && s.folderId === o.id).length;
    const ok = await bestaetigen({
      titel: "„" + o.name + "“ auflösen?",
      text: (drin ? anzahl(drin, "Stapel rückt", "Stapel rücken") + " eine Ebene hinauf. " : "")
        + "Kein Stapel und keine Karte wird gelöscht, nur der Ordner verschwindet.",
      ja: "Auflösen",
    });
    if (!ok) return;
    await ordnerAufloesen(o.id);
    if (o.id === hier) zumOrdner(o.parentId || null);
  };

  /* Stapel auf eine Ordnerkachel ziehen (am Rechner). */
  const ablegen = (e, zielOrdner) => {
    e.preventDefault();
    const kennung = e.dataTransfer.getData("text/kk");
    if (kennung) stapelAendern(kennung, { subjectId: fach.id, folderId: zielOrdner });
  };

  const verschieben = (zielOrdner) => {
    stapelAendern(verschiebt.id, { folderId: zielOrdner });
    setVerschiebt(null);
  };

  const inNeuenOrdner = async () => {
    const s = verschiebt;
    const name = await erfragen({ titel: "Neuer Ordner in " + fach.name,
      platzhalter: "etwa Analysis oder Klausur 1", ja: "Anlegen und verschieben" });
    if (!name) return;
    const o = await ordnerAnlegen(name, null, fach.id);
    await stapelAendern(s.id, { folderId: o.id });
    setVerschiebt(null);
  };

  const menue = (s) => (
    <>
      <MenuePunkt symbol="blitz" onClick={() => gehe("/stapel/" + s.id + "/lernen")}>Lernen</MenuePunkt>
      <MenuePunkt symbol="stift" onClick={() => gehe("/stapel/" + s.id + "/bearbeiten")}>Bearbeiten</MenuePunkt>
      <MenuePunkt symbol="ordner" onClick={() => setVerschiebt(s)}>In Ordner verschieben …</MenuePunkt>
      <hr />
      <MenuePunkt symbol="kreuz" onClick={() => stapelAendern(s.id, { subjectId: null })}>
        Aus diesem Fach nehmen
      </MenuePunkt>
    </>
  );

  return (
    <div className="mitte">
      <div className="kopfzeile">
        <nav className="pfad klein matt" aria-label="Ablage">
          <button type="button" className="pfad-verweis" onClick={() => gehe("/faecher")}>Fächer</button>
          <span aria-hidden="true">›</span>
          {derOrdner
            ? <button type="button" className="pfad-verweis" onClick={() => zumOrdner(null)}>{fach.name}</button>
            : <span className="pfad-hier" aria-current="page">{fach.name}</span>}
          {pfad.map((o, i) => (
            <React.Fragment key={o.id}>
              <span aria-hidden="true">›</span>
              {i === pfad.length - 1
                ? <span className="pfad-hier" aria-current="page">{o.name}</span>
                : <button type="button" className="pfad-verweis" onClick={() => zumOrdner(o.id)}>
                  {o.name}</button>}
            </React.Fragment>
          ))}
        </nav>
        {derOrdner ? <Symbol name="ordner" groesse={24} /> : <FachPunkt farbe={fach.farbe} gross />}
        <h1>{derOrdner ? derOrdner.name : fach.name}</h1>
        <div className="kopf-mehr">
          {derOrdner ? (
            <Menue knopf={<SymbolKnopf symbol="mehr" titel="Mehr" art="" />}>
              <MenuePunkt symbol="stift" onClick={() => umbenennen(derOrdner)}>Umbenennen</MenuePunkt>
              <MenuePunkt symbol="ordner" onClick={() => aufloesen(derOrdner)}>
                Ordner auflösen …</MenuePunkt>
            </Menue>
          ) : (
            <SymbolKnopf symbol="zahnrad" titel="Einstellungen des Fachs" art=""
              onClick={() => setEinstellungen(true)} />
          )}
        </div>
      </div>

      {/* ---------------------------- Zum Lernen --------------------------- */}
      {/* Abgerufen wird immer das ganze Fach, auch aus einem Ordner heraus:
          Was drankommt, entscheidet der Plan, nicht die Ablage. */}
      <div className="reihe umbruch" style={{ marginBottom: 10 }}>
        <Knopf art="voll" symbol="blitz" disabled={offen === 0}
          onClick={() => gehe("/abrufen/" + fach.id)}>
          {derOrdner ? "Abrufen: " + fach.name : "Abrufen"}
        </Knopf>
        <Knopf symbol="wuerfel" disabled={alleImFach.length === 0}
          onClick={() => gehe("/fragen/" + fach.id)}>
          Fragen aus {fach.name}
        </Knopf>
        <div className="reihe klein" style={{ gap: 6, flexWrap: "wrap" }}>
          {z.faellig > 0 && <span className="marke gelb">{z.faellig} fällig</span>}
          {z.neu > 0 && <span className="marke">{z.neu} neu</span>}
          {z.gesperrt > 0 && (
            <button type="button" className="marke rot marke-knopf" title="Im Fehlerheft ansehen"
              onClick={(e) => { e.stopPropagation(); gehe("/fehler/" + fach.id); }}>
              {z.gesperrt} hängt
            </button>
          )}
          {offen === 0 && z.gesamt > 0 && <span className="marke gruen">nichts offen</span>}
        </div>
      </div>
      {punkte && !derOrdner && (
        <div className="klein matt" style={{ marginBottom: 18 }}>
          Deine Punkte: <strong>{punkteText(punkte.juengste.punkte)}</strong>
          {" "}(zuletzt {punkte.juengste.halbjahr})
        </div>
      )}

      {/* ------------------------------ Material --------------------------- */}
      {/* Solange hier nichts liegt, stehen dieselben Knoepfe gross in der Mitte. */}
      {!leer && (
        <div className="reihe umbruch" style={{ margin: "22px 0 12px" }}>
          <h3 className="dehnen">
            {[
              unterordner.length ? anzahl(unterordner.length, "Ordner", "Ordner") : null,
              eigene.length ? anzahl(eigene.length, "Stapel", "Stapel") : null,
            ].filter(Boolean).join(", ") + (derOrdner ? " in diesem Ordner" : " in diesem Fach")}
          </h3>
          <Knopf symbol="ordner" onClick={neuerOrdner}>Ordner</Knopf>
          {andere.length > 0 && (
            <Knopf symbol="stapel" onClick={() => setHinzufuegen(true)}>Stapel hinzufügen</Knopf>
          )}
          <Knopf symbol="hinauf" onClick={() => setLiestEin(true)}>Stapeldatei einlesen</Knopf>
          <Knopf art="voll" symbol="plus" onClick={neuerStapel}>Neuer Stapel</Knopf>
        </div>
      )}

      {leer ? (
        <Leer symbol={derOrdner ? "ordner" : "stapel"}
          titel={derOrdner ? "Dieser Ordner ist leer" : "Noch kein Material in " + fach.name}
          text={derOrdner
            ? "Leg hier einen Stapel an, oder verschiebe einen über sein Menü „···“ hierher."
            : "Leg einen Stapel an, er gehört dann automatisch zu diesem Fach. Oder nimm einen vorhandenen dazu."}>
          <div className="reihe" style={{ justifyContent: "center", flexWrap: "wrap" }}>
            <Knopf art="voll gross" symbol="plus" onClick={neuerStapel}>Neuer Stapel</Knopf>
            {andere.length > 0 && (
              <Knopf art="gross" symbol="stapel" onClick={() => setHinzufuegen(true)}>
                Vorhandenen Stapel hinzufügen
              </Knopf>
            )}
            <Knopf art="gross" symbol="ordner" onClick={neuerOrdner}>Ordner anlegen</Knopf>
            <Knopf art="gross" symbol="hinauf" onClick={() => setLiestEin(true)}>
              Stapeldatei einlesen
            </Knopf>
          </div>
        </Leer>
      ) : (
        <>
          {unterordner.length > 0 && (
            <div className="gitter" style={{ marginBottom: eigene.length ? 14 : 0 }}>
              {unterordner.map((o) => (
                <OrdnerKachel key={o.id} ordner={o} alleOrdner={ordner} stapel={stapel}
                  kartenNachStapel={kartenNachStapel} zustaende={zustaende}
                  oeffnen={() => zumOrdner(o.id)} ablegen={(e) => ablegen(e, o.id)}
                  umbenennen={() => umbenennen(o)} aufloesen={() => aufloesen(o)} />
              ))}
            </div>
          )}
          {eigene.length > 0 && (
            <div className="gitter">
              {eigene.map((s) => (
                <StapelKachel key={s.id} stapel={s} karten={kartenNachStapel.get(s.id) || []}
                  zustaende={zustaende} aufMenue={menue} />
              ))}
            </div>
          )}
        </>
      )}

      {liestEin && (
        <StapeldateiEinfuhr fachId={fach.id} ordnerId={hier} aufSchliessen={() => setLiestEin(false)} />
      )}

      {!derOrdner && (
        <p className="klein blass" style={{ marginTop: 22, maxWidth: "62ch" }}>
          Ordner im Fach ordnen nur dein Material. Abgerufen wird immer das ganze Fach;
          was drankommt, entscheidet der Plan.
        </p>
      )}

      {/* -------------------------- In Ordner verschieben --------------------- */}
      {verschiebt && (
        <Dialog titel={"„" + (verschiebt.title || "Ohne Titel") + "“ verschieben"}
          aufSchliessen={() => setVerschiebt(null)}
          fuss={<Knopf symbol="plus" onClick={inNeuenOrdner}>Neuer Ordner …</Knopf>}>
          <div className="liste">
            <button type="button" className="listenzeile" onClick={() => verschieben(null)}>
              <FachPunkt farbe={fach.farbe} />
              <span className="dehnen">Oben in {fach.name}</span>
              {!ordnerDesFachs.some((o) => o.id === verschiebt.folderId)
                && <span className="klein blass">liegt hier</span>}
            </button>
            {ordnerDesFachs.map((o) => (
              <button type="button" key={o.id} className="listenzeile" onClick={() => verschieben(o.id)}>
                <Symbol name="ordner" groesse={16} />
                <span className="dehnen">{pfadText(ordner, o.id)}</span>
                {verschiebt.folderId === o.id && <span className="klein blass">liegt hier</span>}
              </button>
            ))}
          </div>
        </Dialog>
      )}

      {/* -------------------------- Stapel hinzufügen ------------------------ */}
      {hinzufuegen && (
        <Dialog weit titel={"Stapel zu " + (derOrdner ? derOrdner.name : fach.name) + " hinzufügen"}
          aufSchliessen={() => setHinzufuegen(false)}
          fuss={<Knopf art="voll" onClick={() => setHinzufuegen(false)}>Fertig</Knopf>}>
          <p className="klein matt" style={{ marginTop: 0 }}>
            {derOrdner
              ? "Der Stapel wandert in diesen Ordner und gehört danach zu " + fach.name + "."
              : "Gehört ein Stapel schon zu einem anderen Fach, wechselt er hierher."}
          </p>
          <div style={{ display: "grid", gap: 8 }}>
            {andere.map((s) => (
              <div key={s.id} className="reihe" style={{ gap: 10 }}>
                <Symbol name="stapel" groesse={16} />
                <span className="dehnen">
                  {s.title || "Ohne Titel"}
                  <span className="klein blass">
                    {" · "}{s.subjectId ? fachName(s.subjectId) || "anderes Fach" : "ohne Fach"}
                    {s.folderId && ordnerName(s.folderId) ? " › " + ordnerName(s.folderId) : ""}
                    {" · "}{anzahl((kartenNachStapel.get(s.id) || []).length, "Karte", "Karten")}
                  </span>
                </span>
                <Knopf art="klein" onClick={() => stapelAendern(s.id,
                  hier ? { subjectId: fach.id, folderId: hier } : { subjectId: fach.id })}>
                  Hinzufügen
                </Knopf>
              </div>
            ))}
            {andere.length === 0 && (
              <div className="klein blass">Alle Stapel liegen schon hier.</div>
            )}
          </div>
        </Dialog>
      )}

      {einstellungen && (
        <FachEinstellungen fach={fach} aufSchliessen={() => setEinstellungen(false)} />
      )}
    </div>
  );
}

/* ----------------------------- Ordnerkachel ----------------------------- */

/* Ein Ordner im Fach: Name, wie viele Stapel darin liegen (auch in
   Unterordnern) und wie viel davon heute ansteht. */
function OrdnerKachel({ ordner: o, alleOrdner, stapel, kartenNachStapel, zustaende,
  oeffnen, ablegen, umbenennen, aufloesen }) {
  const [ziel, setZiel] = useState(false);
  const zweig = fachordnerZweig(alleOrdner, o.id);
  const drin = stapel.filter((s) => !s.deleted && s.subjectId === o.subjectId && zweig.has(s.folderId));
  let faellig = 0;
  let neu = 0;
  for (const s of drin) {
    const st = stapelStand(kartenNachStapel.get(s.id) || [], zustaende, s);
    faellig += st.faellig;
    neu += st.neu;
  }
  return (
    <div {...KLICKBAR} className={"kachel ordner-kachel" + (ziel ? " ziel" : "")} onClick={oeffnen}
      onDragOver={(e) => { e.preventDefault(); setZiel(true); }}
      onDragLeave={() => setZiel(false)}
      onDrop={(e) => { setZiel(false); ablegen(e); }}>
      <div className="reihe">
        <Symbol name="ordner" groesse={20} />
        <div className="titel dehnen">{o.name}</div>
        <Menue knopf={<SymbolKnopf symbol="mehr" titel="Mehr" />}>
          <MenuePunkt symbol="stift" onClick={umbenennen}>Umbenennen</MenuePunkt>
          <MenuePunkt symbol="ordner" onClick={aufloesen}>Ordner auflösen …</MenuePunkt>
        </Menue>
      </div>
      <div className="dehnen" />
      <div className="reihe klein matt" style={{ flexWrap: "wrap" }}>
        <span>{anzahl(drin.length, "Stapel", "Stapel")}</span>
        {faellig > 0 && <span className="marke gelb">{faellig} fällig</span>}
        {neu > 0 && <span className="marke">{neu} neu</span>}
      </div>
    </div>
  );
}
