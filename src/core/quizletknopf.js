/*
 * Der Quizlet-Knopf: ein Lesezeichen, das auf der Seite eines Quizlet-Stapels
 * die Karten einsammelt und zum Kopieren anbietet.
 *
 * Warum so umständlich: Quizlet gibt seine Karten nicht an andere Seiten
 * heraus, und „Exportieren“ gibt es nur für eigene Stapel und nur am Rechner.
 * Ein Link allein nützt Anchor darum nichts. Was im Browser auf der
 * Quizlet-Seite steht, kann aber ein Lesezeichen lesen — es läuft dort wie
 * ein Klick des Nutzers selbst, nicht als fremde Seite.
 *
 * `quizletKnopf` läuft auf quizlet.com, nicht in Anchor. Darum darf es nichts
 * von außerhalb benutzen (keine Einfuhr, keine Hilfsfunktion dieser Datei):
 * Das Lesezeichen enthält nur den Text dieser einen Funktion. Und es bleibt
 * bei altem JavaScript ohne neuere Zeichen, damit es in jedem Browser läuft.
 *
 * Gelesen wird zuerst die Begriffsliste, so wie sie auf der Seite steht:
 * jede Zeile mit genau zwei Textfeldern (Begriff, Definition). Findet sich
 * keine, die Daten, die Quizlet für den Aufbau der Seite mitschickt.
 * Quizlets Seitenaufbau ändert sich ab und zu — dann findet der Knopf
 * nichts und sagt das, statt Falsches zu liefern.
 */

/* eslint-disable no-var */
export function quizletKnopf(anchorAdresse, nurLesen) {
  var WAHL = ".TermText, [class*='TermText']";
  var paare = [], gesehen = {};

  function rein(t) { return String(t == null ? "" : t).replace(/\s+/g, " ").trim(); }
  function dazu(a, b) {
    a = rein(a); b = rein(b);
    if (!a && !b) return;
    var s = a.toLowerCase() + "\u0001" + b.toLowerCase();
    if (gesehen[s]) return;
    gesehen[s] = 1;
    paare.push([a, b]);
  }
  function textVon(el) { return el.innerText != null ? el.innerText : el.textContent; }
  /* Nur die innersten Treffer: Trägt auch eine Hülle „TermText“ im Namen,
     zählte jede Zeile sonst doppelt. */
  function felderIn(wurzel) {
    var alle = wurzel.querySelectorAll(WAHL), aus = [];
    for (var i = 0; i < alle.length; i++) if (!alle[i].querySelector(WAHL)) aus.push(alle[i]);
    return aus;
  }

  /* 1. Die Begriffsliste: je Zeile genau zwei Felder. */
  var felder = felderIn(document), reihen = [];
  for (var i = 0; i < felder.length; i++) {
    var r = felder[i].parentElement;
    while (r && felderIn(r).length < 2) r = r.parentElement;
    if (r && felderIn(r).length === 2 && reihen.indexOf(r) < 0) reihen.push(r);
  }
  for (var j = 0; j < reihen.length; j++) {
    var f = felderIn(reihen[j]);
    dazu(textVon(f[0]), textVon(f[1]));
  }

  /* 2. Sonst die Daten zum Aufbau der Seite. */
  function suche(o, tiefe) {
    if (!o || typeof o !== "object" || tiefe > 60) return;
    if (o.cardSides && o.cardSides.length >= 2) {
      var seiten = [];
      for (var k = 0; k < 2; k++) {
        var m = o.cardSides[k].media || [], text = "";
        for (var n = 0; n < m.length; n++) if (m[n] && m[n].plainText != null) { text = m[n].plainText; break; }
        seiten.push(text);
      }
      dazu(seiten[0], seiten[1]);
      return;
    }
    if (typeof o.word === "string" && typeof o.definition === "string") { dazu(o.word, o.definition); return; }
    for (var schluessel in o) {
      var v = o[schluessel];
      if (typeof v === "string" && v.length > 200 && /^\s*[[{]/.test(v)) {
        try { suche(JSON.parse(v), tiefe + 1); } catch (e) { /* kein JSON */ }
      } else suche(v, tiefe + 1);
    }
  }
  if (!paare.length) {
    var skripte = document.querySelectorAll("script#__NEXT_DATA__, script[type='application/json']");
    for (var s = 0; s < skripte.length; s++) {
      try { suche(JSON.parse(skripte[s].textContent), 0); } catch (e) { /* kein JSON */ }
    }
  }

  if (nurLesen) return paare;

  /* ----------------------------- Anzeige ------------------------------ */
  var text = paare.map(function (p) { return p[0] + "\t" + p[1]; }).join("\n");
  var alt = document.getElementById("anchor-knopf");
  if (alt) alt.parentNode.removeChild(alt);

  var kasten = document.createElement("div");
  kasten.id = "anchor-knopf";
  kasten.style.cssText = "position:fixed;z-index:2147483647;left:50%;top:16px;transform:translateX(-50%);"
    + "width:min(440px,calc(100vw - 24px));box-sizing:border-box;padding:16px;border-radius:14px;"
    + "background:#16181d;color:#e8eaf0;font:15px/1.45 system-ui,sans-serif;"
    + "box-shadow:0 12px 40px rgba(0,0,0,.45);";
  function knopf(beschriftung, voll) {
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = beschriftung;
    b.style.cssText = "margin:10px 8px 0 0;padding:9px 14px;border-radius:9px;font:inherit;cursor:pointer;"
      + (voll ? "background:#3fbf7f;color:#08130d;border:0;font-weight:600;"
        : "background:transparent;color:inherit;border:1px solid #3a3f4b;");
    kasten.appendChild(b);
    return b;
  }
  var zeile = document.createElement("div");
  kasten.appendChild(zeile);

  if (!paare.length) {
    zeile.textContent = "Anchor: Auf dieser Seite stehen keine Karten, die der Knopf lesen kann. "
      + "Öffne die Seite des Stapels selbst (mit der Liste aller Begriffe), nicht die Lernansicht, "
      + "und drück den Knopf dort noch einmal.";
  } else {
    zeile.textContent = "Anchor: " + paare.length + (paare.length === 1 ? " Karte" : " Karten")
      + " gefunden. Zeigt Quizlet mehr Begriffe an? Dann erst unten „Mehr anzeigen“ und den Knopf "
      + "noch einmal drücken.";
    var kopieren = knopf("Kopieren", true);
    kopieren.onclick = function () {
      function fertig() {
        zeile.textContent = "Kopiert. Jetzt in Anchor beim Stapel „Aus Quizlet …“ öffnen und "
          + "„Einfügen“ tippen.";
      }
      function zurueck() {
        var feld = document.createElement("textarea");
        feld.value = text;
        feld.style.cssText = "position:fixed;top:0;left:0;opacity:0;";
        document.body.appendChild(feld);
        feld.focus(); feld.select();
        try { document.execCommand("copy"); fertig(); } catch (e) { zeile.textContent = "Kopieren ging nicht."; }
        document.body.removeChild(feld);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(fertig, zurueck);
      } else zurueck();
    };
    if (anchorAdresse) {
      var oeffnen = knopf("Anchor öffnen", false);
      oeffnen.onclick = function () { window.open(anchorAdresse, "_blank"); };
    }
  }
  knopf("Schließen", false).onclick = function () { kasten.parentNode.removeChild(kasten); };
  document.body.appendChild(kasten);
  return paare;
}
/* eslint-enable no-var */

/**
 * Das Lesezeichen selbst: der Text von `quizletKnopf` als `javascript:`-Adresse.
 * Ganz verschlüsselt — ein `%` im Code würde beim Ausführen sonst als
 * Zeichencode gelesen.
 */
export function knopfAdresse(anchorAdresse) {
  return "javascript:" + encodeURIComponent(
    "(" + quizletKnopf.toString() + ")(" + JSON.stringify(anchorAdresse || "") + ");void 0");
}
