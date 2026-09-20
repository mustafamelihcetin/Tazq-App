import React, { useCallback, useState } from 'react';
import { View, ScrollView, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { MotiView } from 'moti';
import { S, R } from '@/shared/constants/tokens';
import { useAppTheme } from '@/shared/hooks/useAppTheme';

/**
 * ÇOKLU HEDEF DESTESİ — yan yana değil, üst üste.
 *
 * ── ÖLÇÜLEN SORUN ──────────────────────────────────────────────────────────
 * Durum kartı (modlar sayfasının üstü) ve ana ekrandaki plan kartı, kaç hedef açık
 * olursa olsun YALNIZ BİRİNİ gösteriyordu: "en yakın olan". Diğerleri için tek işaret
 * küçük bir "+2" yazısıydı ve o yazı hiçbir yere götürmüyordu. Aynı anda üç hedefi
 * olan kullanıcı için kart, kendi hayatının üçte birini anlatıyordu.
 *
 * Alternatif, hepsini alt alta dizmekti; o da kartı listeye çevirir, "bugün neye
 * bakayım" sorusunu yine cevapsız bırakırdı. Deste ikisini birden çözüyor: ekranda
 * tek hedef durur (hiyerarşi korunur), parmakla diğerlerine geçilir (erişim açılır).
 *
 * ── TEK HEDEFTE HİÇBİR ŞEY DEĞİŞMEZ ────────────────────────────────────────
 * Tek sayfa varsa kaydırma da nokta da çizilmez; kart bugünküyle aynı kalır. Tek
 * seçeneği olan bir arayüzde nokta göstermek, kullanıcıya olmayan bir şey vadetmektir.
 *
 * Genişlik ölçülene kadar ilk sayfa doğrudan çizilir: boş bir kare gösterip sonra
 * içeriği doldurmak, kartın yüksekliğini bir kare zıplatıyordu.
 */

export interface ModeDeckProps {
  pages: React.ReactNode[];
  /** Etkin noktanın rengi — o an görünen hedefin vurgusu. */
  dotColors: string[];
  /** Ekran okuyucu için sayfa sayısı bilgisi. */
  a11yLabel?: string;
}

export const ModeDeck: React.FC<ModeDeckProps> = ({ pages, dotColors, a11yLabel }) => {
  const { theme } = useAppTheme();
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);

  const onScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width <= 0) return;
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    setIndex(Math.max(0, Math.min(pages.length - 1, i)));
  }, [width, pages.length]);

  if (pages.length === 0) return null;
  if (pages.length === 1) return <>{pages[0]}</>;

  return (
    <View onLayout={e => setWidth(e.nativeEvent.layout.width)} accessibilityLabel={a11yLabel}>
      {width <= 0 ? (
        pages[0]
      ) : (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          scrollEventThrottle={16}
          /* Dikey kaydırma kartın içinde takılmasın: deste yalnız yatayda yaşar. */
          directionalLockEnabled
        >
          {pages.map((p, i) => (
            <View key={i} style={{ width }}>{p}</View>
          ))}
        </ScrollView>
      )}

      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: S.xs, marginTop: S.sm }}>
        {pages.map((_, i) => (
          <MotiView
            key={i}
            animate={{
              width: i === index ? 16 : 6,
              backgroundColor: i === index ? (dotColors[i] ?? theme.onSurfaceVariant) : theme.onSurfaceMuted + '55',
            }}
            transition={{ type: 'timing', duration: 200 }}
            style={{ height: 6, borderRadius: R.full }}
          />
        ))}
      </View>
    </View>
  );
};
