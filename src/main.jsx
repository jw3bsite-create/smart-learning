import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { DatenSpeicher } from "./core/store.jsx";
import Auffanglinie from "./ui/Auffanglinie.jsx";
import * as wolke from "./core/cloud.js";
import { dienstArbeiterEinrichten } from "./core/aktualisierung.js";
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
