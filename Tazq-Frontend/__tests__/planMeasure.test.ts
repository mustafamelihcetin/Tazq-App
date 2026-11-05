import React from 'react';
import fs from 'fs';
import path from 'path';
import { activeDays, kiloProgress } from '../features/modes/utils/planMeasure';
import { isPhantomKiloPlan } from '../features/modes/utils/weightCheckin';
import { MODE_ICONS } from '../features/modes/utils/modeIcons';
import { stripEmoji } from '../shared/utils/emoji';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

describe('kiloProgress', () => {
  it('vermede yolun yüzdesini ve kalan kiloyu hesaplar', () => {
    const p = kiloProgress('80', '70', [{ date: '2026-11-01', weight: 78 }, { date: '2026-10-25', weight: 80 }])!;
    expect(p).toMatchObject({ start: 80, target: 70, latest: 78, pct: 20, leftKg: 8 });
    expect(p.points).toEqual([80, 78]);
  });
  it('almada da doğru yönü hesaplar', () => {
    expect(kiloProgress('60', '70', [{ date: '2026-11-01', weight: 65 }])).toMatchObject({ pct: 50, leftKg: 5 });
  });
  it('ters yöne gidince yüzde eksiye düşmez, hedefi geçince 100de kalır', () => {
    expect(kiloProgress('80', '70', [{ date: '2026-11-01', weight: 85 }])!.pct).toBe(0);
    expect(kiloProgress('80', '70', [{ date: '2026-11-01', weight: 68 }])!.pct).toBe(100);
  });
  it('tartım yoksa ilerleme uydurmaz', () => {
    expect(kiloProgress('80', '70', [])).toMatchObject({ latest: 80, pct: 0, leftKg: 10, points: [] });
  });
  it('hedef eksikse veya eşitse null döner', () => {
    expect(kiloProgress('', '70', [])).toBeNull();
    expect(kiloProgress('70', '70', [])).toBeNull();
  });
  it('virgüllü girişi okur', () => {
    expect(kiloProgress('80,5', '70,5', [])).toMatchObject({ start: 80.5, target: 70.5 });
  });
});

describe('activeDays', () => {
  it('alışkanlık ve görev günlerini birleştirir, sıfır tarihi saymaz', () => {
    const at = new Date(2026, 10, 3, 12).toISOString();
    expect(activeDays(['2026-11-02', '2026-11-03', '2026-11-04'], ['2026-11-02'], [at, '0001-01-01T00:00:00', null])).toEqual([true, true, false]);
  });
});

describe('isPhantomKiloPlan', () => {
  const weight = { id: 1, title: 'Güncel kilonu gir', tags: ['spor', 'weight_entry'] };
  const empty = { currentWeight: '', targetWeight: '', weightLog: [] };
  it('yalnız tartım görevi olan, kilo bilgisi olmayan plan kurulmamıştır', () => {
    expect(isPhantomKiloPlan({ taskIds: [1], habitIds: [] }, empty, [weight])).toBe(true);
  });
  it('rutini, kilosu, tartımı veya başka görevi olan plan gerçektir', () => {
    expect(isPhantomKiloPlan({ taskIds: [1], habitIds: ['h'] }, empty, [weight])).toBe(false);
    expect(isPhantomKiloPlan({ taskIds: [1], habitIds: [] }, { ...empty, currentWeight: '80' }, [weight])).toBe(false);
    expect(isPhantomKiloPlan({ taskIds: [1], habitIds: [] }, { ...empty, weightLog: [{}] }, [weight])).toBe(false);
    expect(isPhantomKiloPlan({ taskIds: [1, 2], habitIds: [] }, empty, [weight, { id: 2, title: 'Yürü', tags: ['spor'] }])).toBe(false);
  });
  it('plan yoksa kurulmamış plan da yoktur', () => {
    expect(isPhantomKiloPlan({ taskIds: [], habitIds: [] }, empty, [])).toBe(false);
  });
});

describe('plan başında emoji ve boş plan', () => {
  it('eski kayıtlı hedef adı emojisiz görünür', () => {
    expect(stripEmoji('⚖️ Kilo Yönetimi')).toBe('Kilo Yönetimi');
  });
  it('Planım başlığı ve çipi adı emojisiz yazar', () => {
    const src = read('app/plan.tsx');
    expect(src).toContain('{goalTitle(p, lang, c.types[p.type], true)}');
    expect(src).toContain('goalTitle(plan, lang, PLAN_COPY[lang].types[plan.type])');
    expect(read('features/modes/utils/goalTitle.ts')).toContain('stripEmoji');
  });
  it('spor hedef ikonlarının hepsi çizgi ikondur, yazı olarak emoji düşmez', () => {
    for (const e of ['⚖️', '\u{1F3C3}', '\u{1F3C6}', '✨', '\u{1F4AA}']) expect(MODE_ICONS[e]).toBeDefined();
  });
  it('tarihsiz kilo planı günlük görev üretir', () => {
    const src = read('features/modes/hooks/usePlanAdaptations.ts');
    expect(src).toContain("if (slot.goal && (slot.date || sporKind(slot.goal) === 'kilo') && hasAppliedPlan(slot.taskIds, slot.habitIds)) {");
    expect(React).toBeDefined();
  });
});
