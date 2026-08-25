# Karteikasten

Karteikarten für die Abiturvorbereitung — Ordner, Stapel, sieben Lernmodi,
Bilder auf den Karten und Texterkennung, die aus einem Foto Karten macht.
Alles läuft im Browser, ohne Konto und ohne Kosten.

## Starten

```
npm install
npm run dev
```

Dann `http://localhost:5180` öffnen. Für den täglichen Gebrauch:

```
npm run build
npm run preview
```

Im Browser über „Installieren“ (Chrome/Edge: Symbol in der Adresszeile,
iPhone: Teilen → „Zum Home-Bildschirm“) landet die App als eigenes Programm
auf dem Gerät und läuft dann auch ohne Netz.

## Was es kann

**Ordnen.** Ordner, beliebig tief geschachtelt, darin Stapel, darin Karten.
Stapel lassen sich mit der Maus in Ordner ziehen. Suche über alle Karten.

**Karten.** Vorder- und Rückseite, wahlweise mit Bild (einfügen, hineinziehen
oder auswählen), dazu ein Hinweis und eine Markierung für schwierige Karten.

**Sieben Modi.**

| Modus | Was er tut |
|---|---|
| Karteikarten | Durchblättern, umdrehen, vorlesen lassen, selbst einschätzen |
| Lernen | Runden aus Auswahl-, Schreib- und Wahr/Falsch-Aufgaben, über Tage verteilt |
| Schreiben | Antwort tippen, nachsichtige Prüfung, „War doch richtig“ |
| Buchstabieren | Wort anhören und schreiben — strenge Prüfung |
| Test | Gemischte Aufgaben auf einer Seite, Auswertung am Ende |
| Zuordnen | Sechs Paare finden, auf Zeit, mit Bestzeit |
| Meteor | Begriffe fallen, Antwort tippen, wird schneller |

**Verteiltes Wiederholen.** Jede Karte sitzt je Abfragerichtung in einem Fach
von 0 bis 7. Richtig beantwortet steigt sie auf und kommt später wieder,
falsch fällt sie zurück. Daraus ergibt sich, was „heute dran“ ist.

**Einfuhr.** Liste einfügen (Tabulator, Komma, Gedankenstrich, eigenes
Zeichen) — so kommen auch Stapel aus Quizlet herüber. Oder ein Foto: die
Texterkennung liest das Blatt und trennt die Spalten anhand der Lücke
zwischen ihnen. Vor dem Anlegen wird alles zur Durchsicht gezeigt.

**Ausfuhr.** CSV, Text, ganze Sicherung als Datei (samt Bildern und
Lernständen), Druckansicht.

**Fortschritt.** Strähne, Tagesübersicht der letzten drei Monate,
Beherrschung je Stapel, letzte Sitzungen.

## Abgleich zwischen Geräten

Freiwillig und erst dann, wenn du ihn einrichtest:

1. Bei [supabase.com](https://supabase.com) ein kostenloses Projekt anlegen.
2. Im *SQL Editor* den Inhalt von `wolke.sql` ausführen. Das legt Tabelle,
   Zeilenrechte und die Ablage für Bilder an.
3. In *Project Settings → API* die *Project URL* und den *anon public*-Schlüssel
   kopieren und in den Einstellungen der App eintragen.
4. Kennung anlegen, auf jedem Gerät dieselbe.

Abgeglichen wird beim Start, kurz nach Änderungen und beim Verlassen des
Fensters. Bei Streit gewinnt die jüngere Änderung. Ohne diesen Schritt bleibt
alles auf dem Gerät; zum Umziehen dient dann die Sicherungsdatei.

## Was Quizlet Plus hat und dieser Karteikasten nicht

- Gemeinsames Lernen in Gruppen, geteilte Stapel, Bestenlisten
- Fremde Stapel durchsuchen und übernehmen
- Erklärungen zu Schulbuchaufgaben
- KI-gestützte Zusammenfassungen und Fragen aus hochgeladenen Skripten

Handschrift erkennt die Texterkennung nur mäßig; gedruckte Listen dagegen gut.

## Aufbau

```
src/core/     Rechnender Kern ohne Oberfläche
  db.js         IndexedDB
  model.js      Datenmodell
  scheduler.js  Fächer und Abstände
  text.js       Antwortprüfung
  importer.js   Einfuhr und Ausfuhr als Text
  ocr.js        Texterkennung und Spaltentrennung
  media.js      Bilder
  speech.js     Vorlesen
  cloud.js      Abgleich mit Supabase
  store.jsx     Gemeinsamer Datenbestand (React)
src/ui/       Bibliothek, Stapel, Bearbeiten, Einfuhr, Einstellungen …
src/modes/    Die sieben Lernmodi
test/         Prüfungen für den Kern (npm test)
werkzeug/     Erzeugt die Symbole (npm run symbole)
```

## Prüfen

```
npm test
npm run lint
```
