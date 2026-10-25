import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { Sparkles, X } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { S, R, F, W, ICON, MAX_W, HAIRLINE, navBarSpace, touchSlop } from '@/shared/constants/tokens';

/*
  ── TUR TEKLİFİ — react-joyride "beacon" deseni ──────────────────────────────────
  Kullanıcı kararı (2026-10-25): yalnız ana sayfa turu kendiliğinden açılır; diğer
  sayfalarda ilk girişte ekranı KAPATMAYAN küçük bir teklif çıkar. Dokunan turu açar,
  × diyen için kaybolur ve bir daha gelmez — kimse bunalmaz.

  ZAMANLAYICI YOK (2026-10-25, cihazda görüldü): teklif 10 sn sonra kendiliğinden
  kapanıp turu "tamamlandı" sayıyordu. Yavaş telefonda kullanıcı fark etmeden gidiyordu;
  tam dokunulduğu an kaybolunca dokunuş alttaki karta düşüyordu. Süreyle kaybolan içerik
  WCAG 2.2.1'e aykırı; TipKit ipuçları da kullanıcı kapatana kadar durur.
  Sekme çubuğunun üstünde, ortada; tablette içerik sütununu aşmaz (MAX_W).
*/

const COPY = {
  tr: { cta: 'Bu sayfayı tanı', steps: (n: number) => `${n} adım`, dismiss: 'Teklifi kapat', a11y: (n: number) => `Bu sayfayı tanı, ${n} adımlık kısa tur` },
  en: { cta: 'Get to know this page', steps: (n: number) => `${n} steps`, dismiss: 'Dismiss', a11y: (n: number) => `Get to know this page, a ${n}-step tour` },
};

interface Props {
  count: number;
  /** Sayfada sekme çubuğu var mı — yoksa (Odak) balon ekranın dibine, içeriğin üstüne binmez. */
  aboveTabBar?: boolean;
  onStart: () => void;
  onDismiss: () => void;
}

export function TourBeacon({ count, aboveTabBar = true, onStart, onDismiss }: Props) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useAppTheme();
  const reduceMotion = useReduceMotion();
  const { language } = useLanguageStore();
  const c = COPY[language === 'en' ? 'en' : 'tr'];

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: (aboveTabBar ? navBarSpace(insets.bottom) : insets.bottom) + S.md }]}>
      <MotiView
        from={{ opacity: 0, translateY: reduceMotion ? 0 : 12 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: reduceMotion ? 0 : 280, delay: 500 }}
        style={[
          styles.pill,
          { backgroundColor: theme.surfaceCard, borderColor: theme.outline, borderWidth: isDark ? HAIRLINE : 0 },
          Platform.OS === 'android' && { elevation: 4 },
        ]}
      >
        <Touchable onPress={onStart} accessibilityRole="button" accessibilityLabel={c.a11y(count)} style={styles.cta}>
          <Sparkles size={ICON.sm} color={theme.primary} />
          <Text style={[styles.label, { color: theme.onSurface }]} numberOfLines={1}>{c.cta}</Text>
          <Text style={[styles.count, { color: theme.onSurfaceMuted }]}>{`· ${c.steps(count)}`}</Text>
        </Touchable>
        <View style={[styles.divider, { backgroundColor: theme.separator }]} />
        <Touchable onPress={onDismiss} hitSlop={touchSlop(ICON.sm)} accessibilityRole="button" accessibilityLabel={c.dismiss} style={styles.close}>
          <X size={ICON.sm} color={theme.onSurfaceMuted} />
        </Touchable>
      </MotiView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Ekran içi katman: kayan düğmelerin üstünde (Android elevation, bkz. androidParity.test).
  wrap: { position: 'absolute', left: S.md, right: S.md, alignItems: 'center', zIndex: 9990, elevation: 50 },
  pill: {
    maxWidth: MAX_W,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: R.full,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
  },
  cta: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingLeft: S.md, paddingRight: S.smd, minHeight: 44 },
  label: { flexShrink: 1, fontSize: F.body, fontWeight: W.semibold },
  count: { fontSize: F.body, fontWeight: W.medium, fontVariant: ['tabular-nums'] },
  divider: { width: HAIRLINE, alignSelf: 'stretch', marginVertical: S.smd },
  close: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
