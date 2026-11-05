import { localPlansWin, wouldWipeModes, isModeDecision, hasActiveMode } from '@/features/modes/utils/planAuthority';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';

/*
  2026-11-05 olayı: yerelde kalan kırıntı buluttaki modları eziyor, temizlik mod alışkanlıklarını siliyor, boş hâl
  buluta yazılıyordu. Bu testler zincirin her halkasını kilitler.
*/
describe('mod yetkisi', () => {
  it('kırıntı yetki değildir: damgasız yerel + damgalı bulut → bulut', () => {
    expect(localPlansWin({ localAt: 0, cloudAt: 5, localActive: false })).toBe(false);
    expect(localPlansWin({ localAt: 0, cloudAt: 0, localActive: false })).toBe(false);
  });
  it('gerçek açık mod, bayat damgasız buluta karşı korunur', () => {
    expect(localPlansWin({ localAt: 0, cloudAt: 0, localActive: true })).toBe(true);
  });
  it('en son kullanıcı kararı kazanır', () => {
    expect(localPlansWin({ localAt: 10, cloudAt: 5, localActive: false })).toBe(true);
    expect(localPlansWin({ localAt: 5, cloudAt: 10, localActive: true })).toBe(false);
  });
  it('temizlik yazımı karar değildir, mod kapatmak karardır', () => {
    expect(isModeDecision('examName', '')).toBe(false);
    expect(isModeDecision('examDate', null)).toBe(false);
    expect(isModeDecision('examMode', false)).toBe(true);
    expect(isModeDecision('examName', 'KPSS')).toBe(true);
  });
  it('kararsız "hepsi kapalı" gönderimi engellenir; kullanıcı kapattıysa geçer', () => {
    const cloud = { examMode: true };
    expect(wouldWipeModes({ localSeasonal: {}, cloudSeasonal: cloud, localAt: 0, cloudAt: 0 })).toBe(true);
    expect(wouldWipeModes({ localSeasonal: {}, cloudSeasonal: cloud, localAt: 9, cloudAt: 5 })).toBe(false);
    expect(hasActiveMode({ birakmaMode: true })).toBe(true);
  });
});

describe('hydrateFromCloud — olay senaryosu', () => {
  beforeEach(() => usePrefsStore.getState().resetUserData());
  it('yerel kırıntı varken buluttaki modlar geri gelir', () => {
    usePrefsStore.setState(s => ({ examPlanTaskIds: [1], seasonal: { ...s.seasonal, tasarrufName: 'eski' } }) as never);
    usePrefsStore.getState().hydrateFromCloud(JSON.stringify({
      seasonal: { ...usePrefsStore.getState().seasonal, examMode: true, examName: 'KPSS' }, examPlanHabitIds: ['h1'],
    }));
    const s = usePrefsStore.getState();
    expect(s.seasonal.examMode).toBe(true);
    expect(s.seasonal.examName).toBe('KPSS');
    expect(s.examPlanHabitIds).toEqual(['h1']);
  });
  it('kullanıcının daha yeni kararı bayat buluta ezdirilmez', () => {
    usePrefsStore.getState().setSeasonalPref('sporMode', true);
    usePrefsStore.getState().hydrateFromCloud(JSON.stringify({ seasonal: { ...usePrefsStore.getState().seasonal, sporMode: false }, __seasonalAt: 1 }));
    expect(usePrefsStore.getState().seasonal.sporMode).toBe(true);
  });
});
