import fs from 'fs';
import path from 'path';
import { findExamCurriculum } from '@/shared/utils/curriculum';
import { canonicalExamName, customExamPreset, EXAM_PRESETS, liveExamName, popularExams, suggestExams } from '@/shared/utils/examPresets';

describe('sınav adı doğru biçime oturur (kullanıcı: "kpss yazınca kpss alıyor, KPSS değil")', () => {
  it.each([['kpss', 'KPSS'], ['KpSs', 'KPSS'], ['yks', 'YKS'], ['ielts', 'IELTS'], ['Ales', 'ALES']])('yazarken %s → %s', (a, b) => {
    expect(liveExamName(a)).toBe(b);
  });
  it('yarım yazım ve devam eden yazıma dokunulmaz', () => {
    expect(liveExamName('kp')).toBe('kp');
    expect(liveExamName('kpss ')).toBe('kpss ');
    expect(liveExamName('kpss a')).toBe('kpss a');
    expect(liveExamName('Benim sınavım')).toBe('Benim sınavım');
  });
  it('Türkçe klavye: İ ile büyümüş ad da tanınır', () => {
    expect(liveExamName('İelts')).toBe('IELTS');
  });
  it('alan bırakılınca takma ad kesinleşir, listede olmayan temizlenip kalır', () => {
    expect(canonicalExamName('kamu')).toBe('KPSS');
    expect(canonicalExamName('  kpss ')).toBe('KPSS');
    expect(canonicalExamName('  Benim   sınavım ')).toBe('Benim sınavım');
    expect(canonicalExamName('ehliyet sınavı')).toBe('Ehliyet sınavı');
    expect(canonicalExamName('iş güvenliği')).toBe('İş güvenliği');
    expect(canonicalExamName('internal exam', 'en')).toBe('Internal exam');
    expect(canonicalExamName('TOBB')).toBe('TOBB');
    expect(canonicalExamName('')).toBe('');
  });
  it('her hazır sınav kendi adını geri verir: canonical sabit', () => {
    for (const p of EXAM_PRESETS) expect(canonicalExamName(p.shortName.toLowerCase())).toBe(canonicalExamName(p.shortName));
  });
});

describe('öneri', () => {
  it('kısmi yazımda gelir', () => { expect(suggestExams('kp').map(p => p.shortName)).toContain('KPSS'); });
  it('tek harf hatası affedilir', () => {
    for (const typo of ['kpps', 'kps', 'kpsss', 'kpsa']) expect(suggestExams(typo).map(p => p.shortName)).toContain('KPSS');
  });
  it('alakasız yazıma öneri uydurmaz', () => {
    expect(suggestExams('zzzz')).toEqual([]);
    expect(suggestExams('k')).toEqual([]);
  });
  it('sık seçilenler gerçek sınavlar', () => {
    expect(popularExams('tr').map(p => p.shortName)).toEqual(expect.arrayContaining(['YKS', 'KPSS']));
    expect(popularExams('en').length).toBeGreaterThanOrEqual(4);
  });
  it('kendi sınavı tek kaynaktan', () => {
    expect(customExamPreset('Benim').id).toBe('custom-Benim');
    const card = fs.readFileSync(path.join(__dirname, '../features/modes/components/modes/ExamCard.tsx'), 'utf8');
    expect(card).not.toContain("id: 'custom-'");
    expect(card).toContain('<ExamNameField');
  });
});

describe('listede olmayan sınav (kullanıcı: "yazılan ad listede yoksa ne olacak")', () => {
  // Field bu adları kendi sınavı sayar; plan da başka sınavın konularını almamalı.
  it.each(['Ehliyet', 'Ehliyet sınavı', 'TOBB', 'Bütünleme', 'Final', 'Vize', 'Fizik finali', 'Matematik', 'Hukuk', 'Sınav', 'Staj', 'Kamu mülakatı', 'Eğitim', 'Üni'])('%s başka sınavın konularını sessizce almaz', (name) => {
    expect(findExamCurriculum(name)).toBeNull();
  });
  it('yakın olan önerilir, çevrilmez', () => {
    expect(canonicalExamName('kpps')).toBe('Kpps');
    expect(suggestExams('kpps')[0].shortName).toBe('KPSS');
  });
  it('alan gerçeği söyler ve sorar', () => {
    const f = fs.readFileSync(path.join(__dirname, '../features/modes/components/modes/ExamNameField.tsx'), 'utf8');
    expect(f).toContain('konu listesi olmadan');
    expect(f).toContain('didYouMean');
  });
});
