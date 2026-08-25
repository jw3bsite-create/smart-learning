/*
 * Der Anschluss an ein Sprachmodell.
 *
 * Drei Grundsätze, die hier baulich durchgesetzt werden und nicht bloß gut
 * gemeint sind:
 *
 * 1. **Kein offenes Gespräch.** Diese Datei bietet keine Funktion an, die einen
 *    beliebigen Text an ein Modell schickt. Jeder Aufruf verlangt eine
 *    benannte Anweisung aus `prompts/`. Wer eine neue Fähigkeit will, schreibt
 *    eine neue Anweisung — und muss sie dabei aufschreiben und begründen.
 * 2. **Nichts geht unbemerkt hinaus.** Vor jedem Aufruf lässt sich abrufen,
 *    was genau gesendet würde (`vorschau`), und jeder erfolgte Aufruf landet in
 *    einem Protokoll auf dem Gerät.
 * 3. **Der Schlüssel bleibt hier.** Er wird lokal abgelegt und niemals mit der
 *    Wolke abgeglichen.
 *
 * Der bevorzugte Weg ist LM Studio auf demselben Rechner: kein Schlüssel, keine
 * Kosten, und die Vorlage — womöglich das Foto einer Buchseite — verlässt das
 * Gerät überhaupt nicht.
 */

import * as db from "./db.js";
import { anweisung } from "../../prompts/index.js";
import { id } from "./model.js";

export const ANBIETER = {
  lmstudio: {
    name: "LM Studio (auf diesem Rechner)",
    adresse: "http://localhost:1234/v1",
    schluesselNoetig: false,
    hinweis: "In LM Studio den Server starten (Reiter Developer, dann Start Server). "
      + "Nichts verlässt den Rechner.",
  },
  openai: {
    name: "OpenAI",
    adresse: "https://api.openai.com/v1",
    schluesselNoetig: true,
    hinweis: "Eigener Schlüssel nötig; jede Anfrage verlässt den Rechner und kostet.",
  },
  anthropic: {
    name: "Anthropic",
    adresse: "https://api.anthropic.com/v1",
    schluesselNoetig: true,
    hinweis: "Eigener Schlüssel nötig; jede Anfrage verlässt den Rechner und kostet.",
  },
};

const STANDARD = {
  anbieter: "lmstudio",
  adresse: ANBIETER.lmstudio.adresse,
  modell: "",
  schluessel: "",
  tagesbudget: 100,     // Aufrufe je Tag
  angeschaltet: true,
};

/* ------------------------------ Einrichtung ----------------------------- */

export async function zugangLesen() {
  return { ...STANDARD, ...((await db.getSetting("ki", null)) || {}) };
}

export async function zugangSchreiben(zugang) {
  await db.setSetting("ki", { ...STANDARD, ...zugang });
}

export function eingerichtet(zugang) {
  if (!zugang?.angeschaltet) return false;
  const anbieter = ANBIETER[zugang.anbieter];
  if (!anbieter) return false;
  if (anbieter.schluesselNoetig && !zugang.schluessel) return false;
  return Boolean(zugang.adresse);
}

/** Läuft der Dienst gerade? Bei LM Studio heißt das: Ist der Server an? */
export async function erreichbar(zugang) {
  if (!eingerichtet(zugang)) return { gut: false, text: "Nicht eingerichtet." };
  if (zugang.anbieter === "anthropic")
    return { gut: true, text: "Wird beim ersten Aufruf geprüft." };
  try {
    const antwort = await fetch(zugang.adresse.replace(/\/+$/, "") + "/models", {
      headers: zugang.schluessel ? { Authorization: "Bearer " + zugang.schluessel } : {},
    });
    if (!antwort.ok) return { gut: false, text: "Antwort " + antwort.status };
    const daten = await antwort.json().catch(() => null);
    const modelle = (daten?.data || []).map((m) => m.id);
    return { gut: true, text: modelle.length
      ? modelle.length + " Modelle bereit" : "erreichbar", modelle };
  } catch (e) {
    return { gut: false, text: zugang.anbieter === "lmstudio"
      ? "LM Studio antwortet nicht — läuft der Server?"
      : "Kein Anschluss: " + (e?.message || e) };
  }
}

/* ------------------------------ Protokoll ------------------------------- */

const heute = () => new Date().toISOString().slice(0, 10);

export async function verbrauchHeute() {
  const alle = await db.all("kilog", { mitGeloeschten: true });
  const tag = heute();
  return alle.filter((e) => e.tag === tag).length;
}

export async function protokoll(hoechstens = 50) {
  const alle = await db.all("kilog", { mitGeloeschten: true });
  return alle.sort((a, b) => b.zeit - a.zeit).slice(0, hoechstens);
}

async function protokolliere(eintrag) {
  await db.put("kilog", { id: id("p"), zeit: Date.now(), tag: heute(), ...eintrag });
}

/* -------------------------------- Aufruf -------------------------------- */

/**
 * Was ginge hinaus? Diese Vorschau ist der Kern von Grundsatz 2 — die
 * Oberfläche zeigt sie, ehe irgendetwas gesendet wird.
 */
export function vorschau({ prompt, werte = {}, nutzerText, bild = null }) {
  const a = anweisung(prompt, werte);
  return {
    anweisung: a.text,
    anweisungName: a.name + " (Fassung " + a.fassung + ")",
    nutzerText,
    mitBild: Boolean(bild),
    zeichen: (a.text.length + String(nutzerText || "").length),
  };
}

/**
 * Der einzige Weg, ein Modell zu fragen.
 *
 * `prompt` ist der Name einer Anweisung aus `prompts/` — nicht der Text selbst.
 * Das ist die bauliche Sperre gegen ein offenes Chatfenster: Ohne hinterlegte
 * Anweisung gibt es keinen Aufruf.
 */
export async function frage({
  prompt, werte = {}, nutzerText, bild = null,
  hoechstensZeichen = 4000, temperatur = 0.3, zweck = "",
}) {
  const zugang = await zugangLesen();
  if (!eingerichtet(zugang)) throw new Error("Die KI ist nicht eingerichtet.");

  const verbraucht = await verbrauchHeute();
  if (verbraucht >= (Number(zugang.tagesbudget) || 100))
    throw new Error("Das Tagesbudget von " + zugang.tagesbudget + " Aufrufen ist aufgebraucht.");

  const a = anweisung(prompt, werte);
  if (!a.text) throw new Error("Unbekannte Anweisung: " + prompt);

  const beginn = Date.now();
  let ergebnis = "";
  try {
    ergebnis = zugang.anbieter === "anthropic"
      ? await frageAnthropic(zugang, a.text, nutzerText, bild, hoechstensZeichen, temperatur)
      : await frageOffen(zugang, a.text, nutzerText, bild, hoechstensZeichen, temperatur);
  } catch (fehler) {
    await protokolliere({ prompt: a.name, fassung: a.fassung, zweck,
      anbieter: zugang.anbieter, gelungen: false, fehler: String(fehler.message || fehler),
      dauer: Date.now() - beginn, zeichenHin: String(nutzerText || "").length });
    throw fehler;
  }

  await protokolliere({ prompt: a.name, fassung: a.fassung, zweck,
    anbieter: zugang.anbieter, gelungen: true, dauer: Date.now() - beginn,
    zeichenHin: String(nutzerText || "").length, zeichenZurueck: ergebnis.length });

  return ergebnis;
}

/** Wie `frage`, erwartet aber ein JSON-Feld zurück. */
export async function frageJson(auftrag) {
  const roh = await frage(auftrag);
  const sauber = roh.trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
  try {
    return JSON.parse(sauber);
  } catch (e) {
    // Manche Modelle plaudern vor dem JSON. Das erste Feld herausschneiden.
    const von = sauber.indexOf("[");
    const bis = sauber.lastIndexOf("]");
    if (von >= 0 && bis > von) {
      try { return JSON.parse(sauber.slice(von, bis + 1)); } catch (e2) { /* gleich */ }
    }
    throw new Error("Die Antwort war kein brauchbares JSON.");
  }
}

/* --------------------------- Die zwei Schnittstellen -------------------- */

/** OpenAI-kompatibel — das spricht auch LM Studio. */
async function frageOffen(zugang, systemText, nutzerText, bild, hoechstens, temperatur) {
  const inhalt = bild
    ? [{ type: "text", text: nutzerText || "" },
       { type: "image_url", image_url: { url: bild } }]
    : (nutzerText || "");

  const antwort = await fetch(zugang.adresse.replace(/\/+$/, "") + "/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(zugang.schluessel ? { Authorization: "Bearer " + zugang.schluessel } : {}),
    },
    body: JSON.stringify({
      model: zugang.modell || "local-model",
      messages: [
        { role: "system", content: systemText },
        { role: "user", content: inhalt },
      ],
      temperature: temperatur,
      max_tokens: Math.ceil(hoechstens / 3),
    }),
  });
  if (!antwort.ok) {
    const text = await antwort.text().catch(() => "");
    throw new Error("Das Modell antwortete mit " + antwort.status +
      (text ? ": " + text.slice(0, 200) : ""));
  }
  const daten = await antwort.json();
  return daten?.choices?.[0]?.message?.content || "";
}

async function frageAnthropic(zugang, systemText, nutzerText, bild, hoechstens, temperatur) {
  const inhalt = bild
    ? [{ type: "image", source: { type: "base64",
         media_type: bild.slice(5, bild.indexOf(";")), data: bild.slice(bild.indexOf(",") + 1) } },
       { type: "text", text: nutzerText || "" }]
    : [{ type: "text", text: nutzerText || "" }];

  const antwort = await fetch(zugang.adresse.replace(/\/+$/, "") + "/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": zugang.schluessel,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: zugang.modell || "claude-sonnet-5",
      system: systemText,
      messages: [{ role: "user", content: inhalt }],
      max_tokens: Math.ceil(hoechstens / 3),
      temperature: temperatur,
    }),
  });
  if (!antwort.ok) {
    const text = await antwort.text().catch(() => "");
    throw new Error("Das Modell antwortete mit " + antwort.status +
      (text ? ": " + text.slice(0, 200) : ""));
  }
  const daten = await antwort.json();
  return (daten?.content || []).filter((t) => t.type === "text")
    .map((t) => t.text).join("\n");
}
