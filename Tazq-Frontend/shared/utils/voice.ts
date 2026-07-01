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
  initialText?: string;
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

/**
 * Foolproof speech merge function that prevents duplicate repetition bugs
 * when voice engines restart or fire repeated partial/final hypotheses.
 */
function mergeSpeechText(existing: string, incoming: string): string {
  if (!existing || !existing.trim()) return incoming.trim();
  if (!incoming || !incoming.trim()) return existing.trim();

  const ext = existing.trim();
  const inc = incoming.trim();
  const extLower = ext.toLowerCase();
  const incLower = inc.toLowerCase();

  // 1. Exact match (e.g. repeated result upon restart)
  if (extLower === incLower) return ext;

  // 2. Incoming already starts with existing (e.g. continuous dictation return)
  if (incLower.startsWith(extLower)) {
    return inc;
  }

  // 3. Existing already ends with incoming (e.g. trailing word repetition)
  if (extLower.endsWith(incLower)) {
    return ext;
  }

  // 4. Check word overlap at boundary
  const extWords = ext.split(/\s+/);
  const incWords = inc.split(/\s+/);
  const maxOverlap = Math.min(extWords.length, incWords.length);

  for (let overlap = maxOverlap; overlap > 0; overlap--) {
    const extSuffix = extWords.slice(-overlap).join(' ').toLowerCase();
    const incPrefix = incWords.slice(0, overlap).join(' ').toLowerCase();
    if (extSuffix === incPrefix) {
      const remainingInc = incWords.slice(overlap).join(' ');
      return remainingInc ? `${ext} ${remainingInc}` : ext;
    }
  }

  // 5. No overlap found, concatenate seamlessly
  return `${ext} ${inc}`;
}

class VoiceService {
  private _isListening = false;
  private _options: VoiceOptions | null = null;
  private _ended = false;
  private _timeout: ReturnType<typeof setTimeout> | null = null;
  private _restartHandle: ReturnType<typeof setTimeout> | null = null;
  private _committedText = '';
  private _currentSessionText = '';

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

    const phrase = e.value?.[0]?.trim();
    if (!phrase) return;

    const merged = mergeSpeechText(this._committedText, phrase);
    this._currentSessionText = merged;
    this._options?.onResults?.([merged]);
  }

  private onSpeechPartialResults(e: any) {
    if (this._ended) return;
    const partial = e.value?.[0]?.trim();
    if (!partial || !this._options?.onResults) return;

    const merged = mergeSpeechText(this._committedText, partial);
    this._currentSessionText = merged;
    this._options.onResults([merged]);
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
    
    // Commit the text recognized up to the end of this session
    if (this._currentSessionText) {
      this._committedText = this._currentSessionText;
    }

    this._restartHandle = setTimeout(async () => {
      this._restartHandle = null;
      if (this._ended || !this._options) return;
      try {
        await Voice.start(lang);
      } catch {
        this._terminate();
      }
    }, 1000);
  }

  private _terminate() {
    if (this._ended) return;
    this._ended = true;
    this._isListening = false;
    if (this._timeout) { clearTimeout(this._timeout); this._timeout = null; }
    if (this._restartHandle) { clearTimeout(this._restartHandle); this._restartHandle = null; }
    const opts = this._options;
    this._options = null;
    this._committedText = '';
    this._currentSessionText = '';
    if (Voice) Voice.stop().catch(() => {});
    opts?.onEnded?.();
  }

  async start(options: VoiceOptions) {
    if (this._isListening) await this.stop();

    this._options = options;
    this._ended = false;
    this._committedText = options.initialText ? options.initialText.trim() : '';
    this._currentSessionText = this._committedText;

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
      if (this._timeout) { clearTimeout(this._timeout); this._timeout = null; }
      if (this._restartHandle) { clearTimeout(this._restartHandle); this._restartHandle = null; }
      this._options = null;
      this._committedText = '';
      this._currentSessionText = '';
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
