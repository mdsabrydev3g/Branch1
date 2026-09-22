"""Recolor the red F1 logo into blue / white / black versions, preserving transparency."""
from PIL import Image
import os

SRC = r"C:\Users\Msabry\Desktop\Firefly_RemoveBackground.png 11111111111.png"
OUT_DIR = r"C:\Users\Msabry\Desktop"

# (output name, RGB color)
VARIANTS = [
    ("logo-blue", (10, 90, 220)),     # أزرق
    ("logo-white", (255, 255, 255)),  # أبيض
    ("logo-black", (15, 15, 15)),     # أسود
]

img = Image.open(SRC).convert("RGBA")
r, g, b, a = img.split()

for name, (nr, ng, nb) in VARIANTS:
    solid = Image.new("RGBA", img.size, (nr, ng, nb, 255))
    # Keep original alpha so transparent background stays transparent
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    solid.putalpha(a)
    # If the source has semi-transparent anti-aliased edges this keeps them smooth
    alpha = solid.getchannel("A")
    solid.putalpha(alpha)
    out = solid
    out_path = os.path.join(OUT_DIR, f"{name}.png")
    out.save(out_path)
    print("saved:", out_path)

print("done")
