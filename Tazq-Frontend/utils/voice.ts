import { NativeModules, Platform, PermissionsAndroid } from 'react-native';

const isNativeModuleAvailable = Platform.OS !== 'web' && !!NativeModules.Voice;

let Voice: any = null;

if (isNativeModuleAvailable) {
  try {
    Voice = require('@react-native-voice/voice').default;
  } catch {
    // Module not linked — treat as unavailable
  }
}

export interface VoiceOptions {
  language?: string;
  onResults?: (results: string[]) => void;
  onError?: (err: any) => void;
  onEnded?: () => void;
}

async function requestAndroidMicPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'Mikrofon İzni / Microphone Permission',
        message:
          'Sesli görev girişi için mikrofon izni gereklidir.\nMicrophone permission is required for voice task input.',
        buttonPositive: 'Tamam / OK',
        buttonNegative: 'İptal / Cancel',
        buttonNeutral: 'Sonra Sor / Ask Later',
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

class VoiceService {
  private _isListening = false;
  private _options: VoiceOptions | null = null;
  private _ended = false;
  private _timeout: ReturnType<typeof setTimeout> | null = null;
  private _restartHandle: ReturnType<typeof setTimeout> | null = null;
  private _accumulated = '';
  // Accumulated text at the start of the current recognition session.
  // onSpeechResults replaces from this base so multiple results within
  // the same session overwrite each other instead of stacking.
  private _sessionBase = '';
  // True between onSpeechEnd and the next Voice.start().
  // Any onSpeechResults arriving in this window are late deliveries
  // from the closed session and must be discarded.
  private _restarting = false;

  constructor() {
    if (Voice) {
      Voice.onSpeechResults = this.onSpeechResults.bind(this);
      Voice.onSpeechError = this.onSpeechError.bind(this);
      Voice.onSpeechEnd = this.onSpeechEnd.bind(this);
      Voice.onSpeechPartialResults = this.onSpeechPartialResults.bind(this);
    }
  }

  private onSpeechResults(e: any) {
    if (this._ended) return;
    // Discard late arrivals from the just-closed session during restart window.
    if (this._restarting) return;

    const phrase = e.value?.[0]?.trim();
    if (!phrase) return;

    // Cross-session duplicate guard: Android sometimes re-recognizes the previous
    // session's audio in the first result of the new session.
    const ph = phrase.toLowerCase().trim();
    const base = this._sessionBase.toLowerCase().trim();
    if (base && (ph === base || base.endsWith(' ' + ph))) return;

    // Replace this session's contribution so multiple onSpeechResults within
    // one session converge to the latest (best) hypothesis instead of stacking.
    this._accumulated = this._sessionBase
      ? `${this._sessionBase} ${phrase}`
      : phrase;

    this._options?.onResults?.([this._accumulated]);
  }

  private onSpeechPartialResults(e: any) {
    if (this._ended || this._restarting) return;
    const partial = e.value?.[0]?.trim();
    if (!partial || !this._options?.onResults) return;
    const display = this._accumulated ? `${this._accumulated} ${partial}` : partial;
    this._options.onResults([display]);
  }

  private onSpeechError(e: any) {
    if (this._ended) return;
    const code = e?.error?.code ?? e?.code;
    // Android error 7 = "No match" — restart silently
    if (code === '7' || code === 7) {
      this._scheduleRestart();
      return;
    }
    const opts = this._options;
    this._terminate();
    opts?.onError?.(e.error ?? e);
  }

  private onSpeechEnd() {
    if (this._ended) return;
    this._scheduleRestart();
  }

  private _scheduleRestart() {
    if (this._ended || !this._options || this._restartHandle) return;
    const lang = this._options.language || 'tr-TR';
    // Capture the accumulated text that belongs to the session that just ended.
    const baseAtRestart = this._accumulated;
    // Mark restart window: onSpeechResults will discard anything arriving now.
    this._restarting = true;
    this._restartHandle = setTimeout(async () => {
      this._restartHandle = null;
      if (this._ended || !this._options) return;
      // Commit the new session base and clear the restart window.
      this._sessionBase = baseAtRestart;
      this._restarting = false;
      try {
        await Voice.start(lang);
      } catch {
        this._terminate();
      }
    }, 1200);
  }

  private _terminate() {
    if (this._ended) return;
    this._ended = true;
    this._isListening = false;
    this._restarting = false;
    if (this._timeout) { clearTimeout(this._timeout); this._timeout = null; }
    if (this._restartHandle) { clearTimeout(this._restartHandle); this._restartHandle = null; }
    const opts = this._options;
    this._options = null;
    this._accumulated = '';
    this._sessionBase = '';
    if (Voice) Voice.stop().catch(() => {});
    opts?.onEnded?.();
  }

  async start(options: VoiceOptions) {
    if (this._isListening) await this.stop();

    this._options = options;
    this._ended = false;
    this._restarting = false;
    this._accumulated = '';
    this._sessionBase = '';

    if (!isNativeModuleAvailable || !Voice) {
      options.onError?.(new Error('not-available'));
      return;
    }

    if (Platform.OS === 'android') {
      const granted = await requestAndroidMicPermission();
      if (!granted) {
        this._ended = true;
        this._options = null;
        options.onError?.(new Error('permission-denied'));
        return;
      }
    }

    this._timeout = setTimeout(() => this._terminate(), 60000);

    try {
      this._isListening = true;
      await Voice.start(options.language || 'tr-TR');
    } catch (e: any) {
      const opts = this._options;
      this._terminate();
      opts?.onError?.(e);
    }
  }

  async stop() {
    if (!Voice) {
      this._ended = true;
      this._isListening = false;
      this._restarting = false;
      if (this._timeout) { clearTimeout(this._timeout); this._timeout = null; }
      if (this._restartHandle) { clearTimeout(this._restartHandle); this._restartHandle = null; }
      this._options = null;
      this._accumulated = '';
      this._sessionBase = '';
      return;
    }
    this._terminate();
  }

  destroy() {
    if (!Voice) return;
    this._terminate();
    Voice.destroy().then(() => {
      if (Voice.removeAllListeners) Voice.removeAllListeners();
    }).catch(() => {});
  }
}

export default new VoiceService();
