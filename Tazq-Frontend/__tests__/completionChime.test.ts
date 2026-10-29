import { preloadCompletionChime, playCompletionChime, releaseCompletionChime } from '@/features/focus/completionChime';

jest.mock('@/shared/utils/swallow', () => ({ swallow: jest.fn() }));

const play = jest.fn();
const pause = jest.fn();
const seekTo = jest.fn(() => Promise.resolve());
const remove = jest.fn();
const mockCreateAudioPlayer = jest.fn();

jest.mock('expo-audio', () => ({
  createAudioPlayer: (...args: unknown[]) => mockCreateAudioPlayer(...args),
}));

describe('completionChime', () => {
  beforeEach(() => {
    releaseCompletionChime(); // önceki testin oynatıcısı sayaçlara karışmasın
    jest.clearAllMocks();
    mockCreateAudioPlayer.mockImplementation(() => ({ volume: 0, play, pause, seekTo, remove }));
  });

  it('bitiş anında oynatıcı YARATMAZ — önceden yüklenmiş olanı çalar (yarışın kaynağı buydu)', () => {
    preloadCompletionChime();
    expect(mockCreateAudioPlayer).toHaveBeenCalledTimes(1);
    playCompletionChime();
    expect(mockCreateAudioPlayer).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('preload tekrar çağrılınca ikinci oynatıcı açmaz', () => {
    preloadCompletionChime();
    preloadCompletionChime();
    expect(mockCreateAudioPlayer).toHaveBeenCalledTimes(1);
  });

  it('ikinci seansta baştan çalar', () => {
    preloadCompletionChime();
    playCompletionChime();
    playCompletionChime();
    expect(seekTo).toHaveBeenLastCalledWith(0);
    expect(play).toHaveBeenCalledTimes(2);
  });

  it('preload hiç yapılmadıysa yine çalar (geç açılış)', () => {
    playCompletionChime();
    expect(mockCreateAudioPlayer).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('release sonrası yeniden yükler; oynatıcı hatası fırlatmaz', () => {
    preloadCompletionChime();
    releaseCompletionChime();
    expect(remove).toHaveBeenCalledTimes(1);
    play.mockImplementationOnce(() => { throw new Error('native'); });
    expect(() => playCompletionChime()).not.toThrow();
    expect(mockCreateAudioPlayer).toHaveBeenCalledTimes(2);
  });
});
