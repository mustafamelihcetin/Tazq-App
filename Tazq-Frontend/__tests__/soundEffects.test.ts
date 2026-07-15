import { playSoundEffect, activeSoundCount } from '@/shared/utils/soundEffects';
import { swallow } from '@/shared/utils/swallow';

jest.mock('@/shared/utils/swallow', () => ({ swallow: jest.fn() }));

const play = jest.fn();
const remove = jest.fn();
const release = jest.fn();
// jest.mock hoist edilir; factory yalnız `mock` önekli dış değişkene erişebilir.
const mockCreateAudioPlayer = jest.fn();

jest.mock('expo-audio', () => ({
  createAudioPlayer: (...args: unknown[]) => mockCreateAudioPlayer(...args),
}));

describe('playSoundEffect', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    // Gerçek AudioPlayer İKİSİNİ birden taşır: kendi remove()'u ve SharedObject'ten
    // miras release()'i. Varsayılan mock bu yüzden ikisini de sunar.
    mockCreateAudioPlayer.mockReturnValue({ volume: 0, play, remove, release });
  });
  afterEach(() => jest.useRealTimers());

  it('plays at the requested volume', () => {
    playSoundEffect(1, { context: 'test.play', volume: 0.5 });

    expect(mockCreateAudioPlayer).toHaveBeenCalledWith(1);
    expect(play).toHaveBeenCalled();
  });

  it('anchors the player while playing, then frees it', () => {
    const before = activeSoundCount();
    playSoundEffect(1, { context: 'test.play', releaseAfterMs: 3000 });

    // Çalarken çıpalanmalı — erken GC sesi kesmesin.
    expect(activeSoundCount()).toBe(before + 1);

    jest.advanceTimersByTime(3000);

    expect(remove).toHaveBeenCalled();
    expect(activeSoundCount()).toBe(before);
  });

  it('prefers remove() over release() when both exist', () => {
    playSoundEffect(1, { context: 'test.play', releaseAfterMs: 500 });
    jest.advanceTimersByTime(500);

    // KRİTİK: native'de ikisi aynı şey DEĞİL. remove() AudioPlayer'ın belgelenmiş
    // temizliği; release() SharedObject'ten miras ham çağrı ve o temizliği atlar.
    // Sıra ters çevrilirse ses kaynakları/lock screen kaydı düzgün bırakılmaz.
    expect(remove).toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
  });

  it('falls back to release() when remove() is unavailable', () => {
    mockCreateAudioPlayer.mockImplementationOnce(() => ({ volume: 0, play, release }));

    playSoundEffect(1, { context: 'test.play', releaseAfterMs: 500 });
    jest.advanceTimersByTime(500);

    expect(release).toHaveBeenCalled();
  });

  it('drops the anchor even when cleanup throws', () => {
    remove.mockImplementationOnce(() => { throw new Error('already removed'); });
    const before = activeSoundCount();

    playSoundEffect(1, { context: 'test.play', releaseAfterMs: 1000 });
    jest.advanceTimersByTime(1000);

    // Hata olsa da Set büyümemeli, yoksa oynatıcılar sonsuza dek birikir.
    expect(activeSoundCount()).toBe(before);
    expect(swallow).toHaveBeenCalledWith('test.play.release', expect.any(Error));
  });

  it('never throws when audio is unavailable', () => {
    mockCreateAudioPlayer.mockImplementationOnce(() => { throw new Error('no audio device'); });

    // Ses çalamamak kullanıcı akışını kesmemeli.
    expect(() => playSoundEffect(1, { context: 'test.play' })).not.toThrow();
    expect(swallow).toHaveBeenCalledWith('test.play', expect.any(Error));
  });

  it('reasserts volume when asked (play() resets it on some platforms)', () => {
    const player = { volume: 0, play, remove, release };
    mockCreateAudioPlayer.mockReturnValueOnce(player);

    playSoundEffect(1, { context: 'test.play', volume: 0.15, reassertVolumeAfterMs: 150 });
    player.volume = 0; // platformun sıfırlamasını taklit et
    jest.advanceTimersByTime(150);

    expect(player.volume).toBe(0.15);
  });
});
