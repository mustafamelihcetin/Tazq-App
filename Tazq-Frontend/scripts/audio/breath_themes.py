"""
Nefes ses temaları — her fazın SÜRESİ kadar (al: 1,2,4,5.5 · ver: 4,5.5,6,8 sn).
  wave    — gerçek nefes sesi (v4: formantlı hava akışı, tonsuz; ekranda adı 'Nefes')
  kalimba — tatlı: alışta yükselen, verişte inen pentatonik notalar, faz boyunca yayılır
  warm    — sıcak: tek majör akor yavaşça şişer (al) / söner (ver); vuruşma yok (saf sinüs)
Hepsi: tık yok, tiz yok (üst partiyeller hızlı söner).
v3 (iOS'ta "ses gelmedi"): telefon hoparlörü ~500 Hz altını neredeyse vermez; dalga/sıcak
enerjisinin %86-99'u oradaydı ve duyulan odak çanından 11-14 dB kısıktı. Bant 450 Hz+ çıkarıldı
(tıslama yine yok: 2.5 kHz üstü <%2) ve hepsi çanın seviyesine (RMS ~-19 dBFS) eşitlendi.
"""
import numpy as np, wave, sys, os

sr = 44100
rng = np.random.default_rng(7)
IN_D = (1, 2, 4, 5.5)
OUT_D = (4, 5.5, 6, 8)

def smooth(x): return x * x * (3 - 2 * x)

def lp(x, cutoff):
    y = np.empty_like(x); z = 0.0
    a = np.exp(-2 * np.pi * np.broadcast_to(cutoff, x.shape) / sr)
    for i in range(len(x)):
        z = (1 - a[i]) * x[i] + a[i] * z; y[i] = z
    return y

def lp3(x, c): return lp(lp(lp(x, c), c), c)

def norm(x, db): return x / (np.max(np.abs(x)) + 1e-9) * 10 ** (db / 20)

def level(x, rms_db=-19.0, peak_db=-3.0):
    """Duyulan odak çanıyla aynı ortalama seviye; tepe -3 dBFS'yi geçmez."""
    nz = np.abs(x) > 1e-4
    rms = np.sqrt(np.mean(x[nz] ** 2)) if nz.any() else 1e-9
    y = x * (10 ** (rms_db / 20) / rms)
    pk = np.max(np.abs(y))
    if pk > 10 ** (peak_db / 20): y *= 10 ** (peak_db / 20) / pk
    return y

def fade_edges(x, ms=15):
    n = int(sr * ms / 1000); x[:n] *= np.linspace(0, 1, n); x[-n:] *= np.linspace(1, 0, n); return x

# ── nefes (v5) ───────────────────────────────────────────────────────────────
# v4 "süpürge"yi çözdü (ton yok) ama kullanıcı: "çok sert, pürüzsüz değil, başı ve sonu
# pürüzsüz bitmiyor". Ölçülen sebepler: alış ağırlık merkezi 1.3 kHz (parlak hava = hışırtı),
# kısa giriş/çıkış (%8–12) ve doğrusal ara değerli rastgele dalgalanma (eğimde kırılmalar).
# v5: tek, koyu-yumuşak biçimli gürültü (tepe 0.65–0.9 kHz, 1.3–1.8 kHz'te 24 dB/okt düşüş),
# smootherstep zarf (türevi de sıfırdan başlar/biter → tık ve "kesik" yok), uzun geçişler
# (alış %45 dolar/%35 söner; veriş %25 dolar/%60 söner), dalgalanma YOK, seviye -22 dBFS RMS
# (gürültü aynı seviyedeki tondan yüksek algılanır).
def smoother(x):
    x = np.clip(x, 0, 1)
    return x * x * x * (x * (6 * x - 15) + 10)

def shaped_noise(n, peak, fc, seed):
    r = np.random.default_rng(seed)
    f = np.fft.rfftfreq(n, 1 / sr); f[0] = 1
    lg = np.log2(f)
    fc0, gain_db, width = peak
    mag = 10 ** (gain_db / 20 * np.exp(-0.5 * ((lg - np.log2(fc0)) / width) ** 2))
    mag *= (f / 380) ** 2 / (1 + (f / 380) ** 2)   # 380 Hz altı yumuşak kesim (hoparlör vermiyor)
    mag /= 1 + (f / fc) ** 4                        # 24 dB/okt yumuşak tiz düşüşü
    x = np.fft.irfft(np.fft.rfft(r.standard_normal(n)) * mag, n)
    # PÜRÜZ GİDERME: dar bantlı gürültünün kendi genliği 20 ms'de 4–5 dB oynuyor ("hırıltı").
    # Hilbert zarfına bölünür (sabit genlikli hava), sonra aynı biçimle yeniden süzülür.
    X = np.fft.fft(x); h = np.zeros(n); h[0] = 1; h[1:(n + 1) // 2] = 2
    if n % 2 == 0: h[n // 2] = 1
    env = np.abs(np.fft.ifft(X * h))
    k = int(sr * 0.008); env = np.convolve(env, np.ones(k) / k, mode='same') + 1e-6
    x = np.fft.irfft(np.fft.rfft(x / env) * mag, n)
    return x / (np.max(np.abs(x)) + 1e-9)

def breath_air(d, rising, seed=11):
    n = int(sr * d); u = np.arange(n) / n
    if rising:
        flow = smoother(u / 0.45) * smoother((1 - u) / 0.35)
        air = shaped_noise(n, (800, 5, 0.55), 1500, seed)
    else:
        flow = smoother(u / 0.25) * smoother((1 - u) / 0.6)
        air = shaped_noise(n, (650, 5, 0.55), 1300, seed + 2)
    return level(air * flow, rms_db=-22.0)

wave_swell = breath_air  # dosya adları (wave_*) ve tema anahtarı korunur

# ── kalimba ──────────────────────────────────────────────────────────────────
PENTA = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50]  # C5 D5 E5 G5 A5 C6

def pluck(f, n_len, amp):
    t = np.arange(n_len) / sr
    atk = np.clip(t / 0.004, 0, 1)
    body = np.sin(2 * np.pi * f * t) * np.exp(-t * 2.6)
    # kalimba "tını"sı: yumuşak ikinci partiyel çok hızlı söner → metalik değil, tatlı
    shimmer = 0.18 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 9)
    return amp * atk * (body + shimmer)

def kalimba(d, rising):
    n = int(sr * d) + int(sr * 1.2)  # son nota sönsün diye kuyruk; oynatıcı faz bitince kesilmez, doğal söner
    x = np.zeros(n)
    k = 2 if d <= 1 else max(3, min(6, int(round(d * 1.1))))
    notes = PENTA[:k] if rising else PENTA[:k][::-1]
    span = d * (0.8 if rising else 0.75)
    for i, f in enumerate(notes):
        start = int(sr * span * (i / max(1, k - 1))) if k > 1 else 0
        amp = (0.7 + 0.3 * i / max(1, k - 1)) if rising else (1.0 - 0.45 * i / max(1, k - 1))
        seg = pluck(f, n - start, amp)
        x[start:] += seg
    return level(fade_edges(x))

# ── sıcak akor ───────────────────────────────────────────────────────────────
def warm(d, rising):
    n = int(sr * d); t = np.arange(n) / sr; u = t / d
    chord = [523.25, 659.25, 783.99] if rising else [523.25, 622.25, 783.99]  # C5 majör al, C5 minör-sıcak ver
    x = sum(np.sin(2 * np.pi * f * t) * w for f, w in zip(chord, (1.0, 0.6, 0.5)))
    x += 0.08 * np.sin(2 * np.pi * 2 * chord[0] * t)
    if rising:
        env = smooth(np.clip(u / 0.85, 0, 1)) * smooth(np.clip((1 - u) / 0.15, 0, 1))
    else:
        env = smooth(np.clip(u / 0.1, 0, 1)) * smooth(np.clip(1 - u, 0, 1)) ** 1.6
    return level(x * env)

def save(x, path):
    w = wave.open(path, 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
    w.writeframes((np.clip(x, -1, 1) * 32767).astype('<i2').tobytes()); w.close()

def stats(x):
    s = np.abs(np.fft.rfft(x)) ** 2; f = np.fft.rfftfreq(len(x), 1 / sr)
    return round(float((s * f).sum() / s.sum())), round(float(s[f > 2500].sum() / s.sum() * 100), 2)

# Kullanım: python breath_themes.py <wav_klasörü>  → sonra her wav: ffmpeg -i x.wav -codec:a libmp3lame -b:a 96k -ac 1 assets/sounds/breath/x.mp3
out = sys.argv[1]; os.makedirs(out, exist_ok=True)
for name, fn in (('wave', wave_swell), ('kalimba', kalimba), ('warm', warm)):
    for d in IN_D: save(fn(d, True), f"{out}/{name}_in_{str(d).replace('.', '_')}.wav")
    for d in OUT_D: save(fn(d, False), f"{out}/{name}_out_{str(d).replace('.', '_')}.wav")
    print(name, 'in_4 (centroid Hz, %>2.5k):', stats(fn(4, True)), 'out_6:', stats(fn(6, False)))
