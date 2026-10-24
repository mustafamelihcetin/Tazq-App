"""Seslendirme: Chatterbox Multilingual ile TR ve EN satırları üretir.

Satırlar video/src/copy.ts içindeki NARRATION'dan okunur (tek kaynak). Kulakla seçim
yapılamadığı için her satıra birkaç aday (farklı seed) üretilir; faster-whisper adayları
yazıya döker ve metne en sadık (en düşük karakter hata oranı), eşitlikte en doğal
hızdaki aday seçilir. Baş/son sessizlik kırpılır, süreler video/src/timing.json'a yazılır.

Kullanım: .venv/Scripts/python.exe narrate.py [--takes 4] [--ref sesorneği.wav]
"""
import json
import re
import sys
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path

import torch
import soundfile as sf
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
from faster_whisper import WhisperModel

ROOT = Path(__file__).resolve().parent.parent / "video"
copy = (ROOT / "src" / "copy.ts").read_text(encoding="utf-8")
arg = lambda k, d: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
TAKES = int(arg("--takes", 4))
REF = arg("--ref", None)
# Yalnız seçili satırları yeniden üret: --only tr:02,en:04 (diğer süreler korunur)
ONLY = set(arg("--only", "").split(",")) - {""}
# Model "TAZQ"yu her seferinde farklı okuyor (Tazga/Tazka/Tazak); okunuşu yazıyla sabitle.
SPEAK = {"TAZQ'a o tarihi": "Tazk'a... o tarihi", "TAZQ. ": "Tazk... ", "TAZQ": "Tazk"}
# Hedef konuşma hızı (karakter/sn): sakin anlatım. Çok hızlı ya da sürünen aday cezalanır.
TARGET_CPS = {"tr": 13.0, "en": 14.0}


def lines(lang):
    block = re.search(rf"{lang}: \[(.*?)\n  \]", copy, re.S).group(1)
    return re.findall(r'id: "(\d+)", text: "(.*?)" \}', block)


def norm(s, lang):
    s = re.sub(r"(?i)\bta[sz][kq]\w*", "taz", s)
    s = s.lower() if lang == "en" else s.replace("I", "ı").replace("İ", "i").lower()
    s = unicodedata.normalize("NFC", s)
    return re.sub(r"[^\w]+", "", s)


def trim(wav, sr):
    amp = wav.abs().squeeze(0)
    idx = (amp > 0.01).nonzero().squeeze(-1)
    if not len(idx):
        return wav
    pad = int(0.08 * sr)
    return wav[:, max(0, idx[0] - pad) : idx[-1] + pad]


tts = ChatterboxMultilingualTTS.from_pretrained(device="cuda")
asr = WhisperModel("large-v3", device="cuda", compute_type="float16")
tmp = ROOT.parent / "tts" / "_take.wav"
tpath = ROOT / "src" / "timing.json"
timing = json.loads(tpath.read_text(encoding="utf-8")) if ONLY else {}
report = []
for lang in ("tr", "en"):
    out = ROOT / "public" / "audio" / lang
    out.mkdir(parents=True, exist_ok=True)
    timing.setdefault(lang, {})
    for id_, text in lines(lang):
        if ONLY and f"{lang}:{id_}" not in ONLY:
            continue
        spoken = text
        for k_, v_ in SPEAK.items():
            spoken = spoken.replace(k_, v_)
        best = None
        for k in range(TAKES):
            torch.manual_seed(1000 + k)
            kw = dict(language_id=lang, exaggeration=0.45, cfg_weight=0.35, temperature=0.75)
            if REF:
                kw["audio_prompt_path"] = REF
            wav = trim(tts.generate(spoken, **kw).cpu(), tts.sr)
            sf.write(str(tmp), wav.squeeze(0).numpy(), tts.sr)
            segs, _ = asr.transcribe(str(tmp), language=lang, beam_size=5)
            heard = " ".join(s.text for s in segs).strip()
            acc = SequenceMatcher(None, norm(text, lang), norm(heard, lang)).ratio()
            dur = wav.shape[1] / tts.sr
            pace = abs(len(text) / dur - TARGET_CPS[lang]) / TARGET_CPS[lang]
            score = acc - 0.4 * pace
            if best is None or score > best[0]:
                best = (score, wav, heard, acc, dur)
        score, wav, heard, acc, dur = best
        sf.write(str(out / f"{id_}.wav"), wav.squeeze(0).numpy(), tts.sr)
        timing[lang][id_] = round(dur, 3)
        report.append(f"{lang} {id_} acc={acc:.2f} {dur:.1f}s | {heard}")
        print(report[-1], flush=True)

tmp.unlink(missing_ok=True)
tpath.write_text(json.dumps(timing, indent=2), encoding="utf-8")
(ROOT.parent / "tts" / "report.txt").write_text("\n".join(report), encoding="utf-8")
print("timing yazıldı")
