export interface WatchHabit {
  id: string;
  name: string;
  emoji: string;
  color: string;
  completedToday: boolean;
}

export interface WatchCountdown {
  name: string;
  daysLeft: number;
  type: 'exam' | 'tez' | 'mulakat';
  color: string;
}

export interface WatchData {
  habits: WatchHabit[];
  streak: number;
  bestStreak: number;
  focusActive: boolean;
  focusElapsedSeconds: number;
  focusTotalSeconds: number;
  countdown?: WatchCountdown;
  habitsCompletedToday: number;
  habitsTotal: number;
  language: 'tr' | 'en';
}

export interface WatchHabitCompletedEvent {
  habitId: string;
}

export interface WatchFocusEvent {
  action: 'start' | 'stop';
  durationMinutes?: number;
}

export type WatchEvent =
  | { type: 'habitCompleted'; data: WatchHabitCompletedEvent }
  | { type: 'focusAction'; data: WatchFocusEvent }
  | { type: 'reachabilityChanged'; data: { reachable: boolean } };
