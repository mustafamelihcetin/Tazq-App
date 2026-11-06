import fs from 'fs';
import path from 'path';
import { useBudgetStore } from '@/shared/store/useBudgetStore';
import { useQuitStore } from '@/shared/store/useQuitStore';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

describe('onaylı yedek: tutar ve sayaç', () => {
  beforeEach(() => { useBudgetStore.getState().clearLocal(); useQuitStore.getState().clearLocal(); });

  it('hiç veri yoksa buluta hiçbir şey gitmez', () => {
    expect(useBudgetStore.getState().cloudSnapshot()).toBeNull();
    expect(useQuitStore.getState().cloudSnapshot()).toBeNull();
  });

  it('çıkış sonrası boş cihaz yedeği geri alır', () => {
    useBudgetStore.getState().setBudgetType('birikim');
    useBudgetStore.getState().setTargetAmount('50000');
    const cloud = useBudgetStore.getState().cloudSnapshot()!;
    useBudgetStore.getState().clearLocal();
    expect(useBudgetStore.getState().targetAmount).toBe('');
    useBudgetStore.getState().applyCloud(cloud);
    expect(useBudgetStore.getState().targetAmount).toBe('50000');
  });

  it('eski yedek dolu cihazı ezemez, yenisi geçer', () => {
    useBudgetStore.getState().setTargetAmount('100');
    const at = useBudgetStore.getState().at;
    useBudgetStore.getState().applyCloud({ at: at - 1000, budgetType: 'borc', startAmount: '', targetAmount: '999', log: [], moves: [], monthlyExpense: 0, coverMonths: 0 });
    expect(useBudgetStore.getState().targetAmount).toBe('100');
    useBudgetStore.getState().applyCloud({ at: at + 1000, budgetType: 'borc', startAmount: '', targetAmount: '999', log: [], moves: [], monthlyExpense: 0, coverMonths: 0 });
    expect(useBudgetStore.getState().targetAmount).toBe('999');
  });

  it('kullanıcı silince bu da yayılır; çıkış silme sayılmaz', () => {
    useQuitStore.getState().addItem('sigara', 'Sigara');
    useQuitStore.getState().reset();
    expect(useQuitStore.getState().at).toBeGreaterThan(0);
    expect(useQuitStore.getState().cloudSnapshot()?.items).toEqual([]);
    useQuitStore.getState().clearLocal();
    expect(useQuitStore.getState().at).toBe(0);
    expect(useQuitStore.getState().cloudSnapshot()).toBeNull();
  });

  it('yedek uzun geçmişi taşımaz: sunucuda az yer', () => {
    useQuitStore.getState().addItem('sigara', 'Sigara');
    const id = useQuitStore.getState().items[0].id;
    useQuitStore.setState(s => ({ items: s.items.map(i => (i.id === id ? { ...i, relapses: Array.from({ length: 200 }, () => '2026-01-01') } : i)) }));
    expect(useQuitStore.getState().cloudSnapshot()!.items[0].relapses).toHaveLength(30);
  });
});

describe('rıza olmadan gönderim yok', () => {
  const store = read('features/modes/store/usePrefsStore.ts');
  it('yalnız true iken veri, false iken silme, soru sorulmadıysa hiçbir şey', () => {
    expect(store).toContain("if (consent.budget === true) snapshot.__budget");
    expect(store).toContain("else if (consent.budget === false) snapshot.__budget = null;");
    expect(store).toContain("if (consent.quit === true) snapshot.__quit");
    expect(store).toContain("else if (consent.quit === false) snapshot.__quit = null;");
  });
  it('kilo yedeğe hiç girmez', () => {
    expect(store).not.toMatch(/snapshot\.__(weight|spor|kilo)/);
    expect(read('features/modes/components/modes/SporCard.tsx')).not.toContain('backup=');
  });
  it('onay metni ve gizlilik metni birlikte: web ve uygulama, iki dilde', () => {
    for (const f of ['../Tazq-Backend/wwwroot/gizlilik.html', 'shared/constants/legal.ts']) {
      const t = read(f);
      expect(t).toContain('İsteğe Bağlı Yedek');
      expect(t).toContain('Optional Backup');
    }
    const c = read('features/modes/components/deviceOnlyCopy.ts');
    expect(c).not.toMatch(/hiç gönderilmez|never sent/);
  });
});
