import os
import csv
import io
import io
try:
    from cairosvg import svg2png
except ImportError:
    svg2png = None
# Background colors to test
BACKGROUNDS = {
    "dark": "#2C2C2E",
    "light": "#ECEFF1",
}

SIZES = [24, 16]
THRESHOLD = 4.5
ICONS_DIR = os.path.join("Tazq-Frontend", "Resources", "Images")
RESULTS = []

def relative_luminance(rgb):
    def channel(c):
        c = c / 255.0
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = rgb
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)

def contrast_ratio(c1, c2):
    l1 = relative_luminance(c1)
    l2 = relative_luminance(c2)
    if l1 < l2:
        l1, l2 = l2, l1
    return (l1 + 0.05) / (l2 + 0.05)

def load_icon(path):
    """Load an icon as an RGBA Pillow Image."""
    if path.lower().endswith(".svg"):
        png_bytes = svg2png(url=path)
        return Image.open(io.BytesIO(png_bytes)).convert("RGBA")
    return Image.open(path).convert("RGBA")

def analyze_icon(path):
    icon_name = os.path.relpath(path, ICONS_DIR)
    im = Image.open(path).convert("RGBA")
    if path.lower().endswith(".svg"):
        if svg2png is None:
            raise RuntimeError("cairosvg is required for SVG support")
        png_bytes = svg2png(url=path)
        im = Image.open(io.BytesIO(png_bytes)).convert("RGBA")
    else:
        im = Image.open(path).convert("RGBA")
    for size in SIZES:
        icon_resized = im.resize((size, size), Image.LANCZOS)
        for bg_name, bg_hex in BACKGROUNDS.items():
            bg_rgb = ImageColor.getcolor(bg_hex, "RGB")
            background = Image.new("RGBA", (size, size), bg_rgb + (255,))
            background.paste(icon_resized, (0, 0), icon_resized)
            min_ratio = 100.0
            for r, g, b, a in background.getdata():
                if a == 0:
                    continue
                ratio = contrast_ratio((r, g, b), bg_rgb)
                if ratio < min_ratio:
                    min_ratio = ratio
            RESULTS.append((icon_name, size, bg_name, round(min_ratio, 2), min_ratio >= THRESHOLD))

def main():
    for root, _, files in os.walk(ICONS_DIR):
        for f in files:
            if f.lower().endswith(('.png', '.svg')):
                analyze_icon(os.path.join(root, f))

    fail = False
    with open("icon_contrast_results.csv", "w", newline="") as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(["icon", "size", "background", "contrast_ratio", "pass"])
        for res in RESULTS:
            writer.writerow(res)
            if not res[4]:
                fail = True

    if fail:
        print("Some icons failed contrast check. See icon_contrast_results.csv")
        exit(1)
    else:
        print("All icons meet contrast requirements. See icon_contrast_results.csv")

if __name__ == "__main__":
    main()