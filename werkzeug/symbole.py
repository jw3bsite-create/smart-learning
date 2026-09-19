"""
Erzeugt die Symbole der App aus dem Logo.

Aufruf (im Ordner Smart Learning):  python werkzeug/symbole.py
Braucht einmalig:                   python -m pip install --user pymupdf pillow

Vorlage ist "Smart Learning Logo.pdf" im Hauptordner. Die Datei selbst
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
VORLAGE = os.path.join(WURZEL, "Smart Learning Logo.pdf")
ZIEL = os.path.join(WURZEL, "public")

# Die Farbe am Rand des Logos: dunkles Nachtblau. Damit wird beim
# maskierbaren Symbol aufgefüllt, damit der Rand nahtlos anschließt.
RAND = (0x00, 0x0B, 0x1F)


def rastern(kante):
    seite = pymupdf.open(VORLAGE)[0]
    faktor = kante / max(seite.rect.width, seite.rect.height)
    bild = seite.get_pixmap(matrix=pymupdf.Matrix(faktor, faktor), alpha=False)
    return Image.open(io.BytesIO(bild.tobytes("png"))).convert("RGB")


def main():
    if not os.path.exists(VORLAGE):
        sys.exit("Vorlage fehlt: " + VORLAGE)
    gross = rastern(2048)
    klein = lambda n: gross.resize((n, n), Image.LANCZOS)

    def schreibe(name, bild):
        pfad = os.path.join(ZIEL, name)
        bild.save(pfad, optimize=True)
        print("geschrieben:", pfad)

    schreibe("symbol-512.png", klein(512))
    schreibe("symbol-192.png", klein(192))
    schreibe("apple-touch-icon.png", klein(180))
    schreibe("symbol-32.png", klein(32))
    schreibe("logo-96.png", klein(96))

    # Maskierbar: Das Logo auf 78 % verkleinert, außen mit der Randfarbe
    # aufgefüllt. Die Buchstaben bleiben so in dem Kreis, den Android auf
    # jeden Fall stehen lässt.
    masken = Image.new("RGB", (512, 512), RAND)
    innen = klein(400)
    masken.paste(innen, ((512 - 400) // 2, (512 - 400) // 2))
    schreibe("symbol-maskable-512.png", masken)

    ico = os.path.join(ZIEL, "symbol.ico")
    klein(256).save(ico, sizes=[(16, 16), (24, 24), (32, 32), (48, 48),
                                (64, 64), (128, 128), (256, 256)])
    print("geschrieben:", ico)


if __name__ == "__main__":
    main()
