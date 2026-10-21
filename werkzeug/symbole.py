"""
Erzeugt die Symbole der App aus dem Logo.

Aufruf (im Ordner Anchor):  python werkzeug/symbole.py
Braucht einmalig:                   python -m pip install --user pymupdf pillow

Vorlage ist "A Logo.ai" (oder "Anchor Logo.pdf") im Hauptordner. Die Datei selbst
liegt nicht im Git (Quelldateien des Entwurfs); die fertigen Symbole schon.

Was entsteht, und wofür:
  symbol-512.png, symbol-192.png   Startbildschirm von Handy und Tablet
  symbol-maskable-512.png          Android schneidet Symbole rund oder
                                   eckig zu; hier liegt das Logo mit Rand,
                                   damit beim Zuschneiden nichts fehlt
  apple-touch-icon.png (180)       iPhone und iPad
  symbol-32.png                    Reiter im Browser
  symbol.ico                       Verknüpfung auf dem Schreibtisch (Windows)
  logo-96.png                      das Logo oben links in der App
"""

import io
import os
import sys

import pymupdf
from PIL import Image

HIER = os.path.dirname(os.path.abspath(__file__))
WURZEL = os.path.dirname(HIER)
VORLAGE = next((os.path.join(WURZEL, n) for n in
                (os.path.join("Logo", "A Logo.pdf"), "A Logo.ai", "Anchor Logo.pdf", "Deep Dive Logo.pdf",
                 "Deep Learning Logo.pdf", "Smart Learning Logo.pdf")
                if os.path.exists(os.path.join(WURZEL, n))),
               os.path.join(WURZEL, "Anchor Logo.pdf"))
ZIEL = os.path.join(WURZEL, "public")

# Mit der Farbe am Rand des Logos wird beim maskierbaren Symbol aufgefüllt,
# damit der Rand nahtlos anschließt. Sie wird aus der Ecke des Logos
# gelesen (eine `.ai`-Datei aus Illustrator ist zugleich ein PDF) — so passt
# sie auch, wenn das Logo die Farbe wechselt.


def rastern(kante):
    seite = pymupdf.open(VORLAGE)[0]
    faktor = kante / max(seite.rect.width, seite.rect.height)
    bild = seite.get_pixmap(matrix=pymupdf.Matrix(faktor, faktor), alpha=False)
    return Image.open(io.BytesIO(bild.tobytes("png"))).convert("RGB")


def schriftReichweite(bild):
    """Wie weit die weiße Schrift vom Mittelpunkt reicht, als Anteil der Breite."""
    breite, hoehe = bild.size
    weit = 0.0
    for y in range(0, hoehe, 2):
        for x in range(0, breite, 2):
            r, g, b = bild.getpixel((x, y))
            if r > 235 and g > 235 and b > 235:
                weit = max(weit, ((x - breite / 2) ** 2 + (y - hoehe / 2) ** 2) ** 0.5 / breite)
    return weit


def main():
    if not os.path.exists(VORLAGE):
        sys.exit("Vorlage fehlt: " + VORLAGE)
    gross = rastern(2048)
    klein = lambda n: gross.resize((n, n), Image.LANCZOS)
    rand = gross.getpixel((4, 4))
    print("Vorlage:", os.path.basename(VORLAGE), "· Randfarbe: #%02x%02x%02x" % rand)

    def schreibe(name, bild):
        pfad = os.path.join(ZIEL, name)
        bild.save(pfad, optimize=True)
        print("geschrieben:", pfad)

    schreibe("symbol-512.png", klein(512))
    schreibe("symbol-192.png", klein(192))
    schreibe("apple-touch-icon.png", klein(180))
    schreibe("symbol-32.png", klein(32))
    schreibe("logo-96.png", klein(96))

    # Maskierbar: Android schneidet das Symbol zu (Kreis, Tropfen, Quadrat)
    # und lässt sicher nur einen Kreis mit 40 % des Durchmessers vom
    # Mittelpunkt stehen. Liegt die weiße Schrift darin, wird das Logo
    # randlos verwendet — bei einem Verlauf sähe jedes Auffüllen mit einer
    # Randfarbe wie eine Kante aus. Sonst wird es auf 78 % verkleinert und
    # mit der Randfarbe aufgefüllt.
    if schriftReichweite(klein(256)) <= 0.38:
        schreibe("symbol-maskable-512.png", klein(512))
    else:
        masken = Image.new("RGB", (512, 512), rand)
        innen = klein(400)
        masken.paste(innen, ((512 - 400) // 2, (512 - 400) // 2))
        schreibe("symbol-maskable-512.png", masken)

    ico = os.path.join(ZIEL, "symbol.ico")
    klein(256).save(ico, sizes=[(16, 16), (24, 24), (32, 32), (48, 48),
                                (64, 64), (128, 128), (256, 256)])
    print("geschrieben:", ico)


if __name__ == "__main__":
    main()
