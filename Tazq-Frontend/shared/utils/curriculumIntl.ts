import type { ExamCurriculum, Topic } from './curriculum';

/*
  İNGİLİZCE KULLANANLARIN SINAV KONULARI (2026-11-05). Yalnız sınavın kendi yayımladığı üst başlıklar: alt konu uydurulmaz, yanlış
  müfredat zarar verir. SAT alanları College Board belgelerinden; diğerleri sınav sahiplerinin bölüm adları.
*/
const t = (id: string, en: string, tr: string = en, weight?: number): Topic => ({ id, en, tr, ...(weight ? { weight } : null) });

export const INTL_CURRICULA: ExamCurriculum[] = [
  { id: 'sat', subjects: [
    { id: 'sat_rw', tr: 'Okuma ve Yazma', en: 'Reading and Writing', weight: 1, topics: [
      t('sat_rw_craft', 'Craft and Structure', 'Metin Yapısı ve Sözcük', 28), t('sat_rw_info', 'Information and Ideas', 'Bilgi ve Fikirler', 26),
      t('sat_rw_conv', 'Standard English Conventions', 'Yazım Kuralları', 26), t('sat_rw_expr', 'Expression of Ideas', 'Fikirlerin İfadesi', 20),
    ] },
    { id: 'sat_math', tr: 'Matematik', en: 'Math', weight: 1, topics: [
      t('sat_math_alg', 'Algebra', 'Cebir', 35), t('sat_math_adv', 'Advanced Math', 'İleri Matematik', 35),
      t('sat_math_data', 'Problem Solving and Data Analysis', 'Problem ve Veri Analizi', 15), t('sat_math_geo', 'Geometry and Trigonometry', 'Geometri ve Trigonometri', 15),
    ] },
  ] },
  { id: 'act', subjects: [
    { id: 'act_english', tr: 'İngilizce', en: 'English', weight: 1, topics: [t('act_eng_usage', 'Usage and Mechanics', 'Dil Kullanımı'), t('act_eng_rhet', 'Rhetorical Skills', 'Anlatım Becerileri')] },
    { id: 'act_math', tr: 'Matematik', en: 'Math', weight: 1, topics: [t('act_math_pre', 'Preparing for Higher Math', 'İleri Matematiğe Hazırlık'), t('act_math_ess', 'Integrating Essential Skills', 'Temel Beceriler')] },
    { id: 'act_reading', tr: 'Okuma', en: 'Reading', weight: 1, topics: [t('act_read_key', 'Key Ideas and Details', 'Ana Fikir ve Ayrıntı'), t('act_read_craft', 'Craft and Structure', 'Metin Yapısı')] },
    { id: 'act_science', tr: 'Fen (isteğe bağlı)', en: 'Science (optional)', weight: 1, topics: [t('act_sci_data', 'Interpreting Data', 'Veri Yorumlama'), t('act_sci_method', 'Scientific Investigation', 'Bilimsel Yöntem')] },
  ] },
  { id: 'lsat', subjects: [
    { id: 'lsat_lr', tr: 'Mantıksal Akıl Yürütme', en: 'Logical Reasoning', weight: 2, topics: [t('lsat_lr_args', 'Analyzing Arguments', 'Argüman Analizi'), t('lsat_lr_assume', 'Assumptions and Flaws', 'Varsayım ve Hatalar')] },
    { id: 'lsat_rc', tr: 'Okuduğunu Anlama', en: 'Reading Comprehension', weight: 1, topics: [t('lsat_rc_passages', 'Single Passages', 'Tekli Metinler'), t('lsat_rc_compare', 'Comparative Reading', 'Karşılaştırmalı Okuma')] },
  ] },
  { id: 'mcat', subjects: [
    { id: 'mcat_chem', tr: 'Kimya ve Fizik', en: 'Chem/Phys', weight: 1, topics: [t('mcat_chem_gen', 'Chemistry', 'Kimya'), t('mcat_chem_phys', 'Physics', 'Fizik')] },
    { id: 'mcat_cars', tr: 'Eleştirel Okuma (CARS)', en: 'CARS', weight: 1, topics: [t('mcat_cars_passages', 'Passage Analysis', 'Metin Analizi')] },
    { id: 'mcat_bio', tr: 'Biyoloji ve Biyokimya', en: 'Bio/Biochem', weight: 1, topics: [t('mcat_bio_gen', 'Biology', 'Biyoloji'), t('mcat_bio_bio', 'Biochemistry', 'Biyokimya')] },
    { id: 'mcat_psy', tr: 'Psikoloji ve Sosyoloji', en: 'Psych/Soc', weight: 1, topics: [t('mcat_psy_psy', 'Psychology', 'Psikoloji'), t('mcat_psy_soc', 'Sociology', 'Sosyoloji')] },
  ] },
  { id: 'nclex', subjects: [
    { id: 'nclex_care', tr: 'Güvenli Bakım', en: 'Safe Care', weight: 2, topics: [t('nclex_care_mgmt', 'Management of Care', 'Bakım Yönetimi'), t('nclex_care_safety', 'Safety and Infection Control', 'Güvenlik ve Enfeksiyon')] },
    { id: 'nclex_health', tr: 'Sağlığın Geliştirilmesi', en: 'Health Promotion', weight: 1, topics: [t('nclex_health_main', 'Health Promotion and Maintenance', 'Sağlığı Koruma')] },
    { id: 'nclex_psycho', tr: 'Psikososyal Bütünlük', en: 'Psychosocial Integrity', weight: 1, topics: [t('nclex_psycho_main', 'Psychosocial Integrity', 'Psikososyal Bütünlük')] },
    { id: 'nclex_phys', tr: 'Fizyolojik Bütünlük', en: 'Physiological Integrity', weight: 3, topics: [t('nclex_phys_basic', 'Basic Care and Comfort', 'Temel Bakım'), t('nclex_phys_pharm', 'Pharmacological Therapies', 'İlaç Tedavileri'), t('nclex_phys_risk', 'Reduction of Risk', 'Risk Azaltma'), t('nclex_phys_adapt', 'Physiological Adaptation', 'Fizyolojik Uyum')] },
  ] },
  { id: 'pmp', subjects: [
    { id: 'pmp_people', tr: 'İnsan', en: 'People', weight: 42, topics: [t('pmp_people_main', 'People Domain', 'İnsan Alanı')] },
    { id: 'pmp_process', tr: 'Süreç', en: 'Process', weight: 50, topics: [t('pmp_process_main', 'Process Domain', 'Süreç Alanı')] },
    { id: 'pmp_business', tr: 'İş Ortamı', en: 'Business Environment', weight: 8, topics: [t('pmp_business_main', 'Business Environment Domain', 'İş Ortamı Alanı')] },
  ] },
  { id: 'det', subjects: [
    { id: 'det_read', tr: 'Okuma', en: 'Reading', weight: 1, topics: [t('det_read_main', 'Reading Tasks', 'Okuma Görevleri')] },
    { id: 'det_listen', tr: 'Dinleme', en: 'Listening', weight: 1, topics: [t('det_listen_main', 'Listening Tasks', 'Dinleme Görevleri')] },
    { id: 'det_write', tr: 'Yazma', en: 'Writing', weight: 1, topics: [t('det_write_main', 'Writing Tasks', 'Yazma Görevleri')] },
    { id: 'det_speak', tr: 'Konuşma', en: 'Speaking', weight: 1, topics: [t('det_speak_main', 'Speaking Tasks', 'Konuşma Görevleri')] },
  ] },
  { id: 'cambridge', subjects: [
    { id: 'cam_use', tr: 'Dil Kullanımı', en: 'Use of English', weight: 1, topics: [t('cam_use_main', 'Use of English', 'Dil Kullanımı')] },
    { id: 'cam_read', tr: 'Okuma', en: 'Reading', weight: 1, topics: [t('cam_read_main', 'Reading', 'Okuma')] },
    { id: 'cam_write', tr: 'Yazma', en: 'Writing', weight: 1, topics: [t('cam_write_main', 'Writing', 'Yazma')] },
    { id: 'cam_listen', tr: 'Dinleme', en: 'Listening', weight: 1, topics: [t('cam_listen_main', 'Listening', 'Dinleme')] },
    { id: 'cam_speak', tr: 'Konuşma', en: 'Speaking', weight: 1, topics: [t('cam_speak_main', 'Speaking', 'Konuşma')] },
  ] },
  { id: 'ged', subjects: [
    { id: 'ged_math', tr: 'Matematik', en: 'Math', weight: 1, topics: [t('ged_math_main', 'Mathematical Reasoning', 'Matematiksel Akıl Yürütme')] },
    { id: 'ged_lang', tr: 'Dil Sanatları', en: 'Language Arts', weight: 1, topics: [t('ged_lang_main', 'Reasoning Through Language Arts', 'Dil Sanatları')] },
    { id: 'ged_sci', tr: 'Fen', en: 'Science', weight: 1, topics: [t('ged_sci_main', 'Science', 'Fen')] },
    { id: 'ged_soc', tr: 'Sosyal Bilimler', en: 'Social Studies', weight: 1, topics: [t('ged_soc_main', 'Social Studies', 'Sosyal Bilimler')] },
  ] },
];
