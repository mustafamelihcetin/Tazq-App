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

// Call once on app start — registers actionable notification categories.
// These buttons appear on both iPhone AND Apple Watch automatically.
export async function registerNotificationCategories(): Promise<void> {
  if (!Notifications?.setNotificationCategoryAsync) return;
  try {
    // Alışkanlık hatırlatıcısı: Tamamladım / Geç
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

    // Odak aktif: Durdur
    await Notifications.setNotificationCategoryAsync('focus-active', [
      {
        identifier: 'focus-stop',
        buttonTitle: '⏹ Durdur',
        options: { opensAppToForeground: false, isDestructive: true },
      },
    ]);

    // Sınav geri sayımı: Planı Görüntüle
    await Notifications.setNotificationCategoryAsync('exam-countdown', [
      {
        identifier: 'exam-open',
        buttonTitle: '📋 Planı Görüntüle',
        options: { opensAppToForeground: true },
      },
    ]);

    // Günlük görev özeti: Görevleri Aç
    await Notifications.setNotificationCategoryAsync('daily-summary', [
      {
        identifier: 'open-tasks',
        buttonTitle: '📋 Görevleri Aç',
        options: { opensAppToForeground: true },
      },
    ]);
  } catch (_) {}
}

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
        categoryIdentifier: 'daily-summary',
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
              ? `📅 ${name}'a ${daysBefore} gün kaldı`
              : `📅 ${daysBefore} day${daysBefore > 1 ? 's' : ''} until ${name}`,
            body: isTR
              ? 'Planın güncel mi? Hızlıca kontrol et. 💪'
              : 'Is your plan up to date? Quick check. 💪',
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

// Alışkanlık hatırlatıcısı — Watch'ta "✅ Tamamladım" ve "⏭ Geç" butonları çıkar
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
        title: isTR ? '💪 Alışkanlık Zamanı' : '💪 Habit Time',
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

export async function cancelExamCountdownNotifs(): Promise<void> {
  if (!Notifications) return;
  for (const d of [7, 3, 1]) {
    try { await Notifications.cancelScheduledNotificationAsync(`exam-countdown-${d}d`); } catch (_) {}
  }
}

export async function scheduleRamadanStartNotification(
  startDateStr: string,
  locale: string = 'tr'
): Promise<void> {
  if (!Notifications || isExpoGo) return;
  try {
    const isTR = locale === 'tr';

    // Day-before nudge at 20:00 — "yarın başlıyor, planını hazırla"
    const eve = new Date(startDateStr);
    eve.setDate(eve.getDate() - 1);
    eve.setHours(20, 0, 0, 0);
    await Notifications.cancelScheduledNotificationAsync('ramazan-eve').catch(() => {});
    if (eve > new Date()) {
      await Notifications.scheduleNotificationAsync({
        identifier: 'ramazan-eve',
        content: {
          title: isTR ? '🌙 Yarın Ramazan başlıyor' : '🌙 Ramadan starts tomorrow',
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

    // Start-day notification at 07:00 — actionable, not a celebration
    const start = new Date(startDateStr);
    start.setHours(7, 0, 0, 0);
    await Notifications.cancelScheduledNotificationAsync('ramazan-start').catch(() => {});
    if (start > new Date()) {
      await Notifications.scheduleNotificationAsync({
        identifier: 'ramazan-start',
        content: {
          title: isTR ? '🌙 Ramazan başladı' : '🌙 Ramadan has begun',
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
