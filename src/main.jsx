import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { DatenSpeicher } from "./core/store.jsx";
import Auffanglinie from "./ui/Auffanglinie.jsx";
import * as wolke from "./core/cloud.js";
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

/*
 * Dienst-Arbeiter für den Betrieb ohne Netz. Im Entwicklungslauf stört er nur.
 *
 * Der Pfad wird aus der Adresse der Seite abgeleitet, nicht fest verdrahtet:
 * Liegt die App in einem Unterordner, zeigt `/sw.js` sonst ins Leere — und ein
 * Dienst-Arbeiter, der nicht gefunden wird, nimmt die Offline-Fähigkeit mit
 * sich, ohne dass es jemand merkt.
 */
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    const wurzel = new URL(".", window.location.href);
    navigator.serviceWorker
      .register(new URL("sw.js", wurzel), { scope: wurzel.pathname })
      .catch(() => {});
  });
}
