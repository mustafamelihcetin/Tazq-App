/**
 * Odak seansı bitiş çanı — önceden yüklenmiş tek oynatıcı.
 *
 * Neden: çan bitiş anında `createAudioPlayer` ile YARATILIYORDU. Dosyanın çözülüp
 * yüklenmesi cihaza göre 100–400 ms sürüyor; titreşim ve ritüel animasyonu ise
 * hemen başlıyordu. Ses görselden kopuk, düşük donanımda belirgin geç geliyordu.
 * Oynatıcı seans başlarken hazırlanır; bitişte yalnız başa sarılıp çalınır, böylece
 * ses, titreşim ve ilk animasyon karesi aynı tıkta tetiklenir.
 */

import type { AudioPlayer } from 'expo-audio';
import { swallow } from '@/shared/utils/swallow';

const VOLUME = 0.8;
let player: AudioPlayer | null = null;

function ensurePlayer(): AudioPlayer | null {
  if (player) return player;
  try {
    // require: expo-audio yalnız gerektiğinde yüklensin (açılış süresi).
    const { createAudioPlayer } = require('expo-audio');
    player = createAudioPlayer(require('../../assets/sounds/focus_done.mp3')) as AudioPlayer;
    player.volume = VOLUME;
  } catch (e) {
    swallow('focus.chimePreload', e);
    player = null;
  }
  return player;
}

/** Seans başlarken çağrılır; tekrar çağrılması zararsızdır. */
export function preloadCompletionChime(): void {
  ensurePlayer();
}

/** Bitiş anında çağrılır. Asla fırlatmaz. */
export function playCompletionChime(): void {
  const p = ensurePlayer();
  if (!p) return;
  try {
    p.volume = VOLUME;
    // Önceki seansta çaldıysa imleç sonda kalır; başa sarmadan play() sessiz geçer.
    p.seekTo(0).catch((e: unknown) => swallow('focus.chimeSeek', e));
    p.play();
  } catch (e) {
    swallow('focus.chimePlay', e);
    releaseCompletionChime(); // Bozuk oynatıcı bir sonrakinde yeniden kurulur.
  }
}

/** Ekrandan çıkışta çalanı susturur ve kaynağı bırakır. */
export function releaseCompletionChime(): void {
  if (!player) return;
  const p = player;
  player = null;
  try { p.pause(); } catch (e) { swallow('focus.chimePause', e); }
  try { p.remove(); } catch (e) { swallow('focus.chimeRelease', e); }
}
