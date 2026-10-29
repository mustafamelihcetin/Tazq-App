/**
 * Madde 12 — çok birimli ödemeler. 200 ₺ kira, 20 $ abonelik ve 100 € spor salonu
 * aynı listede: kesin toplamlar birim birim, altında ana birimde YAKLAŞIK toplam.
 */
import { totalsByCurrency, approxTotal, formatTotals, monthlyPaid, withLocalPaid } from '@/features/payments/utils/money';

const fx = { date: '2026-10-29', base: 'EUR', rates: { EUR: 1, TRY: 55.4691, USD: 1.113, GBP: 0.83578 } };

describe('birim bazında toplam', () => {
  it('ana birim önce, sonra diğerleri; birimsiz ödeme ana birime sayılır', () => {
    const t = totalsByCurrency([{ amount: 200 }, { amount: 20, currency: 'USD' }, { amount: 100, currency: 'EUR' }, { amount: 50, currency: 'TRY' }], 'TRY');
    expect(t).toEqual([{ code: 'TRY', amount: 250 }, { code: 'USD', amount: 20 }, { code: 'EUR', amount: 100 }]);
  });

  it('okunur biçim: kesin rakamlar yan yana', () => {
    expect(formatTotals([{ code: 'TRY', amount: 250 }, { code: 'USD', amount: 20 }], 'tr')).toBe('250 ₺ · 20 $');
  });
});

describe('yaklaşık toplam', () => {
  it('EUR tabanlı çapraz kurla ana birime çevirir', () => {
    // 20 $ = 20 / 1.113 × 55.4691 ≈ 996.75 ₺ ; 100 € = 5546.91 ₺
    const v = approxTotal([{ code: 'TRY', amount: 200 }, { code: 'USD', amount: 20 }, { code: 'EUR', amount: 100 }], 'TRY', fx)!;
    expect(Math.round(v)).toBe(Math.round(200 + 20 / 1.113 * 55.4691 + 100 * 55.4691));
  });

  it('kur yoksa ya da eksikse null — uydurma rakam yok', () => {
    expect(approxTotal([{ code: 'USD', amount: 20 }], 'TRY', null)).toBeNull();
    expect(approxTotal([{ code: 'XYZ', amount: 20 }], 'TRY', fx)).toBeNull();
  });

  it('tek birimde kur gerekmez', () => {
    expect(approxTotal([{ code: 'TRY', amount: 200 }], 'TRY', null)).toBe(200);
  });
});

describe('aylık ödenen (grafik)', () => {
  const now = new Date(2026, 9, 29);
  const rec = (y: number, m: number, amount: number, currency?: string) => ({ paidAt: new Date(y, m - 1, 15).toISOString(), amount, currency });

  it('son N ay, eskiden yeniye, boş ay sıfır', () => {
    const r = monthlyPaid([rec(2026, 10, 100), rec(2026, 8, 50)], 3, 'TRY', fx, now);
    expect(r.map(x => x.key)).toEqual(['2026-08', '2026-09', '2026-10']);
    expect(r.map(x => x.amount)).toEqual([50, 0, 100]);
  });

  it('yabancı birim kurla çevrilir; kur yoksa ayın değeri "eksik" işaretlenir', () => {
    const withFx = monthlyPaid([rec(2026, 10, 10, 'EUR')], 1, 'TRY', fx, now);
    expect(Math.round(withFx[0].amount)).toBe(Math.round(10 * 55.4691));
    const noFx = monthlyPaid([rec(2026, 10, 10, 'EUR'), rec(2026, 10, 5)], 1, 'TRY', null, now);
    expect(noFx[0]).toMatchObject({ amount: 5, partial: true });
  });

  it('pencere dışı kayıt sayılmaz', () => {
    expect(monthlyPaid([rec(2026, 1, 999)], 6, 'TRY', fx, now).every(x => x.amount === 0)).toBe(true);
  });
});

/*
  Ekim'de "ödendi" denen faturalar grafikte yoktu: işaretler geçmiş kaydından önce
  atılmıştı (yalnız lastPaidCycleKey) ya da sunucu henüz geçmişi bilmiyordu.
*/
describe('yerel ödendi işaretleri geçmişe katılır', () => {
  const now = new Date(2026, 9, 30, 15);
  const pay = (id: number, key: string | null, dueDay = 5) => ({ id, title: `P${id}`, amount: 100, dueDay, recurrence: 'Monthly' as const, lastPaidCycleKey: key });

  it('kaydı olmayan ödendi işareti kendi ayına düşer ve grafikte görünür', () => {
    const merged = withLocalPaid([], [pay(1, '2026-10'), pay(2, null)], now);
    expect(merged).toHaveLength(1);
    expect(monthlyPaid(merged, 6, 'TRY', null, now).at(-1)).toMatchObject({ key: '2026-10', amount: 100 });
  });

  it('sunucuda kaydı olan dönem iki kez sayılmaz', () => {
    const server = [{ id: 9, paymentId: 1, title: 'P1', amount: 100, cycleKey: '2026-10', paidAt: new Date(2026, 9, 3).toISOString() }];
    expect(withLocalPaid(server, [pay(1, '2026-10')], now)).toHaveLength(1);
  });

  it('vade günü gelecekteyse (erken ödeme) tarih bugünü geçmez', () => {
    const [r] = withLocalPaid([], [pay(1, '2026-10', 31)], now);
    expect(new Date(r.paidAt).getTime()).toBeLessThanOrEqual(now.getTime());
  });
});
