import {
  findExamCurriculum,
  pickSubject,
  setCurriculum,
  getActiveCurriculumVersion,
  subjectExamLabel,
  BASELINE_CURRICULUM,
  ExamCurriculum,
  SubjectProgress,
} from '../utils/curriculum';

describe('findExamCurriculum', () => {
  it('finds a known exam by exact alias (case-insensitive)', () => {
    expect(findExamCurriculum('KPSS')?.id).toBe('kpss');
    expect(findExamCurriculum('kpss')?.id).toBe('kpss');
  });
  it('finds via fuzzy match (partial input, detectExamFromInput null → matchExamName)', () => {
    expect(findExamCurriculum('kps')?.id).toBe('kpss'); // partial → fuzzy
  });
  it('returns null for unknown exam (→ jenerik akışa düşer)', () => {
    expect(findExamCurriculum('Falanca Sınavı 123')).toBeNull();
  });
  it('returns null for empty input', () => {
    expect(findExamCurriculum('')).toBeNull();
    expect(findExamCurriculum('   ')).toBeNull();
  });
  it('returns null for a preset that has no curriculum yet (ör. IELTS)', () => {
    expect(findExamCurriculum('IELTS')).toBeNull();
  });
});

describe('pickSubject — aralıklı tekrar', () => {
  const kpss = BASELINE_CURRICULUM.exams.find(e => e.id === 'kpss')! as ExamCurriculum;

  it('prioritizes never-studied subjects', () => {
    const progress: Record<string, SubjectProgress> = {
      kpss_turkce: { lastStudied: '2026-06-20' },
      kpss_matematik: { lastStudied: '2026-06-20' },
      // diğerleri hiç çalışılmamış → öncelikli
    };
    const picked = pickSubject(kpss, progress, 0);
    expect(picked).not.toBeNull();
    expect(['kpss_tarih', 'kpss_cografya', 'kpss_vatandaslik', 'kpss_guncel']).toContain(picked!.id);
  });

  it('picks the least-recently-studied when all studied', () => {
    const progress: Record<string, SubjectProgress> = {
      kpss_turkce: { lastStudied: '2026-06-01' }, // en eski
      kpss_matematik: { lastStudied: '2026-06-20' },
      kpss_tarih: { lastStudied: '2026-06-20' },
      kpss_cografya: { lastStudied: '2026-06-20' },
      kpss_vatandaslik: { lastStudied: '2026-06-20' },
      kpss_guncel: { lastStudied: '2026-06-20' },
    };
    expect(pickSubject(kpss, progress, 0)!.id).toBe('kpss_turkce');
  });

  it('is deterministic (same inputs → same output)', () => {
    const p = {};
    expect(pickSubject(kpss, p, 5)!.id).toBe(pickSubject(kpss, p, 5)!.id);
  });

  it('covers all subjects over enough days (weighted rotation)', () => {
    const seen = new Set<string>();
    for (let d = 0; d < 30; d++) {
      const s = pickSubject(kpss, {}, d);
      if (s) seen.add(s.id);
    }
    // Tüm konular en az bir kez seçilmeli
    expect(seen.size).toBe(kpss.subjects.length);
  });

  it('returns null for an exam with no subjects', () => {
    expect(pickSubject({ id: 'x', subjects: [] }, {}, 0)).toBeNull();
  });
});

describe('setCurriculum — sürüm geçişli remote override', () => {
  afterEach(() => {
    // Testler arası izolasyon için baseline'a döndürmeye çalış (yalnız daha yeni sürüm geçer;
    // bu yüzden çok yüksek sürümle override ettikten sonra geri dönülemez — bu testi en sona koy).
  });

  it('rejects invalid payloads', () => {
    expect(setCurriculum(null as any)).toBe(false);
    expect(setCurriculum({} as any)).toBe(false);
    expect(setCurriculum({ version: 5 } as any)).toBe(false);
  });

  it('rejects same-or-older version', () => {
    const cur = getActiveCurriculumVersion();
    expect(setCurriculum({ version: cur, exams: [] })).toBe(false);
  });

  it('applies a newer version', () => {
    const newer = getActiveCurriculumVersion() + 1;
    const ok = setCurriculum({ version: newer, exams: [{ id: 'kpss', subjects: [{ id: 'k1', tr: 'Yeni', en: 'New' }] }] });
    expect(ok).toBe(true);
    expect(getActiveCurriculumVersion()).toBe(newer);
    expect(findExamCurriculum('KPSS')?.subjects[0].id).toBe('k1');
  });
});

describe('subjectExamLabel', () => {
  it('formats "Exam — Subject"', () => {
    expect(subjectExamLabel('KPSS', { id: 's', tr: 'Türkçe', en: 'Turkish' }, 'tr')).toBe('KPSS — Türkçe');
    expect(subjectExamLabel('KPSS', { id: 's', tr: 'Türkçe', en: 'Turkish' }, 'en')).toBe('KPSS — Turkish');
  });
});
