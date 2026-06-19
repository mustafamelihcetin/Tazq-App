import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import type { WatchData, WatchEvent } from './ExpoWatchConnectivity.types';

export * from './ExpoWatchConnectivity.types';

const LINKING_ERROR =
  'expo-watch-connectivity native module is not available. ' +
  'Make sure you are using a custom dev client (not Expo Go) and the module is linked.';

const WatchConnectivity =
  Platform.OS === 'ios' && NativeModules.ExpoWatchConnectivity
    ? NativeModules.ExpoWatchConnectivity
    : null;

let emitter: NativeEventEmitter | null = null;
if (WatchConnectivity) {
  emitter = new NativeEventEmitter(WatchConnectivity);
}

export async function isWatchSupported(): Promise<boolean> {
  if (!WatchConnectivity) return false;
  return WatchConnectivity.isWatchSupported();
}

export async function isWatchPaired(): Promise<boolean> {
  if (!WatchConnectivity) return false;
  return WatchConnectivity.isWatchPaired();
}

export async function isWatchReachable(): Promise<boolean> {
  if (!WatchConnectivity) return false;
  return WatchConnectivity.isWatchReachable();
}

export async function sendToWatch(data: WatchData): Promise<void> {
  if (!WatchConnectivity) {
    console.warn(LINKING_ERROR);
    return;
  }
  return WatchConnectivity.sendToWatch(data);
}

export async function updateApplicationContext(data: WatchData): Promise<void> {
  if (!WatchConnectivity) {
    console.warn(LINKING_ERROR);
    return;
  }
  return WatchConnectivity.updateApplicationContext(data);
}

export function addWatchListener(
  listener: (event: WatchEvent) => void
): () => void {
  if (!emitter) return () => {};

  const sub = emitter.addListener('onWatchEvent', listener);
  return () => sub.remove();
}
