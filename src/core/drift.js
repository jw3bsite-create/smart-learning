/*
 * Drift-Erkennung.
 *
 * Sprachmodelle kehren im Verlauf eines Gesprächs zuverlässig zu ihrer
 * dienstfertigen Grundtendenz zurück: Erst fragen sie noch, dann erklären sie,
 * dann liefern sie doch die Lösung. Eine Anweisung am Anfang hält das nicht auf
 * Dauer durch.
 *
 * Diese Datei prüft jede Antwort, ehe sie angezeigt wird — deterministisch, im
 * Browser, ohne zweiten Modellaufruf. Sie kann nicht alles fangen; sie fängt
 * das, was sich zählen lässt: zu lang, Codeblock, Rechenweg, Lösungsfloskeln.
 *
 * Findet sie etwas, blendet die Oberfläche eine Warnung ein und bietet an, die
 * Regeln neu einzuspielen. Das ist kein Misstrauen gegen das Modell, sondern
 * eine Eigenschaft der Sache.
 */

/** Mehr als so viele Sätze gilt als Vortrag, nicht als Frage. */
export const SAETZE_HOECHSTENS = 4;

/** Wendungen, die eine Lösung ankündigen. */
const LOESUNGSFLOSKELN = [
  /\bdie (richtige )?(lösung|antwort) (ist|lautet|wäre)\b/i,
  /\bdas ergebnis (ist|lautet|wäre)\b/i,
  /\brichtig (ist|wäre) (also )?\b.{0,40}\b(weil|denn)\b/i,
  /\bhier ist (der|die|das|ein)\b/i,
  /\bso (geht|löst man) (es|das)\b/i,
  /\bzusammengefasst\b/i,
  /\bin summe (ergibt|erhält)\b/i,
  // Eine benannte Größe, gefolgt von ihrem Wert — das ist eine Lösung,
  // gleichgültig wie beiläufig sie eingeleitet wird.
  /\b(lautet|ergibt|beträgt|ist gleich)\s+[^.?!]{0,30}[=\d]/i,
];

/**
 * Rechenwege und Formeln.
 *
 * Streng gefasst: In Mathematik und Chemie hat ein Gleichheitszeichen mit
 * einem Ergebnis dahinter in einer Tutorantwort nichts zu suchen. Lieber ein
 * Fehlalarm zu viel — die Warnung blockiert nichts, sie macht nur sichtbar,
 * dass das Modell zu rechnen begonnen hat.
 */
const RECHENWEG = [
  /=\s*-?[\d(]/,                          // „= 23", „= (a+b)"
  /=\s*[a-zA-Z][\d^_']/,                  // „= 2x", „= x^2"
  /\d\s*[+\-*/·×÷]\s*\d/,                 // „3 * 7"
  /\\frac|\\int|\\sum|\\sqrt/,          // Formelsatz
  /\bf'?\s*\(\s*x\s*\)\s*=/,              // „f'(x) ="
];

/** Jahreszahlen und Zuschreibungen — bei GMT ohne Kennzeichnung heikel. */
const JAHRESZAHL = /\b(1[5-9]\d\d|20[0-2]\d)\b/;

/** Wörter, an denen man eine Wertung erkennt. */
const WERTUNG = /\b(besser|schlechter|gerechter|sinnvoller|sollte|müsste|richtig(er)?|falsch(er)?|wichtiger|vorteilhaft)\b/i;
/** Codeblöcke und alles, was sich abtippen ließe. */
const CODEBLOCK = /```|^\s{4,}\S+.*[;{}()]\s*$/m;
const CODEZEILEN = /\b(def |function |class |public |private |import |print\(|console\.log|SELECT .+ FROM)/i;

/** Grob in Sätze zerlegen. Abkürzungen mit Punkt sollen nicht mitzählen. */
export function saetzeZaehlen(text) {
  // Gängige Abkürzungen samt ihrer Punkte entfernen, sonst zählt „z. B."
  // als zwei Sätze.
  const bereinigt = String(text || "")
    .replace(/\bz\.\s*B\./gi, "zB")
    .replace(/\bd\.\s*h\./gi, "dh")
    .replace(/\bu\.\s*a\./gi, "ua")
    .replace(/\bs\.\s*o\./gi, "so")
    .replace(/\b(bzw|vgl|ca|Nr|Abb|evtl|inkl|ggf|usw|etc)\./gi, "$1")
    .replace(/\bS\.\s*\d+/g, "S")
    .replace(/\b\d+\./g, "");
  const treffer = bereinigt.match(/[^.!?]+[.!?]+/g);
  if (!treffer) return bereinigt.trim() ? 1 : 0;
  return treffer.filter((s) => s.trim().length > 3).length;
}
/**
 * Prüft eine Tutorantwort.
 * → { sauber, gruende: [...] }
 *
 * `fach` verschärft die Prüfung dort, wo das Fach eine eigene Sperre hat.
 */
export function pruefeAntwort(text, fach = null) {
  const gruende = [];
  const roh = String(text || "");

  const saetze = saetzeZaehlen(roh);
  if (saetze > SAETZE_HOECHSTENS)
    gruende.push({ art: "zuLang", text: saetze + " Sätze statt höchstens " + SAETZE_HOECHSTENS });

  if (LOESUNGSFLOSKELN.some((m) => m.test(roh)))
    gruende.push({ art: "loesung", text: "klingt nach einer fertigen Lösung" });

  if (CODEBLOCK.test(roh) || CODEZEILEN.test(roh))
    gruende.push({ art: "code", text: "enthält Code" });

  if ((fach === "mathe" || fach === "chemie") && RECHENWEG.some((m) => m.test(roh)))
    gruende.push({ art: "rechnung", text: "enthält einen Rechenweg" });

  // Mehr als eine Frage widerspricht der Grundregel „eine Frage pro Nachricht".
  const fragezeichen = (roh.match(/\?/g) || []).length;
  if (fragezeichen > 1)
    gruende.push({ art: "vieleFragen", text: fragezeichen + " Fragen auf einmal" });

  /* Gemeinschaftskunde: Jede Aussage von einiger Länge muss gekennzeichnet
     sein. Vierzig Zeichen reichen für eine Wertung — „X ist gerechter, weil …"
     hat keine achtzig. */
  if (fach === "ggk" && !/\[FAKT\]|\[WERTUNG\]/.test(roh)
    && (roh.length > 40 || WERTUNG.test(roh)))
    gruende.push({ art: "ungekennzeichnet", text: "ohne [FAKT] und [WERTUNG]" });

  /* Gestaltung: Jahreszahlen und Zuschreibungen sind die Stelle, an der
     Modelle munter erfinden. Ohne Vorbehalt gilt das als Abweichung. */
  if (fach === "gmt" && JAHRESZAHL.test(roh) && !/UNSICHER/.test(roh))
    gruende.push({ art: "unbelegt", text: "nennt eine Jahreszahl ohne Vorbehalt" });

  return { sauber: gruende.length === 0, gruende, saetze };
}

/** Kurzer Text für die Warnung in der Oberfläche. */
export function driftText(gruende) {
  if (!gruende.length) return "";
  const namen = {
    zuLang: "wird ausführlich",
    loesung: "gibt die Lösung preis",
    code: "schreibt Code",
    rechnung: "rechnet",
    vieleFragen: "fragt mehreres auf einmal",
    ungekennzeichnet: "trennt Fakt und Wertung nicht",
    unbelegt: "nennt Jahreszahlen ohne Vorbehalt",
  };
  return gruende.map((g) => namen[g.art] || g.art).join(", ");
}

/**
 * Der Text, mit dem die Regeln neu eingespielt werden.
 * Er geht als Nutzernachricht hinaus — das wirkt bei den meisten Modellen
 * stärker als eine erneute Systemanweisung im selben Gespräch.
 */
export const ZURUECK_TEXT =
  "Halt. Du hast deine Regeln verlassen: keine Lösung, kein Code, keine "
  + "Rechnung, eine Frage, höchstens vier Sätze. Stell deine letzte Frage neu, "
  + "kürzer und ohne Vorgriff auf die Antwort.";
