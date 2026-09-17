/*
 * Termine als Kalenderdatei (.ics).
 *
 * Die Prüfungstermine stehen in der App, der Alltag spielt sich aber im
 * Kalender des Telefons ab. Eine .ics-Datei ist der einzige Weg dorthin, der
 * ohne Konto, ohne Server und ohne Rechte auf dem Schul-iPad funktioniert:
 * Datei öffnen, „Hinzufügen" antippen, fertig.
 *
 * Nebenbei löst das ein Stück des Erinnerungsproblems. Eine tägliche
 * Lernerinnerung als wiederkehrender Termin mit Weckruf zeigt das Telefon
 * selbst an — auch wenn die App geschlossen ist. Eine echte Mitteilung aus
 * der App heraus bräuchte einen Server, der sie verschickt; das hier braucht
 * nichts.
 *
 * Format nach RFC 5545, und zwar genauer, als es auf den ersten Blick nötig
 * wirkt: Zeilen über fünfundsiebzig Zeichen müssen umbrochen werden, Komma
 * und Semikolon müssen maskiert sein. Apple und Google verwerfen eine Datei
 * sonst ganz oder still zur Hälfte.
 */

const zwei = (n) => String(n).padStart(2, "0");

/** YYYYMMDD in Ortszeit — für ganztägige Termine. */
export function alsTag(zeit) {
  const d = new Date(zeit);
  return String(d.getFullYear()) + zwei(d.getMonth() + 1) + zwei(d.getDate());
}

/** YYYYMMDDTHHMMSSZ — für Zeitstempel. */
export function alsZeitpunkt(zeit) {
  const d = new Date(zeit);
  return String(d.getUTCFullYear()) + zwei(d.getUTCMonth() + 1) + zwei(d.getUTCDate())
    + "T" + zwei(d.getUTCHours()) + zwei(d.getUTCMinutes()) + zwei(d.getUTCSeconds()) + "Z";
}

/** Ortszeit ohne Zeitzone („schwebend"): gilt überall zur genannten Uhrzeit. */
export function alsOrtszeit(zeit) {
  const d = new Date(zeit);
  return String(d.getFullYear()) + zwei(d.getMonth() + 1) + zwei(d.getDate())
    + "T" + zwei(d.getHours()) + zwei(d.getMinutes()) + "00";
}

/** Maskiert Text für ein Feld. */
export function maskiere(text) {
  return String(text ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Bricht zu lange Zeilen um, wie das Format es verlangt: höchstens
 * fünfundsiebzig Oktette, Fortsetzung mit einem führenden Leerzeichen.
 * Gezählt werden Oktette, nicht Zeichen — ein „ä" wiegt zwei.
 */
export function falte(zeile) {
  const kodierer = new TextEncoder();
  const stuecke = [];
  let jetzige = "";
  let gewicht = 0;
  for (const zeichen of String(zeile)) {
    const n = kodierer.encode(zeichen).length;
    const grenze = stuecke.length === 0 ? 75 : 74;   // Fortsetzungen tragen ein Leerzeichen
    if (gewicht + n > grenze) {
      stuecke.push(jetzige);
      jetzige = "";
      gewicht = 0;
    }
    jetzige += zeichen;
    gewicht += n;
  }
  stuecke.push(jetzige);
  return stuecke[0] + stuecke.slice(1).map((s) => "\r\n " + s).join("");
}

const HERKUNFT = "-//Smart Learning//Termine//DE";

function block(zeilen) {
  return zeilen.filter(Boolean).map(falte).join("\r\n");
}

/**
 * Ein Prüfungstermin als ganztägiger Eintrag, mit Weckruf eine Woche und
 * einen Tag vorher.
 *
 * Die Kennung wird aus dem Fach gebildet, nicht gezogen: Wer die Datei
 * zweimal einliest, soll denselben Termin aktualisieren und nicht zwei
 * Einträge übereinander haben.
 */
export function pruefungsTermin(fach, { jetzt = Date.now(), vorlauf = [7, 1] } = {}) {
  if (!fach?.pruefungsdatum) return null;
  const beginn = alsTag(fach.pruefungsdatum);
  const ende = alsTag(fach.pruefungsdatum + 86400000);
  const wecker = vorlauf.map((tage) => block([
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:" + maskiere("Prüfung " + fach.name + " in " + tage
      + (tage === 1 ? " Tag" : " Tagen")),
    "TRIGGER:-P" + tage + "D",
    "END:VALARM",
  ])).join("\r\n");

  return block([
    "BEGIN:VEVENT",
    "UID:pruefung-" + fach.id + "@smart-learning",
    "DTSTAMP:" + alsZeitpunkt(jetzt),
    "DTSTART;VALUE=DATE:" + beginn,
    "DTEND;VALUE=DATE:" + ende,
    "SUMMARY:" + maskiere("Prüfung: " + fach.name),
    "DESCRIPTION:" + maskiere("Termin aus Smart Learning. Der Lernplan rechnet "
      + "mit diesem Tag."),
    "TRANSP:TRANSPARENT",
  ]) + "\r\n" + wecker + "\r\nEND:VEVENT";
}

/**
 * Die tägliche Lernerinnerung als wiederkehrender Termin.
 * `stunde`/`minute` in Ortszeit, `tage` begrenzt auf Wochentage, wenn gesetzt.
 */
export function taeglicheErinnerung({
  stunde = 18, minute = 0, jetzt = Date.now(), bis = null, text = "Abrufen: heute fällige Karten",
} = {}) {
  const start = new Date(jetzt);
  start.setHours(stunde, minute, 0, 0);
  if (start.getTime() < jetzt) start.setDate(start.getDate() + 1);

  return block([
    "BEGIN:VEVENT",
    "UID:erinnerung-taeglich@smart-learning",
    "DTSTAMP:" + alsZeitpunkt(jetzt),
    "DTSTART:" + alsOrtszeit(start.getTime()),
    "DURATION:PT15M",
    "RRULE:FREQ=DAILY" + (bis ? ";UNTIL=" + alsTag(bis) : ""),
    "SUMMARY:" + maskiere(text),
    "DESCRIPTION:" + maskiere("Erinnerung aus Smart Learning. Offene Karten "
      + "stehen in der App."),
    "TRANSP:TRANSPARENT",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:" + maskiere(text),
    "TRIGGER:PT0M",
    "END:VALARM",
    "END:VEVENT",
  ]);
}

/** Setzt die ganze Datei zusammen. Ohne Einträge: null. */
export function alsKalender(eintraege, { name = "Smart Learning" } = {}) {
  const teile = (eintraege || []).filter(Boolean);
  if (!teile.length) return null;
  return block([
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:" + HERKUNFT,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:" + maskiere(name),
  ]) + "\r\n" + teile.join("\r\n") + "\r\nEND:VCALENDAR\r\n";
}

/** Prüfungen und, wenn gewünscht, die tägliche Erinnerung in einer Datei. */
export function termineDatei(faecher, { erinnerung = null, jetzt = Date.now() } = {}) {
  const eintraege = (faecher || [])
    .filter((f) => f && !f.deleted && f.pruefungsdatum)
    .sort((a, b) => a.pruefungsdatum - b.pruefungsdatum)
    .map((f) => pruefungsTermin(f, { jetzt }));
  if (erinnerung) eintraege.push(taeglicheErinnerung({ ...erinnerung, jetzt }));
  return alsKalender(eintraege);
}

export function dateiname(jetzt = Date.now()) {
  return "smart-learning-termine-" + alsTag(jetzt) + ".ics";
}
