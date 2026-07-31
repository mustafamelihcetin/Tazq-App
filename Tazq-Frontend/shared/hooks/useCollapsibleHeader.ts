import { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, type LayoutChangeEvent } from 'react-native';
import { S } from '@/shared/constants/tokens';

/**
 * ÇUBUK KAYDIRINCA BELİRİR — "sayfa tepedeyken header yok gibi".
 *
 * Sayfa açıldığında üstte şerit görünmez, ekranın tamamı içeriğe kalır; kaydırıldıkça
 * çubuğun zemini ve ayracı belirir. Başlık YAZISI ise hep durur — gizlenen kutudur,
 * yazı değil. Aksi halde sayfa açılınca nerede olduğunu söyleyen hiçbir şey kalmaz.
 *
 * `ScreenHeader` "nasıl görüneceğine" karar veriyor; burası yalnız "ne kadar kaydırıldı"
 * bilgisini üretiyor. Ayrı ayrı yazılsaydı ekranlar farklı eşikler seçip ayrışırdı.
 *
 * ── BİR DENEME GERİ ALINDI ──────────────────────────────────────────────────────
 * Bu dosyada bir `LargeTitle` bileşeni de vardı: iOS'un büyük başlık deseni, ekran adını
 * içeriğin tepesine 28 puntoyla yazıp kaydırınca çubuğa çöktürüyordu. Kaldırıldı, çünkü
 * çubuk o adı zaten söylüyor ve ikinci kez kocaman yazmak yalnızca yer kaplayan bir
 * TEKRAR. Ana sayfadaki büyük yazının işe yaramasının sebebi ekran adı OLMAMASI —
 * orada "Günaydın, Melih" yazıyor, yani bilgi taşıyor.
 *
 * Bileşen bir süre "belki lazım olur" diye bırakıldı; olmadı. Kullanılmayan kod zararsız
 * değildir: bu oturumda tam da böyle ölü bir kaydırma makinesi, var olmayan bir teknik
 * kısıtlama uydurup doğru çözümü geciktirdi.
 */
/**
 * Ekran tarafında gereken üç parçayı verir: kaydırma değeri, ölçüm ve eşik.
 *
 * YAYGIN KULLANIM (iki satır) — çubuk kaydırınca belirir, içerikte büyük başlık YOK:
 *   const { scrollY, onScroll, collapseAt } = useCollapsibleHeader();
 *   <ScreenHeader title="Merkez" scrollY={scrollY} collapseAt={collapseAt} … />
 *   <ScrollView onScroll={onScroll} scrollEventThrottle={16}>
 *
 * İçerikte büyük başlık İSTENİYORSA `LargeTitle` + `onTitleLayout` eklenir; o zaman
 * eşik ölçülen yükseklikten gelir. Ekran ADINI büyük yazmak genelde YANLIŞ: çubuk
 * zaten onu söylüyor, ikinci kez yazmak yer kaplayan bir tekrardır. Büyük başlık
 * ancak BİLGİ taşıdığında değer katar (ana sayfadaki selamlama gibi).
 */
export function useCollapsibleHeader({
  defaultCollapseAt = 56,
  listener,
}: {
  defaultCollapseAt?: number;
  /**
   * Ekranın KENDİ kaydırma işi (ör. ofseti bir ref'e yazmak). `Animated.event`in
   * `listener` seçeneğine bağlanır: animasyon değeri beslenirken eski davranış da
   * aynen çalışır — ekranların birini seçmek zorunda kalmaması için burada.
   */
  listener?: (e: { nativeEvent: { contentOffset: { y: number } } }) => void;
} = {}) {
  const scrollY = useRef(new Animated.Value(0)).current;
  const [titleHeight, setTitleHeight] = useState(0);

  const onTitleLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    // Yalnız gerçekten değiştiyse yaz: her ölçümde state güncellemek, dönme ve
    // klavye gibi olaylarda gereksiz render zinciri kurardı.
    setTitleHeight((prev) => (Math.abs(prev - h) < 1 ? prev : h));
  }, []);

  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        /*
          `useNativeDriver: true` — animasyon UI THREAD'DE koşar.
          
          Burada önce `false` yazılıydı ve gerekçesi yanlıştı: "ScreenHeader değeri renk
          ve düzen ölçülerine bağlıyor" diye varsayılmıştı. Bağlamıyor. Kaydırmaya bağlı
          TEK ŞEY şunlar:
            · çubuk zemininin opaklığı (ayrı bir katman, zemin rengi SABİT)
            · başlığın opaklığı ve 6pt'lik translateY'si
            · marka işaretinin opaklığı
          
          Dördü de native sürücünün tam desteklediği özellikler — `ScreenHeader` zaten
          bilerek böyle tasarlanmış (bkz. oradaki "ayrı katmanın opaklığı" notu) ve ana
          sayfa aynı bileşeni `true` ile kullanıyor.
          
          Fark önemsiz değil: `false` ile her kaydırma karesi JS iş parçacığından geçer
          ve uzun listede düşük donanımlı cihazda çubuk kareler geriden gelir. `true` ile
          kaydırma boyunca JS'e hiç uğranmaz — liste ne kadar uzun olursa olsun.
          
          `listener` bununla birlikte çalışmaya devam eder (ekranın kendi işi için);
          yalnız o geri çağrı JS'te koşar, animasyonun kendisi koşmaz.
        */
        useNativeDriver: true,
        listener,
      }),
    [scrollY, listener],
  );

  /**
   * ÇÖKME EŞİĞİ — iki kullanım biçimi var.
   *
   * 1. İÇERİKTE BÜYÜK BAŞLIK VARSA: eşik onun ÖLÇÜLEN yüksekliğinden gelir. Sabit sayı
   *    yazmak, dinamik punto ya da iki satıra sarmış başlıkta yanlış anda çökmeye yol
   *    açar — başlık hâlâ ekrandayken çubuk da belirir, aynı yazı iki yerde görünür.
   *
   * 2. BÜYÜK BAŞLIK YOKSA (yaygın durum): çubuk sadece "kaydırınca belirsin" isteniyordur.
   *    O zaman ölçülecek bir şey yok ve eşik sabit bir mesafedir.
   *
   * Varsayılan 56pt bilinçli: 1-2pt olsaydı parmak ekrana değer değmez başlık zıplardı;
   * çok büyük olsaydı kullanıcı yarım sayfa kaydırana kadar nerede olduğunu bilemezdi.
   * 56 ≈ bir kartın üst kenarı — yani "sayfa gerçekten kaydı" eşiği.
   */
  const collapseAt = useMemo(
    () => (titleHeight > 0 ? Math.max(titleHeight - S.lg, 1) : defaultCollapseAt),
    [titleHeight, defaultCollapseAt],
  );

  return { scrollY, onScroll, onTitleLayout, collapseAt };
}
