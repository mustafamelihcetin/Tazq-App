import React, { createContext, useContext, useRef, type RefObject } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppBlur, BlurTargetView } from '@/shared/components/AppBlur';
import { isLowPowerGraphicsDevice } from '@/shared/hooks/useLowPowerGraphics';
import { useReduceTransparency } from '@/shared/hooks/useReduceTransparency';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { R } from '@/shared/constants/tokens';

/*
  ANDROID SEKME ÇUBUĞU CAMI (2026-11-06, kullanıcı: "çirkin, şeffaf ya da cam olsun ama performans sorunu olmasın").
  Android gerçek blur'u yalnız bulanacak içeriği saran bir BlurTargetView ile yapabiliyor; çubuk onun DIŞINDA durmalı.
  Skia'nın BackdropFilter'ı (repodaki FrostedCard, Glassmorphism) yalnız kendi tuvalini bulandırır, RN listelerini değil.
  Eski Android'de yazılım bulanıklığı kaydırmayı yorar: gerçek cam yalnız Android 12+ (GPU RenderEffect) ve zayıf olmayan
  cihazda. Ötekilerde blur YOK, hiçbir görünüm de eklenmez; bulanıksız saydamlık altından geçen yazıyı okunmaz yapacağı
  için çubuk opak kalır, yalnız üst kenar ışığı alır.
*/
export const NAV_GLASS_BLUR = Platform.OS === 'android' && Number(Platform.Version) >= 31 && !isLowPowerGraphicsDevice();

const GlassTarget = createContext<RefObject<View | null> | null>(null);

/** Sayfa içeriği = bulanacak alan; `nav` onun dışında çizilir. Cam yoksa fazladan görünüm yok. */
export function NavGlassArea({ children, nav }: { children: React.ReactNode; nav: React.ReactNode }) {
  const target = useRef<View>(null);
  const { theme } = useAppTheme();
  if (!NAV_GLASS_BLUR) return <>{children}{nav}</>;
  return (
    <GlassTarget.Provider value={target}>
      {/* Zemin hedefin içinde: boş alan bulanırken pencere rengi değil tema rengi görünsün. */}
      <BlurTargetView ref={target} style={{ flex: 1, backgroundColor: theme.background }}>{children}</BlurTargetView>
      {nav}
    </GlassTarget.Provider>
  );
}

/** Gerçek cam bu çubukta çizilecek mi? */
export function useNavGlassOn(): boolean {
  const target = useContext(GlassTarget);
  const reduce = useReduceTransparency();
  return !!target && !reduce;
}

/** Kapsülün zemini: varsa blur + okunurluk tonu; her durumda üst kenar ışığı. */
export function NavGlassLayer() {
  const target = useContext(GlassTarget);
  const on = useNavGlassOn();
  const { theme, isDark } = useAppTheme();
  return (
    <View pointerEvents="none" style={st.clip}>
      {on && <AppBlur material="regular" blurTarget={target ?? undefined} radius={R.full} />}
      {/* Ton olmadan arkadan geçen kart ikonun kontrastını düşürüyor. */}
      {on && <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.surfaceCard, opacity: isDark ? 0.4 : 0.38 }]} />}
      <LinearGradient
        colors={isDark ? ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0)'] : ['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
        style={st.sheen}
      />
    </View>
  );
}

const st = StyleSheet.create({
  clip: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: R.full, overflow: 'hidden' },
  sheen: { position: 'absolute', top: 0, left: 0, right: 0, height: '55%' },
});
