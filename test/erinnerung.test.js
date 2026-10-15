/*
 * Die Tageserinnerung muss über den Dienst-Arbeiter gehen. `new Notification`
 * ist auf Telefonen verboten; der Fehler wurde verschluckt, und auf dem Handy
 * kam nie eine Nachricht.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { zeigen } from "../src/core/erinnerung.js";

function mitUmgebung({ registrierung, notification }, fn) {
  const vorher = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const vorherN = globalThis.Notification;
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: {
    serviceWorker: registrierung === undefined ? undefined
      : { getRegistration: async () => registrierung },
  } });
  globalThis.Notification = notification;
  return fn().finally(() => {
    if (vorher) Object.defineProperty(globalThis, "navigator", vorher);
    else delete globalThis.navigator;
    globalThis.Notification = vorherN;
  });
}

test("mit Dienst-Arbeiter geht die Nachricht über ihn", async () => {
  const gezeigt = [];
  let konstruiert = false;
  await mitUmgebung({
    registrierung: { showNotification: async (t, o) => { gezeigt.push([t, o.body]); } },
    notification: class { constructor() { konstruiert = true; throw new TypeError("Illegal constructor"); } },
  }, () => zeigen("Anchor", { body: "3 Karten" }));
  assert.deepEqual(gezeigt, [["Anchor", "3 Karten"]]);
  assert.equal(konstruiert, false, "der verbotene Weg darf nicht benutzt werden");
});

test("ohne Dienst-Arbeiter bleibt der alte Weg als Rückfall", async () => {
  const gezeigt = [];
  await mitUmgebung({
    registrierung: null,
    notification: class { constructor(t, o) { gezeigt.push([t, o.body]); } },
  }, () => zeigen("Anchor", { body: "5 Karten" }));
  assert.deepEqual(gezeigt, [["Anchor", "5 Karten"]]);
});
