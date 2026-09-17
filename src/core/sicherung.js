/*
 * Datensicherung: eine Datei, die alles enthält.
 *
 * Zwei Jahre Wiederholungen liegen in einer Datenbank im Browser. Ein
 * gelöschtes Profil, ein neu aufgesetztes Gerät, ein Browser, der seinen
 * Speicher aufräumt, weil die Platte voll ist: In allen drei Fällen ist der
 * Bestand weg, und es gibt keine Rückfrage. Die Wolke hilft dagegen nur zum
 * Teil, denn sie spiegelt auch das Löschen.
 *
 * Darum diese Datei. Sie liegt außerhalb der App, lässt sich auf eine
 * zweite Platte oder in einen anderen Dienst legen und ist lesbar, ohne dass
 * die App dafür laufen muss.
 *
 * Hier stehen nur die Teile ohne Browser: Namen, Inhaltsangabe und die
 * Prüfung einer eingelesenen Datei. Das Schreiben selbst macht der Speicher,
 * weil nur er an alle Ablagen kommt.
 */

import { VORSATZ } from "./ton.js";

/** Fassung des Dateiformats. Sie steht in jeder geschriebenen Datei. */
export const FASSUNG = 7;

/** Nach so vielen Tagen ohne Sicherung wird erinnert. */
export const ERINNERUNG_TAGE = 14;

const TAG = 86400000;

function datumsteil(zeit) {
  const d = new Date(zeit);
  const zwei = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + zwei(d.getMonth() + 1) + "-" + zwei(d.getDate());
}

/**
 * Der Dateiname. Das Datum steht darin, damit mehrere Sicherungen
 * nebeneinander liegen können, ohne sich zu überschreiben.
 */
export function dateiname(art = "voll", zeit = Date.now()) {
  const stamm = "smart-learning-" + datumsteil(zeit);
  if (art === "daten") return stamm + "-nur-daten.json";
  if (art === "karten") return stamm + "-karten.csv";
  if (art === "vorher") return stamm + "-vor-dem-einlesen.json";
  return stamm + ".json";
}

const istTonKennung = (kennung) => String(kennung || "").startsWith(VORSATZ);

/**
 * Was in einer Sicherung steckt.
 *
 * Wird zweimal gebraucht: nach dem Schreiben, damit man sieht, dass etwas
 * drin ist, und vor dem Einlesen, damit man weiß, was man einlässt.
 */
export function inhaltsangabe(daten = {}) {
  const liste = (feld) => Array.isArray(daten[feld]) ? daten[feld] : [];
  const medien = liste("bilder");
  return {
    fassung: daten.fassung || 0,
    erzeugt: daten.erzeugt || 0,
    ordner: liste("ordner").length,
    stapel: liste("stapel").length,
    karten: liste("karten").length,
    faecher: liste("faecher").length,
    zustaende: liste("zustaende").length,
    reviews: liste("reviews").length,
    erklaerungen: liste("erklaerungen").length,
    pruefungen: liste("pruefungen").length,
    notenfaecher: liste("notenfaecher").length,
    lernzeiten: liste("lernzeiten").length,
    bilder: medien.filter((b) => !istTonKennung(b?.id)).length,
    toene: medien.filter((b) => istTonKennung(b?.id)).length,
    zeichen: 0,
  };
}

/** „12 Stapel, 272 Karten, 14 Bilder, 3 Aufnahmen" */
export function angabeText(a) {
  const stuecke = [
    a.stapel + (a.stapel === 1 ? " Stapel" : " Stapel"),
    a.karten + (a.karten === 1 ? " Karte" : " Karten"),
  ];
  if (a.faecher) stuecke.push(a.faecher + (a.faecher === 1 ? " Fach" : " Fächer"));
  if (a.bilder) stuecke.push(a.bilder + (a.bilder === 1 ? " Bild" : " Bilder"));
  if (a.toene) stuecke.push(a.toene + (a.toene === 1 ? " Aufnahme" : " Aufnahmen"));
  if (a.notenfaecher) stuecke.push("Punkte");
  return stuecke.join(", ");
}

/** Bytes lesbar: „8,4 MB". */
export function groesseText(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return n + " B";
  if (n < 1048576) return (n / 1024).toFixed(0) + " KB";
  return (n / 1048576).toFixed(1).replace(".", ",") + " MB";
}

/**
 * Prüft eine eingelesene Datei, ehe sie etwas anfasst.
 *
 * Wichtiger als es aussieht: „Alles ersetzen" mit einer halben Datei löscht
 * den Bestand und legt nichts an dessen Stelle. Einmal abgebrochenes
 * Herunterladen genügt dafür.
 */
export function pruefeSicherung(daten) {
  const probleme = [];
  if (!daten || typeof daten !== "object" || Array.isArray(daten))
    return { gut: false, probleme: ["Das ist keine Sicherungsdatei."], angabe: null };

  if (!Array.isArray(daten.stapel))
    probleme.push("In der Datei fehlt die Liste der Stapel.");
  if (!Array.isArray(daten.karten))
    probleme.push("In der Datei fehlt die Liste der Karten.");

  const angabe = inhaltsangabe(daten);
  if (angabe.fassung > FASSUNG)
    probleme.push("Die Datei kommt von einer neueren Fassung der App (" + angabe.fassung
      + " statt " + FASSUNG + "). Lies sie dort ein oder bringe diese App auf den Stand.");
  if (!angabe.fassung)
    probleme.push("Die Datei nennt keine Fassung. Sie ist vermutlich unvollständig.");
  if (Array.isArray(daten.karten) && Array.isArray(daten.stapel)
    && angabe.karten > 0 && angabe.stapel === 0)
    probleme.push("Die Datei enthält Karten, aber keine Stapel.");

  return { gut: probleme.length === 0, probleme, angabe };
}

/** Ganze Tage seit einem Zeitpunkt. Ohne Zeitpunkt: null. */
export function tageSeit(zeit, jetzt = Date.now()) {
  if (!zeit) return null;
  return Math.floor((jetzt - zeit) / TAG);
}

/** Ist wieder eine Sicherung fällig? Ohne jede Sicherung: ja, sobald es Karten gibt. */
export function sicherungFaellig(letzte, jetzt = Date.now(), tage = ERINNERUNG_TAGE) {
  const seit = tageSeit(letzte, jetzt);
  return seit === null || seit >= tage;
}

/** „heute", „vor 3 Tagen", „noch keine" */
export function letzteText(letzte, jetzt = Date.now()) {
  const seit = tageSeit(letzte, jetzt);
  if (seit === null) return "noch keine";
  if (seit <= 0) return "heute";
  if (seit === 1) return "gestern";
  return "vor " + seit + " Tagen";
}
