"""Recolor the blue circular F1 logo into red / white / black, with transparent background."""
from PIL import Image
import os

SRC = r"C:\Users\Msabry\Desktop\Gemini_Generated_Image_1rcncc1rcncc1rcn.jpg"
OUT_DIR = r"C:\Users\Msabry\Desktop"

VARIANTS = [
    ("f1-circle-red", (220, 30, 40)),    # أحمر
    ("f1-circle-white", (255, 255, 255)), # أبيض
    ("f1-circle-black", (15, 15, 15)),    # أسود
]

img = Image.open(SRC).convert("RGB")
px = img.load()
w, h = img.size

# --- 1. Estimate the solid logo blue (most common bluish color) ---
from collections import Counter
counts = Counter()
for y in range(0, h, 3):
    for x in range(0, w, 3):
        r, g, b = px[x, y]
        if b > r + 30 and b > 90:  # bluish
            counts[(r, g, b)] += 1
solid = counts.most_common(1)[0][0]
print("solid blue:", solid)

# --- 2. Alpha from color distance: pixel = white*(1-a) + blue*a  =>  a per channel ---
sr, sg, sb = solid
alpha_img = Image.new("L", (w, h), 0)
ap = alpha_img.load()
min_x, min_y, max_x, max_y = w, h, 0, 0
for y in range(h):
    for x in range(w):
        r, g, b = px[x, y]
        # inverse of blend with white background
        den_r, den_g, den_b = 255 - sr, 255 - sg, 255 - sb
        est = []
        if den_r > 20: est.append((255 - r) / den_r)
        if den_g > 20: est.append((255 - g) / den_g)
        if den_b > 20: est.append((255 - b) / den_b)
        a = max(0.0, min(1.0, sum(est) / len(est)))
        if a > 0.02:
            ap[x, y] = int(a * 255)
            if a > 0.6:
                min_x, min_y = min(min_x, x), min(min_y, y)
                max_x, max_y = max(max_x, x), max(max_y, y)

# --- 3. Crop to the logo bbox (excludes the black caption text at bottom) ---
pad = 4
box = (max(0, min_x - pad), max(0, min_y - pad), min(w, max_x + pad), min(h, max_y + pad))
print("crop box:", box)
alpha_img = alpha_img.crop(box)
rgb_img = img.crop(box)

# Zero out alpha for dark non-blue pixels (any leftover text)
apx = alpha_img.load()
rpx = rgb_img.load()
for y in range(alpha_img.height):
    for x in range(alpha_img.width):
        r, g, b = rpx[x, y]
        if not (b > r + 20 or apx[x, y] < 40):  # dark neutral pixels -> transparent
            apx[x, y] = 0

# --- 4. Write recolored outputs ---
for name, (nr, ng, nb) in VARIANTS:
    out = Image.new("RGBA", alpha_img.size, (nr, ng, nb, 0))
    out.putalpha(alpha_img)
    out_path = os.path.join(OUT_DIR, f"{name}.png")
    out.save(out_path)
    print("saved:", out_path)

print("done")
