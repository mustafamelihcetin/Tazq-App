import { Platform, AppState } from 'react-native';
import Constants from 'expo-constants';

const isExpoGo = Constants.appOwnership === 'expo';
const FOCUS_NOTIF_ID = 'tazq-focus-live';

let Notifications: any = null;
try {
  Notifications = require('expo-notifications');
  if (Notifications?.setNotificationHandler) {
    Notifications.setNotificationHandler({
      handleNotification: async (notification: any) => {
        const isFocusNotif = notification?.request?.identifier === FOCUS_NOTIF_ID;
        const isBackground = AppState.currentState !== 'active';
        return {
          // Focus notifications only banner when app is backgrounded
          shouldShowAlert: isFocusNotif ? isBackground : true,
          shouldPlaySound: isFocusNotif ? false : true,
          shouldSetBadge: false,
        };
      },
    });
  }
} catch (_) {}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (!Notifications) return false;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch (_) {
    return false;
  }
}

export async function scheduleTaskNotification(
  taskId: number,
  title: string,
  dueDate?: string | null,
  dueTime?: string | null,
  locale: string = 'en'
): Promise<string | null> {
  if (!Notifications) return null;
  try {
    const isTR = locale === 'tr';
    let triggerDate: Date | null = null;

    if (dueTime) {
      triggerDate = new Date(dueTime);
      if (dueDate) {
        const d = new Date(dueDate);
        triggerDate.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
      }
    } else if (dueDate) {
      triggerDate = new Date(dueDate);
      triggerDate.setHours(9, 0, 0, 0);
    }

    if (!triggerDate || triggerDate <= new Date()) return null;

    const id = `task-${taskId}`;
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title: isTR ? '⏰ Görev Hatırlatıcısı' : '⏰ Task Reminder',
        body: title,
        data: { taskId },
        sound: true,
      },
      trigger: {
        type: 'date',
        date: triggerDate,
      } as any,
    });
    return id;
  } catch (_) {
    return null;
  }
}

export async function cancelTaskNotification(taskId: number): Promise<void> {
  if (!Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(`task-${taskId}`);
  } catch (_) {}
}

export async function scheduleShutdownNotification(
  pendingCount: number,
  locale: string = 'en'
): Promise<void> {
  if (!Notifications || isExpoGo || pendingCount === 0) return;
  try {
    const isTR = locale.startsWith('tr');
    const trigger = new Date();
    trigger.setHours(21, 0, 0, 0);
    if (trigger <= new Date()) {
      trigger.setDate(trigger.getDate() + 1);
    }
    await Notifications.cancelScheduledNotificationAsync('daily-shutdown').catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: 'daily-shutdown',
      content: {
        title: isTR ? '📋 Günlük Özet' : '📋 Daily Summary',
        body: isTR ? `${pendingCount} bekleyen görevin var.` : `You have ${pendingCount} pending task${pendingCount > 1 ? 's' : ''}.`,
        sound: true,
      },
      trigger: {
        type: 'date',
        date: trigger,
      } as any,
    });
  } catch (_) {}
}

export async function cancelAllNotifications(): Promise<void> {
  if (!Notifications) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (_) {}
}

export async function showFocusNotification(
  taskName: string,
  secondsRemaining: number,
  locale: string = 'en'
): Promise<void> {
  if (!Notifications) return;
  try {
    const isTR = locale === 'tr';
    const m = Math.floor(secondsRemaining / 60);
    const s = secondsRemaining % 60;
    const timeStr = `${m}:${s.toString().padStart(2, '0')}`;
    const label = taskName || (isTR ? 'Odak' : 'Focus');

    await Notifications.dismissNotificationAsync(FOCUS_NOTIF_ID).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: FOCUS_NOTIF_ID,
      content: {
        title: isTR ? '🎯 Derin Odak Aktif' : '🎯 Deep Focus Active',
        body: `${label} · ${timeStr} ${isTR ? 'kaldı' : 'remaining'}`,
        sound: false,
        sticky: true,
        data: { type: 'focus' },
      },
      trigger: null,
    });
  } catch (_) {}
}

export async function cancelFocusNotification(): Promise<void> {
  if (!Notifications) return;
  try {
    await Notifications.dismissNotificationAsync(FOCUS_NOTIF_ID).catch(() => {});
    await Notifications.cancelScheduledNotificationAsync(FOCUS_NOTIF_ID).catch(() => {});
  } catch (_) {}
}

export async function scheduleWeeklySummary(
  momentumScore: number,
  streak: number,
  locale: string = 'tr'
): Promise<void> {
  if (!Notifications || isExpoGo) return;
  try {
    const isTR = locale === 'tr';
    const emoji = momentumScore >= 75 ? '🔥' : momentumScore >= 40 ? '⚡' : '💪';
    const title = isTR ? `${emoji} Haftalık Momentum: ${momentumScore}` : `${emoji} Weekly Momentum: ${momentumScore}`;
    const streakLine = streak > 0
      ? (isTR ? ` · ${streak} günlük serin devam ediyor!` : ` · ${streak}-day streak going!`)
      : '';
    const body = isTR
      ? `Bu hafta nasıl geçti? Tazq'ya bak ve yeni haftayı planla.${streakLine}`
      : `How was your week? Check Tazq and plan the next one.${streakLine}`;

    // Next Sunday at 20:00
    const now = new Date();
    const daysUntilSunday = (7 - now.getDay()) % 7 || 7;
    const trigger = new Date(now);
    trigger.setDate(now.getDate() + daysUntilSunday);
    trigger.setHours(20, 0, 0, 0);

    await Notifications.cancelScheduledNotificationAsync('weekly-summary').catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: 'weekly-summary',
      content: { title, body, sound: true },
      trigger: { type: 'date', date: trigger } as any,
    });
  } catch (_) {}
}

export async function cancelWeeklySummary(): Promise<void> {
  if (!Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync('weekly-summary');
  } catch (_) {}
}
