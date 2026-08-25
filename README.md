# Karteikasten

Lern- und Arbeitssystem für das Abitur 2027. Karteikarten mit sieben
Übungsmodi, dazu ein Abrufsystem mit verteilter Wiederholung, Fachtutoren mit
Sperren und Prüfungssimulation. Alles im Browser, ohne Konto, ohne laufende
Kosten.

## Starten

```
npm install
npm run dev
```

Dann `http://localhost:5180` öffnen. Über „Installieren" im Browser landet die
App als eigenes Programm auf dem Gerät und läuft auch ohne Netz.

## Zwei Wege, die sich nicht in die Quere kommen

**Üben** — die sieben Quizlet-artigen Modi: Karteikarten, Lernen, Schreiben,
Buchstabieren, Test, Zuordnen, Meteor. Zum Warmwerden, für Vokabeln, weil es
Spaß macht. Zählt für die Statistik, verschiebt aber keine Termine.

**Abrufen** — der Weg, der zählt: Frage sehen, sich selbst einschätzen, Antwort
tippen, aufdecken, bewerten. Nur hier entscheidet sich, wann eine Karte
wiederkommt.

Die Trennung hat einen Grund: Wiedererkennen (Paare zuordnen, aus vier
auswählen) schadet nicht, es nützt nur weniger. Schädlich wird es erst, wenn
die App daraufhin „beherrscht" meldet.

## Was drin ist

**Verteilte Wiederholung.** FSRS schätzt je Karte, wie lange das Wissen hält,
und setzt den nächsten Termin dorthin, wo es zu kippen droht. Je Fach
einstellbar, wie sicher du sein willst (Chemie-Nomenklatur 95 %,
Überblickswissen 85 %).

**Kalibrierung.** Vor jedem Aufdecken schätzt du dich ein. Daraus entsteht die
Zahl, die zeigt, ob dein Gefühl trägt: Wie oft war „sicher" tatsächlich
richtig? Wer hier bei 60 % steht, lernt nicht zu wenig — er hört zu früh auf.

**Karten erzeugen mit Eigenleistung.** Aus Text oder Foto entstehen
Vorderseiten samt Quellenauszug. Die Rückseite schreibst du selbst; der
Vorschlag wird erst danach zum Vergleich eingeblendet. Ein „Alle übernehmen"
gibt es nicht.

**Erklären.** Ein Thema in eigenen Worten aufschreiben. Die KI nennt
ausschließlich Lücken und stellt Fragen dazu — sie füllt nichts. Jede Fassung
wird aufgehoben; wie eine Erklärung über Wochen wächst, ist der ehrlichste
Fortschrittsmesser.

**Verschachteln.** Mehrere Fächer in einer Sitzung, Herkunft erst nach der
Antwort. In der Prüfung steht auch nicht dabei, welches Verfahren gemeint ist.

**Vorab.** Fünf Fragen zu Stoff, den du noch nicht hattest. Wird nicht
gewertet — der Effekt entsteht durch das Versuchen, nicht durch das Treffen.

**Sechs Fachtutoren mit Sperren.** Mathe rechnet nichts aus. Chemie formuliert
keine Mechanismen. IT schreibt keine Zeile Code. Deutsch liefert keine Deutung
und verlangt Textbelege. Gemeinschaftskunde wertet nicht und trennt [FAKT] von
[WERTUNG]. Gestaltung gibt Kriterien statt Analysen. Weicht einer ab, erscheint
eine Warnung und ein ZURÜCK-Knopf, der die Regeln neu einspielt.

**Prüfungssimulation.** Unter Zeit, ohne Modell, ohne Karten. Auswertung erst
nach der Abgabe — und ohne Note: Die App prüft nur, ob die Kriterien vorkommen,
die du selbst hinterlegt hast.

**Behaltenskurve.** Gemessen, nicht geschätzt: wie oft du eine Karte nach einem
Tag, einer Woche, einem Monat noch wusstest.

**Strähne.** Zählt abgerufene Karten, nicht geöffnete Fenster. Durchklicken
zählt nicht. Zwei Ruhetage im Monat, damit eine Lücke keine achtzig Tage
zerreißt. Daneben steht immer die Kalibrierung — die Strähne misst
Beharrlichkeit, die andere Zahl misst Können.

**Dazu aus der ersten Fassung:** Ordner und Stapel, Bilder auf Karten,
Texterkennung aus Fotos, Vorlesen, Suche, Papierkorb, Druckansicht, hell und
dunkel, Anki-Ein- und -Ausfuhr, Sicherung als Datei.

## Sprachmodell (freiwillig)

Gelernt wird ohne. Gebraucht wird es nur für Kartenvorschläge, das Erklären,
die Tutoren und den Kriterienabgleich.

Am einfachsten mit **LM Studio** auf demselben Rechner: Server starten, in den
Einstellungen die Adresse `http://localhost:1234/v1` eintragen, prüfen. Kein
Schlüssel, keine Kosten, und nichts verlässt das Gerät. Alternativ ein eigener
Schlüssel für OpenAI oder Anthropic — der bleibt lokal gespeichert und wird nie
mit der Wolke abgeglichen.

Es gibt kein freies Chatfenster. Jeder Aufruf folgt einer der Anweisungen in
`prompts/`, die als lesbare Dateien im Projekt liegen. Vor dem Absenden lässt
sich ansehen, was hinausgeht; jeder Aufruf wird protokolliert, und ein
Tagesbudget begrenzt die Zahl.

## Abgleich zwischen Geräten (freiwillig)

1. Bei [supabase.com](https://supabase.com) ein kostenloses Projekt anlegen.
2. Im *SQL Editor* den Inhalt von `wolke.sql` ausführen.
3. In *Project Settings → API* die Adresse und den *anon public*-Schlüssel in
   die Einstellungen der App eintragen.
4. Kennung anlegen, auf jedem Gerät dieselbe.

Ohne diesen Schritt bleibt alles auf dem Gerät; zum Umziehen dient die
Sicherungsdatei.

## Noch einzutragen

Die **Prüfungszeiten** und die **Pflichtlektüren** stehen absichtlich leer: Sie
gelten je Jahrgang und werden hier nicht geraten. Trag sie ein, sobald du sie
aus dem Bildungsplan oder von den Fachlehrkräften hast.

## Prüfen

```
npm test        # 122 Prüfungen, darunter Golden-Tests gegen ts-fsrs
npm run lint
```
