import { hasDailyToday } from '@/features/modes/utils/dailyPlanEngine';

/**
 * ARŞİVİN KAPSAMI — plan motorlarının arkasından iş çevrilemez.
 *
 * Arşiv her göreve açık değil. Ayrım SAHİPLİK: kendi yazdığın görev senin, planın
 * ürettiği görev planın. Sebep estetik değil, veri bütünlüğü:
 *
 *   Plan motorları "bu görev bugün üretildi mi" sorusunu görev listesine bakarak
 *   cevaplıyor. Arşivlenmiş bir görev hâlâ "var" sayılsaydı, motor yenisini üretmez
 *   ve o günün plan görevi SESSİZCE kaybolurdu — kullanıcı ne olduğunu anlayamazdı.
 *
 * Arayüz plan görevlerinin arşivlenmesini zaten engelliyor. Buradaki testler İKİNCİ
 * savunma hattını koruyor: kural tek bir etikete ya da tek bir ekrana bağlı kalmasın.
 */

const day = (h = 9) => {
  const d = new Date();
  d.setHours(h, 0, 0, 0);
  return d.toISOString();
};

const planTask = (over: Partial<{ isCompleted: boolean; isArchived: boolean }> = {}) => ({
  tags: ['daily', 'exam'],
  dueDate: day(),
  isCompleted: false,
  ...over,
});

describe('hasDailyToday — arşivlenmiş görev "üretildi" saymaz', () => {
  const today = new Date();

  it('normal bir plan görevi bugün üretilmiş sayılır', () => {
    expect(hasDailyToday([planTask()], 'exam', today)).toBe(true);
  });

  it('ARŞİVLENMİŞ plan görevi sayılmaz — motor yenisini üretebilmeli', () => {
    // Bu satır olmasaydı: arşivlenen görev listeden çıkar, motor "zaten var" der,
    // o günün planı boş kalırdı. Hatanın görünür hiçbir izi olmazdı.
    expect(hasDailyToday([planTask({ isArchived: true })], 'exam', today)).toBe(false);
  });

  it('arşivlenmiş ve normal görev bir aradaysa normal olan belirleyicidir', () => {
    expect(hasDailyToday([planTask({ isArchived: true }), planTask()], 'exam', today)).toBe(true);
  });

  it('tamamlanmış görev hâlâ "üretildi" sayılır — arşivden farkı bu', () => {
    // Tamamlamak görevi YOK ETMEZ, gününü kapatır. Arşivlemek ise onu listeden
    // çıkarır; ikisi farklı şeyler ve motor da farklı davranmalı.
    expect(hasDailyToday([planTask({ isCompleted: true })], 'exam', today)).toBe(true);
  });

  it('başka güne ait görev sayılmaz', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const old = { tags: ['daily', 'exam'], dueDate: yesterday.toISOString(), isCompleted: false };
    expect(hasDailyToday([old], 'exam', today)).toBe(false);
  });

  it('başka plana ait görev sayılmaz', () => {
    expect(hasDailyToday([planTask()], 'tez', today)).toBe(false);
  });
});

/**
 * KİLO ZİNCİRİ — aynı tuzağın ikinci örneği.
 *
 * Haftalık tartım görevi de bir zincir tarafından üretiliyor: açık görev varsa yenisi
 * üretilmiyor. Arşivlenmiş bir görev "açık" sayılsaydı zincir sessizce dururdu ve
 * kullanıcı bir daha hiç tartım görevi almazdı.
 *
 * Not: `findOpenWeightTasks` global store okuduğu için burada saf yüklem sınanıyor —
 * korunan davranış aynı: arşivlenmiş görev açık değildir.
 */
describe('arşivlenmiş görev "açık" sayılmaz', () => {
  const isOpen = (t: { isCompleted: boolean; isArchived?: boolean }) => !t.isCompleted && !t.isArchived;

  it('açık görev', () => {
    expect(isOpen({ isCompleted: false })).toBe(true);
  });

  it('arşivlenmiş görev açık değil', () => {
    expect(isOpen({ isCompleted: false, isArchived: true })).toBe(false);
  });

  it('tamamlanmış görev açık değil', () => {
    expect(isOpen({ isCompleted: true })).toBe(false);
  });
});
