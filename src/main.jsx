import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { DatenSpeicher } from "./core/store.jsx";
import Auffanglinie from "./ui/Auffanglinie.jsx";
import * as wolke from "./core/cloud.js";
import { dienstArbeiterEinrichten } from "./core/aktualisierung.js";
import { umzugAusLink, umzugMerken } from "./core/umzug.js";
import "./ui/stil.css";

/* Die Auffanglinie liegt außen: Stürzt der Datenspeicher selbst ab, greift sie
   immer noch — und kann die Daten unmittelbar aus der Datenbank sichern. */
/*
 * Rueckkehr aus einer Mail von Supabase (Bestaetigung, Passwort vergessen).
 * Erkannt wird vor dem ersten Zeichnen, solange die Anmeldung noch in der
 * Adresse steht; verarbeitet danach — siehe rueckkehrVerarbeiten in cloud.js.
 */
const rueckkehr = wolke.anmeldeRueckkehrLesen(window.location.hash);
if (rueckkehr) wolke.rueckkehrMerken(rueckkehr, false);

/* Einrichtungs-Link von einem anderen Gerät: Adresse und Schlüssel
   übernehmen, ehe die Einstellungen gezeichnet werden. */
/* Umzug vom PC (core/umzug.js): die mitgebrachten Zahlen merken, damit die
   neue Fassung nach dem Abgleich prüfen kann, ob alles angekommen ist. */
const umzugSoll = umzugAusLink(window.location.search);
if (umzugSoll) umzugMerken(umzugSoll);

const ausLink = wolke.zugangAusLink(window.location.search);
if (ausLink) wolke.zugangUebernehmen(ausLink);
else if (umzugSoll) window.history.replaceState(window.history.state, "", window.location.pathname + "#/einstellungen");

/*
 * iPhone: Nach dem Schließen der Tastatur bleibt die sichtbare Fläche manchmal
 * verschoben, und feste Leisten (unten die Fußleiste) stehen zu hoch, bis man
 * scrollt. Ein Schubs ohne Bewegung rückt sie zurück (25.11.2026, gemeldet
 * aus den Einstellungen).
 */
document.addEventListener("focusout", (e) => {
  const t = e.target;
  if (!t || !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
  setTimeout(() => {
    const aktiv = document.activeElement;
    if (aktiv && /^(INPUT|TEXTAREA|SELECT)$/.test(aktiv.tagName)) return;   // nächstes Feld
    window.scrollTo(window.scrollX, window.scrollY);
  }, 120);
});

/*
 * Antippen abbrechen, indem man den Finger wegzieht (Wunsch des Nutzers,
 * 26.11.2026): Gedrückt gibt eine Kachel nach — zieht man den Finger von ihr
 * weg und lässt los, soll sie sich nicht öffnen, wie bei echten Knöpfen.
 * Gilt für Berührungen; ein Klick mit der Maus bleibt, wie er ist.
 */
let druck = null;
document.addEventListener("pointerdown", (e) => {
  if (e.pointerType !== "touch") { druck = null; return; }
  const ziel = e.target.closest?.("button, a, [role=button], .kachel, .listenzeile, .baum-zeile, .einstellungs-zeile");
  druck = ziel ? { ziel, x: e.clientX, y: e.clientY, weg: false } : null;
}, true);
document.addEventListener("pointermove", (e) => {
  if (!druck || e.pointerType !== "touch") return;
  const r = druck.ziel.getBoundingClientRect();
  const rand = 10;
  const draussen = e.clientX < r.left - rand || e.clientX > r.right + rand
    || e.clientY < r.top - rand || e.clientY > r.bottom + rand;
  if (draussen) { druck.weg = true; druck.ziel.classList.add("druck-weg"); }
}, true);
document.addEventListener("click", (e) => {
  if (druck?.weg && druck.ziel.contains(e.target)) { e.preventDefault(); e.stopPropagation(); }
  if (druck) druck.ziel.classList.remove("druck-weg");
  druck = null;
}, true);
document.addEventListener("pointerup", () => {
  const d = druck;
  /* Kommt nach dem Loslassen kein Klick (weil der Finger woanders war), räumen. */
  setTimeout(() => { if (d && druck === d) { d.ziel.classList.remove("druck-weg"); druck = null; } }, 400);
}, true);
document.addEventListener("pointercancel", () => { if (druck) druck.ziel.classList.remove("druck-weg"); druck = null; }, true);

createRoot(document.getElementById("wurzel")).render(
  <React.StrictMode>
    <Auffanglinie>
      <DatenSpeicher>
        <App />
      </DatenSpeicher>
    </Auffanglinie>
  </React.StrictMode>
);

if (rueckkehr) wolke.rueckkehrVerarbeiten();

dienstArbeiterEinrichten();
