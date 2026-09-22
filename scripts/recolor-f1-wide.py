"""Recolor the wide F1 logo (public/f1.png) into pure black / white variants.

The silhouette and the alpha channel are taken verbatim from the source — only
the RGB value changes, so the mark itself is neither redrawn nor reshaped. The
fully transparent margin is trimmed so the mark fills the header box.

Outputs (committed with the app):
    public/f1-wide-black.png   → used in Light Mode
    public/f1-wide-white.png   → used in Dark Mode
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public" / "f1.png"

VARIANTS = [
    ("f1-wide-black.png", (15, 15, 15)),
    ("f1-wide-white.png", (255, 255, 255)),
]

# Removes JPEG-ish speckles while keeping anti-aliased edges smooth (same curve
# as scripts/harden-alpha.py).
ALPHA_CURVE = lambda v: 255 if v >= 200 else (0 if v <= 40 else int((v - 40) * 255 / 160))


def main() -> None:
    src = Image.open(SRC).convert("RGBA")
    alpha = src.getchannel("A").point(ALPHA_CURVE)
    bbox = alpha.getbbox()
    print("source:", src.size, "alpha bbox:", bbox)

    for name, rgb in VARIANTS:
        solid = Image.new("RGBA", src.size, (*rgb, 255))
        solid.putalpha(alpha)
        if bbox:
            solid = solid.crop(bbox)
        out = ROOT / "public" / name
        solid.save(out)
        print("saved:", out.name, solid.size, "alpha:", solid.getchannel("A").getextrema())


if __name__ == "__main__":
    main()
