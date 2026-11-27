# Anchor

*(Der Ordner und die Datenbanken heißen weiterhin `karteikasten` — siehe unten.)*

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
npm test         # 500 Prüfungen (Kern, Speicher, Abgleich, Dialoge, Push, Abschnitte)
npm run test:oberflaeche   # die gebaute App in Edge, am Handymaß (playwright-core)
npm run lint
node test-oberflaeche/fotos.mjs <ordner> /start "/einstellungen@Erinnerung"
                 # Bildschirmfotos am Handymaß gegen den laufenden Server
                 # (in der Git-Bash mit MSYS_NO_PATHCONV=1 davor)
npm run symbole  # Symbole aus "Anchor Logo.pdf" (braucht: pip install pymupdf pillow)
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
  noten.js       Punkte der Kursstufe: Halbjahre, Leistungen, Schnitte
  mischen.js     Der Fragemodus: Gewichtung nach Termin, Punkten, Dringlichkeit
  cloud.js       Abgleich mit Supabase (Verbindung, Anmeldung, Ablauf)
  abgleich.js    Die Regeln des Abgleichs als reine Rechnung
  bestand.js     **Alle Daten und jede Änderung daran** — ohne React
  migrationen.js Nummerierte Umstellungen am Datenbestand, mit Kopie davor
  sicherung.js   Sicherungsdatei: Format, Prüfung, Zusammenführen
  notsicherung.js  Alles in eine Datei, wenn die App nicht mehr steht
  aktualisierung.js  Neue Fassungen melden statt still umschalten
  datei.js       Eine Datei zum Herunterladen anbieten
  beispiel.js    Beispielbestand: Maschinerie und durchgerechnete Historie
  beispiel-stoff.js  Der Stoff dazu (Kant, Hauptstädte) — reine Daten
  store.jsx      Nur noch die Brücke von `bestand.js` zu React
prompts/      Die Systemanweisungen als eigene Dateien, versioniert
src/modes/    Abrufen, Fragen, Feynman, Pretest, Tutor, Pruefung + die sieben
              Übungsmodi
src/ui/       Bildschirme und Bausteine
test/         500 Prüfungen (npm test), darunter der ganze Weg der Daten
              gegen einen Testspeicher (fake-indexeddb)
werkzeug/     Erzeugt die Symbole aus dem Logo (Python: pymupdf, pillow)
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
| `noten` | Punkte der Kursstufe, ein Satz je Fach **und** Halbjahr | 6 |
| `lernzeit` | Zeitblöcke Lernen/Erstellen (`core/lernzeit.js`) | 7 |

Karten tragen `nichtRelevant`, Fächer `prioritaet` (1–3). Beides wirkt sich
aus, ohne dass eine Schemafassung nötig war: Fehlt das Feld, gilt der
Normalfall.

Jeder Datensatz trägt `updatedAt` und darf `deleted: true` tragen. Gelöschtes
bleibt als Grabstein, sonst käme es beim Abgleich zurück. Das gilt auch für
gelöschte Tonaufnahmen in `media`.

Weitere Felder, die ohne Schemafassung dazukamen: `reviews.fassung` (nach
welchen Regeln eine Antwort entstand), `reviews.ohneEingabe` (im Kopf statt
getippt), `cardstates.eingefuehrt` (wann zum ersten Mal gewertet — daraus
zählt das Tageslimit) und `cardstates.lapsesFreigabe` (Rückfälle beim letzten
Freigeben einer stillgelegten Karte).

Die Einstellung `datenFassung` sagt, welche Umstellungen aus
`core/migrationen.js` schon gelaufen sind.

## Regeln, die nicht verhandelbar sind

1. **Die Bewertung wird nie aus der Tippeingabe abgeleitet.** Exakte
   Übereinstimmung wird gemeldet, die Note wählt der Mensch. Keine
   Ähnlichkeitsschwelle, kein Levenshtein-Grenzwert im Bewertungsweg.
2. **Der Kalibrierungsaufschlag wirkt auf das Ergebnis von FSRS, nie auf dessen
   Parameter** — sonst wäre die Historie für eine spätere Nachoptimierung wertlos.
3. **`reviews` ist nur-anhängend** und wird nie destruktiv verändert.
4. **Jede Schemaänderung erhöht `VERSION` in `db.js`** und legt vorher eine
   Sicherung in `karteikasten-sicherung` ab.
15. **Die Namen der Datenbanken sind Adressen, keine Titel.** `karteikasten`
    und `karteikasten-sicherung` bleiben, obwohl die App umbenannt wurde: Ein
    Browser findet die abgelegten Daten allein unter diesem Namen wieder. Ein
    neuer Name hieße eine neue, leere Datenbank. Dasselbe gilt für das
    Browserprofil des Starters — dort wird darum umgezogen statt umbenannt.
5. **Kein offenes Chatfenster.** `ki.frage` verlangt den *Namen* einer Anweisung
   aus `prompts/`, nie einen Text. Wer eine neue Fähigkeit will, schreibt eine
   neue Anweisung — und muss sie dabei aufschreiben.
6. **Kein Multiple Choice im Abrufweg.** In den Übungsmodi ja, dort zählt es nicht.
7. **Keine Selbstauswahl der Wiederholungskarten.** Der Nutzer wählt Fach und
   Umfang, nie einzelne Karten oder Themen.

   Zwei Dinge sehen wie Ausnahmen aus und sind keine:

   **Abhaken** (`nichtRelevant`) nimmt eine Karte aus allem heraus. Das ist
   eine Aussage über den Stoff — der Lehrer sagt, das Kapitel wird nicht
   geprüft —, keine über das eigene Können. Darum heißt der Knopf „kommt nicht
   dran" und nicht „kann ich schon". Ob eine Karte sitzt, entscheidet weiter
   der Planer aus dem, was beim Abrufen geschieht; das Gefühl beim Ansehen der
   Vorderseite täuscht verlässlich und immer in dieselbe Richtung. Den Haken
   gibt es in der Stapelansicht und (seit 24. November 2026, auf Wunsch)
   direkt an der Frage im Abrufen, dort mit Rückfrage, die genau das sagt.

   **Der Fragemodus** (`mischen.js`, `modes/Fragen.jsx`) stellt auf Zuruf eine
   Runde zusammen. Er verschiebt keine Termine — seine Antworten tragen
   `practice`. Ohne diese Trennung wäre er die Hintertür, durch die man sich
   seine Wiederholungen selbst zusammenstellt.

   **Rundengröße und „weitermachen“** (seit 25. November 2026, auf Wunsch):
   Klein/Mittel/Groß/Frei ist Umfang, keine Auswahl. Ist alles Fällige
   durch, fragt das Abrufen nur, *ob* es weitergeht; *welche* Karten, nimmt
   `baueWeitere`: neue (über das Tageslimit, zählen normal) oder vorgezogene
   (nächstfällige zuerst, tragen `practice`, damit kein Abstand künstlich
   schrumpft).
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

### Bei Telefon und Tablet

16. **Eingabefelder nie unter 16 Punkten.** Safari auf dem iPhone zoomt sonst
    bei jedem Fokus die ganze Seite heran.
17. **`env(safe-area-inset-*)` gehört zu `viewport-fit=cover`.** Ohne den
    Ausgleich läuft der Inhalt im App-Betrieb unter Statusleiste und Balken.
18. **Keine Pfade ab der Wurzel.** `base: "./"`, relative Verweise im Kopf der
    Seite, `start_url` und `scope` relativ, der Dienst-Arbeiter aus
    `self.registration.scope` abgeleitet — sonst trägt der Bau nur, wenn er
    zufällig ganz oben liegt.
19. **Der Dienst-Arbeiter muss beim Einrichten einlagern, nicht nebenbei.**
    Die Bausteine werden geladen, ehe er die Aufsicht übernimmt. Die Liste
    setzt das Bauwerkzeug ein (`dienstArbeiter` in `vite.config.js`).
20. **Deutsche Anführungszeichen brechen Zeichenketten.** Das schließende ist
    ein anderes Zeichen als das öffnende; wer `„…"` schreibt, beendet die
    Zeichenkette mitten im Satz. Gilt in JavaScript wie in PowerShell — beides
    ist hier schon passiert. Im Zweifel ohne Anführungszeichen formulieren.
21. **`caches.match` braucht `ignoreVary: true`.** Setzt ein Anbieter
    `Vary: Origin`, findet der Browser nichts, obwohl alles im Speicher liegt —
    denn ein `crossorigin`-Skript schickt eine Origin-Kopfzeile mit, das
    Einlagern nicht. Der Fehler zeigt sich nur ohne Netz und nur bei den
    Anfragen des Browsers, nicht bei denen aus dem Programm.
22. **Verweise aus Supabase-Mails landen hinter dem `#`** — dort, wo auch die
    Seitenwege der App liegen, und die Bibliothek liest sie nur beim Aufbau der
    Verbindung. Die App baut sie aber erst bei Bedarf auf. Darum erkennt
    `main.jsx` eine Rückkehr vor dem ersten Zeichnen und stößt
    `rueckkehrVerarbeiten` an; vorher taten Bestätigungs- und Passwortverweise
    scheinbar nichts. Seitenwege beginnen immer mit `/`, eine Rückkehr nie.
23. **`signOut()` ohne `scope` meldet auf allen Geräten ab.** Supabase nimmt
    dann `global`. Abmelden heißt hier `local`; `global` nur ausdrücklich.
    Beim Passwortwechsel meldet Supabase von sich aus niemanden ab.
24. **Prüfen im Browserfenster: Ein Sprung auf dieselbe Seite mit anderem
    `#`-Teil lädt nicht neu.** Wer die Rückkehr prüfen will, braucht einen
    echten Seitenaufruf, etwa mit angehängtem `?probe=1`.
25. **Lernzeit zählt Handlungen, nicht offene Fenster.** Nur auf Lern- und
    Bearbeitungsseiten, nur sichtbar und mit Fokus, Pausen über
    `LEERLAUF` (eineinhalb Minuten) fallen heraus. Die Blöcke liegen nicht im React-Zustand (sonst zeichnet
    die App alle 30 s neu) und werden nur geschrieben, wenn sich ihr Ende
    geändert hat — sonst schöbe ein offenes Fenster den Abgleich endlos
    hinaus. Im Prüfbrowser ist `document.hasFocus()` falsch, es wird dort
    also nichts gemessen.
26. **Tonaufnahmen tragen ihre Zuordnung in der Kennung** (`ton_<karte>_<seite>`
    in der Ablage `media`). Der Abgleich holt nur die Datei, keine Felder
    daneben — stünde die Karte nur in einem Feld, wäre die Aufnahme auf dem
    zweiten Gerät verwaist und beim nächsten Aufräumen weg. Geprüft in
    `test/ton.test.js`. Aufgenommen wird erst bei offener Lösung, und die
    Datenrate ist begrenzt (Sprache, nicht Musik).
27. **Schriftschlüssel dürfen nicht verschwinden.** Die Namen in `SCHRIFTEN`
    (`core/gestaltung.js`) stehen in gespeicherten Einstellungen und in
    Sicherungen. Die alten (`serifen`, `humanistisch`, `schmal`, `buch`,
    `schreibmaschine`) bleiben darum als `alt: true` erhalten: wirksam, aber
    nicht mehr zur Wahl. Geprüft in `test/gestaltung.test.js`.
28. **In der Oberfläche heißt es „Cloud", im Code weiter `wolke`.** Der Nutzer
    hat den englischen Begriff verlangt; die Bezeichner (`core/cloud.js`,
    `wolkeStand`, `Wolkenteil`) bleiben, weil ein Umbenennen nichts sichtbar
    verbessert und überall anfassen müsste. Neue sichtbare Texte also „Cloud".
29. **Die Sicherung wird geprüft, ehe sie etwas ersetzt** (`core/sicherung.js`,
    `test/sicherung.test.js`). „Alles ersetzen" mit einer halben Datei löschte
    sonst den Bestand und legte nichts an dessen Stelle; davor schreibt die
    App zusätzlich ungefragt eine Datei mit dem jetzigen Stand.
30. **Beim Raten der Trennzeichen (Quizlet) darf die Leerzeile nur mitspielen,
    wenn es eine gibt.** Ohne Leerzeile ist der ganze Text ein Stück; das
    erste Trennzeichen darin ergibt genau ein Paar und keine übrige Zeile —
    nach Punkten die beste Lesart, in Wahrheit eine Karte mit der ganzen
    Vokabelliste als Rückseite. Ebenso muss bei Komma das vollwertige
    CSV-Lesen als eigene Lesart antreten, sonst zerschneidet der erste
    Beistrich ein Feld in Anführungszeichen. `test/quizlet.test.js`.
31. **Kalenderdateien (.ics) müssen gefaltet und maskiert werden.** Zeilen über
    75 Oktette und unmaskierte Kommas führen bei Apple und Google nicht zu
    einer Fehlermeldung, sondern zum stillen Verwerfen — man merkt es erst,
    wenn der Termin fehlt. `core/kalender.js`, `test/kalender.test.js`.
    Kennungen werden aus dem Fach gebildet, damit ein zweites Einlesen
    denselben Termin aktualisiert.
32. **Der Fehlerheft-Bereich im Fragemodus reicht Schlüssel herein**
    (`bereich.schluessel`, Format `<karte>:<richtung>`). Geübt wird daraus als
    Übung; die Termine im Abrufen bleiben beim Plan (Regel 7).
33. **Zeichen in ein Feld einsetzen, das React steuert, geht nur über ein
    input-Ereignis** (`ui/Zeichenleiste.jsx`). Wert setzen über den Setter des
    Prototyps, dann `input` auslösen; sonst überschreibt das nächste Zeichnen
    den Wert wieder. Und die Leiste muss `mousedown`/`pointerdown` abfangen,
    sonst verliert das Feld den Fokus und auf dem Telefon klappt die Tastatur
    bei jedem Zeichen zu.
34. **Formeln stehen zwischen `$…$` und werden nur angezeigt, nie verglichen.**
    Überall, wo Kartentext erscheint, läuft er durch `ui/Formel.jsx`
    (gewöhnlicher Text bleibt dabei unverändert). Verglichen und vorgelesen
    wird der Klartext aus `core/formel.js` (`rac{1}{2}` → „1/2", „1 durch 2").
    Hoch- und Tiefzahlen sind bewusst Unicode, kein Formelsatz: Sie lassen sich
    eintippen und überstehen jede Ausfuhr. Beim Schreiben von Python-Skripten
    mit `rac` aufpassen: `` wird sonst zum Seitenvorschub.
35. **Kartenzustände tragen `setId` und `subjectId` mit** — und Tageslimit,
    Pensum und die Balken der Fächer lesen genau diese Felder. Wechselt eine
    Karte den Stapel oder ein Stapel das Fach, müssen die Zustände nachziehen
    (`zustaendeNachziehen` in `core/store.jsx`). Vorher zählten umgehängte
    Stapel stillschweigend weiter fürs alte Fach.
36. **Eine Kopie ist eine neue Karte, eine verschobene bleibt dieselbe.**
    Kopieren und Duplizieren geben eine neue Kennung, also neuen Lernstand;
    Verschieben behält Kennung und Lernstand (`core/auswahl.js`). Tonaufnahmen
    hängen an der Kennung und müssen beim Kopieren mitkopiert werden.
37. **Der Formel-Editor (MathLive) lädt keine eigenen Schriften.** Er erkennt
    die KaTeX-Schriften, die `ui/Formel.jsx` über `katex.min.css` einbindet,
    und nutzt sie mit (`fontsDirectory = null`). Fällt diese Einbindung weg,
    steht der Editor ohne Schrift da. Seine Sonderbefehle (`\differentialD`,
    `\placeholder` …) übersetzt `editorZuKatex`; `test/formeleditor.test.js`
    setzt jeden Baustein und jedes Zeichen mit KaTeX.
38. **Zurück geht über den Verlauf** (`zurueck`, `zurueckZu`, `ersetze` in
    `App.jsx`). Einen festen Zielweg nur als Ersatz angeben, wenn es keinen
    Vorgänger gibt; sonst landet man bei „Alle Stapel" statt im Fach.
39. **Tastenkürzel nie auf Zeichen legen, die man beim Tippen braucht.**
    Die Leertaste deckte beim Abrufen auch mitten im Satz auf; mehrwortige
    Antworten waren unmöglich. Solche Kürzel mit `wenn` eingrenzen (etwa nur
    bei leerem Feld). `useTastatur` schweigt außerdem, solange ein Dialog
    (`.schleier`) den Fokus hat, sonst deckt Enter im Formel-Editor die Karte auf.

40. **Geschrieben wird über `bestand.js`, nie aus der Oberfläche heraus.**
    Eine Änderung wird im Arbeitsspeicher sichtbar **und** geschrieben; ein
    Fehler landet in `speicherfehler` und wird oben angezeigt. Wer in einer
    Komponente `db.put` aufruft, umgeht beides.
41. **Was zusammengehört, in einem Zug** (`db.schreibeMehrere`): Antwort und
    Termin, Karte und Lernstand, eine Seite geholter Daten. Ein Zug gelingt
    ganz oder gar nicht — und er wird ausdrücklich abgeschlossen (`commit`),
    sonst verwirft ihn ein Neuladen mitten im Tippen.
42. **Zwei Uhren beim Abgleich, und sie sind verschieden.** `updatedAt` ist
    die Änderungszeit auf dem Gerät und entscheidet, welcher Stand gewinnt.
    `geaendert` stempelt der Server beim Ankommen und entscheidet, was man
    schon geholt hat. Wer beides verwechselt, verliert offline Gelerntes.
43. **Änderungen an der Form von Einträgen gehören in `migrationen.js`**, mit
    neuer Nummer und Prüfung, nicht als Flicken beim Laden. Eine
    veröffentlichte Umstellung wird nie geändert, nur eine neue angehängt.
44. **Vokabelregeln gelten nicht für Rechnungen.** `normalisiere` wirft
    Klammern, Minuszeichen und Tippfehler weg — für „(sich) erinnern" richtig,
    für „x = −3" falsch. Für Rechnungen und Zahlen entscheidet
    `gleichwertig`/`istMathe` in `text.js`, streng.
45. **Ein leeres Antwortfeld ist kein Durchklicken.** Wer im Kopf antwortet
    und sich ehrlich bewertet, hat abgerufen; bei Rechenweg-Karten ist das
    Feld am Ende ohnehin leer. Unecht ist nur, was zu schnell kommt.
46. **Keine Browserfenster.** `window.confirm`, `prompt` und `alert` sehen auf
    dem iPhone fremd aus und fehlen in mancher installierten App ganz. Dafür
    gibt es `bestaetigen`, `erfragen` und `hinweisen` aus `ui/Rueckfragen.jsx`,
    jeweils mit `await`.
47. **Klickbare Flächen, die keine Knöpfe sein können** (Kachel mit Menü,
    Ordnerzeile mit Pfeil), bekommen `{...KLICKBAR}` aus `basis.jsx`. Sonst
    kommt man mit der Tastatur nicht hin. Alles andere ist ein `<button>`.
48. **Knöpfe in Formularen.** `Knopf` und `SymbolKnopf` sind von sich aus
    `type="button"`; absenden tut nur, wer `type="submit"` trägt. Vorher
    speicherte das Kreuz „Abbrechen" neben einem Namensfeld den Namen.
49. **Kopfzeilen:** Titel als `h1`, Knöpfe in `.kopf-werkzeuge`, das „···" in
    `.kopf-mehr`. Einzeln neben den Titel gestellt, brechen sie auf dem
    Telefon zu einer Treppe um.
50. **Dialoge übereinander:** Escape und Tabulator gelten nur dem obersten
    (`ui/dialogstapel.js`). Nicht selbst auf Escape hören.
51. **Ordner in Fächern sind gewöhnliche Ordner mit `subjectId`** (siehe
    `core/fachordner.js`). Kein zweites Ordnersystem anlegen. Sie stehen nur
    beim Fach, nicht im allgemeinen Ordnerbaum; ist das Fach weg, werden sie
    wieder gewöhnliche Ordner. Auflösen statt Löschen: Stapel rücken hinauf,
    nichts wandert in den Papierkorb außer dem Ordner. Abgerufen wird das ganze
    Fach — oder, auf Wunsch, ausgewählte Ordner (siehe Ausnahme unten).
52. **Push-Erinnerung ohne eigenen Server** (`core/pushplan.js`, `core/push.js`,
    `werkzeug/push-senden.mjs`, Auftrag `push-erinnerung.yml`). Die App schreibt
    nur Zahlen (fällige Karten je Tag) in `anchor_lage`; der Absender auf
    GitHub liest über `anchor_push_auftraege` mit einem Geheimnis, dessen
    Fingerabdruck in `anchor_push_zugang` liegt. Kein service_role. Die
    Protokolle des öffentlichen Projekts sind lesbar: dort nie Geräte,
    Adressen oder Kartenzahlen ausgeben. `web-push` ist Entwicklungs-
    abhängigkeit nur für den Absender, nicht im Bündel der App.
53. **Abschnitte sind keine Karten** (`core/abschnitte.js`). Sie stehen am
    Stapel (`abschnitte: [{ id, titel }]`), die Karte trägt `abschnitt`.
    Kein Lernmodus und keine Zählung muss sie kennen. Nach jeder Änderung
    an Abschnitten folgt `order` der Anzeige (`nachAnzeigeOrdnen`), damit
    Übungsmodi in derselben Reihenfolge abfragen.
54. **Ziehen an der ganzen Zeile** (`anfassen` in `ui/ziehen.js`): Maus nach
    ein paar Punkten Weg, Finger erst nach kurzem Halten. Felder und Knöpfe
    sind ausgenommen. Listen um Kartenzeilen brauchen
    `gridTemplateColumns: "minmax(0, 1fr)"`, sonst ragen sie am Telefon hinaus.
55. **Rückgängig und Nachlernen im Abrufen.** `abrufZuruecknehmen` löscht die
    Bewertung mit Vermerk und stellt den Zustand davor her (zehn Sekunden,
    Taste Z; stellt auch die Folge der Sitzung wieder her). Wiedervorlagen
    regelt seit dem 24. November 2026 `core/wiedervorlage.js` (siehe 70);
    sie kommen **ohne Selbsteinschätzung** — sonst verfälschte der zweite
    Versuch die Kalibrierung. Das Ergebnis der Sitzung zählt nur erste
    Versuche. Eine Wiedervorlage wegen Langsamkeit wird als Übung verbucht
    (FSRS hat die Karte schon als gewusst), ist sie dann falsch, als echter
    Fehler.
56. **Der Lerntag beginnt um 4 Uhr** (`util.js`: `tagesSchluessel`,
    `lerntagBeginn`). Für Lernzahlen immer diese; für echte Daten
    (Termine, Dateinamen) `kalenderSchluessel`. Wer Tage durchzählt, rechnet
    ab 4 Uhr oder mittags, nie ab Mitternacht.
57. **Seiten laden bei Bedarf** (`lazy` in `App.jsx`), KaTeX erst bei der
    ersten Formel (`Formel.jsx`). Was beim Start zu sehen ist, nicht lazy
    machen. Ein statischer Import aus einer eifrigen Datei hebt das Aufteilen
    auf (Rolldown warnt: INEFFECTIVE_DYNAMIC_IMPORT).
58. **Abstände nur in Stufen**: Klassen `oben-N`/`unten-N` mit N aus 0, 4, 8,
    12, 16, 24, 32. Keine neuen Einzelwerte in `style`.
59. **Vor größeren Umbauten `npm run test:oberflaeche`.** Er klickt die
    Hauptwege durch und misst, ob am Handy etwas über den Rand ragt.
60. **Am PC ist die veröffentlichte Seite die App** (in Edge installiert).
    `localhost` aus „Anchor (alte Fassung)“ dient dem Umzug und dem
    Entwickeln (`core/umzug.js`, `ui/Umzug.jsx`). Daten liegen je Adresse
    getrennt im Browser; nur Abgleich oder Sicherungsdatei verbinden sie.
61. **Erinnerung am iPhone über „Kurzbefehle“** (`core/kurzbefehl.js`,
    `anchor_heute` in wolke.sql Fassung 6). Push über GitHub kommt nur alle
    paar Stunden (gemessen: etwa alle acht), taugt also nicht für Uhrzeiten.
    Die Adresse trägt einen eigenen Schlüssel (in der Wolke nur sein
    Fingerabdruck) und den öffentlichen Schlüssel als `apikey`; die Funktion
    hat darum einen unbenutzten Parameter `apikey`. Antwort nur Zahl und
    Satz, `text` ist null, wenn nichts fällig ist. Die Vorschau
    (`anchor_lage`) wird auch beim Verlassen der App sofort geschrieben.
62. **Der Quizlet-Knopf ist ein Lesezeichen** (`core/quizletknopf.js`). Die
    Funktion `quizletKnopf` läuft auf quizlet.com: nichts von außerhalb
    benutzen, altes JavaScript, und die Adresse endet auf `void 0` — sonst
    ersetzt der Browser die Seite durch den Rückgabewert. Quizlet sperrt
    automatische Browser aus; geprüft wird an nachgebauten Seiten. Ein
    eingefügter Quizlet-Link ist keine Karte (`nurQuizletLink`), vorher wurde
    er am Doppelpunkt zu „https“ geteilt.
63. **Am Telefon wird nicht gezoomt** (`touch-action: pan-x pan-y` am
    Wurzelelement bei groben Zeigern). Doppeltippen auf Text zoomte vorher
    heran, danach ließ sich die Seite seitlich schieben. Unten steht die
    `Fussleiste` (App.jsx); `.mitte` hält unten Platz dafür frei.
64. **Wischen nur in Übungsmodi** (`ui/wischen.js`, Karteikarten). Im
    Abrufen nie: Dort steht vor jeder Bewertung das Aufdecken. Die Karte ist
    je Karte neu aufgebaut (`key`), sonst dreht sie sich beim Weiterblättern
    sichtbar zurück und zeigt kurz die Antwort der nächsten.
65. **Quizlet-Stapel aus einer Datei** (`core/quizletdatei.js`): PDF, Safari-
    Webarchiv, MHTML, HTML — erkannt am Inhalt, nicht an der Endung. Fremde
    Stapel lassen sich ohne Plus weder exportieren noch kopieren, die Seite
    sichern geht immer. PDF liest pdf.js (`pdfjs-dist`, Mozilla, die einzige
    Abhängigkeit dafür, der `legacy`-Bau für ältere iPhones); es lädt erst
    beim Einlesen und steht **nicht** im Vorrat des Dienst-Arbeiters
    (`vite.config.js`), sonst wüchse jede Aktualisierung um 1,8 MB. Aus den
    Textstücken werden Zeilen, daraus Paare: Tabelle (Rechner), Blöcke
    (Telefon), sonst abwechselnd. Beispieldateien in `test/daten`.
66. **`resolve.preserveSymlinks` bleibt an** (`vite.config.js`). OneDrive
    macht aus `node_modules` Platzhalter; Rolldown folgt ihnen beim Auflösen
    und findet dann kein Paket mehr — im Bau und im Entwicklungsserver, während
    Node alles findet. Zeigt sich erst Stunden nach `npm install`.
67. **„Lernen“ läuft nach Quizlet-Art** (`core/lernsitzung.js`, seit dem
    19. November 2026): Stufen neu → bekannt → gemeistert in einer Sitzung,
    Stand je Stapel im Gerät (`useMerker("lernen:<stapel>")`), Antworten als
    Übung. Der alte Rundenbau aus `scheduler.js` (`baueRunde`) wird dort nicht
    mehr gebraucht. „Beide Richtungen“ heißt in Lernen und Karteikarten
    „Zufällig je Karte“.
68. **Jede Funktion hat einen festen Farbton** (`Sinnbild` in `ui/basis.jsx`,
    Töne `--ton-*` in `stil.css`, im hellen Design dunkler): Abrufen blau,
    Fächer grün, Erklären und Lernen lila, Prüfungen und Test orange,
    Fehlerheft rot, Kalibrierung und Fortschritt türkis, Fragen gelb. Ein
    neues Sinnbild bekommt den Ton seiner Funktion, keinen neuen. Bewegungen
    rechnen mit `--wechsel` (0 bei „Ruhige Oberfläche“) und fallen bei
    `prefers-reduced-motion` aus. Kein Seiteneffekt per `transform` auf
    `.mitte`: sonst wird sie zum Bezugsrahmen fester Elemente.
69. **Tutoren sind ausgeblendet** (Wunsch des Nutzers, 19. November 2026): nur
    der Eintrag in der Seitenleiste fehlt, der Weg `/tutor` besteht weiter.
70. **Wiedervorlage nach Erinnerungszeit** (`core/wiedervorlage.js`, seit dem
    24. November 2026, Karteikarten und Abrufen): falsch → nach A Karten
    wieder (A = 90 s / Stapel-Median, 3–10), langsam richtig → einmal nach
    2·A, nach vier Fehlern Problemkarte. Alle Zahlen in `WERTE`. Gemessen wird
    vom Erscheinen bis zum Umdrehen, ohne Zeit im Hintergrund
    (`ui/stoppuhr.js`), gespeichert als `reviews.erinnerungszeit` — zusätzlich
    zu `antwortzeit`, die ihre Bedeutung für die Plausibilität behält.
    Mediane nur aus richtigen Antworten. Nur die Reihenfolge der Sitzung;
    Termine bleiben bei FSRS. Simulation: `werkzeug/wiedervorlage-simulation.mjs`.
71. **Zahlenfelder mit Komma nie als `type="number"`.** Am iPhone fehlt dort
    je nach Tastatur das Komma, und aus „0,5“ wird mal nichts, mal eine 5.
    Stattdessen Textfeld mit `inputMode="decimal"`, das seinen Text beim
    Tippen behält (`ZahlFeld` in `ui/Noten.jsx`, Lesen mit `zahlLesen`).
    Punkte: Leistungen haben Sorten (Klassenarbeit, Test …) mit Gewicht,
    Bezeichnungen zählen sich selbst durch (`leistungsName`), Leistungen ohne
    Punkte (`null`) zählen nicht mit.
72. **Einstellungen sind Unterseiten** (`#/einstellungen/<gruppe>`, seit
    25. November 2026): lernen, stimme, erinnerung, aussehen, cloud, daten,
    erweitert. Wer auf eine Einstellung verweist, verweist auf die Gruppe
    (Rückkehr aus der Cloud-Anmeldung: `/einstellungen/cloud`).
73. **Erklärtexte und Hilfe.** Bedienhinweise stehen nur in `core/hilfe.js`
    („Fragen zur App“, `#/hilfe/<frage>`), an der Stelle ein `HilfeLink`
    („?“). Übrige Erklärtexte tragen die Klasse `erklaerung`; „Minimal“
    (Einstellungen → Aussehen, `erklaerungen: false` + schlichte Sinnbilder)
    blendet sie aus. Warnungen und Rückfragen bekommen die Klasse nie.
    `test/hilfe.test.js` prüft, dass jedes „?“ auf eine vorhandene Frage zeigt.
74. **Vorlesestimme nach Güte** (`core/speech.js`): natürlich (Edge Natural,
    Apple Premium) vor erweitert vor einfach, dann Gegend (es-ES, de-DE), dann
    männlich (Wunsch des Nutzers). Eigene Wahl je Sprache in `localStorage`
    (`anchor:stimmen`), pro Gerät, nicht im Abgleich. Edges natürliche
    Stimmen brauchen Netz; scheitern sie, liest die beste lokale.
75. **„Oben im Stapel“** (`stapelOben`: abrufen | karteikarten): Die
    Karteikarten-Vorschau wie bei Quizlet (`ui/KartenVorschau.jsx`) verbucht
    nichts. Vom Nutzer zum Ausprobieren gewünscht; Vorgabe bleibt Abrufen.
    Mit „Abrufen“ steht oben gleich die erste Frage des Stapels mit der
    Einschätzung (`ui/AbrufEinstieg.jsx`); ein Tipp führt nach
    `/abrufen/<fach>/stapel/<id>/start/<karte:richtung>/<konfidenz>`, und das
    Abrufen setzt diese Karte vorn ein, die Einschätzung gesetzt, ohne
    Größenwahl. Der Aufbau dort ist wiederholbar (kein „schon erledigt“-Ref):
    React führt Effekte beim Entwickeln doppelt aus.
76. **Klausuren** (`core/klausuren.js`, seit 25. November 2026): mehrere je
    Fach (`subjects.klausuren`: name, datum, ordnerIds, stapelIds; nichts
    zugeordnet = ganzes Fach). `pruefungsdatum` wird im Datenspeicher
    (`store.jsx`, `mitKlausurTermin`) aus der nächsten kommenden Klausur
    abgeleitet — wer Fächer liest, bekommt es fertig; wer schreibt, schreibt
    `klausuren`. Ein Fach ohne Liste behält seinen alten Termin (erscheint als
    Klausur „Prüfung“, Kennung `termin`, bekommt beim ersten Speichern eine
    echte). Endspurt nimmt nur die Stapel der nächsten Klausur.
    Stapel sortieren: `SORTIERUNGEN`/`stapelSortieren`, gemerkt als
    `stapelSortierung`.
77. **Klausurnähe gewichtet das Abrufen** (seit 26.11.2026, Wunsch des
    Nutzers): `baueSitzung({ gewicht })` zieht unter den Fälligen gewichtet
    zufällig (`gewichtetZiehen`) und ordnet gewichtet (`gewichtetReihen`);
    Gewicht aus `gewichtNachKlausur` (Klausur bis 30 Tage vorher bis ×5, dazu
    bis ×2 für Überfälliges). Keine Selbstauswahl: Fällig bleibt fällig.
    `/abrufen/alle[/start/<karte:richtung>/<k>]` ruft alle Fächer ab (von der
    Startseite, dort die erste Frage per `AbrufEinstieg startseite`).
78. **Verschenkte Punkte** (`halbjahrVerschenkt`, `abiStand().verschenkt`):
    Σ (15 − Fachpunkte) / alle Fächer des Halbjahres, fürs Abi × 10. Rot am
    rechten Balkenende; erreicht + verschenkt + Hochrechnung ≤ 900. Startseite:
    nur Zahlen und Balken, Sätze erst nach Tipp; kleine Balken ohne Ziel-Strich.
79. **Probe-Modus bei den Punkten** (`ui/Probe.jsx`): Probenoten nur in
    localStorage (`kk:punkteProbe`), über `useNotenfaecher()` in Punkte-Seite
    und Ziel-Bausteinen eingemischt, nie in `notenfaecher` geschrieben.
80. **Antippen abbrechen** (`main.jsx`): Zieht man den Finger von einer
    Kachel/einem Knopf weg, schluckt ein Klick-Abfang den Klick. Zurück-Pfeil
    endet an der Startseite.
81. **Navigation** (26.11.2026): Jede Unterseite und jeder Vollbild-Modus
    beginnt links mit `ZurueckKnopf` (basis.jsx, rund, nur Pfeil). In den
    Modi bleibt am Handy die Logo-Leiste (`ui/MenueStreifen.jsx`, darin auch
    `VerlaufKnoepfe`) — `ModusRahmen` klebt Leiste und Kopf gemeinsam
    (`.modus-oben`). Top-Reiter (Start, Fächer, Stapel) haben keinen.
82. **Navigierleiste** (= untere Leiste): gleitender Zeiger `.fuss-zeiger`,
    Größe `navGroesse` (→ `--nav-skala` am Wurzelelement), `erstellen`:
    "plus" (runder Knopf, `PLUS_WEGE`) | "vereint" (Reiter Erstellen,
    Stapel als Leiste auf der Fächer-Seite). Erstellen-Blatt: `ui/Erstellen.jsx`.
83. **Startseite-Einstieg** (`AbrufEinstieg startseite`, Stand 27.11.2026),
    seit dem Abend der **Lernsnack** — ein vollwertiger kleiner Abruf in der
    Kachel: Einschätzung → Antwort tippen → aufdecken → bewerten, ohne
    Sprung, ganz normal verbucht (`abrufVerbuchen`, flag `normal`). Nur
    ansehen gäbe es nicht: Das wäre Erleichtern statt Erzwingen. Umfang
    wählbar (`snackGroesse`: 5/10/20/ohne Ende) — Umfang, keine Auswahl.
    Beide Kästen haben feste Maße: Das „Blatt“ trägt Frage und Lösung
    übereinander (die verdeckte Seite hält die Höhe), die Handlungszeile ist
    56 px hoch, was auch darin steht. Die getippte Antwort steht in der
    Kopfzeile, nicht im Blatt — dort ließe sie es beim Tippen wachsen.
    Was davor galt:
    Einschätzung → kleines Antwortfeld; ein Tipp **irgendwo auf die Kachel**
    (außer auf Knöpfe, Feld und die Einschätzungsfrage) führt nach
    `/abrufen/alle/start/<karte:richtung>[/<k>]` — normales, verbuchtes
    Abrufen. `startseiteModus: "karteikarten"` zeigt stattdessen
    `KartenVorschau` (anstehende Karten, `reihenfolgeBehalten`).
    Die Frage wechselt dort nicht bei jedem Blick: Die Wahl gilt eine halbe
    Minute (`WAHL_GILT`, neben der Komponente, überlebt den Seitenwechsel) —
    wer zwischen Start und Stapel hin und her geht, findet dieselbe Frage.
    Im Abrufen wird die mitgegebene Karte **aus ihrem Schlüssel gebaut**
    (`aufgabeAusSchluessel`), nicht in der Sitzung gesucht: Neue Karten zieht
    `baueSitzung` zufällig und nur bis zum Tageslimit, die gesuchte fehlte
    also oft — dann kam eine andere Frage und die Einschätzung war verloren
    (`test/startkarte.test.js`).
    Der Übergang liegt in `ui/uebergang.js` (`wachsend`) und gehört dem
    Browser: `startViewTransition`, und beide Seiten tragen denselben
    `view-transition-name: abruf-karte` (die Kachel der Startseite, der
    Frageblock im Abrufen — darum dort die eigene Klasse `abruf-frage`, denn
    `.frage-block` steht in mehreren Modi, zum Teil zweimal auf einer Seite,
    und ein Name darf nie doppelt vorkommen). Das Versprechen der Rückruf-
    funktion wird erst eingelöst, wenn die neue Seite steht: `App.jsx` meldet
    das über `wegGesetzt()` aus einem Effekt (nach dem Einbauen, vor dem
    Zeichnen), Notbremse nach 500 ms. Sonst fotografiert der Browser den
    alten Zustand zweimal — und jede Wartezeit steht dem Nutzer als
    stehendes Bild vor Augen. Darum auch `.im-uebergang` am Wurzelelement:
    Die neue Seite blendet währenddessen nicht noch einmal ein (`.mitte`),
    zwei Blenden übereinander sahen fahl aus. Die Logo-Leiste trägt
    `view-transition-name: kopfleiste` und bleibt dadurch stehen. Zwei Anläufe davor scheiterten: die Kachel selbst
    in Lage und Maßen zu bewegen ließ den Browser jedes Bild neu setzen und
    hakte; eine Kopie mit aufgehendem `clip-path` lief flüssig, ließ aber
    dazwischen einen dunklen, leeren Augenblick. Kann der Browser keine
    View Transitions oder ist `--wechsel` 0 („Ruhige Oberfläche“), geht es
    ohne Bewegung weiter; `.mitte` blendet ohnehin weich ein.
84. **Ausstehende Leistungen** (`notenfach.ausstehend = { anzahl, sorte }`,
    `fachBestfall`, `ausstehendVon`): verschenkt = 15 − Bestfall. Im
    Ziel-Balken liegen die Schichten übereinander, jede für sich ganz rund
    (Wunsch des Nutzers, 27.11.2026): zuunterst blass die Hochrechnung,
    darüber Rot bis „erreicht + verschenkt“, obenauf der erreichte Balken.
    So schaut Rot rechts unter dem erreichten hervor, ohne eigene Rundung am
    Anfang. Sehr kleine Werte bleiben mindestens so breit wie hoch.
85. **Grundfarbe** (`grundton` in der Gestaltung): setzt `--grund*`/`--rand`
    und hell/dunkel nach Helligkeit; null = wie das Design.
86. **Am Handy ist jede Seite ≥ 100dvh + 1px** (`.buehne`): Auf kurzen Seiten
    stand die Navigierleiste in der iPhone-App sonst zu hoch.

87. **Der Balken oben in den Modi** (`core/fortschritt.js`, 27.11.2026):
    Er misst nicht die Stelle in der Runde, sondern was sitzt — richtig ein
    ganzer Punkt, ein Fehlversuch ein halber. Je Karte zählt nur ihr bester
    Stand (`Math.max`), sonst schöbe dieselbe dreimal falsch beantwortete
    Karte den Balken dreimal. Abrufen rechnet aus `ergebnisse`, Karteikarten
    aus „Weiß ich / Noch üben“; Nenner sind die **verschiedenen** Karten der
    Runde, Wiedervorlagen sind dieselbe Karte. `test/fortschritt.test.js`.
88. **Stapel ohne Fach** (Fächerseite): Die Zeile öffnet den Stapel, das
    Auswahlfeld ordnet ihn einem Fach zu, der Papierkorb wirft ihn weg —
    beide halten den Klick auf (`stopPropagation`), sonst öffnete sich der
    Stapel.

## Stapel aus Lernmaterial (im Chat)

Der Nutzer schickt ein Arbeitsblatt (PDF, Foto) und nennt die Aufgaben, die
er als Karten will. Daraus wird eine **Stapeldatei** (`src/core/stapeldatei.js`,
Format im Kopfkommentar), die er über „Stapeldatei einlesen“ (Fachseite oder
Menü von „Alle Stapel“) einliest.

- **Er wählt die Aufgaben, nicht Claude.** Selbst Aussuchen ist Teil des Lernens.
- Aber: Das ganze Blatt durchsehen. Fehlt ein **Aufgabentyp** in seiner Auswahl,
  nicht stillschweigend ergänzen, sondern darauf hinweisen und nachfragen.
- Rechenwege als `mehrschritt` mit sinnvollen Zwischenschritten, Formeln in
  `$…$` (KaTeX), Merkstoff als `cloze`. Hinweise nur, wo sie beim Abrufen helfen.
- Dateien nach `Stapeldateien/` (nicht im Git) schreiben; vorher mit
  `stapeldateiLesen` prüfen.

## Was ausdrücklich nicht gebaut wird

Kein offenes Chatfenster · kein „Lösung anzeigen" im Tutormodus · kein Multiple
Choice im Abrufweg · kein „Alle KI-Karten übernehmen" · kein Wiederlese- oder
Zusammenfassungsmodus · keine Notenvorhersage · keine Strähne für das Öffnen ·
keine Selbstauswahl der Wiederholung · keine Erklärvideos.

**Ausnahme, vom Nutzer entschieden (25. November 2026): Ziele und
Vorhersage bei den Punkten.** Ein Abi-Ziel (0–900) und Ziele je Halbjahr,
ein Balken, der sich füllt, die Hochrechnung und „was ab jetzt nötig ist“
(`abiStand`, `halbjahrBedarf`, `naechsteArbeit` in `core/noten.js`,
`ui/Ziele.jsx`, auch ganz oben auf der Startseite). Ausdrücklich ein grobes
Gerüst — alle Halbjahre gleich, Prüfungen mit dem Schnitt geschätzt — und so
beschriftet. Die Notenvorhersage *für Karten* bleibt ausgeschlossen.

**Ausnahme, vom Nutzer entschieden (28. Oktober 2026):** Innerhalb eines Fachs
lassen sich Ordner zum Abrufen auswählen (`abrufStapel` in
`core/fachordner.js`, Weg `/abrufen/<fach>/ordner/<id,id>`). Nachgefragt und
ausdrücklich gewollt. Die übrigen fälligen Karten bleiben fällig; „Abrufen“
ohne Auswahl nimmt weiter das ganze Fach.

**Zweite Ausnahme, vom Nutzer entschieden (19. November 2026)**, nach
Rückfrage mit der Folge im Wortlaut: (1) Für eine Sitzung lassen sich
einzelne Stapel eines Fachs wählen (Weg `/abrufen/<fach>/stapel/<id,id>`,
Dialog „Auswahl …“ auf der Fachseite). (2) Ein Stapel lässt sich im Abrufen
ruhen lassen (`ruht: { seit, tage }` am Stapel, `ruht()` in `core/model.js`):
Er fällt aus Plan, Sitzung, Endspurt und allen Zählungen
(`warteschlange.js`), der Lernstand bleibt, und nach `tage` erinnert eine
Mitteilung daran. Beim Zurückholen steht da, wie viel dann fällig ist
(`rueckkehrStand`). Einzelne Karten bleiben ausgeschlossen: dafür gibt es nur
„kommt nicht dran“. Keine weitere Auswahl ohne erneute Rückfrage.

Erscheint eines davon unterwegs sinnvoll, ist das das Zeichen, dass die
Spezifikation gerade erodiert — dann Rückfrage, kein Alleingang.

## Offen

- Prüfungszeiten und Pflichtlektüren sind leer und werden nicht geraten.
- Die Abiturnote wird nicht gerechnet. Block I und Block II, Einbringungs-
  pflichten und doppelt gewichtete Kurse stehen in der Verordnung des
  Jahrgangs; `noten.js` liefert bewusst nur den Durchschnitt der erfassten
  Halbjahresleistungen und sagt in der Oberfläche, dass er das ist.


- FSRS-Parameteroptimierung aus der eigenen Historie — dafür braucht es erst
  ein paar hundert Reviews.
- Übungsmodi rechnen weiter mit dem alten Fächersystem (`progress`,
  `scheduler.js`), der Plan mit FSRS. Beides nebeneinander ist gewollt, aber
  auf Dauer eine Quelle von Missverständnissen; die Namen sind inzwischen
  getrennt (`uebungsStufe`, `uebungsAnteile`).

## Vorgehen

Ein Zweig je Phase, kleine Commits, keine Umbauten außerhalb der laufenden
Phase. Nach jeder Änderung `npm run lint` und `npm test`. Neue Logik im Kern
bekommt eine Prüfung. Keine Abhängigkeit ohne Nennung und Begründung.
