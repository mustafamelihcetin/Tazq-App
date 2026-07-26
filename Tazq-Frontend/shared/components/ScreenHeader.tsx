import React from 'react';
import { View, Text, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { ArrowLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import {
  S, ICON, HAIRLINE, MAX_W,
  TOP_BAR_HEIGHT, TOP_TITLE_SIZE, TOP_SUBTITLE_SIZE,
} from '@/shared/constants/tokens';
import { Touchable } from '@/shared/components/Touchable';
import { useLanguageStore } from '@/shared/store/useLanguageStore';

/**
 * Sayfa başlığı — ekranın üstüne yapışık, TAM GENİŞLİKTE, standart desen.
 * (dashboard, aksiyon merkezi, haftalık merkez ve dönemsel modlar)
 *
 * NEDEN ORTAK BİLEŞEN: bu başlık dört dosyada AYRI AYRI tanımlanmıştı. Kopyalar zamanla
 * ayrıştı ve boyları farklılaştı, çünkü yükseklik içerikten doğuyordu. Tek bir yerde
 * durunca ayrışma imkânsızlaşıyor — kural değil, yapı zorluyor.
 *
 * NEDEN YÜZEN "PILL" DEĞİL (değişiklik): önceki hâl 54pt, tam yuvarlak, 8pt havada,
 * yanlardan boşluklu ve gölgeliydi. Sekme çubuğu Apple ölçüsüne geçtiğinde ekranın iki
 * ucu iki ayrı tasarım dili konuşmaya başladı — üstte yüzen kart, altta sistem chrome'u.
 * Apple bunu yapmaz: UINavigationBar da UITabBar gibi tam genişlikte, düz ve hairline
 * ayraçlıdır. Artık ikisi tek sistem.
 *
 * ÖLÇÜLER APPLE'IN SPESİFİKASYONU:
 *   · yükseklik 44pt, durum çubuğunun hemen altında (blur durum çubuğunu da kaplar)
 *   · başlık 17pt semibold, ortalanmış
 *   · yarı saydam zemin (blur) + altta tek hairline ayraç, GÖLGE YOK
 *   · yükseklik/başlık ÖLÇEKLENMEZ — chrome her cihazda aynıdır
 *
 * BAŞLIK BİLEŞENDE: eskiden her ekran başlığını kendi `center` yuvasına Text olarak
 * yazıyordu (F.title3 + adjustsFontSizeToFit). Bu, sabit yüksekliğin sağladığı
 * tutarlılığı geri bozuyordu: dar ekranda başlık küçülüyor, geniş ekranda büyüyordu —
 * yani aynı başlık cihaza göre farklı puntoda çiziliyordu. Artık `title` prop'u var;
 * tipografi tek yerde, ekranlar ayrışamaz.
 *
 * SİMETRİ: yan yuvalar EŞİT genişlikte (SIDE_SLOT). Böylece ortadaki öğe, iki yandaki
 * içerik farklı genişlikte olsa bile gerçekten ortada durur.
 */

/** Yan yuva genişliği — iki yan EŞİT olmalı, yoksa orta öğe kayar. */
export const SIDE_SLOT = 90;

/** Apple HIG dokunma hedefi alt sınırı. Görsel öğe küçük olabilir, HEDEF olamaz. */
export const MIN_TOUCH = 44;

export interface ScreenHeaderProps {
  /** Sol yuva (avatar, aksiyon…). `onBack` verilirse yok sayılır. */
  left?: React.ReactNode;
  /**
   * Standart başlık — 17pt semibold, ortalanmış. Tipografi bileşende olduğu için
   * ekranlar arasında ayrışamaz. Özel bir orta öğe gerekiyorsa `center` kullan.
   */
  title?: string;
  /** Başlığın altındaki yardımcı satır (ör. haftanın tarih aralığı). */
  subtitle?: string;
  /** Alt satırın rengi — verilmezse ikincil metin rengi. */
  subtitleColor?: string;
  /**
   * Orta yuva için KAÇIŞ KAPISI — yalnız başlık metni yetmediğinde (ör. ana sayfadaki
   * dokunulabilir TAZQ logosu). `title` verilmişse o kazanır.
   */
  center?: React.ReactNode;
  /** Sağ yuva (aksiyon, filtre…). */
  right?: React.ReactNode;
  /**
   * Verilirse sol yuvaya STANDART geri düğmesi çizilir.
   *
   * NEDEN BURADA: geri düğmesi uygulamada birden çok biçimde yazılmıştı ve ikonu bile
   * ayrışmıştı. Aynı eylemin her sayfada farklı görünmesi, kullanıcıyı her sayfada
   * yeniden öğrenmeye zorluyor. Tek yer = tek davranış.
   */
  onBack?: () => void;
  /** Geri düğmesinin erişilebilirlik etiketi (varsayılan: "Geri"). */
  backLabel?: string;
}

export const ScreenHeader = ({
  left, title, subtitle, subtitleColor, center, right, onBack, backLabel,
}: ScreenHeaderProps) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { theme, colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';
  const { language } = useLanguageStore();

  const leftSlot = onBack ? (
    <Touchable
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); onBack(); }}
      accessibilityRole="button"
      accessibilityLabel={backLabel ?? (language === 'tr' ? 'Geri' : 'Back')}
      // Görsel glif ICON.lg, dokunma hedefi HIG alt sınırı (44pt).
      style={{ width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center', marginLeft: -S.sm }}
    >
      <ArrowLeft size={ICON.lg} color={theme.onSurface} />
    </Touchable>
  ) : left;

  const centerSlot = title ? (
    <View style={styles.titleStack} pointerEvents="none">
      {/* numberOfLines={1} + kırpma: Apple başlığı KÜÇÜLTMEZ, gerekirse "…" ile keser.
          Küçültmek aynı başlığı cihaza göre farklı puntoda çizmek demekti. */}
      <Text
        numberOfLines={1}
        accessibilityRole="header"
        style={[styles.title, { color: theme.onSurface }]}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text numberOfLines={1} style={[styles.subtitle, { color: subtitleColor ?? theme.onSurfaceVariant }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  ) : center;

  return (
    <View
      style={[
        styles.bar,
        {
          // Blur durum çubuğunu DA kaplar (iOS'ta nav bar böyledir): içerik yukarı
          // kayarken durum çubuğunun altında da bulanıklaşır, çıplak kalmaz.
          paddingTop: insets.top,
          backgroundColor: Platform.OS === 'ios' ? 'transparent' : theme.surfaceFloating,
          borderBottomColor: theme.outlineVariant,
        },
      ]}
    >
      {Platform.OS === 'ios' && (
        <BlurView intensity={isDark ? 70 : 90} tint={colorScheme} style={StyleSheet.absoluteFill} />
      )}

      {/* Geniş/foldable ekranda içerikle aynı sütuna hizalanır (sayfa gövdesi de MAX_W). */}
      <View style={[styles.column, { maxWidth: Math.min(width, MAX_W) }]}>
        <View style={styles.content}>
          {/*
            Orta yuva ÖNCE çiziliyor — sırası bilinçli. RN'de sonraki kardeş üstte kalır;
            orta öğe iki yanın arasına yazılsaydı sol buton onun ALTINDA, sağ buton
            ÜSTÜNDE kalırdı: aynı başlıkta iki farklı davranış.
            Mutlak konumlu, çünkü akışta yer kapsaydı yanların içeriği büyüdükçe "orta"
            kayardı. box-none: kutu dokunmayı yutmaz, yalnızca içindeki gerçek buton alır.
          */}
          <View style={styles.center} pointerEvents="box-none">
            {centerSlot}
          </View>

          <View style={styles.side}>{leftSlot}</View>
          <View style={[styles.side, styles.sideRight]}>{right}</View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    // Tek ince çizgi — sekme çubuğunun üstündeki ayracın aynısı. Gölge YOK: Apple
    // chrome'a gölge koymaz (koyu temada eski gölge `primary` rengindeydi, yani
    // başlığın etrafında mavi bir parıltı vardı).
    borderBottomWidth: HAIRLINE,
  },
  column: {
    width: '100%',
    alignSelf: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // SABİT — içerikten doğmuyor. Bkz. yukarıdaki not.
    height: TOP_BAR_HEIGHT,
    paddingHorizontal: S.md,
  },
  side: {
    width: SIDE_SLOT,
    // Yuva barın tam boyu: içindeki buton dikeyde ortalanır ve dokunma hedefi
    // görsel öğe kadar değil, yuva kadar yüksek olur.
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: S.xs,
  },
  sideRight: {
    justifyContent: 'flex-end',
  },
  center: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleStack: {
    alignItems: 'center',
    justifyContent: 'center',
    // Yan yuvaların arasına sığsın; taşarsa başlık "…" ile kesilir.
    maxWidth: '100%',
    paddingHorizontal: S.sm,
  },
  title: {
    // ÖLÇEKLENMEZ — chrome her cihazda aynı (bkz. TOP_TITLE_SIZE).
    fontSize: TOP_TITLE_SIZE,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: -0.2, // SF Pro Text 17pt'de hafif sıkışır
  },
  subtitle: {
    fontSize: TOP_SUBTITLE_SIZE,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: S.xxs,
  },
});
