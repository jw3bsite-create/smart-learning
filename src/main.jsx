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
