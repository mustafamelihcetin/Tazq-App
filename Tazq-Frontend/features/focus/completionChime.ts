/**
 * Odak seansı bitiş çanı — önceden yüklenmiş tek oynatıcı.
 *
 * Neden: çan bitiş anında `createAudioPlayer` ile YARATILIYORDU. Dosyanın çözülüp
 * yüklenmesi cihaza göre 100–400 ms sürüyor; titreşim ve ritüel animasyonu ise
 * hemen başlıyordu. Ses görselden kopuk, düşük donanımda belirgin geç geliyordu.
 * Oynatıcı seans başlarken hazırlanır; bitişte yalnız çalınır.
 *
 * Çalma anında SARMA YOK: `seekTo(0)` + `play()` art arda çağrılınca sarma, oynatma
 * başladıktan sonra tamamlanıyor ve ses takılıyordu (Huawei Y6'da duyuldu). Çan
 * bitince sessizce başa sarılıp bir sonraki sefere hazır bekler.
 *
 * Titreşim oynatıcı GERÇEKTEN çalmaya başladığında tetiklenir (`onStart`): `play()`
 * çağrısı ile sesin hoparlöre ulaşması arasında cihaza özgü bir gecikme var.
 */

import type { AudioPlayer } from 'expo-audio';
import { swallow } from '@/shared/utils/swallow';

const VOLUME = 0.8;
/** Oynatıcı hiç "çalıyor" demezse titreşim yine de bu süre sonunda gelir. */
const START_FALLBACK_MS = 300;

let player: AudioPlayer | null = null;
let pendingStart: { fire: () => void } | null = null;

function ensurePlayer(): AudioPlayer | null {
  if (player) return player;
  try {
    // require: expo-audio yalnız gerektiğinde yüklensin (açılış süresi).
    const { createAudioPlayer } = require('expo-audio');
    const p = createAudioPlayer(require('../../assets/sounds/focus_done.mp3')) as AudioPlayer;
    p.volume = VOLUME;
    p.addListener('playbackStatusUpdate', (status) => {
      if (status.playing) pendingStart?.fire();
      if (status.didJustFinish) {
        // Bir sonraki bitişe hazır: sarma şimdi, sessizken yapılır.
        try { p.pause(); } catch (e) { swallow('focus.chimeRearmPause', e); }
        p.seekTo(0).catch((e: unknown) => swallow('focus.chimeRearm', e));
      }
    });
    player = p;
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

/**
 * Bitiş anında çağrılır. Asla fırlatmaz.
 * @param onStart Ses gerçekten başladığında bir kez çağrılır (titreşim için);
 *                ses çalamazsa da çağrılır — titreşim kaybolmaz.
 */
export function playCompletionChime(onStart?: () => void): void {
  let fired = false;
  const fire = () => {
    if (fired) return;
    fired = true;
    pendingStart = null;
    clearTimeout(fallback);
    onStart?.();
  };
  const fallback = setTimeout(fire, START_FALLBACK_MS);
  pendingStart = { fire };

  const p = ensurePlayer();
  if (!p) { fire(); return; }
  try {
    p.volume = VOLUME;
    if (p.currentTime > 0.05) {
      // Yeniden kurma kaçmışsa (ör. çan yarıda kesildi): önce sar, SONRA çal.
      p.seekTo(0).then(() => p.play()).catch((e: unknown) => { swallow('focus.chimeSeek', e); fire(); });
    } else {
      p.play();
    }
  } catch (e) {
    swallow('focus.chimePlay', e);
    fire();
    releaseCompletionChime(); // Bozuk oynatıcı bir sonrakinde yeniden kurulur.
  }
}

/** Ekrandan çıkışta çalanı susturur ve kaynağı bırakır. */
export function releaseCompletionChime(): void {
  pendingStart = null;
  if (!player) return;
  const p = player;
  player = null;
  try { p.pause(); } catch (e) { swallow('focus.chimePause', e); }
  try { p.remove(); } catch (e) { swallow('focus.chimeRelease', e); }
}
