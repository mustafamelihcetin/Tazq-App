import React, { useCallback, useContext, useMemo, createContext } from 'react';
import { useHabitStore, fmtDateKey } from '@/features/habits';
import { useToastStore } from '@/shared/store/useToastStore';
import { haptic } from '@/shared/utils/haptics';
import { calendarDayOf, toDateKey } from '@/shared/utils/dateKey';
import { usePrefsStore, type PlanMode } from '@/features/modes/store/usePrefsStore';
import { retirePlanTasksFromToday } from '@/features/modes/utils/planTaskOps';
import { isPausedOn, pauseDaysLeft, pauseUntilKey } from '@/features/modes/utils/planPause';
import { skipPlanHabitsToday } from '@/features/modes/utils/pauseOps';
import { planArcFor, type PlanArc } from '@/features/modes/utils/planArc';

/**
 * BİR PLANIN YAŞAM DÖNGÜSÜ — ara verme ve kat edilen yol.
 *
 * Kartların dördü de (sınav, tez, mülakat, spor) aynı iki soruyu soruyor: "bu plana
 * ara verebilir miyim" ve "ne kadar yol aldım". Dört kartta dört kez yazılsaydı
 * zamanla ayrışırlardı — sınav ara vermeyi görevleri silerek, spor ise silmeden
 * uygulardı ve kullanıcı hangi karttan ara verdiğine göre farklı sonuç alırdı.
 */

/**
 * Plan yeniden üretimini tetikleyen geri çağrı.
 *
 * Devam edildiğinde günün görevlerinin HEMEN üretilmesi gerekiyor; yoksa kullanıcı
 * "Devam et"e basar ve ekranda hiçbir şey olmaz, işler ancak uygulama arka plana
 * atılıp geri dönülünce belirirdi. Motor (`usePlanAdaptations`) uygulamada tek bir
 * yerde kurulu — her kartta ayrıca kurmak AppState dinleyicisini ve günlük üretimi
 * kart sayısı kadar çoğaltırdı. Bu yüzden tetikleyici yukarıdan geçiriliyor.
 */
export const PlanRefreshContext = createContext<() => void>(() => {});

export interface PlanLifecycle {
  isPaused: boolean;
  /** Duraklamanın bitmesine kaç gün kaldı (bugün dahil). */
  pauseDaysLeft: number;
  /** Planın uzun yolu — başlangıcı bilinmeyen eski planlarda null. */
  arc: PlanArc | null;
  /** `days` gün ara ver: bugünün açık plan işleri kalkar, seriler korunur. */
  pause: (days: number, copy: { toast: (d: number) => string; undo: string }) => void;
  resume: (copy?: { toast: string }) => void;
}

export function usePlanLifecycle(
  mode: PlanMode,
  targetDate: string | null | undefined,
  /*
    DİZİ OLMAYABİLİR — bu yüzden tip de öyle söylüyor.

    Plan kimlik listeleri tercihlerde yaşıyor ve oraya buluttan da yazılıyor. Alanı
    hiç tanımayan ESKİ bir bulut anlık görüntüsü geri yüklendiğinde değer `undefined`
    kalabiliyor; `habitIds.map(...)` o anda tüm ekranı çökertiyordu (ölçüldü:
    Ramazan kartı, "Cannot read property 'map' of undefined"). Bir özet satırının
    eksik olması sayfayı düşürmemeli.
  */
  habitIds: string[] | undefined,
): PlanLifecycle {
  const spec = usePrefsStore(s => s.planSpecs[mode]);
  const setPlanPause = usePrefsStore(s => s.setPlanPause);
  const habits = useHabitStore(s => s.habits);
  const refreshPlans = useContext(PlanRefreshContext);

  const todayKey = fmtDateKey();
  const pausedUntil = spec?.pausedUntil ?? null;
  const isPaused = isPausedOn(pausedUntil, todayKey);

  const ids = React.useMemo(() => habitIds ?? [], [habitIds]);

  const arc = useMemo(() => planArcFor({
    /*
      `startDate` bir ISO ZAMAN damgası, hedef tarihi ise TAKVİM günü. İkisini de
      aynı gün diline çeviriyoruz; ham hâlleriyle karşılaştırmak, negatif ofsetli
      saat dilimlerinde planı bir gün erken başlatırdı (bkz. dateKey.ts).
    */
    startKey: spec?.startDate ? toDateKey(new Date(spec.startDate)) : null,
    targetKey: targetDate ? calendarDayOf(targetDate) : null,
    todayKey,
    habitCompletions: ids.map(id => habits.find(h => h.id === id)?.completedDates),
  }), [spec?.startDate, targetDate, todayKey, ids, habits]);

  const pause = useCallback((days: number, copy: { toast: (d: number) => string; undo: string }) => {
    setPlanPause(mode, pauseUntilKey(days, fmtDateKey()));
    // Bugünün AÇIK plan işleri kalkar (bitmişlere dokunulmaz — onlar kullanıcının
    // geçmişi), alışkanlıklar da bugünü seriyi kırmadan geçer.
    retirePlanTasksFromToday(mode, fmtDateKey());
    skipPlanHabitsToday(mode);
    haptic.surface();
    useToastStore.getState().show(copy.toast(days), 'info', {
      label: copy.undo,
      onAction: () => {
        setPlanPause(mode, null);
        refreshPlans();
        haptic.success();
      },
    });
  }, [mode, setPlanPause, refreshPlans]);

  const resume = useCallback((copy?: { toast: string }) => {
    setPlanPause(mode, null);
    // Bugünün işleri HEMEN geri gelsin; kullanıcı "devam et"e basıp boş ekran görmesin.
    refreshPlans();
    haptic.success();
    if (copy?.toast) useToastStore.getState().show(copy.toast, 'success');
  }, [mode, setPlanPause, refreshPlans]);

  return { isPaused, pauseDaysLeft: pauseDaysLeft(pausedUntil, todayKey), arc, pause, resume };
}
