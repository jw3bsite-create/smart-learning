/*
 * Der Umzug am Rechner: von localhost in die veröffentlichte Fassung.
 *
 * Am Rechner lief Anchor bisher über einen kleinen Server auf dem eigenen
 * Gerät (`localhost`, aus „Anchor starten“). Das hat drei Nachteile: Er muss
 * jedes Mal mitlaufen, es gibt dort keinen Dienst-Arbeiter (also kein
 * Offline und kein Push), und die Daten liegen getrennt von der
 * veröffentlichten Seite — der Browser hält je Adresse einen eigenen
 * Speicher.
 *
 * Besser ist die veröffentlichte Seite, in Edge als App installiert. Dahin
 * müssen die Daten umziehen, und zwar nachprüfbar:
 *
 *   1. In der alten Fassung: abgleichen (oder eine Sicherung herunterladen).
 *   2. Die neue Fassung öffnen — über einen Link, der den Zugang zur Wolke
 *      und die Zahl der Stapel und Karten mitbringt.
 *   3. Dort anmelden; nach dem Abgleich vergleicht die App die Zahlen und
 *      sagt, ob alles angekommen ist.
 *
 * Die alte Fassung bleibt, bis man sich selbst überzeugt hat.
 */

import { zugangAlsLink } from "./cloud.js";

export const VEROEFFENTLICHT = "https://jw3bsite-create.github.io/smart-learning/";
const FELD = "umzug";
const MERKER = "anchor-umzug";

/** Läuft diese Fassung über den eigenen Rechner? */
export function laeuftLokal() {
  return typeof location !== "undefined"
    && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
}

/** Was mitgezählt wird: Stapel und Karten, ohne Gelöschtes. */
export function zaehlen({ stapel = [], karten = [] }) {
  return {
    stapel: stapel.filter((s) => !s.deleted).length,
    karten: karten.filter((k) => !k.deleted).length,
  };
}

/** Der Link in die neue Fassung — mit Zugang zur Wolke, wenn es einen gibt. */
export function umzugLink(zugang, stand, ziel = VEROEFFENTLICHT) {
  const mitZugang = zugang ? zugangAlsLink(zugang, ziel) : "";
  const url = new URL(mitZugang || ziel);
  url.searchParams.set(FELD, stand.stapel + "-" + stand.karten + "-" + (stand.zeit || Date.now()));
  return url.href;
}

/** Liest die mitgebrachten Zahlen aus der Adresse, oder null. */
export function umzugAusLink(suche) {
  const roh = new URLSearchParams(String(suche || "").replace(/^\?/, "")).get(FELD);
  const m = /^(\d+)-(\d+)-(\d+)$/.exec(roh || "");
  return m ? { stapel: Number(m[1]), karten: Number(m[2]), zeit: Number(m[3]) } : null;
}

export function umzugMerken(soll) {
  try { localStorage.setItem(MERKER, JSON.stringify(soll)); } catch (e) { /* egal */ }
}

export function umzugLesen() {
  try { return JSON.parse(localStorage.getItem(MERKER) || "null"); } catch (e) { return null; }
}

export function umzugVergessen() {
  try { localStorage.removeItem(MERKER); } catch (e) { /* egal */ }
}

/**
 * Ist alles angekommen? Mehr ist nicht schlimm (auf diesem Gerät lag schon
 * etwas); weniger heißt, dass noch etwas fehlt.
 */
export function umzugPruefen(soll, ist) {
  if (!soll) return null;
  return {
    ...soll,
    stapelDa: ist.stapel, kartenDa: ist.karten,
    vollstaendig: ist.stapel >= soll.stapel && ist.karten >= soll.karten,
  };
}
