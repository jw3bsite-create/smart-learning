/*
 * Bausteine, die überall gebraucht werden: Sinnbilder, Knöpfe, Dialoge,
 * Klappmenüs, Bildanzeige, Fortschrittsbalken.
 *
 * Wichtig: nichts hiervon darf innerhalb der Ausgabe einer anderen Komponente
 * definiert werden — sonst entstehen die Bauteile bei jeder Änderung neu und
 * verlieren ihren Zustand.
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import { bildUrl } from "../core/media.js";

/* ------------------------------ Sinnbilder ----------------------------- */

const PFADE = {
  ordner: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  stapel: "M4 7h13v11H4zM7 4h13v11",
  plus: "M12 5v14M5 12h14",
  suche: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3",
  zurueck: "M15 18l-6-6 6-6",
  weiter: "M9 6l6 6-6 6",
  hoch: "M6 15l6-6 6 6",
  runter: "M6 9l6 6 6-6",
  stern: "M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8z",
  stift: "M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z",
  muell: "M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13",
  mehr: "M6 12h.01M12 12h.01M18 12h.01",
  blitz: "M13 3L5 14h6l-1 7 8-11h-6z",
  haken: "M4 12.5l5 5L20 6.5",
  kreuz: "M6 6l12 12M18 6L6 18",
  raster: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  rakete: "M5 15c-1 2-1 4-1 4s2 0 4-1M9 15l-3-3 1.5-3A11 11 0 0 1 19 4a11 11 0 0 1-5 11.5L11 17z",
  laut: "M4 9v6h4l5 4V5L8 9zM17 9a4 4 0 0 1 0 6",
  frage: "M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z",
  griff: "M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01",
  sigma: "M18 5H6l6 7-6 7h12",
  mikro: "M12 15a4 4 0 0 0 4-4V7a4 4 0 0 0-8 0v4a4 4 0 0 0 4 4zM5 11a7 7 0 0 0 14 0M12 18v3",
  stopp: "M7 7h10v10H7z",
  abspielen: "M8 5l11 7-11 7z",
  bild: "M4 5h16v14H4zM4 15l4.5-4.5 4 4L16 11l4 4M9 9.5h.01",
  kamera: "M4 8h3l1.5-2h7L17 8h3v11H4zM12 16a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
  zahnrad: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.2a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.5 14H3a2 2 0 0 1 0-4h.1A1.6 1.6 0 0 0 4.6 7.2l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 2.8 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.2a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z",
  statistik: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  wolke: "M7 18a4 4 0 0 1 0-8 5.5 5.5 0 0 1 10.5 1.5A3.5 3.5 0 0 1 17 18z",
  mischen: "M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5",
  tauschen: "M7 4v13M7 4L4 7M7 4l3 3M17 20V7M17 20l3-3M17 20l-3-3",
  drucken: "M6 9V3h12v6M6 18H4v-6h16v6h-2M8 14h8v7H8z",
  herunter: "M12 3v12m0 0l-4-4m4 4l4-4M4 21h16",
  hinauf: "M12 21V9m0 0L8 13m4-4l4 4M4 3h16",
  sonne: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  mond: "M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z",
  balken: "M4 6h16M4 12h16M4 18h16",
  uhr: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  feuer: "M12 22c4 0 6-2.7 6-6 0-4-3-5-3-9 0 0-3 1.5-3 5 0-1.5-1-2.5-1-2.5S6 12 6 16c0 3.3 2 6 6 6z",
  buch: "M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 5.5v15",
  schreiben: "M4 20h16M6 16l9.5-9.5a2.1 2.1 0 0 0-3-3L3 13v3h3z",
  buchstaben: "M4 18l5-12 5 12M6 14h6M17 18V9M17 9c2 0 3 1 3 2s-1 2-3 2h-1",
  papier: "M6 2h8l4 4v16H6zM14 2v4h4",
  pfeilLinks: "M20 12H4m0 0l6-6m-6 6l6 6",
  pfeilRechts: "M4 12h16m0 0l-6-6m6 6l-6 6",
  zurueckSetzen: "M3 12a9 9 0 1 0 3-6.7M3 4v5h5",
  auge: "M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  papierkorb: "M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v6M14 11v6",
  abmelden: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  // Ein Wuerfel: Rahmen und drei Augen. Die Augen sind Strecken der Laenge
  // null — mit runden Enden zeichnet der Browser daraus Punkte.
  wuerfel: "M5 5h14v14H5zM8.5 8.5h.01M12 12h.01M15.5 15.5h.01",
};

export function Symbol({ name, groesse = 18, fuell = false, ...rest }) {
  const d = PFADE[name] || PFADE.stapel;
  return (
    <svg width={groesse} height={groesse} viewBox="0 0 24 24" fill={fuell ? "currentColor" : "none"}
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" style={{ flex: "none" }} {...rest}>
      <path d={d} />
    </svg>
  );
}

/* -------------------------------- Knöpfe ------------------------------- */

export function Knopf({ art = "", symbol, kinder, children, ...rest }) {
  return (
    <button className={"knopf " + art} {...rest}>
      {symbol && <Symbol name={symbol} />}
      {children || kinder}
    </button>
  );
}

export function SymbolKnopf({ symbol, titel, art = "leer klein", groesse = 18, ...rest }) {
  return (
    <button className={"knopf " + art} title={titel} aria-label={titel} {...rest}>
      <Symbol name={symbol} groesse={groesse} />
    </button>
  );
}

/* -------------------------------- Dialog ------------------------------- */

export function Dialog({ titel, kinder, children, fuss, aufSchliessen, weit = false, oben = false }) {
  useEffect(() => {
    const taste = (e) => { if (e.key === "Escape") { e.stopPropagation(); aufSchliessen?.(); } };
    window.addEventListener("keydown", taste, true);
    return () => window.removeEventListener("keydown", taste, true);
  }, [aufSchliessen]);

  return (
    <div className={"schleier" + (oben ? " oben" : "")}
      onMouseDown={(e) => { if (e.target === e.currentTarget) aufSchliessen?.(); }}>
      <div className={"dialog" + (weit ? " weit" : "")} onMouseDown={(e) => e.stopPropagation()}>
        <div className="dialog-kopf">
          <h2 style={{ flex: 1 }}>{titel}</h2>
          <SymbolKnopf symbol="kreuz" titel="Schließen" onClick={aufSchliessen} />
        </div>
        <div className="dialog-inhalt">{children || kinder}</div>
        {fuss && <div className="dialog-fuss">{fuss}</div>}
      </div>
    </div>
  );
}

/*
 * Ein Bedienhinweis hinter einem „?".
 *
 * Wer eine Leiste zum zehnten Mal öffnet, braucht nicht zum zehnten Mal den
 * Satz, wie sie funktioniert. Offen oder zu merkt sich das Gerät.
 */
export function Tipp({ kennung, children }) {
  const [offen, setOffen] = useMerker("tipp:" + kennung, false);
  return (
    <>
      <SymbolKnopf symbol="frage" titel={offen ? "Hinweis ausblenden" : "Hinweis einblenden"}
        art={"leer klein" + (offen ? " aktiv" : "")} aria-pressed={offen}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOffen((o) => !o)} />
      {offen && <div className="tipp-text klein matt">{children}</div>}
    </>
  );
}

/** Rückfrage vor unwiderruflichen Schritten. */
export function Rueckfrage({ titel, text, bestaetigung = "Löschen", aufJa, aufNein }) {
  return (
    <Dialog titel={titel} aufSchliessen={aufNein}
      fuss={<>
        <Knopf onClick={aufNein}>Abbrechen</Knopf>
        <Knopf art="voll" onClick={aufJa}>{bestaetigung}</Knopf>
      </>}>
      <div style={{ color: "var(--schrift-matt)" }}>{text}</div>
    </Dialog>
  );
}

/* ------------------------------- Klappmenü ----------------------------- */

export function Menue({ knopf, kinder, children, ausrichtung = "rechts" }) {
  const [offen, setOffen] = useState(false);
  const huelle = useRef(null);

  useEffect(() => {
    if (!offen) return;
    const zu = (e) => { if (!huelle.current?.contains(e.target)) setOffen(false); };
    const taste = (e) => { if (e.key === "Escape") setOffen(false); };
    document.addEventListener("mousedown", zu);
    window.addEventListener("keydown", taste);
    return () => { document.removeEventListener("mousedown", zu); window.removeEventListener("keydown", taste); };
  }, [offen]);

  return (
    <span ref={huelle} style={{ position: "relative", display: "inline-flex" }}>
      <span onClick={(e) => { e.stopPropagation(); setOffen((o) => !o); }}>{knopf}</span>
      {offen && (
        <div className="menue" style={{ top: "calc(100% + 6px)", [ausrichtung === "rechts" ? "right" : "left"]: 0 }}
          // Ohne das Anhalten liefe der Klick weiter an die Kachel darunter
          // und öffnete den Stapel, statt den Menüpunkt auszuführen.
          onClick={(e) => { e.stopPropagation(); setOffen(false); }}>
          {children || kinder}
        </div>
      )}
    </span>
  );
}

export function MenuePunkt({ symbol, children, gefahr = false, ...rest }) {
  return (
    <button style={gefahr ? { color: "var(--rot)" } : undefined} {...rest}>
      {symbol && <Symbol name={symbol} groesse={16} />}
      <span>{children}</span>
    </button>
  );
}

/* --------------------------------- Bild -------------------------------- */

/** Zeigt ein Bild aus der Ablage anhand seiner Kennung. */
export function Bild({ kennung, klasse = "karte-bild", stil, alt = "" }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let lebt = true;
    if (!kennung) { setUrl(null); return; }
    bildUrl(kennung).then((u) => { if (lebt) setUrl(u); });
    return () => { lebt = false; };
  }, [kennung]);
  if (!url) return null;
  return <img src={url} className={klasse} style={stil} alt={alt} />;
}

/* ----------------------------- Fortschritt ----------------------------- */

/** Balken aus vier Anteilen: neu, am Lernen, vertraut, beherrscht. */
export function Balken({ anteile, hoehe = 8 }) {
  const gesamt = Math.max(1, anteile.reduce((a, b) => a + b, 0));
  const klassen = ["neu", "lernen", "vertraut", "fest"];
  return (
    <div className="balken" style={{ height: hoehe }}>
      {anteile.map((wert, i) => (
        <span key={klassen[i]} className={klassen[i]}
          style={{ width: (100 * wert / gesamt) + "%" }} />
      ))}
    </div>
  );
}

export function Stern({ an, aufKlick, groesse = 18 }) {
  return (
    <button className={"stern" + (an ? " an" : "")} title={an ? "Markierung entfernen" : "Markieren"}
      onClick={(e) => { e.stopPropagation(); aufKlick?.(); }}>
      <Symbol name="stern" groesse={groesse} fuell={an} />
    </button>
  );
}

export function Leer({ symbol = "stapel", titel, text, kinder, children }) {
  return (
    <div className="leerer-zustand">
      <Symbol name={symbol} groesse={40} />
      <h2 style={{ marginTop: 12 }}>{titel}</h2>
      {text && <p style={{ maxWidth: 460, margin: "8px auto 18px" }}>{text}</p>}
      {children || kinder}
    </div>
  );
}

/* ------------------------------ Tastatur ------------------------------- */

/**
 * Lauscht auf Tasten. `karte` ist ein Verzeichnis von Taste zu Handlung.
 * Eingabefelder werden ausgespart, damit Tippen nicht zu Befehlen wird.
 */
export function useTastatur(karte, aktiv = true) {
  const merker = useRef(karte);
  merker.current = karte;
  useEffect(() => {
    if (!aktiv) return;
    const hoeren = (e) => {
      const ziel = e.target;
      const tippt = ziel && (ziel.tagName === "INPUT" || ziel.tagName === "TEXTAREA" ||
        ziel.isContentEditable);
      const handlung = merker.current[e.key] || merker.current[e.code];
      if (!handlung) return;
      if (tippt && !handlung.auchBeimTippen) return;
      const fn = typeof handlung === "function" ? handlung : handlung.fn;
      if (!fn) return;
      e.preventDefault();
      fn(e);
    };
    window.addEventListener("keydown", hoeren);
    return () => window.removeEventListener("keydown", hoeren);
  }, [aktiv]);
}

/** Merkt sich einen Wert im Browser (für Kleinigkeiten wie zuletzt genutzte Modi). */
export function useMerker(schluessel, standard) {
  const [wert, setWert] = useState(() => {
    try {
      const roh = localStorage.getItem("kk:" + schluessel);
      return roh === null ? standard : JSON.parse(roh);
    } catch (e) { return standard; }
  });
  const setzen = useCallback((neu) => {
    setWert((alt) => {
      const w = typeof neu === "function" ? neu(alt) : neu;
      try { localStorage.setItem("kk:" + schluessel, JSON.stringify(w)); } catch (e) {}
      return w;
    });
  }, [schluessel]);
  return [wert, setzen];
}
