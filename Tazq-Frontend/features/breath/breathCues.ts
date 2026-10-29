/**
 * Nefes seansının yol göstericileri — faz değişince kısa titreşim + (isteğe bağlı) yumuşak ton.
 *
 * Oynatıcılar seans başlarken HAZIRLANIR, faz anında yalnız çalınır (bkz. odak çanı:
 * çalma anında yaratmak/sarmak sesi geciktirip takılmasına yol açıyordu). Ton bitince
 * sessizken başa sarılır. Alış ve veriş ayrı tonlar: gözler kapalıyken bile hangi fazda
 * olunduğu duyulur. Tut/bekle fazları yalnız titreşir — ses sürekli konuşmasın.
 */
import type { AudioPlayer } from 'expo-audio';
import { haptic } from '@/shared/utils/haptics';
import { swallow } from '@/shared/utils/swallow';
import type { PhaseKind } from '@/features/breath/patterns';

const players: Partial<Record<'in' | 'out', AudioPlayer>> = {};

function make(key: 'in' | 'out'): AudioPlayer | null {
  if (players[key]) return players[key]!;
  try {
    const { createAudioPlayer } = require('expo-audio');
    const src = key === 'in' ? require('../../assets/sounds/breath_in.mp3') : require('../../assets/sounds/breath_out.mp3');
    const p = createAudioPlayer(src) as AudioPlayer;
    p.volume = 0.7;
    p.addListener('playbackStatusUpdate', (st) => {
      if (st.didJustFinish) {
        try { p.pause(); } catch (e) { swallow('breath.rearmPause', e); }
        p.seekTo(0).catch((e: unknown) => swallow('breath.rearm', e));
      }
    });
    players[key] = p;
    return p;
  } catch (e) {
    swallow('breath.preload', e);
    return null;
  }
}

export function preloadBreathCues(): void {
  make('in');
  make('out');
}

export function releaseBreathCues(): void {
  for (const k of ['in', 'out'] as const) {
    try { players[k]?.remove(); } catch (e) { swallow('breath.release', e); }
    delete players[k];
  }
}

/** Faz başında çağrılır. `top` (ikinci kısa alış) alış tonunu tekrarlamaz: tek nefesin parçası. */
export function cuePhase(kind: PhaseKind, sound: boolean): void {
  haptic.breath();
  if (!sound || kind === 'top' || kind === 'hold' || kind === 'rest') return;
  try { make(kind === 'in' ? 'in' : 'out')?.play(); } catch (e) { swallow('breath.play', e); }
}
