import { detectExamFromInput } from '../shared/utils/examPresets';
import {
  findExamCurriculum,
  pickSubject,
  pickTopic,
  setCurriculum,
  getActiveCurriculumVersion,
  subjectExamLabel,
  BASELINE_CURRICULUM,
  ExamCurriculum,
  SubjectProgress,
} from '@/shared/utils/curriculum';

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
  it('AÖF için hazır liste yok: program kişiye göre değişir, kullanıcı kendi derslerini yazar', () => {
    expect(findExamCurriculum('AÖF')).toBeNull();
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

  it('doubles weight for a subject containing a weak-marked topic — the SUBJECT itself surfaces more often, not just its topic', () => {
    // Tüm dersler aynı gün çalışılmış (eşit eski) → yalnız ağırlık ayırt eder.
    const allSameDay: Record<string, SubjectProgress> = {};
    for (const s of kpss.subjects) allSameDay[s.id] = { lastStudied: '2026-06-20' };
    let turkceHits = 0;
    let totalHits = 0;
    // 'kpss_turkce_paragraf' Türkçe dersinin bir konusu (bkz. BASELINE_CURRICULUM).
    for (let d = 0; d < 90; d++) {
      const picked = pickSubject(kpss, allSameDay, d, ['kpss_turkce_paragraf']);
      if (picked) {
        totalHits++;
        if (picked.id === 'kpss_turkce') turkceHits++;
      }
    }
    const expectedShareWithoutWeak = 1 / kpss.subjects.length;
    expect(turkceHits / totalHits).toBeGreaterThan(expectedShareWithoutWeak);
  });

  it('weakTopicIds omitted/empty → identical behavior to before (backward compatible)', () => {
    const progress: Record<string, SubjectProgress> = { kpss_turkce: { lastStudied: '2026-06-01' } };
    expect(pickSubject(kpss, progress, 3, undefined)!.id).toBe(pickSubject(kpss, progress, 3, [])!.id);
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
  it('appends topic with " · " when provided', () => {
    const subject = { id: 's', tr: 'Türkçe', en: 'Turkish' };
    const topic = { id: 't', tr: 'Paragraf', en: 'Paragraph' };
    expect(subjectExamLabel('KPSS', subject, 'tr', topic)).toBe('KPSS — Türkçe · Paragraf');
    expect(subjectExamLabel('KPSS', subject, 'en', topic)).toBe('KPSS — Turkish · Paragraph');
  });
  it('omits topic suffix when topic is null/undefined', () => {
    const subject = { id: 's', tr: 'Türkçe', en: 'Turkish' };
    expect(subjectExamLabel('KPSS', subject, 'tr', null)).toBe('KPSS — Türkçe');
    expect(subjectExamLabel('KPSS', subject, 'tr')).toBe('KPSS — Türkçe');
  });
});

describe('pickTopic — konu seviyesinde aralıklı tekrar', () => {
  const kpss = BASELINE_CURRICULUM.exams.find(e => e.id === 'kpss')! as ExamCurriculum;
  const turkce = kpss.subjects.find(s => s.id === 'kpss_turkce')!;
  const konusuzDers = { id: 'x', tr: 'X', en: 'X', topics: [] } as ExamCurriculum['subjects'][number];

  it('returns null when the subject has no topics ', () => {
    expect(pickTopic(konusuzDers, {}, 0)).toBeNull();
  });

  it('prioritizes never-studied topics', () => {
    const progress: Record<string, SubjectProgress> = {
      kpss_turkce_sozcukte: { lastStudied: '2026-06-20' },
      kpss_turkce_cumlede: { lastStudied: '2026-06-20' },
    };
    const picked = pickTopic(turkce, progress, 0);
    expect(picked).not.toBeNull();
    expect(['kpss_turkce_paragraf', 'kpss_turkce_yazim', 'kpss_turkce_dilbilgisi', 'kpss_turkce_anlatim']).toContain(picked!.id);
  });

  it('is deterministic (same inputs → same output)', () => {
    const p = {};
    expect(pickTopic(turkce, p, 3)!.id).toBe(pickTopic(turkce, p, 3)!.id);
  });

  it('covers all topics over enough days', () => {
    const seen = new Set<string>();
    for (let d = 0; d < 40; d++) {
      const t = pickTopic(turkce, {}, d);
      if (t) seen.add(t.id);
    }
    expect(seen.size).toBe(turkce.topics!.length);
  });

  it('doubles weight for weakTopicIds so they appear more often', () => {
    const allSameDay: Record<string, SubjectProgress> = {};
    for (const t of turkce.topics!) allSameDay[t.id] = { lastStudied: '2026-06-20' };
    let weakHits = 0;
    let totalHits = 0;
    for (let d = 0; d < 60; d++) {
      const picked = pickTopic(turkce, allSameDay, d, ['kpss_turkce_paragraf']);
      if (picked) {
        totalHits++;
        if (picked.id === 'kpss_turkce_paragraf') weakHits++;
      }
    }
    const expectedShareWithoutWeak = 1 / turkce.topics!.length;
    expect(weakHits / totalHits).toBeGreaterThan(expectedShareWithoutWeak);
  });
});

describe('Dalga 2 — ALES/LGS/DGS/YDS tam konu derinliği', () => {
  const dalga2Ids = ['ales', 'lgs', 'dgs', 'yds'];

  it.each(dalga2Ids)('%s — her ders en az bir konu taşıyor', (examId) => {
    const exam = BASELINE_CURRICULUM.exams.find(e => e.id === examId)!;
    expect(exam).toBeDefined();
    expect(exam.subjects.length).toBeGreaterThan(0);
    for (const subject of exam.subjects) {
      expect(subject.topics?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it.each(dalga2Ids)('%s — pickTopic konu üretir, ders seviyesine düşmez', (examId) => {
    const exam = BASELINE_CURRICULUM.exams.find(e => e.id === examId)!;
    for (const subject of exam.subjects) {
      expect(pickTopic(subject, {}, 0)).not.toBeNull();
    }
  });

  it('subjectExamLabel bir Dalga-2 sınavında da konuyu doğru biçimde ekler', () => {
    const lgs = BASELINE_CURRICULUM.exams.find(e => e.id === 'lgs')!;
    const matematik = lgs.subjects.find(s => s.id === 'lgs_matematik')!;
    const topic = pickTopic(matematik, {}, 0)!;
    expect(subjectExamLabel('LGS', matematik, 'tr', topic)).toBe(`LGS — Matematik · ${topic.tr}`);
  });
});

describe('Dalga 3 — kalan nişler tam konu derinliği', () => {
  // `aof` ve `katiplik`'in klavye dersi KASITLI istisna (program-bağımlı / beceri testi
  // — bkz. curriculum.ts dosya başlığı); bu yüzden onlar hariç tüm dersler konu taşımalı.
  const dalga3Ids = [
    'ielts', 'toefl', 'tus', 'usmle', 'gre', 'gmat', 'msü', 'pmyo',
    'pte', 'bilsem', 'kaymakamlik', 'icra', 'smmm', 'bekcilik',
  ];

  it.each(dalga3Ids)('%s — her ders en az bir konu taşıyor', (examId) => {
    const exam = BASELINE_CURRICULUM.exams.find(e => e.id === examId)!;
    expect(exam).toBeDefined();
    expect(exam.subjects.length).toBeGreaterThan(0);
    for (const subject of exam.subjects) {
      expect(subject.topics?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it.each(dalga3Ids)('%s — pickTopic konu üretir, ders seviyesine düşmez', (examId) => {
    const exam = BASELINE_CURRICULUM.exams.find(e => e.id === examId)!;
    for (const subject of exam.subjects) {
      expect(pickTopic(subject, {}, 0)).not.toBeNull();
    }
  });

  it.each(['oabt', 'katiplik'])('%s — her ders konu taşıyor', (examId) => {
    const exam = BASELINE_CURRICULUM.exams.find(e => e.id === examId)!;
    for (const subject of exam.subjects) expect(subject.topics!.length).toBeGreaterThan(0);
  });

});

describe('Sınav konuları denetimi (2026-11-05)', () => {
  it('soru sayısı ağırlık olunca ders sırası peş peşe aynı dersi vermez', () => {
    const kpss = BASELINE_CURRICULUM.exams.find(e => e.id === 'kpss')!;
    const first = Array.from({ length: 6 }, (_, d) => pickSubject(kpss, {}, d)!.id);
    expect(new Set(first).size).toBeGreaterThan(1);
  });
  const exam = (id: string) => BASELINE_CURRICULUM.exams.find(e => e.id === id)!;
  const names = (id: string) => exam(id).subjects.flatMap(x => [x.en, ...(x.topics ?? []).map(t => t.en)]);

  it('YKS üç oturumu da içerir: TYT, AYT, YDT', () => {
    const ids = exam('yks').subjects.map(x => x.id);
    for (const id of ['yks_turkce', 'ayt_mat', 'ayt_edb', 'ydt']) expect(ids).toContain(id);
  });
  it('yıllar önce kalkan konular listede yok', () => {
    expect(names('gmat')).not.toContain('Sentence Correction');
    expect(names('gmat')).not.toContain('Geometry');
    expect(names('gre').join()).not.toMatch(/Argument/);
    expect(names('ales').join()).not.toMatch(/Verbal Problems/);
  });
  it('KPSS eksik başlıkları kapsar', () => {
    const all = names('kpss').join();
    for (const k of ['Verbal Logic', 'Numerical Logic', 'Word Problems', 'Contemporary', 'Basic Legal']) expect(all).toContain(k);
  });
  it('yeni sınavlar adıyla bulunur', () => {
    // Bu dosyadaki setCurriculum testi etkin listeyi değiştirir; bu yüzden gömülü listeye bakılır.
    for (const [name, id] of [['MEB-AGS', 'ags'], ['HMGS', 'hmgs'], ['YÖKDİL', 'yokdil'], ['E-KPSS', 'ekpss']]) {
      expect(detectExamFromInput(name)?.id).toBe(id);
      expect(BASELINE_CURRICULUM.exams.some(e => e.id === id)).toBe(true);
    }
  });
  it('kimlikler sınavlar arasında çakışmaz, her başlık iki dilli', () => {
    const seen = new Set<string>();
    for (const e of BASELINE_CURRICULUM.exams) for (const x of e.subjects) for (const t of [x, ...(x.topics ?? [])]) {
      expect(seen.has(t.id)).toBe(false);
      seen.add(t.id);
      expect(t.tr && t.en).toBeTruthy();
    }
  });
});

describe('YKS alan seçimi', () => {
  const { currentTrack, trackChanges, tracksFor } = require('../features/studyplan/data/blueprints');
  const yks = BASELINE_CURRICULUM.exams.find(e => e.id === 'yks')!;
  const ids = yks.subjects.map(x => x.id);
  const track = (id: string) => tracksFor('yks').find((t: { id: string }) => t.id === id);

  it('her alanın dersi müfredatta gerçekten var', () => {
    for (const t of tracksFor('yks')) for (const id of t.keep) expect(ids).toContain(id);
  });
  it('Sayısal seçilince Edebiyat çıkar, Fizik kalır', () => {
    const ch = trackChanges(track('say'), ids, []);
    expect(ch).toContainEqual({ id: 'ayt_edb', excluded: true });
    expect(ch.find((c: { id: string }) => c.id === 'ayt_fiz')).toBeUndefined();
  });
  it('seçim sonrası alan seçili görünür; ders elle eklenirse seçili sayılmaz', () => {
    const excluded = trackChanges(track('ea'), ids, []).filter((c: { excluded: boolean }) => c.excluded).map((c: { id: string }) => c.id);
    expect(currentTrack(tracksFor('yks'), ids, excluded)).toBe('ea');
    expect(currentTrack(tracksFor('yks'), ids, excluded.slice(1))).toBeNull();
  });
  it('alan değiştirince eski alanın dersi geri gelir', () => {
    const excluded = trackChanges(track('say'), ids, []).filter((c: { excluded: boolean }) => c.excluded).map((c: { id: string }) => c.id);
    expect(trackChanges(track('soz'), ids, excluded)).toContainEqual({ id: 'ayt_edb', excluded: false });
  });
  it('alanı olmayan sınavda seçim çıkmaz', () => {
    expect(tracksFor('kpss')).toEqual([]);
  });
});
