/*
 * Schickt die Tageserinnerung als Push-Nachricht — läuft auf GitHub,
 * stündlich (.github/workflows/push-erinnerung.yml).
 *
 * Braucht drei Geheimnisse des Projekts auf GitHub:
 *   WOLKE_URL         die Project URL von Supabase
 *   WOLKE_SCHLUESSEL  der öffentliche Schlüssel (anon / publishable)
 *   ANCHOR_PUSH       die Zeichenkette, die Anchor beim Einrichten zeigt
 *
 * Die Protokolle eines öffentlichen Projekts kann jeder lesen. Darum steht
 * darin nichts über Geräte, Adressen oder Kartenzahlen — nur, wie viele
 * Nachrichten hinausgingen.
 */

import webpush from "web-push";
import { geheimnisZerlegen, sollSenden, nachricht } from "../src/core/pushplan.js";

const ABSENDER = "https://jw3bsite-create.github.io/smart-learning/";

export async function senden({ url, schluessel, geheimnis, zeit = Date.now(),
  holen = fetch, schicken = (abo, inhalt, opt) => webpush.sendNotification(abo, inhalt, opt) }) {
  const g = geheimnisZerlegen(geheimnis);
  if (!g) throw new Error("ANCHOR_PUSH hat nicht die erwartete Form. Richte Push in Anchor neu ein.");
  webpush.setVapidDetails(ABSENDER, g.oeffentlich, g.privat);

  const adresse = String(url || "").replace(/\/+$/, "");
  const rpc = async (name, koerper) => {
    const antwort = await holen(adresse + "/rest/v1/rpc/" + name, {
      method: "POST",
      headers: {
        apikey: schluessel, Authorization: "Bearer " + schluessel,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(koerper),
    });
    if (!antwort.ok) throw new Error(name + " antwortet mit " + antwort.status
      + (antwort.status === 404 ? " — ist wolke.sql in Fassung 4 ausgeführt?" : ""));
    const text = await antwort.text();
    return text ? JSON.parse(text) : null;
  };

  const auftraege = (await rpc("anchor_push_auftraege", { geheimnis: g.token })) || [];
  const stand = { abos: auftraege.length, gesendet: 0, entfernt: 0, fehler: 0 };

  for (const a of auftraege) {
    const faellig = sollSenden({ abo: a, plan: a.plan, zeit });
    if (!faellig) continue;
    const inhalt = JSON.stringify({ ...nachricht(faellig.anzahl), weg: "./#/abrufen" });
    try {
      // Sechs Stunden Gültigkeit: Ist das Handy bis dahin aus, verfällt die
      // Nachricht, statt nachts nachzukommen.
      await schicken(a.abo, inhalt, { TTL: 6 * 3600, urgency: "normal" });
      await rpc("anchor_push_vermerken", { geheimnis: g.token, endpunkt: a.endpoint, datum: faellig.datum });
      stand.gesendet += 1;
    } catch (f) {
      // 404/410: Das Gerät hat das Abonnement aufgegeben (App gelöscht,
      // Erlaubnis entzogen). Es kommt nicht wieder; die Zeile kann weg.
      if (f?.statusCode === 404 || f?.statusCode === 410) {
        await rpc("anchor_push_vermerken", { geheimnis: g.token, endpunkt: a.endpoint,
          datum: faellig.datum, entfernen: true });
        stand.entfernt += 1;
      } else {
        stand.fehler += 1;
        console.log("::warning::Ein Push-Dienst antwortete mit " + (f?.statusCode || "keiner Antwort") + ".");
      }
    }
  }
  return stand;
}

/* Aufruf als Skript. */
if (process.argv[1]?.endsWith("push-senden.mjs")) {
  const { WOLKE_URL, WOLKE_SCHLUESSEL, ANCHOR_PUSH } = process.env;
  if (!WOLKE_URL || !WOLKE_SCHLUESSEL || !ANCHOR_PUSH) {
    console.log("Nicht alle Geheimnisse hinterlegt (WOLKE_URL, WOLKE_SCHLUESSEL, ANCHOR_PUSH) — nichts zu tun.");
    process.exit(0);
  }
  try {
    const s = await senden({ url: WOLKE_URL, schluessel: WOLKE_SCHLUESSEL, geheimnis: ANCHOR_PUSH });
    console.log(`Geräte: ${s.abos}, gesendet: ${s.gesendet}, abgemeldete entfernt: ${s.entfernt}, `
      + `fehlgeschlagen: ${s.fehler}.`);
  } catch (f) {
    console.log("::error::" + (f?.message || f));
    process.exit(1);
  }
}
