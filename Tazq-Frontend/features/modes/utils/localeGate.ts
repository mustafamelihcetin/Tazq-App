/**
 * TÜRKİYE'YE ÖZEL DÖNEMSEL MODLARIN DİL KAPISI.
 *
 * ── ÖLÇÜLEN SORUN ─────────────────────────────────────────────────────────────
 * YKS, KPSS ve Ramazan TAKVİME göre kendiliğinden devreye giren modlar. Ama devreye
 * girme kararı yalnız tarihe bakıyordu, kullanıcının diline değil. Sonuç: arayüzü
 * İngilizce olan bir kullanıcı Haziran'da "YKS Hazırlığı" bandını, ilkbaharda
 * Ramazan önerisini görüyordu — kendisi için hiçbir anlam taşımayan, çoğu zaman hiç
 * duymadığı dönemler.
 *
 * Uygulamanın İÇERİĞİ Türkiye'ye özel, ARAYÜZÜ iki dilli. Bu ikisi karışınca ürün
 * hem TR kullanıcısına eksik hem EN kullanıcısına alakasız görünüyor.
 *
 * ── KAPININ SINIRI ────────────────────────────────────────────────────────────
 * Yalnız TAKVİME BAĞLI, ülkeye özel dönemleri kapsar: YKS · KPSS · Ramazan.
 *
 * DIŞINDA kalanlar (her dilde açık):
 *   · evrensel modlar — spor, tasarruf, tez, mülakat, sigara bırakma
 *   · kullanıcının KENDİ adını yazdığı genel "Sınav Takibi" modu
 * Bunlar Türkiye'ye özel değil, yalnızca burada da kullanılıyor.
 *
 * ── DİL, ÜLKE YERİNE GEÇİYOR ──────────────────────────────────────────────────
 * Cihazın bölgesine değil kullanıcının SEÇTİĞİ dile bakılıyor. Yurt dışındaki bir
 * öğrenci uygulamayı Türkçe kullanıyorsa YKS onu ilgilendirir; Türkiye'deki biri
 * İngilizce kullanmayı seçtiyse ilgilendirmez. Bölge kodu bu soruyu yanlış cevaplar.
 *
 * ── AYRI DOSYA, ÇÜNKÜ ─────────────────────────────────────────────────────────
 * turkishModes.ts uygulamanın en büyük dosyası (~2800 satır) ve saf veri/hesap
 * katmanı. Bir store'a bağımlılık oraya ait değil; burada duruyor ve dinamik
 * `require` ile alınıyor, böylece testler veri katmanını store'u kurmadan içe
 * alabiliyor.
 *
 * Bkz. __tests__/localeSeasonalModes.test.ts
 */
export function isTurkeySeasonalEnabled(): boolean {
  try {
    const { useLanguageStore } = require('@/shared/store/useLanguageStore');
    return useLanguageStore.getState().language === 'tr';
  } catch {
    // Dil okunamadıysa MEVCUT davranışı koru. Sessizce özellik kapatmak, hatanın
    // kullanıcıya "bir şey kayboldu" diye görünmesi demek olurdu.
    return true;
  }
}
