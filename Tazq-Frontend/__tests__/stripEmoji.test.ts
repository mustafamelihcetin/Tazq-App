/**
 * Madde 2 — emoji arındırma, GÖSTERİMDE. Modların eskiden ürettiği görev başlıkları
 * kullanıcı verisinde emojiyle kayıtlı; veri değiştirilmez (geri dönüşsüz yazım yok),
 * ekrana çizilmez. Tipografik işaretler (✓ ✦ ➔ ★) emoji değil, korunur.
 */
import { stripEmoji } from '@/shared/utils/emoji';

describe('stripEmoji', () => {
  it.each([
    ['💪 Güç & Kas', 'Güç & Kas'],
    ['Su iç 💧', 'Su iç'],
    ['⚖️ Tartıl', 'Tartıl'],          // değişim seçicili (FE0F)
    ['🏃‍♂️ Koşu', 'Koşu'],             // ZWJ dizisi
    ['🇹🇷 Bayrak', 'Bayrak'],          // bölgesel gösterge çifti
    ['🎉 5. gün! Seriyi koru', '5. gün! Seriyi koru'],
    ['Okuma  📚  saati', 'Okuma saati'], // ortadaki emoji çift boşluk bırakmaz
  ])('%s → %s', (input, out) => {
    expect(stripEmoji(input)).toBe(out);
  });

  it('tipografik işaretler korunur', () => {
    expect(stripEmoji('✓ Görev tamamlandı ✦')).toBe('✓ Görev tamamlandı ✦');
    expect(stripEmoji('Konu Tarama ➔ Sprint · ★ 4.8')).toBe('Konu Tarama ➔ Sprint · ★ 4.8');
  });

  it('Türkçe harfler ve rakamlar dokunulmaz', () => {
    expect(stripEmoji('Çalış: ğüşiöç İĞÜŞÖÇ 2026')).toBe('Çalış: ğüşiöç İĞÜŞÖÇ 2026');
  });

  it('yalnız emojiden oluşan metin boş kalmaz — dokunulmadan döner', () => {
    expect(stripEmoji('💧')).toBe('💧');
  });

  it('boş/undefined güvenli', () => {
    expect(stripEmoji('')).toBe('');
    expect(stripEmoji(undefined as unknown as string)).toBe('');
  });
});
