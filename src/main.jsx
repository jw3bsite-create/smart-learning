import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { DatenSpeicher } from "./core/store.jsx";
import Auffanglinie from "./ui/Auffanglinie.jsx";
import "./ui/stil.css";

/* Die Auffanglinie liegt außen: Stürzt der Datenspeicher selbst ab, greift sie
   immer noch — und kann die Daten unmittelbar aus der Datenbank sichern. */
createRoot(document.getElementById("wurzel")).render(
  <React.StrictMode>
    <Auffanglinie>
      <DatenSpeicher>
        <App />
      </DatenSpeicher>
    </Auffanglinie>
  </React.StrictMode>
);

// Dienst-Arbeiter für den Betrieb ohne Netz. Im Entwicklungslauf stört er nur.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
