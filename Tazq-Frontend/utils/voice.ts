import { NativeModules, Platform } from 'react-native';

// Prevent crash in Expo Go / environments where the native module is not linked
const isNativeModuleAvailable = Platform.OS === 'web' || !!NativeModules.Voice;

let Voice: any = null;

if (isNativeModuleAvailable) {
  // Only require if available to prevent NativeEventEmitter from crashing
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

  constructor() {
    if (Voice) {
      Voice.onSpeechResults = this.onSpeechResults.bind(this);
      Voice.onSpeechError = this.onSpeechError.bind(this);
      Voice.onSpeechEnd = this.onSpeechEnd.bind(this);
    }
  }

  private onSpeechResults(e: any) {
    if (e.value && this._options?.onResults) {
      this._options.onResults(e.value);
    }
  }

  private onSpeechError(e: any) {
    if (this._options?.onError) {
      this._options.onError(e.error);
    }
    this._isListening = false;
  }

  private onSpeechEnd() {
    if (this._options?.onEnded) {
      this._options.onEnded();
    }
    this._isListening = false;
  }

  async start(options: VoiceOptions) {
    this._options = options;
    
    if (!isNativeModuleAvailable) {
      console.warn('Voice recognition is not available. Native module is missing. You need to use a custom dev client (expo run:ios / expo run:android) instead of Expo Go.');
      if (this._options.onError) {
        this._options.onError(new Error('Voice recognition is not supported in this environment.'));
      }
      return;
    }

    try {
      this._isListening = true;
      await Voice.start(options.language || 'en-US');
    } catch (e) {
      console.error('Voice start error:', e);
      this._isListening = false;
      if (this._options?.onError) {
        this._options.onError(e);
      }
    }
  }

  async stop() {
    if (!this._isListening || !isNativeModuleAvailable) return;
    try {
      await Voice.stop();
      this._isListening = false;
    } catch (e) {
      console.error('Voice stop error:', e);
    }
  }

  destroy() {
    if (!isNativeModuleAvailable || !Voice) return;
    Voice.destroy().then(() => {
      if (Voice.removeAllListeners) Voice.removeAllListeners();
    });
  }
}

export default new VoiceService();