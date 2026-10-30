/**
 * Nefes seansının yol göstericileri — faz değişince kısa titreşim + (isteğe bağlı) ses.
 *
 * SES FAZ BOYUNCA SÜRER (kullanıcı: "sesler nefes için tam uygun mu bilemedim"): ilk
 * sürüm kısa bir çan çalıyordu; çan "şimdi" der ama nefesin NE KADAR süreceğini söylemez.
 * Şimdiki ses fazın süresi kadar uzun bir "hava + ped" dalgası: alışta parlaklaşıp
 * yükselir, verişte koyulaşıp söner — nefes sese uydurulur, ekrana bakmak gerekmez.
 * Her faz süresinin kendi dosyası var (sesi germek perdeyi bozardı). Tut/bekle sessiz:
 * duraklama sessizliğin kendisi; yalnız titreşim fazın değiştiğini söyler.
 *
 * TEMALAR (kullanıcı: "daha tatlı sesler de olmalı, herkes sevmez"): Nefes (gerçek nefese yakın, tonsuz hava akışı),
 * Kalimba (alışta yükselen, verişte inen tatlı notalar), Sıcak (yumuşak akor). Hepsi faz
 * boyu; seçicide dokununca önizleme çalar.
 *
 * Oynatıcılar seans başlarken HAZIRLANIR, faz anında yalnız çalınır (bkz. odak çanı:
 * çalma anında yaratmak/sarmak sesi geciktirip takılmasına yol açıyordu).
 */
import type { AudioPlayer } from 'expo-audio';
import { haptic } from '@/shared/utils/haptics';
import { swallow } from '@/shared/utils/swallow';
import type { BreathPattern, PhaseKind } from '@/features/breath/patterns';

export type BreathSound = 'wave' | 'kalimba' | 'warm';
export const BREATH_SOUNDS: BreathSound[] = ['wave', 'kalimba', 'warm'];

// Metro yalnız statik require'ı paketler. Dosyalar: assets/sounds/breath/{tema}_{in|out}_{süre}.mp3
const SOURCES: Record<BreathSound, Record<string, number>> = {
  wave: {
    'in_1': require('../../assets/sounds/breath/wave_in_1.mp3'),
    'in_2': require('../../assets/sounds/breath/wave_in_2.mp3'),
    'in_4': require('../../assets/sounds/breath/wave_in_4.mp3'),
    'in_5.5': require('../../assets/sounds/breath/wave_in_5_5.mp3'),
    'out_4': require('../../assets/sounds/breath/wave_out_4.mp3'),
    'out_5.5': require('../../assets/sounds/breath/wave_out_5_5.mp3'),
    'out_6': require('../../assets/sounds/breath/wave_out_6.mp3'),
    'out_8': require('../../assets/sounds/breath/wave_out_8.mp3'),
  },
  kalimba: {
    'in_1': require('../../assets/sounds/breath/kalimba_in_1.mp3'),
    'in_2': require('../../assets/sounds/breath/kalimba_in_2.mp3'),
    'in_4': require('../../assets/sounds/breath/kalimba_in_4.mp3'),
    'in_5.5': require('../../assets/sounds/breath/kalimba_in_5_5.mp3'),
    'out_4': require('../../assets/sounds/breath/kalimba_out_4.mp3'),
    'out_5.5': require('../../assets/sounds/breath/kalimba_out_5_5.mp3'),
    'out_6': require('../../assets/sounds/breath/kalimba_out_6.mp3'),
    'out_8': require('../../assets/sounds/breath/kalimba_out_8.mp3'),
  },
  warm: {
    'in_1': require('../../assets/sounds/breath/warm_in_1.mp3'),
    'in_2': require('../../assets/sounds/breath/warm_in_2.mp3'),
    'in_4': require('../../assets/sounds/breath/warm_in_4.mp3'),
    'in_5.5': require('../../assets/sounds/breath/warm_in_5_5.mp3'),
    'out_4': require('../../assets/sounds/breath/warm_out_4.mp3'),
    'out_5.5': require('../../assets/sounds/breath/warm_out_5_5.mp3'),
    'out_6': require('../../assets/sounds/breath/warm_out_6.mp3'),
    'out_8': require('../../assets/sounds/breath/warm_out_8.mp3'),
  },
};

const keyOf = (kind: PhaseKind, sec: number): string | null =>
  kind === 'in' || kind === 'top' ? `in_${sec}` : kind === 'out' ? `out_${sec}` : null;

const players = new Map<string, AudioPlayer>();

function make(theme: BreathSound, k: string): AudioPlayer | null {
  const key = `${theme}:${k}`;
  if (players.has(key)) return players.get(key)!;
  const src = SOURCES[theme]?.[k];
  if (src == null) return null;
  try {
    const { createAudioPlayer } = require('expo-audio');
    const p = createAudioPlayer(src) as AudioPlayer;
    p.volume = 1; // seviye dosyada ayarlı (odak çanıyla eş); 0.75 iOS hoparlöründe duyulmuyordu
    p.addListener('playbackStatusUpdate', (st) => {
      if (st.didJustFinish) {
        try { p.pause(); } catch (e) { swallow('breath.rearmPause', e); }
        p.seekTo(0).catch((e: unknown) => swallow('breath.rearm', e));
      }
    });
    players.set(key, p);
    return p;
  } catch (e) {
    swallow('breath.preload', e);
    return null;
  }
}

/**
 * iOS: sessiz mod anahtarı açıkken de çalsın ve kullanıcının müziğini kesmesin. Odak ekranı
 * aynı ayarı yapıyor ama nefese başka yoldan da girilebilir — ekran kendi garantisini alır.
 */
export function ensureBreathAudioMode(): void {
  try {
    const { setAudioModeAsync } = require('expo-audio');
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'mixWithOthers' })
      .catch((e: unknown) => swallow('breath.audioMode', e));
  } catch (e) { swallow('breath.audioModeLoad', e); }
}

/** Seçilen ritmin ihtiyaç duyduğu sesleri hazırlar (3–4 kısa dosya). */
export function preloadBreathCues(p: BreathPattern, theme: BreathSound): void {
  for (const ph of p.phases) {
    const k = keyOf(ph.kind, ph.sec);
    if (k) make(theme, k);
  }
}

/** Seçicide temaya dokununca kısa önizleme (2 sn'lik alış). */
export function previewBreathSound(theme: BreathSound): void {
  hushBreathCues();
  try { make(theme, 'in_2')?.play(); } catch (e) { swallow('breath.preview', e); }
}

export function releaseBreathCues(): void {
  players.forEach((p) => { try { p.remove(); } catch (e) { swallow('breath.release', e); } });
  players.clear();
}

/** Duraklatınca çalan dalga hemen susar (faz yarıda kaldı; ses devam etmesin). */
export function hushBreathCues(): void {
  players.forEach((p) => {
    try { if (p.playing) { p.pause(); p.seekTo(0).catch((e: unknown) => swallow('breath.hushSeek', e)); } } catch (e) { swallow('breath.hush', e); }
  });
}

/** Faz başında çağrılır: titreşim her zaman, ses yalnız alış/verişte ve açıksa. */
export function cuePhase(kind: PhaseKind, sec: number, theme: BreathSound | null): void {
  haptic.breath();
  if (!theme) return;
  const k = keyOf(kind, sec);
  if (!k) return;
  try { make(theme, k)?.play(); } catch (e) { swallow('breath.play', e); }
}
