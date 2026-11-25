/*
 * Prüfungen für die Wahl der Vorlesestimme (core/speech.js).
 *
 * Der Nutzer hat nie vorgelesen, weil die Stimme nach Roboter klang — dabei
 * lag auf dem PC längst eine natürliche. Hier steht, dass die gute vor der
 * schlechten kommt, männlich vor weiblich bei gleicher Güte, Spanien vor
 * Mexiko, und dass Apples Spaßstimmen nie gewinnen.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { guete, bewerte, stimmenFuer, besteStimme, vorname } from "../src/core/speech.js";

const s = (name, lang, zusatz = {}) => ({ name, lang, voiceURI: name, localService: true, ...zusatz });

const EDGE = [
  s("Microsoft Hedda - German (Germany)", "de-DE"),
  s("Microsoft Stefan - German (Germany)", "de-DE"),
  s("Microsoft Katja Online (Natural) - German (Germany)", "de-DE", { localService: false }),
  s("Microsoft Conrad Online (Natural) - German (Germany)", "de-DE", { localService: false }),
  s("Microsoft Helena - Spanish (Spain)", "es-ES"),
  s("Microsoft Dalia Online (Natural) - Spanish (Mexico)", "es-MX", { localService: false }),
  s("Microsoft Jorge Online (Natural) - Spanish (Mexico)", "es-MX", { localService: false }),
  s("Microsoft Elvira Online (Natural) - Spanish (Spain)", "es-ES", { localService: false }),
  s("Microsoft Alvaro Online (Natural) - Spanish (Spain)", "es-ES", { localService: false }),
];

const IPHONE = [
  s("Anna", "de-DE", { voiceURI: "com.apple.voice.compact.de-DE.Anna" }),
  s("Grandpa", "de-DE", { voiceURI: "com.apple.eloquence.de-DE.Grandpa" }),
  s("Markus", "de-DE", { voiceURI: "com.apple.voice.enhanced.de-DE.Markus" }),
  s("Petra", "de-DE", { voiceURI: "com.apple.voice.premium.de-DE.Petra" }),
  s("Mónica", "es-ES", { voiceURI: "com.apple.voice.compact.es-ES.Monica" }),
];

test("die Güte wird aus Name und Kennung gelesen", () => {
  assert.equal(guete(EDGE[2]), "natuerlich");
  assert.equal(guete(EDGE[0]), "einfach");
  assert.equal(guete(IPHONE[2]), "erweitert");
  assert.equal(guete(IPHONE[3]), "natuerlich");
  assert.equal(guete(IPHONE[0]), "einfach");
});

test("der Vorname steckt mitten im langen Edge-Namen", () => {
  assert.equal(vorname(EDGE[3]), "conrad");
  assert.equal(vorname(IPHONE[2]), "markus");
});

test("am PC gewinnt die natürliche männliche Stimme, nicht die alte Roboterstimme", () => {
  assert.match(besteStimme("de", EDGE).name, /Conrad/);
  assert.match(besteStimme("es", EDGE).name, /Alvaro/, "Spanien vor Mexiko, männlich vor weiblich");
});

test("am iPhone: Premium vor Erweitert vor einfach, die Spaßstimme nie", () => {
  const reihe = stimmenFuer("de", IPHONE).map((x) => x.name);
  assert.deepEqual(reihe.slice(0, 3), ["Petra", "Markus", "Anna"]);
  assert.equal(reihe.at(-1), "Grandpa");
});

test("Stimmen anderer Sprachen kommen nicht in Frage", () => {
  assert.equal(bewerte(EDGE[0], "es"), -Infinity);
  assert.equal(stimmenFuer("fr", EDGE).length, 0);
  assert.equal(besteStimme("fr", EDGE), null);
});

test("ohne gute Stimme bleibt die einfache die beste — die Einstellungen sagen dann Bescheid", () => {
  const b = besteStimme("es", IPHONE);
  assert.equal(b.name, "Mónica");
  assert.equal(guete(b), "einfach");
});
