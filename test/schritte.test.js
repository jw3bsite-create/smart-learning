/* Rechenwege als Text und zurück — für den Editor und das Bearbeiten im Modus. */

import test from "node:test";
import assert from "node:assert/strict";
import { schritteAlsText, textAlsSchritte } from "../src/core/schritte.js";

test("eine Zeile mit Anweisung wird Frage und Antwort", () => {
  assert.deepEqual(textAlsSchritte("ableiten: f'(x) = 2x"), [{ frage: "ableiten", antwort: "f'(x) = 2x" }]);
});

test("ein Verhältnis wie 3:4 wird nicht zerschnitten", () => {
  assert.deepEqual(textAlsSchritte("3:4"), [{ frage: "", antwort: "3:4" }]);
});

test("hin und zurück bleibt alles, leere Zeilen fallen weg", () => {
  const s = [{ frage: "Äußere Ableitung", antwort: "$3(2x+1)^2$" }, { frage: "", antwort: "$6(2x+1)^2$" }];
  assert.deepEqual(textAlsSchritte(schritteAlsText(s) + "\n\n"), s);
});
