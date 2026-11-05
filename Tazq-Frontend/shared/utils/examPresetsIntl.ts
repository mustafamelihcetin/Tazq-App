import type { ExamPreset } from './examPresets';

/*
  İNGİLİZCE KULLANANLARIN SINAVLARI (2026-11-05). Ayrı dosya: examPresets Türkiye ağırlıklı ve uzun. Konu listesi yalnız yapısı
  kararlı sınavlarda var (curriculumIntl.ts); diğerlerinde kullanıcı kendi konularını yazar, plan yine çalışır.
*/
const preset = (id: string, displayName: string, aliases: string[], category: ExamPreset['category'], defaultDailyMinutes: number, tipTr: string, tipEn: string): ExamPreset => ({
  id, displayName, shortName: displayName, aliases, category, defaultDailyMinutes, preferredTemplates: ['active-recall', 'spaced-repetition', 'deep-work', 'sprint'], tipTr, tipEn,
});

export const INTL_EXAM_PRESETS: ExamPreset[] = [
  preset('sat', 'SAT', ['sat', 'digitalsat', 'dsat'], 'university', 60, 'Okuma-yazma ve matematik; bölüm denemeleriyle ilerle.', 'Reading, writing and math; progress with timed section practice.'),
  preset('act', 'ACT', ['act', 'actexam'], 'university', 60, 'İngilizce, matematik, okuma; hız ve süre yönetimi belirleyici.', 'English, math and reading; pacing decides a lot.'),
  preset('ap', 'AP Exams', ['ap', 'apexam', 'apexams', 'advancedplacement'], 'university', 60, 'Her ders ayrı: konularını kendin ekle.', 'Each subject is separate: add your own topics.'),
  preset('ib', 'IB Diploma', ['ib', 'ibdiploma', 'internationalbaccalaureate'], 'university', 90, 'Dersleri ve tarihlerini ayrı ayrı ekle.', 'Add each subject with its own date.'),
  preset('alevel', 'A-Levels', ['alevel', 'alevels'], 'university', 90, 'Dersleri ve tarihlerini ayrı ayrı ekle.', 'Add each subject with its own date.'),
  preset('gcse', 'GCSE', ['gcse', 'gcses'], 'highschool', 60, 'Dersleri ve tarihlerini ayrı ayrı ekle.', 'Add each subject with its own date.'),
  preset('lsat', 'LSAT', ['lsat'], 'graduate', 90, 'Mantık ve okuma; süreli bölüm çalışması önemli.', 'Logic and reading; timed sections matter.'),
  preset('mcat', 'MCAT', ['mcat'], 'medical', 150, 'Uzun sınav: tam denemeleri hafta sonuna koy.', 'A long exam: keep full-length practice for weekends.'),
  preset('nclex', 'NCLEX', ['nclex', 'nclexrn', 'nclexpn'], 'medical', 90, 'Klinik karar soruları; gerekçesini okuyarak çöz.', 'Clinical judgment questions; study the rationales.'),
  preset('plab', 'PLAB', ['plab'], 'medical', 120, 'Konularını kendin ekle; klinik senaryolarla çalış.', 'Add your own topics; practice with clinical scenarios.'),
  preset('cfa', 'CFA', ['cfa', 'cfalevel1', 'cfalevel2', 'cfalevel3'], 'graduate', 120, 'Konu başlıklarını ekle; uzun soluklu hazırlık.', 'Add your topic areas; this is a long haul.'),
  preset('cpa', 'CPA', ['cpa', 'cpaexam'], 'graduate', 120, 'Bölüm bölüm ilerle; her bölümü ayrı ders ekle.', 'Go section by section; add each one as a course.'),
  preset('acca', 'ACCA', ['acca'], 'graduate', 90, 'Her modülü ayrı ders olarak ekle.', 'Add each paper as its own course.'),
  preset('pmp', 'PMP', ['pmp', 'pmpexam'], 'graduate', 60, 'İnsan, süreç, iş ortamı; senaryo soruları çöz.', 'People, process, business environment; practice scenarios.'),
  preset('det', 'Duolingo English Test', ['det', 'duolingo', 'duolingoenglishtest'], 'language', 45, 'Kısa ve sık çalış; konuşma ve yazmayı atlama.', 'Short and often; do not skip speaking and writing.'),
  preset('cambridge', 'Cambridge English', ['cambridge', 'cae', 'cpe', 'fce', 'c1advanced', 'c2proficiency', 'b2first'], 'language', 60, 'Dört beceri ve dil kullanımı; bölüm denemeleriyle ilerle.', 'Four skills plus use of English; use section practice.'),
  preset('jlpt', 'JLPT', ['jlpt'], 'language', 60, 'Kelime, dil bilgisi, okuma, dinleme: konularını ekle.', 'Vocabulary, grammar, reading, listening: add your topics.'),
  preset('hsk', 'HSK', ['hsk'], 'language', 60, 'Seviyenin kelime listesini parçalara böl.', 'Split your level’s word list into chunks.'),
  preset('dele', 'DELE', ['dele'], 'language', 60, 'Dört beceriyi ayrı ayrı planla.', 'Plan the four skills separately.'),
  preset('delf', 'DELF / DALF', ['delf', 'dalf'], 'language', 60, 'Dört beceriyi ayrı ayrı planla.', 'Plan the four skills separately.'),
  preset('goethe', 'Goethe-Zertifikat', ['goethe', 'goethezertifikat', 'testdaf'], 'language', 60, 'Dört beceriyi ayrı ayrı planla.', 'Plan the four skills separately.'),
  preset('ged', 'GED', ['ged', 'gedtest'], 'highschool', 60, 'Dört alanı ayrı ayrı girebilirsin; önce en yakınına çalış.', 'You can take the four areas separately; start with the nearest.'),
  preset('itcert', 'IT Certification', ['aws', 'azure', 'comptia', 'ccna', 'gcp', 'itcert'], 'other', 60, 'Sınavın alan listesini konu olarak ekle.', 'Add the exam’s domain list as your topics.'),
  preset('final', 'Vize / Final', ['final', 'finals', 'vize', 'vizeler', 'finaller', 'midterm', 'midterms', 'butunleme'], 'other', 90, 'Derslerini ve tarihlerini ekle; süre yakın sınava göre bölünür.', 'Add your courses and dates; time follows the nearest exam.'),
];
