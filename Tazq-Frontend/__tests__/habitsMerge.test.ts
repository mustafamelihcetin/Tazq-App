import { mergeHabits, parseCloudHabits } from '@/features/habits/utils/habitsMerge';

/**
 * ALIŞKANLIK EŞİTLEMESİ — yerel ve bulut kopyanın birleşmesi (2026-10-25).
 *
 * Alışkanlıklar yalnız cihazdaydı; çıkışta ya da telefon değişince seriler kayboluyordu.
 * Kural: hiçbir taraftaki bir işaret KAYBOLMAZ — kimliğe göre birleşir, günler birleşir.
 * Yeni cihazda (yerel boş) bulut aynen gelir; bulut boşsa yerel aynen kalır.
 */
const h = (id: string, p: Record<string, unknown> = {}) => ({
  id, name: id, emoji: '📖', color: '#000', completedDates: [] as string[], skippedDates: [] as string[], createdAt: '2026-10-01T00:00:00.000Z', ...p,
});

describe('mergeHabits', () => {
  it('yeni cihaz: yerel boşsa bulut aynen gelir', () => {
    const cloud = [h('a', { completedDates: ['2026-10-20'] })];
    expect(mergeHabits([], cloud)).toEqual(cloud);
  });

  it('bulut boşsa yerel aynen kalır', () => {
    const local = [h('a')];
    expect(mergeHabits(local, [])).toEqual(local);
  });

  it('aynı alışkanlıkta iki cihazın işaretleri birleşir, sıralı ve tekil', () => {
    const local = [h('a', { completedDates: ['2026-10-22', '2026-10-20'] })];
    const cloud = [h('a', { completedDates: ['2026-10-21', '2026-10-20'] })];
    expect(mergeHabits(local, cloud)[0].completedDates).toEqual(['2026-10-20', '2026-10-21', '2026-10-22']);
  });

  it('mola günleri de birleşir; aynı gün hem yapıldı hem mola olamaz — yapıldı kazanır', () => {
    const local = [h('a', { completedDates: ['2026-10-20'], skippedDates: [] })];
    const cloud = [h('a', { completedDates: [], skippedDates: ['2026-10-20', '2026-10-19'] })];
    const m = mergeHabits(local, cloud)[0];
    expect(m.completedDates).toEqual(['2026-10-20']);
    expect(m.skippedDates).toEqual(['2026-10-19']);
  });

  it('ad/simge/renk YEREL kopyadan — kullanıcının bu cihazdaki son düzenlemesi', () => {
    const local = [h('a', { name: 'Kitap oku', emoji: '📚', color: '#111' })];
    const cloud = [h('a', { name: 'Eski ad', emoji: '📖', color: '#222' })];
    const m = mergeHabits(local, cloud)[0];
    expect([m.name, m.emoji, m.color]).toEqual(['Kitap oku', '📚', '#111']);
  });

  it('yalnız bir tarafta olan alışkanlıklar korunur; sıra: önce yerel, sonra yalnız bulutta olanlar', () => {
    const merged = mergeHabits([h('a'), h('b')], [h('c'), h('a')]);
    expect(merged.map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });

  it('en eski oluşturulma tarihi korunur (seri hesabı ona dayanır)', () => {
    const local = [h('a', { createdAt: '2026-10-25T10:00:00.000Z' })];
    const cloud = [h('a', { createdAt: '2026-09-01T10:00:00.000Z' })];
    expect(mergeHabits(local, cloud)[0].createdAt).toBe('2026-09-01T10:00:00.000Z');
  });

  it('bozuk bulut kaydı (kimliksiz) yok sayılır, yerel bozulmaz', () => {
    const local = [h('a')];
    expect(mergeHabits(local, [{ name: 'kimliksiz' } as any])).toEqual(local);
  });
});

describe('parseCloudHabits', () => {
  it('geçerli dizi → alışkanlıklar; tarih dizileri olmayan alanlar boş diziye tamamlanır', () => {
    const parsed = parseCloudHabits('[{"id":"a","name":"A","emoji":"x","color":"#000","createdAt":"2026-10-01"}]');
    expect(parsed?.[0].completedDates).toEqual([]);
    expect(parsed?.[0].skippedDates).toEqual([]);
  });

  it('boş/null/bozuk → null (yerel korunur, üzerine yazılmaz)', () => {
    expect(parseCloudHabits(null)).toBeNull();
    expect(parseCloudHabits('')).toBeNull();
    expect(parseCloudHabits('{bozuk')).toBeNull();
    expect(parseCloudHabits('{"id":"a"}')).toBeNull();
  });
});
