/**
 * ANLAMA SÖZLÜĞÜ — hangi kelime hangi kategoriye işaret eder.
 *
 * ── KURALLAR (bu dosyaya kelime eklerken) ─────────────────────────────────────
 *  1. HER KELİME TEK KATEGORİ. "randevu" (doktor mu kuaför mü?), "telefon", "bakım",
 *     "görüşme" gibi bağlamı olmadan anlamı belirsiz kelimeler BİLEREK YOK. Doğru
 *     etiket, yanlış etiketten iyidir; hiç etiket, yanlış etiketten iyidir.
 *  2. KISA ve ÇOK ANLAMLI kökler YOK: "su" (sunum, susam), "ev" ("eve git" bir yer,
 *     ev işi değil). Kısa kök gerekiyorsa ifade olarak ("su iç") ya da yalnız
 *     çekimsiz hâliyle (`exact`: "kod yaz" evet, "indirim kodu" hayır) yazılır.
 *  3. EŞ YAZIMLI çekimler `except` ile dışlanır: "süt" + "un" = "sütun".
 *  4. Kelimeler KÜÇÜK HARF ve TÜRKÇE KURALIYLA yazılır (İ → i, I → ı).
 *  5. Yeni kelime → altın test setine (nlpCorpus.test) hem doğru hem YANLIŞ örnek.
 *
 * Etiket adları sistem (mod/plan) etiketleriyle ÇAKIŞMAZ. Eskiden Türkçe spor işine
 * "spor" etiketi yazılıyordu; "spor" Spor MODUNUN iç etiketi: görev kullanıcıdan
 * gizleniyor ve Zen onu plan görevi sanıp hiç dokunmuyordu (bkz. nlpCorpus.test).
 */

export type CategoryId =
  | 'meeting' | 'dev' | 'work' | 'health' | 'fitness' | 'finance'
  | 'shopping' | 'education' | 'home' | 'social' | 'personal';

/** Kategori → kaydedilen etiket (arayüz dilinde). */
export const CATEGORY_TAGS: Record<CategoryId, { tr: string; en: string }> = {
  meeting:   { tr: 'toplantı',   en: 'meeting' },
  dev:       { tr: 'geliştirme', en: 'dev' },
  work:      { tr: 'iş',         en: 'work' },
  health:    { tr: 'sağlık',     en: 'health' },
  fitness:   { tr: 'egzersiz',   en: 'fitness' },
  finance:   { tr: 'finans',     en: 'finance' },
  shopping:  { tr: 'alışveriş',  en: 'shopping' },
  education: { tr: 'eğitim',     en: 'education' },
  home:      { tr: 'ev',         en: 'home' },
  social:    { tr: 'sosyal',     en: 'social' },
  personal:  { tr: 'kişisel',    en: 'personal' },
};

export interface LexiconEntry {
  /** Türkçe kökler — çekimleriyle tanınır (bkz. morph.matchesTr). */
  tr: string[];
  /** İngilizce kökler — çoğul/iyelik biçimleriyle tanınır. */
  en: string[];
  /** Çok kelimeli ifadeler; son kelime Türkçe ek alabilir. */
  phrases?: string[];
  /** Bu önekle başlayan kelimeler bu kategoriye SAYILMAZ (eş yazımlılar). */
  except?: string[];
  /** Yalnız ÇEKİMSİZ tanınan kökler: "kod yaz" evet, "indirim kodu" hayır. */
  exact?: string[];
}

export const LEXICON: Record<CategoryId, LexiconEntry> = {
  meeting: {
    tr: ['toplantı', 'mülakat'],
    en: ['meeting', 'standup', 'interview'],
    phrases: ['iş görüşmesi'],
  },
  dev: {
    tr: ['kodlama', 'yazılım', 'backend', 'frontend', 'deploy', 'refactor'],
    en: ['code', 'coding', 'backend', 'frontend', 'deploy', 'bug', 'refactor', 'debug'],
    exact: ['kod'],
  },
  work: {
    tr: ['rapor', 'sunum', 'proje', 'müşteri', 'sözleşme', 'mesai', 'ofis', 'şirket', 'mail'],
    en: ['report', 'presentation', 'project', 'client', 'customer', 'contract', 'office', 'deadline', 'email', 'slides', 'proposal'],
    phrases: ['e-posta', 'e-mail'],
  },
  health: {
    tr: ['doktor', 'hastane', 'ilaç', 'eczane', 'tahlil', 'muayene', 'dişçi', 'aşı', 'reçete', 'tedavi',
      'terapi', 'psikolog', 'ameliyat', 'fizyoterapi', 'diyetisyen', 'vitamin', 'hekim', 'klinik'],
    en: ['doctor', 'hospital', 'pharmacy', 'medicine', 'meds', 'pill', 'dentist', 'therapy', 'therapist',
      'vaccine', 'checkup', 'prescription', 'physio', 'vitamin', 'clinic'],
    phrases: ['su iç', 'drink water'],
  },
  fitness: {
    tr: ['spor', 'antrenman', 'idman', 'egzersiz', 'yoga', 'pilates', 'koşu', 'yürüyüş', 'yüzme', 'fitness', 'gym', 'kardiyo'],
    en: ['gym', 'workout', 'exercise', 'yoga', 'pilates', 'jogging', 'running', 'swimming', 'cardio', 'fitness'],
  },
  finance: {
    tr: ['fatura', 'kira', 'ödeme', 'borç', 'kredi', 'taksit', 'vergi', 'maaş', 'banka', 'iban', 'havale',
      'eft', 'aidat', 'sigorta', 'dekont', 'bütçe', 'harcama'],
    en: ['bill', 'rent', 'payment', 'tax', 'loan', 'salary', 'bank', 'invoice', 'insurance', 'budget', 'mortgage'],
  },
  shopping: {
    tr: ['market', 'alışveriş', 'bakkal', 'manav', 'kasap', 'sipariş', 'kargo', 'mağaza', 'ekmek', 'süt',
      'yumurta', 'sebze', 'meyve', 'deterjan', 'peynir'],
    en: ['grocery', 'groceries', 'supermarket', 'shopping', 'milk', 'bread', 'eggs'],
    except: ['sütun'],
  },
  education: {
    tr: ['ders', 'sınav', 'ödev', 'kurs', 'okul', 'üniversite', 'makale', 'kütüphane', 'etüt', 'quiz', 'seminer'],
    en: ['homework', 'exam', 'class', 'course', 'lecture', 'study', 'studying', 'thesis', 'assignment', 'quiz', 'school', 'university', 'seminar'],
  },
  home: {
    tr: ['temizlik', 'çamaşır', 'bulaşık', 'ütü', 'tadilat', 'süpürge'],
    en: ['laundry', 'dishes', 'vacuum', 'chores', 'housework'],
    phrases: ['toz al'],
  },
  social: {
    tr: ['düğün', 'nişan', 'parti', 'buluşma', 'misafir', 'davet', 'konser', 'sinema', 'tiyatro', 'piknik', 'arkadaş'],
    en: ['birthday', 'wedding', 'party', 'concert', 'cinema', 'theater', 'theatre', 'picnic', 'friends'],
    phrases: ['doğum günü'],
  },
  personal: {
    tr: ['kuaför', 'berber', 'manikür', 'pedikür'],
    en: ['haircut', 'barber', 'hairdresser', 'manicure', 'pedicure'],
    phrases: ['cilt bakımı'],
  },
};
