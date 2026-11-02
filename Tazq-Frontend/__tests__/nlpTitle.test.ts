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
    // Başlık düzenlendiyse (sondan kesim de olsa) büyük harfle başlar (2026-11-02); hiç dokunulmayan başlık aynen kalır.
    expect(t('ev temizlenecek yarın')).toBe('Ev temizlenecek');
    expect(t('market listesi')).toBe('market listesi');
  });

  // 2026-11-02 — tarih silinince kalan yarım parçalar (kullanıcı: "…görevidir yarın yapılacak" → "…görevidir yapılacak").
  it.each([
    ['bu bir test 2 görevidir yarın yapılacak', 'Bu bir test 2 görevidir'],
    ['yarın için sunum hazırla', 'Sunum hazırla'],
    ['yarın raporu gönder', 'Raporu gönder'],
    ['raporu yarın gönder', 'Raporu gönder'],
    ['toplantıyı yarın Ali ile yap', 'Toplantıyı Ali ile yap'],
    ['yarın sabah 9da dişçi', 'Dişçi'],
    ['annemi ara yarın', 'Annemi ara'],
    ['yarın yapılacaklar listesini hazırla', 'Yapılacaklar listesini hazırla'],
    ['cuma günü teslim edilecek ödev', 'Teslim edilecek ödev'],
    ['haftaya pazartesi kira ödenecek', 'Kira ödenecek'],
    ['yarınki toplantı notlarını çıkar', 'Toplantı notlarını çıkar'],
    ['Yarın Gelecek filmini izle', 'Gelecek filmini izle'],
    ['akşam 8de yarın spor yapılacak', 'Spor yapılacak'],
    ['faturayı 15 kasımda öde', 'Faturayı öde'],
    ['yarın', 'yarın'],
  ])('yarım parça temizliği: %s → %s', (input, expected) => {
    expect(t(input)).toBe(expected);
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
    expect(t('remind me to call mom tomorrow', 'en')).toBe('Remind me to call mom');
  });

  it('büyük harf ve Türkçe karakter korunur', () => {
    expect(t('İzmir biletini al yarın')).toBe('İzmir biletini al');
  });
});
