/*
 * Push-Nachrichten: was gesendet wird und wann.
 *
 * Die Tageserinnerung im Browser kommt nur, solange Anchor offen ist. Für
 * die Nachricht bei geschlossener App braucht es einen Absender, und den
 * gibt es ohne eigenen Server nur so:
 *
 *   1. Anchor schreibt bei jedem Abgleich eine Vorschau in die Wolke: wie
 *      viele Karten an jedem der nächsten Tage fällig sind, falls bis dahin
 *      nichts mehr geschieht (`tagesplan`).
 *   2. Jedes Gerät, auf dem die Erinnerung an ist, meldet sich mit seinem
 *      Push-Abonnement an (Tabelle `anchor_push_abo`, siehe wolke.sql).
 *   3. Ein Auftrag auf GitHub läuft regelmäßig (werkzeug/push-senden.mjs),
 *      liest beides über eine geschützte Funktion und schickt die Nachricht,
 *      sobald auf dem Gerät eine der eingestellten Uhrzeiten erreicht ist
 *      (`sollSenden`, `letzterTermin`).
 *
 * Geschützt ist das Lesen durch ein Geheimnis, das die App erzeugt und das
 * nur noch als GitHub-Secret existiert. In derselben Zeichenkette steht der
 * private Schlüssel, mit dem Push-Dienste den Absender erkennen (VAPID). Der
 * service_role key von Supabase wird an keiner Stelle gebraucht.
 *
 * Diese Datei läuft im Browser und im Node-Skript gleichermaßen.
 */

const TAG = 24 * 3600 * 1000;

/* Der Lerntag beginnt um 4 Uhr (siehe util.js); die Vorschau rechnet in
   Lerntagen, der Absender ebenso. */
const TAGESWECHSEL = 4;

/** Tagesschlüssel „JJJJ-MM-TT" in Ortszeit des Geräts. */
function tagesSchluessel(ms) {
  const d = new Date(ms);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0")
    + "-" + String(d.getDate()).padStart(2, "0");
}

function tagesBeginn(ms) {
  const d = new Date(ms);
  if (d.getHours() < TAGESWECHSEL) d.setDate(d.getDate() - 1);
  d.setHours(TAGESWECHSEL, 0, 0, 0);
  return d.getTime();
}

/**
 * Wie viele Karten an jedem der nächsten Tage fällig sind — aufsummiert,
 * denn was heute liegen bleibt, ist morgen noch fällig. Neue und gesperrte
 * Karten zählen nicht: Die Nachricht spricht von Wiederholungen.
 *
 * `zustaende` ist die Liste der Kartenzustände im Plan (zustaendeImPlan).
 */
export function tagesplan(zustaende, tage = 14, zeit = Date.now()) {
  const beginn = tagesBeginn(zeit);
  const plan = {};
  for (let k = 0; k < tage; k++) {
    // Tagesgrenze über das Kalenderdatum, nicht über 24 Stunden: Bei der
    // Zeitumstellung hat ein Tag 23 oder 25 Stunden.
    const tag = new Date(beginn);
    tag.setDate(tag.getDate() + k);
    const ende = new Date(tag);
    ende.setDate(ende.getDate() + 1);
    let n = 0;
    for (const z of zustaende) {
      if (!z || z.gesperrt || z.deleted) continue;
      if (!z.reps || z.state === 0) continue;            // neu
      if ((z.due || 0) < ende.getTime()) n += 1;
    }
    plan[tagesSchluessel(tag.getTime())] = n;
  }
  return plan;
}

const zwei = (n) => String(n).padStart(2, "0");

/* Kalendertag und Minute des Tages in einer Zeitzone. */
function ortsuhr(zeit, zeitzone) {
  let teile;
  try {
    teile = new Intl.DateTimeFormat("en-CA", {
      timeZone: zeitzone, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date(zeit));
  } catch (e) {
    return ortsuhr(zeit, "Europe/Berlin");
  }
  const w = Object.fromEntries(teile.map((t) => [t.type, t.value]));
  return { kalender: w.year + "-" + w.month + "-" + w.day,
    minuten: (Number(w.hour) % 24) * 60 + Number(w.minute) };
}

/* Mit Kalendertagen rechnen, ohne Zeitzone: Sie stehen für sich. */
function wochentagVon(kalender) {
  const [j, m, t] = kalender.split("-").map(Number);
  return new Date(Date.UTC(j, m - 1, t)).getUTCDay();
}
function tagVersetzt(kalender, um) {
  const [j, m, t] = kalender.split("-").map(Number);
  return new Date(Date.UTC(j, m - 1, t + um)).toISOString().slice(0, 10);
}

/**
 * Datum und Stunde in einer Zeitzone — auf dem Server, der in UTC läuft,
 * muss „17 Uhr" die Uhrzeit des Handys meinen.
 */
export function ortszeit(zeit, zeitzone = "Europe/Berlin") {
  const { kalender, minuten } = ortsuhr(zeit, zeitzone);
  const stunde = Math.floor(minuten / 60);
  // Vor 4 Uhr gehört die Stunde noch zum Lerntag davor.
  return { datum: stunde < TAGESWECHSEL ? tagVersetzt(kalender, -1) : kalender, stunde };
}

/* ------------------------------ Zeitplan --------------------------------- */

/*
 * Wann erinnert wird: je Wochentag eine Liste von Uhrzeiten, die Tage
 * gezählt wie in JavaScript (0 = Sonntag, 1 = Montag …). Ein Tag ohne
 * Uhrzeit bleibt still.
 *
 *   { 0: [], 1: ["07:00", "17:00"], 2: ["17:00"], … }
 *
 * Früher gab es nur eine Stunde für alle Tage. Fehlt der Zeitplan, gilt
 * darum diese Stunde an jedem Tag — so bleibt eine ältere Einstellung, wie
 * sie war.
 */
export const HOECHSTENS_JE_TAG = 8;

/** Mo bis So, in der Reihenfolge, in der man sie liest. */
export const WOCHE = [[1, "Mo", "Montag"], [2, "Di", "Dienstag"], [3, "Mi", "Mittwoch"],
  [4, "Do", "Donnerstag"], [5, "Fr", "Freitag"], [6, "Sa", "Samstag"], [0, "So", "Sonntag"]];

/** „7:5“, „07:05“ → „07:05“; Unsinn → null. */
export function uhrzeitOrdnen(text) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(text ?? "").trim());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return zwei(Number(m[1])) + ":" + m[2];
}

/** Ein Zeitplan in fester Form: alle sieben Tage, Uhrzeiten sortiert und einmalig. */
export function zeitplanOrdnen(zeitplan, stunde = 17) {
  const gegeben = zeitplan && typeof zeitplan === "object";
  const vorgabe = [zwei(Math.min(23, Math.max(0, Math.floor(Number(stunde ?? 17)) || 0))) + ":00"];
  const plan = {};
  for (let w = 0; w < 7; w++) {
    const roh = gegeben ? zeitplan[w] : vorgabe;
    const liste = Array.isArray(roh) ? roh.map(uhrzeitOrdnen).filter(Boolean) : [];
    plan[w] = [...new Set(liste)].sort().slice(0, HOECHSTENS_JE_TAG);
  }
  return plan;
}

/** Die früheste Stunde der Woche — für einen Absender, der nur eine Stunde kennt. */
export function fruehesteStunde(zeitplan, stunde = 17) {
  const alle = Object.values(zeitplanOrdnen(zeitplan, stunde)).flat().sort();
  return alle.length ? Number(alle[0].slice(0, 2)) : Number(stunde ?? 17);
}

const minutenVon = (uhrzeit) => Number(uhrzeit.slice(0, 2)) * 60 + Number(uhrzeit.slice(3));

/**
 * Die zuletzt erreichte Uhrzeit des laufenden Lerntags.
 *
 * Der Lerntag beginnt um 4 Uhr. Eine Uhrzeit vor 4 Uhr — „Dienstag 1:00“ —
 * liegt darum im Kalender am Dienstag, gehört aber zum Lerntag Montag.
 *
 * Zurück kommt der Lerntag (`datum`), die Uhrzeit als Schlüssel
 * „JJJJ-MM-TT HH:MM“ (`termin`, null, wenn heute noch keine erreicht ist)
 * und ob der Lerntag überhaupt eine Uhrzeit hat (`hatTermine`).
 *
 * Nur die letzte erreichte zählt: Kam der Absender länger nicht dran (GitHub
 * drosselt), geht eine Nachricht hinaus, nicht drei hintereinander.
 */
export function letzterTermin({ zeitplan, stunde, zeitzone, zeit = Date.now() }) {
  const plan = zeitplanOrdnen(zeitplan, stunde);
  const { kalender, minuten } = ortsuhr(zeit, zeitzone);
  const frueh = minuten < TAGESWECHSEL * 60;
  const datum = frueh ? tagVersetzt(kalender, -1) : kalender;

  const termine = plan[wochentagVon(datum)]
    .filter((u) => minutenVon(u) >= TAGESWECHSEL * 60).map((u) => datum + " " + u);
  // Was nach Mitternacht liegt, steht im Plan beim Kalendertag danach.
  const nachMitternacht = frueh ? kalender : tagVersetzt(datum, 1);
  for (const u of plan[wochentagVon(nachMitternacht)])
    if (minutenVon(u) < TAGESWECHSEL * 60) termine.push(nachMitternacht + " " + u);

  const jetzt = kalender + " " + zwei(Math.floor(minuten / 60)) + ":" + zwei(minuten % 60);
  const erreicht = termine.filter((x) => x <= jetzt).sort();
  return { datum, termin: erreicht.length ? erreicht[erreicht.length - 1] : null,
    hatTermine: termine.length > 0 };
}

/*
 * Kam für diese Uhrzeit schon eine Nachricht? `letzte` ist der Schlüssel
 * der zuletzt gesendeten. Früher stand dort nur der Tag — der heißt dann:
 * heute ist schon erinnert worden.
 */
export function schonGesendet(letzte, { datum, termin }) {
  if (!letzte) return false;
  if (!String(letzte).includes(" ")) return letzte === datum;
  return letzte >= termin;
}

/**
 * Soll dieses Abonnement jetzt eine Nachricht bekommen?
 *
 * Ja, wenn auf dem Gerät eine eingestellte Uhrzeit erreicht ist, für sie
 * noch keine Nachricht kam und laut Vorschau Karten warten. Zurück kommt
 * der Lerntag, die Uhrzeit (`termin`, zum Vermerken) und die Zahl, sonst
 * null.
 *
 * Fehlt der heutige Tag in der Vorschau (die App war über zwei Wochen nicht
 * offen), wird nichts gesendet: Eine geratene Zahl wäre schlimmer als keine.
 */
export function sollSenden({ abo, plan, zeit = Date.now() }) {
  return grundUndTermin({ abo, plan, zeit }).senden;
}

function grundUndTermin({ abo, plan, zeit }) {
  const t = letzterTermin({ zeitplan: abo.zeitplan, stunde: abo.stunde, zeitzone: abo.zeitzone, zeit });
  if (!t.hatTermine) return { grund: "frei", senden: null };
  if (!t.termin) return { grund: "zeit", senden: null };
  if (schonGesendet(abo.letzte, t)) return { grund: "heute", senden: null };
  if (!plan || plan[t.datum] === undefined) return { grund: "vorschau", senden: null };
  const anzahl = Number(plan[t.datum]);
  if (!anzahl) return { grund: "nichts", senden: null };
  return { grund: null, senden: { datum: t.datum, termin: t.termin, anzahl } };
}

/**
 * Warum gerade nichts gesendet wird — für die Zusammenfassung des
 * Absenders. Zurück kommt einer von: "frei" (heute ist keine Uhrzeit
 * eingestellt), "zeit" (die nächste noch nicht erreicht), "heute" (für die
 * letzte schon gesendet), "nichts" (keine Karte fällig), "vorschau" (für
 * heute keine Vorschau — das Gerät hat länger nicht abgeglichen), oder
 * null, wenn gesendet werden soll.
 */
export function grundOhneSenden({ abo, plan, zeit = Date.now() }) {
  return grundUndTermin({ abo, plan, zeit }).grund;
}

/** Der Text der Nachricht. Ruhig, eine Zahl, keine Drohung. */
export function nachricht(anzahl) {
  return {
    titel: "Anchor",
    text: anzahl === 1 ? "Heute wartet eine Karte." : "Heute warten " + anzahl + " Karten.",
  };
}

/*
 * Das Geheimnis für GitHub: Lesezeichen, öffentlicher und privater
 * Schlüssel, durch Punkte getrennt. Alle drei sind base64url und enthalten
 * darum selbst keinen Punkt.
 */
export function geheimnisZusammensetzen({ token, oeffentlich, privat }) {
  return ["anchor1", token, oeffentlich, privat].join(".");
}

export function geheimnisZerlegen(text) {
  const teile = String(text || "").trim().split(".");
  if (teile.length !== 4 || teile[0] !== "anchor1" || teile.some((t) => !t)) return null;
  const [, token, oeffentlich, privat] = teile;
  return { token, oeffentlich, privat };
}

export { TAG };
