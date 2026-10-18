import { INTERVIEW_AREAS, TEZ_AREAS, SPOR_AREAS, pickWeightedArea, areaLabel } from '@/shared/utils/weakAreas';

describe('pickWeightedArea', () => {
  it('returns null for an empty area list', () => {
    expect(pickWeightedArea([], 0)).toBeNull();
  });

  it('is deterministic (same inputs → same output)', () => {
    expect(pickWeightedArea(INTERVIEW_AREAS, 3)!.id).toBe(pickWeightedArea(INTERVIEW_AREAS, 3)!.id);
  });

  it('covers all areas over enough days (no weak ids)', () => {
    const seen = new Set<string>();
    for (let d = 0; d < 30; d++) {
      const a = pickWeightedArea(INTERVIEW_AREAS, d);
      if (a) seen.add(a.id);
    }
    expect(seen.size).toBe(INTERVIEW_AREAS.length);
  });

  it('doubles weight for weak-marked areas so they appear more often', () => {
    let weakHits = 0;
    let totalHits = 0;
    for (let d = 0; d < 60; d++) {
      const picked = pickWeightedArea(TEZ_AREAS, d, ['tez_writing']);
      if (picked) {
        totalHits++;
        if (picked.id === 'tez_writing') weakHits++;
      }
    }
    const expectedShareWithoutWeak = 1 / TEZ_AREAS.length;
    expect(weakHits / totalHits).toBeGreaterThan(expectedShareWithoutWeak);
  });

  it('each sport type has its own non-empty area list', () => {
    for (const kind of Object.keys(SPOR_AREAS) as (keyof typeof SPOR_AREAS)[]) {
      expect(SPOR_AREAS[kind].length).toBeGreaterThan(0);
    }
  });
});

describe('areaLabel', () => {
  it('appends area with " — " when provided', () => {
    const area = { id: 'x', tr: 'Teknik Sorular', en: 'Technical Questions' };
    expect(areaLabel('Google Mülakatı', area, 'tr')).toBe('Google Mülakatı — Teknik Sorular');
    expect(areaLabel('Google Interview', area, 'en')).toBe('Google Interview — Technical Questions');
  });

  it('returns base name unchanged when area is null/undefined', () => {
    expect(areaLabel('Google Mülakatı', null, 'tr')).toBe('Google Mülakatı');
    expect(areaLabel('Google Mülakatı', undefined, 'tr')).toBe('Google Mülakatı');
  });

  it('returns the area label alone if baseName is empty', () => {
    const area = { id: 'x', tr: 'Teknik Sorular', en: 'Technical Questions' };
    expect(areaLabel('', area, 'tr')).toBe('Teknik Sorular');
  });
});

describe('alan bankaları — id benzersizliği', () => {
  it('no id collisions across interview/tez/spor areas', () => {
    const all = [...INTERVIEW_AREAS, ...TEZ_AREAS, ...Object.values(SPOR_AREAS).flat()];
    const ids = all.map(a => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
