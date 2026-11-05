import type { ExamCurriculum, Topic } from './curriculum';

/*
  İNGİLİZCE KULLANANLARIN SINAV KONULARI (2026-11-05). Yalnız sınavın kendi yayımladığı üst başlıklar: alt konu uydurulmaz, yanlış
  müfredat zarar verir. SAT alanları College Board belgelerinden; diğerleri sınav sahiplerinin bölüm adları.
*/
const t = (id: string, en: string, tr: string = en, weight?: number): Topic => ({ id, en, tr, ...(weight ? { weight } : null) });

export const INTL_CURRICULA: ExamCurriculum[] = [
  // IELTS: Listening, Reading, Writing, Speaking; soru tipleri resmî kılavuzun başlıkları.
  { id: 'ielts', subjects: [
    { id: 'ielts_listening', tr: 'Listening', en: 'Listening', weight: 1, topics: [t('ielts_listening_note', 'Form and Note Completion', 'Form ve Not Tamamlama'), t('ielts_listening_mcq', 'Multiple Choice', 'Çoktan Seçmeli'), t('ielts_listening_map', 'Map and Diagram Labelling', 'Harita ve Şema'), t('ielts_listening_match', 'Matching', 'Eşleştirme')] },
    { id: 'ielts_reading', tr: 'Reading', en: 'Reading', weight: 1, topics: [t('ielts_reading_skim', 'Skimming and Scanning', 'Hızlı Okuma ve Tarama'), t('ielts_reading_tfng', 'True / False / Not Given', 'Doğru / Yanlış / Belirtilmemiş'), t('ielts_reading_headings', 'Matching Headings', 'Başlık Eşleştirme'), t('ielts_reading_mcq', 'Multiple Choice', 'Çoktan Seçmeli'), t('ielts_reading_summary', 'Summary Completion', 'Özet Tamamlama')] },
    { id: 'ielts_writing', tr: 'Writing', en: 'Writing', weight: 1, topics: [t('ielts_writing_task1', 'Task 1: Report or Letter', 'Task 1: Rapor ya da Mektup'), t('ielts_writing_task2', 'Task 2: Essay', 'Task 2: Kompozisyon', 2), t('ielts_writing_cohesion', 'Coherence and Vocabulary', 'Bağlantılar ve Kelime')] },
    { id: 'ielts_speaking', tr: 'Speaking', en: 'Speaking', weight: 1, topics: [t('ielts_speaking_part1', 'Part 1: Interview', 'Part 1: Tanışma'), t('ielts_speaking_part2', 'Part 2: Long Turn', 'Part 2: Kart'), t('ielts_speaking_part3', 'Part 3: Discussion', 'Part 3: Tartışma')] },
  ] },
  // TOEFL iBT: 21 Ocak 2026 biçimi. Görev adları ETS duyurusu ve hazırlık kaynakları; süre kaynaklarda farklı (yaklaşık 2 saatin altında).
  { id: 'toefl', subjects: [
    { id: 'toefl_reading', tr: 'Reading', en: 'Reading', weight: 1, topics: [t('toefl_reading_words', 'Complete the Words', 'Kelime Tamamlama'), t('toefl_reading_daily', 'Read in Daily Life', 'Günlük Metinler'), t('toefl_reading_academic', 'Academic Passage', 'Akademik Metin', 2)] },
    { id: 'toefl_listening', tr: 'Listening', en: 'Listening', weight: 1, topics: [t('toefl_listening_response', 'Listen and Choose a Response', 'Cevap Seçme'), t('toefl_listening_conv', 'Conversations', 'Konuşmalar'), t('toefl_listening_lecture', 'Academic Talks', 'Akademik Konuşmalar', 2)] },
    { id: 'toefl_writing', tr: 'Writing', en: 'Writing', weight: 1, topics: [t('toefl_writing_build', 'Build a Sentence', 'Cümle Kurma'), t('toefl_writing_email', 'Write an Email', 'E-posta Yazma'), t('toefl_writing_discussion', 'Academic Discussion', 'Akademik Tartışma', 2)] },
    { id: 'toefl_speaking', tr: 'Speaking', en: 'Speaking', weight: 1, topics: [t('toefl_speaking_repeat', 'Listen and Repeat', 'Dinle ve Tekrar Et'), t('toefl_speaking_interview', 'Take an Interview', 'Mülakat')] },
  ] },
  // GRE: 2023 sonrası kısa biçim, Writing'de yalnız Issue görevi.
  { id: 'gre', subjects: [
    { id: 'gre_verbal', tr: 'Verbal Reasoning', en: 'Verbal Reasoning', weight: 2, topics: [t('gre_verbal_text', 'Text Completion', 'Metin Tamamlama'), t('gre_verbal_equiv', 'Sentence Equivalence', 'Cümle Eşdeğerliği'), t('gre_verbal_rc', 'Reading Comprehension', 'Okuduğunu Anlama', 2)] },
    { id: 'gre_quant', tr: 'Quantitative Reasoning', en: 'Quantitative Reasoning', weight: 2, topics: [t('gre_quant_arith', 'Arithmetic', 'Aritmetik'), t('gre_quant_algebra', 'Algebra', 'Cebir'), t('gre_quant_geo', 'Geometry', 'Geometri'), t('gre_quant_data', 'Data Analysis', 'Veri Analizi')] },
    { id: 'gre_writing', tr: 'Analytical Writing', en: 'Analytical Writing', weight: 1, topics: [t('gre_writing_issue', 'Analyze an Issue', 'Issue Görevi')] },
  ] },
  // GMAT: Focus biçimi. Sentence Correction ve geometri kalktı; Data Sufficiency, Data Insights'a geçti.
  { id: 'gmat', subjects: [
    { id: 'gmat_quant', tr: 'Quantitative Reasoning', en: 'Quantitative Reasoning', weight: 1, topics: [t('gmat_quant_arith', 'Arithmetic', 'Aritmetik'), t('gmat_quant_algebra', 'Algebra', 'Cebir'), t('gmat_quant_word', 'Word Problems', 'Problemler', 2)] },
    { id: 'gmat_verbal', tr: 'Verbal Reasoning', en: 'Verbal Reasoning', weight: 1, topics: [t('gmat_verbal_cr', 'Critical Reasoning', 'Eleştirel Akıl Yürütme'), t('gmat_verbal_rc', 'Reading Comprehension', 'Okuduğunu Anlama')] },
    { id: 'gmat_di', tr: 'Data Insights', en: 'Data Insights', weight: 1, topics: [t('gmat_di_ds', 'Data Sufficiency', 'Veri Yeterliliği', 2), t('gmat_di_msr', 'Multi-Source Reasoning', 'Çok Kaynaklı Akıl Yürütme'), t('gmat_di_table', 'Table Analysis', 'Tablo Analizi'), t('gmat_di_graph', 'Graphics Interpretation', 'Grafik Yorumlama'), t('gmat_di_tpa', 'Two-Part Analysis', 'İki Parçalı Analiz')] },
  ] },
  // USMLE Step 1: disiplinler ve sistemler; Step 2 için kullanıcı konularını düzenler.
  { id: 'usmle', subjects: [
    { id: 'usmle_general', tr: 'Genel Prensipler', en: 'General Principles', weight: 1, topics: [t('usmle_gen_biochem', 'Biochemistry and Genetics', 'Biyokimya ve Genetik'), t('usmle_gen_micro', 'Microbiology and Immunology', 'Mikrobiyoloji ve İmmünoloji'), t('usmle_gen_path', 'General Pathology', 'Genel Patoloji'), t('usmle_gen_pharm', 'General Pharmacology', 'Genel Farmakoloji')] },
    { id: 'usmle_systems', tr: 'Organ Sistemleri', en: 'Organ Systems', weight: 2, topics: [t('usmle_sys_cardio', 'Cardiovascular', 'Kardiyovasküler'), t('usmle_sys_resp', 'Respiratory', 'Solunum'), t('usmle_sys_renal', 'Renal', 'Böbrek'), t('usmle_sys_gi', 'Gastrointestinal', 'Sindirim'), t('usmle_sys_neuro', 'Neurology and Psychiatry', 'Nöroloji ve Psikiyatri'), t('usmle_sys_endo', 'Endocrine and Reproductive', 'Endokrin ve Üreme'), t('usmle_sys_msk', 'Musculoskeletal and Skin', 'Kas-İskelet ve Deri'), t('usmle_sys_heme', 'Hematology', 'Hematoloji')] },
    { id: 'usmle_practice', tr: 'Uygulama', en: 'Application', weight: 1, topics: [t('usmle_prac_stats', 'Biostatistics and Ethics', 'Biyoistatistik ve Etik'), t('usmle_prac_clinical', 'Clinical Reasoning', 'Klinik Akıl Yürütme')] },
  ] },
  // PTE Academic: görev adları sınav sahibinin listesi.
  { id: 'pte', subjects: [
    { id: 'pte_speaking', tr: 'Speaking & Writing', en: 'Speaking & Writing', weight: 2, topics: [t('pte_read_aloud', 'Read Aloud', 'Sesli Okuma'), t('pte_repeat', 'Repeat Sentence', 'Cümle Tekrarı'), t('pte_describe', 'Describe Image', 'Görsel Anlatma'), t('pte_retell', 'Retell Lecture', 'Dersi Anlatma'), t('pte_situation', 'Respond to a Situation', 'Duruma Cevap'), t('pte_group', 'Summarize Group Discussion', 'Tartışma Özeti'), t('pte_sum_text', 'Summarize Written Text', 'Metin Özeti'), t('pte_essay', 'Write Essay', 'Kompozisyon')] },
    { id: 'pte_reading', tr: 'Reading', en: 'Reading', weight: 1, topics: [t('pte_read_fib', 'Fill in the Blanks', 'Boşluk Doldurma', 2), t('pte_reorder', 'Re-order Paragraphs', 'Paragraf Sıralama'), t('pte_read_mcq', 'Multiple Choice', 'Çoktan Seçmeli')] },
    { id: 'pte_listening', tr: 'Listening', en: 'Listening', weight: 1, topics: [t('pte_sum_spoken', 'Summarize Spoken Text', 'Konuşma Özeti'), t('pte_listen_fib', 'Fill in the Blanks', 'Boşluk Doldurma'), t('pte_dictation', 'Write from Dictation', 'Dikte', 2), t('pte_highlight', 'Highlight Correct Summary', 'Doğru Özet')] },
  ] },
  { id: 'sat', subjects: [
    { id: 'sat_rw', tr: 'Okuma ve Yazma', en: 'Reading and Writing', weight: 54, topics: [
      t('sat_rw_craft', 'Craft and Structure', 'Metin Yapısı ve Sözcük', 28), t('sat_rw_info', 'Information and Ideas', 'Bilgi ve Fikirler', 26),
      t('sat_rw_conv', 'Standard English Conventions', 'Yazım Kuralları', 26), t('sat_rw_expr', 'Expression of Ideas', 'Fikirlerin İfadesi', 20),
    ] },
    { id: 'sat_math', tr: 'Matematik', en: 'Math', weight: 44, topics: [
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
