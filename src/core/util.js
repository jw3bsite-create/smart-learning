/* Kleine Helfer, die überall gebraucht werden. */

/** Mischt eine Liste (Fisher–Yates), ohne das Original anzurühren. */
export function mische(liste) {
  const a = [...liste];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Zieht bis zu `n` zufällige Stücke. */
export function ziehe(liste, n) {
  return mische(liste).slice(0, n);
}

export const klemme = (x, min, max) => Math.max(min, Math.min(max, x));

/** Sekunden als m:ss. */
export function zeitLang(ms) {
  const s = Math.max(0, Math.round(ms / 100) / 10);
  if (s < 60) return s.toFixed(1) + " s";
  const m = Math.floor(s / 60);
  return m + ":" + String(Math.floor(s % 60)).padStart(2, "0") + " min";
}

const TAGE = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

export function datumKurz(ms) {
  if (!ms) return "—";
  const d = new Date(ms);
  const heute = new Date(); heute.setHours(0, 0, 0, 0);
  const tag = new Date(ms); tag.setHours(0, 0, 0, 0);
  const diff = Math.round((tag - heute) / 86400000);
  if (diff === 0) return "heute";
  if (diff === 1) return "morgen";
  if (diff === -1) return "gestern";
  if (diff > 1 && diff < 7) return "am " + TAGE[d.getDay()];
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

/** Tagesschlüssel (Ortszeit) für Strähne und Statistik. */
export function tagesSchluessel(ms = Date.now()) {
  const d = new Date(ms);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") +
    "-" + String(d.getDate()).padStart(2, "0");
}

/** Zählt zusammenhängende Tage bis heute (oder gestern) — die Lernsträhne. */
export function straehne(tage) {
  const menge = new Set(tage);
  let zaehler = 0;
  const d = new Date();
  if (!menge.has(tagesSchluessel(d.getTime()))) d.setDate(d.getDate() - 1);
  for (;;) {
    if (!menge.has(tagesSchluessel(d.getTime()))) break;
    zaehler++;
    d.setDate(d.getDate() - 1);
  }
  return zaehler;
}

/** Deutsche Mehrzahl in der einfachen Form „1 Karte / 5 Karten“. */
export function anzahl(n, ein, mehr) {
  return n + " " + (n === 1 ? ein : mehr);
}
