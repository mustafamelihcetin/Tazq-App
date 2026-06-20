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
          shouldShowAlert: isFocusNotif ? isBackground : true,
          shouldPlaySound: isFocusNotif ? false : true,
          shouldSetBadge: false,
        };
      },
    });
  }
} catch (_) {}

// ─── Categories ───────────────────────────────────────────────────────────────

export async function registerNotificationCategories(): Promise<void> {
  if (!Notifications?.setNotificationCategoryAsync) return;
  try {
    // Morning brief — start focus or open tasks
    await Notifications.setNotificationCategoryAsync('morning-brief', [
      {
        identifier: 'start-focus',
        buttonTitle: '▶️ Odak Başlat',
        options: { opensAppToForeground: true },
      },
      {
        identifier: 'open-tasks',
        buttonTitle: '📋 Görevler',
        options: { opensAppToForeground: true },
      },
    ]);

    // Task due reminder — complete or view
    await Notifications.setNotificationCategoryAsync('task-reminder', [
      {
        identifier: 'task-complete',
        buttonTitle: '✅ Tamamla',
        options: { opensAppToForeground: false },
      },
      {
        identifier: 'open-tasks',
        buttonTitle: '➡️ Göreve Git',
        options: { opensAppToForeground: true },
      },
    ]);

    // Habit reminder — Watch & Lock Screen actions
    await Notifications.setNotificationCategoryAsync('habit-reminder', [
      {
        identifier: 'habit-complete',
        buttonTitle: '✅ Tamamladım',
        options: { opensAppToForeground: false },
      },
      {
        identifier: 'habit-skip',
        buttonTitle: '⏭ Geç',
        options: { opensAppToForeground: false, isDestructive: true },
      },
    ]);

    // Habit at-risk streak warning
    await Notifications.setNotificationCategoryAsync('habit-risk', [
      {
        identifier: 'open-cockpit',
        buttonTitle: '💪 Alışkanlıklara Git',
        options: { opensAppToForeground: true },
      },
    ]);

    // Focus active — stop from notification
    await Notifications.setNotificationCategoryAsync('focus-active', [
      {
        identifier: 'focus-stop',
        buttonTitle: '⏹ Durdur',
        options: { opensAppToForeground: false, isDestructive: true },
      },
    ]);

    // Exam countdown — open plan
    await Notifications.setNotificationCategoryAsync('exam-countdown', [
      {
        identifier: 'exam-open',
        buttonTitle: '📋 Planı Görüntüle',
        options: { opensAppToForeground: true },
      },
    ]);

    // Evening summary / weekly review — open tasks
    await Notifications.setNotificationCategoryAsync('daily-summary', [
      {
        identifier: 'open-tasks',
        buttonTitle: '📋 Görevleri Aç',
        options: { opensAppToForeground: true },
      },
    ]);
  } catch (_) {}
}

// ─── Permissions ──────────────────────────────────────────────────────────────

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

// ─── Morning Brief (08:00 daily) ─────────────────────────────────────────────
// Smart: fires only if there are tasks today. Gives streak context.

export async function scheduleMorningBrief(
  todayTaskCount: number,
  streak: number,
  locale: string = 'en'
): Promise<void> {
  if (!Notifications || isExpoGo) return;
  try {
    const isTR = locale === 'tr';

    await Notifications.cancelScheduledNotificationAsync('morning-brief').catch(() => {});

    // Don't schedule if nothing to show
    if (todayTaskCount === 0 && streak === 0) return;

    const trigger = new Date();
    trigger.setHours(8, 0, 0, 0);
    if (trigger <= new Date()) {
      trigger.setDate(trigger.getDate() + 1);
    }

    const streakLine = streak > 1
      ? (isTR ? ` · 🔥 ${streak} günlük seri` : ` · 🔥 ${streak}-day streak`)
      : '';

    const body = todayTaskCount > 0
      ? (isTR
          ? `Bugün ${todayTaskCount} görevin var.${streakLine}`
          : `You have ${todayTaskCount} task${todayTaskCount > 1 ? 's' : ''} today.${streakLine}`)
      : (isTR ? `Serin devam ediyor.${streakLine}` : `Keep the streak alive.${streakLine}`);

    await Notifications.scheduleNotificationAsync({
      identifier: 'morning-brief',
      content: {
        title: isTR ? 'Günaydın' : 'Good morning',
        body,
        sound: true,
        categoryIdentifier: 'morning-brief',
      },
      trigger: {
        type: 'daily',
        hour: 8,
        minute: 0,
        repeats: true,
      } as any,
    });
  } catch (_) {}
}

export async function cancelMorningBrief(): Promise<void> {
  if (!Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync('morning-brief');
  } catch (_) {}
}

// ─── Evening Summary (21:00 daily) ───────────────────────────────────────────
// Replaces old shutdownNotification. Shows real completion context.

export async function scheduleEveningBrief(
  completedToday: number,
  pendingTotal: number,
  locale: string = 'en'
): Promise<void> {
  if (!Notifications || isExpoGo || (completedToday === 0 && pendingTotal === 0)) return;
  try {
    const isTR = locale === 'tr';

    await Notifications.cancelScheduledNotificationAsync('evening-brief').catch(() => {});

    const trigger = new Date();
    trigger.setHours(21, 0, 0, 0);
    if (trigger <= new Date()) {
      trigger.setDate(trigger.getDate() + 1);
    }

    let title: string;
    let body: string;

    if (completedToday > 0 && pendingTotal === 0) {
      title = isTR ? 'Mükemmel gün' : 'Perfect day';
      body = isTR
        ? `Tüm görevleri tamamladın. Harika gitti.`
        : 'All tasks done. You crushed it.';
    } else if (completedToday > 0) {
      title = isTR ? 'Günü kapatıyorsun' : 'Wrapping up';
      body = isTR
        ? `${completedToday} görev tamamlandı · yarın için ${pendingTotal} bekliyor.`
        : `${completedToday} done · ${pendingTotal} waiting for tomorrow.`;
    } else {
      title = isTR ? 'Henüz başlamadın' : 'Not started yet';
      body = isTR
        ? `${pendingTotal} görev bekliyor. Gün bitmeden birini tamamla.`
        : `${pendingTotal} task${pendingTotal > 1 ? 's' : ''} waiting. Finish one before midnight.`;
    }

    await Notifications.scheduleNotificationAsync({
      identifier: 'evening-brief',
      content: {
        title,
        body,
        sound: true,
        categoryIdentifier: 'daily-summary',
      },
      trigger: {
        type: 'date',
        date: trigger,
      } as any,
    });
  } catch (_) {}
}

// Backward-compatible alias used in _layout.tsx
export async function scheduleShutdownNotification(
  pendingCount: number,
  locale: string = 'en'
): Promise<void> {
  return scheduleEveningBrief(0, pendingCount, locale);
}

export async function cancelEveningBrief(): Promise<void> {
  if (!Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync('evening-brief');
    await Notifications.cancelScheduledNotificationAsync('daily-shutdown'); // legacy
  } catch (_) {}
}

// ─── Task Reminder ────────────────────────────────────────────────────────────

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
        title: isTR ? 'Görev Zamanı' : 'Task Due',
        body: title,
        data: { taskId, type: 'task-reminder' },
        sound: true,
        categoryIdentifier: 'task-reminder',
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

// ─── Habit Reminder ───────────────────────────────────────────────────────────

export async function scheduleHabitReminder(
  habitId: string,
  habitName: string,
  hour: number,
  minute: number,
  locale: string = 'tr'
): Promise<void> {
  if (!Notifications || isExpoGo) return;
  try {
    const isTR = locale === 'tr';
    const id = `habit-reminder-${habitId}`;
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title: isTR ? 'Alışkanlık Zamanı' : 'Habit Time',
        body: habitName,
        sound: true,
        data: { type: 'habit-reminder', habitId },
        categoryIdentifier: 'habit-reminder',
      },
      trigger: {
        type: 'daily',
        hour,
        minute,
        repeats: true,
      } as any,
    });
  } catch (_) {}
}

export async function cancelHabitReminder(habitId: string): Promise<void> {
  if (!Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(`habit-reminder-${habitId}`);
  } catch (_) {}
}

// ─── Habit At-Risk (20:30) ────────────────────────────────────────────────────
// Schedule once; cancel if user already completed their habits today.

export async function scheduleHabitAtRisk(
  habitCount: number,
  locale: string = 'en'
): Promise<void> {
  if (!Notifications || isExpoGo || habitCount === 0) return;
  try {
    const isTR = locale === 'tr';

    await Notifications.cancelScheduledNotificationAsync('habit-at-risk').catch(() => {});

    const trigger = new Date();
    trigger.setHours(20, 30, 0, 0);
    if (trigger <= new Date()) {
      trigger.setDate(trigger.getDate() + 1);
    }

    await Notifications.scheduleNotificationAsync({
      identifier: 'habit-at-risk',
      content: {
        title: isTR ? 'Serin risk altında' : 'Streak at risk',
        body: isTR
          ? 'Bugün hiç alışkanlık tamamlamadın. Gün bitmeden bir tane yap.'
          : "You haven't completed any habits today. Do one before midnight.",
        sound: true,
        data: { type: 'habit-risk' },
        categoryIdentifier: 'habit-risk',
      },
      trigger: {
        type: 'date',
        date: trigger,
      } as any,
    });
  } catch (_) {}
}

export async function cancelHabitAtRisk(): Promise<void> {
  if (!Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync('habit-at-risk');
  } catch (_) {}
}

// ─── Focus Notifications ──────────────────────────────────────────────────────

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
        title: isTR ? 'Derin Odak' : 'Deep Focus',
        body: `${label} · ${timeStr} ${isTR ? 'kaldı' : 'remaining'}`,
        sound: false,
        sticky: true,
        data: { type: 'focus' },
        categoryIdentifier: 'focus-active',
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

// ─── Weekly Review (Sunday 20:00) ────────────────────────────────────────────

export async function scheduleWeeklySummary(
  momentumScore: number,
  streak: number,
  locale: string = 'tr'
): Promise<void> {
  if (!Notifications || isExpoGo) return;
  try {
    const isTR = locale === 'tr';
    const title = isTR ? 'Haftalık Özet' : 'Weekly Review';
    const streakLine = streak > 0
      ? (isTR ? ` · 🔥 ${streak} günlük seri` : ` · 🔥 ${streak}-day streak`)
      : '';
    const body = isTR
      ? `Momentum: ${momentumScore}. Yeni haftayı planla.${streakLine}`
      : `Momentum: ${momentumScore}. Plan the week ahead.${streakLine}`;

    const now = new Date();
    const daysUntilSunday = (7 - now.getDay()) % 7 || 7;
    const trigger = new Date(now);
    trigger.setDate(now.getDate() + daysUntilSunday);
    trigger.setHours(20, 0, 0, 0);

    await Notifications.cancelScheduledNotificationAsync('weekly-summary').catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: 'weekly-summary',
      content: { title, body, sound: true, categoryIdentifier: 'daily-summary' },
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

// ─── Exam Countdown (7d / 3d / 1d before) ────────────────────────────────────

export async function scheduleExamCountdownNotifs(
  examName: string,
  examDate: string,
  locale: string = 'tr'
): Promise<void> {
  if (!Notifications || isExpoGo) return;
  try {
    const isTR = locale === 'tr';
    const name = examName.trim() || (isTR ? 'Sınav' : 'Exam');
    const targetDate = new Date(examDate);
    targetDate.setHours(9, 0, 0, 0);

    for (const daysBefore of [7, 3, 1]) {
      const trigger = new Date(targetDate);
      trigger.setDate(trigger.getDate() - daysBefore);
      const id = `exam-countdown-${daysBefore}d`;
      await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
      if (trigger > new Date()) {
        await Notifications.scheduleNotificationAsync({
          identifier: id,
          content: {
            title: isTR
              ? `${name}'a ${daysBefore} gün kaldı`
              : `${daysBefore} day${daysBefore > 1 ? 's' : ''} until ${name}`,
            body: isTR
              ? 'Planın güncel mi? Hızlıca kontrol et.'
              : 'Is your plan up to date? Quick check.',
            sound: true,
            data: { type: 'exam-countdown', daysBefore },
            categoryIdentifier: 'exam-countdown',
          },
          trigger: { type: 'date', date: trigger } as any,
        });
      }
    }
  } catch (_) {}
}

export async function cancelExamCountdownNotifs(): Promise<void> {
  if (!Notifications) return;
  for (const d of [7, 3, 1]) {
    try { await Notifications.cancelScheduledNotificationAsync(`exam-countdown-${d}d`); } catch (_) {}
  }
}

// ─── Ramadan Notifications ────────────────────────────────────────────────────

export async function scheduleRamadanStartNotification(
  startDateStr: string,
  locale: string = 'tr'
): Promise<void> {
  if (!Notifications || isExpoGo) return;
  try {
    const isTR = locale === 'tr';

    const eve = new Date(startDateStr);
    eve.setDate(eve.getDate() - 1);
    eve.setHours(20, 0, 0, 0);
    await Notifications.cancelScheduledNotificationAsync('ramazan-eve').catch(() => {});
    if (eve > new Date()) {
      await Notifications.scheduleNotificationAsync({
        identifier: 'ramazan-eve',
        content: {
          title: isTR ? 'Yarın Ramazan başlıyor' : 'Ramadan starts tomorrow',
          body: isTR
            ? 'Alışkanlık planını bir kez gözden geçir — yarın hazır ol.'
            : 'Review your habit plan once — be ready for tomorrow.',
          sound: true,
          data: { type: 'ramazan-eve' },
          categoryIdentifier: 'daily-summary',
        },
        trigger: { type: 'date', date: eve } as any,
      });
    }

    const start = new Date(startDateStr);
    start.setHours(7, 0, 0, 0);
    await Notifications.cancelScheduledNotificationAsync('ramazan-start').catch(() => {});
    if (start > new Date()) {
      await Notifications.scheduleNotificationAsync({
        identifier: 'ramazan-start',
        content: {
          title: isTR ? 'Ramazan başladı' : 'Ramadan has begun',
          body: isTR
            ? 'Planın aktif. İlk günü güçlü başlatmak için alışkanlıklarına bak.'
            : 'Your plan is active. Check your habits to start the first day strong.',
          sound: true,
          data: { type: 'ramazan-start' },
          categoryIdentifier: 'daily-summary',
        },
        trigger: { type: 'date', date: start } as any,
      });
    }
  } catch (_) {}
}

export async function cancelRamadanStartNotification(): Promise<void> {
  if (!Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync('ramazan-start').catch(() => {});
    await Notifications.cancelScheduledNotificationAsync('ramazan-eve').catch(() => {});
  } catch (_) {}
}

// ─── Cancel All ───────────────────────────────────────────────────────────────

export async function cancelAllNotifications(): Promise<void> {
  if (!Notifications) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (_) {}
}
