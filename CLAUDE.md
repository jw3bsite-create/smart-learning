# Karteikasten

Arbeitssystem für die Abiturvorbereitung 2027 (Technisches Gymnasium
Baden-Württemberg). Läuft im Browser, Daten in IndexedDB, freiwilliger Abgleich
über Supabase, freiwilliges Sprachmodell über LM Studio oder einen Anbieter.

## Der Leitsatz

Die App ist kein Wissensspeicher und kein Erklärautomat. Sie zwingt zum
Abrufen und verteilt dieses Abrufen über Monate. **Alles, was das Abrufen
erleichtert, statt es zu erzwingen, ist ein Fehler — auch wenn es sich besser
anfühlt.**

Wer hier etwas ändert, prüft jede Änderung an diesem Satz.

## Sprache

Antworte auf Deutsch. Kommentare im Code auf Deutsch. Beschriftungen in der
Oberfläche auf Deutsch, in gehobenem, aber schlichtem Register — keine
Anglizismen, wo es ein deutsches Wort gibt. Bezeichner im Code folgen derselben
Sprache, soweit sie die Sache benennen (`karten`, `zustaende`, `abrufVerbuchen`).

## Starten

```
npm install
npm run dev      # http://localhost:5180
npm test         # 169 Prüfungen für den Kern
npm run lint
npm run symbole  # Symbole neu erzeugen (PNG fürs Handy, ICO für Windows)
```

Für den Alltag liegt eine Verknüpfung auf dem Schreibtisch; angelegt wird sie
mit `werkzeug\verknuepfung.ps1`. Sie ruft `werkzeug\starten.ps1` auf: prüft den
Port, startet bei Bedarf `werkzeug\server.cmd` kleingelegt und öffnet Edge
ohne Adresszeile.

Node liegt unter `C:\Program Files\nodejs` und ist weder in der Git-Bash noch in
PowerShell im Pfad. Vorher setzen:
`export PATH="/c/Program Files/nodejs:$PATH"` bzw.
`$env:Path = "C:\Program Files\nodejs;" + $env:Path`

## Die zwei Wege — und warum sie getrennt bleiben

**Das ist die wichtigste Entscheidung der ganzen App.**

| | Übungsmodi (Quizlet-Erbe) | Abrufen (der Lernweg) |
|---|---|---|
| Modi | Karteikarten, Lernen, Schreiben, Buchstabieren, Test, Zuordnen, Meteor | Abrufen |
| Ablauf | wie gehabt | Frage → Konfidenz → tippen → aufdecken → bewerten |
| Reviews | `flag: "practice"` | `flag: "normal"` |
| Wirkung auf Termine | **keine** | FSRS rechnet neu |
| Zählt für Strähne | ja | ja |
| Zählt für Kalibrierung, Behaltenskurve, Plan | nein | ja |

Wiedererkennen (Zuordnen, Auswahlfragen) schadet nicht — es nützt nur weniger.
Schädlich wird es erst, wenn es die Messung verfälscht. Darum bleiben die
Übungsmodi vollständig erhalten und rühren den Lernstand nicht an.

## Aufbau

```
src/core/     Rechnender Kern, ohne React, ohne Browserfenster, vollständig prüfbar
  db.js          IndexedDB, Schemafassungen, Sicherung vor jeder Migration
  model.js       Datenmodell: Karten, Fächer, Entwürfe, Erklärungen, Prüfungen
  fsrs.js        Hülle um ts-fsrs — hier und nur hier entstehen Termine
  scheduler.js   Der alte Fächerplan; versorgt noch die Übungsmodi
  warteschlange.js  Was drankommt, Tageslimits, Lastprognose
  kalibrierung.js   Konfidenz, Plausibilität, Behaltenskurve
  straehne.js    Strähne mit Pensum und Ruhetagen
  text.js        Normalisierung (die Bewertung leitet sich nie daraus ab)
  generator.js   Sieb für KI-Vorschläge
  ki.js          Der einzige Weg zu einem Sprachmodell
  drift.js       Erkennt, wenn ein Tutor seine Regeln verlässt
  cloud.js       Abgleich mit Supabase
  beispiel.js    Beispielbestand: Maschinerie und durchgerechnete Historie
  beispiel-stoff.js  Der Stoff dazu (Kant, Hauptstädte) — reine Daten
  store.jsx      Gemeinsamer Datenbestand
prompts/      Die Systemanweisungen als eigene Dateien, versioniert
src/modes/    Abrufen, Feynman, Pretest, Tutor, Pruefung + die sieben Übungsmodi
src/ui/       Bildschirme und Bausteine
test/         169 Prüfungen (npm test)
werkzeug/     Erzeugt die PNG-Symbole
```

## Datenmodell

| Ablage | Inhalt | Fassung |
|---|---|---|
| `folders`, `sets`, `cards` | Ordner, Stapel, Karten | 1 |
| `progress` | alter Lernstand der Übungsmodi | 1 |
| `media`, `settings`, `sessions` | Bilder, Einstellungen, Sitzungen | 1 |
| `subjects` | Fächer: Ziel-Retention, Termin, Tageslimit | 2 |
| `cardstates` | FSRS je Karte **und Richtung** (`<karte>:<richtung>`) | 2 |
| `reviews` | **jede einzelne Antwort** — die Historie | 2 |
| `drafts` | Kartenentwürfe ohne Rückseite | 3 |
| `kilog` | Protokoll der Modellaufrufe (bleibt lokal) | 3 |
| `explanations` | Erklärungen, versioniert | 4 |
| `exams` | Prüfungssimulationen mit Kriterienraster | 5 |

Jeder Datensatz trägt `updatedAt` und darf `deleted: true` tragen. Gelöschtes
bleibt als Grabstein, sonst käme es beim Abgleich zurück.

## Regeln, die nicht verhandelbar sind

1. **Die Bewertung wird nie aus der Tippeingabe abgeleitet.** Exakte
   Übereinstimmung wird gemeldet, die Note wählt der Mensch. Keine
   Ähnlichkeitsschwelle, kein Levenshtein-Grenzwert im Bewertungsweg.
2. **Der Kalibrierungsaufschlag wirkt auf das Ergebnis von FSRS, nie auf dessen
   Parameter** — sonst wäre die Historie für eine spätere Nachoptimierung wertlos.
3. **`reviews` ist nur-anhängend** und wird nie destruktiv verändert.
4. **Jede Schemaänderung erhöht `VERSION` in `db.js`** und legt vorher eine
   Sicherung in `karteikasten-sicherung` ab.
5. **Kein offenes Chatfenster.** `ki.frage` verlangt den *Namen* einer Anweisung
   aus `prompts/`, nie einen Text. Wer eine neue Fähigkeit will, schreibt eine
   neue Anweisung — und muss sie dabei aufschreiben.
6. **Kein Multiple Choice im Abrufweg.** In den Übungsmodi ja, dort zählt es nicht.
7. **Keine Selbstauswahl der Wiederholungskarten.** Der Nutzer wählt Fach und
   Umfang, nie einzelne Karten oder Themen.
8. **Keine Note durch die KI.** Strukturfeedback ja, Punkte nein.
9. **Die Strähne belohnt abgerufene Karten, nicht geöffnete Fenster.**

## Fallstricke

1. **Keine Hooks nach einem frühen `return`.** Alle Modi haben ihre
   Abbruchbedingungen bewusst nach allen Hooks.
2. **Keine Nebenwirkungen im Zustandsaktualisierer** — React ruft ihn im
   Prüflauf doppelt auf (siehe `Meteor.jsx`).
3. **Frische Länge beim Weiterschalten**, sonst endet eine Runde zu früh.
4. **Beim Tippen nicht in die Datenbank schreiben** (Bearbeiten, Prüfung).
5. **Texterkennung: die Lage der Wörter zerlegen, nicht den Text** — der
   Erkenner macht aus jedem Zwischenraum ein Leerzeichen.
6. **Vorlagen zerlegen ohne Verlust.** Ein Suchmuster, das auf eine Wortgrenze
   besteht, findet in einer Zeichenkette ohne Zwischenräume nichts und schluckt
   den Text (`hartTeilen` in `generator.js`).
7. **Ruhetage gelten erst, wenn danach wieder ein Lerntag kommt** — sonst
   verbraucht das Ende der Aufzeichnung sie. Und sie werden je Kalendermonat
   gezählt: Eine Lücke über den Monatswechsel bekäme sonst das doppelte
   Kontingent. Wie lang eine Unterbrechung sein darf, darf nicht vom Kalender
   abhängen.
8. **Karte und Abfragerichtung sind nicht dasselbe.** `cardstates` zählt je
   Richtung. Eine Zahl von dort neben „Karten" zu schreiben ergibt Sätze wie
   „30 Karten · 33 beherrscht".
9. **Fortschritt kommt aus `cardstates`, nicht aus `progress`.** Der alte
   Fächerplan lebt nur noch für die Übungsmodi. Wer ihn für eine Anzeige
   heranzieht, lässt dieselbe Karte an zwei Stellen zwei Wahrheiten haben.

### Beim Starter unter Windows

10. **Keine Ausgabe von Systembefehlen auswerten.** Der erste Starter suchte in
    `netstat` nach `LISTENING` — auf diesem deutschen Windows steht dort
    `ABHÖREN`. Ein Verbindungsversuch antwortet in jeder Sprache gleich.
11. **`.ps1` braucht eine Byte-Marke.** Windows PowerShell 5.1 liest eine Datei
    ohne BOM als ANSI; die Umlaute werden zu Kauderwelsch und die Datei ist
    syntaktisch kaputt.
12. **Keine deutschen Anführungszeichen in PowerShell-Zeichenketten.**
    PowerShell nimmt `„` und `“` selbst als Begrenzer und bricht mitten im Satz ab.
13. **`title` in einer Stapeldatei gehört vor jeden Klammerblock** — eine
    schließende Klammer im Titeltext beendet sonst den Block.
14. **Vite setzt den Fenstertitel der Konsole zurück.** Er wird darum von außen
    gesetzt, nachdem der Server antwortet (`Benenne` in `starten.ps1`).

## Was ausdrücklich nicht gebaut wird

Kein offenes Chatfenster · kein „Lösung anzeigen" im Tutormodus · kein Multiple
Choice im Abrufweg · kein „Alle KI-Karten übernehmen" · kein Wiederlese- oder
Zusammenfassungsmodus · keine Notenvorhersage · keine Strähne für das Öffnen ·
keine Selbstauswahl der Wiederholung · keine Erklärvideos.

Erscheint eines davon unterwegs sinnvoll, ist das das Zeichen, dass die
Spezifikation gerade erodiert — dann Rückfrage, kein Alleingang.

## Offen

- Prüfungszeiten und Pflichtlektüren sind leer und werden nicht geraten.


- FSRS-Parameteroptimierung aus der eigenen Historie — dafür braucht es erst
  ein paar hundert Reviews.

## Vorgehen

Ein Zweig je Phase, kleine Commits, keine Umbauten außerhalb der laufenden
Phase. Nach jeder Änderung `npm run lint` und `npm test`. Neue Logik im Kern
bekommt eine Prüfung. Keine Abhängigkeit ohne Nennung und Begründung.
