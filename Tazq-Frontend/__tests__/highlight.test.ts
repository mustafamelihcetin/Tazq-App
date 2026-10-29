/**
 * Madde 11 — Günün Yıldız Görevi. Önce kullanıcının BUGÜN seçtiği; yoksa modun
 * yüksek öncelikli işi; o da yoksa listenin ilki. Seçim ertesi gün sıfırlanır.
 */
import { pickHighlight } from '@/features/dashboard/utils/highlight';

const t = (id: number, priority = 'Medium', plan = false) => ({ id, priority, plan });
const isPlan = (x: { plan: boolean }) => x.plan;

describe('pickHighlight', () => {
  it('bugün seçilmiş ve hâlâ bekleyen görev kazanır', () => {
    expect(pickHighlight([t(1), t(2)], { day: '2026-10-30', id: 2 }, '2026-10-30', isPlan)?.id).toBe(2);
  });

  it('dünkü seçim geçersiz — öneriye düşer', () => {
    expect(pickHighlight([t(1), t(2, 'High', true)], { day: '2026-10-29', id: 1 }, '2026-10-30', isPlan)?.id).toBe(2);
  });

  it('seçilen görev bitmiş/silinmişse öneriye düşer', () => {
    expect(pickHighlight([t(1)], { day: '2026-10-30', id: 9 }, '2026-10-30', isPlan)?.id).toBe(1);
  });

  it('öneri: modun yüksek öncelikli işi, yoksa ilk görev', () => {
    expect(pickHighlight([t(1, 'High'), t(2, 'High', true)], null, '2026-10-30', isPlan)?.id).toBe(2);
    expect(pickHighlight([t(1), t(2)], null, '2026-10-30', isPlan)?.id).toBe(1);
  });

  it('görev yoksa yıldız yok', () => {
    expect(pickHighlight([], null, '2026-10-30', isPlan)).toBeNull();
  });
});
