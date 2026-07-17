import { Platform, AppState } from 'react-native';
import Constants from 'expo-constants';
import { swallow } from './swallow';

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
          shouldShowBanner: isFocusNotif ? isBackground : true,
          shouldShowList: isFocusNotif ? isBackground : true,
          shouldPlaySound: isFocusNotif ? false : true,
          shouldSetBadge: false,
        };
      },
    });
  }
} catch (e) { swallow('notifications.moduleInit', e); }

export function parseTimeParts(timeStr: string): { hours: number; minutes: number } {
  if (timeStr.includes('T')) {
    const d = new Date(timeStr);
    return { hours: d.getHours(), minutes: d.getMinutes() };
  } else {
    const parts = timeStr.split(':').map(Number);
    return { hours: parts[0] || 0, minutes: parts[1] || 0 };
  }
}

// ─── Categories ───────────────────────────────────────────────────────────────

export async function registerNotificationCategories(): Promise<void> {
  if (!Notifications?.setNotificationCategoryAsync) return;
  try {
    // Dil EN İLK belirlenir — böylece TÜM kategori butonları lokalize olur (eskiden sabah/
    // alışkanlık/odak butonları Türkçe-sabitti, İngilizce kullanıcı Türkçe metin görüyordu).
    const lang = require('@/shared/store/useLanguageStore').useLanguageStore.getState().language;
    const tr = lang === 'tr';

    // Sabah özeti — odaklan ya da görevleri aç
    await Notifications.setNotificationCategoryAsync('morning-brief', [
      { identifier: 'start-focus', buttonTitle: tr ? 'Odaklan' : 'Focus', options: { opensAppToForeground: true } },
      { identifier: 'open-tasks', buttonTitle: tr ? 'Görevler' : 'Tasks', options: { opensAppToForeground: true } },
    ]);

    // Görev hatırlatma — uygulamayı açmadan tamamla/ertele
    await Notifications.setNotificationCategoryAsync('task-reminder', [
      { identifier: 'task-complete', buttonTitle: tr ? 'Tamamla' : 'Complete', options: { opensAppToForeground: false } },
      { identifier: 'task-snooze', buttonTitle: tr ? '15 dk ertele' : 'Snooze 15 min', options: { opensAppToForeground: false } },
      { identifier: 'open-tasks', buttonTitle: tr ? 'Aç' : 'Open', options: { opensAppToForeground: true } },
    ]);

    // Alışkanlık hatırlatma — kilit ekranından işaretle
    await Notifications.setNotificationCategoryAsync('habit-reminder', [
      { identifier: 'habit-complete', buttonTitle: tr ? 'Yaptım' : 'Done', options: { opensAppToForeground: false } },
      { identifier: 'habit-skip', buttonTitle: tr ? 'Bugün geç' : 'Skip today', options: { opensAppToForeground: false, isDestructive: true } },
    ]);

    // Seri riski — alışkanlıklara git
    await Notifications.setNotificationCategoryAsync('habit-risk', [
      { identifier: 'open-cockpit', buttonTitle: tr ? 'Alışkanlıklar' : 'Habits', options: { opensAppToForeground: true } },
    ]);

    // Aktif odak — bildirimden bitir
    await Notifications.setNotificationCategoryAsync('focus-active', [
      { identifier: 'focus-stop', buttonTitle: tr ? 'Bitir' : 'End', options: { opensAppToForeground: false, isDestructive: true } },
    ]);

    // Sınav geri sayımı — planı aç
    await Notifications.setNotificationCategoryAsync('exam-countdown', [
      { identifier: 'exam-open', buttonTitle: tr ? 'Planı aç' : 'Open plan', options: { opensAppToForeground: true } },
    ]);

    // Akşam / haftalık özet — aç
    await Notifications.setNotificationCategoryAsync('daily-summary', [
      { identifier: 'open-tasks', buttonTitle: tr ? 'Aç' : 'Open', options: { opensAppToForeground: true } },
    ]);
  } catch (e) { swallow('notifications.registerNotificationCategories', e); }
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

const PRODUCTIVITY_HOUR: Record<string, number> = {
  morning: 7,
  afternoon: 12,
  evening: 17,
  night: 21,
};

export async function scheduleMorningBrief(
  todayTaskCount: number,
  streak: number,
  locale: string = 'en',
  productivityHour: string = 'morning',
  name?: string
): Promise<void> {
  if (!Notifications || isExpoGo) return;
  try {
    const isTR = locale === 'tr';

    await Notifications.cancelScheduledNotificationAsync('morning-brief').catch(() => {});

    // Don't schedule if nothing to show
    if (todayTaskCount === 0 && streak === 0) return;

    // Üretkenlik saatine göre tetikle — kullanıcının en uygun anında hatırlat.
    const briefHour = PRODUCTIVITY_HOUR[productivityHour] ?? 8;

    // Seri satırı — emojisiz, doğal. Sadece anlamlıysa (2+ gün).
    const streakLine = streak > 1
      ? (isTR ? ` Serin ${streak}. günde.` : ` You're on day ${streak}.`)
      : '';

    // Metin: ileri-bakan, davetkâr. "Küçük bir adım" psikolojisi = harekete geçmeyi kolaylaştırır.
    const body = todayTaskCount > 0
      ? (isTR
          ? `Bugün ${todayTaskCount} görevin var. Birini seçip başla.${streakLine}`
          : `You have ${todayTaskCount} task${todayTaskCount > 1 ? 's' : ''} today. Pick one and start.${streakLine}`)
      : (isTR
          ? `Serin ${streak}. günde — bugün de canlı tut.`
          : `Day ${streak} of your streak — keep it alive today.`);

    // Selamlamayı saate göre seç (üretkenlik saati akşam/gece olabilir)
    const baseGreeting = briefHour < 12
      ? (isTR ? 'Günaydın' : 'Good morning')
      : briefHour < 18
        ? (isTR ? 'İyi günler' : 'Good afternoon')
        : (isTR ? 'İyi akşamlar' : 'Good evening');
    // İsimle kişiselleştir — "Günaydın, Deniz" opak bir "Günaydın"dan çok daha sıcak.
    const firstName = (name ?? '').trim().split(/\s+/)[0];
    const greeting = firstName ? `${baseGreeting}, ${firstName}` : baseGreeting;

    await Notifications.scheduleNotificationAsync({
      identifier: 'morning-brief',
      content: {
        title: greeting,
        body,
        sound: true,
        categoryIdentifier: 'morning-brief',
      },
      trigger: {
        type: 'daily',
        hour: briefHour,
        minute: 0,
        repeats: true,
      } as any,
    });
  } catch (e) { swallow('notifications.scheduleMorningBrief', e); }
}

export async function cancelMorningBrief(): Promise<void> {
  if (!Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync('morning-brief');
  } catch (e) { swallow('notifications.cancelMorningBrief', e); }
}

// ─── Evening Summary (21:00 daily) ───────────────────────────────────────────
// Replaces old shutdownNotification. Shows real completion context.

export async function scheduleEveningBrief(
  completedToday: number,
  pendingTotal: number,
  locale: string = 'en',
  name?: string
): Promise<void> {
  if (!Notifications || isExpoGo || (completedToday === 0 && pendingTotal === 0)) return;
  try {
    const isTR = locale === 'tr';
    const firstName = (name ?? '').trim().split(/\s+/)[0];

    await Notifications.cancelScheduledNotificationAsync('evening-brief').catch(() => {});

    const trigger = new Date();
    trigger.setHours(21, 0, 0, 0);
    if (trigger <= new Date()) {
      trigger.setDate(trigger.getDate() + 1);
    }

    let title: string;
    let body: string;

    if (completedToday > 0 && pendingTotal === 0) {
      // Zafer anı — kişisel ve gurur verici.
      title = isTR ? 'Kusursuz bir gün' : 'A flawless day';
      body = isTR
        ? `Bugünün her görevini bitirdin${firstName ? `, ${firstName}` : ''}. Bunu hak ettin.`
        : `Every task done today${firstName ? `, ${firstName}` : ''}. You earned this.`;
    } else if (completedToday > 0) {
      title = isTR ? 'Günü güzel kapatıyorsun' : 'Nicely wrapping up';
      body = isTR
        ? `${completedToday} görev tamam. ${pendingTotal} tanesi yarın için hazır.`
        : `${completedToday} done today. ${pendingTotal} ready for tomorrow.`;
    } else {
      // SUÇLAMA YOK — ileri-bakan, ivme dili. Bir görev bile fark yaratır.
      title = isTR ? 'Gün bitmeden' : 'Before the day ends';
      body = isTR
        ? `${pendingTotal} görev duruyor. Bir tanesini bitirmek bile ivme yaratır.`
        : `${pendingTotal} task${pendingTotal > 1 ? 's' : ''} left. Finishing even one builds momentum.`;
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
  } catch (e) { swallow('notifications.scheduleEveningBrief', e); }
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
  } catch (e) { swallow('notifications.cancelEveningBrief', e); }
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
      const { hours, minutes } = parseTimeParts(dueTime);
      triggerDate = new Date();
      triggerDate.setHours(hours, minutes, 0, 0);
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
        title: isTR ? 'Görev zamanı' : 'Task due',
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
  } catch (e) { swallow('notifications.cancelTaskNotification', e); }
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
        title: isTR ? 'Alışkanlık zamanı' : 'Habit time',
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
  } catch (e) { swallow('notifications.scheduleHabitReminder', e); }
}

export async function cancelHabitReminder(habitId: string): Promise<void> {
  if (!Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(`habit-reminder-${habitId}`);
  } catch (e) { swallow('notifications.cancelHabitReminder', e); }
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
        title: isTR ? 'Serini koru' : 'Keep your streak',
        body: isTR
          ? 'Serini canlı tutmak için bugünün alışkanlıklarını tamamla. Küçük bir adım yeter.'
          : "Complete today's habits to keep your streak alive. One small step is enough.",
        sound: true,
        data: { type: 'habit-risk' },
        categoryIdentifier: 'habit-risk',
      },
      trigger: {
        type: 'date',
        date: trigger,
      } as any,
    });
  } catch (e) { swallow('notifications.scheduleHabitAtRisk', e); }
}

export async function cancelHabitAtRisk(): Promise<void> {
  if (!Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync('habit-at-risk');
  } catch (e) { swallow('notifications.cancelHabitAtRisk', e); }
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
  } catch (e) { swallow('notifications.showFocusNotification', e); }
}

export async function cancelFocusNotification(): Promise<void> {
  if (!Notifications) return;
  try {
    await Notifications.dismissNotificationAsync(FOCUS_NOTIF_ID).catch(() => {});
    await Notifications.cancelScheduledNotificationAsync(FOCUS_NOTIF_ID).catch(() => {});
  } catch (e) { swallow('notifications.cancelFocusNotification', e); }
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
      ? (isTR ? ` Seri: ${streak} gün.` : ` Streak: ${streak} days.`)
      : '';
    const body = isTR
      ? `Momentumun ${momentumScore}. Önümüzdeki haftayı planla, ivmeni sürdür.${streakLine}`
      : `Your momentum is ${momentumScore}. Plan the week ahead and keep it going.${streakLine}`;

    const now = new Date();
    const daysUntilSunday = (7 - now.getDay()) % 7 || 7;
    const trigger = new Date(now);
    trigger.setDate(now.getDate() + daysUntilSunday);
    trigger.setHours(20, 0, 0, 0);

    await Notifications.cancelScheduledNotificationAsync('weekly-summary').catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: 'weekly-summary',
      content: { title, body, sound: true, data: { type: 'weekly' }, categoryIdentifier: 'daily-summary' },
      trigger: { type: 'date', date: trigger } as any,
    });
  } catch (e) { swallow('notifications.scheduleWeeklySummary', e); }
}

export async function cancelWeeklySummary(): Promise<void> {
  if (!Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync('weekly-summary');
  } catch (e) { swallow('notifications.cancelWeeklySummary', e); }
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
              ? (daysBefore === 1
                  ? 'Son düzlük. Planına göz at ve hazır ol.'
                  : `Geri sayım başladı: ${daysBefore} gün. Planına göz at, ritmi koru.`)
              : (daysBefore === 1
                  ? 'Final stretch. Review your plan and stay ready.'
                  : `${daysBefore} days to go. Review your plan and keep the pace.`),
            sound: true,
            data: { type: 'exam-countdown', daysBefore },
            categoryIdentifier: 'exam-countdown',
          },
          trigger: { type: 'date', date: trigger } as any,
        });
      }
    }
  } catch (e) { swallow('notifications.scheduleExamCountdownNotifs', e); }
}

export async function cancelExamCountdownNotifs(): Promise<void> {
  if (!Notifications) return;
  for (const d of [7, 3, 1]) {
    try { await Notifications.cancelScheduledNotificationAsync(`exam-countdown-${d}d`); } catch (e) { swallow('notifications.cancelExamCountdownNotifs', e); }
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
  } catch (e) { swallow('notifications.scheduleRamadanStartNotification', e); }
}

export async function cancelRamadanStartNotification(): Promise<void> {
  if (!Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync('ramazan-start').catch(() => {});
    await Notifications.cancelScheduledNotificationAsync('ramazan-eve').catch(() => {});
  } catch (e) { swallow('notifications.cancelRamadanStartNotification', e); }
}

// ─── Cancel All ───────────────────────────────────────────────────────────────

export async function cancelAllNotifications(): Promise<void> {
  if (!Notifications) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (e) { swallow('notifications.cancelAllNotifications', e); }
}

export async function sendAdminSupportNotification(userName: string, tr: boolean): Promise<void> {
  if (!Notifications) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: tr ? '🚨 Yeni Destek Mesajı!' : '🚨 New Support Message!',
        body: tr ? `${userName} bir destek mesajı gönderdi.` : `${userName} sent a support request.`,
        sound: true,
      },
      trigger: null, // send immediately
    });
  } catch (e) { swallow('notifications.sendAdminSupportNotification', e); }
}

