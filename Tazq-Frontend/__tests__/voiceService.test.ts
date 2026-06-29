/**
 * VoiceService tests
 *
 * Uses jest.isolateModules so utils/voice.ts is loaded fresh with
 * NativeModules.Voice already set, making isNativeModuleAvailable = true.
 */

const mockVoice = {
  start: jest.fn().mockResolvedValue(undefined),
  stop: jest.fn().mockResolvedValue(undefined),
  destroy: jest.fn().mockResolvedValue(undefined),
  removeAllListeners: jest.fn(),
  // These are assigned by VoiceService constructor; calling them triggers the real handlers
  onSpeechResults: undefined as any,
  onSpeechError: undefined as any,
  onSpeechEnd: undefined as any,
  onSpeechPartialResults: undefined as any,
};

let VoiceService: any;

beforeAll(() => {
  // Load voice.ts in isolation so NativeModules.Voice is already set
  jest.isolateModules(() => {
    // Make Voice native module appear linked
    const { NativeModules } = require('react-native');
    if (!NativeModules.Voice) NativeModules.Voice = {};

    // Wire up the mock voice module
    jest.doMock('@react-native-voice/voice', () => ({ default: mockVoice }));

    // Load fresh — constructor runs here and sets mockVoice.onSpeech* handlers
    VoiceService = require('../utils/voice').default;
  });
});

function resetService() {
  if (!VoiceService) return;
  (VoiceService as any)._isListening = false;
  (VoiceService as any)._ended = false;
  (VoiceService as any)._options = null;
  if ((VoiceService as any)._timeout) {
    clearTimeout((VoiceService as any)._timeout);
    (VoiceService as any)._timeout = null;
  }
  // Doğal bitişte kurulan yeniden-başlatma zamanlayıcısını da temizle; aksi halde
  // 1 sn'lik setTimeout test bittikten sonra ateşlenip worker'ı sızdırır.
  if ((VoiceService as any)._restartHandle) {
    clearTimeout((VoiceService as any)._restartHandle);
    (VoiceService as any)._restartHandle = null;
  }
}

beforeEach(() => {
  mockVoice.start.mockClear();
  mockVoice.stop.mockClear();
  mockVoice.start.mockResolvedValue(undefined);
  mockVoice.stop.mockResolvedValue(undefined);
  resetService();
});

// Son testte kurulan zamanlayıcının suite bittikten sonra sızmaması için her testten
// SONRA da temizle (beforeEach yalnız bir sonraki testten önce çalışır).
afterEach(() => {
  resetService();
});

describe('VoiceService', () => {
  describe('start()', () => {
    it('calls Voice.start with the given language', async () => {
      await VoiceService.start({ language: 'tr-TR' });
      expect(mockVoice.start).toHaveBeenCalledWith('tr-TR');
    });

    it('defaults to tr-TR when no language specified', async () => {
      await VoiceService.start({});
      expect(mockVoice.start).toHaveBeenCalledWith('tr-TR');
    });

    it('sets _isListening to true after successful start', async () => {
      await VoiceService.start({ language: 'tr-TR' });
      expect((VoiceService as any)._isListening).toBe(true);
    });
  });

  describe('speech results', () => {
    it('fires onResults when speech results arrive', async () => {
      const onResults = jest.fn();
      await VoiceService.start({ language: 'tr-TR', onResults });
      mockVoice.onSpeechResults?.({ value: ['merhaba dünya'] });
      expect(onResults).toHaveBeenCalledWith(['merhaba dünya']);
    });

    it('fires onResults for partial results (live feedback)', async () => {
      const onResults = jest.fn();
      await VoiceService.start({ language: 'tr-TR', onResults });
      mockVoice.onSpeechPartialResults?.({ value: ['merha'] });
      expect(onResults).toHaveBeenCalledWith(['merha']);
    });

    it('does not fire onResults when value is empty', async () => {
      const onResults = jest.fn();
      await VoiceService.start({ language: 'tr-TR', onResults });
      mockVoice.onSpeechPartialResults?.({ value: [] });
      expect(onResults).not.toHaveBeenCalled();
    });

    it('calls onEnded after stop is called', async () => {
      const onEnded = jest.fn();
      await VoiceService.start({ language: 'tr-TR', onEnded });
      await VoiceService.stop();
      expect(onEnded).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('treats Android error code 7 ("No match") as silent restart, not crash', async () => {
      const onError = jest.fn();
      const onEnded = jest.fn();
      await VoiceService.start({ language: 'tr-TR', onError, onEnded });
      mockVoice.onSpeechError?.({ error: { code: '7' } });
      expect(onError).not.toHaveBeenCalled();
      expect(onEnded).not.toHaveBeenCalled();
    });

    it('treats numeric error code 7 the same as string "7"', async () => {
      const onError = jest.fn();
      const onEnded = jest.fn();
      await VoiceService.start({ language: 'tr-TR', onError, onEnded });
      mockVoice.onSpeechError?.({ error: { code: 7 } });
      expect(onError).not.toHaveBeenCalled();
      expect(onEnded).not.toHaveBeenCalled();
    });

    it('fires onError for non-7 error codes', async () => {
      const onError = jest.fn();
      await VoiceService.start({ language: 'tr-TR', onError });
      mockVoice.onSpeechError?.({ error: { code: '3', message: 'Audio recording error' } });
      expect(onError).toHaveBeenCalled();
    });

    it('does not double-fire events after session ends', async () => {
      const onEnded = jest.fn();
      await VoiceService.start({ language: 'tr-TR', onEnded });
      await VoiceService.stop();
      // Any spurious result after session ends must be ignored
      mockVoice.onSpeechResults?.({ value: ['world'] });
      expect(onEnded).toHaveBeenCalledTimes(1);
    });
  });

  describe('stop()', () => {
    it('calls Voice.stop', async () => {
      await VoiceService.start({ language: 'tr-TR' });
      await VoiceService.stop();
      expect(mockVoice.stop).toHaveBeenCalled();
    });

    it('sets _isListening to false after stop', async () => {
      await VoiceService.start({ language: 'tr-TR' });
      await VoiceService.stop();
      expect((VoiceService as any)._isListening).toBe(false);
    });

    it('is safe to call when not already listening', async () => {
      await expect(VoiceService.stop()).resolves.not.toThrow();
    });
  });

  describe('onSpeechEnd', () => {
    it('schedules restart when speech ends naturally', async () => {
      const onEnded = jest.fn();
      await VoiceService.start({ language: 'tr-TR', onEnded });
      mockVoice.onSpeechEnd?.({});
      expect(onEnded).not.toHaveBeenCalled();
      // Doğal bitiş yeniden-başlatma zamanlar: servis _restartHandle kurar (onEnded YOK).
      expect((VoiceService as any)._restartHandle).not.toBeNull();
    });
  });
});
