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
 *   3. Ein Auftrag auf GitHub läuft stündlich (werkzeug/push-senden.mjs),
 *      liest beides über eine geschützte Funktion und schickt die Nachricht,
 *      sobald auf dem Gerät die eingestellte Stunde erreicht ist
 *      (`sollSenden`).
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

/**
 * Datum und Stunde in einer Zeitzone — auf dem Server, der in UTC läuft,
 * muss „17 Uhr" die Uhrzeit des Handys meinen.
 */
export function ortszeit(zeit, zeitzone = "Europe/Berlin") {
  let teile;
  try {
    teile = new Intl.DateTimeFormat("en-CA", {
      timeZone: zeitzone, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date(zeit));
  } catch (e) {
    return ortszeit(zeit, "Europe/Berlin");
  }
  const w = Object.fromEntries(teile.map((t) => [t.type, t.value]));
  const stunde = Number(w.hour) % 24;
  // Vor 4 Uhr gehört die Stunde noch zum Lerntag davor.
  if (stunde < TAGESWECHSEL) {
    return { datum: ortszeit(zeit - (stunde + 1) * 3600000, zeitzone).datum, stunde };
  }
  return { datum: w.year + "-" + w.month + "-" + w.day, stunde };
}

/**
 * Soll dieses Abonnement jetzt eine Nachricht bekommen?
 *
 * Ja, wenn auf dem Gerät die eingestellte Stunde erreicht ist, heute noch
 * keine kam und laut Vorschau Karten warten. Zurück kommt der Tag und die
 * Zahl, sonst null.
 *
 * Fehlt der heutige Tag in der Vorschau (die App war über zwei Wochen nicht
 * offen), wird nichts gesendet: Eine geratene Zahl wäre schlimmer als keine.
 */
export function sollSenden({ abo, plan, zeit = Date.now() }) {
  const { datum, stunde } = ortszeit(zeit, abo.zeitzone);
  if (stunde < Number(abo.stunde ?? 17)) return null;
  if (abo.letzte === datum) return null;
  const anzahl = Number(plan?.[datum] ?? 0);
  if (!anzahl) return null;
  return { datum, anzahl };
}

/**
 * Warum gerade nichts gesendet wird — für die Zusammenfassung des
 * Absenders. Zurück kommt einer von: "zeit" (Stunde noch nicht erreicht),
 * "heute" (heute schon gesendet), "nichts" (keine Karte fällig),
 * "vorschau" (für heute keine Vorschau — das Gerät hat länger nicht
 * abgeglichen), oder null, wenn gesendet werden soll.
 */
export function grundOhneSenden({ abo, plan, zeit = Date.now() }) {
  const { datum, stunde } = ortszeit(zeit, abo.zeitzone);
  if (stunde < Number(abo.stunde ?? 17)) return "zeit";
  if (abo.letzte === datum) return "heute";
  if (!plan || plan[datum] === undefined) return "vorschau";
  if (!Number(plan[datum])) return "nichts";
  return null;
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
