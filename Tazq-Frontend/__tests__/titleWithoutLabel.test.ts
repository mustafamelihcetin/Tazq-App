import { titleWithoutLabel } from '@/features/tasks/utils/displayTitle';

/**
 * GÖREV SATIRINDA BAŞLIK TEKRARI (2026-10-31, cihazda görüldü).
 *
 * Mod görevleri "${ad} — …" / "${ad}: …" diye üretiliyor ve satırın alt satırı aynı adı zaten
 * renkli yazıyor. Tek satıra kısalan başlıkta işin KENDİSİ ("bir bölümü revize et") hiç
 * görünmüyordu: "DenemeProje — Literatür Taraması: y…". Ön ek yalnız GÖRÜNTÜDE düşer.
 */
describe('titleWithoutLabel', () => {
  it('alt satırdaki ad + ayırıcıyla başlayan başlıktan ön eki düşürür', () => {
    expect(titleWithoutLabel('DenemeProje — Literatür Taraması: bölümü revize et', 'DenemeProje'))
      .toBe('Literatür Taraması: bölümü revize et');
    expect(titleWithoutLabel('DenemeProje: bu hafta ne tamamladın?', 'DenemeProje'))
      .toBe('Bu hafta ne tamamladın?');
    expect(titleWithoutLabel('KPSS · deneme sınavı', 'KPSS')).toBe('Deneme sınavı');
  });

  it('kalan cümle büyük harfle başlar — Türkçe kuralla (i → İ)', () => {
    // Cihazda görüldü: ön ek gidince "bu hafta ne tamamladın?" küçük harfle başlıyordu.
    expect(titleWithoutLabel('DenemeProje: ilerlemeyi kaydet', 'DenemeProje')).toBe('İlerlemeyi kaydet');
    expect(titleWithoutLabel('Plan — 3 sayfa oku', 'Plan')).toBe('3 sayfa oku');
  });

  it('İngilizcede Türkçe kural uygulanmaz ("item" → "Item", "İtem" değil)', () => {
    expect(titleWithoutLabel('Thesis: items to review', 'Thesis', false)).toBe('Items to review');
  });

  it('Türkçe büyük/küçük harf farkını tanır (İ/i, I/ı)', () => {
    expect(titleWithoutLabel('İNGİLİZCE: kelime tekrarı', 'İngilizce')).toBe('Kelime tekrarı');
  });

  it('ayırıcı yoksa dokunmaz (ad başka bir kelimenin başı olabilir)', () => {
    expect(titleWithoutLabel('DenemeProjesi için kaynak bul', 'DenemeProje')).toBe('DenemeProjesi için kaynak bul');
    expect(titleWithoutLabel('Sınav günü', 'Sınav')).toBe('Sınav günü');
  });

  it('geriye bir şey kalmayacaksa ya da etiket yoksa başlığı aynen bırakır', () => {
    expect(titleWithoutLabel('DenemeProje: ', 'DenemeProje')).toBe('DenemeProje: ');
    expect(titleWithoutLabel('Rapor yaz', null)).toBe('Rapor yaz');
    expect(titleWithoutLabel('Rapor yaz', '')).toBe('Rapor yaz');
  });
});
