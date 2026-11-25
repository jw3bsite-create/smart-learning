/*
 * Punkte der Kursstufe.
 *
 * Vier Halbjahre, je Halbjahr die Fächer, je Fach die einzelnen Leistungen —
 * schriftlich, mündlich, praktisch, jede mit eigenem Gewicht.
 *
 * Warum das in einer Lern-App steht: Der Lernstand sagt, wie gut eine Karte
 * sitzt; die Punkte sagen, ob das Lernen ankommt. Nebeneinander sieht man,
 * was man an keiner der beiden Zahlen allein sieht — dass ein Fach fleißig
 * geübt wird und trotzdem abrutscht, oder dass das Fach ohne eine einzige
 * Karte am besten läuft.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useDaten } from "../core/store.jsx";
import {
  HALBJAHRE, ARTEN, ART_IDS, PUNKTE_MAX,
  fachPunkte, halbjahrSchnitt, uebersicht, verlaufVon,
  faecherIm, punkteText, noteText, punkteStufe,
  sortenVon, neueSorte, gewichtVon, leistungsName, naechsteArbeit, halbjahrBedarf, halbjahrZiel, zahlZeigen, uebernahmeVorschlaege,
} from "../core/noten.js";
import { SymbolKnopf, Knopf, Leer, Dialog, Rueckfrage, HilfeLink } from "./basis.jsx";
import ZahlFeld from "./ZahlFeld.jsx";
import { AbiZiel, HalbjahrZiel, useZiele, laufendesHalbjahr } from "./Ziele.jsx";
import { anzahl } from "../core/util.js";

/* ----------------------------- Kleinteile ------------------------------ */

const STUFEN_FARBE = {
  gut: "var(--gruen)",
  solide: "var(--akzent)",
  wacklig: "var(--gelb)",
  schlecht: "var(--rot)",
  leer: "var(--schrift-blass)",
};

/** Eine Punktzahl, in der Farbe ihrer Lage. */
function Punkte({ wert, gross = false }) {
  const farbe = STUFEN_FARBE[punkteStufe(wert)];
  return (
    <span style={{
      color: farbe, fontFamily: "var(--schrift-karten)",
      fontSize: gross ? 26 : 17, fontWeight: 600,
    }}>
      {punkteText(wert)}
      <span className="klein blass" style={{ fontWeight: 400 }}>
        {wert === null ? "" : " P"}
      </span>
    </span>
  );
}

/** Ein Balken von null bis fünfzehn Punkten. */
function Leiste({ wert }) {
  if (wert === null || wert === undefined) return null;
  return (
    <div className="balken" style={{ height: 6 }}>
      <span style={{
        width: (100 * wert / PUNKTE_MAX) + "%",
        background: STUFEN_FARBE[punkteStufe(wert)],
      }} />
    </div>
  );
}

/* ------------------------- Ein Fach im Halbjahr ------------------------- */

/**
 * Was das Fach fürs Halbjahresziel braucht: ohne Note den Ausgleich, den das
 * Halbjahr verlangt; mit Note die Punktzahl der nächsten Klassenarbeit.
 */
function Bedarf({ notenfach, ziel, offeneBrauchen }) {
  if (ziel === null || ziel === undefined) return null;
  const stand = fachPunkte(notenfach);
  if (stand.punkte === null) {
    if (offeneBrauchen === null || offeneBrauchen === undefined) return null;
    return (
      <span className="bedarf">
        {offeneBrauchen > PUNKTE_MAX ? "braucht mehr als 15 P"
          : offeneBrauchen <= 0 ? "Ziel auch ohne dieses Fach"
            : "braucht etwa " + punkteText(Math.ceil(offeneBrauchen * 2) / 2) + " P"}
      </span>
    );
  }
  const n = naechsteArbeit(notenfach, ziel);
  if (!n) return null;
  if (n.sicher || stand.punkte >= ziel) return <span className="bedarf gut">auf Kurs</span>;
  if (n.unerreichbar) return <span className="bedarf">Ziel mit einer {n.name} nicht mehr erreichbar</span>;
  return <span className="bedarf">nächste {n.name}: {n.punkte} P</span>;
}

function FachZeile({ notenfach, aufOeffnen, ziel = null, offeneBrauchen = null }) {
  const stand = fachPunkte(notenfach);
  return (
    <div className="karten-zeile" style={{ display: "block", padding: 14, cursor: "pointer" }}
      onClick={aufOeffnen}>
      <div className="reihe unten-8">
        <div className="dehnen" style={{ fontFamily: "var(--schrift-karten)", fontSize: 17 }}>
          {notenfach.fach || "Ohne Namen"}
        </div>
        {stand.vonHand !== null && (
          <span className="marke" title="Von Hand gesetzt: sticht die Rechnung">
            Zeugnis
          </span>
        )}
        <Punkte wert={stand.punkte} />
      </div>
      <Leiste wert={stand.punkte} />
      <div className="reihe klein blass" style={{ marginTop: 6, gap: 12, flexWrap: "wrap" }}>
        {ART_IDS.filter((a) => stand.proArt[a] !== null).map((a) => (
          <span key={a}>{ARTEN[a].name}: {punkteText(stand.proArt[a])}</span>
        ))}
        {stand.anzahl === 0 && <span>noch keine Leistung eingetragen</span>}
        <Bedarf notenfach={notenfach} ziel={ziel} offeneBrauchen={offeneBrauchen} />
      </div>
    </div>
  );
}

/* --------------------------- Eine Leistung ----------------------------- */

/**
 * Eine Leistung. Frisch eingetragen steht sie gleich offen, mit dem Finger
 * im Punktefeld. Die Sorte (Klassenarbeit, Test …) bringt das Gewicht mit;
 * nur ohne Sorte gibt es ein eigenes Gewichtsfeld. Die Bezeichnung zählt
 * sich selbst durch, solange man keine eigene einträgt.
 */
function LeistungZeile({ notenfach, leistung, anfangsOffen = false, aufAendern, aufLoeschen }) {
  const [offen, setOffen] = useState(anfangsOffen);
  /* Die Zeile erscheint oft, bevor sie als neu markiert ist — dann erst jetzt öffnen. */
  const zeile = useRef(null);
  useEffect(() => {
    if (!anfangsOffen) return;
    setOffen(true);
    requestAnimationFrame(() => zeile.current?.scrollIntoView?.({ block: "center", behavior: "smooth" }));
  }, [anfangsOffen]);
  const sorten = sortenVon(notenfach);
  const passend = sorten.filter((x) => x.art === leistung.art);
  const sorte = sorten.find((x) => x.id === leistung.sorte) || null;
  const gewicht = gewichtVon(leistung, sorten);
  const name = leistungsName(notenfach, leistung);
  const vorschlag = leistungsName(notenfach, { ...leistung, was: "" });

  return (
    <div ref={zeile} className="karten-zeile" style={{ display: "block", padding: "10px 14px" }}>
      <div className="reihe" onClick={() => setOffen((w) => !w)} style={{ cursor: "pointer" }}>
        <span className="marke">{ARTEN[leistung.art]?.kurz || "?"}</span>
        <div className="dehnen klein">
          {name}
          {gewicht !== 1 && <span className="blass"> · Gewicht {zahlZeigen(gewicht)}</span>}
        </div>
        {leistung.punkte === null || leistung.punkte === undefined
          ? <span className="klein blass">offen</span>
          : <Punkte wert={leistung.punkte} />}
        <SymbolKnopf symbol={offen ? "haken" : "stift"} titel={offen ? "Fertig" : "Ändern"} art="leer klein"
          onClick={(e) => { e.stopPropagation(); setOffen((w) => !w); }} />
        <SymbolKnopf symbol="muell" titel="Entfernen" art="leer klein"
          onClick={(e) => { e.stopPropagation(); aufLoeschen(); }} />
      </div>
      {offen && (
        <div className="oben-12">
          <div className="reihe umbruch unten-12" style={{ gap: 6 }}>
            {passend.map((x) => (
              <button key={x.id} type="button"
                className={"knopf klein" + (sorte?.id === x.id ? " voll" : "")}
                onClick={() => aufAendern({ sorte: x.id, gewicht: x.gewicht })}>
                {x.name || "Ohne Namen"}
                <span style={{ opacity: 0.7 }}> · {zahlZeigen(x.gewicht)}</span>
              </button>
            ))}
            <button type="button" className={"knopf klein" + (!sorte ? " voll" : "")}
              onClick={() => aufAendern({ sorte: null })}>
              {passend.length ? "Andere" : ARTEN[leistung.art]?.name}
            </button>
          </div>
          <div className="gitter" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))" }}>
            <label className="beschriftung">Punkte (0–15)
              <ZahlFeld wert={leistung.punkte} min={0} max={PUNKTE_MAX} leerErlaubt
                placeholder="—" autoFocus={anfangsOffen}
                aufAendern={(p) => aufAendern({ punkte: p })} />
            </label>
            {!sorte && (
              <label className="beschriftung">Gewicht
                <ZahlFeld wert={leistung.gewicht} min={0}
                  aufAendern={(g) => aufAendern({ gewicht: g })} />
              </label>
            )}
            <label className="beschriftung">Bezeichnung
              <input className="feld" value={leistung.was} placeholder={vorschlag}
                onChange={(e) => aufAendern({ was: e.target.value })} />
            </label>
            <label className="beschriftung">Art
              <select className="feld" value={leistung.art}
                onChange={(e) => {
                  const art = e.target.value;
                  const erste = sorten.find((x) => x.art === art);
                  aufAendern(erste ? { art, sorte: erste.id, gewicht: erste.gewicht } : { art, sorte: null });
                }}>
                {ART_IDS.map((a) => <option key={a} value={a}>{ARTEN[a].name}</option>)}
              </select>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------- Klassenarbeit, Test & Co. ------------------------ */

/**
 * Die Sorten eines Fachs mit ihren Gewichten. Ein geändertes Gewicht wirkt
 * auf alle Leistungen dieser Sorte. Wird eine Sorte gelöscht, behalten ihre
 * Leistungen Gewicht und Namen.
 */
function SortenTeil({ notenfach }) {
  const { notenfaecher, notenfachAendern } = useDaten();
  const [verteilt, setVerteilt] = useState(null);
  const sorten = sortenVon(notenfach);
  const andere = faecherIm(notenfaecher, notenfach.halbjahr).filter((f) => f.id !== notenfach.id);

  const setzen = (neu) => notenfachAendern(notenfach.id, { sorten: neu });
  const aendern = (sid, aend) => setzen(sorten.map((x) => (x.id === sid ? { ...x, ...aend } : x)));
  const loeschen = (sid) => {
    const weg = sorten.find((x) => x.id === sid);
    notenfachAendern(notenfach.id, {
      sorten: sorten.filter((x) => x.id !== sid),
      leistungen: (notenfach.leistungen || []).map((l) => (l.sorte === sid
        ? { ...l, sorte: null, gewicht: weg.gewicht, was: leistungsName(notenfach, l) }
        : l)),
    });
  };
  const fuerAlle = async () => {
    for (const f of andere) await notenfachAendern(f.id, { sorten: sorten.map((x) => ({ ...x })) });
    setVerteilt(andere.length);
  };

  return (
    <>
      <h3 className="unten-4">Klassenarbeit, Test &amp; Co. <HilfeLink frage="sorten" /></h3>
      <p className="klein matt oben-0 erklaerung">
        Jede Sorte hat ein Gewicht innerhalb ihrer Art. Klassenarbeit 1 und
        Test 0,5 heißt: Zwei Tests zählen so viel wie eine Klassenarbeit.
        Ändern wirkt auf alle Leistungen dieser Sorte.
      </p>
      {ART_IDS.map((art) => {
        const eigene = sorten.filter((x) => x.art === art);
        return (
          <div key={art} className="unten-12">
            <div className="reihe unten-4">
              <span className="dehnen klein matt">{ARTEN[art].name}</span>
              {eigene.length > 0 && <span className="klein blass" style={{ width: 76 }}>Gewicht</span>}
              <SymbolKnopf symbol="plus" titel={"Sorte für " + ARTEN[art].name} art="leer klein"
                onClick={() => setzen([...sorten, neueSorte({ art })])} />
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              {eigene.map((x) => (
                <div key={x.id} className="reihe" style={{ gap: 8 }}>
                  <input className="feld dehnen" style={{ minWidth: 0 }} value={x.name}
                    placeholder="z. B. GFS" aria-label="Name der Sorte"
                    onChange={(e) => aendern(x.id, { name: e.target.value })} />
                  <div style={{ flex: "0 0 76px" }}>
                    <ZahlFeld wert={x.gewicht} min={0} aria-label={"Gewicht " + (x.name || "der Sorte")}
                      aufAendern={(g) => aendern(x.id, { gewicht: g })} />
                  </div>
                  <SymbolKnopf symbol="muell" titel="Sorte entfernen" art="leer klein"
                    onClick={() => loeschen(x.id)} />
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <div className="reihe umbruch unten-24" style={{ gap: 8 }}>
        {andere.length > 0 && (
          <Knopf art="klein leer" onClick={fuerAlle}>
            {verteilt !== null ? "Für " + anzahl(verteilt, "Fach", "Fächer") + " übernommen"
              : "Für alle Fächer dieses Halbjahres übernehmen"}
          </Knopf>
        )}
      </div>
    </>
  );
}

/* --------------------------- Ein Fach im Ganzen ------------------------- */

function FachAnsicht({ notenfach, aufSchliessen }) {
  const {
    notenfaecher, faecher, notenfachAendern, notenfachLoeschen,
    leistungAnlegen, leistungAendern, leistungLoeschen,
  } = useDaten();
  const [loeschen, setLoeschen] = useState(false);
  const [neu, setNeu] = useState(null);

  /* Neu eintragen: mit der ersten passenden Sorte (schriftlich also
     Klassenarbeit), ohne Punkte, und gleich offen zum Eintippen. */
  const eintragen = async (art) => {
    const erste = sortenVon(notenfach).find((x) => x.art === art);
    const l = await leistungAnlegen(notenfach.id, erste ? { art, sorte: erste.id, gewicht: erste.gewicht } : { art });
    setNeu(l.id);
  };

  const stand = fachPunkte(notenfach);
  const verlauf = useMemo(
    () => verlaufVon(notenfaecher, notenfach.fach), [notenfaecher, notenfach.fach]);
  const halbjahr = HALBJAHRE.find((h) => h.id === notenfach.halbjahr);

  return (
    <div className="mitte">
      <div className="kopfzeile">
        <SymbolKnopf symbol="zurueck" titel="Zurück" art="leer" onClick={aufSchliessen} />
        <div className="dehnen">
          <h1 className="unten-4">{notenfach.fach}</h1>
          <div className="klein matt">{halbjahr?.name}</div>
        </div>
        <Punkte wert={stand.punkte} gross />
      </div>

      {/* ------------------------- Der Verlauf --------------------------- */}
      {verlauf.some((v) => v.punkte !== null) && (
        <div className="zahl-kachel unten-24">
          <div className="klein matt unten-12">
            Dieses Fach über die Halbjahre
          </div>
          <div className="reihe" style={{ gap: 16, flexWrap: "wrap" }}>
            {verlauf.map((v) => (
              <div key={v.halbjahr} style={{ minWidth: 74 }}>
                <div className="klein blass">{v.halbjahr}</div>
                <Punkte wert={v.punkte} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------- Die Leistungen ------------------------ */}
      {ART_IDS.map((art) => {
        const eigene = (notenfach.leistungen || []).filter((l) => l.art === art);
        return (
          <div className="unten-24" key={art}>
            <div className="reihe unten-8">
              <h3 className="dehnen">{ARTEN[art].name}</h3>
              {stand.proArt[art] !== null && <Punkte wert={stand.proArt[art]} />}
              <Knopf art="klein" symbol="plus" onClick={() => eintragen(art)}>
                Eintragen
              </Knopf>
            </div>
            {eigene.length === 0 ? (
              <div className="klein blass">Nichts eingetragen.</div>
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                {eigene.map((l) => (
                  <LeistungZeile key={l.id} leistung={l} notenfach={notenfach}
                    anfangsOffen={l.id === neu}
                    aufAendern={(aend) => leistungAendern(notenfach.id, l.id, aend)}
                    aufLoeschen={() => leistungLoeschen(notenfach.id, l.id)} />
                ))}
              </div>
            )}
          </div>
        );
      })}

      <SortenTeil notenfach={notenfach} />

      {/* -------------------------- Gewichtung --------------------------- */}
      <h3 className="unten-4">Wie die Arten zählen <HilfeLink frage="punkte-schnitt" /></h3>
      <p className="klein matt oben-0 erklaerung">
        Erst wird je Art gemittelt, dann werden die Arten nach diesen Zahlen
        zusammengefasst. Was an deiner Schule gilt, weiß die App nicht, darum
        stehen alle drei auf eins, bis du es änderst. Eine Art ohne Leistungen
        zählt nicht mit.
      </p>
      <div className="reihe umbruch unten-24">
        {ART_IDS.map((art) => (
          <label key={art} className="beschriftung" style={{ minWidth: 110 }}>
            {ARTEN[art].name}
            <ZahlFeld wert={notenfach.artGewicht?.[art] ?? 1} min={0}
              aufAendern={(g) => notenfachAendern(notenfach.id, {
                artGewicht: { ...notenfach.artGewicht, [art]: g },
              })} />
          </label>
        ))}
      </div>

      {/* ------------------------- Zeugnispunkte ------------------------- */}
      <h3 className="unten-4">Punkte auf dem Zeugnis</h3>
      <p className="klein matt oben-0 erklaerung">
        Steht hier eine Zahl, gilt sie statt der Rechnung, am Ende zählt, was
        der Lehrer eingetragen hat, nicht was wir uns ausgerechnet haben.
        {stand.gerechnet !== null && (
          <> Gerechnet wären es <strong>{punkteText(stand.gerechnet)}</strong>.</>
        )}
      </p>
      <div className="reihe unten-24">
        <div style={{ width: 120 }}>
          <ZahlFeld wert={notenfach.endpunkte ?? null} min={0} max={PUNKTE_MAX} leerErlaubt
            placeholder="—"
            aufAendern={(p) => notenfachAendern(notenfach.id, { endpunkte: p })} />
        </div>
        {notenfach.endpunkte !== null && notenfach.endpunkte !== undefined && (
          <Knopf art="klein leer"
            onClick={() => notenfachAendern(notenfach.id, { endpunkte: null })}>
            Wieder rechnen lassen
          </Knopf>
        )}
      </div>

      {/* ------------------------- Lernfach dazu ------------------------- */}
      {faecher.length > 0 && (
        <>
          <h3 className="unten-4">Zugehöriges Lernfach</h3>
          <p className="klein matt oben-0 erklaerung">
            Verknüpft, erscheinen die Punkte auch beim Fortschritt neben dem
            Lernstand, dort sieht man, ob das Üben ankommt.
          </p>
          <select className="feld" style={{ maxWidth: 320, marginBottom: 26 }}
            value={notenfach.subjectId || ""}
            onChange={(e) => notenfachAendern(notenfach.id,
              { subjectId: e.target.value || null })}>
            <option value="">(keines)</option>
            {faecher.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </>
      )}

      <div className="reihe">
        <Knopf symbol="muell" onClick={() => setLoeschen(true)}>Fach entfernen</Knopf>
      </div>

      {loeschen && (
        <Rueckfrage titel={"„" + notenfach.fach + "“ entfernen?"}
          text="Die eingetragenen Leistungen dieses Halbjahres gehen mit."
          bestaetigung="Entfernen"
          aufNein={() => setLoeschen(false)}
          aufJa={async () => {
            await notenfachLoeschen(notenfach.id);
            aufSchliessen();
          }} />
      )}
    </div>
  );
}

/* ------------------------------ Übersicht ------------------------------ */

export default function Noten() {
  const { notenfaecher, notenfachAnlegen, faecher } = useDaten();
  const { einstellungen, setzeEinstellung } = useDaten();
  /* Öffnet beim laufenden Halbjahr. Ein Tipp auf ein Halbjahr legt es als
     laufendes fest — für Ziele, Startseite und das nächste Öffnen. */
  const [halbjahr, setHalbjahrLokal] = useState(() =>
    laufendesHalbjahr(notenfaecher, einstellungen.aktuellesHalbjahr).id);
  const setHalbjahr = (id) => { setHalbjahrLokal(id); setzeEinstellung("aktuellesHalbjahr", id); };
  const [ziele] = useZiele();
  const [offen, setOffen] = useState(null);
  const [anlegen, setAnlegen] = useState(false);
  const [neuerName, setNeuerName] = useState("");
  const [uebernahme, setUebernahme] = useState(null);   // Set der gewählten Namen, offen = nicht null

  const alles = useMemo(() => uebersicht(notenfaecher), [notenfaecher]);
  const vorschlaege = useMemo(() => uebernahmeVorschlaege(notenfaecher, halbjahr, faecher),
    [notenfaecher, halbjahr, faecher]);
  const dasFach = offen ? notenfaecher.find((n) => n.id === offen) : null;

  if (dasFach) {
    return <FachAnsicht notenfach={dasFach} aufSchliessen={() => setOffen(null)} />;
  }

  const gewaehlt = alles.halbjahre.find((h) => h.id === halbjahr);
  const halbjahrZielWert = halbjahrZiel(notenfaecher, halbjahr, ziele).wert;
  const bedarf = gewaehlt ? halbjahrBedarf(gewaehlt.faecher, halbjahrZielWert) : null;
  const herkunftText = (v) => (v.herkunft === "lernfach" ? "aus deinen Lernfächern"
    : "aus " + (HALBJAHRE.find((h) => h.id === v.herkunft)?.name || v.herkunft));

  /* Ein Fach anlegen — aus einem Vorschlag samt Sorten und Gewichten, oder
     nur mit Namen; dann wird es mit dem gleichnamigen Lernfach verknüpft. */
  const ausVorlage = (v) => notenfachAnlegen({
    halbjahr, fach: v.fach, subjectId: v.subjectId, sorten: v.sorten, artGewicht: v.artGewicht,
  });
  const anlegenAusfuehren = async (name) => {
    const sauber = String(name || "").trim();
    if (!sauber) return;
    const vorlage = vorschlaege.find((v) => v.fach.toLowerCase() === sauber.toLowerCase());
    const n = vorlage ? await ausVorlage(vorlage) : await notenfachAnlegen({ halbjahr, fach: sauber,
      subjectId: faecher.find((f) => !f.deleted && (f.name || "").trim().toLowerCase() === sauber.toLowerCase())?.id || null });
    setAnlegen(false); setNeuerName("");
    setOffen(n.id);
  };
  const uebernehmenAusfuehren = async () => {
    for (const v of vorschlaege) if (uebernahme.has(v.fach)) await ausVorlage(v);
    setUebernahme(null);
  };
  const uebernahmeOeffnen = () => setUebernahme(new Set(
    vorschlaege.filter((v) => v.herkunft !== "lernfach" || !vorschlaege.some((w) => w.herkunft !== "lernfach"))
      .map((v) => v.fach)));

  return (
    <div className="mitte">
      <div className="kopfzeile">
        <h1>Punkte</h1>
        <div className="kopf-werkzeuge">
          {vorschlaege.length > 0 && (
            <Knopf symbol="herunter" onClick={uebernahmeOeffnen}>Übernehmen</Knopf>
          )}
          <Knopf art="voll" symbol="plus" onClick={() => setAnlegen(true)}>Fach</Knopf>
        </div>
      </div>

      {/* ------------------------ Das große Ziel ------------------------- */}
      <AbiZiel />

      {/* --------------------------- Der Schnitt -------------------------- */}
      {alles.gesamt && (
        <div className="gitter"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", marginBottom: 24 }}>
          <div className="zahl-kachel">
            <div className="klein matt">Schnitt über alles</div>
            <Punkte wert={alles.gesamt.punkte} gross />
            <div className="klein blass">
              aus {alles.gesamt.leistungen} Halbjahresleistungen
            </div>
          </div>
          <div className="zahl-kachel">
            <div className="klein matt">Umgerechnet</div>
            <div className="zahl">{noteText(alles.gesamt.punkte)}</div>
            <div className="klein blass">nach der üblichen Formel</div>
          </div>
        </div>
      )}

      {/* -------------------------- Die Halbjahre ------------------------- */}
      <div className="reihe umbruch" style={{ marginBottom: 18, gap: 8 }}>
        {alles.halbjahre.map((h) => (
          <button key={h.id}
            className={"knopf klein" + (h.id === halbjahr ? " voll" : "")}
            onClick={() => setHalbjahr(h.id)}>
            {h.stufe} · {h.kurz}
            {h.schnitt !== null && (
              <span className="klein" style={{ opacity: 0.75 }}>
                {" "}· {punkteText(h.schnitt)}
              </span>
            )}
          </button>
        ))}
      </div>

      {gewaehlt && (gewaehlt.faecher.length > 0 || halbjahrZielWert !== null) && (
        <div className="zahl-kachel unten-16">
          <div className="reihe">
            <div className="dehnen klein matt">
              {gewaehlt.faecher.length > 0
                ? <>Schnitt in {gewaehlt.name} · {anzahl(gewaehlt.anzahl, "Fach", "Fächer")}</>
                : gewaehlt.name}
            </div>
            {gewaehlt.faecher.length > 0 && <>
              <Punkte wert={gewaehlt.schnitt} />
              <span className="klein blass">≙ {noteText(gewaehlt.schnitt)}</span>
            </>}
          </div>
          <HalbjahrZiel halbjahr={gewaehlt.id} schnitt={gewaehlt.schnitt} />
        </div>
      )}

      {!gewaehlt || gewaehlt.faecher.length === 0 ? (
        <Leer symbol="statistik" titel="Noch keine Fächer in diesem Halbjahr"
          text={vorschlaege.length ? "Übernimm deine Fächer oder leg sie einzeln an." : "Leg deine Fächer an."}>
          <div className="reihe umbruch" style={{ justifyContent: "center", gap: 8 }}>
            {vorschlaege.length > 0 && (
              <Knopf art="voll gross" symbol="herunter" onClick={uebernahmeOeffnen}>
                Fächer übernehmen
              </Knopf>
            )}
            <Knopf art={vorschlaege.length ? "gross" : "voll gross"} symbol="plus" onClick={() => setAnlegen(true)}>
              {vorschlaege.length ? "Einzeln anlegen" : "Erstes Fach anlegen"}
            </Knopf>
          </div>
        </Leer>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {gewaehlt.faecher.map((f) => (
            <FachZeile key={f.id} notenfach={f} aufOeffnen={() => setOffen(f.id)}
              ziel={halbjahrZielWert} offeneBrauchen={bedarf?.offeneBrauchen ?? null} />
          ))}
        </div>
      )}

      {/* ---------------------------- Der Hinweis ------------------------- */}
      <p className="klein blass" style={{ marginTop: 28 }}>
        Ein Richtwert, <strong>nicht</strong> die Abiturnote.
        <HilfeLink frage="punkte-schnitt" titel="Wie werden die Punkte gerechnet?" />
      </p>

      {anlegen && (
        <Dialog titel={"Fach in " + (gewaehlt?.name || "")}
          aufSchliessen={() => setAnlegen(false)}
          fuss={<>
            <Knopf onClick={() => setAnlegen(false)}>Abbrechen</Knopf>
            <Knopf art="voll" onClick={() => anlegenAusfuehren(neuerName)}>Anlegen</Knopf>
          </>}>
          <label className="beschriftung">Name des Fachs</label>
          <input className="feld" autoFocus value={neuerName}
            placeholder="Mathematik"
            onChange={(e) => setNeuerName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") anlegenAusfuehren(neuerName); }} />
          {vorschlaege.length > 0 && (
            <>
              <div className="klein matt" style={{ margin: "14px 0 6px" }}>
                Oder antippen:
              </div>
              <div className="reihe umbruch">
                {vorschlaege.map((v) => (
                  <Knopf key={v.fach} art="klein" onClick={() => anlegenAusfuehren(v.fach)}>{v.fach}</Knopf>
                ))}
              </div>
            </>
          )}
        </Dialog>
      )}

      {uebernahme && (
        <Dialog titel={"Fächer übernehmen in " + (gewaehlt?.name || "")}
          aufSchliessen={() => setUebernahme(null)}
          fuss={<>
            <Knopf onClick={() => setUebernahme(null)}>Abbrechen</Knopf>
            <Knopf art="voll" disabled={!uebernahme.size} onClick={uebernehmenAusfuehren}>
              {uebernahme.size ? anzahl(uebernahme.size, "Fach", "Fächer") + " übernehmen" : "Übernehmen"}
            </Knopf>
          </>}>
          <p className="klein matt oben-0">
            Übernommen werden Name, Sorten mit ihren Gewichten und die
            Verknüpfung zum Lernfach, keine Punkte.
          </p>
          <div className="reihe unten-8" style={{ gap: 8 }}>
            <Knopf art="klein leer" onClick={() => setUebernahme(new Set(vorschlaege.map((v) => v.fach)))}>Alle</Knopf>
            <Knopf art="klein leer" onClick={() => setUebernahme(new Set())}>Keines</Knopf>
          </div>
          <div style={{ display: "grid", gap: 2 }}>
            {vorschlaege.map((v) => (
              <label key={v.fach} className="schalter">
                <input type="checkbox" checked={uebernahme.has(v.fach)}
                  onChange={(e) => setUebernahme((alt) => {
                    const neu = new Set(alt);
                    if (e.target.checked) neu.add(v.fach); else neu.delete(v.fach);
                    return neu;
                  })} />
                <span>{v.fach} <span className="klein blass">· {herkunftText(v)}</span></span>
              </label>
            ))}
          </div>
        </Dialog>
      )}
    </div>
  );
}

/* ===================================================================== */
/*  Für andere Seiten                                                    */
/* ===================================================================== */

/**
 * Die Punkte eines Lernfachs, über alle Halbjahre und im jüngsten.
 * Wird auf der Fortschrittsseite neben den Lernstand gestellt.
 */
export function punkteZuLernfach(notenfaecher, subjectId) {
  const eigene = (notenfaecher || [])
    .filter((n) => n && !n.deleted && n.subjectId === subjectId);
  if (!eigene.length) return null;
  const mitPunkten = eigene
    .map((n) => ({ halbjahr: n.halbjahr, punkte: fachPunkte(n).punkte }))
    .filter((x) => x.punkte !== null)
    .sort((a, b) => a.halbjahr.localeCompare(b.halbjahr));
  if (!mitPunkten.length) return null;
  return {
    schnitt: mitPunkten.reduce((s, x) => s + x.punkte, 0) / mitPunkten.length,
    juengste: mitPunkten[mitPunkten.length - 1],
    anzahl: mitPunkten.length,
  };
}

export { halbjahrSchnitt };
