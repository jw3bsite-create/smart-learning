/*
 * Der Stoff des Beispielbestands.
 *
 * Getrennt von `beispiel.js`, weil dort die Maschinerie steht: Zufall,
 * Lernhistorie, Schreiben in die Datenbank. Hier steht nur, was gelernt wird.
 * Wer den Bestand erweitern will, muss darum nichts von FSRS verstehen.
 *
 * Zwei Gebiete, aus einem Grund gewählt: Kant, weil Begriffe, Zitate und
 * Argumentgänge alle vier Kartenarten fordern — und Hauptstädte, weil sie
 * kurz genug für Zuordnen, Meteor und Buchstabieren sind. Zusammen wird jeder
 * Modus der App wenigstens einmal ernsthaft belastet.
 *
 * Wo eine Hauptstadt umstritten oder mehrfach ist, steht der Grund im
 * Hinweisfeld. Das ist kein Beiwerk: Genau diese Fälle sind es, die man
 * verwechselt, und eine Karte ohne den Hinweis lehrte etwas Falsches.
 */

/* ===================================================================== */
/*  Kant — Kritik der reinen Vernunft                                    */
/* ===================================================================== */

/** Die Begriffe, ohne die kein Satz der Kritik verständlich wird. */
export const KANT_GRUND = [
  ["transzendental", "Nicht die Erkenntnis von Gegenständen, sondern die Erkenntnis unserer Erkenntnisart von Gegenständen, sofern diese a priori möglich sein soll."],
  ["transzendent", "Was über alle Grenzen möglicher Erfahrung hinausgeht. Nicht zu verwechseln mit „transzendental“ — das bleibt diesseits der Grenze und untersucht sie."],
  ["a priori", "Von aller Erfahrung unabhängig — und darum notwendig und allgemein gültig."],
  ["a posteriori", "Aus Erfahrung gewonnen; darum immer nur bedingt allgemein."],
  ["rein", "Frei von allem Empirischen. Eine reine Anschauung enthält nichts, was aus der Empfindung stammt."],
  ["analytisches Urteil", "Das Prädikat ist im Begriff des Subjekts bereits enthalten. Es erläutert, erweitert die Erkenntnis aber nicht. („Alle Körper sind ausgedehnt.“)"],
  ["synthetisches Urteil", "Das Prädikat fügt dem Subjektbegriff etwas hinzu, was nicht in ihm lag. Es erweitert die Erkenntnis. („Alle Körper sind schwer.“)"],
  ["synthetische Urteile a priori", "Urteile, die die Erkenntnis erweitern und dennoch notwendig gelten. Wie sie möglich sind, ist die Leitfrage der ganzen Kritik."],
  ["Ding an sich", "Der Gegenstand, wie er unabhängig von den Bedingungen unserer Anschauung wäre. Denkbar, aber nicht erkennbar."],
  ["Erscheinung", "Der Gegenstand, sofern er unter den Bedingungen von Raum, Zeit und Kategorien vorgestellt wird. Nicht Schein — Erscheinungen sind wirklich."],
  ["Erscheinung und Schein", "Die Erscheinung ist der Gegenstand, wie er uns notwendig gegeben ist. Schein entsteht erst, wenn das Urteil das, was an der Vorstellungsart liegt, dem Gegenstand selbst zuschreibt."],
  ["Anschauung", "Die unmittelbare Beziehung einer Erkenntnis auf einzelne Gegenstände. Beim Menschen stets sinnlich."],
  ["Begriff", "Eine mittelbare Vorstellung, die vieles unter sich fasst. Sache des Verstandes, nicht der Sinne."],
  ["Sinnlichkeit", "Das Vermögen, Vorstellungen zu empfangen — Rezeptivität."],
  ["Verstand", "Das Vermögen, Vorstellungen selbsttätig hervorzubringen — Spontaneität. Kant nennt ihn das Vermögen der Regeln."],
  ["Vernunft", "Das Vermögen der Prinzipien. Sie sucht zu jedem Bedingten das Unbedingte und gerät dabei über die Erfahrung hinaus."],
  ["Urteilskraft", "Das Vermögen, unter Regeln zu subsumieren — zu entscheiden, ob ein Fall unter eine Regel gehört. Sie lässt sich nicht wieder durch eine Regel ersetzen."],
  ["Empfindung", "Die Wirkung eines Gegenstandes auf die Vorstellungsfähigkeit, sofern wir von ihm affiziert werden."],
  ["Materie und Form der Erscheinung", "Materie ist, was der Empfindung entspricht; Form ist, was das Mannigfaltige ordnet. Die Form liegt a priori im Gemüt bereit."],
  ["Kopernikanische Wende", "Nicht die Erkenntnis richtet sich nach den Gegenständen, sondern die Gegenstände nach den Bedingungen unserer Erkenntnis."],
  ["Kritik", "Keine Widerlegung der Metaphysik, sondern die Untersuchung des Vermögens der Vernunft überhaupt — samt der Bestimmung ihrer Grenzen."],
  ["Kanon und Organon", "Ein Organon erweitert die Erkenntnis, ein Kanon gibt nur die Regeln des richtigen Gebrauchs. Die Kritik ist ein Kanon, kein Organon."],
  ["Dogmatismus", "Das Verfahren, mit reiner Vernunft Erkenntnis zu behaupten, ohne vorher ihr Vermögen geprüft zu haben."],
  ["Skeptizismus", "Der Zweifel, der aus dem Scheitern des Dogmatismus folgt. Kant nennt beide unzureichend — der eine geht zu weit, der andere gibt zu früh auf."],
];

/** Transzendentale Ästhetik — Raum und Zeit. */
export const KANT_AESTHETIK = [
  ["transzendentale Ästhetik", "Die Wissenschaft von allen Prinzipien der Sinnlichkeit a priori — also die Lehre von Raum und Zeit als Formen der Anschauung."],
  ["reine Anschauung", "Eine Anschauung, die nichts aus der Empfindung enthält. Es gibt genau zwei: Raum und Zeit."],
  ["Raum", "Die Form des äußeren Sinnes: die Bedingung, unter der uns Gegenstände außer uns überhaupt vorgestellt werden können."],
  ["Zeit", "Die Form des inneren Sinnes: die Bedingung, unter der wir uns selbst und unseren Zustand vorstellen. Sie ist mittelbar auch Form aller äußeren Erscheinungen."],
  ["metaphysische Erörterung", "Der Nachweis, dass eine Vorstellung a priori gegeben ist und was sie ihrer Art nach ist — bei Raum und Zeit: reine Anschauungen, keine Begriffe."],
  ["transzendentale Erörterung", "Der Nachweis, dass sich aus einer Vorstellung die Möglichkeit anderer synthetischer Erkenntnis a priori einsehen lässt — beim Raum die Geometrie, bei der Zeit die Bewegungslehre."],
  ["Warum der Raum keine empirische Vorstellung ist", "Um etwas als außer mir vorzustellen, muss die Vorstellung des Raumes schon zugrunde liegen. Sie kann darum nicht erst aus Erfahrung gewonnen sein."],
  ["Warum der Raum notwendig ist", "Man kann sich den Raum ohne Gegenstände denken, aber niemals vorstellen, dass kein Raum sei. Er ist Bedingung der Möglichkeit der Erscheinungen, nicht von ihnen abhängig."],
  ["Warum der Raum kein Begriff ist", "Es gibt nur einen einzigen Raum; was man Räume nennt, sind Einschränkungen dieses einen. Ein Begriff dagegen hätte Beispiele unter sich, nicht Teile in sich."],
  ["Warum die Geometrie apodiktisch gilt", "Weil der Raum keine Eigenschaft der Dinge, sondern die Form unserer Anschauung ist, gilt jeder Satz über ihn im Voraus von allem, was uns je erscheinen kann."],
  ["Zeit hat nur eine Dimension", "Verschiedene Zeiten sind nicht zugleich, sondern nacheinander — verschiedene Räume dagegen zugleich. Der Satz ist nicht aus Erfahrung, sondern Bedingung ihrer Möglichkeit."],
  ["empirische Realität von Raum und Zeit", "Sie gelten von allem, was uns je in der Erfahrung begegnen kann. In diesem Sinne sind sie durchaus wirklich, nicht eingebildet."],
  ["transzendentale Idealität von Raum und Zeit", "Nimmt man die Bedingung der Sinnlichkeit weg, bedeuten sie nichts mehr. Von Dingen an sich gelten sie nicht."],
  ["innerer Sinn", "Das Vermögen, mit dem das Gemüt sich selbst anschaut — und zwar so, wie es sich erscheint, nicht wie es an sich ist."],
  ["Warum der Mensch keine intellektuelle Anschauung hat", "Unsere Anschauung ist durchweg empfangend: Ein Gegenstand muss uns gegeben werden. Ein Verstand, der sich seinen Gegenstand durch das Anschauen selbst hervorbrächte, ist denkbar, aber nicht der unsrige."],
];

/** Transzendentale Analytik — Kategorien, Deduktion, Grundsätze. */
export const KANT_ANALYTIK = [
  ["transzendentale Analytik", "Die Zergliederung unseres gesamten Erkenntnisses a priori in die Elemente der reinen Verstandeserkenntnis. Kant nennt sie eine Analytik der Begriffe und der Grundsätze."],
  ["Kategorien", "Die zwölf reinen Verstandesbegriffe: die ursprünglichen Weisen, ein Mannigfaltiges in einem Urteil zu verbinden."],
  ["Leitfaden der Kategorienentdeckung", "Die Tafel der Urteilsformen. Weil der Verstand das Vermögen zu urteilen ist, müssen sich seine Grundbegriffe an den Formen der Urteile vollständig ablesen lassen."],
  ["Kategorien der Quantität", "Einheit, Vielheit, Allheit."],
  ["Kategorien der Qualität", "Realität, Negation, Limitation."],
  ["Kategorien der Relation", "Substanz und Akzidens, Ursache und Wirkung, Gemeinschaft (Wechselwirkung)."],
  ["Kategorien der Modalität", "Möglichkeit und Unmöglichkeit, Dasein und Nichtsein, Notwendigkeit und Zufälligkeit."],
  ["Synthesis", "Die Handlung, verschiedene Vorstellungen zueinander hinzuzutun und ihre Mannigfaltigkeit in einer Erkenntnis zu begreifen. Sie ist immer Sache der Spontaneität."],
  ["Einbildungskraft", "Das Vermögen, einen Gegenstand auch ohne dessen Gegenwart in der Anschauung vorzustellen. Sie vermittelt zwischen Sinnlichkeit und Verstand."],
  ["quid facti und quid juris", "Die Frage nach der Tatsache — wie kommen wir zu diesen Begriffen? — und die Frage nach dem Recht: mit welcher Befugnis wenden wir sie auf Gegenstände an? Die Deduktion beantwortet die zweite."],
  ["transzendentale Deduktion", "Der Nachweis, dass die Kategorien Bedingungen der Möglichkeit von Erfahrung sind — und darum von allem gelten, was uns je als Gegenstand begegnen kann."],
  ["transzendentale Apperzeption", "Das „Ich denke“, das alle meine Vorstellungen muss begleiten können. Ohne diese eine Einheit des Selbstbewusstseins wären sie nicht alle meine."],
  ["objektive Einheit des Selbstbewusstseins", "Nicht ein Gefühl und keine Beobachtung, sondern die Bedingung, unter der Vorstellungen sich überhaupt auf einen Gegenstand beziehen können."],
  ["Der Verstand schreibt der Natur die Gesetze vor", "Nicht den Dingen an sich, sondern der Natur als Inbegriff der Erscheinungen. Ihre gesetzliche Ordnung stammt aus den Bedingungen, unter denen sie uns allein gegeben sein kann."],
  ["Schematismus", "Die Frage, wie ein reiner Verstandesbegriff auf eine sinnliche Anschauung angewandt werden kann, wenn beide nichts gemein haben."],
  ["transzendentales Schema", "Eine Bestimmung der Zeit nach einer Regel — das Dritte, das mit Kategorie und Erscheinung zugleich gleichartig ist."],
  ["Schema der Substanz", "Die Beharrlichkeit des Realen in der Zeit."],
  ["Schema der Ursache", "Das Aufeinanderfolgen des Mannigfaltigen, sofern es einer Regel unterworfen ist."],
  ["Die vier Gruppen der Grundsätze", "Axiome der Anschauung, Antizipationen der Wahrnehmung, Analogien der Erfahrung, Postulate des empirischen Denkens überhaupt."],
  ["Erste Analogie", "Bei allem Wechsel der Erscheinungen beharrt die Substanz; ihr Quantum wird weder vermehrt noch vermindert."],
  ["Zweite Analogie", "Alles, was geschieht, setzt etwas voraus, worauf es nach einer Regel folgt. Darauf beruht der Unterschied zwischen einer bloßen Abfolge meiner Wahrnehmungen und einem wirklichen Geschehen."],
  ["Dritte Analogie", "Alle Substanzen, sofern sie zugleich wahrgenommen werden können, stehen in durchgängiger Wechselwirkung."],
  ["Widerlegung des Idealismus", "Das Bewusstsein meines eigenen Daseins in der Zeit beweist zugleich das Dasein der Gegenstände außer mir — denn Zeitbestimmung braucht etwas Beharrliches, und das kann ich in mir nicht finden."],
  ["Phaenomena und Noumena", "Erscheinungen, sofern sie nach der Einheit der Kategorien gedacht werden, heißen Phaenomena. Ein Noumenon ist der Gedanke eines Gegenstands nichtsinnlicher Anschauung — bloßer Grenzbegriff."],
  ["Amphibolie der Reflexionsbegriffe", "Die Verwechslung eines Gegenstands des reinen Verstandes mit der Erscheinung — Kants Vorwurf an Leibniz, der die Erscheinungen intellektuierte."],
  ["Gedanken ohne Inhalt sind leer", "Weder Sinnlichkeit noch Verstand allein liefern Erkenntnis. Nur aus ihrer Vereinigung entspringt sie — Anschauungen ohne Begriffe sind blind."],
];

/** Transzendentale Dialektik — Schein, Ideen, Antinomien. */
export const KANT_DIALEKTIK = [
  ["transzendentale Dialektik", "Die Kritik des Verstandes und der Vernunft in Ansehung ihres hyperphysischen Gebrauchs — die Aufdeckung des Scheins, der entsteht, wenn über mögliche Erfahrung hinausgegangen wird."],
  ["transzendentaler Schein", "Ein Schein, der nicht verschwindet, wenn man ihn durchschaut, weil er in der Natur der Vernunft selbst liegt. Anders als ein optischer Betrug lässt er sich nicht abstellen, nur in Schach halten."],
  ["Idee (Vernunftbegriff)", "Ein notwendiger Begriff der Vernunft, dem kein Gegenstand in der Sinnenerfahrung entsprechen kann — weil er das Unbedingte zu einer Reihe von Bedingungen verlangt."],
  ["Die drei transzendentalen Ideen", "Seele (das Unbedingte der inneren Reihe), Welt (der äußeren) und Gott (aller Bedingungen überhaupt). Ihnen entsprechen die drei Teile der alten Metaphysik."],
  ["regulativer Gebrauch der Ideen", "Die Ideen leiten die Forschung als Aufgabe: Suche immer weitere Bedingungen. Das ist ihr rechtmäßiger Gebrauch."],
  ["konstitutiver Gebrauch der Ideen", "Die Ideen so nehmen, als bezeichneten sie einen Gegenstand. Genau das ist der Fehler, aus dem Paralogismen, Antinomien und Gottesbeweise entspringen."],
  ["Paralogismus der reinen Vernunft", "Ein Fehlschluss der rationalen Seelenlehre: Aus der bloßen Einheit des „Ich denke“ wird auf eine Substanz geschlossen, die einfach, mit sich identisch und unsterblich wäre."],
  ["Warum der Paralogismus scheitert", "Das „Ich denke“ ist die Form allen Denkens, kein Gegenstand einer Anschauung. Ohne Anschauung aber bleibt die Kategorie der Substanz leer."],
  ["Antinomie der reinen Vernunft", "Ein Paar von Sätzen, für die sich beide Seiten mit gleichem Recht beweisen lassen. Ihr Auftreten zeigt an, dass die Grenze der Erfahrung überschritten wurde."],
  ["Erste Antinomie", "Die Welt hat einen Anfang in der Zeit und ist im Raum eingeschlossen — gegen: Sie ist ohne Anfang und ohne Grenze."],
  ["Zweite Antinomie", "Jedes zusammengesetzte Ding besteht aus einfachen Teilen — gegen: Nichts Einfaches existiert in der Welt."],
  ["Dritte Antinomie", "Es gibt neben der Naturkausalität eine Kausalität aus Freiheit — gegen: Alles geschieht allein nach Naturgesetzen."],
  ["Vierte Antinomie", "Zur Welt gehört ein schlechthin notwendiges Wesen — gegen: Es existiert nirgends ein solches."],
  ["Mathematische und dynamische Antinomien", "Bei den ersten beiden sind beide Seiten falsch, weil die Frage einen Gegenstand voraussetzt, den es so nicht gibt. Bei den letzten beiden können beide Seiten wahr sein — die eine von der Erscheinung, die andere vom Intelligiblen."],
  ["Auflösung der dritten Antinomie", "Derselbe Mensch lässt sich als Erscheinung durchgängig nach Naturgesetzen bestimmt denken und zugleich als Intelligenz frei. Erklärt ist die Freiheit damit nicht — nur ihr Widerspruch zur Natur ist aufgehoben."],
  ["empirischer und intelligibler Charakter", "Der empirische Charakter ist die Handlungsweise, wie sie in der Erscheinung nach Regeln auftritt; der intelligible ist derselbe Grund, sofern er nicht in der Zeit steht."],
  ["Ideal der reinen Vernunft", "Nicht bloß der Begriff, sondern die Vorstellung eines durchgängig bestimmten einzelnen Wesens, das allein durch die Idee bestimmt wäre — die Wurzel des Gottesbegriffs der Schulmetaphysik."],
  ["Die drei möglichen Gottesbeweise", "Der ontologische aus bloßen Begriffen, der kosmologische aus dem Dasein überhaupt, der physikotheologische aus der Beschaffenheit der Welt. Mehr sind der Vernunft nicht möglich."],
  ["Kants Einwand gegen den ontologischen Beweis", "Sein ist offenbar kein reales Prädikat. Es fügt dem Begriff eines Dinges nichts hinzu — hundert wirkliche Taler enthalten nicht das Mindeste mehr als hundert mögliche."],
  ["Warum der kosmologische Beweis scheitert", "Er kommt ohne den ontologischen nicht aus: Um vom notwendigen Wesen auf das allerrealste zu schließen, braucht er genau die Voraussetzung, die schon dort gescheitert war."],
  ["Warum der physikotheologische Beweis nicht reicht", "Kant nennt ihn den ältesten und dem Menschen angemessensten. Er könnte allenfalls einen Weltbaumeister nahelegen, der dem Stoff angemessen ist — nie einen Schöpfer aus dem Nichts."],
];

/** Zitate als Lückentext. Jede Lücke wird eigenständig geplant. */
export const KANT_LUECKEN = [
  ["Gedanken ohne {{Inhalt}} sind leer, Anschauungen ohne {{Begriffe}} sind blind.", "Der berühmteste Satz der Analytik, B 75."],
  ["Raum ist die Form des {{äußeren}} Sinnes, Zeit die Form des {{inneren}} Sinnes.", "Transzendentale Ästhetik."],
  ["Kants Leitfrage der Kritik lautet: Wie sind {{synthetische Urteile a priori}} möglich?", "Einleitung, B 19."],
  ["{{Anschauungen}} und {{Begriffe}} sind die beiden Stämme der menschlichen Erkenntnis.", "Sie entspringen vielleicht aus einer gemeinsamen, uns unbekannten Wurzel."],
  ["Erscheinungen sind empirisch {{real}} und transzendental {{ideal}}.", "Die Kurzformel des transzendentalen Idealismus."],
  ["Das {{Ich denke}} muss alle meine Vorstellungen begleiten können.", "Der Grundsatz der transzendentalen Apperzeption, B 131."],
  ["{{Sein}} ist offenbar kein reales Prädikat.", "Der Einwand gegen den ontologischen Gottesbeweis."],
  ["Ich musste also das {{Wissen}} aufheben, um zum {{Glauben}} Platz zu bekommen.", "Vorrede zur zweiten Auflage, B XXX."],
  ["Wenn gleich alle unsere Erkenntnis mit der {{Erfahrung}} anhebt, so entspringt sie darum doch nicht eben alle aus ihr.", "Der erste Satz der Einleitung, B 1."],
  ["Die Bedingungen der Möglichkeit der {{Erfahrung}} überhaupt sind zugleich Bedingungen der Möglichkeit der {{Gegenstände}} der Erfahrung.", "Der oberste Grundsatz aller synthetischen Urteile, B 197."],
  ["Der Verstand vermag nichts {{anzuschauen}}, und die Sinne nichts zu {{denken}}.", "B 75 — die Arbeitsteilung der beiden Stämme."],
  ["Begriffe ohne Anschauungen sind {{leer}}; Anschauungen ohne Begriffe sind {{blind}}.", "Dieselbe Stelle, in der geläufigeren Umformulierung."],
];

/** Argumentgänge. Jeder Schritt wird einzeln abgefragt. */
export const KANT_SCHRITTE = [
  ["Wie zeigt Kant, dass der Raum eine Anschauung a priori ist?", [
    { frage: "Erster Schritt — warum nicht empirisch?", antwort: "Um etwas als außer mir vorzustellen, muss die Vorstellung des Raumes schon vorausgesetzt sein. Sie kann darum nicht erst aus der Erfahrung stammen." },
    { frage: "Zweiter Schritt — warum notwendig?", antwort: "Man kann den Raum ohne Gegenstände denken, aber nicht denken, dass kein Raum sei. Er ist Bedingung der Erscheinungen, nicht von ihnen abhängig." },
    { frage: "Dritter Schritt — warum Anschauung und nicht Begriff?", antwort: "Es gibt nur einen einzigen Raum; die vielen Räume sind Einschränkungen dieses einen. Ein Begriff hätte Beispiele unter sich, nicht Teile in sich." },
    { frage: "Vierter Schritt — was folgt daraus?", antwort: "Der Raum ist Form der äußeren Anschauung. Darum gilt jeder geometrische Satz im Voraus von allem, was uns je erscheinen kann." },
  ]],
  ["Warum ist „7 + 5 = 12“ nach Kant kein analytisches Urteil?", [
    { frage: "Was enthält der Begriff der Summe?", antwort: "Nur den Gedanken der Vereinigung beider Zahlen in einer — nicht, welche einzelne Zahl dabei herauskommt." },
    { frage: "Was muss hinzukommen?", antwort: "Die Anschauung: Man muss zu den fünf Einheiten hinzuzählen, etwa an den Fingern oder an Punkten." },
    { frage: "Was folgt daraus?", antwort: "Das Urteil erweitert die Erkenntnis, gilt aber dennoch notwendig — es ist synthetisch a priori." },
  ]],
  ["Wie verläuft Kants Einwand gegen den ontologischen Gottesbeweis?", [
    { frage: "Was behauptet der Beweis?", antwort: "Im Begriff des allerrealsten Wesens sei das Dasein schon enthalten; es zu verneinen, widerspreche sich selbst." },
    { frage: "Wo setzt Kant an?", antwort: "Sein ist kein reales Prädikat — es erweitert den Begriff eines Dinges nicht, sondern setzt ihn samt allen seinen Bestimmungen." },
    { frage: "Welches Beispiel gibt er?", antwort: "Hundert wirkliche Taler enthalten nicht das Mindeste mehr als hundert mögliche — wohl aber ist mein Vermögen ein anderes." },
    { frage: "Was folgt?", antwort: "Aus einem Begriff lässt sich niemals ein Dasein herausklauben. Der Beweis ist nicht widerlegt, weil er falsch rechnet, sondern weil er nichts beweist." },
  ]],
  ["Wie löst Kant die dritte Antinomie auf?", [
    { frage: "Worin besteht der Widerstreit?", antwort: "Alles geschieht nach Naturgesetzen — gegen: Es gibt eine Kausalität aus Freiheit." },
    { frage: "Welche Unterscheidung greift ein?", antwort: "Die zwischen Erscheinung und Ding an sich. Naturnotwendigkeit gilt von den Erscheinungen, Freiheit ließe sich vom Intelligiblen denken." },
    { frage: "Was heißt das für den Menschen?", antwort: "Derselbe Mensch ist als Erscheinung durchgängig bestimmt und lässt sich zugleich als Intelligenz frei denken — empirischer und intelligibler Charakter." },
    { frage: "Was ist damit gerade nicht gezeigt?", antwort: "Dass es Freiheit gibt. Gezeigt ist nur, dass sie der Naturnotwendigkeit nicht widerspricht." },
  ]],
  ["Wie geht die transzendentale Deduktion in Grundzügen vor?", [
    { frage: "Welche Frage stellt sie?", antwort: "Nicht, woher wir die Kategorien haben, sondern mit welchem Recht wir sie auf Gegenstände anwenden — quid juris." },
    { frage: "Was ist der Ausgangspunkt?", antwort: "Die Einheit des Selbstbewusstseins: Alle meine Vorstellungen müssen von einem „Ich denke“ begleitet werden können." },
    { frage: "Welcher Schritt folgt?", antwort: "Diese Einheit entsteht nicht von selbst, sondern durch Verbindung — und die Formen der Verbindung sind eben die Kategorien." },
    { frage: "Was ist das Ergebnis?", antwort: "Die Kategorien sind Bedingungen der Möglichkeit von Erfahrung. Sie gelten darum notwendig von allem, was uns je als Gegenstand begegnen kann." },
  ]],
  ["Wie unterscheidet Kant eine bloße Abfolge von Wahrnehmungen und ein wirkliches Geschehen?", [
    { frage: "Woran lässt es sich nicht erkennen?", antwort: "Nicht an der Wahrnehmung selbst: Beim Haus wie beim fahrenden Schiff folgen die Vorstellungen nacheinander." },
    { frage: "Was ist der Unterschied?", antwort: "Beim Haus kann ich die Reihenfolge umkehren, beim Schiff nicht. Diese Unumkehrbarkeit liegt nicht in den Vorstellungen." },
    { frage: "Woher kommt sie dann?", antwort: "Aus der Regel, dass etwas auf etwas anderes notwendig folgt — der Kategorie der Ursache." },
    { frage: "Was folgt daraus?", antwort: "Die zweite Analogie: Alles, was geschieht, setzt etwas voraus, worauf es nach einer Regel folgt. Ohne sie gäbe es keine objektive Zeitordnung." },
  ]],
];

/* ===================================================================== */
/*  Geographie — Hauptstädte                                             */
/* ===================================================================== */

/*
 * Drittes Feld: die Anmerkung fürs Hinweisfeld. Sie steht überall dort, wo
 * die Antwort strittig, mehrfach oder jüngeren Datums ist — also genau bei den
 * Karten, an denen man sonst etwas Falsches lernt.
 */

export const EUROPA = [
  ["Frankreich", "Paris"], ["Italien", "Rom"], ["Spanien", "Madrid"],
  ["Portugal", "Lissabon"], ["Griechenland", "Athen"], ["Polen", "Warschau"],
  ["Tschechien", "Prag"], ["Slowakei", "Bratislava"], ["Ungarn", "Budapest"],
  ["Österreich", "Wien"],
  ["Schweiz", "Bern", "Kein förmlicher Hauptstadttitel — die Verfassung kennt nur die Bundesstadt."],
  ["Belgien", "Brüssel"],
  ["Niederlande", "Amsterdam", "Regierungssitz ist Den Haag; Hauptstadt der Verfassung nach bleibt Amsterdam."],
  ["Dänemark", "Kopenhagen"], ["Schweden", "Stockholm"], ["Norwegen", "Oslo"],
  ["Finnland", "Helsinki"], ["Island", "Reykjavík"], ["Irland", "Dublin"],
  ["Kroatien", "Zagreb"], ["Slowenien", "Ljubljana"], ["Serbien", "Belgrad"],
  ["Bulgarien", "Sofia"], ["Rumänien", "Bukarest"], ["Estland", "Tallinn"],
  ["Lettland", "Riga"], ["Litauen", "Vilnius"], ["Ukraine", "Kiew"],
  ["Albanien", "Tirana"], ["Nordmazedonien", "Skopje"],
  ["Bosnien und Herzegowina", "Sarajevo"], ["Montenegro", "Podgorica",
    "Cetinje gilt als alte königliche Hauptstadt."],
  ["Moldau", "Chișinău"], ["Belarus", "Minsk"], ["Malta", "Valletta"],
  ["Zypern", "Nikosia", "Die Stadt ist seit 1974 geteilt."],
  ["Luxemburg", "Luxemburg"], ["Vereinigtes Königreich", "London"],
];

export const SUEDAMERIKA = [
  ["Argentinien", "Buenos Aires"],
  ["Bolivien", "Sucre", "Verfassungshauptstadt und Sitz des obersten Gerichts. Regierung und Parlament sitzen in La Paz."],
  ["Brasilien", "Brasília", "Seit 1960 eigens dafür gebaut; vorher Rio de Janeiro."],
  ["Chile", "Santiago de Chile", "Der Nationalkongress tagt seit 1990 in Valparaíso."],
  ["Ecuador", "Quito", "Die größte Stadt des Landes ist Guayaquil."],
  ["Guyana", "Georgetown"],
  ["Kolumbien", "Bogotá"],
  ["Paraguay", "Asunción"],
  ["Peru", "Lima"],
  ["Suriname", "Paramaribo"],
  ["Uruguay", "Montevideo"],
  ["Venezuela", "Caracas"],
];

/** Alle 54 Mitgliedstaaten der Afrikanischen Union. */
export const AFRIKA = [
  ["Ägypten", "Kairo"],
  ["Algerien", "Algier"],
  ["Angola", "Luanda"],
  ["Äquatorialguinea", "Malabo", "Malabo liegt auf einer Insel. Auf dem Festland entsteht mit Ciudad de la Paz eine neue Hauptstadt."],
  ["Äthiopien", "Addis Abeba", "Sitz der Afrikanischen Union."],
  ["Benin", "Porto-Novo", "Regierung und Verwaltung sitzen in Cotonou."],
  ["Botsuana", "Gaborone"],
  ["Burkina Faso", "Ouagadougou"],
  ["Burundi", "Gitega", "Seit 2019 politische Hauptstadt; Bujumbura blieb Wirtschaftszentrum."],
  ["Dschibuti", "Dschibuti", "Stadt und Staat tragen denselben Namen."],
  ["Elfenbeinküste", "Yamoussoukro", "Seit 1983 amtlich; Regierung und Botschaften blieben in Abidjan."],
  ["Eritrea", "Asmara"],
  ["Eswatini", "Mbabane", "Verwaltungssitz. Parlament und Königshaus sitzen in Lobamba. Das Land hieß bis 2018 Swasiland."],
  ["Gabun", "Libreville"],
  ["Gambia", "Banjul"],
  ["Ghana", "Accra"],
  ["Guinea", "Conakry"],
  ["Guinea-Bissau", "Bissau"],
  ["Kamerun", "Jaunde", "Französisch Yaoundé; die größte Stadt ist Douala."],
  ["Kap Verde", "Praia"],
  ["Kenia", "Nairobi"],
  ["Komoren", "Moroni"],
  ["Demokratische Republik Kongo", "Kinshasa", "Nicht mit der Republik Kongo verwechseln — beide Hauptstädte liegen einander am Fluss gegenüber."],
  ["Republik Kongo", "Brazzaville"],
  ["Lesotho", "Maseru"],
  ["Liberia", "Monrovia"],
  ["Libyen", "Tripolis"],
  ["Madagaskar", "Antananarivo"],
  ["Malawi", "Lilongwe"],
  ["Mali", "Bamako"],
  ["Marokko", "Rabat", "Die größte Stadt ist Casablanca."],
  ["Mauretanien", "Nouakchott"],
  ["Mauritius", "Port Louis"],
  ["Mosambik", "Maputo"],
  ["Namibia", "Windhoek"],
  ["Niger", "Niamey"],
  ["Nigeria", "Abuja", "Seit 1991; vorher Lagos, das die größte Stadt geblieben ist."],
  ["Ruanda", "Kigali"],
  ["Sambia", "Lusaka"],
  ["São Tomé und Príncipe", "São Tomé"],
  ["Senegal", "Dakar"],
  ["Seychellen", "Victoria"],
  ["Sierra Leone", "Freetown"],
  ["Simbabwe", "Harare", "Bis 1982 Salisbury."],
  ["Somalia", "Mogadischu"],
  ["Südafrika", "Pretoria", "Regierungssitz. Das Parlament tagt in Kapstadt, das oberste Berufungsgericht sitzt in Bloemfontein."],
  ["Sudan", "Khartum"],
  ["Südsudan", "Juba", "Jüngster Staat Afrikas, unabhängig seit 2011."],
  ["Tansania", "Dodoma", "Seit 1996 Regierungssitz; Daressalam blieb die größte Stadt."],
  ["Togo", "Lomé"],
  ["Tschad", "N’Djamena"],
  ["Tunesien", "Tunis"],
  ["Uganda", "Kampala"],
  ["Zentralafrikanische Republik", "Bangui"],
];

export const ASIEN = [
  ["Japan", "Tokio"], ["China", "Peking"], ["Indien", "Neu-Delhi"],
  ["Indonesien", "Jakarta", "Ein Umzug nach Nusantara ist beschlossen, aber noch nicht vollzogen."],
  ["Südkorea", "Seoul"], ["Vietnam", "Hanoi"], ["Thailand", "Bangkok"],
  ["Kasachstan", "Astana", "Zwischen 2019 und 2022 hieß die Stadt Nur-Sultan."],
  ["Türkei", "Ankara", "Nicht Istanbul — das ist die größte Stadt, nicht die Hauptstadt."],
  ["Saudi-Arabien", "Riad"], ["Iran", "Teheran"], ["Irak", "Bagdad"],
  ["Pakistan", "Islamabad", "Seit 1967; vorher Karatschi."],
  ["Bangladesch", "Dhaka"], ["Nepal", "Kathmandu"],
  ["Sri Lanka", "Sri Jayawardenepura Kotte", "Regierungssitz; Colombo ist die größte Stadt und wird oft irrig genannt."],
  ["Malaysia", "Kuala Lumpur", "Regierung und Justiz sitzen in Putrajaya."],
  ["Myanmar", "Naypyidaw", "Seit 2005 eigens angelegt; vorher Rangun."],
  ["Philippinen", "Manila"], ["Usbekistan", "Taschkent"],
  ["Mongolei", "Ulaanbaatar"], ["Afghanistan", "Kabul"],
  ["Kambodscha", "Phnom Penh"], ["Laos", "Vientiane"],
  ["Australien", "Canberra", "Ein Kompromiss zwischen Sydney und Melbourne."],
  ["Neuseeland", "Wellington", "Die größte Stadt ist Auckland."],
  ["Papua-Neuguinea", "Port Moresby"], ["Fidschi", "Suva"],
];

export const NORDAMERIKA = [
  ["Vereinigte Staaten", "Washington, D. C."],
  ["Kanada", "Ottawa", "Nicht Toronto und nicht Montreal."],
  ["Mexiko", "Mexiko-Stadt"],
  ["Guatemala", "Guatemala-Stadt"], ["Belize", "Belmopan", "Seit 1970; vorher Belize City."],
  ["Honduras", "Tegucigalpa"], ["El Salvador", "San Salvador"],
  ["Nicaragua", "Managua"], ["Costa Rica", "San José"],
  ["Panama", "Panama-Stadt"], ["Kuba", "Havanna"],
  ["Jamaika", "Kingston"], ["Haiti", "Port-au-Prince"],
  ["Dominikanische Republik", "Santo Domingo"],
];

/** Länder, die erfahrungsgemäß verwechselt werden — vorgemerkt. */
export const VORGEMERKT = new Set([
  "Schweiz", "Niederlande", "Montenegro", "Türkei", "Kasachstan", "Sri Lanka",
  "Malaysia", "Myanmar", "Indonesien", "Pakistan", "Australien", "Neuseeland",
  "Kanada", "Belize", "Bolivien", "Brasilien", "Chile", "Ecuador",
  "Benin", "Burundi", "Elfenbeinküste", "Eswatini", "Äquatorialguinea",
  "Nigeria", "Südafrika", "Tansania", "Demokratische Republik Kongo",
]);

/* ===================================================================== */
/*  Flaggen — Bildkarten                                                 */
/* ===================================================================== */

/** Drittes Feld: der Inhalt des Bildes, gezeichnet auf 90 × 60. */
export const FLAGGEN = [
  ["Frankreich", "Paris", '<rect width="30" height="60" fill="#002654"/><rect x="30" width="30" height="60" fill="#fff"/><rect x="60" width="30" height="60" fill="#ce1126"/>'],
  ["Italien", "Rom", '<rect width="30" height="60" fill="#009246"/><rect x="30" width="30" height="60" fill="#fff"/><rect x="60" width="30" height="60" fill="#ce2b37"/>'],
  ["Belgien", "Brüssel", '<rect width="30" height="60" fill="#000"/><rect x="30" width="30" height="60" fill="#fae042"/><rect x="60" width="30" height="60" fill="#ed2939"/>'],
  ["Japan", "Tokio", '<rect width="90" height="60" fill="#fff"/><circle cx="45" cy="30" r="17" fill="#bc002d"/>'],
  ["Schweden", "Stockholm", '<rect width="90" height="60" fill="#006aa7"/><rect y="25" width="90" height="10" fill="#fecc00"/><rect x="28" width="10" height="60" fill="#fecc00"/>'],
  ["Nigeria", "Abuja", '<rect width="30" height="60" fill="#008751"/><rect x="30" width="30" height="60" fill="#fff"/><rect x="60" width="30" height="60" fill="#008751"/>'],
  ["Botsuana", "Gaborone", '<rect width="90" height="60" fill="#75aadb"/><rect y="22" width="90" height="16" fill="#fff"/><rect y="25" width="90" height="10" fill="#000"/>'],
  ["Gabun", "Libreville", '<rect width="90" height="20" fill="#009e60"/><rect y="20" width="90" height="20" fill="#fcd116"/><rect y="40" width="90" height="20" fill="#3a75c4"/>'],
  ["Kolumbien", "Bogotá", '<rect width="90" height="30" fill="#fcd116"/><rect y="30" width="90" height="15" fill="#003893"/><rect y="45" width="90" height="15" fill="#ce1126"/>'],
  ["Peru", "Lima", '<rect width="30" height="60" fill="#d91023"/><rect x="30" width="30" height="60" fill="#fff"/><rect x="60" width="30" height="60" fill="#d91023"/>'],
];
