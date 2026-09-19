import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTaskStore } from '@/features/tasks/store/useTaskStore';
import { getLocalizedTaskTitle } from '@/features/tasks';
import { getModeInfoForTask, usePrefsStore } from '@/features/modes';
import { isWeightEntryTask } from '@/features/modes/utils/weightCheckin';
import {
  analyzeLoad, planOverdue, planTriage, isDayOverloaded, PLAN_TAGS,
  type BalancerTask, type LoadAnalysis, type RebalancePlan,
} from '@/features/tasks/utils/taskBalancer';
import { applyRebalance, type AppliedRebalance } from '@/features/tasks/utils/rebalanceActions';
import { useToastStore } from '@/shared/store/useToastStore';
import { toDateKey } from '@/shared/utils/dateKey';
import { swallow } from '@/shared/utils/swallow';

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

const copy = (tr: boolean) => tr
  ? {
      done: (s: number, d: number) => [
        s > 0 ? `${s} görev önümüzdeki günlere yayıldı` : '',
        d > 0 ? `${d} görev Belki Bir Gün'e alındı` : '',
      ].filter(Boolean).join(' · '),
      failed: (n: number) => `${n} görev taşınamadı — sunucu reddetti`,
      nothing: 'Dengelenecek bir yük yok',
      undo: 'Geri al',
      triageDone: (title: string) => `Bugün "${title}" kaldı`,
    }
  : {
      done: (s: number, d: number) => [
        s > 0 ? `${s} tasks spread over the coming days` : '',
        d > 0 ? `${d} moved to Someday` : '',
      ].filter(Boolean).join(' · '),
      failed: (n: number) => `${n} tasks couldn't be moved — the server refused`,
      nothing: 'Nothing to rebalance right now',
      undo: 'Undo',
      triageDone: (title: string) => `Today: just "${title}"`,
    };

export interface ZenApi {
  analysis: LoadAnalysis;
  /** Kartın önizlemesi — "Dengele"ye basınca ne olacağı. */
  overduePlan: RebalancePlan;
  cardVisible: boolean;
  dismissCard: () => void;
  /** Birikmiş işi dağıtır; kart kendi geri alma düğmesini bu tutamaçla çizer. */
  rebalanceOverdue: () => Promise<AppliedRebalance>;
  /** Menünün "Günü Kurtar"ı: duruma göre dağıt · triage · "yük yok". */
  saveTheDay: () => Promise<void>;
  triageVisible: boolean;
  closeTriage: () => void;
  /** Seçilecek görev için ÖNİZLEME (kaçı taşınır, kaçı rafa). */
  previewTriage: (keepId: number) => RebalancePlan;
  confirmTriage: (keepId: number) => Promise<void>;
  /** Bugün yerinde kalacak plan görevleri — triage kullanıcıya söyler. */
  todayPlanCount: number;
}

export function useZen(language: string): ZenApi {
  const tasks = useTaskStore((s) => s.tasks) as unknown as BalancerTask[];
  const prefs = usePrefsStore();
  const tr = language === 'tr';
  const c = useMemo(() => copy(tr), [tr]);

  /*
    Plan görevini tanıma: etiketler + mod bilgisi + başlıktan tanınan kilo görevi.
    Motor dışarıdan alıyor ki mod mağazasına bağlanmasın (bkz. taskBalancer).
  */
  const isPlanTask = useCallback(
    (t: BalancerTask) =>
      (t.tags ?? []).some((tag) => PLAN_TAGS.includes(tag)) ||
      isWeightEntryTask(t as any) ||
      !!getModeInfoForTask(t as any, prefs, null),
    [prefs],
  );

  const analysis = useMemo(() => analyzeLoad(tasks, { isPlanTask }), [tasks, isPlanTask]);
  const overduePlan = useMemo(() => planOverdue(tasks, { isPlanTask }), [tasks, isPlanTask]);
  const todayPlanCount = analysis.todayLoad - analysis.movableToday.length;

  /*
    "BEN HALLEDERİM" GÜN BOYU GEÇERLİ. Önceki kart bunu bileşen durumunda tutuyordu:
    uygulama yeniden açılınca kart geri geliyor, kullanıcının az önce verdiği "istemiyorum"
    cevabı unutuluyordu. Ertesi gün yeniden sorulur — birikim o zaman başka olabilir.
  */
  const today = toDateKey(new Date());
  const [dismissedDay, setDismissedDay] = useState<string | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(DISMISS_KEY)
      .then(setDismissedDay)
      .catch((e) => swallow('zen.readDismiss', e));
  }, []);
  const dismissCard = useCallback(() => {
    setDismissedDay(today);
    AsyncStorage.setItem(DISMISS_KEY, today).catch((e) => swallow('zen.writeDismiss', e));
  }, [today]);

  const cardVisible = analysis.movableOverdue.length >= CARD_THRESHOLD && dismissedDay !== today;

  const ctx = useMemo(
    () => ({ language, hideNotificationContent: !!prefs.hideNotificationContent }),
    [language, prefs.hideNotificationContent],
  );

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
    () => planOverdue(useTaskStore.getState().tasks as unknown as BalancerTask[], { isPlanTask }),
    [isPlanTask],
  );

  const rebalanceOverdue = useCallback(
    () => applyRebalance(freshOverduePlan(), ctx),
    [freshOverduePlan, ctx],
  );

  const [triageVisible, setTriageVisible] = useState(false);

  const saveTheDay = useCallback(async () => {
    const live = analyzeLoad(useTaskStore.getState().tasks as unknown as BalancerTask[], { isPlanTask });
    if (live.movableOverdue.length > 0) {
      announce(await applyRebalance(freshOverduePlan(), ctx));
      return;
    }
    if (isDayOverloaded(live)) {
      setTriageVisible(true);
      return;
    }
    useToastStore.getState().show(c.nothing, 'info');
  }, [isPlanTask, freshOverduePlan, ctx, announce, c]);

  const previewTriage = useCallback(
    (keepId: number) => planTriage(keepId, tasks, { isPlanTask }),
    [tasks, isPlanTask],
  );

  const confirmTriage = useCallback(async (keepId: number) => {
    setTriageVisible(false);
    const live = useTaskStore.getState().tasks as unknown as BalancerTask[];
    const kept = live.find((t) => t.id === keepId);
    const applied = await applyRebalance(planTriage(keepId, live, { isPlanTask }), ctx);
    // Kullanıcının ekranda GÖRDÜĞÜ ad (plan görevlerinin ham başlığı farklı olabilir).
    announce(applied, kept ? c.triageDone(getLocalizedTaskTitle(kept as any, tr)) : undefined);
  }, [isPlanTask, ctx, announce, c, tr]);

  return {
    analysis,
    overduePlan,
    cardVisible,
    dismissCard,
    rebalanceOverdue,
    saveTheDay,
    triageVisible,
    closeTriage: () => setTriageVisible(false),
    previewTriage,
    confirmTriage,
    todayPlanCount,
  };
}
