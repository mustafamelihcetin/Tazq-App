import type { ExamCurriculum, Subject, Topic } from './curriculum';

/*
  SINAV KONULARI, YENİDEN YAZIM (2026-11-05, kullanıcı: "konular doğru değil, eksik ve yetersiz"). Denetimde bulunan başlıca hatalar:
  YKS'de AYT ve YDT yoktu; GMAT'ta kaldırılmış Sentence Correction vardı; GRE'de 2023'te kalkan Argument görevi vardı; TOEFL eski biçimdeydi;
  KPSS'de sözel/sayısal mantık, problemler, Çağdaş Tarih, temel hukuk eksikti; ALES'te "Sözel Problemler" diye bir konu vardı; YDS'de
  bulunmayan soru tipleri vardı; TUS klinik/temel ayrımına uymuyordu.

  GÜVEN DÜZEYİ (her sınavın başında yazılı):
    resmî: soru dağılımı sınavı yapanın belgesinden.
    ikincil: yapı hazırlık kaynaklarından, resmî belgeyle doğrulanmalı.
    genel: üst başlıklar; ayrıntı için kullanıcı Konular'dan düzenler.
  Konu listesi "ne çalışılır" haritasıdır, resmî müfredat metni değildir; uygulama bunu iddia etmez. Yılı değişen kapsam (LGS gibi) için
  uzaktan güncelleme hazır (setCurriculum).
*/
const t = (id: string, tr: string, en: string, weight?: number): Topic => ({ id, tr, en, ...(weight ? { weight } : null) });
const s = (id: string, tr: string, en: string, weight: number, topics: Topic[]): Subject => ({ id, tr, en, weight, topics });

export const TR_CURRICULA: ExamCurriculum[] = [
  // İkincil: 120 soru ve 130 dk ÖSYM duyurusundan; ders dağılımı (30/30/27/18/9/6) hazırlık kaynaklarından.
  { id: 'kpss', subjects: [
    s('kpss_turkce', 'Türkçe', 'Turkish', 30, [
      t('kpss_turkce_sozcukte', 'Sözcükte Anlam', 'Word Meaning', 4),
      t('kpss_turkce_cumlede', 'Cümlede Anlam', 'Sentence Meaning', 4),
      t('kpss_turkce_paragraf', 'Paragraf', 'Paragraph', 14),
      t('kpss_turkce_dilbilgisi', 'Ses, Yapı ve Sözcük Türleri', 'Sounds, Morphology and Word Classes', 2),
      t('kpss_turkce_cumlebilgisi', 'Cümle Bilgisi', 'Sentence Structure', 1),
      t('kpss_turkce_yazim', 'Yazım ve Noktalama', 'Spelling and Punctuation', 2),
      t('kpss_turkce_anlatim', 'Anlatım Bozuklukları', 'Expression Errors', 1),
      t('kpss_turkce_sozelmantik', 'Sözel Mantık', 'Verbal Logic', 2),
    ]),
    s('kpss_matematik', 'Matematik', 'Math', 30, [
      t('kpss_mat_sayilar', 'Temel Kavramlar ve Sayı Basamakları', 'Basic Concepts and Place Value', 3),
      t('kpss_mat_bolme', 'Bölme, Bölünebilme, EBOB-EKOK', 'Divisibility, GCD and LCM', 2),
      t('kpss_mat_rasyonel', 'Rasyonel Sayılar ve Ondalıklar', 'Rational Numbers and Decimals', 2),
      t('kpss_mat_uslu', 'Üslü ve Köklü Sayılar', 'Exponents and Roots', 2),
      t('kpss_mat_denklem', 'Denklem ve Eşitsizlikler', 'Equations and Inequalities', 2),
      t('kpss_mat_oran', 'Oran-Orantı', 'Ratio and Proportion', 2),
      t('kpss_mat_problem', 'Problemler (sayı, yaş, işçi, hareket, yüzde, karışım)', 'Word Problems (age, work, speed, percent, mixture)', 8),
      t('kpss_mat_islemler', 'Kümeler, Fonksiyon, İşlem, Modüler', 'Sets, Functions, Operations, Modular', 2),
      t('kpss_mat_olasilik', 'Permütasyon, Kombinasyon, Olasılık', 'Permutation, Combination, Probability', 1),
      t('kpss_mat_geometri', 'Geometri', 'Geometry', 2),
      t('kpss_mat_veri', 'Tablo ve Grafik Yorumlama', 'Tables and Charts', 2),
      t('kpss_mat_mantik', 'Sayısal Mantık', 'Numerical Logic', 2),
    ]),
    s('kpss_tarih', 'Tarih', 'History', 27, [
      t('kpss_tarih_islamoncesi', 'İslamiyet Öncesi Türk Tarihi', 'Pre-Islamic Turkish History', 2),
      t('kpss_tarih_turkislam', 'Türk-İslam Devletleri', 'Turkish-Islamic States', 2),
      t('kpss_tarih_osmanlikurulus', 'Osmanlı: Kuruluş ve Yükselme', 'Ottoman: Rise', 3),
      t('kpss_tarih_osmanlicokus', 'Osmanlı: Duraklama, Gerileme, Dağılma', 'Ottoman: Decline', 3),
      t('kpss_tarih_kultur', 'Osmanlı Kültür ve Medeniyeti', 'Ottoman Culture and Civilization', 3),
      t('kpss_tarih_milli', 'Kurtuluş Savaşı Hazırlık ve Cepheler', 'War of Independence', 4),
      t('kpss_tarih_inkilap', 'Atatürk İlke ve İnkılapları', 'Atatürk’s Principles and Reforms', 4),
      t('kpss_tarih_ataturkculuk', 'Atatürk Dönemi Dış Politika', 'Foreign Policy in the Atatürk Era', 3),
      t('kpss_tarih_cagdas', 'Çağdaş Türk ve Dünya Tarihi', 'Contemporary Turkish and World History', 3),
    ]),
    s('kpss_cografya', 'Coğrafya', 'Geography', 18, [
      t('kpss_cog_fiziki', 'Konum ve Yer Şekilleri', 'Location and Landforms', 3),
      t('kpss_cog_iklim', 'İklim ve Bitki Örtüsü', 'Climate and Vegetation', 3),
      t('kpss_cog_nufus', 'Nüfus ve Yerleşme', 'Population and Settlement', 3),
      t('kpss_cog_ekonomi', 'Tarım ve Hayvancılık', 'Agriculture and Livestock', 3),
      t('kpss_cog_sanayi', 'Madenler, Enerji, Sanayi', 'Mining, Energy, Industry', 3),
      t('kpss_cog_ulasim', 'Ulaşım, Ticaret, Turizm', 'Transport, Trade, Tourism', 2),
      t('kpss_cog_bolgeler', 'Bölgeler ve Çevre', 'Regions and Environment', 1),
    ]),
    s('kpss_vatandaslik', 'Vatandaşlık', 'Citizenship', 9, [
      t('kpss_vat_hukuk', 'Temel Hukuk Kavramları', 'Basic Legal Concepts', 2),
      t('kpss_vat_anayasa', 'Anayasa Tarihi ve 1982 Anayasası', 'Constitutional History and the 1982 Constitution', 2),
      t('kpss_vat_haklar', 'Temel Hak ve Ödevler', 'Fundamental Rights and Duties', 1),
      t('kpss_vat_yasama', 'Yasama', 'Legislature', 1),
      t('kpss_vat_yurutme', 'Yürütme', 'Executive', 1),
      t('kpss_vat_yargi', 'Yargı', 'Judiciary', 1),
      t('kpss_vat_idare', 'İdare Hukuku', 'Administrative Law', 1),
    ]),
    s('kpss_guncel', 'Güncel Bilgiler', 'Current Affairs', 6, [
      t('kpss_guncel_turkiye', 'Türkiye Gündemi', 'Turkey Agenda'),
      t('kpss_guncel_dunya', 'Dünya ve Kuruluşlar', 'World and Organizations'),
    ]),
  ] },

  // Resmî: TYT, AYT ve YDT soru sayıları ÖSYM 2026 kılavuzu. Konular üst başlık.
  { id: 'yks', subjects: [
    s('yks_turkce', 'TYT Türkçe', 'TYT Turkish', 40, [
      t('yks_turkce_sozcuk', 'Sözcükte ve Cümlede Anlam', 'Word and Sentence Meaning', 5),
      t('yks_turkce_paragraf', 'Paragraf', 'Paragraph', 25),
      t('yks_turkce_dilbilgisi', 'Ses ve Yapı Bilgisi', 'Sounds and Morphology', 2),
      t('yks_turkce_sozcukturleri', 'Sözcük Türleri', 'Word Classes', 2),
      t('yks_turkce_cumlebilgisi', 'Cümlenin Ögeleri ve Türleri', 'Sentence Elements and Types', 2),
      t('yks_turkce_yazim', 'Yazım ve Noktalama', 'Spelling and Punctuation', 3),
      t('yks_turkce_anlatim', 'Anlatım Bozuklukları', 'Expression Errors', 1),
    ]),
    s('yks_matematik', 'TYT Matematik', 'TYT Math', 40, [
      t('yks_mat_temel', 'Temel Kavramlar ve Sayılar', 'Basic Concepts and Numbers', 4),
      t('yks_mat_bolme', 'Bölünebilme, EBOB-EKOK', 'Divisibility, GCD and LCM', 2),
      t('yks_mat_rasyonel', 'Rasyonel, Üslü, Köklü Sayılar', 'Rational Numbers, Exponents, Roots', 3),
      t('yks_mat_denklem', 'Denklem ve Eşitsizlikler', 'Equations and Inequalities', 3),
      t('yks_mat_oran', 'Oran-Orantı ve Problemler', 'Ratio and Word Problems', 12),
      t('yks_mat_fonksiyon', 'Kümeler, Fonksiyonlar, Polinomlar', 'Sets, Functions, Polynomials', 3),
      t('yks_mat_veri', 'Permütasyon, Olasılık, Veri', 'Permutation, Probability, Data', 3),
      t('yks_mat_geometri', 'Geometri', 'Geometry', 10),
    ]),
    s('yks_fen', 'TYT Fen', 'TYT Science', 20, [
      t('yks_fen_fizik', 'Fizik: Hareket, Kuvvet, Enerji', 'Physics: Motion, Force, Energy', 4),
      t('yks_fen_fizikenerji', 'Fizik: Isı, Elektrik, Optik, Dalgalar', 'Physics: Heat, Electricity, Optics, Waves', 3),
      t('yks_fen_kimya', 'Kimya: Atom ve Periyodik Sistem', 'Chemistry: Atom and Periodic Table', 3),
      t('yks_fen_kimyareaksiyon', 'Kimya: Mol, Tepkimeler, Karışımlar', 'Chemistry: Mole, Reactions, Mixtures', 4),
      t('yks_fen_biyoloji', 'Biyoloji: Hücre ve Canlılar', 'Biology: Cell and Living Things', 3),
      t('yks_fen_biyolojikalitim', 'Biyoloji: Kalıtım ve Ekoloji', 'Biology: Genetics and Ecology', 3),
    ]),
    s('yks_sosyal', 'TYT Sosyal', 'TYT Social Sciences', 20, [
      t('yks_sos_tarih', 'Tarih', 'History', 5),
      t('yks_sos_cografya', 'Coğrafya', 'Geography', 5),
      t('yks_sos_felsefe', 'Felsefe', 'Philosophy', 5),
      t('yks_sos_din', 'Din Kültürü', 'Religious Culture', 5),
    ]),
    s('ayt_mat', 'AYT Matematik', 'AYT Math', 40, [
      t('ayt_mat_fonksiyon', 'Fonksiyonlar ve Polinomlar', 'Functions and Polynomials', 4),
      t('ayt_mat_ikinci', 'İkinci Dereceden Denklemler', 'Quadratics', 3),
      t('ayt_mat_olasilik', 'Permütasyon, Kombinasyon, Olasılık', 'Permutation, Combination, Probability', 3),
      t('ayt_mat_logaritma', 'Üstel ve Logaritmik Fonksiyonlar', 'Exponential and Logarithmic Functions', 3),
      t('ayt_mat_dizi', 'Diziler', 'Sequences', 2),
      t('ayt_mat_trigo', 'Trigonometri', 'Trigonometry', 3),
      t('ayt_mat_limit', 'Limit ve Süreklilik', 'Limits and Continuity', 2),
      t('ayt_mat_turev', 'Türev', 'Derivatives', 4),
      t('ayt_mat_integral', 'İntegral', 'Integrals', 4),
      t('ayt_mat_geometri', 'Geometri ve Analitik Geometri', 'Geometry and Analytic Geometry', 12),
    ]),
    s('ayt_fiz', 'AYT Fizik', 'AYT Physics', 14, [
      t('ayt_fiz_kuvvet', 'Vektör, Kuvvet, Tork, Denge', 'Vectors, Force, Torque, Equilibrium'),
      t('ayt_fiz_hareket', 'Düzgün Çembersel ve Basit Harmonik Hareket', 'Circular and Harmonic Motion'),
      t('ayt_fiz_elektrik', 'Elektrik ve Manyetizma', 'Electricity and Magnetism'),
      t('ayt_fiz_dalga', 'Dalga Mekaniği', 'Wave Mechanics'),
      t('ayt_fiz_modern', 'Atom Fiziği ve Modern Fizik', 'Atomic and Modern Physics'),
    ]),
    s('ayt_kim', 'AYT Kimya', 'AYT Chemistry', 13, [
      t('ayt_kim_atom', 'Modern Atom Teorisi ve Gazlar', 'Modern Atomic Theory and Gases'),
      t('ayt_kim_cozelti', 'Sıvı Çözeltiler', 'Solutions'),
      t('ayt_kim_tepkime', 'Enerji, Hız, Denge', 'Energy, Rate, Equilibrium'),
      t('ayt_kim_elektrokimya', 'Elektrokimya', 'Electrochemistry'),
      t('ayt_kim_organik', 'Organik Kimya', 'Organic Chemistry'),
    ]),
    s('ayt_bio', 'AYT Biyoloji', 'AYT Biology', 13, [
      t('ayt_bio_sistemler', 'İnsan Fizyolojisi', 'Human Physiology', 3),
      t('ayt_bio_genetik', 'Genden Proteine, Genetik Mühendisliği', 'Gene to Protein, Genetic Engineering', 2),
      t('ayt_bio_enerji', 'Canlılarda Enerji Dönüşümleri', 'Energy in Living Things', 2),
      t('ayt_bio_bitki', 'Bitki Biyolojisi', 'Plant Biology', 1),
      t('ayt_bio_komunite', 'Komünite ve Popülasyon Ekolojisi', 'Community and Population Ecology', 1),
    ]),
    s('ayt_edb', 'AYT Edebiyat', 'AYT Literature', 24, [
      t('ayt_edb_bilgi', 'Edebi Sanatlar ve Nazım Bilgisi', 'Literary Devices and Verse', 3),
      t('ayt_edb_turler', 'Edebi Akımlar ve Türler', 'Movements and Genres', 3),
      t('ayt_edb_islamoncesi', 'İslamiyet Öncesi ve Halk Edebiyatı', 'Pre-Islamic and Folk Literature', 3),
      t('ayt_edb_divan', 'Divan Edebiyatı', 'Divan Literature', 3),
      t('ayt_edb_tanzimat', 'Tanzimat ve Servetifünun', 'Tanzimat and Servet-i Fünun', 4),
      t('ayt_edb_cumhuriyet', 'Milli Edebiyat ve Cumhuriyet Dönemi', 'National and Republican Literature', 6),
      t('ayt_edb_paragraf', 'Metin ve Anlam', 'Text and Meaning', 2),
    ]),
    s('ayt_tar', 'AYT Tarih', 'AYT History', 21, [
      t('ayt_tar_ilk', 'İlk Çağ ve İslam Tarihi', 'Antiquity and Islamic History'),
      t('ayt_tar_turk', 'Türk-İslam Devletleri', 'Turkish-Islamic States'),
      t('ayt_tar_osmanli', 'Osmanlı Tarihi', 'Ottoman History'),
      t('ayt_tar_inkilap', 'Kurtuluş Savaşı ve İnkılap Tarihi', 'War of Independence and Reforms'),
      t('ayt_tar_cagdas', 'Çağdaş Türk ve Dünya Tarihi', 'Contemporary History'),
    ]),
    s('ayt_cog', 'AYT Coğrafya', 'AYT Geography', 17, [
      t('ayt_cog_ekosistem', 'Biyoçeşitlilik ve Ekosistem', 'Biodiversity and Ecosystems'),
      t('ayt_cog_nufus', 'Nüfus, Göç, Yerleşme', 'Population, Migration, Settlement'),
      t('ayt_cog_ekonomi', 'Türkiye Ekonomisi', 'Turkish Economy'),
      t('ayt_cog_bolge', 'Bölgeler ve Ülkeler', 'Regions and Countries'),
      t('ayt_cog_cevre', 'Çevre ve Toplum', 'Environment and Society'),
    ]),
    s('ayt_fel', 'AYT Felsefe Grubu', 'AYT Philosophy Group', 12, [
      t('ayt_fel_felsefe', 'Felsefe', 'Philosophy'),
      t('ayt_fel_psikoloji', 'Psikoloji', 'Psychology'),
      t('ayt_fel_sosyoloji', 'Sosyoloji', 'Sociology'),
      t('ayt_fel_mantik', 'Mantık', 'Logic'),
    ]),
    s('ayt_din', 'AYT Din Kültürü', 'AYT Religious Culture', 6, [t('ayt_din_genel', 'Din Kültürü', 'Religious Culture')]),
    s('ydt', 'YDT Yabancı Dil', 'YDT Foreign Language', 80, [
      t('ydt_kelime', 'Kelime', 'Vocabulary', 2),
      t('ydt_gramer', 'Dil Bilgisi', 'Grammar', 2),
      t('ydt_cumle', 'Cümle Tamamlama', 'Sentence Completion'),
      t('ydt_ceviri', 'Çeviri', 'Translation'),
      t('ydt_paragraf', 'Paragraf ve Okuma', 'Paragraph and Reading', 3),
      t('ydt_diyalog', 'Diyalog ve Anlamca Yakın Cümle', 'Dialogue and Restatement'),
    ]),
  ] },

  // İkincil: 100 soru, 135 dk, 50+50 hazırlık kaynaklarından; ÖSYM kılavuzu açılamadı.
  { id: 'dgs', subjects: [
    s('dgs_sozel', 'Sözel Bölüm', 'Verbal Section', 50, [
      t('dgs_sozel_anlam', 'Sözcükte ve Cümlede Anlam', 'Word and Sentence Meaning', 14),
      t('dgs_sozel_paragraf', 'Paragraf', 'Paragraph', 24),
      t('dgs_sozel_mantik', 'Sözel Mantık', 'Verbal Logic', 12),
    ]),
    s('dgs_sayisal', 'Sayısal Bölüm', 'Quantitative Section', 50, [
      t('dgs_sayisal_islemler', 'Temel Matematik ve Sayılar', 'Basic Math and Numbers', 12),
      t('dgs_sayisal_problem', 'Problemler', 'Word Problems', 18),
      t('dgs_sayisal_geometri', 'Geometri', 'Geometry', 10),
      t('dgs_sayisal_mantik', 'Sayısal Mantık', 'Numerical Logic', 5),
      t('dgs_sayisal_veri', 'Tablo ve Grafik Yorumlama', 'Tables and Charts', 5),
    ]),
  ] },

  // İkincil: ALES iki bölüm, eşit ağırlık.
  { id: 'ales', subjects: [
    s('ales_sozel', 'Sözel', 'Verbal', 50, [
      t('ales_sozel_anlam', 'Sözcükte ve Cümlede Anlam', 'Word and Sentence Meaning', 2),
      t('ales_sozel_paragraf', 'Paragraf', 'Paragraph', 5),
      t('ales_sozel_mantik', 'Sözel Mantık', 'Verbal Logic', 3),
    ]),
    s('ales_sayisal', 'Sayısal', 'Quantitative', 50, [
      t('ales_sayisal_islemler', 'Temel Matematik', 'Basic Math', 3),
      t('ales_sayisal_problem', 'Problemler', 'Word Problems', 3),
      t('ales_sayisal_geometri', 'Geometri', 'Geometry', 2),
      t('ales_sayisal_mantik', 'Sayısal Mantık', 'Numerical Logic', 2),
      t('ales_sayisal_veri', 'Tablo ve Grafik Yorumlama', 'Tables and Charts', 2),
    ]),
  ] },

  // İkincil: 90 soru, 155 dk, 20/20/20/10/10/10 birden çok kaynakta aynı. Kapsamı MEB her yıl duyurur: üniteler üst başlık.
  { id: 'lgs', subjects: [
    s('lgs_turkce', 'Türkçe', 'Turkish', 20, [
      t('lgs_turkce_anlam', 'Sözcükte ve Cümlede Anlam', 'Word and Sentence Meaning', 3),
      t('lgs_turkce_paragraf', 'Paragraf ve Metin Anlama', 'Paragraph and Comprehension', 10),
      t('lgs_turkce_fiilimsi', 'Fiilimsiler', 'Verbals', 2),
      t('lgs_turkce_ogeler', 'Cümlenin Ögeleri ve Türleri', 'Sentence Elements and Types', 2),
      t('lgs_turkce_yazim', 'Yazım ve Noktalama', 'Spelling and Punctuation', 2),
      t('lgs_turkce_metin', 'Söz Sanatları ve Metin Türleri', 'Figures of Speech and Text Types', 1),
    ]),
    s('lgs_matematik', 'Matematik', 'Math', 20, [
      t('lgs_mat_carpanlar', 'Çarpanlar ve Katlar', 'Factors and Multiples'),
      t('lgs_mat_uslu', 'Üslü İfadeler', 'Exponents'),
      t('lgs_mat_koklu', 'Kareköklü İfadeler', 'Square Roots'),
      t('lgs_mat_veri', 'Veri Analizi', 'Data Analysis'),
      t('lgs_mat_olasilik', 'Olasılık', 'Probability'),
      t('lgs_mat_cebir', 'Cebirsel İfadeler ve Özdeşlikler', 'Algebraic Expressions and Identities'),
      t('lgs_mat_denklem', 'Doğrusal Denklemler', 'Linear Equations'),
      t('lgs_mat_esitsizlik', 'Eşitsizlikler', 'Inequalities'),
      t('lgs_mat_ucgen', 'Üçgenler', 'Triangles'),
      t('lgs_mat_benzerlik', 'Eşlik ve Benzerlik', 'Congruence and Similarity'),
      t('lgs_mat_donusum', 'Dönüşüm Geometrisi', 'Transformations'),
      t('lgs_mat_cisim', 'Geometrik Cisimler', 'Solids'),
    ]),
    s('lgs_fen', 'Fen Bilimleri', 'Science', 20, [
      t('lgs_fen_mevsim', 'Mevsimler ve İklim', 'Seasons and Climate'),
      t('lgs_fen_dna', 'DNA ve Genetik Kod', 'DNA and Genetic Code'),
      t('lgs_fen_basinc', 'Basınç', 'Pressure'),
      t('lgs_fen_madde', 'Madde ve Endüstri', 'Matter and Industry'),
      t('lgs_fen_makine', 'Basit Makineler', 'Simple Machines'),
      t('lgs_fen_enerji', 'Enerji Dönüşümleri ve Çevre', 'Energy Conversions and Environment'),
      t('lgs_fen_elektrik', 'Elektrik Yükleri ve Elektrik Enerjisi', 'Electric Charge and Energy'),
    ]),
    s('lgs_inkilap', 'T.C. İnkılap Tarihi', 'Revolution History', 10, [
      t('lgs_inkilap_kahraman', 'Bir Kahraman Doğuyor', 'A Hero Is Born'),
      t('lgs_inkilap_uyanis', 'Milli Uyanış', 'National Awakening'),
      t('lgs_inkilap_destan', 'Ya İstiklal Ya Ölüm', 'Independence or Death'),
      t('lgs_inkilap_ataturkculuk', 'Atatürkçülük ve Çağdaşlaşma', 'Kemalism and Modernization'),
      t('lgs_inkilap_dispolitika', 'Demokratikleşme ve Dış Politika', 'Democratization and Foreign Policy'),
    ]),
    s('lgs_din', 'Din Kültürü', 'Religious Culture', 10, [
      t('lgs_din_kader', 'Kader İnancı', 'Belief in Fate'),
      t('lgs_din_ibadet', 'Zekat ve Sadaka', 'Zakat and Charity'),
      t('lgs_din_hayat', 'Din ve Hayat', 'Religion and Life'),
      t('lgs_din_ahlak', 'Hz. Muhammed’in Örnekliği', 'The Prophet’s Example'),
      t('lgs_din_kuran', 'Kur’an-ı Kerim ve Özellikleri', 'The Quran'),
    ]),
    s('lgs_ingilizce', 'İngilizce', 'English', 10, [
      t('lgs_ing_friendship', 'Friendship', 'Friendship'),
      t('lgs_ing_teenlife', 'Teen Life', 'Teen Life'),
      t('lgs_ing_kitchen', 'In the Kitchen', 'In the Kitchen'),
      t('lgs_ing_phone', 'On the Phone', 'On the Phone'),
      t('lgs_ing_internet', 'The Internet', 'The Internet'),
      t('lgs_ing_adventures', 'Adventures', 'Adventures'),
      t('lgs_ing_tourism', 'Tourism', 'Tourism'),
      t('lgs_ing_chores', 'Chores', 'Chores'),
      t('lgs_ing_science', 'Science', 'Science'),
      t('lgs_ing_natural', 'Natural Forces', 'Natural Forces'),
    ]),
  ] },

  // İkincil: 80 soru, 180 dk, dinleme yok; soru tipleri çıkmış sorulardan.
  { id: 'yds', subjects: [
    s('yds_kelime', 'Kelime', 'Vocabulary', 2, [t('yds_kelime_bosluk', 'Kelime ve Phrasal Verb', 'Vocabulary and Phrasal Verbs')]),
    s('yds_dilbilgisi', 'Dil Bilgisi', 'Grammar', 2, [
      t('yds_dil_zaman', 'Zamanlar', 'Tenses'),
      t('yds_dil_edat', 'Edatlar ve Bağlaçlar', 'Prepositions and Conjunctions'),
      t('yds_dil_modal', 'Modal Fiiller', 'Modals'),
      t('yds_dil_yapilar', 'Yan Cümleler ve Yapılar', 'Clauses and Structures'),
    ]),
    s('yds_ceviri', 'Çeviri ve Cümle', 'Translation and Sentences', 2, [
      t('yds_ceviri_te', 'Türkçeden İngilizceye Çeviri', 'Turkish to English'),
      t('yds_ceviri_et', 'İngilizceden Türkçeye Çeviri', 'English to Turkish'),
      t('yds_ceviri_cumle', 'Cümle Tamamlama', 'Sentence Completion'),
      t('yds_ceviri_cloze', 'Cloze Test', 'Cloze Test'),
    ]),
    s('yds_okuma', 'Okuma', 'Reading', 3, [
      t('yds_okuma_ana', 'Okuma Parçaları', 'Reading Passages', 3),
      t('yds_okuma_paragraf', 'Paragraf Tamamlama', 'Paragraph Completion'),
      t('yds_okuma_bozan', 'Anlam Bütünlüğünü Bozan Cümle', 'Irrelevant Sentence'),
      t('yds_okuma_yakin', 'Anlamca En Yakın Cümle', 'Restatement'),
    ]),
  ] },

  // İkincil: YÖKDİL alanlara göre (Sağlık, Sosyal, Fen) metin seçer; soru tipleri çıkmış sorulardan.
  { id: 'yokdil', subjects: [
    s('yokdil_dil', 'Kelime ve Dil Bilgisi', 'Vocabulary and Grammar', 2, [t('yokdil_kelime', 'Alan Kelimeleri', 'Field Vocabulary', 2), t('yokdil_gramer', 'Dil Bilgisi', 'Grammar')]),
    s('yokdil_ceviri', 'Çeviri ve Cümle', 'Translation and Sentences', 2, [t('yokdil_cumle', 'Cümle Tamamlama', 'Sentence Completion'), t('yokdil_cevir', 'Çeviri', 'Translation')]),
    s('yokdil_okuma', 'Okuma', 'Reading', 3, [t('yokdil_parca', 'Alan Metinleri', 'Field Passages', 3), t('yokdil_paragraf', 'Paragraf Tamamlama', 'Paragraph Completion'), t('yokdil_bozan', 'Anlam Bütünlüğünü Bozan Cümle', 'Irrelevant Sentence')]),
  ] },

  // İkincil: 80 soru, 110 dk; dağılım kaynaklarda çelişiyor. Toplamı tutan dağılım (30/15/15/8/6/6) kullanıldı. ÖABT alanı kişiye göre.
  { id: 'ags', subjects: [
    s('ags_egitim', 'Eğitim Bilimleri', 'Educational Sciences', 30, [
      t('ags_egt_gelisim', 'Gelişim Psikolojisi', 'Developmental Psychology'),
      t('ags_egt_ogrenme', 'Öğrenme Psikolojisi', 'Learning Psychology'),
      t('ags_egt_program', 'Program Geliştirme', 'Curriculum Development'),
      t('ags_egt_ogretim', 'Öğretim Yöntem ve Teknikleri', 'Teaching Methods'),
      t('ags_egt_olcme', 'Ölçme ve Değerlendirme', 'Assessment'),
      t('ags_egt_rehberlik', 'Rehberlik', 'Guidance'),
    ]),
    s('ags_sozel', 'Sözel Yetenek', 'Verbal Ability', 15, [t('ags_soz_anlam', 'Sözcük ve Cümle', 'Word and Sentence'), t('ags_soz_paragraf', 'Paragraf', 'Paragraph', 3), t('ags_soz_mantik', 'Sözel Mantık', 'Verbal Logic')]),
    s('ags_sayisal', 'Sayısal Yetenek', 'Numerical Ability', 15, [t('ags_say_temel', 'Temel Matematik', 'Basic Math'), t('ags_say_problem', 'Problemler', 'Word Problems', 2), t('ags_say_mantik', 'Sayısal Mantık', 'Numerical Logic'), t('ags_say_veri', 'Grafik ve Tablo', 'Charts and Tables')]),
    s('ags_mevzuat', 'Mevzuat', 'Legislation', 8, [t('ags_mev_kanun', 'Milli Eğitim Temel Kanunu ve Öğretmenlik', 'Basic Education Law and Teaching')]),
    s('ags_tarih', 'Tarih', 'History', 6, [t('ags_tarih_inkilap', 'İnkılap Tarihi ve Atatürkçülük', 'Reforms and Kemalism')]),
    s('ags_cografya', 'Türkiye Coğrafyası', 'Geography of Turkey', 6, [t('ags_cog_genel', 'Türkiye Coğrafyası', 'Geography of Turkey')]),
    s('ags_oabt', 'ÖABT', 'Field Knowledge Test', 25, [t('ags_oabt_alan', 'Alan Bilgisi', 'Subject Knowledge', 2), t('ags_oabt_egitim', 'Alan Eğitimi', 'Subject Teaching')]),
  ] },

  // Genel: Eski "ÖABT" adıyla arayan için. Alan kişiye göre değişir; ayrıntıyı kullanıcı düzenler.
  { id: 'oabt', subjects: [
    s('oabt_alan', 'Alan Bilgisi', 'Subject Knowledge', 2, [t('oabt_alan_bilgi', 'Alan Bilgisi', 'Subject Knowledge', 2), t('oabt_alan_egitim', 'Alan Eğitimi', 'Subject Teaching')]),
  ] },

  // Genel: İki oturum (Temel, Klinik); ders başlıkları yerleşik düzene göre.
  { id: 'tus', subjects: [
    s('tus_temel', 'Temel Tıp Bilimleri', 'Basic Medical Sciences', 1, [
      t('tus_tem_anatomi', 'Anatomi', 'Anatomy'),
      t('tus_tem_histoloji', 'Histoloji ve Embriyoloji', 'Histology and Embryology'),
      t('tus_tem_fizyoloji', 'Fizyoloji', 'Physiology'),
      t('tus_tem_biyokimya', 'Biyokimya', 'Biochemistry', 2),
      t('tus_tem_mikro', 'Mikrobiyoloji', 'Microbiology', 2),
      t('tus_tem_patoloji', 'Patoloji', 'Pathology', 2),
      t('tus_tem_farma', 'Farmakoloji', 'Pharmacology', 2),
    ]),
    s('tus_klinik', 'Klinik Tıp Bilimleri', 'Clinical Sciences', 1, [
      t('tus_kln_dahiliye', 'Dahiliye', 'Internal Medicine', 4),
      t('tus_kln_pediatri', 'Pediatri', 'Pediatrics', 3),
      t('tus_kln_cerrahi', 'Genel Cerrahi', 'General Surgery', 3),
      t('tus_kln_kadin', 'Kadın Hastalıkları ve Doğum', 'Obstetrics and Gynecology', 2),
      t('tus_kln_kucuk', 'Küçük Stajlar', 'Minor Rotations', 2),
    ]),
  ] },

  // Genel: Sınav duyurularındaki ders adları.
  { id: 'msü', subjects: [
    s('msu_turkce', 'Türkçe', 'Turkish', 2, [t('msu_tr_paragraf', 'Paragraf', 'Paragraph', 3), t('msu_tr_anlam', 'Sözcük ve Cümle', 'Word and Sentence'), t('msu_tr_dil', 'Dil Bilgisi', 'Grammar')]),
    s('msu_matematik', 'Matematik', 'Math', 2, [t('msu_mat_temel', 'Temel Matematik', 'Basic Math'), t('msu_mat_problem', 'Problemler', 'Word Problems', 2), t('msu_mat_geo', 'Geometri', 'Geometry')]),
    s('msu_fen', 'Fen Bilimleri', 'Science', 1, [t('msu_fen_fizik', 'Fizik', 'Physics'), t('msu_fen_kimya', 'Kimya', 'Chemistry'), t('msu_fen_biyo', 'Biyoloji', 'Biology')]),
    s('msu_sosyal', 'Sosyal Bilimler', 'Social Sciences', 1, [t('msu_sos_tarih', 'Tarih', 'History'), t('msu_sos_cog', 'Coğrafya', 'Geography'), t('msu_sos_fel', 'Felsefe', 'Philosophy')]),
  ] },

  // Genel: Duyuruya göre değişir; kullanıcı düzenler.
  { id: 'pmyo', subjects: [
    s('pmyo_yetenek', 'Genel Yetenek', 'General Ability', 1, [t('pmyo_soz', 'Türkçe', 'Turkish'), t('pmyo_say', 'Matematik', 'Math')]),
    s('pmyo_kultur', 'Genel Kültür', 'General Knowledge', 1, [t('pmyo_tar', 'Tarih', 'History'), t('pmyo_cog', 'Coğrafya', 'Geography'), t('pmyo_vat', 'Vatandaşlık', 'Citizenship'), t('pmyo_gun', 'Güncel Bilgiler', 'Current Affairs')]),
  ] },

  // İkincil: KPSS ile aynı dersler; engel grubuna göre kapsam duyurudan kontrol edilmeli.
  { id: 'ekpss', subjects: [
    s('ekpss_turkce', 'Türkçe', 'Turkish', 2, [t('ekpss_tr_paragraf', 'Paragraf', 'Paragraph', 3), t('ekpss_tr_anlam', 'Sözcük ve Cümle', 'Word and Sentence'), t('ekpss_tr_dil', 'Dil Bilgisi', 'Grammar')]),
    s('ekpss_matematik', 'Matematik', 'Math', 2, [t('ekpss_mat_temel', 'Temel Matematik', 'Basic Math'), t('ekpss_mat_problem', 'Problemler', 'Word Problems', 2)]),
    s('ekpss_kultur', 'Genel Kültür', 'General Knowledge', 2, [t('ekpss_tar', 'Tarih', 'History', 2), t('ekpss_cog', 'Coğrafya', 'Geography'), t('ekpss_vat', 'Vatandaşlık', 'Citizenship'), t('ekpss_gun', 'Güncel Bilgiler', 'Current Affairs')]),
  ] },

  // Genel: Hukuk mesleklerine giriş için yerleşik alanlar; ağırlıkları kitapçıktan doğrulanmalı.
  { id: 'hmgs', subjects: [
    s('hmgs_kamu', 'Kamu Hukuku', 'Public Law', 2, [t('hmgs_anayasa', 'Anayasa Hukuku', 'Constitutional Law'), t('hmgs_idare', 'İdare ve İdari Yargılama', 'Administrative Law', 2), t('hmgs_vergi', 'Vergi Hukuku', 'Tax Law')]),
    s('hmgs_ozel', 'Özel Hukuk', 'Private Law', 3, [t('hmgs_medeni', 'Medeni Hukuk', 'Civil Law', 2), t('hmgs_borclar', 'Borçlar Hukuku', 'Law of Obligations', 2), t('hmgs_ticaret', 'Ticaret Hukuku', 'Commercial Law', 2)]),
    s('hmgs_ceza', 'Ceza Hukuku', 'Criminal Law', 2, [t('hmgs_ceza_genel', 'Ceza Hukuku', 'Criminal Law', 2), t('hmgs_cmk', 'Ceza Muhakemesi', 'Criminal Procedure')]),
    s('hmgs_usul', 'Usul ve Diğer', 'Procedure and Other', 2, [t('hmgs_hmk', 'Medeni Usul', 'Civil Procedure', 2), t('hmgs_icra', 'İcra ve İflas', 'Enforcement and Bankruptcy'), t('hmgs_is', 'İş Hukuku', 'Labor Law'), t('hmgs_avukat', 'Avukatlık ve Hakimlik Hukuku', 'Legal Profession'), t('hmgs_felsefe', 'Hukuk Felsefesi ve Sosyolojisi', 'Philosophy and Sociology of Law')]),
  ] },

  // Genel: SMMM sınav başlıkları.
  { id: 'smmm', subjects: [
    s('smmm_muhasebe', 'Muhasebe', 'Accounting', 3, [t('smmm_finansal', 'Finansal Muhasebe', 'Financial Accounting', 2), t('smmm_tablo', 'Finansal Tablolar ve Analiz', 'Financial Statements and Analysis'), t('smmm_maliyet', 'Maliyet Muhasebesi', 'Cost Accounting'), t('smmm_denetim', 'Muhasebe Denetimi', 'Auditing')]),
    s('smmm_vergi', 'Vergi Mevzuatı', 'Tax Law', 2, [t('smmm_gelir', 'Gelir Vergisi', 'Income Tax'), t('smmm_kurumlar', 'Kurumlar Vergisi', 'Corporate Tax'), t('smmm_kdv', 'KDV ve Diğer Vergiler', 'VAT and Other Taxes'), t('smmm_usul', 'Vergi Usul Kanunu', 'Tax Procedure')]),
    s('smmm_hukuk', 'Hukuk', 'Law', 1, [t('smmm_borclar', 'Borçlar Hukuku', 'Law of Obligations'), t('smmm_ticaret', 'Ticaret Hukuku', 'Commercial Law'), t('smmm_meslek', 'Meslek Hukuku', 'Professional Law')]),
    s('smmm_diger', 'Diğer', 'Other', 1, [t('smmm_sermaye', 'Sermaye Piyasası', 'Capital Markets')]),
  ] },

  // Genel: Çocuğun yaşına göre uygulanır; çalışma için yalnız becerilere ayrıldı.
  { id: 'bilsem', subjects: [
    s('bilsem_sozel', 'Sözel Yetenek', 'Verbal Ability', 1, [t('bilsem_kelime', 'Kelime İlişkileri', 'Word Relations'), t('bilsem_analoji', 'Analoji', 'Analogies'), t('bilsem_mantik', 'Sözel Mantık', 'Verbal Logic')]),
    s('bilsem_sayisal', 'Sayısal ve Şekil', 'Numerical and Figural', 1, [t('bilsem_oruntu', 'Şekil ve Örüntü', 'Figures and Patterns'), t('bilsem_sayi', 'Sayısal Mantık', 'Numerical Logic'), t('bilsem_uzamsal', 'Uzamsal Düşünme', 'Spatial Reasoning')]),
  ] },

  // Genel: Duyuruya göre değişir.
  { id: 'katiplik', subjects: [
    s('katiplik_klavye', 'Klavye Hız ve Doğruluk', 'Typing Speed and Accuracy', 2, [t('katiplik_hiz', 'Hız Çalışması', 'Speed Practice'), t('katiplik_dogru', 'Doğruluk ve İmla', 'Accuracy and Spelling')]),
    s('katiplik_mevzuat', 'Temel Mevzuat', 'Basic Legislation', 1, [t('katiplik_anayasa', 'Anayasa', 'Constitution'), t('katiplik_hmk', 'Yazı İşleri ve Usul', 'Clerical Work and Procedure'), t('katiplik_icra', 'İcra Mevzuatı', 'Enforcement Law')]),
  ] },

  // Genel: Duyuruya göre değişir.
  { id: 'kaymakamlik', subjects: [
    s('kay_hukuk', 'Hukuk', 'Law', 2, [t('kay_anayasa', 'Anayasa Hukuku', 'Constitutional Law'), t('kay_idare', 'İdare Hukuku ve İdari Yargı', 'Administrative Law'), t('kay_ceza', 'Ceza ve Medeni Hukuk', 'Criminal and Civil Law')]),
    s('kay_iktisat', 'İktisat ve Maliye', 'Economics and Public Finance', 2, [t('kay_mikro', 'Mikro İktisat', 'Microeconomics'), t('kay_makro', 'Makro İktisat', 'Macroeconomics'), t('kay_maliye', 'Maliye', 'Public Finance'), t('kay_turkiye', 'Türkiye Ekonomisi', 'Turkish Economy')]),
    s('kay_yonetim', 'Kamu Yönetimi', 'Public Administration', 1, [t('kay_kamu', 'Kamu Yönetimi', 'Public Administration'), t('kay_dil', 'Yabancı Dil', 'Foreign Language')]),
  ] },

  // Genel: Duyuruya göre değişir.
  { id: 'icra', subjects: [
    s('icra_iik', 'İcra ve İflas', 'Enforcement and Bankruptcy', 2, [t('icra_ilamli', 'İlamlı İcra', 'Enforcement with Judgment'), t('icra_ilamsiz', 'İlamsız İcra', 'Enforcement without Judgment'), t('icra_haciz', 'Haciz ve Satış', 'Attachment and Sale'), t('icra_iflas', 'İflas', 'Bankruptcy')]),
    s('icra_hmk', 'Usul Hukuku', 'Procedural Law', 1, [t('icra_dava', 'Dava Şartları', 'Conditions of Action'), t('icra_yargilama', 'Yargılama Usulü', 'Trial Procedure')]),
  ] },

  // Genel: 7245 sayılı Kanun ve genel yetenek başlıkları; duyuruya göre değişir.
  { id: 'bekcilik', subjects: [
    s('bek_turkce', 'Türkçe', 'Turkish', 1, [t('bek_tr_paragraf', 'Paragraf', 'Paragraph'), t('bek_tr_dil', 'Dil Bilgisi', 'Grammar')]),
    s('bek_kultur', 'Genel Kültür', 'General Knowledge', 1, [t('bek_tarih', 'Tarih', 'History'), t('bek_cog', 'Coğrafya', 'Geography'), t('bek_guncel', 'Güncel Bilgiler', 'Current Affairs')]),
    s('bek_mevzuat', 'Mevzuat', 'Legislation', 2, [t('bek_anayasa', 'Anayasa', 'Constitution'), t('bek_7245', 'Çarşı ve Mahalle Bekçileri Kanunu', 'Night Watchmen Law'), t('bek_pvsk', 'Polis Vazife ve Salahiyet Kanunu', 'Police Duties Law')]),
  ] },
];

/** Tek sınavın içindeki yollar: YKS'de alan seçilmeden plan gereksiz dersleri de ister. */
export interface ExamTrack { id: string; tr: string; en: string; keep: string[] }
const TYT = ['yks_turkce', 'yks_matematik', 'yks_fen', 'yks_sosyal'];
export const EXAM_TRACKS: Record<string, ExamTrack[]> = {
  yks: [
    { id: 'say', tr: 'Sayısal', en: 'Science', keep: [...TYT, 'ayt_mat', 'ayt_fiz', 'ayt_kim', 'ayt_bio'] },
    { id: 'ea', tr: 'Eşit Ağırlık', en: 'Equal Weight', keep: [...TYT, 'ayt_mat', 'ayt_edb', 'ayt_tar', 'ayt_cog'] },
    { id: 'soz', tr: 'Sözel', en: 'Verbal', keep: [...TYT, 'ayt_edb', 'ayt_tar', 'ayt_cog', 'ayt_fel', 'ayt_din'] },
    { id: 'dil', tr: 'Dil', en: 'Language', keep: [...TYT, 'ydt'] },
    { id: 'tyt', tr: 'Yalnız TYT', en: 'TYT only', keep: TYT },
  ],
};
