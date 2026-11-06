import AsyncStorage from '@react-native-async-storage/async-storage';
import { reloadAppAsync } from 'expo';
import { CustomAlert as Alert } from '@/shared/components/CustomAlert';
import { useFocusStore } from '@/features/focus/store/useFocusStore';
import { useHabitStore } from '@/features/habits/store/useHabitStore';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { hasActiveMode } from '@/features/modes/utils/planAuthority';
import { usePaymentsStore } from '@/features/payments/store/usePaymentsStore';
import { track } from '@/shared/utils/analytics';
import { scheduleExamCountdownNotifs } from '@/shared/utils/notifications';
import { swallow } from '@/shared/utils/swallow';

/*
  MOD GEÇİŞİ (2026-11-06, kullanıcı: "uygulama yeniden başlamalı, yalnız yolları kapatmak değil"). Anahtar yerine onay + temiz başlangıç:
  sekme seti, açık sayfalar ve hafızadaki veriler yarım kalmaz. Tasks.org'un "yeniden başlat" onayı, Bluesky ve Cashew'in ağacı baştan kurması.
  Onay yalnız kişinin başına gelecek olanı söyler: hedefi yoksa hedeften, ödemesi yoksa ödemeden söz edilmez. Veri silinmez; odak seansı sürerken geçilmez.
*/
const COPY = {
  tr: {
    liteTitle: 'Sade moda geç',
    lite: 'Yalnız yapılacaklar listen ve Odak kalır. Veriler silinmez.',
    habits: 'Alışkanlıkların işaretlenmez, serileri bu sürede işlemez.',
    payments: 'Ödeme hatırlatmaların gelmeye devam eder.',
    goalsAsk: 'Hedeflerin de var. Görevleri listene gelmeye devam etsin mi?',
    restart: 'Uygulama yeniden başlar.',
    liteGo: 'Geç ve yeniden başlat',
    goalsKeep: 'Görevleri gelsin',
    goalsPause: 'Şimdilik dursun',
    proTitle: 'Tam moda dön',
    proBody: 'Alışkanlıklar, hedefler, hafta, ödemeler ve ödüller geri gelir.',
    proGo: 'Dön ve yeniden başlat',
    cancel: 'Vazgeç',
    busyTitle: 'Odak seansın sürüyor',
    busyBody: 'Seans bitince modu değiştirebilirsin.',
    ok: 'Tamam',
    runningTitle: 'Hedeflerin sürüyor',
    runningBody: 'Görevleri listene geliyor. Durdurursan görevleri listeden çekilir, silinmez.',
    pausedTitle: 'Hedeflerin duruyor',
    pausedBody: 'Yeni görev üretmiyor, görevleri listende görünmüyor.',
    resume: 'Görevleri gelsin',
  },
  en: {
    liteTitle: 'Switch to Simple mode',
    lite: 'Only your to-do list and Focus stay. Nothing is deleted.',
    habits: 'Your habits are not tracked and their streaks do not count meanwhile.',
    payments: 'Payment reminders keep coming.',
    goalsAsk: 'You also have goals. Should their tasks keep coming to your list?',
    restart: 'The app will restart.',
    liteGo: 'Switch and restart',
    goalsKeep: 'Keep their tasks',
    goalsPause: 'Pause for now',
    proTitle: 'Back to full mode',
    proBody: 'Habits, goals, week, payments and rewards come back.',
    proGo: 'Go back and restart',
    cancel: 'Cancel',
    busyTitle: 'Your focus session is running',
    busyBody: 'You can change the mode when the session ends.',
    ok: 'OK',
    runningTitle: 'Your goals are running',
    runningBody: 'Their tasks come to your list. If you pause, those tasks leave the list but are not deleted.',
    pausedTitle: 'Your goals are paused',
    pausedBody: 'They add no new tasks and their tasks stay off your list.',
    resume: 'Keep their tasks',
  },
};

const STORE_KEY = 'tazq-prefs-storage';

/** Yeniden başlamadan önce seçim diske inmeli: depo yazımı beklenmiyor, yarım kalırsa açılış eski modu okurdu. Geri okur, inmemişse yazar. */
async function persistMode(next: 'lite' | 'pro'): Promise<void> {
  const raw = await AsyncStorage.getItem(STORE_KEY);
  const saved = raw ? JSON.parse(raw) : null;
  if (saved?.state?.uiMode === next) return;
  const { uiMode, liteGoalsPaused } = usePrefsStore.getState();
  await AsyncStorage.setItem(STORE_KEY, JSON.stringify({ ...saved, state: { ...saved?.state, uiMode, liteGoalsPaused } }));
}

/** Sınav bildirimleri Hedefler sayfası açılınca kurulur; Sade modda kapatılanlar dönüşte o sayfayı beklemesin. */
function restoreExamCountdowns(lang: 'tr' | 'en'): void {
  const s = usePrefsStore.getState().seasonal;
  if (!s.examMode) return;
  if (s.examName && s.examDate) void scheduleExamCountdownNotifs(s.examName, s.examDate, lang, 'exam');
  if (s.exam2Name && s.exam2Date) void scheduleExamCountdownNotifs(s.exam2Name, s.exam2Date, lang, 'exam2');
  if (s.exam3Name && s.exam3Date) void scheduleExamCountdownNotifs(s.exam3Name, s.exam3Date, lang, 'exam3');
}

export async function switchUiMode(next: 'lite' | 'pro', opts: { pauseGoals?: boolean; lang?: 'tr' | 'en' } = {}): Promise<void> {
  const prefs = usePrefsStore.getState();
  prefs.setLiteGoalsPaused(next === 'lite' && !!opts.pauseGoals);
  prefs.setUiMode(next);
  track('ui_mode_changed', { mode: next });
  if (next === 'pro') restoreExamCountdowns(opts.lang ?? 'tr');
  await persistMode(next).catch(e => swallow('uiMode.persist', e, { capture: true }));
  await reloadAppAsync(`ui mode ${next}`).catch(e => swallow('uiMode.reload', e, { capture: true }));
}

export function confirmUiMode(next: 'lite' | 'pro', lang: 'tr' | 'en'): void {
  const c = COPY[lang];
  if (useFocusStore.getState().isActive) {
    Alert.alert(c.busyTitle, c.busyBody, [{ text: c.ok }]);
    return;
  }
  const cancel = { text: c.cancel, style: 'cancel' as const };
  if (next === 'pro') {
    Alert.alert(c.proTitle, `${c.proBody}\n\n${c.restart}`, [cancel, { text: c.proGo, onPress: () => { void switchUiMode('pro', { lang }); } }]);
    return;
  }
  const hasGoals = hasActiveMode(usePrefsStore.getState().seasonal);
  const lines = [c.lite];
  if (useHabitStore.getState().habits.length > 0) lines.push(c.habits);
  if (usePaymentsStore.getState().payments.length > 0) lines.push(c.payments);
  if (hasGoals) lines.push(c.goalsAsk);
  const body = `${lines.join('\n\n')}\n\n${c.restart}`;
  Alert.alert(c.liteTitle, body, hasGoals
    ? [
        { text: c.goalsKeep, onPress: () => { void switchUiMode('lite', { pauseGoals: false }); } },
        { text: c.goalsPause, onPress: () => { void switchUiMode('lite', { pauseGoals: true }); } },
        cancel,
      ]
    : [cancel, { text: c.liteGo, onPress: () => { void switchUiMode('lite'); } }]);
}

/** Sade moddayken tek hedef kararı. Yeniden başlatma gerekmez: yalnız liste süzülür ve plan motoru durur. */
export function confirmGoalsPause(lang: 'tr' | 'en'): void {
  const c = COPY[lang];
  const { liteGoalsPaused, setLiteGoalsPaused } = usePrefsStore.getState();
  const cancel = { text: c.cancel, style: 'cancel' as const };
  if (liteGoalsPaused) {
    Alert.alert(c.pausedTitle, c.pausedBody, [cancel, { text: c.resume, onPress: () => setLiteGoalsPaused(false) }]);
  } else {
    Alert.alert(c.runningTitle, c.runningBody, [cancel, { text: c.goalsPause, onPress: () => setLiteGoalsPaused(true) }]);
  }
}
