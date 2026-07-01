#!/usr/bin/env python3
"""TAZQ marka — NİHAİ set. İndigo 'orta ton' (A/B arası).
Üretir: icon.png, adaptive_foreground.png (şeffaf, daire-güvenli), splash assetleri,
wordmark_white.png (koyu tema), wordmark_dark.png (açık tema)."""
import os, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

GF = "node_modules/@expo-google-fonts"
F_BOLD = f"{GF}/outfit/800ExtraBold/Outfit_800ExtraBold.ttf"
F_WORD = f"{GF}/outfit/600SemiBold/Outfit_600SemiBold.ttf"  # uygulama içi (daha ince/minimal)
WTRACK = 0.005  # wordmark için biraz daha ferah aralık
OUT = "assets/brand"; os.makedirs(OUT, exist_ok=True)
SS = 4; SIZE = 1024; S = SIZE * SS
TRACK = -0.03

# ── ORTA TON (A↔B arası) ─────────────────────────────────────────────────────
BG_CENTER = (32, 42, 92); BG_EDGE = (7, 8, 16); BG_GLOW = (48, 62, 142)
BG_GY = 0.33; BG_GSTR = 18; BG_GAMMA = 1.15; BG_GLOW_R = 1.0
SHEEN = ((250, 251, 253), (195, 200, 214)); EMBOSS = 117
BG_SOLID = "#1E2A66"   # Android adaptive / splash düz zemin (daha canlı/derin indigo)

def bg():
    R = 512; img = Image.new("RGB", (R, R)); p = img.load()
    cx = cy = R/2; maxd = math.hypot(cx, cy); gpx, gpy = R*0.5, R*BG_GY
    for y in range(R):
        for x in range(R):
            t = (math.hypot(x-cx, y-cy)/maxd)**BG_GAMMA
            r = BG_CENTER[0]*(1-t)+BG_EDGE[0]*t; g = BG_CENTER[1]*(1-t)+BG_EDGE[1]*t; b = BG_CENTER[2]*(1-t)+BG_EDGE[2]*t
            f = max(0.0, 1 - math.hypot(x-gpx, y-gpy)/(R*BG_GLOW_R))**2
            r += BG_GLOW[0]*f*(BG_GSTR/16); g += BG_GLOW[1]*f*(BG_GSTR/16); b += BG_GLOW[2]*f*(BG_GSTR/16)
            p[x, y] = (int(min(255,r)), int(min(255,g)), int(min(255,b)))
    return img.resize((S, S), Image.BICUBIC).convert("RGBA")

def tracked_mask(text, font, track_px):
    d = ImageDraw.Draw(Image.new("L", (4, 4)))
    adv = [d.textlength(ch, font=font) for ch in text]
    total = int(sum(adv) + track_px*(len(text)-1)); asc, desc = font.getmetrics(); H = asc+desc
    m = Image.new("L", (total+120, H+120), 0); md = ImageDraw.Draw(m); x = 60.0
    for ch, a in zip(text, adv): md.text((x, 60), ch, font=font, fill=255); x += a + track_px
    return m.crop(m.getbbox())

def fit_mask(target_w):
    lo, hi = 10, S
    while lo < hi:
        mid = (lo+hi+1)//2
        if tracked_mask("TAZQ", ImageFont.truetype(F_BOLD, mid), mid*TRACK).width <= target_w: lo = mid
        else: hi = mid-1
    return tracked_mask("TAZQ", ImageFont.truetype(F_BOLD, lo), lo*TRACK)

# Header'la AYNI harf formu: orijinal wordmark'tan (tazq_text_white) maske üret.
# Düşük çözünürlüğü temiz büyütmek için: eşikle keskinleştir → LANCZOS upscale.
def fit_mask_orig(target_w):
    src = Image.open("assets/images/tazq_text_white.png").convert("RGBA")
    alpha = src.getchannel("A")
    alpha = alpha.crop(alpha.getbbox())
    # anti-aliasing'i KORU → pürüzsüz kenar (jagged yerine hafif yumuşak, ikon boyutunda temiz)
    w0, h0 = alpha.size
    scale = target_w / w0
    return alpha.resize((int(w0*scale), int(h0*scale)), Image.LANCZOS)

def vgrad(size, top, bot):
    w, h = size; col = Image.new("RGB", (1, h))
    for y in range(h): col.putpixel((0, y), tuple(int(top[i]*(1-y/max(1,h-1))+bot[i]*(y/max(1,h-1))) for i in range(3)))
    return col.resize((w, h))

def icon(width_ratio, name):
    mask = fit_mask(int(S*width_ratio)); w, h = mask.size
    layer = vgrad((w, h), *SHEEN).convert("RGBA"); layer.putalpha(mask)
    canvas = bg(); px, py = (S-w)//2, (S-h)//2
    sh = Image.new("RGBA", (S, S), (0,0,0,0)); sm = Image.new("RGBA", (w, h), (0,0,0,0)); sm.putalpha(mask)
    sh.alpha_composite(sm, (px, py+int(S*0.009))); sh = sh.filter(ImageFilter.GaussianBlur(S*0.018))
    sh.putalpha(sh.getchannel("A").point(lambda a: int(a*0.32))); canvas = Image.alpha_composite(canvas, sh)
    canvas.alpha_composite(layer, (px, py))
    ramp = Image.new("L", (1, h))
    for y in range(h): ramp.putpixel((0, y), int(EMBOSS*max(0.0, 1 - y/(h*0.40))))
    hl = Image.new("RGBA", (w, h), (255,255,255,0)); hl.putalpha(ImageChops.multiply(mask, ramp.resize((w, h))))
    canvas.alpha_composite(hl, (px, py))
    canvas.resize((SIZE, SIZE), Image.LANCZOS).save(os.path.join(OUT, name)); print("yazıldı:", name)

def transparent_centered(width_ratio, fill, name):
    """1024 şeffaf tuval, ortalı wordmark (Android adaptive / monochrome / splash)."""
    mask = fit_mask(int(S*width_ratio)); w, h = mask.size
    canvas = Image.new("RGBA", (S, S), (0,0,0,0))
    layer = Image.new("RGBA", (w, h), fill[:3] + (0,)); layer.putalpha(mask)
    canvas.alpha_composite(layer, ((S-w)//2, (S-h)//2))
    canvas.resize((SIZE, SIZE), Image.LANCZOS).save(os.path.join(OUT, name)); print("yazıldı:", name)

def wordmark(fill, name):
    """Uygulama içi şeffaf wordmark — daha ince (SemiBold), ferah aralık, sıkıca kırpılı."""
    f = ImageFont.truetype(F_WORD, 600); mask = tracked_mask("TAZQ", f, 600*WTRACK)
    layer = Image.new("RGBA", mask.size, fill[:3] + (0,)); layer.putalpha(mask)
    pad = int(mask.height*0.16); c = Image.new("RGBA", (mask.width+pad*2, mask.height+pad*2), (0,0,0,0))
    c.alpha_composite(layer, (pad, pad)); c.save(os.path.join(OUT, name)); print("yazıldı:", name, c.size)

if __name__ == "__main__":
    for f in os.listdir(OUT):
        if f.startswith("preview_"): os.remove(os.path.join(OUT, f))
    icon(0.70, "icon.png")                                  # iOS + Android legacy (daha dolu)
    # Android adaptive foreground: GRADYANI göm (full-bleed) → daire maskesinde gradyan görünür.
    # Wordmark güvenli bölgede (0.60). Arka plan rengi sadece yedek (foreground opak kaplar).
    icon(0.60, "adaptive_foreground.png")
    # Android 13 temalı (monochrome) ikon: ayrı, şeffaf beyaz siluet.
    transparent_centered(0.60, (255,255,255), "adaptive_monochrome.png")
    transparent_centered(0.42, (255,255,255), "splash_logo.png")          # splash ortası
    wordmark((255,255,255), "wordmark_white.png")           # KOYU tema (uygulama içi)
    wordmark((14,16,22),    "wordmark_dark.png")            # AÇIK tema (uygulama içi)
    print("NİHAİ SET HAZIR. Solid bg:", BG_SOLID)
