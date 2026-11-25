import React, { useEffect, useState } from "react";
import { zahlLesen, zahlZeigen } from "../core/noten.js";

/**
 * Ein Zahlenfeld, das Kommazahlen versteht.
 *
 * `type="number"` taugt dafür nicht: Am iPhone fehlt je nach Tastatur das
 * Komma, und wo es da ist, macht der Browser aus „0,5“ mal nichts, mal eine 5.
 * Darum ein Textfeld mit Dezimaltastatur, das seinen getippten Text behält,
 * bis man es verlässt — so bleibt „0,“ beim Tippen stehen, statt zur 0 zu
 * werden.
 */
export default function ZahlFeld({ wert, aufAendern, min = 0, max = Infinity, leerErlaubt = false, ...rest }) {
  const [text, setText] = useState(zahlZeigen(wert));
  const [aktiv, setAktiv] = useState(false);
  useEffect(() => { if (!aktiv) setText(zahlZeigen(wert)); }, [wert, aktiv]);
  return (
    <input className="feld" type="text" inputMode="decimal" autoComplete="off" enterKeyHint="done"
      value={text}
      onFocus={(e) => { setAktiv(true); e.target.select(); }}
      onBlur={() => { setAktiv(false); setText(zahlZeigen(wert)); }}
      onChange={(e) => {
        const roh = e.target.value.replace(/[^\d.,-]/g, "");
        setText(roh);
        if (!roh.trim()) { if (leerErlaubt) aufAendern(null); return; }
        const n = zahlLesen(roh);
        if (n !== null) aufAendern(Math.min(max, Math.max(min, n)));
      }}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
      {...rest} />
  );
}
