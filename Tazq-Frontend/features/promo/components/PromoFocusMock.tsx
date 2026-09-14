import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Moon } from 'lucide-react-native';
import { AppBlur } from '@/shared/components/AppBlur';
import type { MockCopy } from '@/features/promo/promoCopy';
import { promoWeight } from '@/features/promo/promoTheme';

/**
 * DERİN ODAK — tam ekran aurora + minimal sayaç, ekranın gerçek hâli.
 *
 * Kendi dosyasında, çünkü ötekilerin HİÇBİR parçasını paylaşmıyor: sekme çubuğu yok,
 * başlık çubuğu yok, kart yok, tema bile yok — bu ekran her zaman koyu. Gerçek odak
 * ekranında da böyle: dikkat dağıtacak her şey kalkıyor, geriye sayaç kalıyor.
 *
 * Renkler paletten GELMİYOR ve bu bilinçli: aurora lekeleri uygulamada bir Skia
 * shader'ından doğuyor, tema jetonlarıyla ifade edilebilecek bir şey değiller.
 *
 * @param px   Uygulama pt'si → mock pt'si (bkz. PromoMock).
 * @param ring Sayaç halkasının çapı — çerçeve genişliğinin oranı.
 */
export const PromoFocusMock: React.FC<{
  px: (n: number) => number;
  ring: number;
  topInset: number;
  bottomInset: number;
  copy: MockCopy;
  isIOS: boolean;
}> = ({ px, ring, topInset, bottomInset, copy: c, isIOS }) => {
  const T = { cap: px(11), c2: px(12), foot: px(13) };
  const W2 = promoWeight(isIOS, '200');
  const W6 = promoWeight(isIOS, '600');
  const W7 = promoWeight(isIOS, '700');
  const row = { flexDirection: 'row' as const, alignItems: 'center' as const };
  return (
      <View style={{ flex: 1, backgroundColor: '#05060E', overflow: 'hidden' }}>
        <View style={{ position: 'absolute', top: '-16%', left: '-30%', width: '108%', height: '56%', borderRadius: 999, backgroundColor: '#4F46E5', opacity: 0.5 }} />
        <View style={{ position: 'absolute', top: '20%', right: '-34%', width: '96%', height: '50%', borderRadius: 999, backgroundColor: '#2DD4BF', opacity: 0.32 }} />
        <View style={{ position: 'absolute', bottom: '-14%', left: '-18%', width: '108%', height: '54%', borderRadius: 999, backgroundColor: '#7C3AED', opacity: 0.44 }} />
        <View style={{ position: 'absolute', bottom: '4%', right: '-22%', width: '70%', height: '38%', borderRadius: 999, backgroundColor: '#DB2777', opacity: 0.24 }} />
        <AppBlur material="thick" tint="dark" />
        <LinearGradient colors={['rgba(5,6,14,0.55)', 'rgba(5,6,14,0.18)', 'rgba(5,6,14,0.7)']} style={StyleSheet.absoluteFill} />

        <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: T.foot, ...W7, letterSpacing: 2.5, textTransform: 'uppercase', textAlign: 'center', marginTop: topInset + px(24) }}>
          {c.focusEyebrow}
        </Text>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: ring, height: ring, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ position: 'absolute', width: ring, height: ring, borderRadius: ring / 2, borderWidth: px(8), borderColor: 'rgba(255,255,255,0.14)' }} />
            <View style={{ position: 'absolute', width: ring, height: ring, borderRadius: ring / 2, borderWidth: px(8), borderColor: 'transparent', borderTopColor: '#8FA6FF', borderLeftColor: '#8FA6FF', borderBottomColor: '#8FA6FF', transform: [{ rotate: '135deg' }] }} />
            <Text style={{ color: '#FFFFFF', fontSize: ring * 0.24, ...W2, letterSpacing: -1.5, textShadowColor: 'rgba(150,180,255,0.55)', textShadowRadius: 20 }}>24:18</Text>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: T.cap, ...W6, letterSpacing: 1, marginTop: px(4) }}>{c.remaining}</Text>
          </View>
        </View>

        <View style={{ alignItems: 'center', gap: px(10), paddingBottom: bottomInset + px(28) }}>
          <View style={[row, { gap: px(6), backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: px(16), paddingVertical: px(8), borderRadius: 999 }]}>
            <Moon size={px(14)} color="#C7D2FE" />
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: T.c2, ...W7 }}>{c.zen}</Text>
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.42)', fontSize: T.cap, ...W6 }}>{c.zenHint}</Text>
        </View>
      </View>
  );
};
