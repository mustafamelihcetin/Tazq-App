import { understand, type Lang } from '@/features/tasks/nlp/understand';
import { CATEGORY_TAGS, LEXICON } from '@/features/tasks/nlp/lexicon';
import { matchesTr } from '@/features/tasks/nlp/morph';
import { PLAN_TAGS } from '@/features/tasks/utils/taskBalancer';
import { isInternalTag } from '@/features/tasks/utils/taskTags';
import { toDateKey } from '@/shared/utils/dateKey';

/**
 * ANLAMA MOTORU — ALTIN TEST SETİ.
 *
 * Her satır bir cümle ve motorun o cümleden çıkarması gereken SONUCUN TAMAMI.
 * Yazılmayan alan BOŞ olmak zorunda: fazladan bir etiket, bir öncelik ya da bir saat
 * de hatadır. Motor deterministik olduğu için hedef %100 — yaklaşık doğruluk yok.
 *
 * ── BU DOSYAYA SATIR EKLERKEN ─────────────────────────────────────────────────
 * Sözlüğe kelime eklendiğinde buraya hem DOĞRU örneği hem de o kelimeyi İÇİNDE
 * taşıyan ama anlamı başka olan bir TUZAK örneği ekle ("kira" → "kiraz al").
 * Eski ayrıştırıcının bütün yanlışları tam olarak bu tuzaklardı.
 *
 * Sabit an: 19 Eylül 2026 CUMARTESİ, 10:00.
 */
const NOW = new Date(2026, 8, 19, 10, 0, 0);

type Row = {
  date?: string; time?: string; rec?: string; day?: number;
  pri?: 'Low' | 'High'; cat?: string; rem?: true; note?: true;
};

const run = (text: string, lang?: Lang): Row => {
  const u = understand(text, lang, NOW);
  const r: Row = {};
  if (u.dueDate) r.date = u.dueDate;
  if (u.dueTime) { const d = new Date(u.dueTime); r.time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }
  if (u.recurrence) r.rec = u.recurrence;
  if (u.recurrenceDay != null) r.day = u.recurrenceDay;
  if (u.priority && u.priority !== 'Medium') r.pri = u.priority;
  if (u.category) r.cat = u.category;
  if (u.reminder) r.rem = true;
  if (u.note) r.note = true;
  return r;
};

const TODAY = '2026-09-19';

const CORPUS: Array<[string, Row, Lang?]> = [
  // ── Tarih: göreli ────────────────────────────────────────────────────────
  ['bugün rapor bitir', { date: TODAY, cat: 'work' }],
  ['yarın annemi ara', { date: '2026-09-20' }],
  ['yarına kadar ödevi bitir', { date: '2026-09-20', cat: 'education' }],
  ['öbür gün kuaför', { date: '2026-09-21', cat: 'personal' }],
  ['yarından sonra bankaya git', { date: '2026-09-21', cat: 'finance' }],
  ['3 gün sonra ara', { date: '2026-09-22' }],
  ['iki hafta sonra sınav', { date: '2026-10-03', cat: 'education' }],
  ['bir ay sonra vergi', { date: '2026-10-19', cat: 'finance' }],
  ['haftaya toplantı', { date: '2026-09-26', cat: 'meeting' }],
  ['haftaya salı sunum', { date: '2026-09-22', cat: 'work' }],
  ['tomorrow buy milk', { date: '2026-09-20', cat: 'shopping' }, 'en'],
  ['in 3 days call the bank', { date: '2026-09-22', cat: 'finance' }, 'en'],
  ['next week project review', { date: '2026-09-26', cat: 'work' }, 'en'],
  ['day after tomorrow dentist', { date: '2026-09-21', cat: 'health' }, 'en'],

  // ── Tarih: haftanın günü (bugün CUMARTESİ) ───────────────────────────────
  ['pazartesi doktor', { date: '2026-09-21', cat: 'health' }],
  ['cuma günü market', { date: '2026-09-25', cat: 'shopping' }],
  ['cumaya kadar makale', { date: '2026-09-25', cat: 'education' }],
  ['cumartesi temizlik', { date: TODAY, cat: 'home' }],
  ['gelecek cuma parti', { date: '2026-09-25', cat: 'social' }],
  ['pazar günü piknik', { date: '2026-09-20', cat: 'social' }],
  ['pazar kahvaltı', { date: '2026-09-20' }],
  ['meet John on monday', { date: '2026-09-21' }, 'en'],

  // ── Tarih: takvim ────────────────────────────────────────────────────────
  ['25 eylül düğün', { date: '2026-09-25', cat: 'social' }],
  ['25 eylülde düğün', { date: '2026-09-25', cat: 'social' }],
  ['5 ocak vize başvurusu', { date: '2027-01-05' }],
  ['15/10 kira', { date: '2026-10-15', cat: 'finance' }],
  ['1.12.2026 sözleşme bitiyor', { date: '2026-12-01', cat: 'work' }],
  ['2026-11-03 aşı', { date: '2026-11-03', cat: 'health' }],
  ['september 30 invoice', { date: '2026-09-30', cat: 'finance' }, 'en'],
  ['oct 2nd wedding', { date: '2026-10-02', cat: 'social' }, 'en'],
  ['31 şubat', {}],

  // ── Saat ──────────────────────────────────────────────────────────────────
  ['yarın 15:00 toplantı', { date: '2026-09-20', time: '15:00', cat: 'meeting' }],
  ['15.30 berber', { time: '15:30', cat: 'personal' }],
  ['saat 9 ders', { time: '09:00', cat: 'education' }],
  ['saat 3 toplantı', { time: '15:00', cat: 'meeting' }],
  ["3'te toplantı", { time: '15:00', cat: 'meeting' }],
  ["8'de kalk", { time: '08:00' }],
  ['sabah 7 yoga', { time: '07:00', cat: 'fitness' }],
  ["sabah 6'da koşu", { time: '06:00', cat: 'fitness' }],
  ['akşam 8 sinema', { time: '20:00', cat: 'social' }],
  ['gece 11 ilaç', { time: '23:00', cat: 'health' }],
  ['gece 2 deploy', { time: '02:00', cat: 'dev' }],
  ['öğleden sonra 3 mülakat', { time: '15:00', cat: 'meeting' }],
  ['öğlen ara', { time: '12:00' }],
  ['05:30 uyan', { time: '05:30' }],
  ["bu akşam 8'de sinema", { date: TODAY, time: '20:00', cat: 'social' }],
  ['yarın akşam 7 buluşma', { date: '2026-09-20', time: '19:00', cat: 'social' }],
  ['dentist friday 10am', { date: '2026-09-25', time: '10:00', cat: 'health' }, 'en'],
  ['call mom at 9pm', { time: '21:00' }, 'en'],
  ['standup 7:30 pm', { time: '19:30', cat: 'meeting' }, 'en'],
  ['meeting at 3', { time: '15:00', cat: 'meeting' }, 'en'],
  ['lunch at noon', { time: '12:00' }, 'en'],

  // ── Para / birim SAAT DEĞİLDİR ────────────────────────────────────────────
  ['12.50 TL kahve', {}],
  ['kira 15.000 TL', { cat: 'finance' }],
  ['2 kg peynir', { cat: 'shopping' }],
  ['$5 coffee', {}, 'en'],
  ['25.09.2026 son gün', { date: '2026-09-25' }],

  // ── Tekrar ────────────────────────────────────────────────────────────────
  ['her gün su iç', { rec: 'Daily', cat: 'health' }],
  ['her sabah yürüyüş', { rec: 'Daily', cat: 'fitness' }],
  ['her salı spor', { rec: 'Weekly', day: 2, date: '2026-09-22', cat: 'fitness' }],
  ['her cumartesi temizlik', { rec: 'Weekly', day: 6, date: TODAY, cat: 'home' }],
  ['her pazar dinlenme', { rec: 'Weekly', day: 0, date: '2026-09-20' }],
  ["her ayın 15'i kira öde", { rec: 'Monthly', date: '2026-10-15', cat: 'finance' }],
  ["her ayın 30'unda Kyk ödemesi var", { rec: 'Monthly', date: '2026-09-30', cat: 'finance' }],
  ['iki günde bir çiçek sula', { rec: 'None', date: TODAY }],
  ['gün aşırı koşu', { rec: 'None', date: TODAY, cat: 'fitness' }],
  ['every monday gym', { rec: 'Weekly', day: 1, date: '2026-09-21', cat: 'fitness' }, 'en'],
  ['every 2 weeks haircut', { rec: 'None', date: TODAY, cat: 'personal' }, 'en'],
  ['weekly report', { rec: 'Weekly', cat: 'work' }, 'en'],
  ['aylık bütçe kontrolü', { rec: 'Monthly', cat: 'finance' }],
  ['pay rent every month on the 1st', { rec: 'Monthly', date: '2026-10-01', cat: 'finance' }, 'en'],

  // ── Öncelik: yalnız AÇIK kanıt ────────────────────────────────────────────
  ['acil rapor hazırla', { pri: 'High', cat: 'work' }],
  ['acilen bankayı ara', { pri: 'High', cat: 'finance' }],
  ['çok önemli fatura', { pri: 'High', cat: 'finance' }],
  ['urgent meeting preparation', { pri: 'High', cat: 'meeting' }, 'en'],
  ['sunumu bitir!!', { pri: 'High', cat: 'work' }],
  ['acil değil ama bak', { pri: 'Low' }],
  ['not urgent', { pri: 'Low' }, 'en'],
  ['acelesi yok kitap oku', { pri: 'Low' }],
  ['sonra halledebilirim bunu', { pri: 'Low' }],
  ['daha sonra bak', { pri: 'Low' }],
  ['yemekten sonra ilaç iç', { cat: 'health' }],
  ['öğleden sonra ara', {}],
  ['toplantı', { cat: 'meeting' }],

  // ── Kategori: TUZAKLAR (eski motorun yanlışları) ─────────────────────────
  ['kiraz al', {}],
  ['koşulları oku', {}],
  ['sütunları düzenle', {}],
  ['transport ayarla', {}],
  ['adresi gönder', {}],
  ['evrakları hazırla', {}],
  ['eve git', {}],
  ['indirim kodunu gir', {}],
  ['pazara git', {}],
  ['pazardan sebze al', { cat: 'shopping' }],
  ['çöpü at 3 kere', {}],
  ['sunum hazırla', { cat: 'work' }],
  ['annemi ara', {}],
  ['call her tomorrow', { date: '2026-09-20' }],

  // ── Kategori: doğru eşleşmeler, Türkçe çekimleriyle ──────────────────────
  ['kod yaz backend için', { cat: 'dev' }],
  ['bugün bug fix', { date: TODAY, cat: 'dev' }, 'en'],
  ['İlaç al', { cat: 'health' }],
  ['İLAÇ AL', { cat: 'health' }],
  ['ilacını al', { cat: 'health' }],
  ['faturaları öde', { cat: 'finance' }],
  ['doktor randevusu', { cat: 'health' }],
  ['kuaför randevusu', { cat: 'personal' }],
  ['market alışverişi', { cat: 'shopping' }],
  ['maaş yattı mı kontrol et', { cat: 'finance' }],
  ['doğum günü hediyesi', { cat: 'social' }],
  ['cilt bakımı', { cat: 'personal' }],
  ['çamaşırları as', { cat: 'home' }],
  ['arkadaşımla kahve', { cat: 'social' }],
  ['toplantıya hazırlan', { cat: 'meeting' }],
  ['müşteriye e-posta at', { cat: 'work' }],
  ["gym'e git", { cat: 'fitness' }],
  ['finish slides for client', { cat: 'work' }, 'en'],
  ['pay the rent', { cat: 'finance' }, 'en'],
  ['buy groceries', { cat: 'shopping' }, 'en'],
  ['PAY INVOICE', { cat: 'finance' }],

  // ── Hatırlatma ve not ─────────────────────────────────────────────────────
  ["yarın 9'da ilacı hatırlat", { date: '2026-09-20', time: '09:00', cat: 'health', rem: true }],
  ['remind me to call mom at 5', { time: '17:00', rem: true }, 'en'],
  ['Not: wifi şifresi değişti', { note: true }],
];

describe('Anlama Motoru — altın test seti', () => {
  // Tek dizi parametresi: dil sütunu olmayan satırda Jest fazladan parametreyi `done`
  // geri çağrısı sanıp 5 sn beklerdi.
  it.each(CORPUS)('%s', (...[text, expected, lang]: [string, Row, Lang?]) => {
    expect(run(text, lang)).toEqual(expected);
  });

  it('set anlamlı büyüklükte — kapsam zamanla küçülmesin', () => {
    expect(CORPUS.length).toBeGreaterThanOrEqual(120);
  });
});

describe('sözlük hijyeni', () => {
  it('kategori etiketleri SİSTEM ya da PLAN etiketi değil — görev gizlenmesin, Zen onu plan sanmasın', () => {
    // Eskiden Türkçe spor işine "spor" yazılıyordu: Spor modunun iç etiketi.
    for (const { tr, en } of Object.values(CATEGORY_TAGS)) {
      for (const tag of [tr, en]) {
        expect(PLAN_TAGS).not.toContain(tag);
        expect(isInternalTag(tag)).toBe(false);
      }
    }
  });

  it('hiçbir kelime iki kategoride birden yok', () => {
    const seen = new Map<string, string>();
    for (const [cat, e] of Object.entries(LEXICON)) {
      for (const w of [...e.tr, ...e.en, ...(e.phrases ?? []), ...(e.exact ?? [])]) {
        const key = w;
        if (seen.has(key) && seen.get(key) !== cat) throw new Error(`"${w}": ${seen.get(key)} ve ${cat}`);
        seen.set(key, cat);
      }
    }
  });

  it('sık kullanılan Türkçe kelimeler HİÇBİR sözlük kökünün çekimi sayılmıyor', () => {
    /*
      Ek kümesi geniş olduğu için bir kökün + geçerli ekin tesadüfen başka bir kelime
      yazması mümkün ("bug" + "ün" = "bugün"). Bu liste o çakışmaları yakalar: yeni
      bir kök eklendiğinde bu kelimelerden biri onun çekimi gibi görünürse test kırılır.
    */
    const COMMON = ['bugün', 'yarın', 'sonra', 'için', 'gibi', 'kadar', 'bunu', 'şunu', 'onu', 'bana', 'sana', 'daha',
      'evet', 'hayır', 'önce', 'saat', 'akşam', 'sabah', 'gece', 'hafta', 'ayın', 'gün', 'kere', 'defa', 'tane',
      'kiraz', 'koşul', 'sütun', 'sunum', 'susam', 'evrak', 'evren', 'kodes', 'adres', 'dersim', 'transfer'];
    const hits: string[] = [];
    for (const [cat, e] of Object.entries(LEXICON)) {
      for (const w of COMMON) {
        if (e.except?.some((x) => w.startsWith(x))) continue;
        for (const l of e.tr) if (l !== w && matchesTr(w, l) && !(cat === 'work' && w === 'sunum' && l === 'sunum')) hits.push(`${w} ← ${l} (${cat})`);
      }
    }
    // "dersim" = ders + im (benim dersim) doğru bir çekim — tuzak değil.
    expect(hits.filter((h) => !h.startsWith('dersim'))).toEqual([]);
  });

  it('saatler YEREL — tarih anahtarı ile saat aynı güne düşer', () => {
    const u = understand('yarın 23:30 kargo', 'tr', NOW);
    expect(toDateKey(new Date(u.dueTime!))).toBe(u.dueDate);
  });
});
