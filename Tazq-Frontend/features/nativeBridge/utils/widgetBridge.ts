import { useHabitStore } from '@/features/habits';
import { useFocusStore } from '@/features/focus/store/useFocusStore';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { useTaskStore } from '@/features/tasks/store/useTaskStore';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { fmtDateKey } from '@/features/habits';
import { parseDateKey } from '@/shared/utils/dateKey';
import { wasCompletedOn, todayKey as productTodayKey } from '@/features/dashboard/utils/streakDay';
import { completeTask } from '@/features/tasks/utils/taskActions';
import { Colors, modeAccent, modeAccentText } from '@/shared/constants/Colors';
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

const WIDGET_MAX_TASK_TITLES = 6;
const WIDGET_TASK_TITLE_MAX_CHARS = 40;

/**
 * Bugünün görev sayısı VE ilk birkaç başlığı — `app/index.tsx`'teki `dayScope`ün
 * SADELEŞTİRİLMİŞ hâli.
 *
 * Widget bir bakış (glance) yüzeyi; "belki bir gün" ayrımı gibi ince kurallar
 * burada YOK — yalnız "vadesi bugüne kadar gelmiş, açık" ve "bugün bitmiş" sayılıyor.
 * Tam listeyle küçük bir fark olması widget için kabul edilebilir; asıl önemli olan
 * TEK bir sayının değil, "görev + alışkanlık" ikisinin birden görünmesiydi.
 *
 * BAŞLIKLAR: `tasks` dizisi zaten store'un kendi sıralamasıyla geliyor (tamamlanmamış
 * önce, öncelik yüksekten düşüğe, sonra en yakın tarih — bkz. useTaskStore.setTasks).
 * Widget'ın kendi sıralama mantığı YOK; aynı kuralı burada tekrarlamak, ikisinin
 * zamanla ayrışması demekti — sırayı olduğu gibi devralıp yalnız FİLTRELİYORUZ.
 */
function todayTasks(): { done: number; total: number; titles: string[] } {
  // `tasks` HAM dizi arşivlenmişleri de içerir (arşiv ayrı bir sütun değil,
  // `isArchived` bayrağıyla yaşıyor — bkz. useTaskStore.useActiveTasks). Süzülmeseydi
  // arşivlenmiş ama tarihi geçmemiş bir görev widget'ta yanlışlıkla görünürdü.
  const tasks = useTaskStore.getState().tasks.filter(t => !t.isArchived);
  const todayEndMs = new Date().setHours(23, 59, 59, 999);
  const today = productTodayKey();

  const dueAt = (t: { dueDate?: string | null }) => {
    if (!t?.dueDate || String(t.dueDate).startsWith('0001')) return null;
    const ms = new Date(t.dueDate).getTime();
    return Number.isNaN(ms) ? null : ms;
  };

  const open = tasks.filter(t => !t.isCompleted && dueAt(t) !== null && dueAt(t)! <= todayEndMs);
  const doneToday = tasks.filter(t => t.isCompleted && wasCompletedOn(t, today)).length;
  const titles = open.slice(0, WIDGET_MAX_TASK_TITLES).map(t =>
    t.title.length > WIDGET_TASK_TITLE_MAX_CHARS ? `${t.title.slice(0, WIDGET_TASK_TITLE_MAX_CHARS - 1)}…` : t.title
  );
  return { done: doneToday, total: open.length + doneToday, titles };
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
 * En yakın tarihli aktif modlar — Geri Sayım widget'ının tek veri kaynağı.
 *
 * En fazla İKİ döner: küçük widget yalnız ilkini kullanır, orta boy widget
 * ikisini yan yana gösterir (birden fazla aktif dönemi olan kullanıcı için —
 * ör. hem sınav hem tez — tek geri sayımla diğerini hiç göstermemek eksikti).
 *
 * `useActiveModeSummary` hook'unun BİLEREK küçültülmüş hâli: o hook React içinde
 * (tema/dil hook'ları) çalışır, bu fonksiyon ise bir `useEffect` içinden düz
 * `getState()` ile çağrılır. Habit/task ilerleme yüzdesi widget'ta gösterilmiyor,
 * bu yüzden onun hesapları burada YOK — yalnız ad/gün/renk/emoji.
 */
function nearestModeCountdowns(tr: boolean): ModeCountdownEntry[] {
  const seasonal = usePrefsStore.getState().seasonal;
  const isDark = true; // widget zemini her zaman koyu (bkz. widgets.swift) — koyu tema tonları kullanılıyor.

  const daysLeftOf = (dateStr: string | null | undefined): number | null => {
    if (!dateStr) return null;
    // `new Date(dateStr)` DEĞİL — negatif ofsetli saat dilimlerinde (ör. ABD) bir
    // gün geri kayar, bkz. shared/utils/dateKey.ts'teki parseDateKey belgelemesi.
    // Aynı hatayı burada tekrar açmamak için o yardımcıyı kullanıyoruz.
    const end = parseDateKey(dateStr).setHours(23, 59, 59, 999);
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

  return dated.slice(0, 2).map(d => ({
    label: d.label,
    days: d.days,
    color: modeAccent(d.key, isDark),
    textColor: modeAccentText(d.key, isDark),
    emoji: d.emoji,
  }));
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
  const tasks = todayTasks();
  const tr = useLanguageStore.getState().language === 'tr';
  const [countdown, countdown2] = nearestModeCountdowns(tr);

  const payload: Record<string, unknown> = {
    streak,
    habitsCompletedToday,
    habitsTotal,
    tasksCompletedToday: tasks.done,
    tasksTotal: tasks.total,
    // Widget listeyi kendi biçiminde ister; JSON.stringify edilmiş dizi olarak
    // yazılıyor (UserDefaults düz tipleri tercih eder), Swift tarafı çözüyor.
    taskTitlesJson: JSON.stringify(tasks.titles),
    language: useLanguageStore.getState().language,
    countdownLabel: countdown?.label ?? null,
    countdownDays: countdown?.days ?? null,
    countdownColor: countdown?.color ?? null,
    countdownTextColor: countdown?.textColor ?? null,
    countdownEmoji: countdown?.emoji ?? null,
    countdown2Label: countdown2?.label ?? null,
    countdown2Days: countdown2?.days ?? null,
    countdown2Color: countdown2?.color ?? null,
    countdown2TextColor: countdown2?.textColor ?? null,
    countdown2Emoji: countdown2?.emoji ?? null,
    // Widget kendi renklerini UYDURMASIN — uygulamanın gerçek koyu tema paletinden
    // (bkz. shared/constants/Colors.ts `dark`). Palet değişirse widget de kendiliğinden
    // izler; Swift tarafında ayrı bir kopya tutmak zamanla sessizce ayrışırdı.
    bgColor: Colors.dark.background,
    taskColor: Colors.dark.primary,
    habitColor: Colors.dark.success,
    streakColor: Colors.dark.streak,
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
