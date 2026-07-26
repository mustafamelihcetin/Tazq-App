/**
 * Genişletilmiş görev havuzu — regresyon testleri.
 *
 * ÖLÇÜLEN SORUN: günlük görev havuzları koda gömülü ve çok küçük. Tıp/tez/mülakat
 * fazlarında yalnız 2 görev var; günde 1 görev üreten bir kullanıcı (dailyMinutes ≤ 60)
 * aynı iki görevi aylarca dönüşümlü görüyor (`deepen` fazı sınava 60–270 gün kala sürer).
 *
 * ÇÖZÜMÜN SÖZLEŞMESİ — bu testlerin asıl konusu:
 *   1. Genişletilmiş havuz YOKSA çıktı bugünküyle BİREBİR aynı olmalı.
 *   2. Havuz VARSA sabit görevler korunur, üretilenler ÜSTÜNE eklenir.
 *   3. Çeşitlilik gerçekten artmalı (tekrar aralığı uzamalı).
 */
import { buildDailyTasks, planPoolKeyFor, type DailyPlanSpec } from '@/shared/utils/dailyPlanEngine';

const EMPTY: any[] = [];

/** N gün boyunca üretilen başlıkları topla (motor gün indeksine göre rotasyon yapar). */
function titlesOverDays(spec: DailyPlanSpec, days: number): string[] {
  const out: string[] = [];
  const start = new Date('2026-03-01T09:00:00');
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const tasks = buildDailyTasks(spec, EMPTY, 'tr', d);
    out.push(...tasks.map(t => t.title));
  }
  return out;
}

describe('ölçülen sorun: havuzlar çok küçük', () => {
  it('tıp sınavı deepen fazı günde 1 görevle 2 günde bir tekrara düşer', () => {
    // Bu testin amacı sorunu BELGELEMEK — çözümün neyi düzelttiği ölçülebilsin.
    const spec: DailyPlanSpec = { kind: 'exam', name: 'TUS', daysLeft: 200, dailyMinutes: 60 };
    const titles = titlesOverDays(spec, 10);
    expect(titles).toHaveLength(10);          // günde 1 görev
    expect(new Set(titles).size).toBe(2);     // ama yalnız 2 FARKLI görev
  });
});

describe('sözleşme 1 — genişletilmiş havuz yoksa davranış AYNI', () => {
  const base: DailyPlanSpec = { kind: 'exam', name: 'TUS', daysLeft: 200, dailyMinutes: 60 };

  it('extraPool verilmezse çıktı değişmez', () => {
    expect(titlesOverDays(base, 8)).toEqual(titlesOverDays({ ...base }, 8));
  });

  it('extraPool boş dizi olsa bile çıktı değişmez', () => {
    expect(titlesOverDays({ ...base, extraPool: [] }, 8)).toEqual(titlesOverDays(base, 8));
  });

  it('bozuk varyantlar (boş metin) sessizce yok sayılır', () => {
    const bozuk = [{ tr: '', en: 'x' }, { tr: 'y', en: '' }] as any;
    expect(titlesOverDays({ ...base, extraPool: bozuk }, 8)).toEqual(titlesOverDays(base, 8));
  });
});

describe('sözleşme 2 — sabit görevler korunur, üretilenler eklenir', () => {
  const extra = Array.from({ length: 12 }, (_, i) => ({
    tr: `{name}: üretilmiş görev ${i + 1}`,
    en: `{name}: generated task ${i + 1}`,
  }));
  const spec: DailyPlanSpec = { kind: 'exam', name: 'TUS', daysLeft: 200, dailyMinutes: 60, extraPool: extra };

  it('elle yazılmış görevler kaybolmaz', () => {
    const titles = new Set(titlesOverDays(spec, 40));
    const sabit = titlesOverDays({ ...spec, extraPool: undefined }, 8);
    for (const t of new Set(sabit)) expect(titles.has(t)).toBe(true);
  });

  it('sabit havuzu tekrarlayan varyant iki kez eklenmez', () => {
    const sabitBir = titlesOverDays({ ...spec, extraPool: undefined }, 1)[0];
    // Aynı metni {name} yer tutucusuyla geri besle
    const kopya = [{ tr: sabitBir.replace('TUS', '{name}'), en: 'dup' }];
    const titles = titlesOverDays({ ...spec, extraPool: kopya }, 30);
    const kez = titles.filter(t => t === sabitBir).length;
    const beklenen = titlesOverDays({ ...spec, extraPool: undefined }, 30).filter(t => t === sabitBir).length;
    expect(kez).toBe(beklenen); // kopya havuzu büyütmedi
  });
});

describe('sözleşme 3 — çeşitlilik gerçekten artar', () => {
  it('2 farklı görev yerine 14 farklı görev', () => {
    const extra = Array.from({ length: 12 }, (_, i) => ({
      tr: `{name}: üretilmiş görev ${i + 1}`,
      en: `{name}: generated task ${i + 1}`,
    }));
    const spec: DailyPlanSpec = { kind: 'exam', name: 'TUS', daysLeft: 200, dailyMinutes: 60 };

    const oncesi = new Set(titlesOverDays(spec, 30)).size;
    const sonrasi = new Set(titlesOverDays({ ...spec, extraPool: extra }, 30)).size;

    expect(oncesi).toBe(2);
    expect(sonrasi).toBe(14); // 2 sabit + 12 üretilmiş
    expect(sonrasi).toBeGreaterThan(oncesi);
  });
});

describe('havuz anahtarı — plan ömrü boyunca en fazla 5 çağrı', () => {
  it('sınav/tez fazlara, mülakat bantlara bölünür', () => {
    expect(planPoolKeyFor({ kind: 'exam', daysLeft: 300 })).toEqual({ kind: 'exam', phase: 'foundation' });
    expect(planPoolKeyFor({ kind: 'exam', daysLeft: 20 })).toEqual({ kind: 'exam', phase: 'sprint' });
    expect(planPoolKeyFor({ kind: 'tez', daysLeft: 100 })).toEqual({ kind: 'tez', phase: 'reinforce' });
    expect(planPoolKeyFor({ kind: 'mulakat', daysLeft: 1 })).toEqual({ kind: 'mulakat', phase: 'eve' });
  });

  it('spor/ramazan tek havuz kullanır (faza bölünmez)', () => {
    expect(planPoolKeyFor({ kind: 'kilo', daysLeft: 90 })).toEqual({ kind: 'kilo', phase: '' });
    expect(planPoolKeyFor({ kind: 'ramazan', daysLeft: 10 })).toEqual({ kind: 'ramazan', phase: '' });
  });

  it('bir sınav planı ömrü boyunca 5 fazdan fazlasını görmez', () => {
    const phases = new Set(
      [400, 300, 200, 150, 100, 80, 50, 40, 20, 5, 0].map(d => planPoolKeyFor({ kind: 'exam', daysLeft: d }).phase)
    );
    expect(phases.size).toBeLessThanOrEqual(5);
  });
});
