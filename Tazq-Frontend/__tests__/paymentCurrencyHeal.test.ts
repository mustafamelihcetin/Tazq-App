/**
 * "Dolar seçtim, TL oldu": birimi bilmeyen sunucu yenilemede yerel birimi silmesin;
 * kayıp birim sunucuya geri yazılsın.
 */
import { keepLocalCurrency } from '@/features/payments/utils/paymentActions';

const p = (id: number, currency?: string | null) => ({ id, title: `P${id}`, amount: 20, dueDay: 1, recurrence: 'Monthly' as const, currency });

describe('birim onarımı', () => {
  it('sunucu birimsiz döndürürse yerel birim korunur ve onarılacaklara girer', () => {
    const { merged, heal } = keepLocalCurrency([p(1), p(2, 'EUR')], [p(1, 'USD'), p(2, 'EUR')]);
    expect(merged.map(x => x.currency)).toEqual(['USD', 'EUR']);
    expect(heal.map(x => x.id)).toEqual([1]);
  });

  it('sunucunun birimi varsa o kazanır; yerelde birim yoksa dokunulmaz', () => {
    const { merged, heal } = keepLocalCurrency([p(1, 'GBP'), p(3)], [p(1, 'USD'), p(3)]);
    expect(merged.map(x => x.currency)).toEqual(['GBP', undefined]);
    expect(heal).toHaveLength(0);
  });
});
