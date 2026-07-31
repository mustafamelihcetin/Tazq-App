import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, Text, View, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { F, S, LH, W, trackingFor } from '@/shared/constants/tokens';

/**
 * ÇÖKEN BÜYÜK BAŞLIK — iOS'un büyük başlık deseni, tek yerde.
 *
 * ── SORUN ───────────────────────────────────────────────────────────────────────
 * Ana sayfa dışındaki ekranlarda üstte 44pt'lik SABİT bir çubuk duruyordu: hiç
 * değişmiyor, hiçbir zaman kaybolmuyor ve ekranın en değerli şeridini kalıcı olarak
 * işgal ediyordu. Küçük telefonlarda bu, ilk bakışta görünen içerikten bir satır
 * eksilmesi demek.
 *
 * iOS'ta başlık içeriğin PARÇASIDIR: sayfa tepedeyken büyük ve ferah durur, kaydırınca
 * küçülüp çubuğa yapışır. Yani başlık yer kaplamayı hak ettiği sürece kaplar.
 *
 * ── NEDEN AYRI BİR BİLEŞEN ──────────────────────────────────────────────────────
 * Desenin üç parçası var ve üçü birbirine bağlı: (1) içerikteki büyük başlık,
 * (2) kaydırma değeri, (3) çubuğun o değere göre belirmesi. Her ekran bunu kendisi
 * kursaydı eşikler ayrışır, biri ölçmek yerine sabit sayı yazar ve başlıklar farklı
 * anlarda çökerdi. `ScreenHeader` zaten (3)'ü yapıyor; burası (1) ve (2)'yi veriyor.
 *
 * ── ÖLÇÜLÜR, TAHMİN EDİLMEZ ─────────────────────────────────────────────────────
 * Çökme eşiği başlığın GERÇEK yüksekliğinden geliyor. Sabit bir sayı yazmak, dinamik
 * punto (erişilebilirlik) ya da iki satıra sarmış uzun bir başlıkta yanlış anda
 * çökmeye yol açar — başlık hâlâ ekrandayken çubuk da belirir, ikisi üst üste yazar.
 */

export interface LargeTitleProps {
  title: string;
  /** İsteğe bağlı alt satır — "12 görev", tarih aralığı gibi bağlam. */
  subtitle?: string;
  /** Ölçüm geri çağrısı: `useCollapsibleHeader().onTitleLayout` bağlanır. */
  onLayout?: (e: LayoutChangeEvent) => void;
  /**
   * Yatay girinti. Varsayılan `S.lg`, ama kaydırma kabı ZATEN yatay dolgu veriyorsa
   * `0` geçilmeli — yoksa girinti ikiye katlanır ve başlık içerikten kayar.
   */
  inset?: number;
}

export const LargeTitle = React.memo<LargeTitleProps>(({ title, subtitle, onLayout, inset = S.lg }) => {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.wrap, { paddingHorizontal: inset }]} onLayout={onLayout}>
      <Text
        style={[
          styles.title,
          {
            color: theme.onSurface,
            // Harf aralığı puntoya bağlı: sabit bir değer büyük puntoda fazla sıkı durur.
            letterSpacing: trackingFor(F.display),
          },
        ]}
        // Uzun başlık kesilmesin: iOS büyük başlığı da iki satıra sarar.
        numberOfLines={2}
      >
        {title}
      </Text>
      {!!subtitle && (
        <Text style={[styles.subtitle, { color: theme.onSurfaceMuted }]} numberOfLines={1}>
          {subtitle}
        </Text>
      )}
    </View>
  );
});

LargeTitle.displayName = 'LargeTitle';

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
          `useNativeDriver: false` — ZORUNLU, tercih değil.
          `ScreenHeader` bu değeri renk/zemin opaklığına ve düzen ölçülerine bağlıyor;
          native sürücü yalnız dönüşüm ve opaklığı destekler. `true` verilirse çubuk
          kaydırmaya hiç tepki vermez ve hata da alınmaz — sessizce çalışmaz.
        */
        useNativeDriver: false,
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

const styles = StyleSheet.create({
  wrap: {
    // Üst boşluk YOK: kaydırma kabı zaten güvenli alan + çubuk payını veriyor
    // (bkz. topBarSpace). Burada da vermek payı ikiye katlardı.
    paddingBottom: S.md,
  },
  title: {
    fontSize: F.display,
    fontWeight: W.bold,
    lineHeight: F.display * LH.tight,
    includeFontPadding: false,
  },
  subtitle: {
    fontSize: F.subhead,
    fontWeight: W.medium,
    marginTop: S.xs,
    includeFontPadding: false,
  },
});
