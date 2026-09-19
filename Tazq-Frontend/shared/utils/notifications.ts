import { calendarDayOf, parseDateKey } from '@/shared/utils/dateKey';
import { Platform, AppState } from 'react-native';
import Constants from 'expo-constants';
import { swallow } from './swallow';

const isExpoGo = Constants.appOwnership === 'expo';
const FOCUS_NOTIF_ID = 'tazq-focus-live';
export const FOCUS_END_ID = 'focus-end';
export const FOCUS_STRICT_ID = 'focus-strict';

let Notifications: any = null;
try {
  Notifications = require('expo-notifications');
  if (Notifications?.setNotificationHandler) {
    Notifications.setNotificationHandler({
      handleNotification: async (notification: any) => {
        const id = notification?.request?.identifier;
        const isFocusNotif = id === FOCUS_NOTIF_ID;
        const isBackground = AppState.currentState !== 'active';
        // Odak ekranı açıkken bitişi ekran zaten kutluyor (ses + ritüel): bildirim susar.
        let onFocusScreen = false;
        if (id === FOCUS_END_ID || id === FOCUS_STRICT_ID) {
          try { onFocusScreen = !isBackground && require('@/features/focus/session').isFocusScreenVisible(); } catch (e) { swallow('notifications.focusScreenFlag', e); }
        }
        return {
          shouldShowBanner: isFocusNotif ? isBackground : !onFocusScreen,
          shouldShowList: isFocusNotif ? isBackground : !onFocusScreen,
          shouldPlaySound: isFocusNotif ? false : !onFocusScreen,
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

/**
 * İzin var mı — SORMADAN. Planlama yollarında kullanılır.
 *
 * `requestNotificationPermissions` izin İSTER; onu bir görev kaydedilirken çağırmak
 * kullanıcıyı beklemediği bir sistem diyaloguyla karşılardı. Burada yalnız MEVCUT
 * durum okunuyor.
 */
export async function hasNotificationPermission(): Promise<boolean> {
  if (!Notifications) return false;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/**
 * Mevcut izin durumunu OKUR — sistem diyaloğunu AÇMAZ.
 *
 * Ayrım kritik: iOS'ta izin diyaloğu kullanıcı başına BİR KEZ gösterilebilir.
 * "Durumu öğren" ile "izin iste" aynı fonksiyonda olduğu sürece, yalnızca durumu
 * merak eden her çağrı o tek hakkı harcama riski taşır.
 *
 *  · 'granted'      — izin var
 *  · 'undetermined' — hiç sorulmadı, sorma hakkı DURUYOR
 *  · 'denied'       — reddedilmiş; tekrar sormak işe yaramaz, kullanıcı Ayarlar'dan açmalı
 */
export async function getNotificationPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  if (!Notifications) return 'denied';
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') return 'granted';
    if (status === 'undetermined') return 'undetermined';
    return 'denied';
  } catch (_) {
    return 'denied';
  }
}

/**
 * SİSTEM DİYALOĞUNU AÇAR — yalnız kullanıcı açıkça istediğinde çağır.
 *
 * ÖLÇÜLEN SORUN: bu fonksiyon girişten hemen sonra, hiçbir bağlam verilmeden
 * çağrılıyordu (_layout). Kullanıcı uygulamayı henüz kullanmamışken "bildirim
 * göndermek istiyor" diyaloğunu görüyordu. Bağlamsız sorulan izin daha çok
 * reddedilir; reddedilince de sabah özeti, akşam özeti, görev ve alışkanlık
 * hatırlatıcıları KALICI olarak kapanır — çünkü ikinci bir sorma hakkı yok.
 *
 * Artık önce kendi ön-bilgilendirme ekranımız çıkıyor (NotificationPrimer) ve bu
 * fonksiyon ancak kullanıcı "aç" dediğinde çalışıyor.
 */
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

// ─── Morning Brief ───────────────────────────────────────────────────────────
// TEK SEFERLİK: `daily` tetikleyicide sayı donuyor, açılmayan uygulama her sabah aynı eski
// "Bugün 16 görevin var"ı gönderiyordu (gerçek: 4). Sayı çalacağı günün (bkz. briefCounts).

const PRODUCTIVITY_HOUR: Record<string, number> = {
  morning: 7,
  afternoon: 12,
  evening: 17,
  night: 21,
};

/** Sabah özetinin saati — kullanıcının verimli saat tercihinden. */
export const briefHourFor = (productivityHour: string) => PRODUCTIVITY_HOUR[productivityHour] ?? 8;

export async function scheduleMorningBrief(
  todayTaskCount: number,
  streak: number,
  locale: string = 'en',
  productivityHour: string = 'morning',
  name?: string,
  /** Çalacağı an (bkz. briefCounts.nextAt); sayı bu günün sayısı olmalı. */
  fireAt?: Date,
): Promise<void> {
  if (!Notifications || isExpoGo) return;
  try {
    const isTR = locale === 'tr';

    await Notifications.cancelScheduledNotificationAsync('morning-brief').catch(() => {});

    // Don't schedule if nothing to show
    if (todayTaskCount === 0 && streak === 0) return;

    // Üretkenlik saatine göre tetikle — kullanıcının en uygun anında hatırlat.
    const briefHour = briefHourFor(productivityHour);

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
        // Dokunuş "Bugün" ekranını açar: sabah özetinin işi günü KURMAK.
        data: { type: 'morning-brief' },
        categoryIdentifier: 'morning-brief',
      },
      trigger: {
        type: 'date',
        date: fireAt ?? nextOccurrence(briefHour),
      } as any,
    });
  } catch (e) { swallow('notifications.scheduleMorningBrief', e); }
}

/** Bugün o saat geçmediyse bugün, geçtiyse yarın. */
function nextOccurrence(hour: number): Date {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  if (d <= new Date()) d.setDate(d.getDate() + 1);
  return d;
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
  name?: string,
  /** Çalacağı an; sayılar bu günün sayıları olmalı (bkz. briefCounts). */
  fireAt?: Date,
): Promise<void> {
  if (!Notifications || isExpoGo) return;
  try {
    const isTR = locale === 'tr';
    const firstName = (name ?? '').trim().split(/\s+/)[0];

    // ÖNCE İPTAL, sonra karar: yoksa işler silinse de eski "3 görev duruyor" akşam çalardı.
    await Notifications.cancelScheduledNotificationAsync('evening-brief').catch(() => {});
    if (completedToday === 0 && pendingTotal === 0) return;

    const trigger = fireAt ?? nextOccurrence(21);

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
        // "yarın için hazır" DEĞİL: bu sayı bugünden KALAN iş (bkz. briefCounts.openThrough).
        ? `${completedToday} görev tamam. ${pendingTotal} tanesi yarına kaldı.`
        : `${completedToday} done today. ${pendingTotal} left for tomorrow.`;
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
        /*
          Dokunuş "Bugün" ekranını açar. Akşam özeti eskiden bir bildirim olarak gelip
          hiçbir yere GÖTÜRMÜYORDU: kullanıcı "3 iş kaldı" cümlesini okuyup uygulamayı
          açtığında yine listeyle baş başa kalıyordu. Artık günü kapatma kararının
          verildiği yere düşüyor.
        */
        data: { type: 'evening-brief' },
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
  locale: string = 'en',
  /** true → bildirimde görev adı yerine genel bir metin görünür (bkz. gövdedeki not). */
  hideContent: boolean = false
): Promise<string | null> {
  if (!Notifications) return null;
  /*
    İZİN KONTROLÜ — sessiz başarısızlığı bitirir.

    Bu kontrol YOKTU. Kullanıcı "Hatırlatıcı" anahtarını açıyor, anahtar yeşile
    dönüyor, güvende hissediyor; ama bildirim izni reddedilmişse `scheduleNotificationAsync`
    hiçbir şey yapmıyor ve KİMSE söylemiyordu. Uygulamanın verip sessizce bozduğu bir söz —
    kullanıcı hatırlatmayı beklediği için ayrıca bir yere not da almıyor.

    Artık `null` dönüyor; çağıran taraf bunu kullanıcıya söyleyebiliyor.
  */
  if (!(await hasNotificationPermission())) return null;
  try {
    const isTR = locale === 'tr';
    let triggerDate: Date | null = null;

    if (dueTime) {
      const { hours, minutes } = parseTimeParts(dueTime);
      triggerDate = new Date();
      triggerDate.setHours(hours, minutes, 0, 0);
      // Gün YEREL takvimden: '…T00:00:00Z' UTC okunursa bazı saat dilimlerinde bir gün önce çalar.
      const day = calendarDayOf(dueDate);
      if (day) {
        const d = parseDateKey(day);
        triggerDate.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
      }
    } else if (calendarDayOf(dueDate)) {
      triggerDate = parseDateKey(calendarDayOf(dueDate)!);
      triggerDate.setHours(9, 0, 0, 0);
    }

    if (!triggerDate || triggerDate <= new Date()) return null;

    const id = `task-${taskId}`;
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title: isTR ? 'Görev zamanı' : 'Task due',
        /*
          GÖREV ADI KİLİT EKRANINDA GÖRÜNÜR.

          Buraya kullanıcının yazdığı ham başlık giriyor ve bildirim kilit ekranında
          çıkıyor — yani yanındaki herkes okuyabiliyor. Kullanıcı o metni KENDİSİ için,
          özel olarak yazmıştı.

          Bu bir "uygunsuz içerik" meselesi DEĞİL: metin kullanıcının kendi cihazında,
          kendisine gösteriliyor. Küfür süzgeci koymak hem vesayetçi olurdu hem de
          Türkçede güvenilir çalışmaz (yanlış pozitifler ve kaçırma kaçınılmaz).

          Asıl risk MAHREMİYET ve küfürle sınırlı değil: "Doktor: test sonucu",
          "Ayrılık konuşması", "Kredi başvurusu" — hepsi aynı kapıdan sızıyor.
          Çözüm sansür değil, kullanıcının KARARI: içeriği gizle, yalnız hatırlat.
        */
        body: hideContent
          ? (isTR ? 'Bir görevinin zamanı geldi' : 'A task is due')
          : title,
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

/**
 * TÜM GÖREV BİLDİRİMLERİNİ YENİDEN KURAR.
 *
 * ── NEDEN GEREKLİ ─────────────────────────────────────────────────────────────
 * "Bildirimde içeriği gizle" ayarı yalnız BUNDAN SONRA kurulacak bildirimlere
 * uygulanıyordu: anahtarı açan kullanıcının zaten zamanlanmış hatırlatıcıları görev
 * adını kilit ekranında göstermeye devam ediyordu. Bir gizlilik ayarının en çok
 * beklendiği an tam da açıldığı andır — "bundan sonrakiler" yeterli değil.
 *
 * Zamanlanmış bildirim içeriği DEĞİŞTİRİLEMEZ; tek yol iptal edip yeniden kurmak.
 * `scheduleTaskNotification` zaten aynı kimlikle kurup üzerine yazıyor, yani ayrıca
 * iptal etmeye gerek yok — geçmişte kalan tarihler de kendiliğinden eleniyor.
 *
 * @returns Yeniden kurulan bildirim sayısı (çağıran taraf kullanıcıya söyleyebilir).
 */
export async function rescheduleAllTaskNotifications(
  tasks: { id: number; title: string; dueDate?: string | null; dueTime?: string | null; isCompleted?: boolean; tags?: string[] | null }[],
  locale: string,
  hideContent: boolean,
): Promise<number> {
  if (!Notifications) return 0;
  if (!(await hasNotificationPermission())) return 0;
  let count = 0;
  for (const t of tasks) {
    // Bitmiş ya da tarihsiz görevin hatırlatıcısı zaten yok.
    if (t.isCompleted || !t.dueDate) continue;
    // YALNIZ hatırlatıcı istenmişler (bkz. wantsReminder): yoksa "içeriği gizle" açılınca
    // tarihli HER görev için 09:00'a bildirim kuruluyordu.
    if (!(t.tags ?? []).some((tag) => tag === 'hatırlatıcı' || tag === 'reminder')) continue;
    try {
      const id = await scheduleTaskNotification(t.id, t.title, t.dueDate, t.dueTime, locale, hideContent);
      if (id) count += 1;
    } catch (e) { swallow('notifications.rescheduleAllTaskNotifications', e); }
  }
  return count;
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

/** ODAK ALARMI — tek seferlik. Kilitli telefonda JS çalışmaz; bitişi ancak işletim sistemi
 *  haber verebilir. Kimlik sabit: yeniden kurmak eskisinin yerine geçer. */
export async function scheduleFocusAlert(id: string, at: Date, title: string, body: string): Promise<void> {
  if (!Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: { title, body, sound: 'default', data: { type: 'focus' } },
      trigger: { type: 'date', date: at } as any,
    });
  } catch (e) { swallow('notifications.scheduleFocusAlert', e); }
}

export async function cancelFocusAlert(id: string, dismissDelivered = false): Promise<void> {
  if (!Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    if (dismissDelivered) await Notifications.dismissNotificationAsync(id).catch(() => {});
  } catch (e) { swallow('notifications.cancelFocusAlert', e); }
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
    /*
      Bu bildirimin BÜTÜN metni tek bir dalda toplandı: başlık, gövde ve tekrarlı
      yedeğin metni ayrı ayrı `isTR ? ... : ...` ile yazılıyordu. Aynı kararı dört kez
      vermek, birini güncelleyip ötekini unutmanın davetiyesidir — iki dil artık yan
      yana duruyor (bkz. __tests__/i18nRatchet.test.ts).
    */
    const isTR = locale === 'tr';
    const streakLine = isTR ? ` Seri: ${streak} gün.` : ` Streak: ${streak} days.`;
    const copy = isTR
      ? {
          title: 'Haftalık Özet',
          body: `Momentumun ${momentumScore}. Önümüzdeki haftayı planla, ivmeni sürdür.${streak > 0 ? streakLine : ''}`,
          evergreen: 'Haftan nasıl geçti? Momentumuna bak ve önümüzdeki haftayı planla.',
        }
      : {
          title: 'Weekly Review',
          body: `Your momentum is ${momentumScore}. Plan the week ahead and keep it going.${streak > 0 ? streakLine : ''}`,
          evergreen: 'How did your week go? Check your momentum and plan the week ahead.',
        };
    const { title, body } = copy;

    /*
      ── TEKRARLI TETİKLEYİCİ, BAYAT SAYI TAŞIMADAN ──────────────────────────────
      Bu bildirim TEK SEFERLİK bir tarihe kuruluyordu ve yalnız uygulama açıldığında
      yeniden kuruluyordu. Yani ayarda "Pazar akşamı momentum özeti" yazıyor ama
      uygulamayı bir hafta açmayan kullanıcı hiç almıyordu — tam da en çok hatırlatmaya
      ihtiyacı olan kullanıcı.

      Tekrarlı tetikleyici bunu çözüyor ama BERABERİNDE bir tuzak getiriyor: gövdeye
      gömülen momentum sayısı her hafta AYNI kalır ve bir süre sonra yalan söyler. O
      yüzden tekrarlı metin sayı taşımıyor, kullanıcıyı içeri çağırıyor; sayıyı
      uygulamanın kendisi gösteriyor.

      Uygulama açıldığında yine GÜNCEL sayıyla tek seferlik bir özet kuruluyor (aşağıda):
      düzenli kullanıcı gerçek rakamı görüyor, uzaklaşan kullanıcı ise en azından
      sessizliğe düşmüyor.
    */
    // Tekrarlı yedek ile tek seferlik özet aynı anda çalıyordu (pazar 20:00'de İKİ bildirim).
    // Artık dört pazar tek seferlik: ilki güncel sayıyla, sonrakiler sayısız çağrıyla.
    const now = new Date();
    const daysUntilSunday = (7 - now.getDay()) % 7 || 7;
    await Notifications.cancelScheduledNotificationAsync('weekly-summary-repeat').catch(() => {}); // eski tekrarlı
    for (let week = 0; week < 4; week++) {
      const trigger = new Date(now);
      trigger.setDate(now.getDate() + daysUntilSunday + week * 7);
      trigger.setHours(20, 0, 0, 0);
      const id = week === 0 ? 'weekly-summary' : `weekly-summary-${week}`;
      await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
      await Notifications.scheduleNotificationAsync({
        identifier: id,
        content: { title, body: week === 0 ? body : copy.evergreen, sound: true, data: { type: 'weekly' }, categoryIdentifier: 'daily-summary' },
        trigger: { type: 'date', date: trigger } as any,
      });
    }
  } catch (e) { swallow('notifications.scheduleWeeklySummary', e); }
}

export async function cancelWeeklySummary(): Promise<void> {
  if (!Notifications) return;
  // İKİSİ de kalkmalı: güncel sayılı tek seferlik özet ve sessizliğe düşmeyi
  // engelleyen tekrarlı yedek (bkz. scheduleWeeklySummary).
  try {
    for (const id of ['weekly-summary', 'weekly-summary-1', 'weekly-summary-2', 'weekly-summary-3', 'weekly-summary-repeat']) {
      await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    }
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
    // Tarih YEREL takvimden ('YYYY-MM-DD' UTC okunursa bazı saat dilimlerinde gün kayar).
    const examDay = calendarDayOf(examDate);
    if (!examDay) return;
    const targetDate = parseDateKey(examDay);
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
            // Ek YOK: "YKS'a" yanlıştı. Ünlü uyumu isme göre değişir; "için" her adla doğru.
            title: isTR
              ? `${name} için ${daysBefore} gün kaldı`
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
        title: tr ? 'Yeni Destek Mesajı!' : 'New Support Message!',
        body: tr ? `${userName} bir destek mesajı gönderdi.` : `${userName} sent a support request.`,
        sound: true,
      },
      trigger: null, // send immediately
    });
  } catch (e) { swallow('notifications.sendAdminSupportNotification', e); }
}

