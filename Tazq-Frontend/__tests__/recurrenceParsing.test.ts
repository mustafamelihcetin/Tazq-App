/**
 * HAFTANIN GÜNÜ İLE TEKRAR — her iki dilde de çalışır, ad arayüz dilinde yazılır.
 *
 * ÖLÇÜLEN İKİ SORUN:
 *  1. Desen `/her\s+(…|monday|…)/i` idi: İngilizce gün adları listedeydi ama önlerinde
 *     TÜRKÇE "her" aranıyordu. "every monday" hiçbir desene takılmıyor, görev sessizce
 *     tek seferlik oluşuyordu. Listedeki yedi İngilizce gün adı yalnız "her monday"
 *     gibi anlamsız bir girdide ateşlenebiliyordu.
 *  2. Eşleşse bile ipucu `Her ${gün}` diye kuruluyordu — "Her" sabit Türkçe, gün adı
 *     da GİRDİNİN dilinde. İngilizce arayüzde sonuç "Her Monday".
 */
import fs from 'fs';
import path from 'path';
import { parseTaskHint } from '@/features/tasks/utils/taskParser';
import { weekdayName } from '@/shared/constants/weekdays';

const ROOT = path.join(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** Yorumları at — "eski desen kalmadı" iddiası KODA bakmalı, onu anlatan yoruma değil. */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !l.trim().startsWith('//')).join('\n');

// Date.getDay(): 0=Pazar … 6=Cumartesi
const MON = 1, TUE = 2, WED = 3, THU = 4, FRI = 5, SAT = 6, SUN = 0;

describe('Türkçe haftalık tekrar', () => {
  it.each([
    ['her pazartesi spor', MON],
    ['her salı toplantı', TUE],
    ['her çarşamba rapor', WED],
    ['her perşembe alışveriş', THU],
    ['her cuma ekip toplantısı', FRI],
    ['her cumartesi temizlik', SAT],
    ['her pazar dinlenme', SUN],
  ])('%s → gün %i', (text, day) => {
    const hint = parseTaskHint(text, 'tr');
    expect(hint.recurrence).toBe('Weekly');
    expect(hint.recurrenceDay).toBe(day);
  });
});

describe('İngilizce haftalık tekrar — ESKİDEN HİÇ ÇALIŞMIYORDU', () => {
  it.each([
    ['gym every monday', MON],
    ['standup every tuesday', TUE],
    ['report every wednesday', WED],
    ['groceries every thursday', THU],
    ['team sync every friday', FRI],
    ['cleaning every saturday', SAT],
    ['rest every sunday', SUN],
  ])('%s → gün %i', (text, day) => {
    const hint = parseTaskHint(text, 'en');
    expect(hint.recurrence).toBe('Weekly');
    expect(hint.recurrenceDay).toBe(day);
  });

  it('"each friday" de tekrar sayılır', () => {
    const hint = parseTaskHint('review each friday', 'en');
    expect(hint.recurrence).toBe('Weekly');
    expect(hint.recurrenceDay).toBe(FRI);
  });

  it('çoğul biçim de tutar ("every mondays")', () => {
    expect(parseTaskHint('gym every mondays', 'en').recurrenceDay).toBe(MON);
  });
});

describe('"on monday" TEKRAR DEĞİL — tek tarihtir', () => {
  it('haftalık tekrar kurmaz', () => {
    const hint = parseTaskHint('meet John on monday', 'en');
    expect(hint.recurrenceDay).toBeUndefined();
    expect(hint.recurrence).not.toBe('Weekly');
  });

  it('ama tek tarih olarak yine de çözülür', () => {
    // 5. Smart Date bölümü WEEKDAY_MAP ile bir sonraki pazartesiyi bulur
    const hint = parseTaskHint('meet John on monday', 'en');
    expect(hint.dueDate).toBeTruthy();
  });
});

describe('gün adı ayrıştırıcıda SABİTLENMEZ', () => {
  it('ayrıştırıcı ad değil NUMARA döndürür', () => {
    const src = stripComments(read('features/tasks/utils/taskParser.ts'));
    expect(src).not.toContain('recurrenceDayLabel');
    expect(src).toContain('recurrenceDay?: number');
  });

  it('aynı gün, girdi dili ne olursa olsun aynı numara', () => {
    expect(parseTaskHint('her pazartesi', 'tr').recurrenceDay).toBe(MON);
    expect(parseTaskHint('every monday', 'en').recurrenceDay).toBe(MON);
  });

  it('ad, gösterildiği yerde ve arayüz dilinde kurulur', () => {
    const src = stripComments(read('features/tasks/components/TaskFormModal.tsx'));
    expect(src).toContain('weekdayName(hint.recurrenceDay');
    // Sabit Türkçe "Her" geri gelmesin
    expect(src).not.toMatch(/`Her \$\{hint\./);
    expect(src).toContain("isTR ? 'Her' : 'Every'");
  });

  it('gün adı tablosu Date.getDay() ile hizalı (0 = Pazar)', () => {
    expect(weekdayName(SUN, 'tr')).toBe('Pazar');
    expect(weekdayName(MON, 'tr')).toBe('Pazartesi');
    expect(weekdayName(SAT, 'tr')).toBe('Cumartesi');
    expect(weekdayName(SUN, 'en')).toBe('Sunday');
    expect(weekdayName(MON, 'en')).toBe('Monday');
    expect(weekdayName(SAT, 'en')).toBe('Saturday');
  });

  it('tablo TEK yerde — bileşen kendi kopyasını tutmuyor', () => {
    const src = stripComments(read('features/tasks/components/TaskFormModal.tsx'));
    expect(src).not.toContain('const WEEKDAY_NAMES');
    expect(src).toContain("from '@/shared/constants/weekdays'");
  });

  it('aralık dışı gün numarası çökertmez', () => {
    expect(weekdayName(7, 'tr')).toBe('');
    expect(weekdayName(-1, 'en')).toBe('');
  });
});

describe('mevcut davranış korunuyor', () => {
  it('günlük tekrar', () => {
    expect(parseTaskHint('her gün su iç', 'tr').recurrence).toBe('Daily');
    expect(parseTaskHint('drink water every day', 'en').recurrence).toBe('Daily');
  });

  it('haftalık (gün belirtmeden)', () => {
    expect(parseTaskHint('her hafta rapor', 'tr').recurrence).toBe('Weekly');
    expect(parseTaskHint('weekly report', 'en').recurrence).toBe('Weekly');
  });

  it('gün belirtmeyen haftalıkta gün numarası yok', () => {
    expect(parseTaskHint('her hafta rapor', 'tr').recurrenceDay).toBeUndefined();
  });

  it('tekrar içermeyen metin tekrar kurmaz', () => {
    const hint = parseTaskHint('rapor yaz', 'tr');
    expect(hint.recurrenceDay).toBeUndefined();
  });
});
