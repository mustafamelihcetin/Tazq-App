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
    if (e.value?.length && this._options?.onResults) {
      this._options.onResults(e.value);
    }
    this._terminate();
  }

  private onSpeechPartialResults(e: any) {
    // On Android, partial results fire continuously — pass them through so UI feels responsive
    if (this._ended) return;
    if (e.value?.length && this._options?.onResults) {
      this._options.onResults(e.value);
    }
  }

  private onSpeechError(e: any) {
    if (this._ended) return;
    const opts = this._options;
    this._terminate();
    if (opts?.onError) {
      const code = e?.error?.code ?? e?.code;
      // Android error 7 = "No match" — treat as empty, not a crash
      if (code === '7' || code === 7) {
        opts.onEnded?.();
        return;
      }
      opts.onError(e.error ?? e);
    }
  }

  private onSpeechEnd() {
    this._terminate();
  }

  private _terminate() {
    if (this._ended) return;
    this._ended = true;
    this._isListening = false;
    if (this._timeout) { clearTimeout(this._timeout); this._timeout = null; }
    const opts = this._options;
    this._options = null;
    if (Voice) Voice.stop().catch(() => {});
    if (opts?.onEnded) opts.onEnded();
  }

  async start(options: VoiceOptions) {
    if (this._isListening) await this.stop();

    this._options = options;
    this._ended = false;

    if (!isNativeModuleAvailable || !Voice) {
      if (options.onError) {
        options.onError(new Error('not-available'));
      }
      return;
    }

    // Runtime permission on Android (required for API 23+)
    if (Platform.OS === 'android') {
      const granted = await requestAndroidMicPermission();
      if (!granted) {
        const opts = this._options;
        this._ended = true;
        this._options = null;
        if (opts?.onError) opts.onError(new Error('permission-denied'));
        return;
      }
    }

    // Safety timeout: auto-stop after 15 seconds
    this._timeout = setTimeout(() => this._terminate(), 15000);

    try {
      this._isListening = true;
      await Voice.start(options.language || 'tr-TR');
    } catch (e: any) {
      const opts = this._options;
      this._terminate();
      if (opts?.onError) opts.onError(e);
    }
  }

  async stop() {
    if (!this._isListening || !Voice) {
      this._ended = true;
      this._isListening = false;
      if (this._timeout) { clearTimeout(this._timeout); this._timeout = null; }
      this._options = null;
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
