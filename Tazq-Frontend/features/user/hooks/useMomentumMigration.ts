import { useEffect } from 'react';
import { useMomentumStore } from '@/features/user/store/useMomentumStore';
import { momentumOnDay } from '@/features/user/utils/momentumInput';
import { appDayKey } from '@/shared/utils/appDay';
import { useToastStore } from '@/shared/store/useToastStore';

const COPY = { tr: 'Momentum artık gerçek işlerini ölçüyor', en: 'Momentum now measures your real work' };

/*
  HESAP DEĞİŞTİ, GEÇMİŞ DE YENİLENİR (2026-11-06). Son 7 günün kayıtlı skoru yeni hesapla yeniden üretilir; grafikte eski ve yeni hesap yan yana kalıp sahte sıçrama çizmez.
  Yalnız kaydı olan günler yazılır: boş gün uydurulmaz. Veriler (görev, odak geçmişi) gelmeden çalışmaz, bir kez çalışır; kayıtlı skoru olana bir kez not çıkar.
*/
export function useMomentumMigration(p: {
  ready: boolean; tasks: Parameters<typeof momentumOnDay>[1]['tasks']; sessions: Parameters<typeof momentumOnDay>[1]['sessions'];
  habits: Parameters<typeof momentumOnDay>[1]['habits']; focusGoalMinutes: number; language: 'tr' | 'en'; quiet: boolean;
}): void {
  const version = useMomentumStore(s => s.scoreVersion);
  useEffect(() => {
    if (!p.ready || version >= 2) return;
    const store = useMomentumStore.getState();
    const today = appDayKey(new Date());
    const past = store.getLastNDays(8).filter(d => d.score >= 0 && d.date < today);
    const rescored = Object.fromEntries(past.map(d => [d.date, momentumOnDay(d.date, p)]));
    store.replaceScores(rescored, 2);
    if (past.length > 0 && !p.quiet) useToastStore.getState().show(COPY[p.language], 'info');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.ready, version]);
}
