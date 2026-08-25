# Karteikasten

Karteikarten zur Abiturvorbereitung: Ordner, Stapel, sieben Lernmodi, Bilder,
Texterkennung aus Fotos. Läuft im Browser, Daten in IndexedDB, freiwilliger
Abgleich über Supabase.

## Sprache

Antworte auf Deutsch. Kommentare im Code auf Deutsch. Beschriftungen in der
Oberfläche auf Deutsch, in gehobenem, aber schlichtem Register — keine
Anglizismen, wo es ein deutsches Wort gibt („Zusammenfassung" statt „Summary",
„Trennlinie" statt „Divider"). Bezeichner im Code folgen derselben Sprache,
soweit sie die Sache benennen (`karten`, `staende`, `rundeStarten`).

## Starten

```
npm install
npm run dev      # http://localhost:5180
npm test         # Prüfungen für den Kern
npm run lint
```

Node liegt unter `C:\Program Files\nodejs` und ist in der Git-Bash nicht im
Pfad — dort erst `export PATH="/c/Program Files/nodejs:$PATH"`.

## Aufbau

- `src/core/` — der rechnende Kern, ohne React und ohne Browserfenster:
  `db.js` (IndexedDB), `model.js` (Datenmodell), `scheduler.js` (Fächer und
  Abstände), `text.js` (Antwortprüfung), `importer.js`, `ocr.js`, `media.js`,
  `speech.js`, `cloud.js`. Alles hier ist ohne Oberfläche prüfbar — neue Logik
  gehört hierher und bekommt eine Prüfung in `test/kern.test.js`.
- `src/core/store.jsx` — der gemeinsame Datenbestand als React-Zusammenhang.
  Jede Änderung ändert den Zustand und schreibt im selben Atemzug in IndexedDB.
- `src/ui/` — Seitenleiste, Bibliothek, Stapelansicht, Bearbeiten, Einfuhr,
  Einstellungen, Statistik, Papierkorb, `basis.jsx` (Bausteine), `stil.css`.
- `src/modes/` — die sieben Modi, dazu `gemeinsam.jsx` mit Rahmen, Kartenseite
  und Abschlussbild.
- `werkzeug/symbole.js` — erzeugt die PNG-Symbole (`npm run symbole`).

## Datenmodell

Alles liegt in IndexedDB, jede Ablage mit eigenem Verzeichnis:

| Ablage     | Inhalt                                                      |
|------------|-------------------------------------------------------------|
| `folders`  | Ordner, geschachtelt über `parentId`                        |
| `sets`     | Stapel, gehören in höchstens einen Ordner                   |
| `cards`    | Karten mit `term`, `definition`, Bildern, `starred`         |
| `progress` | Lernstand je Karte, getrennt nach Richtung (`td`, `dt`)     |
| `media`    | Bilder als Blob                                             |
| `sessions` | Beendete Sitzungen — Grundlage für Strähne und Statistik    |
| `settings` | Einstellungen, Zugang zur Wolke, Wasserzeichen des Abgleichs|

**Wichtig:** Jeder Datensatz trägt `updatedAt` und darf `deleted: true` tragen.
Gelöschtes wird nicht entfernt, sondern als Grabstein behalten — sonst käme es
beim Abgleich von einem anderen Gerät wieder zurück. Erst nach sechzig Tagen
räumt `pruneTombstones()` auf.

## Fallstricke

1. **Keine Hooks nach einer Ladeabfrage oder einem frühen `return`.** React
   zählt Hooks je Durchlauf; eine Abweichung bricht die App ab. Alle Modi haben
   ihre Abbruchbedingungen bewusst *nach* allen Hooks stehen.
2. **Keine Nebenwirkungen im Zustandsaktualisierer.** `setX((alt) => …)` wird im
   Prüflauf doppelt aufgerufen. In `Meteor.jsx` steht die Rechnung deshalb außen
   und der Zustand wird nur gesetzt.
3. **Frische Länge beim Weiterschalten.** Falsch beantwortete Karten werden ans
   Ende der Runde gehängt. Wer danach mit veraltetem `runde.length` rechnet,
   beendet die Runde zu früh oder läuft über das Ende hinaus — darum die
   Sicherheitsnetze in `Lernen.jsx` und `Schreiben.jsx`.
4. **Bauteile nicht innerhalb der Ausgabe definieren.** Sie werden sonst bei
   jeder Änderung neu erzeugt und verlieren ihren Zustand.
5. **Beim Tippen nicht in die Datenbank schreiben.** Die Kartenzeilen im
   Bearbeiten-Bild halten den Text in eigenem Zustand und schreiben erst nach
   einer halben Sekunde Ruhe oder beim Verlassen des Feldes.
6. **Texterkennung: nicht den Text zerlegen, sondern die Lage der Wörter.**
   Der Erkenner macht aus jedem Zwischenraum ein einzelnes Leerzeichen; die
   Spaltengrenze findet man nur über die Kästen der Wörter (`nachSpalten`).

## Nächste Schritte

1. Karten mit der Maus umsortieren (heute nur über Pfeile).
2. Mehrere Karten zugleich auswählen (markieren, verschieben, löschen).
3. Lückentexte als eigene Kartenart.
4. Stapel als PDF zum Ausdrucken, zwei Karten je Blatt zum Falten.

## Vorgehen

Nach jeder Änderung `npm run lint` und `npm test` laufen lassen. Neue Logik im
Kern bekommt eine Prüfung. Änderungen klein halten und einzeln prüfen.
