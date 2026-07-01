import { Platform } from 'react-native';
import {
  updateApplicationContext,
  addWatchListener,
  isWatchPaired,
  WatchData,
} from '../../modules/expo-watch-connectivity/src';

export type { WatchData };

let removeListener: (() => void) | null = null;

export interface WatchEventHandlers {
  onHabitCompleted?: (habitId: string) => void;
  onFocusStart?: (durationMinutes: number) => void;
  onFocusStop?: () => void;
}

export function initWatchBridge(handlers: WatchEventHandlers): () => void {
  if (Platform.OS !== 'ios') return () => {};

  removeListener?.();
  removeListener = addWatchListener((event) => {
    if (event.type === 'habitCompleted') {
      handlers.onHabitCompleted?.(event.data.habitId);
    } else if (event.type === 'focusAction') {
      if (event.data.action === 'start') {
        handlers.onFocusStart?.(event.data.durationMinutes ?? 25);
      } else {
        handlers.onFocusStop?.();
      }
    }
  });

  return () => {
    removeListener?.();
    removeListener = null;
  };
}

export async function syncToWatch(data: WatchData): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try {
    const paired = await isWatchPaired();
    if (!paired) return;
    await updateApplicationContext(data);
  } catch {
    // Silent — watch sync is best-effort
  }
}
