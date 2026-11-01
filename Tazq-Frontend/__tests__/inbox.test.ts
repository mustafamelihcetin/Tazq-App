import { buildInbox, type InboxInput } from '@/features/dashboard/utils/inboxItems';
import { INBOX_COPY } from '@/features/dashboard/utils/inboxCopy';

/*
  GELEN KUTUSU (2026-11-01): dağınık uyarılar tek yerde; kalemler durumdan hesaplanır, eylem gerektiren üstte.
*/
const base = (o: Partial<InboxInput> = {}): InboxInput => ({
  now: new Date(2026, 10, 10, 10, 0), dayKey: '2026-11-10',
  zen: { visible: false, overload: false }, someday: { visible: false, count: 0 },
  payments: [], support: [], unlockedAt: {}, achievementTitle: () => 'Seri', tomorrowCount: 0,
  copy: INBOX_COPY.tr, ...o,
});

describe('gelen kutusu', () => {
  it('boşken boş', () => { expect(buildInbox(base())).toEqual([]); });

  it('Zen ve raf burada toplanır (sayfadan taşındı)', () => {
    const kinds = buildInbox(base({ zen: { visible: true, overload: true }, someday: { visible: true, count: 3 } })).map(i => i.kind);
    expect(kinds).toEqual(['zen', 'someday']);
  });

  it('ödeme: gecikmiş ve 3 gün içindekiler; uzak olan yok', () => {
    const items = buildInbox(base({ payments: [
      { id: 1, title: 'Kira', amount: 1, dueDay: 8, recurrence: 'Monthly' },      // 2 gün gecikti
      { id: 2, title: 'İnternet', amount: 1, dueDay: 12, recurrence: 'Monthly' }, // 2 gün sonra
      { id: 3, title: 'Spor', amount: 1, dueDay: 25, recurrence: 'Monthly' },     // uzak
    ] }));
    expect(items.map(i => i.title)).toEqual(['Kira', 'İnternet']);
    expect(items[0].sub).toBe('2 gün gecikti');
  });

  it('destek: yalnız son söz ekipteyse ve konuşma açıksa', () => {
    const at = '2026-11-09T10:00:00Z';
    const items = buildInbox(base({ support: [
      { id: 1, message: 'a', createdAt: at, thread: [{ fromStaff: true, body: 'Merhaba', at }] },
      { id: 2, message: 'b', createdAt: at, thread: [{ fromStaff: true, body: 'x', at }, { fromStaff: false, body: 'teşekkürler', at }] },
      { id: 3, message: 'c', createdAt: at, closedAt: at, thread: [{ fromStaff: true, body: 'y', at }] },
    ] }));
    expect(items.map(i => i.ref)).toEqual([1]);
  });

  it('yarının yükü yalnız akşam', () => {
    expect(buildInbox(base({ tomorrowCount: 4 }))).toEqual([]);
    expect(buildInbox(base({ tomorrowCount: 4, now: new Date(2026, 10, 10, 19, 0) }))[0].title).toBe('Yarın 4 işin var');
  });
});

describe('gelen kutusu — otomatik temizlik', () => {
  const { AUTO_CLEAR_ON_SEEN, clearsOnOpen } = require('@/features/dashboard/utils/inboxItems');
  it('bilgi kalemleri görülünce gider; eylem isteyenler kalır', () => {
    expect(AUTO_CLEAR_ON_SEEN).toEqual(['badge', 'tomorrow']);
    expect(AUTO_CLEAR_ON_SEEN).not.toContain('payment');
  });
  it('ödeme dokununca kaldırılmaz (ödenince kendisi düşer); diğerleri okundu sayılır', () => {
    expect(clearsOnOpen('payment')).toBe(false);
    expect(clearsOnOpen('support')).toBe(true);
  });
});
