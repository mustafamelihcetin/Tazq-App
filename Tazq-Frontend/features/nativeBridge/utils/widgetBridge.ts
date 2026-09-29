import { Appearance } from 'react-native';
import { useHabitStore } from '@/features/habits';
import { useFocusStore } from '@/features/focus/store/useFocusStore';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { useTaskStore } from '@/features/tasks/store/useTaskStore';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { useThemeStore } from '@/shared/store/useThemeStore';
import { fmtDateKey } from '@/features/habits';
import { parseDateKey } from '@/shared/utils/dateKey';
import { wasCompletedOn, todayKey as productTodayKey } from '@/features/dashboard/utils/streakDay';
import { Colors, modeAccent, modeAccentText } from '@/shared/constants/Colors';
import { localizeSporGoal } from '@/features/modes/utils/turkishModes';
import { swallow } from '@/shared/utils/swallow';
import { getTazqWidgetBridge } from '@/modules/tazq-widget-bridge/src/TazqWidgetBridgeModule';

/**
 * Telefon → Ana Ekran Widget'ı ve Apple Watch köprüsü.
 *
 * `getTazqWidgetBridge()` yalnız iOS'ta, native kodu derlenmiş bir build'de dolu
 * döner — Android'de, Expo Go'da ya da native kodu henüz içermeyen ESKİ bir
 * dev client'ta `null`dur. BİLEREK burada, ÇAĞRILDIĞI AN'da (bu fonksiyon
 * `pushWidgetSummary`/`initWatchBridge` içinden, yalnız giriş yapılmışken
 * çağrılır) çözülüyor — modül dosyasındaki notta anlatılan tepe-seviye çağrı
 * uygulamayı splash'te çökertiyordu.
 */
function getBridge() {
  return getTazqWidgetBridge();
}

const WIDGET_MAX_TASK_TITLES = 6;
const WIDGET_TASK_TITLE_MAX_CHARS = 40;
const WATCH_MAX_HABITS = 12;

/**
 * `shared/hooks/useAppTheme.ts` ile AYNI çözümleme mantığı (manuel tema seçiliyse o,
 * 'system' ise cihazın renk şeması) — bu dosya bir React bileşeni değil (düz
 * `getState()` ile bir `useEffect` içinden çağrılıyor), bu yüzden `useColorScheme()`
 * hook'u yerine `Appearance.getColorScheme()` (aynı API'nin imperatif hâli) kullanılıyor.
 *
 * widgets.swift artık `isDark` alanına göre metin rengini (beyaz/siyah) kendi seçiyor
 * (2026-09) — bu yüzden burada zemin/aksan rengini SEÇMEK yeterli, widget tarafı
 * okunabilirliği kendi hesaplıyor.
 */
function resolveIsDark(): boolean {
  const manualTheme = useThemeStore.getState().theme;
  if (manualTheme !== 'system') return manualTheme === 'dark';
  return Appearance.getColorScheme() === 'dark';
}

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
function nearestModeCountdowns(tr: boolean, isDark: boolean): ModeCountdownEntry[] {
  const seasonal = usePrefsStore.getState().seasonal;

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
  const tr = useLanguageStore.getState().language === 'tr';
  // Watch'ın alışkanlık listesi (HabitsView.swift) — SessionStore.swift'teki `WatchHabit`
  // ile AYNI alan adları (id/name/emoji/color/completedToday) zorunlu, JSONDecoder
  // eşleşmeyen anahtarı görmezden gelir ama eksik/yanlış adlı bir alan tüm decode'u
  // reddeder (bkz. SessionStore.swift'teki WatchData yorumu). Sayı sınırı, WCSession'ın
  // updateApplicationContext boyut sınırını (Apple belgelerinde net değil ama küçük
  // tutmak önerilir) aşmamak için — widget'taki görev başlığı sınırıyla aynı gerekçe.
  const watchHabits = habits.slice(0, WATCH_MAX_HABITS).map(h => ({
    id: h.id,
    name: (tr ? h.nameTr : h.nameEn) || h.name,
    emoji: h.emoji,
    color: h.color,
    completedToday: h.completedDates.includes(todayKey),
  }));
  const streak = useFocusStore.getState().localStreak;
  const bestStreak = useFocusStore.getState().bestStreak;
  const tasks = todayTasks();
  const isDark = resolveIsDark();
  const palette = isDark ? Colors.dark : Colors.light;
  const [countdown, countdown2] = nearestModeCountdowns(tr, isDark);

  const payload: Record<string, unknown> = {
    streak,
    // Watch'taki StatsView "En iyi: X" satırı `bestStreak > 0` şartına bağlı — daha önce
    // hiç gönderilmediği için bu satır kalıcı olarak gizliydi. Store zaten tutuyor
    // (bkz. useFocusStore bestStreak), taşımak bedava.
    bestStreak,
    habitsCompletedToday,
    habitsTotal,
    tasksCompletedToday: tasks.done,
    tasksTotal: tasks.total,
    // Widget listeyi kendi biçiminde ister; JSON.stringify edilmiş dizi olarak
    // yazılıyor (UserDefaults düz tipleri tercih eder), Swift tarafı çözüyor.
    taskTitlesJson: JSON.stringify(tasks.titles),
    // DÜZ DİZİ — `taskTitlesJson`'ın aksine string'e ÇEVRİLMİYOR. Watch tarafı bu dict'i
    // doğrudan `JSONDecoder`'a veriyor (bkz. SessionStore.swift `applyData`); widget ise
    // UserDefaults'tan okuyor. Alan adı ve alt-alan adları `WatchHabit` Codable struct'ıyla
    // BİREBİR aynı olmalı (id/name/emoji/color/completedToday) — biri kayarsa decode SESSİZCE
    // tüm mesajı reddeder.
    habits: watchHabits,
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
    /*
      Widget kendi renklerini UYDURMASIN — uygulamanın gerçek açık/koyu paletinden
      (bkz. shared/constants/Colors.ts), kullanıcının GERÇEK tema tercihine göre
      (`resolveIsDark`). ÖNCEDEN hep `Colors.dark` sabitti (açık temadaki kullanıcı
      widget'ta hep koyu görüyordu) — widgets.swift artık `isDark` alanına göre
      metin rengini kendi seçtiği için (2026-09) burada yalnız DOĞRU zemin/aksan
      rengini seçmek yeterli. Palet değişirse widget de kendiliğinden izler;
      Swift tarafında ayrı bir kopya tutmak zamanla sessizce ayrışırdı.
    */
    isDark,
    bgColor: palette.background,
    taskColor: palette.primary,
    habitColor: palette.success,
    streakColor: palette.streak,
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
    /*
      `completeTask` (task store, sayısal id) BURADA YANLIŞTI — Watch'ın gönderdiği
      `habitId` habit store'un STRING id'si (`habit_${Date.now()}_...`, bkz.
      useHabitStore.ts). `Number(...)` her zaman NaN üretiyor, guard hep false
      dönüyor, buton hiçbir zaman çalışmıyordu. Alışkanlık tamamlama tamamen yerel
      (habit store'un persist'i) — `app/_layout.tsx`'teki bildirim eylemi
      ('habit-complete') ile AYNI kalıp: zaten tamamlanmışsa tekrar toggle'lama
      (çift WCSession mesajı gelirse geri almasın).
    */
    const habitId = event.data?.habitId;
    if (typeof habitId !== 'string' || !habitId) return;
    const { toggleDate, habits } = useHabitStore.getState();
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;
    const todayKey = fmtDateKey(new Date());
    if (!(habit.completedDates ?? []).includes(todayKey)) {
      toggleDate(habitId, todayKey);
    }
  });

  return () => sub.remove();
}
