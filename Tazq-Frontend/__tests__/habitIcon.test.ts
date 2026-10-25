import { suggestHabitIcon } from '@/features/habits/utils/habitIcon';

/**
 * YENİ ALIŞKANLIK — addan simge tahmini (2026-10-25, kullanıcı isteği). Ad yazıldıkça
 * en yakın simge kendiliğinden seçilir; kullanıcı elle değiştirirse bir daha karışılmaz
 * (bkz. NewHabitForm). Kelime = kök ya da kök + geçerli Türkçe ek (görev motorunun kuralı):
 * "su" kökü "sunum"a eşleşmez.
 */
describe('suggestHabitIcon', () => {
  it.each([
    ['Kitap oku', '📚'],
    ['Her gün 2 litre su iç', '💧'],
    ['Sabah koşusu', '🏃'],
    ['Meditasyon', '🧘'],
    ['Yoga yap', '🧘'],
    ['Erken uyu', '😴'],
    ['Vitamin al', '💊'],
    ['İngilizce kelime çalış', '🗣️'],
    ['Günlük yaz', '✍️'],
    ['Bisiklet sür', '🚴'],
    ['Spor salonuna git', '💪'],
    ['Odamı topla', '🧹'],
    ['Para biriktir', '💰'],
    ['Sigara içme', '🚭'],
    ['Gitar çal', '🎵'],
    ['Kod yaz', '💻'],
    ['Annemi ara', '👥'],
    ['Sebze ye', '🥗'],
  ])('%s → %s', (name, icon) => {
    expect(suggestHabitIcon(name, 'tr')).toBe(icon);
  });

  it.each([
    ['Read a book', '📚'],
    ['Drink water', '💧'],
    ['Morning run', '🏃'],
    ['Meditate', '🧘'],
    ['Go to the gym', '💪'],
  ])('EN: %s → %s', (name, icon) => {
    expect(suggestHabitIcon(name, 'en')).toBe(icon);
  });

  it('kelime içinde arama yok: "sunum" su değildir', () => {
    expect(suggestHabitIcon('Sunum hazırla', 'tr')).not.toBe('💧');
  });

  it('eşleşme yoksa null — mevcut seçim korunur', () => {
    expect(suggestHabitIcon('Xyz', 'tr')).toBeNull();
    expect(suggestHabitIcon('', 'tr')).toBeNull();
  });

  it('birden çok eşleşmede cümlede ÖNCE geçen kazanır', () => {
    expect(suggestHabitIcon('Koşudan sonra su iç', 'tr')).toBe('🏃');
  });
});

it('zaman sözcüğü yalnız başkası yoksa: "Erken kalk" → 🌅', () => {
  expect(suggestHabitIcon('Erken kalk', 'tr')).toBe('🌅');
});
