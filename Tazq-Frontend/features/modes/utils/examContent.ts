import { CategoryColors } from '@/shared/constants/Colors';
import type { ModeHabit, ModeTask } from './turkishModes';

// ── Exam-specific content packages ────────────────────────────────────────────

export interface ExamContent {
  emoji: string;
  temelHabits: ModeHabit[];
  ortaHabits: ModeHabit[];
  ileriHabits: ModeHabit[];
  setupTasks: ModeTask[];
  sprintTasks: ModeTask[];
}

export const EXAM_CONTENT: Record<string, ExamContent> = {
  yks: {
    emoji: '📚',
    temelHabits: [
      { name: 'Konu Kavrama', nameTr: 'Konu kavrama okuma (TYT)', emoji: '📖', color: CategoryColors.blue },
      { name: 'Mini Soru', nameTr: 'Günlük mini soru (10–20)', emoji: '📝', color: CategoryColors.green },
    ],
    ortaHabits: [
      { name: 'Matematik Soru', nameTr: 'Matematik günlük soru', emoji: '📐', color: CategoryColors.blue },
      { name: 'Türkçe Paragraf', nameTr: 'Türkçe paragraf tekrarı', emoji: '📖', color: CategoryColors.green },
      { name: 'AYT Konu Özeti', nameTr: 'Fen/AYT konu özeti', emoji: '🔬', color: CategoryColors.violet },
      { name: 'Hata Defteri', nameTr: 'Hata defteri güncelle', emoji: '❌', color: CategoryColors.red },
    ],
    ileriHabits: [
      { name: 'Deneme Analizi', nameTr: 'Günlük deneme analizi', emoji: '📊', color: CategoryColors.red },
      { name: 'AYT Mat Yoğun', nameTr: 'AYT matematik yoğun', emoji: '📐', color: CategoryColors.blue },
      { name: 'TYT Hız', nameTr: 'TYT hız & doğruluk pratiği', emoji: '⚡', color: CategoryColors.amber },
      { name: 'Zayıf Konu', nameTr: 'Zayıf konu sprint', emoji: '🎯', color: CategoryColors.violet },
      { name: 'Hata Defteri', nameTr: 'Hata defteri & tekrar', emoji: '❌', color: CategoryColors.red },
    ],
    setupTasks: [
      { titleTr: 'TYT ve AYT konu dağılımını ÖSYM sitesinden incele', titleEn: 'Review TYT and AYT topic breakdown on ÖSYM website', priority: 'High' },
      { titleTr: 'Kaynak kitaplar ve soru bankaları temin et', titleEn: 'Get study books and question banks', priority: 'High' },
      { titleTr: 'Haftalık deneme sınavı takvimi oluştur', titleEn: 'Create weekly mock exam schedule', priority: 'Medium' },
    ],
    sprintTasks: [
      { titleTr: 'Her gün tam TYT denemesi çöz ve analiz et', titleEn: 'Solve and analyze a full TYT mock daily', priority: 'High' },
      { titleTr: 'AYT hedef bölüm için odak çalışma bloğu ayır', titleEn: 'Allocate a focus block for your AYT target section', priority: 'High' },
      { titleTr: 'Hata defterini baştan sona tekrar et', titleEn: 'Review your error log from start to finish', priority: 'Medium' },
    ],
  },
  kpss: {
    emoji: '🏛️',
    temelHabits: [
      { name: 'GY-GK Konu', nameTr: 'GY-GK konu okuma', emoji: '📚', color: CategoryColors.blue },
      { name: 'Mini Soru', nameTr: 'Mini soru çözümü (20)', emoji: '📝', color: CategoryColors.green },
    ],
    ortaHabits: [
      { name: 'Tarih-Coğrafya', nameTr: 'Tarih/Coğrafya/Vatandaşlık', emoji: '📚', color: CategoryColors.blue },
      { name: 'Anayasa', nameTr: 'Anayasa & Hukuk özeti', emoji: '⚖️', color: CategoryColors.amber },
      { name: 'Eğitim Bil.', nameTr: 'Eğitim Bilimleri flashcard', emoji: '🧠', color: CategoryColors.violet },
      { name: 'GY-GK Soru', nameTr: 'GY-GK soru bankası', emoji: '📝', color: CategoryColors.green },
    ],
    ileriHabits: [
      { name: 'Soru Bankası', nameTr: 'Günlük soru bankası (60+)', emoji: '📝', color: CategoryColors.red },
      { name: 'Eğitim Bil.', nameTr: 'Eğitim Bilimleri yoğun', emoji: '🧠', color: CategoryColors.violet },
      { name: 'Çıkmış Sorular', nameTr: 'Çıkmış KPSS soru analizi', emoji: '📊', color: CategoryColors.blue },
      { name: 'Hata Analizi', nameTr: 'Hata analizi & tekrar', emoji: '❌', color: CategoryColors.red },
      { name: 'Konu Haritası', nameTr: 'Konu haritası çıkarma', emoji: '🗂️', color: CategoryColors.green },
    ],
    setupTasks: [
      { titleTr: 'KPSS puan türünü belirle (P1–P10, KPSS-A/B)', titleEn: 'Identify your KPSS score type (P1–P10, KPSS-A/B)', priority: 'High' },
      { titleTr: 'Eğitim Bilimleri kaynak kitap temin et', titleEn: 'Get an Education Sciences resource book', priority: 'High' },
      { titleTr: 'Son 5 yıl KPSS çıkmış sorularını indir', titleEn: 'Download the last 5 years of KPSS past questions', priority: 'High' },
    ],
    sprintTasks: [
      { titleTr: 'Branş ağırlığına göre öncelik listesi yap', titleEn: 'Prioritize topics by exam weight', priority: 'High' },
      { titleTr: 'Her gün tüm alanlardan karma soru çöz', titleEn: 'Solve mixed questions from all areas daily', priority: 'High' },
      { titleTr: 'Eğitim Bilimleri zayıf konuları yoğunlaştır', titleEn: 'Intensify weak Education Sciences topics', priority: 'Medium' },
    ],
  },
  ales: {
    emoji: '🎓',
    temelHabits: [
      { name: 'Sayısal Giriş', nameTr: 'Sayısal muhakeme giriş soruları', emoji: '🔢', color: CategoryColors.blue },
      { name: 'Sözel Giriş', nameTr: 'Sözel analoji çalışması', emoji: '📝', color: CategoryColors.green },
    ],
    ortaHabits: [
      { name: 'Sayısal Muhakeme', nameTr: 'Sayısal muhakeme soruları', emoji: '🔢', color: CategoryColors.blue },
      { name: 'Sözel Paragraf', nameTr: 'Sözel paragraf & analoji', emoji: '📝', color: CategoryColors.green },
      { name: 'Süreli Çözüm', nameTr: 'Süreli çözüm pratiği', emoji: '⏱️', color: CategoryColors.amber },
    ],
    ileriHabits: [
      { name: 'ALES Sayısal', nameTr: 'ALES sayısal yoğun (45 dk)', emoji: '🔢', color: CategoryColors.blue },
      { name: 'Sözel Tam Set', nameTr: 'Sözel tam set çözümü', emoji: '📝', color: CategoryColors.green },
      { name: 'Zaman Yönetimi', nameTr: 'Zaman yönetimi simülasyonu', emoji: '⏱️', color: CategoryColors.amber },
      { name: 'Hata Analizi', nameTr: 'Hata analizi & tekrar', emoji: '❌', color: CategoryColors.red },
    ],
    setupTasks: [
      { titleTr: 'ALES sayısal/sözel ağırlık dengesini belirle', titleEn: 'Determine your ALES quantitative/verbal balance', priority: 'High' },
      { titleTr: 'Resmi ALES örnek sınavlarını ÖSYM\'den indir', titleEn: 'Download official ALES sample exams from ÖSYM', priority: 'High' },
    ],
    sprintTasks: [
      { titleTr: 'Her gün tam ALES denemesi çöz', titleEn: 'Solve a full ALES mock exam every day', priority: 'High' },
      { titleTr: 'Sayısal/sözel hız pratiği yap', titleEn: 'Practice quantitative/verbal speed drills', priority: 'High' },
    ],
  },
  lgs: {
    emoji: '🏫',
    temelHabits: [
      { name: 'Matematik Temel', nameTr: 'Matematik temel konu', emoji: '📐', color: CategoryColors.blue },
      { name: 'Türkçe Paragraf', nameTr: 'Türkçe paragraf okuma', emoji: '📖', color: CategoryColors.green },
    ],
    ortaHabits: [
      { name: 'Matematik', nameTr: 'Matematik konu + soru', emoji: '📐', color: CategoryColors.blue },
      { name: 'Türkçe', nameTr: 'Türkçe dil bilgisi & paragraf', emoji: '📖', color: CategoryColors.green },
      { name: 'Fen Bilimleri', nameTr: 'Fen Bilimleri konu özeti', emoji: '🔬', color: CategoryColors.violet },
      { name: 'Sosyal', nameTr: 'Sosyal Bilgiler harita çalışması', emoji: '🌍', color: CategoryColors.amber },
    ],
    ileriHabits: [
      { name: 'Matematik', nameTr: 'Matematik deneme soruları', emoji: '📐', color: CategoryColors.blue },
      { name: 'Türkçe Hız', nameTr: 'Türkçe hız çözüm', emoji: '📖', color: CategoryColors.green },
      { name: 'Fen Tarama', nameTr: 'Fen tam konu taraması', emoji: '🔬', color: CategoryColors.violet },
      { name: 'Sosyal+İnkılap', nameTr: 'Sosyal + İnkılap tarih özeti', emoji: '🌍', color: CategoryColors.amber },
      { name: 'İngilizce', nameTr: 'İngilizce kelime & okuma', emoji: '🇬🇧', color: CategoryColors.pink },
    ],
    setupTasks: [
      { titleTr: 'LGS müfredatına göre ders ders konu tarama listesi çıkar', titleEn: 'Create a topic checklist for each LGS subject', priority: 'High' },
      { titleTr: 'Her ders için kaynak kitap ve soru bankası belirle', titleEn: 'Identify study books and question banks for each subject', priority: 'High' },
    ],
    sprintTasks: [
      { titleTr: 'Her gün tam LGS denemesi çöz ve analiz et', titleEn: 'Solve and analyze a full LGS mock daily', priority: 'High' },
      { titleTr: 'Zayıf derste odak çalışması yap', titleEn: 'Do focused study on your weakest subject', priority: 'High' },
    ],
  },
  dgs: {
    emoji: '🔄',
    temelHabits: [
      { name: 'Sayısal Temel', nameTr: 'Sayısal yetenek temel soruları', emoji: '🔢', color: CategoryColors.blue },
      { name: 'Sözel Giriş', nameTr: 'Sözel yetenek giriş', emoji: '📝', color: CategoryColors.green },
    ],
    ortaHabits: [
      { name: 'Sayısal', nameTr: 'Sayısal yetenek soruları', emoji: '🔢', color: CategoryColors.blue },
      { name: 'Sözel Paragraf', nameTr: 'Sözel yetenek paragraf', emoji: '📝', color: CategoryColors.green },
    ],
    ileriHabits: [
      { name: 'DGS Sayısal', nameTr: 'DGS sayısal yoğun', emoji: '🔢', color: CategoryColors.blue },
      { name: 'Sözel Tam Set', nameTr: 'Sözel tam set çözümü', emoji: '📝', color: CategoryColors.green },
      { name: 'Süreli Deneme', nameTr: 'Süreli deneme çözümü', emoji: '⏱️', color: CategoryColors.amber },
    ],
    setupTasks: [
      { titleTr: 'Önlisans programına göre DGS bölüm seçimini araştır', titleEn: 'Research DGS program options for your associate degree', priority: 'High' },
      { titleTr: 'ÖSYM DGS örnek sorularını indir', titleEn: 'Download official DGS sample questions from ÖSYM', priority: 'High' },
    ],
    sprintTasks: [
      { titleTr: 'Her gün tam DGS denemesi çöz', titleEn: 'Solve a full DGS mock exam every day', priority: 'High' },
      { titleTr: 'Sayısal/sözel zayıf alan odak çalışması', titleEn: 'Focus on your weaker quantitative or verbal area', priority: 'Medium' },
    ],
  },
  yds: {
    emoji: '🌐',
    temelHabits: [
      { name: 'Metin Okuma', nameTr: 'Günlük akademik İngilizce metin', emoji: '📖', color: CategoryColors.blue },
      { name: 'Kelime', nameTr: 'Kelime listesi (5–10/gün)', emoji: '🗃️', color: CategoryColors.violet },
    ],
    ortaHabits: [
      { name: 'Akademik Okuma', nameTr: 'Akademik metin okuma & anlama', emoji: '📖', color: CategoryColors.blue },
      { name: 'Kelime', nameTr: 'Akademik kelime listesi (15/gün)', emoji: '🗃️', color: CategoryColors.violet },
      { name: 'Gramer', nameTr: 'Gramer yapıları tekrarı', emoji: '✏️', color: CategoryColors.pink },
      { name: 'YDS Soru', nameTr: 'YDS format soruları çözümü', emoji: '📝', color: CategoryColors.green },
    ],
    ileriHabits: [
      { name: 'Hız Okuma', nameTr: 'Hız okuma pratiği', emoji: '📖', color: CategoryColors.blue },
      { name: 'AWL Kelime', nameTr: 'COCA/AWL kelime seti (20/gün)', emoji: '🗃️', color: CategoryColors.violet },
      { name: 'İleri Gramer', nameTr: 'İleri gramer (inversion/cleft)', emoji: '✏️', color: CategoryColors.pink },
      { name: 'Çıkmış YDS', nameTr: 'Çıkmış YDS tam set çözümü', emoji: '📝', color: CategoryColors.green },
      { name: 'Hata Analizi', nameTr: 'Yanlış soru analizi', emoji: '❌', color: CategoryColors.red },
    ],
    setupTasks: [
      { titleTr: 'Academic Word List (AWL) kelime setini indir', titleEn: 'Download the Academic Word List (AWL)', priority: 'High' },
      { titleTr: 'Son 3 yıl YDS/YÖKDİL sorularını temin et', titleEn: 'Get the last 3 years of YDS/YÖKDİL questions', priority: 'High' },
    ],
    sprintTasks: [
      { titleTr: 'Süreli tam YDS denemesi çöz', titleEn: 'Solve a full timed YDS mock exam', priority: 'High' },
      { titleTr: 'Yanlış sorulardan kelime kartı oluştur', titleEn: 'Create vocabulary cards from your wrong answers', priority: 'Medium' },
    ],
  },
  ielts: {
    emoji: '🇬🇧',
    temelHabits: [
      { name: 'Listening', nameTr: 'Listening pratik (podcast)', emoji: '👂', color: CategoryColors.blue },
      { name: 'Reading', nameTr: 'Reading passage (1 metin/gün)', emoji: '📖', color: CategoryColors.green },
    ],
    ortaHabits: [
      { name: 'Listening', nameTr: 'Listening: not alma pratiği', emoji: '👂', color: CategoryColors.blue },
      { name: 'Reading', nameTr: 'Reading: skimming & scanning', emoji: '📖', color: CategoryColors.green },
      { name: 'Writing', nameTr: 'Writing Task 1 taslak', emoji: '✍️', color: CategoryColors.amber },
      { name: 'Speaking', nameTr: 'Speaking monologue kaydı', emoji: '🗣️', color: CategoryColors.violet },
    ],
    ileriHabits: [
      { name: 'Listening', nameTr: 'Listening: Section 3–4 (academic)', emoji: '👂', color: CategoryColors.blue },
      { name: 'Reading', nameTr: 'Reading: T/F/NG stratejisi', emoji: '📖', color: CategoryColors.green },
      { name: 'Writing', nameTr: 'Writing Task 1 & 2 tam pratik', emoji: '✍️', color: CategoryColors.amber },
      { name: 'Speaking', nameTr: 'Speaking: Part 2 cue card', emoji: '🗣️', color: CategoryColors.violet },
      { name: 'Mock Analiz', nameTr: 'Mock test hata analizi', emoji: '📊', color: CategoryColors.red },
    ],
    setupTasks: [
      { titleTr: 'Cambridge IELTS kitaplarından en az 2 tane temin et', titleEn: 'Get at least 2 Cambridge IELTS practice books', priority: 'High' },
      { titleTr: 'Hedef band skoru belirle (okul/vize gereksinimine göre)', titleEn: 'Set your target band score (based on school/visa requirement)', priority: 'High' },
    ],
    sprintTasks: [
      { titleTr: 'Tam IELTS mock test çöz (4 bölüm aynı günde)', titleEn: 'Complete a full IELTS mock (all 4 sections in one day)', priority: 'High' },
      { titleTr: 'Writing Task 2 essay sayısını artır', titleEn: 'Increase your Writing Task 2 essay practice count', priority: 'High' },
    ],
  },
  toefl: {
    emoji: '🇺🇸',
    temelHabits: [
      { name: 'Listening', nameTr: 'Integrated Listening (kısa lecture)', emoji: '👂', color: CategoryColors.blue },
      { name: 'Reading', nameTr: 'Reading passage çözümü', emoji: '📖', color: CategoryColors.green },
    ],
    ortaHabits: [
      { name: 'Listening', nameTr: 'Integrated Listening + notları', emoji: '👂', color: CategoryColors.blue },
      { name: 'Reading', nameTr: 'Academic reading passage', emoji: '📖', color: CategoryColors.green },
      { name: 'Writing', nameTr: 'Independent Writing taslak', emoji: '✍️', color: CategoryColors.amber },
      { name: 'Speaking', nameTr: 'Speaking template pratiği', emoji: '🎙️', color: CategoryColors.violet },
    ],
    ileriHabits: [
      { name: 'Listening', nameTr: 'Listening: pragmatic purpose soruları', emoji: '👂', color: CategoryColors.blue },
      { name: 'Reading', nameTr: 'Reading: prose summary soruları', emoji: '📖', color: CategoryColors.green },
      { name: 'Writing', nameTr: 'Integrated & Independent Writing', emoji: '✍️', color: CategoryColors.amber },
      { name: 'Speaking', nameTr: 'Speaking: template + içerik', emoji: '🎙️', color: CategoryColors.violet },
      { name: 'TPO Mock', nameTr: 'TPO mock test pratiği', emoji: '📊', color: CategoryColors.red },
    ],
    setupTasks: [
      { titleTr: 'ETS Official TOEFL Guide temin et', titleEn: 'Get the ETS Official TOEFL Guide', priority: 'High' },
      { titleTr: 'TPO (TOEFL Practice Online) hesabı aç', titleEn: 'Create a TPO (TOEFL Practice Online) account', priority: 'High' },
    ],
    sprintTasks: [
      { titleTr: 'Tam TPO denemesi çöz', titleEn: 'Complete a full TPO mock exam', priority: 'High' },
      { titleTr: 'Speaking & Writing independent tam set çalış', titleEn: 'Complete full sets of Speaking & Writing independent tasks', priority: 'High' },
    ],
  },
  tus: {
    emoji: '🩺',
    temelHabits: [
      { name: 'Temel Bilim', nameTr: 'Temel bilim konu okuma', emoji: '🧬', color: CategoryColors.blue },
      { name: 'Mini Soru', nameTr: 'Günlük mini soru (20–30)', emoji: '📝', color: CategoryColors.green },
    ],
    ortaHabits: [
      { name: 'Temel Bilim', nameTr: 'Temel bilim konu + soru (50/gün)', emoji: '🧬', color: CategoryColors.blue },
      { name: 'Klinik Özet', nameTr: 'Klinik özet (Dahiliye/Cerrahi)', emoji: '🏥', color: CategoryColors.green },
      { name: 'Yanlış Tekrar', nameTr: 'Yanlış soru tekrarı', emoji: '🔄', color: CategoryColors.violet },
      { name: 'Kontrol Listesi', nameTr: 'Konu kontrol listesi', emoji: '📋', color: CategoryColors.amber },
    ],
    ileriHabits: [
      { name: 'Temel Bilim', nameTr: 'Temel bilim yoğun (Biyokimya/Patoloji)', emoji: '🧬', color: CategoryColors.blue },
      { name: 'Klinik Vaka', nameTr: 'Klinik vaka çalışması', emoji: '🏥', color: CategoryColors.green },
      { name: 'Soru Bankası', nameTr: 'Soru bankası (80+ soru/gün)', emoji: '📝', color: CategoryColors.red },
      { name: 'Sistematik Tekrar', nameTr: 'Yanlış soru sistematik tekrar', emoji: '🔄', color: CategoryColors.violet },
      { name: 'Alan Takibi', nameTr: 'Alan bazlı performans takibi', emoji: '📊', color: CategoryColors.amber },
    ],
    setupTasks: [
      { titleTr: 'TUS konu dağılımını ÖSYM verilerine göre analiz et', titleEn: 'Analyze TUS topic distribution using ÖSYM data', priority: 'High' },
      { titleTr: 'Online soru bankası aboneliği al (Tustime, Akdeniz vb.)', titleEn: 'Subscribe to an online question bank (Tustime, Akdeniz, etc.)', priority: 'High' },
      { titleTr: 'Temel bilim → klinik geçiş planı oluştur', titleEn: 'Create a plan for transitioning from basic sciences to clinical', priority: 'Medium' },
    ],
    sprintTasks: [
      { titleTr: 'Klinik dersler odak çalışması yap', titleEn: 'Focus intensively on clinical subjects', priority: 'High' },
      { titleTr: 'Günlük 100+ soru hedefle', titleEn: 'Aim for 100+ questions per day', priority: 'High' },
      { titleTr: 'Patoloji/Farmakoloji zayıf alan tekrarı', titleEn: 'Review weak areas in Pathology/Pharmacology', priority: 'Medium' },
    ],
  },
  usmle: {
    emoji: '🏥',
    temelHabits: [
      { name: 'Soru Bankası', nameTr: 'UWorld/Amboss günlük soru (20–30)', emoji: '📱', color: CategoryColors.blue },
      { name: 'First Aid', nameTr: 'First Aid konu okuma', emoji: '📚', color: CategoryColors.green },
    ],
    ortaHabits: [
      { name: 'Soru Bankası', nameTr: 'Soru bankası (40 soru/gün)', emoji: '📱', color: CategoryColors.blue },
      { name: 'Kaynak', nameTr: 'First Aid + Pathoma/Sketchy', emoji: '📚', color: CategoryColors.green },
      { name: 'Anki', nameTr: 'Anki deck tekrarı', emoji: '🔄', color: CategoryColors.violet },
      { name: 'Zayıf Alan', nameTr: 'Zayıf alan performans takibi', emoji: '📊', color: CategoryColors.amber },
    ],
    ileriHabits: [
      { name: 'Soru Bankası', nameTr: 'Soru bankası (60+ soru/gün)', emoji: '📱', color: CategoryColors.red },
      { name: 'Anki', nameTr: 'Anki 200+ kart/gün', emoji: '🔄', color: CategoryColors.violet },
      { name: 'First Aid', nameTr: 'Kaynak sistematik tarama', emoji: '📚', color: CategoryColors.green },
      { name: 'Klinik Vaka', nameTr: 'Clinical vignette analizi', emoji: '🏥', color: CategoryColors.blue },
      { name: 'NBME', nameTr: 'NBME/UWSim performans takibi', emoji: '📊', color: CategoryColors.amber },
    ],
    setupTasks: [
      { titleTr: 'First Aid for USMLE Step temin et', titleEn: 'Get First Aid for the USMLE Step you\'re targeting', priority: 'High' },
      { titleTr: 'UWorld veya Amboss aboneliği al', titleEn: 'Subscribe to UWorld or Amboss', priority: 'High' },
      { titleTr: 'NBME practice exam takvimi oluştur', titleEn: 'Create an NBME practice exam schedule', priority: 'Medium' },
    ],
    sprintTasks: [
      { titleTr: 'NBME practice test çöz ve skor analizi yap', titleEn: 'Complete an NBME practice test and analyze your score', priority: 'High' },
      { titleTr: 'Zayıf sistem üzerinde First Aid tekrar', titleEn: 'Review weak organ systems in First Aid', priority: 'High' },
    ],
  },
  gre: {
    emoji: '🎓',
    temelHabits: [
      { name: 'Vocabulary', nameTr: 'Vocabulary: 10 kelime/gün', emoji: '📝', color: CategoryColors.blue },
      { name: 'Quant Temel', nameTr: 'Quant temel konular', emoji: '🔢', color: CategoryColors.green },
    ],
    ortaHabits: [
      { name: 'Verbal', nameTr: 'Verbal: vocabulary + RC passage', emoji: '📝', color: CategoryColors.blue },
      { name: 'Quant', nameTr: 'Quant: DS & Problem Solving', emoji: '🔢', color: CategoryColors.green },
      { name: 'AWA', nameTr: 'AWA essay taslak pratiği', emoji: '✍️', color: CategoryColors.amber },
    ],
    ileriHabits: [
      { name: 'Verbal', nameTr: 'Verbal: Full RC + Text Completion', emoji: '📝', color: CategoryColors.blue },
      { name: 'Quant', nameTr: 'Quant: yoğun problem çözme', emoji: '🔢', color: CategoryColors.green },
      { name: 'AWA', nameTr: 'AWA: Issue + Argument essay', emoji: '✍️', color: CategoryColors.amber },
      { name: 'PowerPrep', nameTr: 'ETS PowerPrep simülasyonu', emoji: '📊', color: CategoryColors.violet },
    ],
    setupTasks: [
      { titleTr: 'ETS Official GRE Guide temin et (Big Book)', titleEn: 'Get the ETS Official GRE Guide (Big Book)', priority: 'High' },
      { titleTr: 'Hedef programın minimum GRE skoru gereksinimini öğren', titleEn: 'Find out the minimum GRE score for your target program', priority: 'High' },
    ],
    sprintTasks: [
      { titleTr: 'ETS PowerPrep tam deneme çöz', titleEn: 'Complete an ETS PowerPrep full mock exam', priority: 'High' },
      { titleTr: 'AWA essay sayısını artır, geri bildirim al', titleEn: 'Write more AWA essays and get feedback', priority: 'Medium' },
    ],
  },
  gmat: {
    emoji: '💼',
    temelHabits: [
      { name: 'Quant Giriş', nameTr: 'Quant: Problem Solving giriş', emoji: '🔢', color: CategoryColors.blue },
      { name: 'Verbal Temel', nameTr: 'Verbal: SC temelleri', emoji: '📝', color: CategoryColors.green },
    ],
    ortaHabits: [
      { name: 'Quant', nameTr: 'Quant: DS + PS karma çalışma', emoji: '🔢', color: CategoryColors.blue },
      { name: 'Verbal', nameTr: 'Verbal: CR + SC günlük pratik', emoji: '📝', color: CategoryColors.green },
      { name: 'AWA & IR', nameTr: 'AWA & IR çalışması', emoji: '✍️', color: CategoryColors.amber },
    ],
    ileriHabits: [
      { name: 'Quant 700+', nameTr: 'Quant yoğun (700+ sorular)', emoji: '🔢', color: CategoryColors.blue },
      { name: 'Verbal', nameTr: 'Verbal: RC + CR + SC tam set', emoji: '📝', color: CategoryColors.green },
      { name: 'CAT Deneme', nameTr: 'CAT adaptif test simülasyonu', emoji: '📊', color: CategoryColors.violet },
      { name: 'AWA', nameTr: 'AWA essay pratiği', emoji: '✍️', color: CategoryColors.amber },
    ],
    setupTasks: [
      { titleTr: 'GMAT Official Guide temin et', titleEn: 'Get the GMAT Official Guide', priority: 'High' },
      { titleTr: 'Hedef MBA programı için minimum GMAT skoru belirle', titleEn: 'Find the minimum GMAT score for your target MBA program', priority: 'High' },
    ],
    sprintTasks: [
      { titleTr: 'GMAT CAT tam deneme çöz ve analiz et', titleEn: 'Complete and analyze a full GMAT CAT mock', priority: 'High' },
      { titleTr: 'Verbal zayıf alan odak çalışması yap', titleEn: 'Do focused study on your weak Verbal area', priority: 'High' },
    ],
  },
  msü: {
    emoji: '🎖️',
    temelHabits: [
      { name: 'Kondisyon', nameTr: 'Temel kondisyon (koşu 20 dk)', emoji: '💪', color: CategoryColors.red },
      { name: 'Akademik', nameTr: 'TYT düzeyinde konu tekrarı', emoji: '📚', color: CategoryColors.blue },
    ],
    ortaHabits: [
      { name: 'Koşu', nameTr: 'Koşu antrenmanı (30 dk)', emoji: '🏃', color: CategoryColors.red },
      { name: 'Kalistenik', nameTr: 'Kalistenik egzersiz (şınav/mekik)', emoji: '💪', color: CategoryColors.amber },
      { name: 'Akademik', nameTr: 'Akademik soru çalışması', emoji: '📚', color: CategoryColors.blue },
      { name: 'Süreli Test', nameTr: 'Süreli test simülasyonu', emoji: '⏱️', color: CategoryColors.green },
    ],
    ileriHabits: [
      { name: 'Uzun Koşu', nameTr: 'Uzun koşu (45+ dk)', emoji: '🏃', color: CategoryColors.red },
      { name: 'Maksimum Kal.', nameTr: 'Maksimum kalistenik', emoji: '💪', color: CategoryColors.amber },
      { name: 'Akademik', nameTr: 'Akademik tam deneme', emoji: '📚', color: CategoryColors.blue },
      { name: 'Parkur', nameTr: 'Parkur simülasyonu', emoji: '⏱️', color: CategoryColors.green },
      { name: 'Mental', nameTr: 'Fiziksel + mental hazırlık', emoji: '🧠', color: CategoryColors.violet },
    ],
    setupTasks: [
      { titleTr: 'MSÜ fiziki test standartlarını incele (şınav/mekik/koşu süreleri)', titleEn: 'Review MSÜ physical fitness standards (push-up/sit-up/run times)', priority: 'High' },
      { titleTr: 'MSÜ akademik sınav konularını ve kontenjanları araştır', titleEn: 'Research MSÜ academic exam topics and quotas', priority: 'High' },
    ],
    sprintTasks: [
      { titleTr: 'MSÜ fiziki standartlarını tam olarak karşıla ve aş', titleEn: 'Meet and exceed all MSÜ physical fitness standards', priority: 'High' },
      { titleTr: 'Akademik deneme + fiziksel antrenman kombine günler yap', titleEn: 'Combine academic mocks with physical training days', priority: 'High' },
    ],
  },
  pmyo: {
    emoji: '👮',
    temelHabits: [
      { name: 'Koşu', nameTr: 'Koşu (2–3 km, günlük)', emoji: '🏃', color: CategoryColors.red },
      { name: 'Genel Kültür', nameTr: 'Genel kültür konu okuma', emoji: '📚', color: CategoryColors.blue },
    ],
    ortaHabits: [
      { name: 'Koşu', nameTr: 'Koşu antrenmanı (3–5 km)', emoji: '🏃', color: CategoryColors.red },
      { name: 'Kalistenik', nameTr: 'Kalistenik egzersiz', emoji: '💪', color: CategoryColors.amber },
      { name: 'Genel Kültür', nameTr: 'Genel kültür & güncel olaylar', emoji: '📚', color: CategoryColors.blue },
      { name: 'PMYO Soru', nameTr: 'PMYO soru çalışması', emoji: '📝', color: CategoryColors.green },
    ],
    ileriHabits: [
      { name: 'Interval Koşu', nameTr: 'Uzun mesafe + interval koşu', emoji: '🏃', color: CategoryColors.red },
      { name: 'Kalistenik', nameTr: 'Kalistenik maksimum set', emoji: '💪', color: CategoryColors.amber },
      { name: 'Genel Kültür', nameTr: 'Genel kültür yoğun', emoji: '📚', color: CategoryColors.blue },
      { name: 'PMYO Deneme', nameTr: 'PMYO full deneme çözümü', emoji: '📝', color: CategoryColors.green },
      { name: 'Mental', nameTr: 'Psikolojik dayanıklılık', emoji: '🧠', color: CategoryColors.violet },
    ],
    setupTasks: [
      { titleTr: 'PMYO fiziki test standartlarını incele', titleEn: 'Review PMYO physical fitness test standards', priority: 'High' },
      { titleTr: 'PMYO sınav konularını ve kaynaklarını araştır', titleEn: 'Research PMYO exam topics and recommended resources', priority: 'High' },
    ],
    sprintTasks: [
      { titleTr: 'Tüm fiziki kriterleri karşıla ve aş', titleEn: 'Meet and exceed all physical test criteria', priority: 'High' },
      { titleTr: 'PMYO full akademik deneme çöz', titleEn: 'Complete a full PMYO academic mock exam', priority: 'High' },
    ],
  },
  oabt: {
    emoji: '📐',
    temelHabits: [
      { name: 'Alan Bilgisi', nameTr: 'Alan bilgisi konu okuma', emoji: '📚', color: CategoryColors.blue },
      { name: 'Mini Soru', nameTr: 'Mini soru çözümü', emoji: '📝', color: CategoryColors.green },
    ],
    ortaHabits: [
      { name: 'Alan Bilgisi', nameTr: 'Alan bilgisi sistematik tarama', emoji: '📚', color: CategoryColors.blue },
      { name: 'ÖABT Soru', nameTr: 'ÖABT format soru çözümü', emoji: '📝', color: CategoryColors.green },
      { name: 'Eğitim Bil.', nameTr: 'Eğitim Bilimleri tekrarı', emoji: '🧠', color: CategoryColors.violet },
    ],
    ileriHabits: [
      { name: 'Alan Yoğun', nameTr: 'Alan bilgisi yoğun (zayıf konular)', emoji: '📚', color: CategoryColors.blue },
      { name: 'Çıkmış Soru', nameTr: 'Çıkmış ÖABT soruları', emoji: '📝', color: CategoryColors.green },
      { name: 'Eğitim Bil.', nameTr: 'Eğitim Bilimleri + pedagoji', emoji: '🧠', color: CategoryColors.violet },
      { name: 'Hata Analizi', nameTr: 'Hata analizi & tekrar', emoji: '❌', color: CategoryColors.red },
    ],
    setupTasks: [
      { titleTr: 'Branşına özel ÖABT konu listesini ÖSYM\'den indir', titleEn: 'Download your branch-specific ÖABT topic list from ÖSYM', priority: 'High' },
      { titleTr: 'Son 3 yıl ÖABT sorularını temin et', titleEn: 'Get the last 3 years of ÖABT past questions', priority: 'High' },
    ],
    sprintTasks: [
      { titleTr: 'Branş + Eğitim Bilimleri karma deneme çöz', titleEn: 'Solve mixed mocks covering both branch and Education Sciences', priority: 'High' },
      { titleTr: 'Zayıf alan odak çalışması yap', titleEn: 'Do targeted study on your weakest area', priority: 'Medium' },
    ],
  },
  aof: {
    emoji: '💻',
    temelHabits: [
      { name: 'Ünite Okuma', nameTr: 'Ders kitabı ünite okuma (1/gün)', emoji: '📖', color: CategoryColors.blue },
      { name: 'Özet', nameTr: 'Ünite özeti çıkarma', emoji: '📝', color: CategoryColors.green },
    ],
    ortaHabits: [
      { name: 'Ders Okuma', nameTr: 'Ders okuma + not alma', emoji: '📖', color: CategoryColors.blue },
      { name: 'Ünite Sonu', nameTr: 'Ünite sonu soruları çözme', emoji: '📝', color: CategoryColors.green },
      { name: 'Haftalık Tekrar', nameTr: 'Haftalık tekrar oturumu', emoji: '🔄', color: CategoryColors.violet },
    ],
    ileriHabits: [
      { name: 'Hızlı Okuma', nameTr: 'Hızlı okuma + aktif not', emoji: '📖', color: CategoryColors.blue },
      { name: 'Çıkmış Soru', nameTr: 'Çıkmış soru analizi', emoji: '📝', color: CategoryColors.green },
      { name: 'Sistematik Tekrar', nameTr: 'Sistematik tekrar programı', emoji: '🔄', color: CategoryColors.violet },
      { name: 'Hata Takibi', nameTr: 'Hata takibi & güçlendirme', emoji: '❌', color: CategoryColors.red },
    ],
    setupTasks: [
      { titleTr: 'Açıköğretim sınav takvimini kaydet ve alarm kur', titleEn: 'Save the distance education exam schedule and set reminders', priority: 'High' },
      { titleTr: 'Her ders için çıkmış soru bankasını indir', titleEn: 'Download past question banks for each course', priority: 'High' },
    ],
    sprintTasks: [
      { titleTr: 'Her ders için mini deneme çöz', titleEn: 'Solve a mini mock for each course', priority: 'High' },
      { titleTr: 'Ünite özetlerini hızlı tekrar et', titleEn: 'Quickly review all unit summaries', priority: 'Medium' },
    ],
  },
  pte: {
    emoji: '🎙️',
    temelHabits: [
      { name: 'Read Aloud', nameTr: 'Speaking: Read Aloud pratik', emoji: '🎙️', color: CategoryColors.blue },
      { name: 'Reorder', nameTr: 'Reading: Reorder Paragraphs', emoji: '📖', color: CategoryColors.green },
    ],
    ortaHabits: [
      { name: 'Speaking', nameTr: 'Speaking: RA + Repeat Sentence', emoji: '🎙️', color: CategoryColors.blue },
      { name: 'Reading', nameTr: 'Reading: FIB + MCQ', emoji: '📖', color: CategoryColors.green },
      { name: 'Writing', nameTr: 'Writing: Summarize Written Text', emoji: '✍️', color: CategoryColors.amber },
      { name: 'Listening', nameTr: 'Listening: FIB pratik', emoji: '👂', color: CategoryColors.violet },
    ],
    ileriHabits: [
      { name: 'Speaking', nameTr: 'Speaking: Describe Image + Retell', emoji: '🎙️', color: CategoryColors.blue },
      { name: 'Reading', nameTr: 'Reading: tüm soru tipleri', emoji: '📖', color: CategoryColors.green },
      { name: 'Writing', nameTr: 'Writing: Full AWE pratik', emoji: '✍️', color: CategoryColors.amber },
      { name: 'Listening', nameTr: 'Listening: Highlight Correct Summary', emoji: '👂', color: CategoryColors.violet },
      { name: 'Mock Analiz', nameTr: 'Mock test analizi', emoji: '📊', color: CategoryColors.red },
    ],
    setupTasks: [
      { titleTr: 'PTE Academic Official Guide temin et', titleEn: 'Get the PTE Academic Official Guide', priority: 'High' },
      { titleTr: 'Scored Practice Test ile mevcut seviyeni ölç', titleEn: 'Measure your current level with a Scored Practice Test', priority: 'High' },
    ],
    sprintTasks: [
      { titleTr: 'Tam PTE mock test çöz', titleEn: 'Complete a full PTE mock test', priority: 'High' },
      { titleTr: 'Speaking ve Listening odak pratiği yap', titleEn: 'Do focused Speaking and Listening practice', priority: 'High' },
    ],
  },
  bilsem: {
    emoji: '🧩',
    temelHabits: [
      { name: 'Sözel Mantık', nameTr: 'Sözel mantık bulmacaları (15 dk)', emoji: '🧩', color: CategoryColors.violet },
      { name: 'Sayısal Örüntü', nameTr: 'Sayısal örüntü soruları', emoji: '🔢', color: CategoryColors.blue },
    ],
    ortaHabits: [
      { name: 'Sözel Mantık', nameTr: 'Sözel & şekil mantık soruları', emoji: '🧩', color: CategoryColors.violet },
      { name: 'Sayısal', nameTr: 'Sayısal örüntü ve dizi', emoji: '🔢', color: CategoryColors.blue },
      { name: 'Yaratıcı', nameTr: 'Yaratıcı düşünme egzersizleri', emoji: '🎨', color: CategoryColors.pink },
    ],
    ileriHabits: [
      { name: 'Zeka Testi', nameTr: 'Tam zeka testi seti (sözel+şekil+sayısal)', emoji: '🧩', color: CategoryColors.violet },
      { name: 'Örüntü', nameTr: 'İleri düzey örüntü soruları', emoji: '🔢', color: CategoryColors.blue },
      { name: 'Yaratıcı', nameTr: 'Yaratıcı problem çözme pratiği', emoji: '🎨', color: CategoryColors.pink },
      { name: 'Uzamsal', nameTr: 'Görsel-uzamsal akıl yürütme', emoji: '🧠', color: CategoryColors.green },
    ],
    setupTasks: [
      { titleTr: 'BİLSEM değerlendirme aşamalarını araştır (Grup Tarama → Bireysel)', titleEn: 'Research BİLSEM assessment stages (Group Screening → Individual)', priority: 'High' },
      { titleTr: 'Zeka testi pratik kitabı temin et', titleEn: 'Get an IQ test practice book', priority: 'High' },
    ],
    sprintTasks: [
      { titleTr: 'Tam BİLSEM simülasyon testi çöz', titleEn: 'Complete a full BİLSEM simulation test', priority: 'High' },
      { titleTr: 'Zayıf alan (şekil/sayısal/sözel) odak pratiği', titleEn: 'Focus practice on your weakest area (visual/numerical/verbal)', priority: 'High' },
    ],
  },
  katiplik: {
    emoji: '⌨️',
    temelHabits: [
      { name: 'Klavye Pratik', nameTr: 'F/Q Klavye vuruş pratiği (15 dk)', emoji: '⌨️', color: CategoryColors.blue },
      { name: 'Adalet Mevzuat', nameTr: 'Adalet örgütü mevzuatı okuma', emoji: '📜', color: CategoryColors.amber },
    ],
    ortaHabits: [
      { name: '3 Dk Klavye', nameTr: '3 dakikada kelime simülasyonu', emoji: '⏱️', color: CategoryColors.green },
      { name: 'Mevzuat Soru', nameTr: 'Mevzuat & Türkçe soru çözümü', emoji: '⚖️', color: CategoryColors.blue },
      { name: 'Hata Kartı', nameTr: 'Yanlış yazılan kelimeleri tekrar et', emoji: '❌', color: CategoryColors.red },
    ],
    ileriHabits: [
      { name: 'Zamanlı Klavye', nameTr: 'Günlük 10 x 3 dk klavye maratonu (90+ kelime)', emoji: '⚡', color: CategoryColors.red },
      { name: 'Katiplik Mevzuat', nameTr: 'Anayasa + HMK + İnfaz mevzuatı', emoji: '⚖️', color: CategoryColors.amber },
      { name: 'Deneme Metni', nameTr: 'Çıkmış katiplik sınav metinleri pratiği', emoji: '📄', color: CategoryColors.violet },
      { name: 'Hata Analizi', nameTr: 'Klavye vuruş ve vuruş-hata analizi', emoji: '📊', color: CategoryColors.blue },
    ],
    setupTasks: [
      { titleTr: 'Adalet Bakanlığı Zabıt Katipliği sınav kılavuzunu incele', titleEn: 'Review the Ministry of Justice Court Clerk exam guide', priority: 'High' },
      { titleTr: 'Son 3 yılda çıkmış sınav metinlerini temin et', titleEn: 'Get past exam texts from the last 3 years', priority: 'High' },
      { titleTr: '3 dakikalık klavye sayacı ve simülatörü hazırla', titleEn: 'Set up a 3-minute typing timer and simulator', priority: 'High' },
    ],
    sprintTasks: [
      { titleTr: 'Günde en az 5 farklı metinde 3 dakikalık klavye testi yap', titleEn: 'Complete 3-minute typing tests on 5 different texts daily', priority: 'High' },
      { titleTr: 'Mevzuat soru bankasından karma test çöz', titleEn: 'Solve mixed tests from the legislation question bank', priority: 'High' },
    ],
  },
  kaymakamlik: {
    emoji: '🏛️',
    temelHabits: [
      { name: 'Anayasa Hukuku', nameTr: 'Anayasa Hukuku madde okuması', emoji: '⚖️', color: CategoryColors.blue },
      { name: 'İdare Hukuku', nameTr: 'İdare Hukuku temel konular', emoji: '📚', color: CategoryColors.amber },
    ],
    ortaHabits: [
      { name: 'Anayasa-İdare', nameTr: 'Anayasa & İdare Hukuku yoğun', emoji: '⚖️', color: CategoryColors.blue },
      { name: 'TR İktisadı', nameTr: 'Türkiye İktisat Yapısı & İktisat', emoji: '📊', color: CategoryColors.green },
      { name: 'İnsan Hakları', nameTr: 'İnsan Hakları mevzuatı', emoji: '🕊️', color: CategoryColors.violet },
    ],
    ileriHabits: [
      { name: 'Derin Mevzuat', nameTr: 'Cumhurbaşkanlığı kararnameleri & mevzuat', emoji: '📜', color: CategoryColors.red },
      { name: 'İktisat & İdare', nameTr: 'İktisat + İdare soru bankası (60+)', emoji: '📊', color: CategoryColors.blue },
      { name: 'Çıkmış Sorular', nameTr: 'Çıkmış Kaymakamlık soruları analizi', emoji: '📝', color: CategoryColors.amber },
      { name: 'Hata Kartı', nameTr: 'Hukuk maddeleri Ebbinghaus tekrarı', emoji: '❌', color: CategoryColors.violet },
    ],
    setupTasks: [
      { titleTr: 'Kaymakam adaylığı sınavı ders ağırlıklarını ve soru dağılımını listele', titleEn: 'List District Governor candidate exam subject weights and question distribution', priority: 'High' },
      { titleTr: 'Güncel Cumhurbaşkanlığı kararnameleri mevzuat derlemesini temin et', titleEn: 'Get updated Presidential decrees compilation', priority: 'High' },
    ],
    sprintTasks: [
      { titleTr: 'Günde 2 tam mevzuat ve iktisat soru seti çöz', titleEn: 'Solve 2 full legislation and economics question sets daily', priority: 'High' },
      { titleTr: 'Zayıf olunan hukuk branşında nokta atışı tekrar yap', titleEn: 'Do targeted review on your weakest law subject', priority: 'High' },
    ],
  },
  icra: {
    emoji: '⚖️',
    temelHabits: [
      { name: 'İcra-İflas', nameTr: 'İcra-İflas Kanunu maddeleri', emoji: '📜', color: CategoryColors.blue },
      { name: 'HMK Giriş', nameTr: 'Hukuk Muhakemeleri Kanunu', emoji: '⚖️', color: CategoryColors.amber },
    ],
    ortaHabits: [
      { name: 'İcra-İflas', nameTr: 'İcra-İflas Hukuku soru çözümü', emoji: '📜', color: CategoryColors.blue },
      { name: 'HMK & Borçlar', nameTr: 'HMK & Borçlar Hukuku', emoji: '⚖️', color: CategoryColors.amber },
      { name: 'Ticaret Hukuku', nameTr: 'Ticaret Hukuku özeti', emoji: '🏢', color: CategoryColors.green },
    ],
    ileriHabits: [
      { name: 'İcra Yoğun', nameTr: 'İcra-İflas & Takip Hukuku (60 dk)', emoji: '📜', color: CategoryColors.red },
      { name: 'HMK + Borçlar', nameTr: 'HMK + Borçlar Genel soru seti', emoji: '⚖️', color: CategoryColors.blue },
      { name: 'Harçlar & Damga', nameTr: 'Harçlar & Damga Vergisi Kanunu', emoji: '💰', color: CategoryColors.green },
      { name: 'Çıkmış Sorular', nameTr: 'Çıkmış İcra Müdürlüğü soruları', emoji: '📝', color: CategoryColors.violet },
    ],
    setupTasks: [
      { titleTr: 'İcra Müdürlüğü ve Müdür Yardımcılığı sınav konularını ve mevzuatı indir', titleEn: 'Download Enforcement Director exam topics and relevant legislation', priority: 'High' },
      { titleTr: 'İcra-İflas Kanunu ve HMK mevzuat kitapçığı hazırlat', titleEn: 'Prepare Enforcement-Bankruptcy Law and HMK code booklets', priority: 'High' },
    ],
    sprintTasks: [
      { titleTr: 'Her gün 100 İcra-İflas ve HMK sorusu çöz', titleEn: 'Solve 100 Enforcement-Bankruptcy and HMK questions daily', priority: 'High' },
    ],
  },
  smmm: {
    emoji: '🧮',
    temelHabits: [
      { name: 'Finansal Muhasebe', nameTr: 'Finansal Muhasebe temel hesaplar', emoji: '📒', color: CategoryColors.blue },
      { name: 'Vergi Hukuku', nameTr: 'Vergi mevzuatı & KDV/Kurumlar', emoji: '⚖️', color: CategoryColors.amber },
    ],
    ortaHabits: [
      { name: 'Muhasebe Tekdüzen', nameTr: 'Tekdüzen hesap planı & kayıtlar', emoji: '📒', color: CategoryColors.blue },
      { name: 'Vergi & Borçlar', nameTr: 'Vergi Hukuku + Borçlar Hukuku', emoji: '⚖️', color: CategoryColors.amber },
      { name: 'Maliyet Muhasebesi', nameTr: 'Maliyet Muhasebesi problemleri', emoji: '📈', color: CategoryColors.green },
    ],
    ileriHabits: [
      { name: 'Monografi Çözümü', nameTr: 'Günlük karma monografi çözümü', emoji: '📒', color: CategoryColors.red },
      { name: 'Vergi & Denetim', nameTr: 'Vergi Hukuku + Bağımsız Denetim', emoji: '⚖️', color: CategoryColors.blue },
      { name: 'Mali Analiz', nameTr: 'Mali Tablolar Analizi & Rasyolar', emoji: '📈', color: CategoryColors.green },
      { name: 'Çıkmış SMMM', nameTr: 'Çıkmış SMMM Staja Başlama testleri', emoji: '📝', color: CategoryColors.violet },
    ],
    setupTasks: [
      { titleTr: 'SMMM Staja Başlama / Yeterlilik sınav ders dağılımını incele', titleEn: 'Review SMMM Internship Entrance / Qualification subject breakdown', priority: 'High' },
      { titleTr: 'Tekdüzen Hesap Planı ve mali tablolar şablonunu temin et', titleEn: 'Get Uniform Chart of Accounts and financial statements template', priority: 'High' },
    ],
    sprintTasks: [
      { titleTr: 'Her gün 1 tam SMMM monografi veya test seti çöz', titleEn: 'Solve 1 full SMMM monograph or test set daily', priority: 'High' },
    ],
  },
  bekcilik: {
    emoji: '🛡️',
    temelHabits: [
      { name: 'Genel Kültür', nameTr: 'Genel Kültür & Tarih okuması', emoji: '🌍', color: CategoryColors.blue },
      { name: 'Türkçe Paragraf', nameTr: 'Türkçe paragraf (15 soru)', emoji: '📖', color: CategoryColors.green },
    ],
    ortaHabits: [
      { name: 'Bekçilik Mevzuatı', nameTr: 'Polis ve Bekçilik mevzuatı', emoji: '📜', color: CategoryColors.amber },
      { name: 'Genel Kültür', nameTr: 'Tarih + Coğrafya + Anayasa', emoji: '🌍', color: CategoryColors.blue },
      { name: 'Türkçe Soru', nameTr: 'Türkçe & Mantık soruları', emoji: '📝', color: CategoryColors.green },
    ],
    ileriHabits: [
      { name: 'Mevzuat & Hukuk', nameTr: 'Bekçilik mevzuatı & Anayasa (40 dk)', emoji: '📜', color: CategoryColors.red },
      { name: 'Genel Kültür Seti', nameTr: 'Genel Kültür + Tarih soru bankası', emoji: '🌍', color: CategoryColors.blue },
      { name: 'Mantık & Türkçe', nameTr: 'Sözel mantık & Türkçe paragraf', emoji: '📝', color: CategoryColors.green },
      { name: 'Çıkmış Sorular', nameTr: 'Çıkmış Bekçilik sınav soruları', emoji: '📊', color: CategoryColors.violet },
    ],
    setupTasks: [
      { titleTr: 'Emniyet Genel Müdürlüğü Bekçilik sınav konularını ve kılavuzunu incele', titleEn: 'Review EGM Guard exam topics and official guide', priority: 'High' },
      { titleTr: 'Çarşı ve Mahalle Bekçileri Kanunu mevzuat metnini temin et', titleEn: 'Get the Town and Neighborhood Guards Law text', priority: 'High' },
    ],
    sprintTasks: [
      { titleTr: 'Her gün 1 tam Bekçilik denemesi çöz ve analiz et', titleEn: 'Solve and analyze a full Guard mock exam daily', priority: 'High' },
    ],
  },
};
