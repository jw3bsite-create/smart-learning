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
 *
 * Es gibt sie zweimal. Ganz außen fängt sie, was den Datenspeicher selbst
 * umwirft. Um jede einzelne Seite liegt eine zweite mit `bereich`: Stürzt nur
 * die Statistik ab, bleiben Menü und Kopfzeile stehen, und ein Klick auf eine
 * andere Seite genügt — die Hülle hängt am Weg und beginnt dort frisch.
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
    const { notsicherungHerunterladen } = await import("../core/notsicherung.js");
    await notsicherungHerunterladen();
  }

  render() {
    if (!this.state.fehler) return this.props.children;
    if (this.props.bereich) return this.bereichZeichnen();

    return (
      <div style={{ maxWidth: 640, margin: "60px auto", padding: "0 20px" }}>
        <h1 style={{ fontFamily: "var(--schrift-karten, serif)", fontSize: 28 }}>
          Da ist etwas schiefgegangen
        </h1>
        <p style={{ color: "var(--schrift-matt)", lineHeight: 1.6 }}>
          <strong style={{ color: "var(--gruen)" }}>Deine Karten und dein Lernstand
          sind unversehrt.</strong> Sie liegen in der Datenbank des Browsers, nicht
          in diesem Fenster, ein Fehler in der Anzeige kann ihnen nichts anhaben.
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
            Wenn das wiederkehrt: Diesen Text mitsamt der Sicherung aufheben,
            damit lässt sich der Fehler nachstellen.
          </p>
        </details>
      </div>
    );
  }

  /* Die knappe Fassung innerhalb einer Seite: Menü und Kopfzeile stehen noch. */
  bereichZeichnen() {
    return (
      <div className="mitte">
        <div className="zahl-kachel" role="alert" style={{ maxWidth: 620 }}>
          <h2 style={{ marginBottom: 6 }}>Diese Ansicht ist abgestürzt</h2>
          <p className="matt" style={{ marginTop: 0 }}>
            <strong style={{ color: "var(--gruen)" }}>Deine Karten und dein Lernstand sind
            unversehrt.</strong> Nur die Anzeige ist hängengeblieben. Über das Menü geht es
            woandershin weiter, oder du versuchst es hier noch einmal.
          </p>
          <div className="reihe umbruch" style={{ marginTop: 14 }}>
            <button type="button" className="knopf voll"
              onClick={() => this.setState({ fehler: null, stelle: null })}>
              Noch einmal versuchen
            </button>
            <button type="button" className="knopf" onClick={() => { window.location.hash = "/start"; }}>
              Zur Startseite
            </button>
            <button type="button" className="knopf leer" onClick={() => this.sicherungZiehen()}>
              Sicherung herunterladen
            </button>
          </div>
          <details style={{ marginTop: 14 }}>
            <summary className="klein blass" style={{ cursor: "pointer" }}>Was genau passiert ist</summary>
            <pre className="fehler-text">
              {String(this.state.fehler?.stack || this.state.fehler)}
              {this.state.stelle}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}
