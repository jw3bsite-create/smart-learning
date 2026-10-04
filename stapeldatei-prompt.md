# Prompt für normale Claude-Chats: Stapeldatei für Deep Dive

Diesen Text in einen gewöhnlichen Chat kopieren (claude.ai, App), dann das
Arbeitsblatt als PDF oder Foto anhängen. Der Chat kennt Deep Dive nicht,
darum steht hier alles, was er wissen muss.

---

Ich lerne mit **Deep Dive**, einer eigenen Karteikarten-App (Abitur 2027,
Technisches Gymnasium Baden-Württemberg). Sie liest ganze Stapel aus einer
Datei ein: Einstellungen sind nicht nötig, ich öffne in der App ein Fach oder
„Alle Stapel“ und wähle **Stapeldatei einlesen**. Dort kann ich eine
`.json`-Datei auswählen oder ihren Text einfügen.

**Deine Aufgabe:** Aus dem Material, das ich dir schicke, genau eine solche
Datei bauen. Antworte auf Deutsch.

## Das Format

Eine Datei ist JSON und sieht so aus:

```json
{
  "format": "deep-dive-stapel",
  "fassung": 1,
  "titel": "Ableitungen, Wahlteil",
  "fach": "Mathematik",
  "beschreibung": "Arbeitsblatt vom 12.09., Aufgaben 1 bis 4",
  "karten": [
    {
      "vorderseite": "Ableitung von $x^n$",
      "rueckseite": "$n \\cdot x^{n-1}$",
      "hinweis": "Hochzahl nach vorn, dann eins abziehen"
    },
    {
      "art": "mehrschritt",
      "vorderseite": "Leite $f(x)=(2x+1)^3$ ab.",
      "schritte": [
        { "frage": "Äußere Ableitung", "antwort": "$3(2x+1)^2$" },
        { "frage": "Mal innere Ableitung", "antwort": "$6(2x+1)^2$" }
      ]
    },
    {
      "art": "cloze",
      "vorderseite": "Die {{Kettenregel}} gilt für verkettete Funktionen."
    }
  ]
}
```

### Regeln, an die sich die App hält

- `format` und `fassung` stehen immer genau so da.
- `titel` und `fach` sind freiwillig, aber hilfreich. Trifft `fach` den Namen
  eines vorhandenen Fachs, landet der Stapel dort; sonst biete ich es beim
  Einlesen als neues Fach an.
- Jede Karte braucht eine `vorderseite`.
- **`art` weggelassen** (oder `"frei"`): gewöhnliche Karte, braucht zusätzlich
  eine `rueckseite`.
- **`"art": "mehrschritt"`**: ein Rechenweg. Braucht `schritte`, eine Liste von
  `{ "frage": …, "antwort": … }`. `frage` darf leer sein. Die App fragt jeden
  Schritt einzeln ab — das ist die beste Form für Mathe, Chemie und Physik.
- **`"art": "cloze"`**: Lückentext. Alles, was in `{{doppelte Klammern}}` steht,
  wird abgefragt. Mehrere Lücken sind erlaubt, jede wird eigenständig geplant.
- `hinweis` ist freiwillig und wird beim Lernen erst auf Wunsch gezeigt.
- **Bilder gehen nicht.** Eine Karte, die ein Bild bräuchte, beschreibe ich
  lieber in Worten oder lasse sie weg.
- Formeln stehen zwischen Dollarzeichen in LaTeX-Schreibweise: `$\frac{1}{2}$`,
  `$x^2$`, `$\sqrt{3}$`, `$\int_0^1 x\,dx$`. Im JSON wird der Backslash
  verdoppelt (`"$\\frac{1}{2}$"`). Ein echtes Dollarzeichen wäre `\$`.

### Worauf die App beim Antworten achtet

Die App vergleicht Rechnungen **streng**: Vorzeichen und Klammern zählen, bei
Zahlen gibt es keine Tippfehler-Nachsicht. Schreib Lösungen darum so, wie ich
sie eintippen würde, und eindeutig. Mehrere Lösungen trennst du mit „oder“:
`"x = 2 oder x = -2"`. Bei Vokabeln und Texten ist die App nachsichtig
(Artikel, Groß- und Kleinschreibung, kleine Tippfehler).

## Wie du arbeiten sollst

1. **Ich wähle die Aufgaben aus, nicht du.** Sag mir, wenn dir eine Angabe
   fehlt, und halte dich an meine Auswahl.
2. **Sieh trotzdem das ganze Blatt durch.** Fehlt in meiner Auswahl ein ganzer
   Aufgabentyp, ergänze ihn nicht einfach, sondern **frage nach**, ob er mit
   soll.
3. **Ein Aufgabentyp, eine Karte.** Nicht zwanzig Varianten derselben Rechnung.
4. **Kleine Karten.** Eine Karte fragt eine Sache ab. Was ich immer wieder
   vergesse, legt die App irgendwann still und schlägt mir vor, es zu teilen.
5. **Frage vor Wiedererkennen.** Formuliere die Vorderseite so, dass ich die
   Antwort aus dem Kopf erzeugen muss, nicht ankreuzen kann. Keine Ja-Nein-
   Fragen, keine Frage, die ihre Antwort schon enthält.
6. **Rechenwege als `mehrschritt`**, Definitionen und Merksätze als `cloze`
   oder als gewöhnliche Karte, Vokabeln als gewöhnliche Karte.
7. Gib die Datei am Ende **als Datei zum Herunterladen** aus (Dateiname etwa
   `mathe-ableitungen.json`) oder, wenn das nicht geht, als einen einzigen
   JSON-Codeblock, den ich kopieren kann. Kein Text innerhalb des JSON.
8. Sag mir in einem Satz, wie viele Karten welcher Art entstanden sind, und
   nenne alles, was du weggelassen hast, mit Begründung.

## Kurzform zum Wiederverwenden

> Bau mir aus dem angehängten Material eine Stapeldatei für Deep Dive
> (Format siehe oben). Ich will die Aufgaben 2, 5 und 7. Sag mir, wenn ich
> dabei einen ganzen Aufgabentyp übersehe.
