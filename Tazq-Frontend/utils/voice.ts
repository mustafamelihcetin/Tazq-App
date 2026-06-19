import { NativeModules, Platform } from 'react-native';

const isNativeModuleAvailable = Platform.OS === 'web' || !!NativeModules.Voice;

let Voice: any = null;

if (isNativeModuleAvailable) {
  Voice = require('@react-native-voice/voice').default;
}

export interface VoiceOptions {
  language?: string;
  onResults?: (results: string[]) => void;
  onError?: (err: any) => void;
  onEnded?: () => void;
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
    }
  }

  private onSpeechResults(e: any) {
    if (this._ended) return;
    if (e.value && this._options?.onResults) {
      this._options.onResults(e.value);
    }
    // Auto-terminate after receiving results — prevents stuck state
    this._terminate();
  }

  private onSpeechError(e: any) {
    if (this._ended) return;
    const opts = this._options;
    this._terminate();
    if (opts?.onError) opts.onError(e.error ?? e);
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
    // Stop any prior session cleanly
    if (this._isListening) {
      await this.stop();
    }

    this._options = options;
    this._ended = false;

    if (!isNativeModuleAvailable) {
      console.warn('Voice recognition is not available. Use a custom dev client (expo run:ios / expo run:android) instead of Expo Go.');
      if (options.onError) {
        options.onError(new Error('Voice recognition is not supported in this environment.'));
      }
      return;
    }

    // Safety timeout: auto-stop after 12 seconds
    this._timeout = setTimeout(() => this._terminate(), 12000);

    try {
      this._isListening = true;
      await Voice.start(options.language || 'en-US');
    } catch (e) {
      console.error('Voice start error:', e);
      const opts = this._options;
      this._terminate();
      if (opts?.onError) opts.onError(e);
    }
  }

  async stop() {
    if (!this._isListening || !isNativeModuleAvailable) {
      // Still reset state even if not tracked as listening
      this._ended = true;
      this._isListening = false;
      if (this._timeout) { clearTimeout(this._timeout); this._timeout = null; }
      this._options = null;
      return;
    }
    this._terminate();
  }

  destroy() {
    if (!isNativeModuleAvailable || !Voice) return;
    this._terminate();
    Voice.destroy().then(() => {
      if (Voice.removeAllListeners) Voice.removeAllListeners();
    }).catch(() => {});
  }
}

export default new VoiceService();
