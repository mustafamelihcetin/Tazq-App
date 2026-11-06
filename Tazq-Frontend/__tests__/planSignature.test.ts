import { chainPaid, coinHeap, coinsFor, examFieldOf, litCount, lutAt, platesPerSide, polyLut, shelfLayout, stepPosition, moonIllumination, passedMilestones, ramadanDay, valueAtPct, vineProgress } from '@/features/modes/utils/planSignature';
import { libraryPool } from '@/features/modes/data/planLibrary';
import { useBudgetStore } from '@/shared/store/useBudgetStore';
import { getModeInfoForTask } from '@/features/modes/utils/modeHelpers';
import { getCleanDays, QUIT_MILESTONES } from '@/shared/store/useQuitStore';
import { toDateKey } from '@/shared/utils/dateKey';

describe('plan imzası — görsel gerçek ölçüyü çizer', () => {
  it('sarmaşık: eşik öncesi 0, eşik düğüme denk, arası orantılı, son eşikte 1', () => {
    const m = [1, 3, 7];
    expect(vineProgress(0, m)).toBe(0);
    expect(vineProgress(1, m)).toBe(0);
    expect(vineProgress(3, m)).toBe(0.5);
    expect(vineProgress(5, m)).toBe(0.75);
    expect(vineProgress(7, m)).toBe(1);
    expect(vineProgress(400, m)).toBe(1);
    expect(passedMilestones(3, m)).toBe(2);
  });

  it('raf: 45 konu 5 kitaba iner, kitaplar rafa sığar, dolgu biten paydır', () => {
    const books = [{ done: 3, total: 14 }, { done: 0, total: 8 }, { done: 8, total: 8 }, { done: 1, total: 10 }, { done: 0, total: 5 }];
    const l = shelfLayout(books, 300, 80);
    expect(l).toHaveLength(5);
    expect(l[4].x + l[4].w).toBeLessThanOrEqual(300);
    expect(l[0].w).toBeGreaterThan(l[4].w);
    expect(l[2].share).toBe(1);
    expect(l[1].share).toBe(0);
  });

  it('ay: ortada dolunay, başta ve sonda hilal', () => {
    expect(moonIllumination(15, 30)).toBeCloseTo(1);
    expect(moonIllumination(1, 30)).toBeLessThan(0.15);
    expect(moonIllumination(30, 30)).toBeCloseTo(0);
    expect(ramadanDay(30, 30)).toBe(1);
    expect(ramadanDay(1, 30)).toBe(30);
  });

  it('eşik değeri başlangıçtan hedefe: kilo verirken iner', () => {
    expect(valueAtPct(77, 68, 50)).toBe(72.5);
    expect(valueAtPct(10000, 50000, 25)).toBe(20000);
  });
});

describe('hedef sahneleri', () => {
  it('nokta çizginin uzunluğuna göre ilerler', () => {
    const l = polyLut([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
    expect(lutAt(l, 0.5)).toEqual({ x: 10, y: 0 });
    expect(lutAt(l, 1)).toEqual({ x: 10, y: 10 });
    expect(lutAt(l, -1)).toEqual({ x: 0, y: 0 });
  });
  it('basamak: düzde sıçramaz, sonda bir üste çıkar', () => {
    expect(stepPosition(1.3).hop).toBe(0);
    expect(stepPosition(1.85).hop).toBeGreaterThan(0.9);
    expect(stepPosition(2).step).toBe(2);
  });
  it('bar dengede: plakalar çift takılır, slot sınırını aşmaz', () => {
    expect(platesPerSide(0, 4)).toBe(0);
    expect(platesPerSide(1, 4)).toBe(1);
    expect(platesPerSide(7, 4)).toBe(4);
  });
  it('zincir: ödeme yoksa kopmaz, borç bitmeden tamamen gitmez', () => {
    expect(chainPaid(0, 10)).toBe(0);
    expect(chainPaid(0.01, 10)).toBe(1);
    expect(chainPaid(0.99, 10)).toBe(9);
    expect(chainPaid(1, 10)).toBe(10);
  });
});

describe('sınavın alanı', () => {
  it.each([
    ['Mahkeme Katipliği', 'typing'], ['Zabıt Katibi', 'typing'], ['HMGS', 'law'], ['Hukuk Mezunları Sınavı', 'law'], ['İYÖS', 'law'],
    ['IELTS', 'language'], ['YDS', 'language'], ['TUS', 'health'], ['KPSS Hemşirelik', 'health'], ['DGS', 'numeric'], ['ALES', 'numeric'],
    ['Ehliyet', 'driving'], ['POMEM', 'security'], ['ÖABT', 'teaching'], ['AWS Sertifika', 'tech'], ['KPSS', 'general'], ['YKS', 'general'],
  ])('%s → %s', (name, field) => { expect(examFieldOf(name as string)).toBe(field); });
  it('Türkçe büyük harf de eşleşir, boş ad genel kalır', () => {
    expect(examFieldOf('KATİPLİK')).toBe('typing');
    expect(examFieldOf('')).toBe('general');
  });
  it('yanan öğe: iş başladıysa en az bir, hedefe varmadan tamamı değil', () => {
    expect(litCount(0, 27)).toBe(0);
    expect(litCount(0.01, 27)).toBe(1);
    expect(litCount(0.999, 27)).toBe(26);
    expect(litCount(1, 27)).toBe(27);
  });
});

describe('kumbara yığını', () => {
  const box = { x: 10, y: 20, w: 60, h: 50, rx: 8, ry: 3 };
  it('aynı girdide aynı yığın: eklenince eskiler yerinden oynamaz', () => {
    expect(coinHeap(box)).toEqual(coinHeap(box));
  });
  it('alttan yukarı dolar ve dizilim düzensizdir', () => {
    const h = coinHeap(box);
    expect(h[0].y).toBeGreaterThan(h[h.length - 1].y);
    expect(new Set(h.map(c => c.angle.toFixed(2))).size).toBeGreaterThan(h.length / 2);
  });
  it('sikke sayısı: boşken yok, hedefe varmadan tam dolu değil', () => {
    expect(coinsFor(0, 30)).toBe(0);
    expect(coinsFor(0.01, 30)).toBe(1);
    expect(coinsFor(0.99, 30)).toBe(29);
    expect(coinsFor(1, 30)).toBe(30);
  });
});

describe('plana özgü içerik', () => {
  const titles = () => libraryPool('tasarruf', 180).map(t => t.tr);
  afterEach(() => useBudgetStore.setState({ budgetType: '' }));

  it('birikim hedefine borç görevi gelmez, borç hedefine gelir', () => {
    useBudgetStore.setState({ budgetType: 'birikim' });
    expect(titles().join()).not.toMatch(/borc/i);
    useBudgetStore.setState({ budgetType: 'borc' });
    expect(titles().join()).toMatch(/borc/i);
  });

  it('temiz gün tek kaynaktan: bugün başlayan 1. gündedir', () => {
    expect(getCleanDays(toDateKey(new Date()))).toBe(1);
    expect(typeof getModeInfoForTask).toBe('function');
    expect(QUIT_MILESTONES[0]).toBe(1);
  });
});
