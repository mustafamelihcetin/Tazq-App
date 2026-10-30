/**
 * Ana sayfa "yaşayan cümle": günün durumu grafik yerine okunur bir cümle.
 */
import { buildDaySentence, type Segment, type DayMetric } from '@/features/dashboard/utils/daySentence';

const plain = (segs: Segment[]) => segs.map(s => (s.t === 'token' ? `⟨${s.s}⟩` : s.s)).join(' ').replace(/ ,/g, ',');
const m = (tasks: [number, number], focus: [number, number], habits: [number, number]): DayMetric[] => [
  { kind: 'tasks', done: tasks[0], total: tasks[1] },
  { kind: 'focus', done: focus[0], total: focus[1] },
  { kind: 'habits', done: habits[0], total: habits[1] },
];

describe('yaşayan cümle', () => {
  it('hepsi bekliyor', () => {
    expect(plain(buildDaySentence(m([0, 3], [0, 90], [0, 1]), 'tr'))).toBe('Bugün seni ⟨3 görev⟩, ⟨90 dk odak⟩ ve ⟨1 alışkanlık⟩ bekliyor.');
  });

  it('hapta KALAN miktar yazar', () => {
    expect(plain(buildDaySentence(m([1, 3], [25, 90], [0, 1]), 'tr'))).toBe('Bugün seni ⟨2 görev⟩, ⟨65 dk odak⟩ ve ⟨1 alışkanlık⟩ bekliyor.');
  });

  it('biri bitince tamam + kalanlar', () => {
    expect(plain(buildDaySentence(m([3, 3], [25, 90], [0, 1]), 'tr'))).toBe('⟨✓ Görevler⟩ tamam; ⟨65 dk odak⟩ ve ⟨1 alışkanlık⟩ kaldı.');
  });

  it('hepsi bitince günü kapattın', () => {
    const segs = buildDaySentence(m([3, 3], [90, 90], [1, 1]), 'tr');
    expect(plain(segs)).toBe('Günü kapattın: ⟨✓ Görevler⟩ ⟨✓ Odak⟩ ⟨✓ Alışkanlıklar⟩');
    expect(segs.filter(s => s.t === 'token').every(s => s.t === 'token' && s.done)).toBe(true);
  });

  it('hedefi olmayan ölçü cümleye girmez; hiç hedef yoksa plan boş', () => {
    expect(plain(buildDaySentence(m([0, 0], [0, 90], [0, 0]), 'tr'))).toBe('Bugün seni ⟨90 dk odak⟩ bekliyor.');
    expect(plain(buildDaySentence(m([0, 0], [0, 0], [0, 0]), 'tr'))).toBe('Bugün için planın boş.');
  });

  it('geçmiş gün yapılanı anlatır; boşsa dinlenme günü', () => {
    expect(plain(buildDaySentence(m([2, 3], [45, 90], [1, 1]), 'tr', true))).toBe('⟨2 görev⟩ bitirdin, ⟨45 dk⟩ odaklandın ve ⟨1 alışkanlık⟩ yaptın.');
    expect(plain(buildDaySentence(m([0, 2], [0, 90], [0, 1]), 'tr', true))).toBe('Bu gün kayıt yok — dinlenme günü.');
  });

  it('İngilizce tekil/çoğul', () => {
    expect(plain(buildDaySentence(m([0, 1], [0, 0], [0, 2]), 'en'))).toBe('You have ⟨1 task⟩ and ⟨2 habits⟩ waiting today.');
  });
});
