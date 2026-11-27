/*
 * Die Warteschlange — was als Nächstes drankommt.
 *
 * Der Nutzer wählt Fach und Umfang. Welche Karten das sind, entscheidet der
 * Plan (§3.1): erst was fällig ist, dann so viele neue, wie das Tageslimit des
 * Fachs noch zulässt. Keine Themenauswahl, keine Kartenauswahl.
 *
 * Die Reihenfolge innerhalb der Sitzung ist gemischt — auch das ist Absicht:
 * Beim Verschachteln muss man zuerst erkennen, worum es überhaupt geht, ehe
 * man antwortet. Genau diese Leistung verlangt später auch die Prüfung.
 */

import { istFaellig, istNeu } from "./fsrs.js";
import { richtungenFuer, istRelevant, ruht } from "./model.js";
import { mische, lerntagBeginn } from "./util.js";

const TAG = 24 * 3600 * 1000;

/* Der Lerntag beginnt um 4 Uhr (siehe util.js). */
function tagesBeginn(zeit = Date.now()) {
  return lerntagBeginn(zeit);
}

/**
 * Wie viele Karten heute schon neu eingeführt wurden.
 *
 * Seit Umstellung 1 trägt jeder Zustand, wann er zum ersten Mal gewertet
 * wurde (`eingefuehrt`). Die frühere Näherung — „erste Wiederholungen, heute
 * zuletzt gesehen" — zählte gestern Eingeführtes mit und verlor Karten, die
 * man heute öfter als dreimal nicht konnte. Sie gilt nur noch für Zustände,
 * die das Feld nie bekommen haben.
 */
export function heuteEingefuehrt(zustaende, subjectId = null, zeit = Date.now()) {
  const beginn = tagesBeginn(zeit);
  return zustaende.filter((z) => {
    if (subjectId && z.subjectId !== subjectId) return false;
    if (z.eingefuehrt !== undefined) return Boolean(z.eingefuehrt) && z.eingefuehrt >= beginn;
    return z.reps >= 1 && (z.last_review || 0) >= beginn && z.reps <= 3;
  }).length;
}

/**
 * Die Lernstände, die wirklich zu einer Karte im Plan gehören.
 *
 * Gelöschte oder abgehakte Karten, Stapel ohne Fach und Richtungen, die eine
 * Karte nicht mehr hat (etwa nach dem Wechsel zum Lückentext), behalten ihren
 * Lernstand — er soll nur nicht in Prognosen und Pensum mitzählen.
 */
export function zustaendeImPlan(karten, zustaende, stapelVon, fachId = null) {
  const liste = [];
  for (const karte of karten) {
    if (!istRelevant(karte)) continue;
    const stapel = stapelVon(karte.setId);
    if (!stapel || ruht(stapel) || !stapel.subjectId || (fachId && stapel.subjectId !== fachId)) continue;
    for (const richtung of richtungenFuer(karte, stapel)) {
      const z = zustaende[karte.id + ":" + richtung];
      if (z) liste.push(z);
    }
  }
  return liste;
}

/**
 * Stellt eine Sitzung zusammen.
 *
 * `karten`      alle Karten (aus dem Bestand)
 * `zustaende`   Verzeichnis id → Kartenzustand (`<kartenkennung>:<richtung>`)
 * `stapelVon`   Funktion setId → Stapel
 * `fach`        das gewählte Fach (oder null für alle)
 * `umfang`      Höchstzahl der Aufgaben
 */
export function baueSitzung({
  karten, zustaende, stapelVon, faecherVon, fach = null, faecherIds = null,
  umfang = 30, zeit = Date.now(), nurWiederholung = false, gewicht = null, zufall = Math.random,
}) {
  const faellige = [];
  const neue = [];
  /* Ohne Fachwahl: nur Stapel eines vorhandenen Fachs. Stapel ohne Fach
     kommen im Abrufen nicht vor (so steht es auf der Fächerseite); vorher
     zogen die Startseite und „alle Fächer“ sie trotzdem mit, und keine Zahl
     der App passte dazu (27.11.2026). */
  const bekannt = !fach && faecherVon ? new Set(faecherVon().map((f) => f.id)) : null;

  for (const karte of karten) {
    // Abgehaktes zählt nirgends mit — weder in der Warteschlange noch
    // in den Zahlen darüber.
    if (!istRelevant(karte)) continue;
    const stapel = stapelVon(karte.setId);
    if (!stapel || ruht(stapel)) continue;               // ruhende Stapel kommen nicht dran
    const fachId = stapel.subjectId || null;
    if (!fachId || (bekannt && !bekannt.has(fachId))) continue;
    if (fach && fachId !== fach.id) continue;
    // Beim Verschachteln über mehrere Fächer: nur die gewählten.
    if (faecherIds && faecherIds.length && !faecherIds.includes(fachId)) continue;

    for (const richtung of richtungenFuer(karte, stapel)) {
      const zustand = zustaende[karte.id + ":" + richtung];
      if (zustand?.gesperrt) continue;         // Leech — wartet auf Überarbeitung
      const eintrag = { karte, stapel, richtung, zustand, fachId,
        schluessel: karte.id + ":" + richtung };
      if (istNeu(zustand)) neue.push(eintrag);
      else if (istFaellig(zustand, zeit)) faellige.push(eintrag);
    }
  }

  // Fälliges zuerst und nach Überfälligkeit geordnet — was am längsten wartet,
  // ist am ehesten vergessen.
  faellige.sort((a, b) => (a.zustand?.due || 0) - (b.zustand?.due || 0));

  /* Neue Karten: je Fach höchstens, was sein Tageslimit heute noch zulässt.
     Früher galt ohne Fachwahl die *Summe* der Limits — hatte ein Fach kaum
     neue Karten, ging sein ungenutzter Rest an die anderen, und ein Fach
     bekam über „alle Fächer“ mehr neue, als sein eigenes Limit erlaubt.
     Die Zahlen je Fach passten dann nicht zur Summe (27.11.2026). */
  const eingefuehrt = (fachId) => heuteEingefuehrt(Object.values(zustaende), fachId, zeit);
  const frei = (f) => Math.max(0, (Number(f.neuProTag) || 0) - eingefuehrt(f.id));
  const ziehen = (liste, anzahl) => (gewicht ? gewichtetZiehen(liste, anzahl, gewicht, zufall)
    : mische(liste).slice(0, anzahl));
  let neuErlaubt = 0;
  let genommenNeu = [];
  if (!nurWiederholung) {
    if (fach) {
      neuErlaubt = frei(fach);
      genommenNeu = ziehen(neue, neuErlaubt);
    } else {
      const jeFach = new Map();
      for (const n of neue) {
        if (!jeFach.has(n.fachId)) jeFach.set(n.fachId, []);
        jeFach.get(n.fachId).push(n);
      }
      for (const f of faecherVon()) {
        if (faecherIds && faecherIds.length && !faecherIds.includes(f.id)) continue;
        const erlaubt = frei(f);
        neuErlaubt += erlaubt;
        genommenNeu.push(...ziehen(jeFach.get(f.id) || [], erlaubt));
      }
      /* Gemischt, damit beim Auffüllen kleiner Runden kein Fach vorn steht. */
      genommenNeu = gewicht ? gewichtetReihen(genommenNeu, gewicht, zufall) : mische(genommenNeu);
    }
  }

  /* Mit `gewicht` (Klausurnähe, core/klausuren.js) wird unter den Fälligen
     gewichtet zufällig gezogen statt streng nach Überfälligkeit — so kommen
     die Karten der nächsten Klausur häufiger dran, ohne dass etwas Fälliges
     verloren geht: Was diesmal nicht gezogen wird, bleibt fällig. */
  const genommenFaellig = gewicht ? gewichtetZiehen(faellige, umfang, gewicht, zufall)
    : faellige.slice(0, umfang);

  // Bis zum Umfang auffüllen: erst Wiederholungen, dann Neues.
  const zusammen = [...genommenFaellig];
  for (const n of genommenNeu) {
    if (zusammen.length >= umfang) break;
    zusammen.push(n);
  }

  return {
    /* Mit Gewicht auch die Reihenfolge gewichtet zufällig: Karten einer nahen
       Klausur kommen eher früh, die Runde bleibt trotzdem gemischt. */
    aufgaben: gewicht ? gewichtetReihen(zusammen, gewicht, zufall) : mische(zusammen),
    faellig: faellige.length,
    neu: neue.length,
    neuHeuteMoeglich: neuErlaubt,
  };
}

/**
 * Was heute im Abrufen dran ist — **die** Zahl für alle Stellen, die sagen,
 * wie viel wartet (Navigierleiste, Startseite, „Alles abrufen“, Fachseite).
 *
 * Gerechnet wird mit der Sitzung selbst, damit jede Zahl zu dem passt, was
 * das Abrufen dann bringt: alles Fällige und neue Karten bis zum Tageslimit.
 * Vorher zählte die Startseite alle nie gesehenen Karten mit (101 „offen“),
 * „Alles abrufen“ rechnete mit einer festen 20, das Abrufen selbst mit dem
 * Limit — drei Zahlen für dieselbe Sache (27.11.2026).
 *
 * `neu`        so viele neue kommen heute (nach dem Tageslimit)
 * `ungesehen`  alle nie gesehenen, auch die für die nächsten Tage
 */
export function heuteAnstehend({
  karten, zustaende, stapelVon, faecherVon, fach = null, faecherIds = null, zeit = Date.now(),
}) {
  const s = baueSitzung({ karten, zustaende, stapelVon, faecherVon, fach, faecherIds, umfang: Infinity, zeit });
  const gesamt = s.aufgaben.length;
  return { gesamt, faellig: s.faellig, neu: gesamt - s.faellig, ungesehen: s.neu };
}

/**
 * Zieht `anzahl` Einträge zufällig, aber gewichtet, ohne Zurücklegen
 * (Efraimidis–Spirakis: Schlüssel = Zufall^(1/Gewicht), die größten gewinnen).
 */
export function gewichtetZiehen(liste, anzahl, gewicht, zufall = Math.random) {
  if (anzahl >= liste.length) return [...liste];
  return liste
    .map((e) => ({ e, s: Math.pow(Math.max(1e-12, zufall()), 1 / Math.max(1e-6, gewicht(e))) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, Math.max(0, anzahl))
    .map((x) => x.e);
}

/** Alle Einträge in gewichtet zufälliger Reihenfolge (schwere eher vorn). */
export function gewichtetReihen(liste, gewicht, zufall = Math.random) {
  return liste
    .map((e) => ({ e, s: Math.pow(Math.max(1e-12, zufall()), 1 / Math.max(1e-6, gewicht(e))) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.e);
}

/** Was in einem Fach ansteht — für die Übersicht. */
export function fachZaehlung(karten, zustaende, stapelVon, fachId, zeit = Date.now()) {
  let faellig = 0, neu = 0, gesperrt = 0, gesamt = 0;
  /* „hängt“ zählt Karten — wie das Fehlerheft. Hängen beide Richtungen
     einer Karte, ist es trotzdem eine (vorher 10 hier, 6 dort). */
  const gesperrteKarten = new Set();
  for (const karte of karten) {
    // Abgehaktes zählt nirgends mit — weder in der Warteschlange noch
    // in den Zahlen darüber.
    if (!istRelevant(karte)) continue;
    const stapel = stapelVon(karte.setId);
    if (!stapel || ruht(stapel) || (fachId && stapel.subjectId !== fachId)) continue;
    if (!fachId && !stapel.subjectId) continue;          // ohne Fach nie im Abrufen
    for (const richtung of richtungenFuer(karte, stapel)) {
      const z = zustaende[karte.id + ":" + richtung];
      gesamt += 1;
      if (z?.gesperrt) { gesperrt += 1; gesperrteKarten.add(karte.id); }
      else if (istNeu(z)) neu += 1;
      else if (istFaellig(z, zeit)) faellig += 1;
    }
  }
  return { faellig, neu, gesperrt, gesamt, gesperrtKarten: gesperrteKarten.size };
}

/**
 * Wie viele Karten in den nächsten Tagen terminiert sind.
 *
 * Das ist eine Untergrenze: Folgewiederholungen, die aus den heutigen
 * Antworten erst entstehen, sind naturgemäß noch nicht terminiert. Für die
 * Frage „staut es sich?" reicht die Zahl trotzdem — sie zeigt den Bestand,
 * der bereits auf dem Kalender steht.
 */
export function faelligJeTag(zustaende, tage = 30, zeit = Date.now()) {
  const beginn = tagesBeginn(zeit);
  const eimer = new Array(tage).fill(0);
  let ueberfaellig = 0;
  for (const z of zustaende) {
    if (!z || z.gesperrt || istNeu(z)) continue;
    const versatz = Math.floor(((z.due || 0) - beginn) / TAG);
    if (versatz < 0) ueberfaellig += 1;
    else if (versatz < tage) eimer[versatz] += 1;
  }
  return { eimer, ueberfaellig };
}

/**
 * Grobe Hochrechnung der täglichen Last (§3.1).
 *
 * Faustformel, keine Simulation: Eine Karte im Wiederholungsstand erzeugt im
 * Mittel etwa 1/Stabilität Abrufe pro Tag; frisch eingeführte Karten liegen in
 * den ersten Wochen deutlich darüber. Die Zahl soll eine Größenordnung geben
 * und vor dem Rückstau warnen, nicht eine Vorhersage sein.
 */
export function lastprognose(zustaende, neuProTagGesamt, tage = 180) {
  let bestandslast = 0;
  for (const z of zustaende) {
    if (!z || z.gesperrt || istNeu(z)) continue;
    bestandslast += 1 / Math.max(1, z.stability || 1);
  }
  // Jede neue Karte bringt erfahrungsgemäß rund acht Abrufe im ersten Halbjahr.
  const neueLast = (neuProTagGesamt * 8) / 30;
  const inTagen = bestandslast + neueLast;
  const spaeter = bestandslast + neuProTagGesamt * tage / Math.max(30, tage) * 0.5 + neueLast;
  return {
    heute: Math.round(inTagen),
    inHalbjahr: Math.round(spaeter),
    minutenHeute: Math.round(inTagen * 8 / 60),   // rund acht Sekunden je Karte
  };
}

/* ===================================================================== */
/*  Klausur-Modus                                                        */
/* ===================================================================== */

/**
 * Zwei getrennte Mechanismen, damit die Historie sauber bleibt:
 *
 * **Verdichtung** — je näher der Termin, desto höher die Ziel-Retention des
 * Fachs. Die Termine rücken zusammen, aber alles läuft weiter durch FSRS und
 * die Reviews bleiben gewöhnliche Reviews. Das ist kein Pauken, sondern
 * dichteres Wiederholen.
 *
 * **Cram-Warteschlange** — nur in den letzten Tagen. Sie geht den ganzen Stoff
 * durch, ohne Rücksicht auf Termine, verändert den Kartenzustand *nicht* und
 * schreibt Reviews mit dem Vermerk `cram`. Was hier geschieht, verfälscht die
 * Messung nicht: Sie ist Notbehelf, nicht Lernen.
 */

/** Ab so vielen Tagen vor dem Termin beginnt die Verdichtung. */
export const VERDICHTUNG_AB_TAGEN = 60;
/** Ab so vielen Tagen davor ist die Cram-Warteschlange sinnvoll. */
export const CRAM_AB_TAGEN = 5;

/**
 * Die wirksame Ziel-Retention eines Fachs — angehoben, wenn der Termin naht.
 * Steigt von der eingestellten Marke bis auf höchstens 0,97.
 */
export function wirksameRetention(fach, zeit = Date.now()) {
  const grund = Number(fach?.zielRetention) || 0.9;
  if (!fach?.pruefungsdatum) return grund;
  const tage = (fach.pruefungsdatum - zeit) / TAG;
  if (tage <= 0 || tage > VERDICHTUNG_AB_TAGEN) return grund;
  const naehe = 1 - tage / VERDICHTUNG_AB_TAGEN;     // 0 weit weg, 1 am Termin
  return Math.min(0.97, grund + (0.97 - grund) * naehe);
}

/** Wie viele Tage bleiben — oder null, wenn kein Termin hinterlegt ist. */
export function tageBisPruefung(fach, zeit = Date.now()) {
  if (!fach?.pruefungsdatum) return null;
  return Math.ceil((fach.pruefungsdatum - zeit) / TAG);
}

/**
 * Reicht die Zeit?
 *
 * Gerechnet wird schlicht: Wie viele Karten sind noch nie in einen stabilen
 * Zustand gekommen, und wie viele Tage bleiben? Bei mehr als dreißig Karten
 * am Tag wird es unrealistisch — das sagt die App dann auch.
 */
export function pensumPruefen(karten, zustaende, stapelVon, fach, zeit = Date.now()) {
  const tage = tageBisPruefung(fach, zeit);
  if (tage === null) return null;

  const { gesamt, neu, faellig } = fachZaehlung(karten, zustaende, stapelVon, fach.id, zeit);
  let wacklig = 0;
  for (const z of zustaendeImPlan(karten, zustaende, stapelVon, fach.id)) {
    if (z.gesperrt) continue;
    if (!istNeu(z) && (z.stability || 0) < 7) wacklig += 1;
  }

  const offen = neu + wacklig;
  const jeTag = tage > 0 ? offen / tage : offen;

  return {
    tage, gesamt, neu, faellig, wacklig, offen,
    jeTag: Math.ceil(jeTag),
    machbar: tage > 0 && jeTag <= 30,
    text: tage <= 0
      ? "Der Termin ist da."
      : offen === 0
        ? "Alles steht, es geht nur noch ums Halten."
        : jeTag <= 30
          ? (Math.ceil(jeTag) === 1
            ? "Eine Karte am Tag, dann steht bis dahin alles."
            : `${Math.ceil(jeTag)} Karten am Tag, dann steht bis dahin alles.`)
          : `${offen} Karten in ${tage} Tagen wären ${Math.ceil(jeTag)} am Tag, das geht `
            + "sich nicht aus. Kürze den Stoff oder fang bei dem an, was am meisten zählt.",
  };
}

/**
 * Eine einzelne Aufgabe zu einem Schlüssel (`<karte>:<richtung>`).
 *
 * Gebraucht, wenn eine bestimmte Karte vorn in der Runde stehen soll — die
 * Frage, die auf der Startseite oder oben im Stapel stand. Sie in einer
 * gebauten Sitzung zu suchen genügte nicht: Neue Karten werden nur bis zum
 * Tageslimit und dabei zufällig gezogen, die gesuchte fehlte also oft, und
 * im Abrufen kam dann eine andere Frage (Nutzer, 27.11.2026).
 *
 * Abgehaktes, ruhende Stapel und stillgelegte Karten gibt es auch hier
 * nicht: null heißt, die Karte kommt nicht dran.
 */
export function aufgabeAusSchluessel(schluessel, { karten, zustaende, stapelVon }) {
  const trenner = String(schluessel || "").lastIndexOf(":");
  if (trenner <= 0) return null;
  const karteId = schluessel.slice(0, trenner);
  const richtung = schluessel.slice(trenner + 1);
  const karte = karten.find((k) => k.id === karteId);
  if (!karte || !istRelevant(karte)) return null;
  const stapel = stapelVon(karte.setId);
  if (!stapel || ruht(stapel)) return null;
  if (!richtungenFuer(karte, stapel).includes(richtung)) return null;
  const zustand = zustaende[schluessel];
  if (zustand?.gesperrt) return null;
  return { karte, stapel, richtung, zustand, fachId: stapel.subjectId || null, schluessel };
}

/**
 * Wenn alles Fällige durch ist und man weitermachen will (Rundengröße
 * „Frei“, seit dem 25. November 2026). Gefragt wird der Nutzer, ob er
 * weitermacht, nicht welche Karten: Die nimmt weiter der Plan.
 *
 * `art: "neu"`        neue Karten über das Tageslimit hinaus, zufällig; sie
 *                     zählen ganz normal und kommen ab jetzt in den Plan.
 * `art: "vorziehen"`  gelernte Karten, die noch nicht fällig sind, die
 *                     nächstfälligen zuerst. Zählen als Übung (`practice`):
 *                     Ein vorgezogener Abruf soll den Abstand nicht künstlich
 *                     verkürzen, der Plan bleibt, wie er ist.
 */
export function baueWeitere({
  karten, zustaende, stapelVon, fach = null, faecherIds = null, art = "neu",
  umfang = 10, zeit = Date.now(),
}) {
  const liste = [];
  for (const karte of karten) {
    if (!istRelevant(karte)) continue;
    const stapel = stapelVon(karte.setId);
    if (!stapel || ruht(stapel)) continue;
    const fachId = stapel.subjectId || null;
    if (!fachId) continue;                       // ohne Fach nie im Abrufen
    if (fach && fachId !== fach.id) continue;
    if (faecherIds && faecherIds.length && !faecherIds.includes(fachId)) continue;
    for (const richtung of richtungenFuer(karte, stapel)) {
      const zustand = zustaende[karte.id + ":" + richtung];
      if (zustand?.gesperrt) continue;
      const neu = istNeu(zustand);
      if (art === "neu" ? !neu : neu || istFaellig(zustand, zeit)) continue;
      liste.push({ karte, stapel, richtung, zustand, fachId, schluessel: karte.id + ":" + richtung });
    }
  }
  const geordnet = art === "neu" ? mische(liste)
    : liste.sort((a, b) => (a.zustand?.due || 0) - (b.zustand?.due || 0));
  return {
    aufgaben: mische(geordnet.slice(0, umfang)),
    gesamt: liste.length,
    zusatz: art,
  };
}

/** Wie viele Karten für „weitermachen“ noch da wären, je Art. */
export function weitereZaehlung(eingaben) {
  return {
    neu: baueWeitere({ ...eingaben, art: "neu", umfang: 0 }).gesamt,
    vorziehen: baueWeitere({ ...eingaben, art: "vorziehen", umfang: 0 }).gesamt,
  };
}

/**
 * Die Warteschlange für den Endspurt: alles, quer durch, ohne Rücksicht auf
 * Termine. Verändert nichts — die Reviews tragen den Vermerk `cram`.
 */
export function baueCramSitzung({ karten, zustaende, stapelVon, fach, umfang = 40 }) {
  const alle = [];
  for (const karte of karten) {
    // Abgehaktes zählt nirgends mit — weder in der Warteschlange noch
    // in den Zahlen darüber.
    if (!istRelevant(karte)) continue;
    const stapel = stapelVon(karte.setId);
    if (!stapel || ruht(stapel) || (fach && stapel.subjectId !== fach.id)) continue;
    for (const richtung of richtungenFuer(karte, stapel)) {
      const zustand = zustaende[karte.id + ":" + richtung];
      if (zustand?.gesperrt) continue;
      alle.push({ karte, stapel, richtung, zustand, fachId: stapel.subjectId,
        schluessel: karte.id + ":" + richtung });
    }
  }
  // Das Wackligste zuerst — in den letzten Tagen zählt, was am ehesten fehlt.
  alle.sort((a, b) => (a.zustand?.stability || 0) - (b.zustand?.stability || 0));
  return {
    aufgaben: alle.slice(0, umfang),
    gesamt: alle.length,
    cram: true,
  };
}

/**
 * Der Stand eines einzelnen Stapels — für die Stapelansicht.
 *
 * Wichtig: Gerechnet wird mit den FSRS-Zuständen, nicht mit dem alten
 * Fächerplan. Sonst zeigt dieselbe Karte an zwei Stellen der App zwei
 * verschiedene Wahrheiten, und keine davon ist die, nach der gelernt wird.
 */
export function stapelStand(karten, zustaende, stapel, zeit = Date.now()) {
  let faellig = 0, neu = 0, gesperrt = 0, gesamt = 0;
  let naechste = null;
  const alle = [];

  for (const karte of karten) {
    // Abgehaktes zählt nirgends mit — weder in der Warteschlange noch
    // in den Zahlen darüber.
    if (!istRelevant(karte)) continue;
    for (const richtung of richtungenFuer(karte, stapel)) {
      const z = zustaende[karte.id + ":" + richtung];
      gesamt += 1;
      alle.push(z || null);
      if (z?.gesperrt) { gesperrt += 1; continue; }
      if (istNeu(z)) { neu += 1; continue; }
      if (istFaellig(z, zeit)) faellig += 1;
      else if (naechste === null || z.due < naechste) naechste = z.due;
    }
  }
  return { faellig, neu, gesperrt, gesamt, naechste, zustaende: alle };
}

/**
 * Was ein ruhender Stapel beim Zurückholen mitbringt: wie viele seiner
 * Karten dann fällig sind. Steht vor dem Zurückholen da, damit niemand von
 * einem Berg überrascht wird.
 */
export function rueckkehrStand(karten, zustaende, stapel, zeit = Date.now()) {
  const { faellig, neu } = stapelStand(karten.filter((k) => k.setId === stapel.id), zustaende,
    stapel, zeit);
  return { faellig, neu };
}
