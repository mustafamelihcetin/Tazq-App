/**
 * Tek seferlik ses efektlerinin ortak çalma yolu.
 *
 * Neden: aynı blok (createAudioPlayer → volume → play → setTimeout ile release →
 * activeAudioPlayers takibi) 6 dosyada kopyalanmıştı. Her kopya kendi
 * `activeAudioPlayers` Set'ini tanımlıyordu; yani "çalan sesler" diye tek bir
 * gerçeklik yoktu ve her yeni ses eklemek bloğu bir kez daha kopyalamak demekti.
 *
 * Set'in işlevi GC'ye karşı çıpa: oynatıcıya güçlü referans tutulmazsa ses bitmeden
 * toplanabilir. Bu yüzden korunuyor — ama artık tek ve paylaşılan.
 */

import { swallow } from './swallow';

// Çalmakta olan oynatıcılar. Tek kaynak: modül seviyesinde tek Set.
const activePlayers = new Set<unknown>();

type PlayOptions = {
  /** 0..1 arası ses seviyesi. */
  volume?: number;
  /** Oynatıcının serbest bırakılacağı süre (ms). Ses uzunluğundan büyük olmalı. */
  releaseAfterMs?: number;
  /**
   * Bazı platformlarda oynatıcı play() sırasında volume'u sıfırlıyor; bu durumda
   * seviyeyi kısa bir gecikmeyle yeniden uygulamak gerekiyor. Çağrı yerlerinde
   * elle yazılan `setTimeout(..., 150)` workaround'u buraya taşındı.
   */
  reassertVolumeAfterMs?: number;
  /** Sentry bağlamı — hangi çağrı yerinin başarısız olduğunu ayırt etmek için. */
  context: string;
};

/**
 * Ses efektini çalar ve süresi dolunca kaynağı bırakır.
 * Asla fırlatmaz: ses çalamamak kullanıcı akışını kesmemeli, ama iz bırakır.
 */
export function playSoundEffect(source: number, opts: PlayOptions): void {
  const { volume = 0.85, releaseAfterMs = 4000, reassertVolumeAfterMs, context } = opts;

  try {
    // require: expo-audio yalnız ses çalınacağı anda yüklensin (açılış süresi).
    const { createAudioPlayer } = require('expo-audio');
    const player = createAudioPlayer(source);
    player.volume = volume;
    activePlayers.add(player);
    player.play();

    if (reassertVolumeAfterMs != null) {
      setTimeout(() => {
        try {
          player.volume = volume;
        } catch (e) {
          swallow(`${context}.reassertVolume`, e);
        }
      }, reassertVolumeAfterMs);
    }

    setTimeout(() => {
      try {
        // remove() ÖNCE denenir, release() yalnız yedek.
        // İkisi aynı şey değil: remove() AudioPlayer'ın belgelenmiş temizliği
        // (oynatmayı durdurur, lock screen kaydını siler, kaynağı bırakır).
        // release() ise SharedObject'ten miras ham bir çağrı — expo-modules-core
        // dokümanı "çoğu durumda gerekmez, sonrasında nesnenin çağrıları hata verir"
        // diyor ve AudioPlayer'ın kendi temizliğini atlar. (Web'de release() zaten
        // remove()'a delege eder, yani bu sıralama her iki platformda da doğru.)
        if (typeof player.remove === 'function') player.remove();
        else if (typeof player.release === 'function') player.release();
      } catch (e) {
        swallow(`${context}.release`, e);
      } finally {
        activePlayers.delete(player); // Çıpayı her hâlükârda bırak — sızıntı olmasın.
      }
    }, releaseAfterMs);
  } catch (e) {
    swallow(context, e);
  }
}

/** Test/teşhis için: o an çıpalanmış oynatıcı sayısı. */
export function activeSoundCount(): number {
  return activePlayers.size;
}
