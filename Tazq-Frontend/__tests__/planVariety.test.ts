import { buildDailyTasks, DailyPlanSpec, getAllDailyPlanPairs } from '@/features/modes/utils/dailyPlanEngine';
import { LIBRARY_BY_KIND, libraryPool, planStage, ROUTINE_SUGGESTIONS } from '@/features/modes/data/planLibrary';
import { renderModeEmojiIcon } from '@/features/modes/utils/modeIcons';

const month = (spec: DailyPlanSpec) => {
  const seen: Record<string, number> = {};
  for (let d = 0; d < 30; d++) {
    const left = spec.daysLeft - d;
    for (const t of buildDailyTasks({ ...spec, daysLeft: left }, [], 'tr', new Date(2027, 0, 1 + d, 12))) seen[t.title] = (seen[t.title] ?? 0) + 1;
  }
  return seen;
};

describe('çeşitlilik: 30 günde aynı iki görev dönmez', () => {
  const cases: [string, DailyPlanSpec, number][] = [
    ['tez', { kind: 'tez', name: 'Tez', daysLeft: 120, dailyMinutes: 90 }, 12],
    ['tez son dönem', { kind: 'tez', name: 'Tez', daysLeft: 13, dailyMinutes: 60 }, 5],
    ['mülakat', { kind: 'mulakat', name: 'Şirket', daysLeft: 60, dailyMinutes: 60 }, 10],
    ['kilo', { kind: 'kilo', daysLeft: 120, dailyMinutes: 60 }, 12],
    ['maraton', { kind: 'maraton', daysLeft: 120, dailyMinutes: 60 }, 10],
    ['güç', { kind: 'guc', daysLeft: 120, dailyMinutes: 60 }, 12],
    ['genel', { kind: 'genel', daysLeft: 120, dailyMinutes: 60 }, 12],
    ['tasarruf', { kind: 'tasarruf', daysLeft: 120, dailyMinutes: 15 }, 12],
    ['bırakma', { kind: 'birakma', daysLeft: 3650, dailyMinutes: 15 }, 12],
  ];
  it.each(cases)('%s', (_n, spec, min) => {
    const seen = month(spec);
    expect(Object.keys(seen).length).toBeGreaterThanOrEqual(min);
    expect(Math.max(...Object.values(seen))).toBeLessThanOrEqual(4);
  });
  it('alan adı göreve rastgele yapışmaz', () => {
    expect(Object.keys(month(cases[0][1])).some(t => /Veri Analizi: kaynakça/.test(t))).toBe(false);
  });
});

describe('aşamaya uygunluk', () => {
  it('sınır günleri', () => {
    expect(planStage('mulakat', 1)).toBe('eve');
    expect(planStage('mulakat', 7)).toBe('late');
    expect(planStage('mulakat', 21)).toBe('mid');
    expect(planStage('tez', 60)).toBe('mid');
    expect(planStage('tez', 61)).toBe('early');
  });
  it('arife görevi erken dönemde gelmez, erken görev son günde gelmez', () => {
    expect(libraryPool('mulakat', 40).some(t => t.tr.startsWith('Saat, yol'))).toBe(false);
    expect(libraryPool('mulakat', 1).some(t => t.tr.startsWith('Saat, yol'))).toBe(true);
    expect(libraryPool('tez', 5).some(t => t.tr.startsWith('Araştırma sorunu'))).toBe(false);
  });
  it('her aşamada en az 3 görev var: plan boş kalmaz', () => {
    for (const kind of Object.keys(LIBRARY_BY_KIND)) for (const d of [200, 40, 10, 1]) {
      expect(libraryPool(kind, d).length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('kullanıcının seçimi', () => {
  it('odak alanı daha sık gelir', () => {
    const base = libraryPool('tez', 120).filter(t => t.area === 'tez_analysis').length;
    expect(libraryPool('tez', 120, ['tez_analysis']).filter(t => t.area === 'tez_analysis').length).toBe(base * 2);
  });
  it('bana uymuyor denen bir daha gelmez', () => {
    const victim = libraryPool('kilo', 100)[0].tr;
    const seen = month({ kind: 'kilo', daysLeft: 200, dailyMinutes: 60, hiddenItems: [victim] });
    expect(Object.keys(seen)).not.toContain(victim);
  });
});

describe('içerik düzeni', () => {
  it('iki dilde, kısa ve tekrarsız', () => {
    for (const list of Object.values(LIBRARY_BY_KIND)) {
      const keys = new Set<string>();
      for (const t of list) {
        expect(t.tr.trim()).toBeTruthy();
        expect(t.en.trim()).toBeTruthy();
        expect(t.tr.length).toBeLessThanOrEqual(90);
        expect(keys.has(t.tr)).toBe(false);
        keys.add(t.tr);
      }
    }
  });
  it('dil değişince çevrilir', () => {
    const pairs = getAllDailyPlanPairs();
    expect(pairs.some(p => p.tr === LIBRARY_BY_KIND.birakma[0].tr)).toBe(true);
  });
  it('her modun rutin önerisi var ve simgesi çizilir', () => {
    for (const k of ['exam', 'tez', 'mulakat', 'spor', 'ramazan', 'tasarruf', 'birakma']) {
      expect(ROUTINE_SUGGESTIONS[k].length).toBeGreaterThanOrEqual(3);
      for (const s of ROUTINE_SUGGESTIONS[k]) expect(renderModeEmojiIcon(s.emoji, 16, '#000')).toBeTruthy();
    }
  });
});
