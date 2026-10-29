import { quickDates, dueDateLabel, defaultReminderSlot, isFormDirty } from '@/features/tasks/utils/taskFormDates';

/**
 * YENİ HEDEF FORMU — tarih kısayolları, okunur tarih etiketi, hatırlatıcı varsayılanı.
 *
 * Form eskiden tarihi ham 'YYYY-MM-DD' olarak gösteriyor ve gün gün ▲/▼ ile seçtiriyordu.
 * Yerine Todoist/Things'teki kısayollar geldi: Bugün · Yarın · Hafta sonu · Gelecek hafta.
 * Hepsi YEREL gün (bkz. dateKey.ts): UTC gece yarısı okumak gece kuşağında bir gün kaydırır.
 */

// 2026-10-21 Çarşamba, 14:30 yerel
const WED = new Date(2026, 9, 21, 14, 30);

describe('quickDates', () => {
  it('Çarşamba: bugün, yarın, cumartesi, pazartesi', () => {
    expect(quickDates(WED)).toEqual([
      { key: 'today', dateKey: '2026-10-21' },
      { key: 'tomorrow', dateKey: '2026-10-22' },
      { key: 'weekend', dateKey: '2026-10-24' },
      { key: 'nextWeek', dateKey: '2026-10-26' },
    ]);
  });

  it('Cuma: hafta sonu yarına denk gelir → tekrar edilmez', () => {
    const fri = new Date(2026, 9, 23, 10, 0);
    expect(quickDates(fri).map((q) => q.key)).toEqual(['today', 'tomorrow', 'nextWeek']);
  });

  it('Cumartesi ve Pazar: hafta sonu "bugün"dür → tekrar edilmez', () => {
    expect(quickDates(new Date(2026, 9, 24, 9)).map((q) => q.key)).toEqual(['today', 'tomorrow', 'nextWeek']);
    // Pazar: "Gelecek hafta" (Pazartesi) de yarına düşer.
    expect(quickDates(new Date(2026, 9, 25, 9)).map((q) => q.key)).toEqual(['today', 'tomorrow']);
  });

  it('Pazar: gelecek hafta yarına (Pazartesi) denk gelir → tekrar edilmez', () => {
    const sun = new Date(2026, 9, 25, 9);
    expect(quickDates(sun).find((q) => q.key === 'nextWeek')?.dateKey).toBeUndefined();
  });

  it('ay ve yıl sınırını yerel takvimle geçer', () => {
    const dec31 = new Date(2026, 11, 31, 23, 50); // Perşembe
    expect(quickDates(dec31)[1]).toEqual({ key: 'tomorrow', dateKey: '2027-01-01' });
  });
});

describe('dueDateLabel', () => {
  it('bugün / yarın göreli yazılır', () => {
    expect(dueDateLabel('2026-10-21', WED, 'tr')).toBe('Bugün');
    expect(dueDateLabel('2026-10-22', WED, 'en')).toBe('Tomorrow');
  });

  it('önümüzdeki altı gün gün adıyla', () => {
    expect(dueDateLabel('2026-10-24', WED, 'tr')).toBe('Cumartesi');
    expect(dueDateLabel('2026-10-26', WED, 'en')).toBe('Monday');
  });

  it('daha uzak tarih gün + kısa ay; başka yılsa yıl da', () => {
    expect(dueDateLabel('2026-11-15', WED, 'tr')).toMatch(/15 Kas/);
    expect(dueDateLabel('2027-02-03', WED, 'en')).toMatch(/2027/);
  });

  it('geçmiş tarih "gün adı" sanılmaz', () => {
    expect(dueDateLabel('2026-10-20', WED, 'tr')).toBe('Dün');
    expect(dueDateLabel('2026-10-10', WED, 'tr')).toMatch(/10 Eki/);
  });

  it('boş/bozuk anahtar boş döner', () => {
    expect(dueDateLabel('', WED, 'tr')).toBe('');
    expect(dueDateLabel('bozuk', WED, 'tr')).toBe('');
  });
});

describe('defaultReminderSlot — eski satır içi mantıkla birebir', () => {
  const hhmm = (iso: string | null) => (iso ? `${new Date(iso).getHours()}:${new Date(iso).getMinutes()}` : null);

  it('tarih ve saat yok, saat 9 öncesi → bugün 09:00', () => {
    const r = defaultReminderSlot({ dueDate: '', dueTime: null }, new Date(2026, 9, 21, 7, 0));
    expect(r.dueDate).toBe('2026-10-21');
    expect(hhmm(r.dueTime)).toBe('9:0');
  });

  it('tarih ve saat yok, saat 9 sonrası → yarın 09:00', () => {
    const r = defaultReminderSlot({ dueDate: '', dueTime: null }, WED);
    expect(r.dueDate).toBe('2026-10-22');
    expect(hhmm(r.dueTime)).toBe('9:0');
  });

  it('ileri tarih, saat yok → o gün 09:00', () => {
    const r = defaultReminderSlot({ dueDate: '2026-10-30', dueTime: null }, WED);
    expect(r.dueDate).toBe('2026-10-30');
    expect(hhmm(r.dueTime)).toBe('9:0');
  });

  it('bugün, saat yok → bir sonraki tam saat', () => {
    const r = defaultReminderSlot({ dueDate: '2026-10-21', dueTime: null }, WED);
    expect(r.dueDate).toBe('2026-10-21');
    expect(hhmm(r.dueTime)).toBe('15:0');
  });

  it('bugün 23:xx, saat yok → yarın 09:00', () => {
    const r = defaultReminderSlot({ dueDate: '2026-10-21', dueTime: null }, new Date(2026, 9, 21, 23, 10));
    expect(r.dueDate).toBe('2026-10-22');
    expect(hhmm(r.dueTime)).toBe('9:0');
  });

  it('saat var tarih yok: saat geçtiyse yarın, geçmediyse bugün', () => {
    const at = (h: number) => { const d = new Date(2026, 9, 21); d.setHours(h, 0, 0, 0); return d.toISOString(); };
    expect(defaultReminderSlot({ dueDate: '', dueTime: at(10) }, WED).dueDate).toBe('2026-10-22');
    expect(defaultReminderSlot({ dueDate: '', dueTime: at(18) }, WED).dueDate).toBe('2026-10-21');
  });

  it('ikisi de varsa dokunulmaz', () => {
    const slot = { dueDate: '2026-10-30', dueTime: '2026-10-30T12:00:00.000Z' };
    expect(defaultReminderSlot(slot, WED)).toEqual(slot);
  });
});

describe('isFormDirty', () => {
  const base = { title: '', description: '', dueDate: '', dueTime: null, priority: 'Medium', tags: [] as string[], subtasks: [], recurrence: 'None', reminderEnabled: false };

  it('açıldığı hâldeyse kirli değil', () => {
    expect(isFormDirty(base, { ...base })).toBe(false);
  });

  it('yalnız boşluk yazılması kirli sayılmaz', () => {
    expect(isFormDirty({ ...base, title: '   ' }, base)).toBe(false);
  });

  it('başlık, etiket veya alt görev değişince kirli', () => {
    expect(isFormDirty({ ...base, title: 'Rapor' }, base)).toBe(true);
    expect(isFormDirty({ ...base, tags: ['iş'] }, base)).toBe(true);
    expect(isFormDirty({ ...base, subtasks: [{ text: 'a', done: false }] } as any, base)).toBe(true);
  });
});

/**
 * CİHAZDA GÖRÜLDÜ (2026-10-25, iOS telefon + iPad): X'e basınca form KAPANMIYORDU.
 * Kirli formda kapanış "Değişiklikler atılsın mı?" soruyor; soru `CustomAlert` ile
 * soruluyordu — o da bir RN `Modal`. iOS, açık bir Modal'ın (form sayfası) üstüne
 * İKİNCİ bir Modal'ı sunmayı sessizce reddediyor: uyarı görünmüyor, form kapanmıyor
 * (log: ui_rage_click "Kapat"). Sistem uyarısı (UIAlertController) en üstteki
 * denetleyicinin üzerinde açılır — Modal içinden soru sormanın tek güvenli yolu.
 */
describe('form sayfası içinden sorulan sorular', () => {
  const fs = require('fs');
  const path = require('path');
  const src: string = fs.readFileSync(path.resolve(__dirname, '../features/tasks/components/TaskFormModal.tsx'), 'utf8');

  /*
    Eskiden kural tersiydi: CustomAlert ikinci bir native Modal'dı, form Modal'ının
    üstünde iOS'ta görünmüyordu → sistem uyarısı kullanılıyordu. 2026-10-29'dan beri
    uyarı Modal DEĞİL, yuvaya çizilen örtü; form kendi yuvasını taşır (bkz. CustomAlert).
  */
  it('uyarı uygulamanın kendi penceresi — sistem Alert yok', () => {
    expect(src).toMatch(/from '@\/shared\/components\/CustomAlert'/);
    expect(src).not.toMatch(/import \{[^}]*\bAlert\b[^}]*\} from 'react-native'/);
  });

  it('form Modal\'ı kendi uyarı yuvasını taşır (uyarı formun üstünde görünür)', () => {
    expect(src).toMatch(/<AlertHost \/>[^\n]*\n\s*<\/Modal>/);
  });
});
