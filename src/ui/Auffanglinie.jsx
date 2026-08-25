/*
 * Die Auffanglinie.
 *
 * React reißt bei einem Fehler in einer Komponente den ganzen Baum ab — der
 * Nutzer sieht eine weiße Seite und weiß nicht, ob seine Daten noch da sind.
 * Bei einer App, in der zwei Jahre Lernstand stecken, ist das die falsche
 * Antwort auf einen Programmierfehler.
 *
 * Diese Hülle fängt den Absturz, sagt zuerst das Wichtigste — die Daten liegen
 * unversehrt in der Datenbank, nicht im Fenster — und bietet an, sofort eine
 * Sicherung zu ziehen. Erst danach kommt der technische Teil.
 */

import React from "react";

export default class Auffanglinie extends React.Component {
  constructor(props) {
    super(props);
    this.state = { fehler: null, stelle: null };
  }

  static getDerivedStateFromError(fehler) {
    return { fehler };
  }

  componentDidCatch(fehler, angaben) {
    this.setState({ stelle: angaben?.componentStack || "" });
    console.error("Abgefangen:", fehler, angaben);
  }

  async sicherungZiehen() {
    // Bewusst unmittelbar über IndexedDB: Der Datenspeicher der App könnte
    // gerade der sein, der abgestürzt ist.
    const db = await import("../core/db.js");
    const ablagen = ["folders", "sets", "cards", "progress", "subjects",
      "cardstates", "reviews", "drafts", "explanations", "exams"];
    const daten = { fassung: 5, erzeugt: Date.now(), notsicherung: true };
    const namen = { folders: "ordner", sets: "stapel", cards: "karten",
      progress: "staende", subjects: "faecher", cardstates: "zustaende",
      reviews: "reviews", drafts: "entwuerfe", explanations: "erklaerungen",
      exams: "pruefungen" };
    for (const ablage of ablagen) {
      try { daten[namen[ablage]] = await db.all(ablage, { mitGeloeschten: true }); }
      catch (e) { daten[namen[ablage]] = []; }
    }
    const blob = new Blob([JSON.stringify(daten)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "karteikasten-notsicherung-"
      + new Date().toISOString().slice(0, 16).replace(":", "") + ".json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  render() {
    if (!this.state.fehler) return this.props.children;

    return (
      <div style={{ maxWidth: 640, margin: "60px auto", padding: "0 20px" }}>
        <h1 style={{ fontFamily: "var(--schrift-karten, serif)", fontSize: 28 }}>
          Da ist etwas schiefgegangen
        </h1>
        <p style={{ color: "var(--schrift-matt)", lineHeight: 1.6 }}>
          <strong style={{ color: "var(--gruen)" }}>Deine Karten und dein Lernstand
          sind unversehrt.</strong> Sie liegen in der Datenbank des Browsers, nicht
          in diesem Fenster — ein Fehler in der Anzeige kann ihnen nichts anhaben.
        </p>

        <div className="reihe" style={{ gap: 10, flexWrap: "wrap", margin: "22px 0" }}>
          <button className="knopf voll" onClick={() => this.sicherungZiehen()}>
            Sicherung herunterladen
          </button>
          <button className="knopf" onClick={() => { window.location.hash = "/"; window.location.reload(); }}>
            Zur Übersicht
          </button>
          <button className="knopf leer" onClick={() => window.location.reload()}>
            Neu laden
          </button>
        </div>

        <details style={{ marginTop: 10 }}>
          <summary style={{ cursor: "pointer", color: "var(--schrift-blass)", fontSize: 13 }}>
            Was genau passiert ist
          </summary>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 12,
            background: "var(--grund-3)", padding: 12, borderRadius: 8,
            marginTop: 8, maxHeight: 300, overflow: "auto",
            color: "var(--schrift-matt)" }}>
            {String(this.state.fehler?.stack || this.state.fehler)}
            {this.state.stelle}
          </pre>
          <p style={{ fontSize: 12, color: "var(--schrift-blass)" }}>
            Wenn das wiederkehrt: Diesen Text mitsamt der Sicherung aufheben —
            damit lässt sich der Fehler nachstellen.
          </p>
        </details>
      </div>
    );
  }
}
