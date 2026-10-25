"""
Odak ambiyans seslerini onarır ve üretir.

Kayıtlar (rain, cafe, forest, ocean, fireplace):
  kenar fade'lerini kes → alt uğultuyu süz → en fazla 150 sn → 3 sn eşit güçlü çapraz geçişle
  dikişsiz döngü → -26 LUFS, tepe <= -3 dBFS → AAC 96 kbps mono .m4a
Üretilenler:
  binaural: 200/240 Hz (40 Hz gama) + pembe gürültü yatağı, 60 sn (iki ton da tam devir → tıksız)
  relaxing: 120 sn evrilen Re majör ambiyans katmanı, stereo
  brown:    60 sn stereo kahverengi gürültü, dikişsiz
"""
import os, subprocess, sys, json
import numpy as np

SR = 44100
SRC = sys.argv[1]
OUT = sys.argv[2]
TARGET_LUFS = -26.0
PEAK_DB = -6.0  # AAC keskin geçişlerde ~3 dB taşar → kodlama sonrası tepe <= -3 dBFS
os.makedirs(OUT, exist_ok=True)


def decode(path, highpass):
    af = f"highpass=f={highpass}:poles=2" if highpass else "anull"
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-af", af, "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def trim_fades(x):
    """Baştaki/sondaki fade'i kes: 0.25 sn pencerelerde gövde RMS'inin 4 dB yakınına gelinen yer."""
    w = int(0.25 * SR)
    rms = np.array([np.sqrt(np.mean(x[i:i + w] ** 2)) for i in range(0, len(x) - w, w)])
    body = np.median(rms)
    ok = np.where(rms >= body * 10 ** (-4 / 20))[0]
    a, b = ok[0] * w, (ok[-1] + 1) * w
    return x[a:b]


def seamless(x, xfade_s=3.0):
    """Son L örneği başa eşit güçle bindir; sonuç kendine dikişsiz bağlanır."""
    L = int(xfade_s * SR)
    t = np.linspace(0, np.pi / 2, L)
    head = x[:L] * np.sin(t) + x[-L:] * np.cos(t)
    return np.concatenate([head, x[L:-L]])


def lufs(x, ch):
    tmp = os.path.join(OUT, "_m.wav")
    write_wav(tmp, x, ch)
    out = subprocess.run(["ffmpeg", "-nostats", "-i", tmp, "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True).stderr
    os.remove(tmp)
    line = [l for l in out.splitlines() if l.strip().startswith("I:")][-1]
    return float(line.split()[1])


def write_wav(path, x, ch):
    data = (np.clip(x, -1, 1) * 32767).astype("<i2")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ar", str(SR), "-ac", str(ch), "-i", "-", path],
                   input=data.tobytes(), check=True)


def finish(name, x, ch, bitrate):
    """Yüksekliği hedefe getir, tepeyi sınırla, AAC'ye kodla."""
    g = 10 ** ((TARGET_LUFS - lufs(x, ch)) / 20)
    y = x * g
    peak = np.max(np.abs(y))
    lim = 10 ** (PEAK_DB / 20)
    if peak > lim:  # yumuşak tepe: yalnız tepeleri bastır, gövdeye dokunma
        y = np.where(np.abs(y) > lim * 0.8, np.sign(y) * (lim * 0.8 + (lim * 0.2) * np.tanh((np.abs(y) - lim * 0.8) / (lim * 0.2))), y)
    # Döngü kenarına 3 ms mikro yumuşatma: ham sinyal dikişsiz, ama AAC dosya KENARINDA tık
    # üretiyordu (ölçüldü: orman dikişinde yüksek frekans enerjisi 31×). 3 ms duyulmaz.
    k = int(0.003 * SR)
    ramp = np.sin(np.linspace(0, np.pi / 2, k)) ** 2
    yy = y.reshape(-1, ch).copy()
    yy[:k] *= ramp[:, None]
    yy[-k:] *= ramp[::-1, None]
    y = yy.reshape(-1)
    wav = os.path.join(OUT, name + ".wav")
    write_wav(wav, y, ch)
    m4a = os.path.join(OUT, name + ".m4a")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-c:a", "aac", "-b:a", bitrate, "-movflags", "+faststart", m4a], check=True)
    os.remove(wav)
    return m4a


report = {}

# ── Kayıtlar ──────────────────────────────────────────────────────────────
for name, hp in [("rain", 70), ("cafe", 50), ("forest", 50), ("ocean", 35), ("fireplace", 40)]:
    x = decode(os.path.join(SRC, name + ".mp3"), hp)
    x = trim_fades(x)
    x = x[: 150 * SR + 3 * SR]
    x = seamless(x)
    report[name] = finish(name, x, 1, "96k")

rng = np.random.default_rng(7)


def pink(n):
    """Voss-McCartney yerine frekans alanında 1/f — temiz ve hızlı."""
    w = rng.standard_normal(n)
    W = np.fft.rfft(w)
    f = np.fft.rfftfreq(n, 1 / SR)
    f[0] = f[1]
    W /= np.sqrt(f)
    W[f < 30] *= (f[f < 30] / 30) ** 2  # alt uç: hoparlörü zorlamasın
    p = np.fft.irfft(W, n)
    return p / np.max(np.abs(p))


def brown(n):
    w = rng.standard_normal(n)
    W = np.fft.rfft(w)
    f = np.fft.rfftfreq(n, 1 / SR)
    f[0] = f[1]
    W /= f
    W[f < 25] *= (f[f < 25] / 25) ** 2
    W[f > 6000] *= np.exp(-(f[f > 6000] - 6000) / 3000)
    b = np.fft.irfft(W, n)
    return b / np.max(np.abs(b))


# ── Frekans (binaural, 40 Hz gama) ────────────────────────────────────────
# FFT ile üretilen gürültü DAİRESELDİR (irfft periyodik) → 60 sn'lik dosya kendine dikişsiz bağlanır.
N = 60 * SR
t = np.arange(N) / SR
fadeless = 1.0
bed = pink(N)
left = 0.32 * np.sin(2 * np.pi * 200 * t) + 0.10 * bed
right = 0.32 * np.sin(2 * np.pi * 240 * t) + 0.10 * np.roll(bed, SR // 3)
binaural = np.stack([left, right], axis=1).reshape(-1)
report["binaural"] = finish("binaural", binaural, 2, "160k")

# ── Rahatlatıcı: evrilen Re majör katman (D3 A3 D4 F#4 A4 E5) ───────────────
N = 120 * SR
t = np.arange(N) / SR
# Frekanslar 120 sn'de TAM devir yapacak şekilde yuvarlanır (≤0.004 Hz, duyulmaz) → dikişte tık yok.
notes = [round(f * 120) / 120 for f in [146.83, 220.00, 293.66, 369.99, 440.00, 659.25]]
L = np.zeros(N)
R = np.zeros(N)
for i, f0 in enumerate(notes):
    # Her notanın kendi yavaş nefesi; periyotlar 120 sn'ye TAM bölünür → döngü dikişsiz.
    period = [40, 30, 24, 60, 20, 120][i]
    amp = 0.55 + 0.45 * np.sin(2 * np.pi * t / period + i * 1.3)
    gain = [0.30, 0.22, 0.18, 0.12, 0.10, 0.05][i]
    # Hafif akort kayması ile koro: iki kulağa ±0.25 Hz (frekanslar 120 sn'de tam devir: 0.25*120=30)
    L += gain * amp * (np.sin(2 * np.pi * (f0 - 0.25) * t) + 0.3 * np.sin(2 * np.pi * 2 * (f0 - 0.25) * t))
    R += gain * amp * (np.sin(2 * np.pi * (f0 + 0.25) * t) + 0.3 * np.sin(2 * np.pi * 2 * (f0 + 0.25) * t))
air = pink(N) * 0.02
relax = np.stack([L + air, R + np.roll(air, SR // 5)], axis=1).reshape(-1)
report["relaxing"] = finish("relaxing", relax, 2, "128k")

# ── Derin Gürültü (kahverengi) ────────────────────────────────────────────
N = 60 * SR
bl = brown(N)
br = brown(N)
deep = np.stack([0.8 * bl + 0.2 * br, 0.8 * br + 0.2 * bl], axis=1).reshape(-1)
report["brown"] = finish("brown", deep, 2, "128k")

print(json.dumps(report, indent=1))
