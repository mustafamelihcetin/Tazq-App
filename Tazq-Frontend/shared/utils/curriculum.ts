/**
 * Müfredat veri katmanı — "içerik = uzaktan güncellenebilir veri" yaklaşımı.
 *
 * TASARIM:
 * - Uygulama gömülü bir BASELINE müfredat taşır (offline/garanti çalışır).
 * - İleride sunucudan (remote config) güncel sürüm çekilip `setCurriculum()` ile
 *   override edilebilir (sürüm yeni ise). Böylece müfredat/sınav değişince
 *   uygulama güncellemesi GEREKMEZ. Marjinal maliyet sıfır (sadece JSON).
 * - Bilinmeyen sınav → null döner; çağıran taraf mevcut JENERİK akışa düşer.
 *
 * GÜVENİLİRLİK: İçerik insan-doğrulamalı (AI uydurması değil). Sınav hazırlığında
 * yanlış müfredat zararlı olduğundan bu bilinçli bir tercihtir.
 *
 * Bu modül SAF + senkron tutulur (kolay test). Sınav adı→preset eşlemesi için
 * mevcut examPresets altyapısı kullanılır.
 *
 * ── İKİ SEVİYE: DERS → KONU ──────────────────────────────────────────────────
 * Eskiden yalnız DERS (Subject) vardı — "KPSS — Türkçe" gibi bir görev etiketi
 * üretiliyordu. Bu, "sanki rehberlik hocası görev veriyor" hissini vermiyordu:
 * tüm Türkçe çalışanlar aynı jenerik "soru çöz" görevini görüyordu. Artık her
 * dersin altında KONU (Topic) listesi var — "KPSS — Türkçe · Paragraf" gibi.
 * Rotasyon mantığı (en uzun süredir çalışılmayan + ağırlıklı tur) AYNI, yalnız
 * ders yerine konu üzerinde çalışıyor (bkz. `pickTopic`).
 *
 * ── DALGA PLANI ───────────────────────────────────────────────────────────────
 * Motor TÜM sınavları (examPresets.ts'teki her id) aynı şekilde destekler — hiçbiri
 * kod değişikliği gerektirmez, yalnız veri eksik/dolu olur. Dalga 1'de KPSS ve YKS
 * tam KONU derinliğinde; geri kalan sınavlar şimdilik yalnız DERS seviyesinde
 * (`topics` boş/kısa) — bu, "hiç içerik yok" ile "yanlış/uydurma içerik" arasında
 * daha güvenli bir ara durum. Sonraki dalgalarda yalnız bu dosyaya veri eklenir.
 */

import { detectExamFromInput, matchExamName } from './examPresets';

export interface Topic {
  id: string;
  tr: string;
  en: string;
  /** Göreli ağırlık (konunun sınavdaki yoğunluğu). Varsayılan 1. */
  weight?: number;
}

export interface Subject {
  id: string;
  tr: string;
  en: string;
  /** Göreli ağırlık (sınavdaki yoğunluk). Varsayılan 1. */
  weight?: number;
  /** Ders altındaki konular. Boşsa rotasyon ders seviyesinde kalır. */
  topics?: Topic[];
}

export interface ExamCurriculum {
  /** examPresets id'si ile eşleşir (kpss, yks, ...). */
  id: string;
  subjects: Subject[];
}

export interface CurriculumManifest {
  version: number;
  exams: ExamCurriculum[];
}

/** Konu ilerleme kaydı (yerel; bulut-senkron edilebilir). */
export interface SubjectProgress {
  /** En son çalışılan gün (YYYY-MM-DD). Yoksa hiç çalışılmamış. */
  lastStudied?: string;
}

// ── GÖMÜLÜ BASELINE ─────────────────────────────────────────────────────────────
// Yalnızca üst-düzey, evrensel-doğru başlıklar (düşük halüsinasyon/eskime riski).
// Detaylı/değişken konular sunucudaki manifest ile genişletilir.
export const BASELINE_CURRICULUM: CurriculumManifest = {
  version: 2,
  exams: [
    {
      id: 'kpss',
      subjects: [
        {
          id: 'kpss_turkce', tr: 'Türkçe', en: 'Turkish', weight: 2,
          topics: [
            { id: 'kpss_turkce_sozcukte', tr: 'Sözcükte Anlam', en: 'Word Meaning' },
            { id: 'kpss_turkce_cumlede', tr: 'Cümlede Anlam', en: 'Sentence Meaning' },
            { id: 'kpss_turkce_paragraf', tr: 'Paragraf', en: 'Paragraph' },
            { id: 'kpss_turkce_yazim', tr: 'Yazım & Noktalama', en: 'Spelling & Punctuation' },
            { id: 'kpss_turkce_dilbilgisi', tr: 'Dil Bilgisi (Ses-Yapı)', en: 'Grammar (Phonetics-Morphology)' },
            { id: 'kpss_turkce_anlatim', tr: 'Anlatım Bozuklukları', en: 'Expression Errors' },
          ],
        },
        {
          id: 'kpss_matematik', tr: 'Matematik', en: 'Math', weight: 2,
          topics: [
            { id: 'kpss_mat_sayilar', tr: 'Temel Kavramlar & Sayı Basamakları', en: 'Basic Concepts & Place Value' },
            { id: 'kpss_mat_bolme', tr: 'Bölme-Bölünebilme & EBOB-EKOK', en: 'Divisibility & GCD-LCM' },
            { id: 'kpss_mat_rasyonel', tr: 'Rasyonel Sayılar & Problemler', en: 'Rational Numbers & Word Problems' },
            { id: 'kpss_mat_oran', tr: 'Oran-Orantı & Yüzde', en: 'Ratio-Proportion & Percentage' },
            { id: 'kpss_mat_islemler', tr: 'İşlem, Kümeler & Sayı Problemleri', en: 'Operations, Sets & Number Problems' },
            { id: 'kpss_mat_geometri', tr: 'Temel Geometri', en: 'Basic Geometry' },
            { id: 'kpss_mat_veri', tr: 'Veri Yorumlama', en: 'Data Interpretation' },
          ],
        },
        {
          id: 'kpss_tarih', tr: 'Tarih', en: 'History', weight: 1,
          topics: [
            { id: 'kpss_tarih_islamoncesi', tr: 'İslamiyet Öncesi Türk Tarihi', en: 'Pre-Islamic Turkish History' },
            { id: 'kpss_tarih_osmanlikurulus', tr: 'Osmanlı Kuruluş & Yükselme', en: 'Ottoman Rise' },
            { id: 'kpss_tarih_osmanlicokus', tr: 'Osmanlı Duraklama-Gerileme-Dağılma', en: 'Ottoman Decline' },
            { id: 'kpss_tarih_milli', tr: 'Milli Mücadele & Cepheler', en: 'National Struggle & Fronts' },
            { id: 'kpss_tarih_inkilap', tr: 'Atatürk İlke & İnkılapları', en: 'Atatürk\'s Principles & Reforms' },
            { id: 'kpss_tarih_ataturkculuk', tr: 'Atatürk Dönemi Dış Politika & Sonrası', en: 'Atatürk-Era Foreign Policy & Aftermath' },
          ],
        },
        {
          id: 'kpss_cografya', tr: 'Coğrafya', en: 'Geography', weight: 1,
          topics: [
            { id: 'kpss_cog_fiziki', tr: 'Türkiye\'nin Yer Şekilleri & İklimi', en: 'Turkey\'s Landforms & Climate' },
            { id: 'kpss_cog_nufus', tr: 'Nüfus & Yerleşme', en: 'Population & Settlement' },
            { id: 'kpss_cog_ekonomi', tr: 'Ekonomik Coğrafya (Tarım-Sanayi-Ulaşım)', en: 'Economic Geography' },
            { id: 'kpss_cog_bolgeler', tr: 'Bölgeler & Çevre Sorunları', en: 'Regions & Environmental Issues' },
          ],
        },
        {
          id: 'kpss_vatandaslik', tr: 'Vatandaşlık', en: 'Citizenship', weight: 1,
          topics: [
            { id: 'kpss_vat_anayasa', tr: 'Anayasa Hukuku Temelleri', en: 'Constitutional Law Basics' },
            { id: 'kpss_vat_yasama', tr: 'Yasama (TBMM)', en: 'Legislature (TBMM)' },
            { id: 'kpss_vat_yurutme', tr: 'Yürütme (Cumhurbaşkanlığı)', en: 'Executive (Presidency)' },
            { id: 'kpss_vat_yargi', tr: 'Yargı & Anayasa Mahkemesi', en: 'Judiciary & Constitutional Court' },
            { id: 'kpss_vat_idare', tr: 'İdare Hukuku & Yerel Yönetimler', en: 'Administrative Law & Local Government' },
          ],
        },
        {
          id: 'kpss_guncel', tr: 'Güncel Bilgiler', en: 'Current Affairs', weight: 1,
          topics: [
            { id: 'kpss_guncel_turkiye', tr: 'Türkiye Gündemi', en: 'Turkey Agenda' },
            { id: 'kpss_guncel_dunya', tr: 'Dünya Gündemi', en: 'World Agenda' },
          ],
        },
      ],
    },
    {
      id: 'yks',
      subjects: [
        {
          id: 'yks_turkce', tr: 'Türkçe', en: 'Turkish', weight: 2,
          topics: [
            { id: 'yks_turkce_sozcuk', tr: 'Sözcükte & Cümlede Anlam', en: 'Word & Sentence Meaning' },
            { id: 'yks_turkce_paragraf', tr: 'Paragraf (Anlam-Yapı-Konu)', en: 'Paragraph (Meaning-Structure-Topic)' },
            { id: 'yks_turkce_dilbilgisi', tr: 'Ses Bilgisi & Yapı Bilgisi', en: 'Phonetics & Morphology' },
            { id: 'yks_turkce_sozcukturleri', tr: 'Sözcük Türleri', en: 'Parts of Speech' },
            { id: 'yks_turkce_cumlebilgisi', tr: 'Cümlenin Ögeleri & Cümle Türleri', en: 'Sentence Elements & Types' },
            { id: 'yks_turkce_anlatim', tr: 'Anlatım Bozuklukları', en: 'Expression Errors' },
          ],
        },
        {
          id: 'yks_matematik', tr: 'Matematik', en: 'Math', weight: 2,
          topics: [
            { id: 'yks_mat_temel', tr: 'Temel Kavramlar & Sayı Basamakları', en: 'Basic Concepts & Place Value' },
            { id: 'yks_mat_bolme', tr: 'Bölünebilme, EBOB-EKOK', en: 'Divisibility, GCD-LCM' },
            { id: 'yks_mat_denklem', tr: 'Denklem & Eşitsizlikler', en: 'Equations & Inequalities' },
            { id: 'yks_mat_fonksiyon', tr: 'Fonksiyonlar', en: 'Functions' },
            { id: 'yks_mat_oran', tr: 'Oran-Orantı, Problemler', en: 'Ratio-Proportion, Word Problems' },
            { id: 'yks_mat_geometri', tr: 'Geometri (Üçgenler-Çember-Analitik)', en: 'Geometry' },
            { id: 'yks_mat_veri', tr: 'Permütasyon-Olasılık & Veri', en: 'Permutation-Probability & Data' },
          ],
        },
        {
          id: 'yks_fen', tr: 'Fen Bilimleri', en: 'Science', weight: 1,
          topics: [
            { id: 'yks_fen_fizik', tr: 'Fizik — Hareket & Kuvvet', en: 'Physics — Motion & Force' },
            { id: 'yks_fen_fizikenerji', tr: 'Fizik — Enerji & Elektrik', en: 'Physics — Energy & Electricity' },
            { id: 'yks_fen_kimya', tr: 'Kimya — Atom & Periyodik Sistem', en: 'Chemistry — Atoms & Periodic Table' },
            { id: 'yks_fen_kimyareaksiyon', tr: 'Kimya — Tepkimeler & Mol Kavramı', en: 'Chemistry — Reactions & Moles' },
            { id: 'yks_fen_biyoloji', tr: 'Biyoloji — Hücre & Sistemler', en: 'Biology — Cell & Systems' },
            { id: 'yks_fen_biyolojikalitim', tr: 'Biyoloji — Kalıtım & Ekoloji', en: 'Biology — Genetics & Ecology' },
          ],
        },
        {
          id: 'yks_sosyal', tr: 'Sosyal Bilimler', en: 'Social Sciences', weight: 1,
          topics: [
            { id: 'yks_sos_tarih', tr: 'Tarih — İnkılap Tarihi', en: 'History — Revolution History' },
            { id: 'yks_sos_cografya', tr: 'Coğrafya — Doğal Sistemler', en: 'Geography — Natural Systems' },
            { id: 'yks_sos_felsefe', tr: 'Felsefe — Bilgi & Varlık', en: 'Philosophy — Knowledge & Being' },
            { id: 'yks_sos_din', tr: 'Din Kültürü / Değerler', en: 'Religious Culture / Values' },
          ],
        },
      ],
    },
    // ── DALGA 2 (2026-10-18): ALES/LGS/DGS/YDS tam konu derinliğine çıktı — AYNI motor,
    // yalnız veri eklendi (bkz. dosya başlığındaki dalga planı). Geri kalan sınavlar
    // (Dalga 3) hâlâ ders seviyesinde; `pickTopic` konu listesi boşsa ders seviyesine
    // sessizce düşer, yani eksik veri hiçbir şeyi bozmaz.
    {
      id: 'ales',
      subjects: [
        {
          id: 'ales_sozel', tr: 'Sözel Akıl Yürütme', en: 'Verbal Reasoning', weight: 1,
          topics: [
            { id: 'ales_sozel_mantik', tr: 'Sözel Mantıksal Akıl Yürütme', en: 'Verbal Logical Reasoning', weight: 2 },
            { id: 'ales_sozel_anlam', tr: 'Sözcükte & Cümlede Anlam', en: 'Word & Sentence Meaning' },
            { id: 'ales_sozel_paragraf', tr: 'Paragraf', en: 'Paragraph' },
            { id: 'ales_sozel_problem', tr: 'Sözel Problemler', en: 'Verbal Word Problems' },
          ],
        },
        {
          id: 'ales_sayisal', tr: 'Sayısal Akıl Yürütme', en: 'Quantitative Reasoning', weight: 1,
          topics: [
            { id: 'ales_sayisal_islemler', tr: 'Sayılarla İşlemler', en: 'Operations with Numbers', weight: 2 },
            { id: 'ales_sayisal_mantik', tr: 'Sayısal Mantık', en: 'Quantitative Logic' },
            { id: 'ales_sayisal_problem', tr: 'Sayısal Problemler', en: 'Quantitative Word Problems' },
            { id: 'ales_sayisal_geometri', tr: 'Geometri & Temel Kavramlar', en: 'Geometry & Basic Concepts' },
            { id: 'ales_sayisal_veri', tr: 'Veri Yorumlama (Grafik-Tablo)', en: 'Data Interpretation (Charts-Tables)' },
          ],
        },
      ],
    },
    {
      id: 'lgs',
      subjects: [
        {
          id: 'lgs_turkce', tr: 'Türkçe', en: 'Turkish', weight: 2,
          topics: [
            { id: 'lgs_turkce_anlam', tr: 'Sözcükte & Cümlede Anlam', en: 'Word & Sentence Meaning' },
            { id: 'lgs_turkce_paragraf', tr: 'Paragraf', en: 'Paragraph' },
            { id: 'lgs_turkce_ogeler', tr: 'Cümlenin Ögeleri & Fiilimsi', en: 'Sentence Elements & Verbals' },
            { id: 'lgs_turkce_yazim', tr: 'Yazım & Noktalama', en: 'Spelling & Punctuation' },
            { id: 'lgs_turkce_metin', tr: 'Metin Türleri', en: 'Text Types' },
          ],
        },
        {
          id: 'lgs_matematik', tr: 'Matematik', en: 'Math', weight: 2,
          topics: [
            { id: 'lgs_mat_carpanlar', tr: 'Çarpanlar & Katlar', en: 'Factors & Multiples' },
            { id: 'lgs_mat_usluKoklu', tr: 'Üslü & Köklü Sayılar', en: 'Exponents & Roots' },
            { id: 'lgs_mat_denklem', tr: 'Doğrusal Denklemler', en: 'Linear Equations' },
            { id: 'lgs_mat_veri', tr: 'Veri Analizi & Olasılık', en: 'Data Analysis & Probability' },
            { id: 'lgs_mat_geometri', tr: 'Eşlik-Benzerlik & Geometrik Cisimler', en: 'Congruence-Similarity & Solids' },
          ],
        },
        {
          id: 'lgs_fen', tr: 'Fen Bilimleri', en: 'Science', weight: 2,
          topics: [
            { id: 'lgs_fen_mevsim', tr: 'Mevsimler & İklim', en: 'Seasons & Climate' },
            { id: 'lgs_fen_dna', tr: 'DNA & Genetik Kod', en: 'DNA & Genetic Code' },
            { id: 'lgs_fen_basinc', tr: 'Basınç', en: 'Pressure' },
            { id: 'lgs_fen_madde', tr: 'Madde & Endüstri', en: 'Matter & Industry' },
            { id: 'lgs_fen_enerji', tr: 'Basit Makineler & Enerji Dönüşümleri', en: 'Simple Machines & Energy Conversion' },
          ],
        },
        {
          id: 'lgs_inkilap', tr: 'T.C. İnkılap Tarihi', en: 'Revolution History', weight: 1,
          topics: [
            { id: 'lgs_inkilap_kahraman', tr: 'Bir Kahraman Doğuyor', en: 'A Hero is Born' },
            { id: 'lgs_inkilap_uyanis', tr: 'Milli Uyanış', en: 'National Awakening' },
            { id: 'lgs_inkilap_destan', tr: 'Milli Bir Destan: Kurtuluş Savaşı', en: 'A National Epic: War of Independence' },
            { id: 'lgs_inkilap_ataturkculuk', tr: 'Atatürkçülük & Çağdaşlaşma', en: 'Atatürkism & Modernization' },
          ],
        },
        {
          id: 'lgs_din', tr: 'Din Kültürü', en: 'Religious Culture', weight: 1,
          topics: [
            { id: 'lgs_din_kader', tr: 'Kader İnancı', en: 'Belief in Destiny' },
            { id: 'lgs_din_ibadet', tr: 'Zekat, Hac & Kurban', en: 'Zakat, Hajj & Sacrifice' },
            { id: 'lgs_din_hayat', tr: 'Din ve Hayat', en: 'Religion and Life' },
            { id: 'lgs_din_peygamber', tr: "Hz. Muhammed'in Hayatı", en: 'The Life of Prophet Muhammad' },
          ],
        },
        {
          id: 'lgs_ingilizce', tr: 'İngilizce', en: 'English', weight: 1,
          topics: [
            { id: 'lgs_ing_friendship', tr: 'Friendship', en: 'Friendship' },
            { id: 'lgs_ing_teenlife', tr: 'Teen Life', en: 'Teen Life' },
            { id: 'lgs_ing_phone', tr: 'On the Phone', en: 'On the Phone' },
            { id: 'lgs_ing_internet', tr: 'The Internet', en: 'The Internet' },
            { id: 'lgs_ing_tourism', tr: 'Tourism', en: 'Tourism' },
          ],
        },
      ],
    },
    {
      id: 'dgs',
      subjects: [
        {
          id: 'dgs_sozel', tr: 'Sözel Bölüm', en: 'Verbal Section', weight: 1,
          topics: [
            { id: 'dgs_sozel_anlam', tr: 'Sözcükte & Cümlede Anlam', en: 'Word & Sentence Meaning' },
            { id: 'dgs_sozel_paragraf', tr: 'Paragraf', en: 'Paragraph' },
            { id: 'dgs_sozel_mantik', tr: 'Sözel Mantık', en: 'Verbal Logic' },
          ],
        },
        {
          id: 'dgs_sayisal', tr: 'Sayısal Bölüm', en: 'Quantitative Section', weight: 1,
          topics: [
            { id: 'dgs_sayisal_islemler', tr: 'Sayılarla İşlemler', en: 'Operations with Numbers' },
            { id: 'dgs_sayisal_problem', tr: 'Problemler', en: 'Word Problems' },
            { id: 'dgs_sayisal_geometri', tr: 'Geometri', en: 'Geometry' },
            { id: 'dgs_sayisal_veri', tr: 'Veri Yorumlama', en: 'Data Interpretation' },
          ],
        },
      ],
    },
    {
      id: 'yds',
      subjects: [
        {
          id: 'yds_kelime', tr: 'Kelime Bilgisi', en: 'Vocabulary', weight: 2,
          topics: [
            { id: 'yds_kelime_bosluk', tr: 'Boşluk Doldurma', en: 'Vocabulary Gap-Fill' },
            { id: 'yds_kelime_esZit', tr: 'Eş & Zıt Anlamlılık', en: 'Synonyms & Antonyms' },
          ],
        },
        {
          id: 'yds_dilbilgisi', tr: 'Dil Bilgisi', en: 'Grammar', weight: 1,
          topics: [
            { id: 'yds_dilbilgisi_zaman', tr: 'Zamanlar (Tenses)', en: 'Tenses' },
            { id: 'yds_dilbilgisi_edat', tr: 'Edatlar & Bağlaçlar', en: 'Prepositions & Conjunctions' },
            { id: 'yds_dilbilgisi_modal', tr: 'Modal Fiiller', en: 'Modal Verbs' },
            { id: 'yds_dilbilgisi_cumle', tr: 'Cümle Yapıları', en: 'Sentence Structures' },
          ],
        },
        {
          id: 'yds_ceviri', tr: 'Çeviri & Anlam Bütünlüğü', en: 'Translation & Coherence',
          topics: [
            { id: 'yds_ceviri_tren', tr: 'Türkçe → İngilizce Çeviri', en: 'Turkish → English Translation' },
            { id: 'yds_ceviri_ingtr', tr: 'İngilizce → Türkçe Çeviri', en: 'English → Turkish Translation' },
            { id: 'yds_ceviri_cumle', tr: 'Cümle Tamamlama', en: 'Sentence Completion' },
            { id: 'yds_ceviri_paragraf', tr: 'Paragraf Tamamlama', en: 'Paragraph Completion' },
          ],
        },
        {
          id: 'yds_okuma', tr: 'Okuma Parçaları', en: 'Reading Passages',
          topics: [
            { id: 'yds_okuma_anadusunce', tr: 'Ana Düşünce & Detay Soruları', en: 'Main Idea & Detail Questions' },
            { id: 'yds_okuma_cikarim', tr: 'Çıkarım Soruları', en: 'Inference Questions' },
            { id: 'yds_okuma_diyalog', tr: 'Diyalog Tamamlama', en: 'Dialogue Completion' },
          ],
        },
      ],
    },
    // ── DALGA 3 (2026-10-18): kalan nişler tam konu derinliğine çıktı. İki istisna
    // BİLEREK ders seviyesinde bırakıldı — evrensel bir konu kırılımları yok, konu
    // icat etmek "insan-doğrulamalı içerik" ilkesini çiğnerdi: `aof_ders` (her AÖF
    // öğrencisinin dersleri farklı — program-bağımlı, genel geçer bir liste yok) ve
    // `katiplik_klavye` (klavye hızı bir BECERİ testi, alt-konusu olmaz).
    {
      id: 'ielts',
      subjects: [
        {
          id: 'ielts_reading', tr: 'Reading', en: 'Reading', weight: 1,
          topics: [
            { id: 'ielts_reading_skim', tr: 'Skimming & Scanning', en: 'Skimming & Scanning' },
            { id: 'ielts_reading_tfng', tr: 'True / False / Not Given', en: 'True / False / Not Given' },
            { id: 'ielts_reading_headings', tr: 'Matching Headings', en: 'Matching Headings' },
            { id: 'ielts_reading_mcq', tr: 'Multiple Choice', en: 'Multiple Choice' },
          ],
        },
        {
          id: 'ielts_listening', tr: 'Listening', en: 'Listening', weight: 1,
          topics: [
            { id: 'ielts_listening_note', tr: 'Note Completion', en: 'Note Completion' },
            { id: 'ielts_listening_mcq', tr: 'Multiple Choice', en: 'Multiple Choice' },
            { id: 'ielts_listening_map', tr: 'Map / Diagram Labelling', en: 'Map / Diagram Labelling' },
          ],
        },
        {
          id: 'ielts_writing', tr: 'Writing', en: 'Writing', weight: 1,
          topics: [
            { id: 'ielts_writing_task1', tr: 'Task 1 — Grafik/Rapor', en: 'Task 1 — Graph/Report' },
            { id: 'ielts_writing_task2', tr: 'Task 2 — Deneme', en: 'Task 2 — Essay' },
            { id: 'ielts_writing_cohesion', tr: 'Coherence & Cohesion', en: 'Coherence & Cohesion' },
          ],
        },
        {
          id: 'ielts_speaking', tr: 'Speaking', en: 'Speaking', weight: 1,
          topics: [
            { id: 'ielts_speaking_part1', tr: 'Part 1 — Tanışma', en: 'Part 1 — Introduction' },
            { id: 'ielts_speaking_part2', tr: 'Part 2 — Cue Card', en: 'Part 2 — Cue Card' },
            { id: 'ielts_speaking_part3', tr: 'Part 3 — Tartışma', en: 'Part 3 — Discussion' },
          ],
        },
      ],
    },
    {
      id: 'toefl',
      subjects: [
        {
          id: 'toefl_reading', tr: 'Reading', en: 'Reading', weight: 1,
          topics: [
            { id: 'toefl_reading_fact', tr: 'Factual Information', en: 'Factual Information' },
            { id: 'toefl_reading_inference', tr: 'Inference', en: 'Inference' },
            { id: 'toefl_reading_vocab', tr: 'Vocabulary in Context', en: 'Vocabulary in Context' },
            { id: 'toefl_reading_summary', tr: 'Prose Summary', en: 'Prose Summary' },
          ],
        },
        {
          id: 'toefl_listening', tr: 'Listening', en: 'Listening', weight: 1,
          topics: [
            { id: 'toefl_listening_lecture', tr: 'Lectures', en: 'Lectures' },
            { id: 'toefl_listening_conv', tr: 'Conversations', en: 'Conversations' },
            { id: 'toefl_listening_detail', tr: 'Detail Questions', en: 'Detail Questions' },
          ],
        },
        {
          id: 'toefl_speaking', tr: 'Speaking', en: 'Speaking', weight: 1,
          topics: [
            { id: 'toefl_speaking_independent', tr: 'Independent Task', en: 'Independent Task' },
            { id: 'toefl_speaking_campus', tr: 'Integrated Task — Campus', en: 'Integrated Task — Campus' },
            { id: 'toefl_speaking_academic', tr: 'Integrated Task — Academic', en: 'Integrated Task — Academic' },
          ],
        },
        {
          id: 'toefl_writing', tr: 'Writing', en: 'Writing', weight: 1,
          topics: [
            { id: 'toefl_writing_integrated', tr: 'Integrated Writing', en: 'Integrated Writing' },
            { id: 'toefl_writing_independent', tr: 'Independent Writing', en: 'Independent Writing' },
          ],
        },
      ],
    },
    {
      id: 'tus',
      subjects: [
        {
          id: 'tus_dahili', tr: 'Dahili Bilimler', en: 'Internal Medicine', weight: 2,
          topics: [
            { id: 'tus_dahili_ic', tr: 'İç Hastalıkları', en: 'Internal Medicine' },
            { id: 'tus_dahili_pediatri', tr: 'Pediatri', en: 'Pediatrics' },
            { id: 'tus_dahili_kardiyoloji', tr: 'Kardiyoloji', en: 'Cardiology' },
            { id: 'tus_dahili_noroloji', tr: 'Nöroloji', en: 'Neurology' },
          ],
        },
        {
          id: 'tus_cerrahi', tr: 'Cerrahi Bilimler', en: 'Surgical Sciences', weight: 2,
          topics: [
            { id: 'tus_cerrahi_genel', tr: 'Genel Cerrahi', en: 'General Surgery' },
            { id: 'tus_cerrahi_kadindogum', tr: 'Kadın Doğum', en: 'Obstetrics & Gynecology' },
            { id: 'tus_cerrahi_ortopedi', tr: 'Ortopedi', en: 'Orthopedics' },
            { id: 'tus_cerrahi_uroloji', tr: 'Üroloji', en: 'Urology' },
          ],
        },
        {
          id: 'tus_temel', tr: 'Temel Bilimler', en: 'Basic Sciences', weight: 1,
          topics: [
            { id: 'tus_temel_anatomi', tr: 'Anatomi', en: 'Anatomy' },
            { id: 'tus_temel_fizyoloji', tr: 'Fizyoloji', en: 'Physiology' },
            { id: 'tus_temel_biyokimya', tr: 'Biyokimya', en: 'Biochemistry' },
            { id: 'tus_temel_patoloji', tr: 'Patoloji', en: 'Pathology' },
          ],
        },
      ],
    },
    {
      id: 'usmle',
      subjects: [
        {
          id: 'usmle_anatomy', tr: 'Anatomi & Fizyoloji', en: 'Anatomy & Physiology', weight: 1,
          topics: [
            { id: 'usmle_anatomy_cardio', tr: 'Cardiovascular', en: 'Cardiovascular' },
            { id: 'usmle_anatomy_resp', tr: 'Respiratory', en: 'Respiratory' },
            { id: 'usmle_anatomy_musculo', tr: 'Musculoskeletal', en: 'Musculoskeletal' },
            { id: 'usmle_anatomy_neuro', tr: 'Neuro', en: 'Neuro' },
          ],
        },
        {
          id: 'usmle_pathology', tr: 'Patoloji & Farmakoloji', en: 'Pathology & Pharmacology', weight: 1,
          topics: [
            { id: 'usmle_pathology_general', tr: 'General Pathology', en: 'General Pathology' },
            { id: 'usmle_pathology_pk', tr: 'Pharmacokinetics', en: 'Pharmacokinetics' },
            { id: 'usmle_pathology_micro', tr: 'Microbiology', en: 'Microbiology' },
            { id: 'usmle_pathology_immuno', tr: 'Immunology', en: 'Immunology' },
          ],
        },
        {
          id: 'usmle_clinical', tr: 'Klinik Akıl Yürütme', en: 'Clinical Reasoning', weight: 1,
          topics: [
            { id: 'usmle_clinical_history', tr: 'History Taking', en: 'History Taking' },
            { id: 'usmle_clinical_ddx', tr: 'Differential Diagnosis', en: 'Differential Diagnosis' },
            { id: 'usmle_clinical_management', tr: 'Management Plans', en: 'Management Plans' },
          ],
        },
      ],
    },
    {
      id: 'gre',
      subjects: [
        {
          id: 'gre_verbal', tr: 'Verbal Reasoning', en: 'Verbal Reasoning', weight: 1,
          topics: [
            { id: 'gre_verbal_text', tr: 'Text Completion', en: 'Text Completion' },
            { id: 'gre_verbal_sentence', tr: 'Sentence Equivalence', en: 'Sentence Equivalence' },
            { id: 'gre_verbal_reading', tr: 'Reading Comprehension', en: 'Reading Comprehension' },
          ],
        },
        {
          id: 'gre_quant', tr: 'Quantitative Reasoning', en: 'Quantitative Reasoning', weight: 1,
          topics: [
            { id: 'gre_quant_arithmetic', tr: 'Arithmetic', en: 'Arithmetic' },
            { id: 'gre_quant_algebra', tr: 'Algebra', en: 'Algebra' },
            { id: 'gre_quant_geometry', tr: 'Geometry', en: 'Geometry' },
            { id: 'gre_quant_data', tr: 'Data Analysis', en: 'Data Analysis' },
          ],
        },
        {
          id: 'gre_writing', tr: 'Analytical Writing', en: 'Analytical Writing', weight: 1,
          topics: [
            { id: 'gre_writing_issue', tr: 'Issue Task', en: 'Issue Task' },
            { id: 'gre_writing_argument', tr: 'Argument Task', en: 'Argument Task' },
          ],
        },
      ],
    },
    {
      id: 'gmat',
      subjects: [
        {
          id: 'gmat_quant', tr: 'Quantitative', en: 'Quantitative', weight: 1,
          topics: [
            { id: 'gmat_quant_problem', tr: 'Problem Solving', en: 'Problem Solving' },
            { id: 'gmat_quant_sufficiency', tr: 'Data Sufficiency', en: 'Data Sufficiency' },
          ],
        },
        {
          id: 'gmat_verbal', tr: 'Verbal', en: 'Verbal', weight: 1,
          topics: [
            { id: 'gmat_verbal_critical', tr: 'Critical Reasoning', en: 'Critical Reasoning' },
            { id: 'gmat_verbal_reading', tr: 'Reading Comprehension', en: 'Reading Comprehension' },
            { id: 'gmat_verbal_sentence', tr: 'Sentence Correction', en: 'Sentence Correction' },
          ],
        },
        {
          id: 'gmat_data', tr: 'Data Insights', en: 'Data Insights', weight: 1,
          topics: [
            { id: 'gmat_data_multi', tr: 'Multi-Source Reasoning', en: 'Multi-Source Reasoning' },
            { id: 'gmat_data_table', tr: 'Table Analysis', en: 'Table Analysis' },
            { id: 'gmat_data_graphics', tr: 'Graphics Interpretation', en: 'Graphics Interpretation' },
          ],
        },
      ],
    },
    {
      id: 'msü',
      subjects: [
        {
          id: 'msu_turkce', tr: 'Türkçe', en: 'Turkish', weight: 1,
          topics: [
            { id: 'msu_turkce_paragraf', tr: 'Paragraf', en: 'Paragraph' },
            { id: 'msu_turkce_dilbilgisi', tr: 'Dil Bilgisi', en: 'Grammar' },
          ],
        },
        {
          id: 'msu_matematik', tr: 'Matematik', en: 'Math', weight: 1,
          topics: [
            { id: 'msu_mat_temel', tr: 'Temel Kavramlar', en: 'Basic Concepts' },
            { id: 'msu_mat_problem', tr: 'Problemler', en: 'Word Problems' },
          ],
        },
        {
          id: 'msu_fen', tr: 'Fen Bilimleri', en: 'Science', weight: 1,
          topics: [
            { id: 'msu_fen_fizik', tr: 'Fizik', en: 'Physics' },
            { id: 'msu_fen_kimya', tr: 'Kimya', en: 'Chemistry' },
            { id: 'msu_fen_biyoloji', tr: 'Biyoloji', en: 'Biology' },
          ],
        },
        {
          id: 'msu_sosyal', tr: 'Sosyal Bilimler', en: 'Social Sciences', weight: 1,
          topics: [
            { id: 'msu_sos_tarih', tr: 'Tarih', en: 'History' },
            { id: 'msu_sos_cografya', tr: 'Coğrafya', en: 'Geography' },
          ],
        },
      ],
    },
    {
      id: 'pmyo',
      subjects: [
        {
          id: 'pmyo_yetenek', tr: 'Genel Yetenek', en: 'General Aptitude', weight: 1,
          topics: [
            { id: 'pmyo_yetenek_sozel', tr: 'Sözel', en: 'Verbal' },
            { id: 'pmyo_yetenek_sayisal', tr: 'Sayısal', en: 'Quantitative' },
          ],
        },
        {
          id: 'pmyo_kultur', tr: 'Genel Kültür', en: 'General Knowledge', weight: 1,
          topics: [
            { id: 'pmyo_kultur_tarih', tr: 'Tarih', en: 'History' },
            { id: 'pmyo_kultur_cografya', tr: 'Coğrafya', en: 'Geography' },
            { id: 'pmyo_kultur_vatandaslik', tr: 'Vatandaşlık', en: 'Citizenship' },
            { id: 'pmyo_kultur_guncel', tr: 'Güncel Bilgiler', en: 'Current Affairs' },
          ],
        },
      ],
    },
    {
      id: 'oabt',
      subjects: [
        // Alan Bilgisi bilinçli olarak genel kaldı: ÖABT 20'den fazla ayrı branşta
        // ayrı içerik gerektiriyor (bkz. Dalga 3 dosya başlığı notu — AÖF'le aynı sebep).
        { id: 'oabt_alan', tr: 'Alan Bilgisi', en: 'Subject Knowledge', weight: 2 },
        {
          id: 'oabt_pedagoji', tr: 'Eğitim Bilimleri', en: 'Education Sciences', weight: 1,
          topics: [
            { id: 'oabt_pedagoji_gelisim', tr: 'Gelişim Psikolojisi', en: 'Developmental Psychology' },
            { id: 'oabt_pedagoji_ogrenme', tr: 'Öğrenme Psikolojisi', en: 'Learning Psychology' },
            { id: 'oabt_pedagoji_program', tr: 'Program Geliştirme', en: 'Curriculum Development' },
            { id: 'oabt_pedagoji_olcme', tr: 'Ölçme & Değerlendirme', en: 'Measurement & Evaluation' },
          ],
        },
      ],
    },
    { id: 'aof', subjects: [
      // Ders Bazlı Tekrar konu kırılımı EKLENMEDİ: AÖF her öğrencide farklı dersler
      // içerir, programa bağlıdır — evrensel bir liste "doğru" olmaz (bkz. dosya başlığı).
      { id: 'aof_ders', tr: 'Ders Bazlı Tekrar', en: 'Per-Course Review', weight: 1 },
    ] },
    {
      id: 'pte',
      subjects: [
        {
          id: 'pte_speaking', tr: 'Speaking & Writing', en: 'Speaking & Writing', weight: 1,
          topics: [
            { id: 'pte_speaking_readaloud', tr: 'Read Aloud', en: 'Read Aloud' },
            { id: 'pte_speaking_describe', tr: 'Describe Image', en: 'Describe Image' },
            { id: 'pte_speaking_retell', tr: 'Retell Lecture', en: 'Retell Lecture' },
            { id: 'pte_speaking_summarize', tr: 'Summarize Written Text', en: 'Summarize Written Text' },
          ],
        },
        {
          id: 'pte_reading', tr: 'Reading', en: 'Reading', weight: 1,
          topics: [
            { id: 'pte_reading_mcq', tr: 'Multiple Choice', en: 'Multiple Choice' },
            { id: 'pte_reading_reorder', tr: 'Reorder Paragraphs', en: 'Reorder Paragraphs' },
            { id: 'pte_reading_blanks', tr: 'Fill in the Blanks', en: 'Fill in the Blanks' },
          ],
        },
        {
          id: 'pte_listening', tr: 'Listening', en: 'Listening', weight: 1,
          topics: [
            { id: 'pte_listening_summarize', tr: 'Summarize Spoken Text', en: 'Summarize Spoken Text' },
            { id: 'pte_listening_blanks', tr: 'Fill in the Blanks', en: 'Fill in the Blanks' },
            { id: 'pte_listening_highlight', tr: 'Highlight Correct Summary', en: 'Highlight Correct Summary' },
          ],
        },
      ],
    },
    {
      id: 'bilsem',
      subjects: [
        {
          id: 'bilsem_sozel', tr: 'Sözel Yetenek', en: 'Verbal Aptitude', weight: 1,
          topics: [
            { id: 'bilsem_sozel_iliski', tr: 'Kelime İlişkileri', en: 'Word Relationships' },
            { id: 'bilsem_sozel_analoji', tr: 'Analoji', en: 'Analogy' },
            { id: 'bilsem_sozel_mantik', tr: 'Sözel Mantık', en: 'Verbal Logic' },
          ],
        },
        {
          id: 'bilsem_sayisal', tr: 'Sayısal / Mantık', en: 'Numerical / Logic', weight: 1,
          topics: [
            { id: 'bilsem_sayisal_oruntu', tr: 'Şekil-Örüntü', en: 'Shape Patterns' },
            { id: 'bilsem_sayisal_mantik', tr: 'Sayısal Mantık', en: 'Numerical Logic' },
            { id: 'bilsem_sayisal_uzamsal', tr: 'Görsel-Uzamsal Akıl Yürütme', en: 'Visual-Spatial Reasoning' },
          ],
        },
      ],
    },
    { id: 'katiplik', subjects: [
      // Klavye Hız & Doğruluk konu kırılımı EKLENMEDİ: bu bir BECERİ testi (hız/doğruluk
      // ölçümü), içerik konusu yok — ÖABT'nin Alan Bilgisi'yle aynı dürüstlük ilkesi.
      { id: 'katiplik_klavye', tr: 'Klavye Hız & Doğruluk', en: 'Typing Speed & Accuracy', weight: 2 },
      {
        id: 'katiplik_mevzuat', tr: 'Temel Mevzuat', en: 'Core Legislation', weight: 1,
        topics: [
          { id: 'katiplik_mevzuat_anayasa', tr: 'Anayasa', en: 'Constitution' },
          { id: 'katiplik_mevzuat_hmk', tr: 'HMK', en: 'Civil Procedure Law' },
          { id: 'katiplik_mevzuat_icra', tr: 'İcra Mevzuatı', en: 'Enforcement Legislation' },
        ],
      },
    ] },
    {
      id: 'kaymakamlik',
      subjects: [
        {
          id: 'kaymakamlik_anayasa', tr: 'Anayasa Hukuku', en: 'Constitutional Law', weight: 1,
          topics: [
            { id: 'kaymakamlik_anayasa_haklar', tr: 'Temel Haklar & Ödevler', en: 'Fundamental Rights & Duties' },
            { id: 'kaymakamlik_anayasa_organlar', tr: 'Yasama-Yürütme-Yargı', en: 'Legislature-Executive-Judiciary' },
          ],
        },
        {
          id: 'kaymakamlik_idare', tr: 'İdare Hukuku', en: 'Administrative Law', weight: 1,
          topics: [
            { id: 'kaymakamlik_idare_islem', tr: 'İdari İşlemler', en: 'Administrative Acts' },
            { id: 'kaymakamlik_idare_yargi', tr: 'İdari Yargı', en: 'Administrative Judiciary' },
          ],
        },
        {
          id: 'kaymakamlik_iktisat', tr: 'Türkiye İktisadı', en: 'Turkish Economy', weight: 1,
          topics: [
            { id: 'kaymakamlik_iktisat_makro', tr: 'Makroekonomi', en: 'Macroeconomics' },
            { id: 'kaymakamlik_iktisat_mikro', tr: 'Mikroekonomi', en: 'Microeconomics' },
            { id: 'kaymakamlik_iktisat_turkiye', tr: 'Türkiye Ekonomisi', en: 'Turkish Economy' },
          ],
        },
      ],
    },
    {
      id: 'icra',
      subjects: [
        {
          id: 'icra_icraiflas', tr: 'İcra-İflas Hukuku', en: 'Enforcement & Bankruptcy Law', weight: 2,
          topics: [
            { id: 'icra_icraiflas_ilamli', tr: 'İlamlı İcra', en: 'Enforcement with Judgment' },
            { id: 'icra_icraiflas_ilamsiz', tr: 'İlamsız İcra', en: 'Enforcement without Judgment' },
            { id: 'icra_icraiflas_iflas', tr: 'İflas', en: 'Bankruptcy' },
          ],
        },
        {
          id: 'icra_hmk', tr: 'HMK (Usul Hukuku)', en: 'Civil Procedure Law', weight: 1,
          topics: [
            { id: 'icra_hmk_sartlar', tr: 'Dava Şartları', en: 'Conditions for a Lawsuit' },
            { id: 'icra_hmk_usul', tr: 'Yargılama Usulü', en: 'Trial Procedure' },
          ],
        },
      ],
    },
    {
      id: 'smmm',
      subjects: [
        {
          id: 'smmm_muhasebe', tr: 'Finansal Muhasebe', en: 'Financial Accounting', weight: 2,
          topics: [
            { id: 'smmm_muhasebe_donen', tr: 'Dönen Varlıklar', en: 'Current Assets' },
            { id: 'smmm_muhasebe_duran', tr: 'Duran Varlıklar', en: 'Non-Current Assets' },
            { id: 'smmm_muhasebe_gelir', tr: 'Gelir Tablosu', en: 'Income Statement' },
          ],
        },
        {
          id: 'smmm_vergi', tr: 'Vergi Mevzuatı', en: 'Tax Law', weight: 1,
          topics: [
            { id: 'smmm_vergi_gelir', tr: 'Gelir Vergisi', en: 'Income Tax' },
            { id: 'smmm_vergi_kdv', tr: 'KDV', en: 'VAT' },
            { id: 'smmm_vergi_kurumlar', tr: 'Kurumlar Vergisi', en: 'Corporate Tax' },
          ],
        },
        {
          id: 'smmm_hukuk', tr: 'Ticaret & Borçlar Hukuku', en: 'Commercial & Obligations Law', weight: 1,
          topics: [
            { id: 'smmm_hukuk_borclar', tr: 'Borçlar Hukuku Genel', en: 'General Law of Obligations' },
            { id: 'smmm_hukuk_ticaret', tr: 'Ticaret Hukuku', en: 'Commercial Law' },
          ],
        },
      ],
    },
    {
      id: 'bekcilik',
      subjects: [
        {
          id: 'bekcilik_kultur', tr: 'Genel Kültür', en: 'General Knowledge', weight: 1,
          topics: [
            { id: 'bekcilik_kultur_tarih', tr: 'Tarih', en: 'History' },
            { id: 'bekcilik_kultur_cografya', tr: 'Coğrafya', en: 'Geography' },
            { id: 'bekcilik_kultur_guncel', tr: 'Güncel Bilgiler', en: 'Current Affairs' },
          ],
        },
        {
          id: 'bekcilik_mevzuat', tr: 'Mevzuat', en: 'Legislation', weight: 1,
          topics: [
            { id: 'bekcilik_mevzuat_anayasa', tr: 'Anayasa', en: 'Constitution' },
            { id: 'bekcilik_mevzuat_pvsk', tr: 'Polis Vazife ve Selahiyet', en: 'Police Duties & Powers' },
          ],
        },
        {
          id: 'bekcilik_turkce', tr: 'Türkçe', en: 'Turkish', weight: 1,
          topics: [
            { id: 'bekcilik_turkce_paragraf', tr: 'Paragraf', en: 'Paragraph' },
            { id: 'bekcilik_turkce_dilbilgisi', tr: 'Dil Bilgisi', en: 'Grammar' },
          ],
        },
      ],
    },
  ],
};

// Aktif manifest (baseline ile başlar; remote override edilebilir).
let activeManifest: CurriculumManifest = BASELINE_CURRICULUM;

/** Remote/güncel manifest'i uygula (yalnız sürüm daha yeniyse). Offline-first override. */
export function setCurriculum(next: CurriculumManifest | null | undefined): boolean {
  if (!next || !Array.isArray(next.exams) || typeof next.version !== 'number') return false;
  if (next.version <= activeManifest.version) return false;
  activeManifest = next;
  return true;
}

export function getActiveCurriculumVersion(): number {
  return activeManifest.version;
}

/** Sınav adından (kullanıcı girdisi) müfredatı bul. Bilinmiyorsa null. */
export function findExamCurriculum(examName: string): ExamCurriculum | null {
  if (!examName || !examName.trim()) return null;
  // Önce tam alias eşleşmesi, sonra fuzzy en iyi eşleşme.
  const preset = detectExamFromInput(examName) ?? matchExamName(examName)[0];
  if (!preset) return null;
  return activeManifest.exams.find(e => e.id === preset.id) ?? null;
}

/**
 * Bugünün konusunu seç — aralıklı tekrar mantığı:
 * 1) En uzun süredir çalışılmayan (hiç çalışılmamış = en öncelikli) konu.
 * 2) Eşitlikte ağırlığa göre deterministik tur (dayIndex ile) — yoğun dersler
 *    daha sık döner ama her ders kapsanır.
 *
 * `weakTopicIds` (opsiyonel): kullanıcının kendi-kendine zayıf işaretlediği KONU
 * id'leri (bkz. `pickTopic`). Bir dersin konularından biri bu listedeyse o ders
 * 2x ağırlık alır — yoksa zayıf konu yalnız "dersin sırası gelince hangi konuya
 * bakılacağını" etkiliyordu, dersin sırasının KENDİSİ hâlâ kör rotasyondaydı.
 * Ağırlık yalnız EŞİT-ESKİLİKTEKİ adaylar arasında tur belirlerken devreye girer
 * (pickTopic'teki aynı ilke) — "en uzun süredir çalışılmayan" adaleti bozulmaz.
 *
 * Saf fonksiyon: aynı girdi → aynı çıktı (test edilebilir).
 */
export function pickSubject(
  exam: ExamCurriculum,
  progress: Record<string, SubjectProgress>,
  dayIndex: number,
  weakTopicIds?: string[] | null,
): Subject | null {
  const subjects = exam.subjects;
  if (!subjects.length) return null;

  // En eski lastStudied'i bul (undefined = en eski/0).
  const lastTime = (s: Subject): number => {
    const ls = progress[s.id]?.lastStudied;
    if (!ls) return 0; // hiç çalışılmamış → en yüksek öncelik
    const t = new Date(ls).getTime();
    return Number.isNaN(t) ? 0 : t;
  };

  let oldest = Infinity;
  for (const s of subjects) oldest = Math.min(oldest, lastTime(s));
  // Eşik: en eski zamana "yakın" (aynı gün) olanlar aday.
  const oneDay = 86400000;
  const candidates = subjects.filter(s => lastTime(s) <= oldest + oneDay - 1);

  if (candidates.length === 1) return candidates[0];

  const weakSet = new Set(weakTopicIds ?? []);
  const hasWeakTopic = (s: Subject): boolean => (s.topics ?? []).some(t => weakSet.has(t.id));

  // Ağırlıklı deterministik tur: ağırlık kadar tekrarlanan diziden dayIndex ile seç.
  const expanded: Subject[] = [];
  for (const s of candidates) {
    const base = Math.max(1, Math.round(s.weight ?? 1));
    const w = hasWeakTopic(s) ? base * 2 : base;
    for (let i = 0; i < w; i++) expanded.push(s);
  }
  if (!expanded.length) return candidates[0];
  return expanded[((dayIndex % expanded.length) + expanded.length) % expanded.length];
}

/**
 * Seçilen dersin BUGÜNKÜ konusunu seçer — `pickSubject` ile AYNI rotasyon mantığı,
 * bir seviye aşağıda (ders → konu). Dersin `topics` listesi boşsa (henüz derinleştirilmemiş
 * sınav — bkz. dosya başındaki "dalga planı") `null` döner; çağıran taraf ders seviyesinde
 * kalır (`subjectExamLabel` konu olmadan da çalışır) — yani eksik veri hiçbir şeyi bozmaz.
 *
 * `weakTopicIds`: kullanıcının kendi kendine "zayıfım" dediği konular (bkz. ExamCard
 * zayıf-konu seçimi). Bu konuların ağırlığı ikiye katlanır — rehber hocanın "bugün
 * zayıf olduğun konuya bakalım" demesinin karşılığı. Boş/verilmezse salt rotasyon.
 */
export function pickTopic(
  subject: Subject,
  progress: Record<string, SubjectProgress>,
  dayIndex: number,
  weakTopicIds?: string[] | null,
): Topic | null {
  const topics = subject.topics;
  if (!topics || !topics.length) return null;

  const weakSet = new Set(weakTopicIds ?? []);
  const lastTime = (t: Topic): number => {
    const ls = progress[t.id]?.lastStudied;
    if (!ls) return 0;
    const parsed = new Date(ls).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  let oldest = Infinity;
  for (const t of topics) oldest = Math.min(oldest, lastTime(t));
  const oneDay = 86400000;
  const candidates = topics.filter(t => lastTime(t) <= oldest + oneDay - 1);

  if (candidates.length === 1) return candidates[0];

  const expanded: Topic[] = [];
  for (const t of candidates) {
    const base = Math.max(1, Math.round(t.weight ?? 1));
    const w = weakSet.has(t.id) ? base * 2 : base;
    for (let i = 0; i < w; i++) expanded.push(t);
  }
  if (!expanded.length) return candidates[0];
  return expanded[((dayIndex % expanded.length) + expanded.length) % expanded.length];
}

/**
 * Konuyu görev başlığına yerleştir: "KPSS — Türkçe" ya da (konu varsa)
 * "KPSS — Türkçe · Paragraf". `topic` opsiyonel — çağıran taraf `pickTopic`
 * `null` dönerse (henüz derinleştirilmemiş sınav) eski (ders-seviyesi) davranışı korur.
 */
/** UI için düzleştirilmiş konu listesi — zayıf-konu seçim ekranının tek veri kaynağı. */
export interface FlatTopic {
  id: string;
  tr: string;
  en: string;
  subjectTr: string;
  subjectEn: string;
}

export function listTopics(exam: ExamCurriculum): FlatTopic[] {
  const out: FlatTopic[] = [];
  for (const s of exam.subjects) {
    for (const t of s.topics ?? []) {
      out.push({ id: t.id, tr: t.tr, en: t.en, subjectTr: s.tr, subjectEn: s.en });
    }
  }
  return out;
}

export function subjectExamLabel(examName: string, subject: Subject, lang: 'tr' | 'en', topic?: Topic | null): string {
  const name = examName.trim();
  const subj = lang === 'tr' ? subject.tr : subject.en;
  const base = name ? `${name} — ${subj}` : subj;
  if (!topic) return base;
  const top = lang === 'tr' ? topic.tr : topic.en;
  return `${base} · ${top}`;
}
