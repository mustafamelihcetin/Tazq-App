"""Filme özel ambiyans müziği — tamamen sentez, telif yok.

Yavaş akor yürüyüşü (Dmaj9 – Bm11 – Gmaj7 – A6sus) üstünde yumuşak pad, alt bas ve
12. saniyeden sonra giren piyano benzeri arpej. Kapanışa doğru hafif yükseliş.
Kullanım: python music.py <çıktı.wav> [süre_sn]
"""
import sys
import wave

import numpy as np

SR = 48000
DUR = float(sys.argv[2]) if len(sys.argv) > 2 else 90.0
N = int(SR * DUR)
t = np.arange(N) / SR
rng = np.random.default_rng(7)


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


CHORDS = [  # MIDI notaları
    [50, 57, 62, 66, 69, 76],  # Dmaj9
    [47, 54, 62, 66, 69, 73],  # Bm9 (C#–D yarım ses çatışması kaldırıldı)
    [43, 55, 59, 62, 66, 71],  # Gmaj7
    [45, 57, 62, 64, 66, 69],  # A6sus
]
BAR = 8.0

L = np.zeros(N)
R = np.zeros(N)


def env(start, length, att, rel):
    e = np.zeros(N)
    i0, i1 = int(start * SR), min(N, int((start + length + rel) * SR))
    if i0 >= N:
        return e
    x = t[i0:i1] - start
    a = np.clip(x / att, 0, 1)
    r = np.clip(1 - (x - length) / rel, 0, 1)
    e[i0:i1] = np.sin(a * np.pi / 2) ** 2 * r
    return e


# Pad: her nota üç hafif ayarsız ses, yumuşak harmonikler
for k in range(int(DUR // BAR) + 1):
    ch = CHORDS[k % 4]
    e = env(k * BAR, BAR, 3.0, 3.5)
    for j, m in enumerate(ch[1:]):
        f0 = hz(m)
        for det, pan in ((-0.04, 0.25), (0.0, 0.5), (0.04, 0.75)):  # az ayarsızlık: vuru pürüzü yok
            f = f0 * 2 ** (det / 12)
            ph = rng.uniform(0, 2 * np.pi)
            s = np.sin(2 * np.pi * f * t + ph) + 0.25 * np.sin(4 * np.pi * f * t + ph) + 0.08 * np.sin(6 * np.pi * f * t)
            s *= e * 0.018 * (1 + 0.3 * np.sin(2 * np.pi * 0.11 * t + j))
            L += s * (1 - pan)
            R += s * pan
    # Bas: kökün kendisi (~60-75 Hz) — bir oktav altı küçük hoparlörde cızırtı yapıyordu
    b = np.sin(2 * np.pi * hz(ch[0]) * t) * env(k * BAR, BAR, 2.0, 2.0) * 0.03
    L += b
    R += b

# Arpej: 12 sn'den sonra, sekizlik nota yerine seyrek ve nefesli
step = 0.5
for i in range(int(12 / step), int((DUR - 4) / step)):
    st = i * step
    if rng.random() < 0.45:
        continue
    ch = CHORDS[int(st // BAR) % 4]
    m = ch[2 + (i * 3) % 4] + 12
    f = hz(m)
    i0 = int(st * SR)
    i1 = min(N, i0 + int(2.5 * SR))
    x = t[i0:i1] - st
    s = (np.sin(2 * np.pi * f * x) + 0.3 * np.sin(4 * np.pi * f * x) * np.exp(-x * 6)) * np.exp(-x * 2.2)
    s *= 0.03 * (1 - np.exp(-x * 400))
    pan = 0.3 + 0.4 * rng.random()
    L[i0:i1] += s * (1 - pan)
    R[i0:i1] += s * pan

# Kapanışa doğru yükseliş
swell = np.clip((t - (DUR - 25)) / 15, 0, 1) * np.clip((DUR - t) / 6, 0, 1)
L *= 1 + 0.5 * swell
R *= 1 + 0.5 * swell


# Basit oda yankısı: üstel sönen gürültü ile FFT konvolüsyonu
def reverb(x, seconds=3.2, mix=0.45):
    n = int(seconds * SR)
    ir = np.convolve(rng.standard_normal(n), np.ones(6) / 6, 'same') * np.exp(-np.arange(n) / (SR * seconds / 6))
    ir /= np.sqrt(np.sum(ir**2))
    size = 1 << int(np.ceil(np.log2(len(x) + n)))
    y = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[: len(x)]
    return x * (1 - mix) + y * mix


L, R = reverb(L), reverb(R)


# 55 Hz altını ve 9 kHz üstünü yumuşakça kes (FFT maskesi)
def band(x, lo=55.0, hi=9000.0):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / (1 + (lo / np.maximum(f, 1e-3)) ** 4) / (1 + (f / hi) ** 4)
    return np.fft.irfft(X, len(x))


L, R = band(L), band(R)
fade = np.clip(t / 3, 0, 1) * np.clip((DUR - t) / 4, 0, 1)
out = np.stack([L * fade, R * fade], axis=1)
out /= np.max(np.abs(out)) / 0.85
pcm = (out * 32767).astype("<i2")
with wave.open(sys.argv[1], "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("ok", sys.argv[1], DUR)
