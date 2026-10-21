/*
 * Der Umzug am Rechner (core/umzug.js), in zwei Hälften:
 *
 *   UmzugAlt  in der alten Fassung (localhost): abgleichen oder sichern,
 *             dann die neue Fassung öffnen.
 *   UmzugNeu  in der neuen Fassung: Kommt alles an? Und danach: als App
 *             installieren.
 */

import React, { useEffect, useState } from "react";
import { useDaten } from "../core/store.jsx";
import * as wolke from "../core/cloud.js";
import { herunterladen } from "../core/datei.js";
import { dateiname } from "../core/sicherung.js";
import {
  zaehlen, umzugLink, umzugLesen, umzugVergessen, umzugPruefen, laeuftLokal,
} from "../core/umzug.js";
import { gehe } from "../App.jsx";
import { Knopf, Symbol } from "./basis.jsx";

function Schritt({ nummer, erledigt, children }) {
  return (
    <div className="reihe oben-8" style={{ alignItems: "flex-start", gap: 10 }}>
      <span className={"marke" + (erledigt ? " gruen" : "")} style={{ minWidth: 26, justifyContent: "center" }}>
        {erledigt ? <Symbol name="haken" groesse={12} /> : nummer}
      </span>
      <div className="dehnen">{children}</div>
    </div>
  );
}

/* ----------------------------- Alte Fassung ----------------------------- */

export function UmzugAlt({ aufAbgleich }) {
  const { stapel, karten, wolkeStand, alsSicherung } = useDaten();
  const [sitz, setSitz] = useState(undefined);
  const [zugang, setZugang] = useState(null);
  const [gesichert, setGesichert] = useState(false);
  const [geoeffnet, setGeoeffnet] = useState(false);

  useEffect(() => {
    wolke.sitzung().then(setSitz).catch(() => setSitz(null));
    wolke.zugangLesen().then(setZugang).catch(() => {});
  }, []);
  if (!laeuftLokal()) return null;

  const stand = zaehlen({ stapel, karten });
  const abgeglichen = wolkeStand.zustand === "gut";

  const sichern = async () => {
    const daten = await alsSicherung({ mitMedien: true });
    herunterladen(dateiname("voll"), JSON.stringify(daten), "application/json");
    setGesichert(true);
  };

  const oeffnen = () => {
    window.open(umzugLink(sitz ? zugang : null, { ...stand, zeit: Date.now() }), "_blank");
    setGeoeffnet(true);
  };

  return (
    <div className="zahl-kachel unten-32" style={{ borderColor: "var(--akzent)" }}>
      <h2 className="unten-4">Anchor am PC ohne eigenen Server</h2>
      <p className="klein matt" style={{ marginTop: 0 }}>
        Diese Fassung läuft über deinen Rechner (localhost). Die veröffentlichte Fassung, in
        Edge als App installiert, startet ohne Server, funktioniert offline und kann
        Push-Nachrichten. Deine {stand.stapel} Stapel mit {stand.karten} Karten ziehen mit um;
        diese Fassung bleibt, bis du dich überzeugt hast.
      </p>

      {sitz ? (
        <>
          <Schritt nummer={1} erledigt={abgeglichen}>
            <div>Alles in die Cloud schicken.</div>
            <div className="reihe umbruch oben-4">
              <Knopf art="klein" symbol="wolke" onClick={aufAbgleich}>Jetzt abgleichen</Knopf>
              <span className="klein blass">{wolkeStand.text}</span>
            </div>
          </Schritt>
          <Schritt nummer={2} erledigt={geoeffnet}>
            <div>Die neue Fassung öffnen. Der Zugang zur Cloud kommt mit, du meldest dich dort
              nur noch an.</div>
            <Knopf art={abgeglichen ? "klein voll" : "klein"} onClick={oeffnen} className="oben-4">
              Neue Fassung öffnen
            </Knopf>
          </Schritt>
        </>
      ) : (
        <>
          <Schritt nummer={1} erledigt={gesichert}>
            <div>Ohne Cloud-Anmeldung zieht alles über eine Sicherungsdatei um.</div>
            <Knopf art="klein" symbol="herunter" onClick={sichern} className="oben-4">Alles sichern</Knopf>
          </Schritt>
          <Schritt nummer={2} erledigt={geoeffnet}>
            <div>Die neue Fassung öffnen, dort unter Einstellungen „Sicherung einlesen“ und
              „Alles ersetzen“ wählen.</div>
            <Knopf art={gesichert ? "klein voll" : "klein"} onClick={oeffnen} className="oben-4">
              Neue Fassung öffnen
            </Knopf>
          </Schritt>
        </>
      )}
      <Schritt nummer={3} erledigt={false}>
        Drüben prüft Anchor selbst, ob alle Stapel und Karten angekommen sind, und sagt dir,
        wie du es als App installierst.
      </Schritt>
    </div>
  );
}

/* ----------------------------- Neue Fassung ----------------------------- */

export function UmzugNeu({ knapp = false }) {
  const { stapel, karten } = useDaten();
  const [soll, setSoll] = useState(() => umzugLesen());
  if (!soll || laeuftLokal()) return null;
  const p = umzugPruefen(soll, zaehlen({ stapel, karten }));

  if (knapp) {
    return (
      <div className="zahl-kachel oben-16" style={{ borderColor: p.vollstaendig ? "var(--gruen)" : "var(--gelb)" }}>
        <div className="reihe umbruch">
          <span className="dehnen">
            <strong>Umzug vom PC:</strong> {p.vollstaendig
              ? "alles angekommen."
              : p.kartenDa + " von " + p.karten + " Karten sind da."}
          </span>
          <Knopf art="klein" onClick={() => gehe("/einstellungen")}>Weiter</Knopf>
        </div>
      </div>
    );
  }

  return (
    <div className="zahl-kachel unten-32"
      style={{ borderColor: p.vollstaendig ? "var(--gruen)" : "var(--gelb)" }}>
      <h2 className="unten-4">Umzug vom PC</h2>
      <p className="matt" style={{ marginTop: 0 }}>
        {p.stapelDa} von {p.stapel} Stapeln und {p.kartenDa} von {p.karten} Karten sind hier.
      </p>
      {p.vollstaendig ? (
        <>
          <div className="rueckmeldung gut klein">Alles angekommen.</div>
          <p className="klein matt">
            Jetzt als App installieren: in Edge oben rechts auf <strong>···</strong> →
            <strong> Apps</strong> → <strong>Diese Website als App installieren</strong>. Danach
            startet Anchor aus dem Startmenü oder vom Schreibtisch, ohne Server. Die
            Verknüpfung „Anchor (alte Fassung)“ kannst du löschen, wenn du dich überzeugt hast.
          </p>
          <Knopf art="voll" onClick={() => { umzugVergessen(); setSoll(null); }}>Erledigt</Knopf>
        </>
      ) : (
        <p className="klein matt">
          Noch nicht alles da. Bist du unten unter <strong>Cloud</strong> angemeldet? Dann einmal
          <strong> „Abgleich neu beginnen“</strong> — bei vielen Bildern dauert es ein paar
          Minuten. Kamst du über eine Sicherungsdatei: unter <strong>Sicherung als Datei</strong> →
          „Sicherung einlesen“ → „Alles ersetzen“.
        </p>
      )}
    </div>
  );
}

/* Leer und am Windows-Rechner? Dann liegen die Karten vermutlich noch drüben. */
export function UmzugHinweis() {
  if (laeuftLokal() || umzugLesen() || !/Windows/.test(navigator.userAgent)) return null;
  return (
    <p className="klein matt oben-16" style={{ textAlign: "center" }}>
      Deine Karten liegen noch in der alten Fassung am PC? Öffne „Anchor (alte Fassung)“ →
      Einstellungen → „Anchor am PC ohne eigenen Server“.
    </p>
  );
}
