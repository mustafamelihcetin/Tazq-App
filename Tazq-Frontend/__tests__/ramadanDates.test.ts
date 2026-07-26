/**
 * Ramazan tarihleri — regresyon testleri.
 *
 * Kök nedenler (giderildi):
 *  1. İki ayrı tarih tablosu vardı (turkishModes.RAMAZAN ve ramadanDates.RAMADAN_DATES)
 *     ve birbirini tutmuyordu → mod aktivasyonu ile UI farklı gün söylüyordu.
 *  2. 'YYYY-MM-DD' UTC olarak parse ediliyordu → Ramazan'ın İLK GÜNÜ "1 gün kaldı"
 *     görünüyordu (TR gibi pozitif UTC ofsetlerinde).
 */
import { getCurrentRamadanStatus, getRamadanRanges, getRamadanForYear, parseLocalDate, isRamadanTableStale } from '@/shared/utils/ramadanDates';
import { RAMAZAN } from '@/features/modes/utils/turkishModes';

describe('tek kaynak', () => {
  it('turkishModes.RAMAZAN ramadanDates ile birebir aynıdır', () => {
    expect(RAMAZAN).toEqual(getRamadanRanges());
  });
  it('aralıklar tarihe göre sıralı ve tutarlıdır', () => {
    const ranges = getRamadanRanges();
    expect(ranges.length).toBeGreaterThan(0);
    ranges.forEach(r => expect(r.start < r.end).toBe(true));
    for (let i = 1; i < ranges.length; i++) {
      expect(ranges[i - 1].end < ranges[i].start).toBe(true);
    }
  });
});

describe('parseLocalDate', () => {
  it("'YYYY-MM-DD' değerini YEREL gün başlangıcı olarak okur", () => {
    const d = parseLocalDate('2026-02-18');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(1); // Şubat
    expect(d.getDate()).toBe(18);
    expect(d.getHours()).toBe(0);
  });
});

describe('getCurrentRamadanStatus', () => {
  const realDate = Date;
  const mockToday = (isoLocal: string) => {
    const fixed = new realDate(isoLocal);
    // @ts-expect-error test double
    global.Date = class extends realDate {
      constructor(...args: any[]) {
        // @ts-expect-error passthrough
        super(...(args.length ? args : [fixed]));
        if (!args.length) return new realDate(fixed) as any;
      }
      static now() { return fixed.getTime(); }
    };
  };
  afterEach(() => { global.Date = realDate; });

  it('Ramazan\'ın İLK günü aktif sayılır (eskiden "1 gün kaldı" diyordu)', () => {
    const p = getRamadanForYear(2026)!;
    mockToday(`${p.start}T10:00:00`);
    const s = getCurrentRamadanStatus();
    expect(s.isActive).toBe(true);
    expect(s.daysUntilStart).toBe(0);
  });

  it('Ramazan\'ın SON günü hâlâ aktiftir', () => {
    const p = getRamadanForYear(2026)!;
    mockToday(`${p.end}T10:00:00`);
    expect(getCurrentRamadanStatus().isActive).toBe(true);
  });

  it('başlangıçtan bir gün önce aktif değildir ve 1 gün kaldığını söyler', () => {
    const p = getRamadanForYear(2026)!;
    const prev = parseLocalDate(p.start);
    prev.setDate(prev.getDate() - 1);
    mockToday(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}T10:00:00`);
    const s = getCurrentRamadanStatus();
    expect(s.isActive).toBe(false);
    expect(s.daysUntilStart).toBe(1);
  });

  it('süre (duration) doğru hesaplanır', () => {
    const p = getRamadanForYear(2026)!;
    mockToday(`${p.start}T10:00:00`);
    expect(getCurrentRamadanStatus().duration).toBe(30);
  });
});

describe('tablo tükenmesi', () => {
  it('tablo bugün için hâlâ geçerlidir (değilse tarihleri güncelle)', () => {
    expect(isRamadanTableStale()).toBe(false);
  });
});
