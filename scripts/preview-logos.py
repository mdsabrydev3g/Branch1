"""Composite the recolored logos on a gray background to verify transparency + clean edges."""
from PIL import Image
import os

OUT = r"C:\Users\Msabry\Desktop"
for name in ["f1-circle-red", "f1-circle-white", "f1-circle-black"]:
    im = Image.open(os.path.join(OUT, name + ".png"))
    bg = Image.new("RGBA", im.size, (128, 128, 128, 255))
    bg.alpha_composite(im)
    bg.convert("RGB").save(os.path.join(OUT, "preview-" + name + ".jpg"), quality=90)
    a = im.getchannel("A")
    mn, mx = a.getextrema()
    print(name, "size:", im.size, "alpha range:", (mn, mx))
