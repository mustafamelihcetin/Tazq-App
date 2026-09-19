import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTaskStore, type Task } from '@/features/tasks/store/useTaskStore';
import { getLocalizedTaskTitle, isSomeday } from '@/features/tasks';
import { getModeInfoForTask, usePrefsStore } from '@/features/modes';
import { isWeightEntryTask } from '@/features/modes/utils/weightCheckin';
import {
  analyzeLoad, planOverdue, planTriage, isDayOverloaded, PLAN_TAGS,
  type LoadAnalysis, type RebalancePlan,
} from '@/features/tasks/utils/taskBalancer';
import { applyRebalance, type AppliedRebalance } from '@/features/tasks/utils/rebalanceActions';
import { useToastStore } from '@/shared/store/useToastStore';
import { toDateKey, parseDateKey } from '@/shared/utils/dateKey';
import { swallow } from '@/shared/utils/swallow';
import { haptic } from '@/shared/utils/haptics';

/**
 * TAZQZen — ana ekrandaki TEK giriş.
 *
 * ── NEDEN TEK KANCA ─────────────────────────────────────────────────────────────
 * Aynı soruna ("birikmiş ya da taşan iş") ekranda ÜÇ ayrı cevap veriliyordu ve
 * birbirini yalanlıyordu:
 *
 *  · "Zen" kartının "Dengele"si bütün gecikmişleri YARINA yığıyordu. Yarın hepsi yine
 *    gecikiyor, kart yine çıkıyordu — kısır bir döngü.
 *  · Menünün "Günü Kurtar"ı gerçek dağıtım motorunu çalıştırıyordu (7 gün, günde 5).
 *  · Triage kendi hesabını yapıyordu.
 *
 * Aynı durumda iki düğme iki farklı sonuç veriyordu. Artık hepsi aynı motoru, aynı
 * uygun-görev kuralını ve aynı uygulama yolunu (geri alınabilir) kullanıyor.
 *
 * ── HANGİ DURUMDA NE OLUR ───────────────────────────────────────────────────────
 *  · Birikmiş iş varsa (taşınabilir gecikmiş görev): dağıt.
 *      – Kart kendiliğinden, en az 3 tane birikince önerir (tek bir gecikme için
 *        ekranı kaplayan bir öneri, yardımdan çok gürültüdür).
 *      – Menü, kullanıcı ISTEDİĞİ için 1 tane bile olsa çalışır.
 *  · Birikim yok ama bugün kapasiteyi aşıyorsa: triage — kullanıcı bugün yapacağı
 *    TEK işi seçer, kalanı dağıtılır.
 *  · İkisi de yoksa: dengelenecek bir şey olmadığı söylenir.
 */

/** Kartın kendiliğinden çıkması için gereken birikim. */
export const CARD_THRESHOLD = 3;
const DISMISS_KEY = '@zen_card_dismissed_day';
const SOMEDAY_NUDGE_KEY = '@zen_someday_nudge_day';
/** Raf hatırlatmasının sıklığı. Daha sık, rafa kaldırmanın anlamını yok eder. */
export const SOMEDAY_NUDGE_EVERY_DAYS = 7;

const copy = (tr: boolean) => tr
  ? {
      done: (s: number, d: number) => [
        s > 0 ? `${s} görev önümüzdeki günlere yayıldı` : '',
        d > 0 ? `${d} görev Belki Bir Gün'e alındı` : '',
      ].filter(Boolean).join(' · '),
      failed: (n: number) => `${n} görev taşınamadı — sunucu reddetti`,
      nothing: 'Dengelenecek bir yük yok',
      hintOverdue: (n: number) => `${n} birikmiş işi günlere yay`,
      hintOverload: (n: number) => `Bugün ${n} iş var — sadeleştir`,
      undo: 'Geri al',
      triageDone: (title: string) => `Bugün "${title}" kaldı`,
      triageDoneMany: (n: number) => `Bugün ${n} iş kaldı`,
    }
  : {
      done: (s: number, d: number) => [
        s > 0 ? `${s} tasks spread over the coming days` : '',
        d > 0 ? `${d} moved to Someday` : '',
      ].filter(Boolean).join(' · '),
      failed: (n: number) => `${n} tasks couldn't be moved — the server refused`,
      nothing: 'Nothing to rebalance right now',
      hintOverdue: (n: number) => `Spread ${n} overdue tasks over the coming days`,
      hintOverload: (n: number) => `${n} tasks today — simplify`,
      undo: 'Undo',
      triageDone: (title: string) => `Today: just "${title}"`,
      triageDoneMany: (n: number) => `Today: ${n} tasks`,
    };

export interface ZenApi {
  analysis: LoadAnalysis<Task>;
  /** Kartın önizlemesi — "Dengele"ye basınca ne olacağı. */
  overduePlan: RebalancePlan<Task>;
  cardVisible: boolean;
  dismissCard: () => void;
  /** Birikmiş işi dağıtır; kart kendi geri alma düğmesini bu tutamaçla çizer. */
  rebalanceOverdue: () => Promise<AppliedRebalance>;
  /** Paletin "Günü Kurtar"ı: duruma göre dağıt · triage · "yük yok". */
  saveTheDay: () => Promise<void>;
  /** "Günü Kurtar"ın ne yapacağı (palet satırı söyler); yapılacak bir şey yoksa null. */
  saveTheDayHint: string | null;
  /** Taşan gün kartı: birikim kartı yokken ve bugün kapasiteyi aşarken. */
  overloadVisible: boolean;
  openTriage: () => void;
  triageVisible: boolean;
  closeTriage: () => void;
  /** Seçilecek görev için ÖNİZLEME (kaçı taşınır, kaçı rafa). */
  previewTriage: (keepIds: readonly number[]) => RebalancePlan<Task>;
  confirmTriage: (keepIds: readonly number[]) => Promise<void>;
  /** Bugün yerinde kalacak SABİT görevler (plan, saatli, tekrarlayan) — triage söyler. */
  todayFixedCount: number;
  /** Rafta (Belki Bir Gün) bekleyen açık iş sayısı. */
  somedayCount: number;
  /** Haftalık "rafta N iş var" hatırlatması şimdi gösterilmeli mi. */
  somedayNudgeVisible: boolean;
  /** Hatırlatma görüldü (açıldı ya da ertelendi) — bir hafta sessiz. */
  markSomedayNudge: () => void;
}

export function useZen(language: string): ZenApi {
  const tasks = useTaskStore((s) => s.tasks);
  const prefs = usePrefsStore();
  const tr = language === 'tr';
  const c = useMemo(() => copy(tr), [tr]);

  /*
    Plan görevini tanıma: etiketler + mod bilgisi + başlıktan tanınan kilo görevi.
    Motor dışarıdan alıyor ki mod mağazasına bağlanmasın (bkz. taskBalancer).
  */
  const isPlanTask = useCallback(
    (t: Task) =>
      (t.tags ?? []).some((tag) => PLAN_TAGS.includes(tag)) ||
      isWeightEntryTask(t) ||
      !!getModeInfoForTask(t, prefs, null),
    [prefs],
  );

  const analysis = useMemo(() => analyzeLoad(tasks, { isPlanTask }), [tasks, isPlanTask]);
  const overduePlan = useMemo(() => planOverdue(tasks, { isPlanTask }), [tasks, isPlanTask]);
  const todayFixedCount = analysis.todayLoad - analysis.movableToday.length;

  /*
    "BEN HALLEDERİM" GÜN BOYU GEÇERLİ. Önceki kart bunu bileşen durumunda tutuyordu:
    uygulama yeniden açılınca kart geri geliyor, kullanıcının az önce verdiği "istemiyorum"
    cevabı unutuluyordu. Ertesi gün yeniden sorulur — birikim o zaman başka olabilir.
  */
  const today = toDateKey(new Date());
  const [dismissedDay, setDismissedDay] = useState<string | null>(null);
  // Kayıt okunana kadar kart çizilmez: yoksa bugün reddedilmiş kart açılışta bir an
  // görünüp kaybolurdu.
  const [dismissLoaded, setDismissLoaded] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(DISMISS_KEY)
      .then(setDismissedDay)
      .catch((e) => swallow('zen.readDismiss', e))
      .finally(() => setDismissLoaded(true));
  }, []);
  const dismissCard = useCallback(() => {
    setDismissedDay(today);
    AsyncStorage.setItem(DISMISS_KEY, today).catch((e) => swallow('zen.writeDismiss', e));
  }, [today]);

  const cardVisible = dismissLoaded && analysis.movableOverdue.length >= CARD_THRESHOLD && dismissedDay !== today;

  /*
    RAF HATIRLATMASI — "Belki Bir Gün" kara delik olmasın.

    Rafa kalkan iş başka hiçbir yerde kendini hatırlatmıyordu; kullanıcı için bu,
    "uygulama işimi sildi" demekti. Haftada en fazla bir kez, yalnız rafta iş varken ve
    Zen kartı ekranda değilken sorulur — iki Zen yüzeyi aynı anda gürültüdür. İş rafa
    kaldırıldığı GÜN sayaç sıfırlanır: az önce kaldırdığın şeyi hemen sormak anlamsız.
  */
  const somedayCount = useMemo(
    () => tasks.filter((t) => !t.isCompleted && !t.isArchived && isSomeday(t)).length,
    [tasks],
  );
  const [nudgeDay, setNudgeDay] = useState<string | null>(null);
  const [nudgeLoaded, setNudgeLoaded] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(SOMEDAY_NUDGE_KEY)
      .then(setNudgeDay)
      .catch((e) => swallow('zen.readNudge', e))
      .finally(() => setNudgeLoaded(true));
  }, []);
  const markSomedayNudge = useCallback(() => {
    setNudgeDay(today);
    AsyncStorage.setItem(SOMEDAY_NUDGE_KEY, today).catch((e) => swallow('zen.writeNudge', e));
  }, [today]);
  const daysSinceNudge = nudgeDay
    ? Math.round((parseDateKey(today).getTime() - parseDateKey(nudgeDay).getTime()) / 86400000)
    : Infinity;
  /*
    TAŞAN GÜN KARTI. Triage eskiden yalnız logonun açtığı menüden ulaşılabiliyordu —
    çoğu kullanıcının hiç keşfetmeyeceği bir yer. Birikim kartıyla AYNI "bugün sorma"
    kararını paylaşır ve ondan sonra gelir: iki Zen kartı aynı anda gürültüdür.
  */
  const overloadVisible = dismissLoaded && !cardVisible && dismissedDay !== today && isDayOverloaded(analysis);

  const somedayNudgeVisible = nudgeLoaded && somedayCount > 0 && !cardVisible && !overloadVisible
    && daysSinceNudge >= SOMEDAY_NUDGE_EVERY_DAYS;

  const saveTheDayHint = analysis.movableOverdue.length > 0
    ? c.hintOverdue(analysis.movableOverdue.length)
    : isDayOverloaded(analysis) ? c.hintOverload(analysis.todayLoad) : null;

  const ctx = useMemo(
    () => ({ language, hideNotificationContent: !!prefs.hideNotificationContent }),
    [language, prefs.hideNotificationContent],
  );

  /*
    TEK TİTREŞİM, TEK YER. Aynı iş üç girişten yapılıyor (kart, menü, triage); biri
    titreşip öteki susarsa kullanıcı onların farklı şeyler yaptığını sanır. Titreşim
    dokunuşta değil SONUÇTA: yalnız gerçekten bir şey taşındıysa.
  */
  const settle = useCallback((applied: AppliedRebalance) => {
    if (applied.moved > 0) haptic.success();
    // Bugün rafa kalkan var → hatırlatma sayacı bugünden başlar (ilk hatırlatma bir hafta sonra).
    if (applied.someday > 0) markSomedayNudge();
    return applied;
  }, [markSomedayNudge]);

  const announce = useCallback((applied: AppliedRebalance, lead?: string) => {
    const show = useToastStore.getState().show;
    if (applied.moved === 0) {
      // Hiçbir şey taşınmadıysa ya sunucu reddetti ya da görevler o arada kapandı —
      // boş bir "tamamlandı" mesajı ve işe yaramayan bir "geri al" göstermek yanlış olur.
      show(applied.failed > 0 ? c.failed(applied.failed) : c.nothing, applied.failed > 0 ? 'error' : 'info');
      return;
    }
    const body = [lead, c.done(applied.scheduled, applied.someday)].filter(Boolean).join(' · ');
    show(body, applied.failed > 0 ? 'info' : 'success', { label: c.undo, onAction: () => { void applied.undo(); } });
  }, [c]);

  /*
    Plan UYGULAMA ANINDA yeniden hesaplanıyor, önizlemeden kopyalanmıyor: önizleme
    birkaç saniye önce çizildi ve o arada bir görev tamamlanmış ya da eklenmiş olabilir.
  */
  const freshOverduePlan = useCallback(
    () => planOverdue(useTaskStore.getState().tasks, { isPlanTask }),
    [isPlanTask],
  );

  const rebalanceOverdue = useCallback(async () => {
    const applied = settle(await applyRebalance(freshOverduePlan(), ctx));
    // Kart başarıyı kendi çiziyor; hiçbir şey taşınmadıysa (sunucu reddi) sessiz
    // kalmasın — neden olmadığını toast söyler.
    if (applied.moved === 0) announce(applied);
    return applied;
  }, [freshOverduePlan, ctx, settle, announce]);

  const [triageVisible, setTriageVisible] = useState(false);

  const saveTheDay = useCallback(async () => {
    const live = analyzeLoad(useTaskStore.getState().tasks, { isPlanTask });
    if (live.movableOverdue.length > 0) {
      announce(settle(await applyRebalance(freshOverduePlan(), ctx)));
      return;
    }
    if (isDayOverloaded(live)) {
      setTriageVisible(true);
      return;
    }
    useToastStore.getState().show(c.nothing, 'info');
  }, [isPlanTask, freshOverduePlan, ctx, announce, settle, c]);

  const previewTriage = useCallback(
    (keepIds: readonly number[]) => planTriage(keepIds, tasks, { isPlanTask }),
    [tasks, isPlanTask],
  );

  const confirmTriage = useCallback(async (keepIds: readonly number[]) => {
    setTriageVisible(false);
    const live = useTaskStore.getState().tasks;
    const kept = live.filter((t) => keepIds.includes(t.id));
    const applied = settle(await applyRebalance(planTriage(keepIds, live, { isPlanTask }), ctx));
    // Tek görevde adı söylenir — kullanıcının ekranda GÖRDÜĞÜ ad (plan görevlerinin ham
    // başlığı farklı olabilir); birden fazlasında sayı.
    const lead = kept.length === 1 ? c.triageDone(getLocalizedTaskTitle(kept[0], tr))
      : kept.length > 1 ? c.triageDoneMany(kept.length) : undefined;
    announce(applied, lead);
  }, [isPlanTask, ctx, announce, settle, c, tr]);

  return {
    analysis,
    overduePlan,
    cardVisible,
    dismissCard,
    rebalanceOverdue,
    saveTheDay,
    saveTheDayHint,
    overloadVisible,
    openTriage: () => setTriageVisible(true),
    triageVisible,
    closeTriage: () => setTriageVisible(false),
    previewTriage,
    confirmTriage,
    todayFixedCount,
    somedayCount,
    somedayNudgeVisible,
    markSomedayNudge,
  };
}
