import { preloadCompletionChime, playCompletionChime, releaseCompletionChime } from '@/features/focus/completionChime';

jest.mock('@/shared/utils/swallow', () => ({ swallow: jest.fn() }));

const play = jest.fn();
const pause = jest.fn();
const seekTo = jest.fn(() => Promise.resolve());
const remove = jest.fn();
const mockCreateAudioPlayer = jest.fn();
let emit: (s: { playing?: boolean; didJustFinish?: boolean }) => void = () => {};
let fakePlayer: { currentTime: number };

jest.mock('expo-audio', () => ({
  createAudioPlayer: (...args: unknown[]) => mockCreateAudioPlayer(...args),
}));

describe('completionChime', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    releaseCompletionChime(); // önceki testin oynatıcısı sayaçlara karışmasın
    jest.clearAllMocks();
    mockCreateAudioPlayer.mockImplementation(() => {
      fakePlayer = {
        volume: 0, currentTime: 0, play, pause, seekTo, remove,
        addListener: (_: string, cb: typeof emit) => { emit = cb; },
      } as any;
      return fakePlayer;
    });
  });
  afterEach(() => jest.useRealTimers());

  it('bitiş anında oynatıcı YARATMAZ — önceden yüklenmiş olanı çalar', () => {
    preloadCompletionChime();
    playCompletionChime();
    expect(mockCreateAudioPlayer).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('preload tekrar çağrılınca ikinci oynatıcı açmaz', () => {
    preloadCompletionChime();
    preloadCompletionChime();
    expect(mockCreateAudioPlayer).toHaveBeenCalledTimes(1);
  });

  it('çalma anında SARMAZ — sarma+çalma yarışı sesi takıltıyordu', () => {
    preloadCompletionChime();
    playCompletionChime();
    expect(seekTo).not.toHaveBeenCalled();
  });

  it('çan bitince sessizce başa sarılıp hazır bekler', () => {
    preloadCompletionChime();
    playCompletionChime();
    emit({ didJustFinish: true });
    expect(pause).toHaveBeenCalled();
    expect(seekTo).toHaveBeenCalledWith(0);
  });

  it('imleç sondaysa önce sarar, sonra çalar', async () => {
    preloadCompletionChime();
    fakePlayer.currentTime = 1.2;
    playCompletionChime();
    expect(play).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('titreşim ses GERÇEKTEN başlayınca, bir kez gelir', () => {
    const onStart = jest.fn();
    preloadCompletionChime();
    playCompletionChime(onStart);
    expect(onStart).not.toHaveBeenCalled();
    emit({ playing: true });
    emit({ playing: true });
    jest.advanceTimersByTime(1000);
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('ses hiç başlamazsa titreşim yine gelir', () => {
    const onStart = jest.fn();
    preloadCompletionChime();
    playCompletionChime(onStart);
    jest.advanceTimersByTime(300);
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('oynatıcı hatası fırlatmaz; titreşim hemen gelir, sonraki seferde yeniden kurulur', () => {
    const onStart = jest.fn();
    preloadCompletionChime();
    play.mockImplementationOnce(() => { throw new Error('native'); });
    expect(() => playCompletionChime(onStart)).not.toThrow();
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
    preloadCompletionChime();
    expect(mockCreateAudioPlayer).toHaveBeenCalledTimes(2);
  });
});
