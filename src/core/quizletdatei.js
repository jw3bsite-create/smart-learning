/*
 * Ein Quizlet-Stapel aus einer Datei.
 *
 * Fremde Stapel gibt Quizlet weder als Text heraus, noch lässt es sie ohne
 * Plus kopieren. Sichern lässt sich die Seite aber immer:
 *
 *   am iPhone   in Safari: Teilen → In Dateien sichern (PDF oder Webarchiv)
 *   am Rechner  Strg + P → Als PDF speichern, oder Strg + S (Webseite)
 *
 * Diese Dateien liest Anchor hier. Erkannt wird die Art am Inhalt, nicht am
 * Namen — das iPhone hängt nicht immer die passende Endung an.
 *
 *   PDF        Text mit seiner Lage auf der Seite (pdf.js). Daraus werden
 *              Zeilen, und aus den Zeilen Paare: nebeneinander (Tabelle, so
 *              druckt der Rechner) oder untereinander in Blöcken (so steht es
 *              auf dem Telefon). Siehe `paareAusZeilen`.
 *   Webarchiv  Safaris Format, eine binäre Eigenschaftsliste mit der Seite
 *              darin (`bplistLesen`).
 *   MHTML      „Webseite, einzelne Datei“ aus Edge: die Seite in einer
 *              Mail-Hülle (`mhtmlHtml`).
 *   HTML       die Seite selbst. Gelesen wie vom Quizlet-Knopf.
 *
 * Zurück kommt immer Text mit Tabulator zwischen den Seiten, eine Karte je
 * Zeile. Er läuft danach durch dieselbe Durchsicht wie alles Eingefügte.
 */

import { quizletLesen, aufbereiten, nurQuizletLink, SEITEN_KOPF } from "./importer.js";
import { quizletKnopf } from "./quizletknopf.js";

/* --------------------------------- Art ---------------------------------- */

const ascii = (b, von, bis) => String.fromCharCode(...b.subarray(von, bis));

export function artErkennen(bytes) {
  if (ascii(bytes, 0, 5) === "%PDF-") return "pdf";
  if (ascii(bytes, 0, 8) === "bplist00") return "webarchiv";
  // TextDecoder wirft eine Byte-Marke am Anfang von sich aus weg.
  const anfang = new TextDecoder("utf-8").decode(bytes.subarray(0, 4000));
  if (/^\s*(from:|mime-version:|content-type:\s*multipart)/im.test(anfang)
    && /multipart\/related/i.test(anfang)) return "mhtml";
  if (/^\s*(<!doctype html|<html|<head|<meta)/i.test(anfang)) return "html";
  return "text";
}

/* ------------------------------ Webarchiv -------------------------------- */

/**
 * Eine binäre Eigenschaftsliste (Apples „bplist00“) lesen. Nur, was ein
 * Webarchiv braucht: Wahrheitswerte, Zahlen, Daten, Texte, Listen, Tabellen.
 */
export function bplistLesen(b) {
  if (ascii(b, 0, 8) !== "bplist00") throw new Error("Keine Eigenschaftsliste.");
  const zahl = (o, n) => { let v = 0; for (let i = 0; i < n; i++) v = v * 256 + b[o + i]; return v; };
  const t = b.length - 32;
  const versatzGroesse = b[t + 6];
  const verweisGroesse = b[t + 7];
  const wurzel = zahl(t + 16, 8);
  const tabelle = zahl(t + 24, 8);
  const versatz = (i) => zahl(tabelle + i * versatzGroesse, versatzGroesse);
  const ansicht = new DataView(b.buffer, b.byteOffset, b.byteLength);

  /* Längen über 14 stehen in einem eigenen Zahlenobjekt dahinter. */
  const laenge = (o, info) => {
    if (info !== 0xF) return [info, o + 1];
    const n = 1 << (b[o + 1] & 0xF);
    return [zahl(o + 2, n), o + 2 + n];
  };

  const lesen = (i, tiefe = 0) => {
    if (tiefe > 64) throw new Error("Zu tief verschachtelt.");
    const o = versatz(i);
    const art = b[o] >> 4;
    const info = b[o] & 0xF;
    switch (art) {
      case 0x0: return info === 8 ? false : info === 9 ? true : null;
      case 0x1: return zahl(o + 1, 1 << info);
      case 0x2: return info === 2 ? ansicht.getFloat32(o + 1) : ansicht.getFloat64(o + 1);
      case 0x3: return new Date(Date.UTC(2001, 0, 1) + ansicht.getFloat64(o + 1) * 1000);
      case 0x4: { const [n, s] = laenge(o, info); return b.subarray(s, s + n); }
      case 0x5: { const [n, s] = laenge(o, info); return ascii(b, s, s + n); }
      case 0x6: {
        const [n, s] = laenge(o, info);
        let text = "";
        for (let k = 0; k < n; k++) text += String.fromCharCode(ansicht.getUint16(s + 2 * k));
        return text;
      }
      case 0x8: return zahl(o + 1, info + 1);
      case 0xA: {
        const [n, s] = laenge(o, info);
        return Array.from({ length: n }, (_, k) => lesen(zahl(s + k * verweisGroesse, verweisGroesse), tiefe + 1));
      }
      case 0xD: {
        const [n, s] = laenge(o, info);
        const aus = {};
        for (let k = 0; k < n; k++) {
          const schluessel = lesen(zahl(s + k * verweisGroesse, verweisGroesse), tiefe + 1);
          aus[schluessel] = lesen(zahl(s + (n + k) * verweisGroesse, verweisGroesse), tiefe + 1);
        }
        return aus;
      }
      default: return null;
    }
  };
  return lesen(wurzel);
}

/** Die Seite aus einem Safari-Webarchiv. */
export function webarchivHtml(bytes) {
  const haupt = bplistLesen(bytes)?.WebMainResource;
  const daten = haupt?.WebResourceData;
  if (!(daten instanceof Uint8Array)) throw new Error("Im Webarchiv steht keine Seite.");
  const kodierung = String(haupt.WebResourceTextEncodingName || "utf-8").toLowerCase();
  try { return new TextDecoder(kodierung).decode(daten); }
  catch (f) { return new TextDecoder("utf-8").decode(daten); }
}

/* -------------------------------- MHTML ---------------------------------- */

function quotedPrintable(text) {
  const ohne = text.replace(/=\r?\n/g, "");
  const bytes = [];
  for (let i = 0; i < ohne.length; i++) {
    if (ohne[i] === "=" && /^[0-9A-F]{2}$/i.test(ohne.slice(i + 1, i + 3))) {
      bytes.push(parseInt(ohne.slice(i + 1, i + 3), 16)); i += 2;
    } else bytes.push(ohne.charCodeAt(i) & 0xFF);
  }
  return new Uint8Array(bytes);
}

/** Der HTML-Teil einer MHTML-Datei („Webseite, einzelne Datei“). */
export function mhtmlHtml(text) {
  const grenze = /boundary="?([^";\r\n]+)"?/i.exec(text)?.[1];
  if (!grenze) return null;
  for (const teil of text.split("--" + grenze)) {
    const trenn = /\r?\n\r?\n/.exec(teil);
    if (!trenn) continue;
    const kopf = teil.slice(0, trenn.index);
    if (!/content-type:\s*text\/html/i.test(kopf)) continue;
    const rumpf = teil.slice(trenn.index + trenn[0].length);
    const kodierung = /content-transfer-encoding:\s*([\w-]+)/i.exec(kopf)?.[1]?.toLowerCase();
    if (kodierung === "quoted-printable") return new TextDecoder("utf-8").decode(quotedPrintable(rumpf));
    if (kodierung === "base64") {
      const roh = atob(rumpf.replace(/\s+/g, ""));
      return new TextDecoder("utf-8").decode(Uint8Array.from(roh, (c) => c.charCodeAt(0)));
    }
    return rumpf;
  }
  return null;
}

/* --------------------------------- HTML ---------------------------------- */

/** Paare aus einer gesicherten Quizlet-Seite — wie der Quizlet-Knopf sie liest. */
export function htmlPaare(html) {
  const dok = new DOMParser().parseFromString(html, "text/html");
  const paare = quizletKnopf("", true, dok).map(([term, definition]) => ({ term, definition }));
  if (paare.length) return { paare, uebrig: [], spalte: "seite" };
  // Sonst der sichtbare Text, etwa in abwechselnden Zeilen unter der Überschrift.
  dok.querySelectorAll("script, style, noscript").forEach((e) => e.remove());
  return quizletLesen(dok.body?.innerText ?? dok.body?.textContent ?? "");
}

/* ---------------------------------- PDF ---------------------------------- */

/*
 * Textstücke einer PDF zu Zeilen. Ein Stück: { str, x, y, w, h, seite },
 * y wächst nach unten. Auf einer Zeile liegt, was fast dieselbe Höhe hat;
 * innerhalb der Zeile trennt eine weite Lücke zwei Spalten.
 */
export function zeilenBilden(stuecke) {
  const sortiert = stuecke.filter((s) => s.str && s.str.trim())
    .sort((a, b) => a.seite - b.seite || a.y - b.y || a.x - b.x);
  const zeilen = [];
  for (const s of sortiert) {
    const z = zeilen[zeilen.length - 1];
    if (z && z.seite === s.seite && Math.abs(z.y - s.y) <= Math.max(2, 0.45 * Math.max(z.h, s.h))) {
      z.stuecke.push(s); z.h = Math.max(z.h, s.h);
    } else zeilen.push({ seite: s.seite, y: s.y, h: s.h, stuecke: [s] });
  }
  return zeilen.map((z) => {
    const teile = [];
    for (const s of z.stuecke.sort((a, b) => a.x - b.x)) {
      const letzter = teile[teile.length - 1];
      const luecke = letzter ? s.x - letzter.ende : Infinity;
      if (letzter && luecke <= Math.max(14, 1.6 * z.h)) {
        letzter.text += (luecke > 0.15 * z.h && !letzter.text.endsWith(" ") ? " " : "") + s.str;
        letzter.ende = Math.max(letzter.ende, s.x + s.w);
      } else teile.push({ text: s.str, x: s.x, ende: s.x + s.w });
    }
    for (const t of teile) t.text = t.text.replace(/\s+/g, " ").trim();
    return { seite: z.seite, y: z.y, h: z.h, teile: teile.filter((t) => t.text) };
  }).filter((z) => z.teile.length);
}

/* Was eine Seite außer den Karten trägt: Kopf- und Fußzeilen des Druckens,
   Seitenzahlen, Links. */
const RAND = [
  /^https?:\/\//i,
  /^\d+\s*(\/|von|of)\s*\d+$/i,
  /^\d{1,2}[./]\d{1,2}[./]\d{2,4},?\s+\d{1,2}:\d{2}/,
];
/* Wo die Begriffsliste auf der Quizlet-Seite endet. */
const LISTEN_ENDE = /^(ähnliche|andere|weitere|neueste|empfohlene) (lern)?sets|^(other|similar|recommended) (study )?sets|^sets found in|^lehrbuchlösungen|^textbook solutions/i;

const text = (z) => z.teile.map((t) => t.text).join(" ");
const mitte = (zahlen) => { const s = [...zahlen].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] ?? 0; };

/**
 * Aus Zeilen Kartenpaare. Drei Lesarten, die erste, die passt:
 *
 *   tabelle  Die meisten Zeilen haben zwei Spalten: links der Begriff,
 *            rechts die Definition. Eine Zeile mit nur einer Spalte setzt
 *            fort, was in ihrer Spalte darüber steht.
 *   bloecke  Untereinander, die Karten durch größere Abstände getrennt:
 *            die erste Zeile eines Blocks ist der Begriff, der Rest die
 *            Definition.
 *   abwechselnd  Sonst Zeile um Zeile, wie beim Markieren der Seite.
 */
export function paareAusZeilen(alle) {
  let zeilen = alle.filter((z) => !RAND.some((r) => r.test(text(z))));
  const kopf = zeilen.findIndex((z) => SEITEN_KOPF.test(text(z)));
  if (kopf >= 0) zeilen = zeilen.slice(kopf + 1);
  const ende = zeilen.findIndex((z) => LISTEN_ENDE.test(text(z)));
  if (ende >= 0) zeilen = zeilen.slice(0, ende);
  if (!zeilen.length) return { paare: [], uebrig: [], spalte: "tabelle" };

  const zweispaltig = zeilen.filter((z) => z.teile.length >= 2);
  if (zweispaltig.length >= 2 && zweispaltig.length >= 0.5 * zeilen.length) {
    const links = mitte(zweispaltig.map((z) => z.teile[0].x));
    const rechts = mitte(zweispaltig.map((z) => z.teile[1].x));
    const roh = [];
    const uebrig = [];
    for (const z of zeilen) {
      if (z.teile.length >= 2) {
        roh.push({ term: z.teile[0].text, definition: z.teile.slice(1).map((t) => t.text).join(" ") });
        continue;
      }
      const t = z.teile[0];
      const letzte = roh[roh.length - 1];
      if (!letzte) { uebrig.push(t.text); continue; }
      if (Math.abs(t.x - rechts) < Math.abs(t.x - links)) letzte.definition += " " + t.text;
      else letzte.term += " " + t.text;
    }
    return { ...aufbereiten(roh), uebrig, spalte: "tabelle" };
  }

  /* Blöcke: Ein Abstand deutlich über dem üblichen Zeilenabstand trennt Karten. */
  const abstaende = [];
  for (let i = 1; i < zeilen.length; i++)
    if (zeilen[i].seite === zeilen[i - 1].seite) abstaende.push(zeilen[i].y - zeilen[i - 1].y);
  const ueblich = mitte(abstaende) || 1;
  const bloecke = [[zeilen[0]]];
  for (let i = 1; i < zeilen.length; i++) {
    const neu = zeilen[i].seite !== zeilen[i - 1].seite
      ? false
      : zeilen[i].y - zeilen[i - 1].y > 1.6 * ueblich;
    if (neu) bloecke.push([zeilen[i]]); else bloecke[bloecke.length - 1].push(zeilen[i]);
  }
  const mehrzeilig = bloecke.filter((b) => b.length >= 2);
  if (bloecke.length >= 2 && mehrzeilig.length >= 0.6 * bloecke.length) {
    const roh = [];
    const uebrig = [];
    for (const b of bloecke) {
      if (b.length < 2) { uebrig.push(text(b[0])); continue; }
      roh.push({ term: text(b[0]), definition: b.slice(1).map(text).join(" ") });
    }
    return { ...aufbereiten(roh), uebrig, spalte: "bloecke" };
  }

  return quizletLesen(zeilen.map(text).join("\n"), { abwechselnd: true });
}

/**
 * Die Textstücke einer PDF. `pdfjs` wird hereingereicht: im Browser mit
 * eigenem Arbeitsfaden geladen (`pdfjsLaden`), in den Prüfungen aus Node.
 */
export async function pdfStuecke(bytes, pdfjs) {
  // verbosity 0: Eine PDF ohne eingebettete Schrift löst eine Warnung aus,
  // das Lesen des Textes stört sie nicht.
  const laden = pdfjs.getDocument({ data: bytes, isEvalSupported: false, verbosity: 0 });
  const dokument = await laden.promise;
  const stuecke = [];
  for (let n = 1; n <= dokument.numPages; n++) {
    const seite = await dokument.getPage(n);
    const hoehe = seite.getViewport({ scale: 1 }).height;
    const inhalt = await seite.getTextContent();
    for (const s of inhalt.items) {
      if (!s.str) continue;
      const [, , , d, x, y] = s.transform;
      const h = Math.abs(d) || s.height || 10;
      stuecke.push({ str: s.str, x, y: hoehe - y, w: s.width, h, seite: n });
    }
  }
  await laden.destroy();
  return stuecke;
}

/* pdf.js erst laden, wenn wirklich eine PDF kommt — es ist groß. */
async function pdfjsLaden() {
  const [pdfjs, arbeiter] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = arbeiter.default;
  return pdfjs;
}

/* -------------------------------- Ablauf --------------------------------- */

const ART_NAME = { pdf: "PDF", webarchiv: "Webarchiv", mhtml: "Webseite", html: "Webseite", text: "Text" };

/**
 * Eine gewählte Datei lesen. Zurück kommt { art, artName, text, anzahl,
 * hinweis }: `text` für das Eingabefeld, `hinweis`, wenn nichts zu finden
 * war — mit dem, was vermutlich fehlt.
 */
export async function dateiLesen(datei) {
  const bytes = new Uint8Array(await datei.arrayBuffer());
  const art = artErkennen(bytes);
  let ergebnis;
  if (art === "text") {
    const roh = new TextDecoder("utf-8").decode(bytes);
    if (nurQuizletLink(roh) || /^\s*\[InternetShortcut\]/i.test(roh) || /<plist[\s\S]*quizlet\.com/i.test(roh)) {
      return { art: "link", artName: "Link", text: "", anzahl: 0,
        hinweis: "In dieser Datei steht nur der Link zum Stapel, nicht die Karten. Das passiert, "
          + "wenn man aus der Quizlet-App teilt. Öffne den Stapel stattdessen in Safari und sichere "
          + "dort die Seite (Teilen → Optionen → PDF → In Dateien sichern)." };
    }
    return { art, artName: ART_NAME[art], text: roh, anzahl: quizletLesen(roh).paare.length, hinweis: "" };
  }
  if (art === "pdf") ergebnis = paareAusZeilen(zeilenBilden(await pdfStuecke(bytes, await pdfjsLaden())));
  else if (art === "webarchiv") ergebnis = htmlPaare(webarchivHtml(bytes));
  else if (art === "mhtml") ergebnis = htmlPaare(mhtmlHtml(new TextDecoder("utf-8").decode(bytes)) || "");
  else ergebnis = htmlPaare(new TextDecoder("utf-8").decode(bytes));

  const paare = ergebnis.paare || [];
  return {
    art, artName: ART_NAME[art], anzahl: paare.length,
    text: paare.map((p) => p.term + "\t" + p.definition).join("\n"),
    hinweis: paare.length ? "" : "In der Datei stehen keine Karten, die Anchor erkennt. Hast du vor dem "
      + "Sichern bis zur Liste aller Begriffe gescrollt? Gesichert werden muss die Seite des Stapels "
      + "selbst, nicht die Lernansicht.",
  };
}
