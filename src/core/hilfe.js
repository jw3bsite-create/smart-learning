/*
 * Fragen zur App — die Erklärungen, die früher als Text auf den Seiten
 * standen (seit dem 25. November 2026, Wunsch des Nutzers: „cleaner“).
 *
 * Auf den Seiten bleibt ein kleines „?“ (`HilfeLink` in ui/basis.jsx), das
 * hierher springt, zur passenden Frage. Bedienhinweise („gedrückt halten
 * und ziehen“) stehen nur noch hier. Rückfragen und Warnungen, die vor
 * einem Fehler schützen, bleiben an ihrer Stelle.
 *
 * Jede Antwort ist eine Liste kurzer Absätze. Die Kennung (`id`) ist das,
 * worauf die Seiten verweisen — nicht umbenennen, ohne die Verweise
 * mitzuziehen (test/hilfe.test.js prüft das).
 */

export const GRUPPEN = [
  { id: "lernen", name: "Lernen" },
  { id: "karten", name: "Karten und Stapel" },
  { id: "punkte", name: "Punkte" },
  { id: "geraete", name: "Stimme, Erinnerung und Geräte" },
];

export const FRAGEN = [
  /* ------------------------------- Lernen -------------------------------- */
  {
    id: "abrufen", gruppe: "lernen",
    frage: "Was macht das Abrufen besonders?",
    antwort: [
      "Abrufen ist der einzige Modus, der den Lernplan bewegt: Nur hier entscheidet sich, wann eine Karte wiederkommt.",
      "Der Ablauf ist immer gleich: Frage sehen, sagen wie sicher du bist, die Antwort tippen, aufdecken und selbst bewerten. Das Tippen zwingt dich, die Antwort wirklich hervorzuholen, statt sie nur wiederzuerkennen.",
      "Die Sicherheit vorher zeigt dir mit der Zeit, ob dein Gefühl stimmt: Wie oft war „sicher“ wirklich richtig? Das steht unter Kalibrierung.",
      "Die Note gibst du selbst, auch wenn die getippte Antwort Zeichen für Zeichen stimmt. Ehrlich bewerten ist Teil des Lernens.",
    ],
  },
  {
    id: "bewerten", gruppe: "lernen",
    frage: "Was bedeuten Nochmal, Schwer, Gut und Leicht?",
    antwort: [
      "Nochmal: nicht gewusst. Die Karte kommt in dieser Sitzung wieder und bald darauf erneut.",
      "Schwer: gewusst, aber mit Mühe. Der nächste Abstand wächst nur wenig.",
      "Gut: gewusst. Der Normalfall.",
      "Leicht: sofort und mühelos. Der Abstand wächst deutlich.",
      "Verklickt? Zehn Sekunden lang steht unten „Rückgängig“.",
    ],
  },
  {
    id: "rundengroesse", gruppe: "lernen",
    frage: "Wie groß ist eine Runde beim Abrufen?",
    antwort: [
      "Vor jeder Runde wählst du: Klein (5 Karten), Mittel (10), Groß (20) oder Frei. Was du zuletzt genommen hast, ist hervorgehoben.",
      "Karten, die du falsch hattest, kommen obendrauf: Eine kleine Runde hat fünf verschiedene Karten plus ihre Wiedervorlagen.",
      "Frei nimmt alles, was ansteht. Ist alles durch, fragt Anchor, ob du mit neuen Karten weitermachen oder Karten vorziehen willst. Vorgezogene zählen als Übung und verschieben keinen Termin.",
      "Am Ende jeder Runde geht es mit „Noch eine Runde“ in derselben Größe weiter.",
    ],
  },
  {
    id: "wiedervorlage", gruppe: "lernen",
    frage: "Warum kommt eine Karte in derselben Sitzung wieder?",
    antwort: [
      "Was falsch war, kommt nach ein paar anderen Karten noch einmal („noch einmal“). Wie viele dazwischen liegen, richtet sich danach, wie schnell du in diesem Stapel sonst bist.",
      "Was du zwar richtig, aber deutlich langsamer als sonst wusstest, kommt einmal später zur Festigung („zur Festigung“). Das zählt als Übung.",
      "Gemessen wird die Zeit vom Erscheinen der Karte bis zum Aufdecken; Zeit, in der Anchor im Hintergrund war, zählt nicht.",
      "Ist eine Karte in einer Sitzung viermal falsch, steht sie am Ende als Problemkarte da. Oft hilft es, sie umzuformulieren oder in zwei Karten zu teilen.",
    ],
  },
  {
    id: "auswahl", gruppe: "lernen",
    frage: "Kann ich auswählen, welche Karten drankommen?",
    antwort: [
      "Du wählst das Fach, darin Ordner oder einzelne Stapel. Welche Karten drankommen, entscheidet der Plan.",
      "Der Grund: Beim Anblick der Vorderseite fühlt man sich fast immer sicherer, als man ist. Wer selbst auswählt, übt am liebsten, was schon sitzt.",
      "Stoff, der gar nicht geprüft wird, nimmst du mit dem Haken heraus (siehe „Kommt nicht dran“).",
    ],
  },
  {
    id: "kommt-nicht-dran", gruppe: "lernen",
    frage: "Was heißt „Kommt nicht dran“?",
    antwort: [
      "Der Haken an einer Karte, in der Stapelansicht oder direkt beim Abrufen, nimmt sie aus dem Abrufen und aus den Übungen. Sie zählt nirgends mehr mit, ihr Lernstand bleibt erhalten.",
      "Gedacht ist er für Stoff, der nicht geprüft wird, nicht für „kann ich schon“. Ob eine Karte sitzt, entscheidet das Abrufen.",
      "Zurückholen: in der Stapelansicht noch einmal auf den Haken an der Karte.",
    ],
  },
  {
    id: "ruhen", gruppe: "lernen",
    frage: "Was heißt „Stapel ruhen lassen“?",
    antwort: [
      "Ein ruhender Stapel kommt eine Zeit lang nicht dran, etwa 50 Tage nach einer Klausur. Danach erinnert die Glocke oben rechts, und er kommt wieder in den Plan.",
      "Einstellen in der Stapelansicht über das Menü des Stapels: „Im Abrufen ruhen lassen …“.",
    ],
  },
  {
    id: "karteikarten", gruppe: "lernen",
    frage: "Wie funktionieren die Karteikarten?",
    antwort: [
      "Durchblättern wie mit echten Karten: antippen dreht die Karte um, danach sagst du „Weiß ich“ oder „Noch üben“.",
      "Am Handy wischen: nach rechts weiß ich, nach links noch üben. Am PC: Leertaste dreht, Pfeil hoch weiß ich, Pfeil runter noch üben.",
      "Was du nicht wusstest oder nur langsam, kommt in derselben Runde wieder. „Zufällig je Karte“ fragt mal die Vorder-, mal die Rückseite.",
      "Karteikarten sind eine Übung: Sie füllen deine Lernzeit, verschieben aber keinen Termin. Dafür ist das Abrufen da.",
    ],
  },
  {
    id: "lernmodus", gruppe: "lernen",
    frage: "Wie ist der Lernmodus aufgebaut?",
    antwort: [
      "Lernen läuft wie bei Quizlet in einer Sitzung, bis alles sitzt. Jede Karte durchläuft drei Stufen: erst erkennen (Auswahl oder wahr/falsch), dann schreiben, dann gilt sie als gemeistert.",
      "Falsch heißt eine Stufe zurück, und die Karte kommt am Ende der Runde noch einmal. Gelernt wird in Runden, zwischen den Runden siehst du, wie weit du bist.",
      "Wer aufhört, macht später dort weiter. Wie viele Fragen eine Runde hat, steht in den Einstellungen unter Lernen.",
      "Auch Lernen ist eine Übung und verschiebt keine Termine.",
    ],
  },
  {
    id: "uebung", gruppe: "lernen",
    frage: "Warum zählen die Übungen nicht für den Plan?",
    antwort: [
      "Karteikarten, Lernen, Schreiben, Test, Zuordnen und Meteor zeigen dir die Antwort oft schon an oder lassen sie wiedererkennen. Das schadet nicht, sagt aber wenig darüber, ob du sie in der Prüfung abrufen kannst.",
      "Darum bewegt nur das Abrufen die Termine. Die Übungen zählen trotzdem zur Lernzeit und zur Strähne.",
    ],
  },

  /* --------------------------- Karten und Stapel ------------------------- */
  {
    id: "umordnen", gruppe: "karten",
    frage: "Wie ordne ich Karten um?",
    antwort: [
      "In der Stapelansicht: am Handy eine Karte kurz gedrückt halten und ziehen, am PC anfassen und ziehen. Das geht auch unter eine andere Überschrift.",
      "Umordnen geht nur, wenn die Liste nach „Eigene Reihenfolge“ sortiert ist und kein Filter an ist.",
      "Beim Bearbeiten genauso: die Karte an ihrem Griff anfassen und an die neue Stelle ziehen.",
    ],
  },
  {
    id: "quizlet", gruppe: "karten",
    frage: "Wie hole ich einen Stapel aus Quizlet?",
    antwort: [
      "Am PC: Den Knopf „Nach Anchor“ einmal in die Favoritenleiste von Edge ziehen. Danach auf der Quizlet-Seite des Stapels darauf klicken, und die Karten landen in Anchor.",
      "Am iPhone: auf Quizlet alle Karten markieren, kopieren und in Anchor bei „Karten aus Quizlet“ einfügen. Oder die Seite des Stapels als Datei (PDF) sichern und dort einlesen.",
      "Ein bloßer Link reicht leider nicht, Quizlet sperrt das Auslesen von außen.",
    ],
  },
  {
    id: "tasten", gruppe: "karten",
    frage: "Welche Tasten gibt es am PC?",
    antwort: [
      "Abrufen: 1, 2, 3 für sicher, unsicher, keine Ahnung. Leertaste oder Enter deckt auf. Danach 1 bis 4 für Nochmal, Schwer, Gut, Leicht. Z nimmt die letzte Bewertung zurück, S setzt den Stern, E bearbeitet die Karte.",
      "Rundengröße: 1 bis 4 für Klein, Mittel, Groß, Frei.",
      "Karteikarten: Leertaste dreht, Pfeil hoch weiß ich, Pfeil runter noch üben, Pfeil rechts weiter.",
      "Beim Bearbeiten zeigt das Menü unter „Tastenkürzel“ alle Kürzel.",
    ],
  },

  /* -------------------------------- Punkte ------------------------------- */
  {
    id: "punkte-schnitt", gruppe: "punkte",
    frage: "Wie werden die Punkte gerechnet, was zählt wie?",
    antwort: [
      "Innerhalb einer Art (schriftlich, mündlich, praktisch) zählt jede Leistung mit dem Gewicht ihrer Sorte: Klassenarbeit 1 und Test 0,5 heißt, zwei Tests zählen so viel wie eine Klassenarbeit.",
      "Dann werden die Arten nach ihrem Gewicht zusammengefasst. Eine Art ohne Leistung zählt nicht mit, statt den Schnitt mit null zu drücken. Eine Leistung ohne Punkte („offen“) ebenso.",
      "Stehen Zeugnispunkte da, gelten sie statt der Rechnung.",
      "Der Halbjahresschnitt ist der Durchschnitt aller Fächer mit Punkten, jedes zählt einmal. Der Schnitt über alles mittelt alle Halbjahresleistungen, nicht die vier Halbjahresschnitte.",
      "Umgerechnet wird mit Note = (17 − Punkte) / 3. Das ist nicht die Abiturnote: Die entsteht aus Block I und Block II mit Einbringungspflichten, und die kennt Anchor nicht.",
    ],
  },
  {
    id: "ziele", gruppe: "punkte",
    frage: "Wie werden das Abi-Ziel und „was ich noch brauche“ gerechnet?",
    antwort: [
      "Das Abi hat höchstens 900 Punkte. Anchor rechnet grob: Jedes Halbjahr bringt seinen Schnitt × 10 ein (höchstens 150), die Prüfungen deinen Schnitt × 20 (höchstens 300). Einbringungspflichten und doppelt zählende Kurse kennt die Rechnung nicht.",
      "Der volle Teil des Balkens ist, was deine Halbjahre schon einbringen. Der blasse Teil ist die Hochrechnung, wenn es mit deinem jetzigen Schnitt weitergeht. Der Strich ist dein Ziel.",
      "„In diesem Halbjahr brauchst du …“ ist das Halbjahresziel des laufenden Halbjahres: der Schnitt, mit dem du – wenn es so weitergeht – aufs Abi-Ziel kommst. Darunter stehen alle vier Halbjahre mit ihrem Ziel. Die Abiturnote zu Punkten: 17/3 − Punkte/180.",
      "Die Halbjahresziele folgen von selbst deinem Abi-Ziel: Jedes Halbjahr bekommt den Schnitt, den du ab dort bis zum Abi brauchst, die früheren Halbjahre eingerechnet. Ein eigenes Ziel kannst du trotzdem setzen; „Automatisch“ im Dialog holt die Rechnung zurück.",
      "Im Halbjahr: Fächer ohne Note zeigen, wie viel sie im Schnitt bringen müssen, damit das Halbjahr aufs Ziel kommt. Fächer, die darüber liegen, gleichen aus. Fächer mit Noten zeigen, welche Punktzahl die nächste Klassenarbeit braucht, damit das Fach selbst aufs Ziel kommt.",
      "Alles ist ein Richtwert zur Orientierung, nicht die Abiturnote.",
    ],
  },
  {
    id: "sorten", gruppe: "punkte",
    frage: "Wie lege ich Test, Klassenarbeit oder GFS an?",
    antwort: [
      "Im Fach unter „Klassenarbeit, Test & Co.“: Jede Sorte hat ein Gewicht, das für alle Leistungen dieser Sorte gilt. Mit dem Plus legst du weitere an, etwa GFS.",
      "Beim Eintragen wählst du die Sorte mit einem Antippen. „Andere“ gibt dir ein eigenes Gewicht.",
      "Bezeichnungen zählen sich selbst: Klassenarbeit 1, Test 2. Eine eigene Bezeichnung geht trotzdem.",
      "„Für alle Fächer dieses Halbjahres übernehmen“ setzt dieselben Sorten überall.",
    ],
  },
  {
    id: "faecher-uebernehmen", gruppe: "punkte",
    frage: "Wie übernehme ich meine Fächer ins nächste Halbjahr?",
    antwort: [
      "Oben auf „Übernehmen“, oder in einem leeren Halbjahr auf „Fächer übernehmen“. Angeboten werden die Fächer der anderen Halbjahre und deine Lernfächer, zum Ankreuzen.",
      "Mit kommen Name, Sorten, Gewichte und die Verknüpfung zum Lernfach, keine Punkte.",
    ],
  },

  /* ---------------------- Stimme, Erinnerung, Geräte --------------------- */
  {
    id: "stimmen", gruppe: "geraete",
    frage: "Wie bekomme ich eine gute Vorlesestimme?",
    antwort: [
      "Anchor nimmt automatisch die beste Stimme, die auf dem Gerät liegt. Unter Einstellungen → Stimme kannst du je Sprache eine andere wählen und probehören.",
      "Am PC: In Microsoft Edge gibt es natürliche Stimmen, gratis. Sie brauchen eine Internetverbindung; ohne Netz liest Anchor mit der Stimme des Geräts.",
      "Am iPhone: Einstellungen → Bedienungshilfen → Gesprochene Inhalte → Stimmen → Sprache wählen, dort eine Stimme mit „Erweitert“ oder „Premium“ laden. Danach Anchor neu öffnen.",
    ],
  },
  {
    id: "erinnerung", gruppe: "geraete",
    frage: "Wie kommen Erinnerungen aufs iPhone?",
    antwort: [
      "Am zuverlässigsten über die App Kurzbefehle: Unter Einstellungen → Erinnerung steht Schritt für Schritt, wie du die Automation anlegst. Sie fragt zu deinen Zeiten, ob etwas fällig ist, und meldet sich nur dann.",
      "Zeiten stellst du je Wochentag ein, auch mehrmals am Tag.",
    ],
  },
  {
    id: "cloud", gruppe: "geraete",
    frage: "Wie bleiben iPhone und PC auf demselben Stand?",
    antwort: [
      "Über die Cloud: unter Einstellungen → Cloud und Geräte auf beiden Geräten mit demselben Konto anmelden. Danach gleicht Anchor von selbst ab.",
      "Ohne Cloud bleibt alles auf dem Gerät. Eine Sicherung als Datei gibt es unter Daten und Sicherung.",
    ],
  },
  {
    id: "minimal", gruppe: "geraete",
    frage: "Wo sind die Erklärtexte hin?",
    antwort: [
      "Bedienhinweise stehen nur noch hier. Mit „Minimal“ unter Einstellungen → Aussehen blendest du auch die übrigen Erklärtexte aus, und die Zeichen werden einheitlich.",
      "Das kleine „?“ an einer Stelle führt immer zur passenden Frage.",
    ],
  },
];

export const frageMit = (id) => FRAGEN.find((f) => f.id === id) || null;
