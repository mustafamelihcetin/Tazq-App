import { useHabitStore } from '@/features/habits';
import { useFocusStore } from '@/features/focus/store/useFocusStore';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { useTaskStore } from '@/features/tasks/store/useTaskStore';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { fmtDateKey } from '@/features/habits';
import { wasCompletedOn, todayKey as productTodayKey } from '@/features/dashboard/utils/streakDay';
import { completeTask } from '@/features/tasks/utils/taskActions';
import { modeAccent, modeAccentText } from '@/shared/constants/Colors';
import { localizeSporGoal } from '@/features/modes/utils/turkishModes';
import { swallow } from '@/shared/utils/swallow';
import TazqWidgetBridge from '@/modules/tazq-widget-bridge/src/TazqWidgetBridgeModule';

/**
 * Telefon → Ana Ekran Widget'ı ve Apple Watch köprüsü.
 *
 * `TazqWidgetBridge` yalnız iOS'ta, native kodu derlenmiş bir build'de dolu
 * gelir — Android'de, Expo Go'da ya da native kodu henüz içermeyen ESKİ bir
 * dev client'ta `null`dur (bkz. modül dosyasındaki `requireOptionalNativeModule`
 * notu). Her çağıran bu tek fonksiyondan geçtiği için platform/derleme
 * kontrolü tek yerde kalıyor.
 */
function getBridge(): typeof TazqWidgetBridge {
  return TazqWidgetBridge;
}

/**
 * Bugünün görev sayısı — `app/index.tsx`'teki `dayScope`ün SADELEŞTİRİLMİŞ hâli.
 *
 * Widget bir bakış (glance) yüzeyi; "belki bir gün" ayrımı gibi ince kurallar
 * burada YOK — yalnız "vadesi bugüne kadar gelmiş, açık" ve "bugün bitmiş" sayılıyor.
 * Tam listeyle küçük bir fark olması widget için kabul edilebilir; asıl önemli olan
 * TEK bir sayının değil, "görev + alışkanlık" ikisinin birden görünmesiydi.
 */
function todayTaskCounts(): { done: number; total: number } {
  const tasks = useTaskStore.getState().tasks;
  const todayEndMs = new Date().setHours(23, 59, 59, 999);
  const today = productTodayKey();

  const dueAt = (t: { dueDate?: string | null }) => {
    if (!t?.dueDate || String(t.dueDate).startsWith('0001')) return null;
    const ms = new Date(t.dueDate).getTime();
    return Number.isNaN(ms) ? null : ms;
  };

  const openToday = tasks.filter(t => !t.isCompleted && dueAt(t) !== null && dueAt(t)! <= todayEndMs).length;
  const doneToday = tasks.filter(t => t.isCompleted && wasCompletedOn(t, today)).length;
  return { done: doneToday, total: openToday + doneToday };
}

interface ModeCountdownEntry {
  label: string;
  days: number;
  color: string;
  textColor: string;
  emoji: string;
}

/** Kullanıcının ad girmediği modlar için sözlükten gelen ad — satır içi dallanma yerine (bkz. i18nRatchet). */
const FALLBACK_MODE_LABEL: Record<'exam' | 'tez' | 'mulakat' | 'spor' | 'tasarruf', { tr: string; en: string }> = {
  exam: { tr: 'Sınav', en: 'Exam' },
  tez: { tr: 'Tez', en: 'Thesis' },
  mulakat: { tr: 'Mülakat', en: 'Interview' },
  spor: { tr: 'Spor', en: 'Fitness' },
  tasarruf: { tr: 'Tasarruf', en: 'Savings' },
};

/**
 * En yakın tarihli aktif mod — Geri Sayım widget'ının tek veri kaynağı.
 *
 * `useActiveModeSummary` hook'unun BİLEREK küçültülmüş hâli: o hook React içinde
 * (tema/dil hook'ları) çalışır, bu fonksiyon ise bir `useEffect` içinden düz
 * `getState()` ile çağrılır. Habit/task ilerleme yüzdesi widget'ta gösterilmiyor,
 * bu yüzden onun hesapları burada YOK — yalnız ad/gün/renk/emoji.
 */
function nearestModeCountdown(tr: boolean): ModeCountdownEntry | null {
  const seasonal = usePrefsStore.getState().seasonal;
  const isDark = true; // widget zemini her zaman koyu (bkz. widgets.swift) — koyu tema tonları kullanılıyor.

  const daysLeftOf = (dateStr: string | null | undefined): number | null => {
    if (!dateStr) return null;
    const end = new Date(dateStr).setHours(23, 59, 59, 999);
    if (Number.isNaN(end) || end < Date.now()) return null;
    return Math.max(0, Math.ceil((end - Date.now()) / 86400000));
  };

  const fallback = (key: keyof typeof FALLBACK_MODE_LABEL) => tr ? FALLBACK_MODE_LABEL[key].tr : FALLBACK_MODE_LABEL[key].en;

  const candidates: { key: string; label: string; date: string | null | undefined; emoji: string }[] = [];
  if (seasonal.examMode) candidates.push({ key: 'exam', label: seasonal.examName || fallback('exam'), date: seasonal.examDate, emoji: '🎯' });
  if (seasonal.tezMode) candidates.push({ key: 'tez', label: seasonal.tezName || fallback('tez'), date: seasonal.tezDate, emoji: '📚' });
  if (seasonal.mulakatMode) candidates.push({ key: 'mulakat', label: seasonal.mulakatName || fallback('mulakat'), date: seasonal.mulakatDate, emoji: '💼' });
  if (seasonal.sporMode) candidates.push({ key: 'spor', label: localizeSporGoal(seasonal.sporGoal, tr) || fallback('spor'), date: seasonal.sporDate, emoji: '💪' });
  if (seasonal.tasarrufMode) candidates.push({ key: 'tasarruf', label: seasonal.tasarrufName || fallback('tasarruf'), date: seasonal.tasarrufDate, emoji: '💰' });

  const dated = candidates
    .map(c => ({ ...c, days: daysLeftOf(c.date) }))
    .filter((c): c is typeof c & { days: number } => c.days !== null)
    .sort((a, b) => a.days - b.days);

  if (dated.length === 0) return null;
  const nearest = dated[0];
  return {
    label: nearest.label,
    days: nearest.days,
    color: modeAccent(nearest.key, isDark),
    textColor: modeAccentText(nearest.key, isDark),
    emoji: nearest.emoji,
  };
}

let lastPushedJson = '';

/**
 * Widget/Watch'ın gösterdiği özeti hesaplar ve değiştiyse native tarafa yazar.
 *
 * Aynı JSON'u art arda yazmamak için son gönderilenle karşılaştırılıyor — bu,
 * her render'da native köprüyü (ve WCSession'ı) tetiklemeden, bir `useEffect`
 * içinde state değişince çağrılabilmesini sağlıyor.
 */
export function pushWidgetSummary(): void {
  const bridge = getBridge();
  if (!bridge) return;

  const habits = useHabitStore.getState().habits;
  const todayKey = fmtDateKey(new Date());
  const habitsTotal = habits.length;
  const habitsCompletedToday = habits.filter(h => h.completedDates.includes(todayKey)).length;
  const streak = useFocusStore.getState().localStreak;
  const tasks = todayTaskCounts();
  const tr = useLanguageStore.getState().language === 'tr';
  const countdown = nearestModeCountdown(tr);

  const payload: Record<string, unknown> = {
    streak,
    habitsCompletedToday,
    habitsTotal,
    tasksCompletedToday: tasks.done,
    tasksTotal: tasks.total,
    language: useLanguageStore.getState().language,
    countdownLabel: countdown?.label ?? null,
    countdownDays: countdown?.days ?? null,
    countdownColor: countdown?.color ?? null,
    countdownTextColor: countdown?.textColor ?? null,
    countdownEmoji: countdown?.emoji ?? null,
  };

  const json = JSON.stringify(payload);
  if (json === lastPushedJson) return;
  lastPushedJson = json;
  bridge.updateSharedData(json).catch((e: unknown) => swallow('nativeWidgetBridge.push', e));
}

/**
 * Watch'tan gelen tek eylemi dinler: alışkanlık tamamlama.
 *
 * Odak başlat/durdur BİLEREK dinlenmiyor — telefondaki odak akışı commit/claim
 * adımlarıyla bir durum makinesi; Watch'tan körlemesine yazmak yarım ya da çift
 * oturum riski taşır. Bkz. modules/tazq-widget-bridge/ios/TazqWidgetBridgeModule.swift.
 *
 * `app/_layout.tsx`'teki bildirim dinleyicisiyle aynı desen: tek başlatma
 * noktası, `[isLoggedIn]` bağımlı bir effect içinde çağrılır.
 */
export function initWatchBridge(): () => void {
  const bridge = getBridge();
  if (!bridge) return () => {};

  const sub = bridge.addListener('onWatchAction', (event) => {
    if (event.type !== 'habitCompleted') return;
    const habitId = Number(event.data?.habitId);
    if (!Number.isFinite(habitId)) return;
    completeTask(habitId).catch((e: unknown) => swallow('nativeWidgetBridge.watchAction', e));
  });

  return () => sub.remove();
}
