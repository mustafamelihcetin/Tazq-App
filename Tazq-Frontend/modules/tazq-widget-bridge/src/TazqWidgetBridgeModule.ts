import { NativeModule, requireNativeModule } from 'expo';
import type { TazqWidgetBridgeEvents } from './TazqWidgetBridge.types';

declare class TazqWidgetBridgeModule extends NativeModule<TazqWidgetBridgeEvents> {
  updateSharedData(json: string): Promise<void>;
}

export default requireNativeModule<TazqWidgetBridgeModule>('TazqWidgetBridge');
