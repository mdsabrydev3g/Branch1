"""Harden alpha (remove JPEG-noise speckles) in the recolored logos."""
from PIL import Image
import os

OUT = r"C:\Users\Msabry\Desktop"
for name in ["f1-circle-red", "f1-circle-white", "f1-circle-black"]:
    p = os.path.join(OUT, name + ".png")
    im = Image.open(p)
    a = im.getchannel("A").point(lambda v: 255 if v >= 200 else (0 if v <= 40 else int((v - 40) * 255 / 160)))
    im.putalpha(a)
    im.save(p)
    print("cleaned:", p)
