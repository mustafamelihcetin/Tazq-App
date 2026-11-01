import { understand, titleOf } from '@/features/tasks/nlp/understand';

const NOW = new Date(2026, 9, 25, 9, 0); // Pazar
const t = (s: string, lang: 'tr' | 'en' = 'tr') => titleOf(s, understand(s, lang, NOW));

describe('titleOf — alana aktarılan kısımlar başlıktan çıkar', () => {
  it.each([
    ['Sunumu bitir yarın 15:00 acil', 'Sunumu bitir'],
    ['yarın saat 15:00 annemi ara', 'Annemi ara'],
    ['Her pazartesi haftalık rapor', 'Haftalık rapor'],
    ['Faturayı öde 3 kasım', 'Faturayı öde'],
    ['Market alışverişi !!', 'Market alışverişi'],
  ])('%s → %s', (input, expected) => {
    expect(t(input)).toBe(expected);
  });

  it('baştaki tarih kesilince kalan başlık büyük harfle başlar (Türkçe i → İ dahil)', () => {
    expect(t('Yarın ev temizlenecek')).toBe('Ev temizlenecek');
    expect(t('yarın ilaç al')).toBe('İlaç al');
    expect(t('bugün 18:00 iPhone şarj et')).toBe('iPhone şarj et');
    expect(t('tomorrow at 3pm call mom', 'en')).toBe('Call mom');
    // Baş kesilmediyse kullanıcının yazdığına dokunulmaz.
    expect(t('ev temizlenecek yarın')).toBe('ev temizlenecek');
  });

  it('kategori kelimesi ve "hatırlat" başlıkta kalır', () => {
    expect(t('Spor salonuna git')).toBe('Spor salonuna git');
    expect(t('annemi aramayı hatırlat')).toBe('annemi aramayı hatırlat');
  });

  it('olumsuz öncelik başlıkta kalır', () => {
    expect(t('Kitap oku acil değil')).toBe('Kitap oku acil değil');
  });

  it('geriye bir şey kalmazsa cümle olduğu gibi', () => {
    expect(t('yarın')).toBe('yarın');
  });

  it('İngilizce', () => {
    expect(t('Call mom tomorrow at 3pm urgent', 'en')).toBe('Call mom');
    expect(t('remind me to call mom tomorrow', 'en')).toBe('remind me to call mom');
  });

  it('büyük harf ve Türkçe karakter korunur', () => {
    expect(t('İzmir biletini al yarın')).toBe('İzmir biletini al');
  });
});
