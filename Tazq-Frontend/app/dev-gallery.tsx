import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Star } from 'lucide-react-native';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { Colors, ModeAccents, ModeAccentsText } from '@/shared/constants/Colors';
import { F, S, R, RSPRING, HAIRLINE } from '@/shared/constants/tokens';
import { Touchable } from '@/shared/components/Touchable';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { Separator } from '@/shared/components/Separator';
import { ProgressRail } from '@/shared/components/ProgressRail';
import { SubtaskProgressRing } from '@/shared/components/SubtaskProgressRing';
import { AppIcon } from '@/shared/components/AppIcon';
import { haptic, hapticsAvailable } from '@/shared/utils/haptics';

/*
  ── BİLEŞEN GALERİSİ (yalnız geliştirme) ─────────────────────────────────────
  Storybook'un asıl faydası — bileşeni ekranından koparıp iki temada yan yana
  görmek — bağımlılık eklemeden. @storybook/react-native, metro'ya NativeWind
  ve özel resolver'ın üstüne üçüncü bir sarmalayıcı ve onlarca paket getiriyor;
  burada ihtiyaç duyduğumuz tek şey tasarım token'larını GÖZLE denetlemek.

  Release'de rota var ama ilk satırda ana sayfaya yönlendirir.
  Açmak için: tazq://dev-gallery (ya da Ayarlar'daki geliştirici satırı).
*/
export default function DevGallery() {
  if (!__DEV__) return <Redirect href="/" />;
  return <Gallery />;
}

function Gallery() {
  const { theme, isDark, setTheme } = useAppTheme();
  const [ring, setRing] = useState(2);
  const [crash, setCrash] = useState(false);
  // Hata sınırı denemesi (madde 10): render sırasında fırlatır → rota sınırının yedek ekranı.
  if (crash) throw new Error('dev-gallery: yapay çökme');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={{ padding: S.md, gap: S.lg }}>
        <View style={styles.row}>
          <Text style={{ fontSize: F.title, fontWeight: '700', color: theme.onSurface, flex: 1 }}>Galeri</Text>
          <Touchable accessibilityRole="button" accessibilityLabel={isDark ? 'Açık temaya geç' : 'Koyu temaya geç'} onPress={() => setTheme(isDark ? 'light' : 'dark')} style={[styles.chip, { backgroundColor: theme.primaryContainer }]}>
            <Text style={{ color: theme.onPrimaryContainer, fontSize: F.footnote, fontWeight: '600' }}>{isDark ? 'Açık tema' : 'Koyu tema'}</Text>
          </Touchable>
          <Touchable accessibilityRole="button" accessibilityLabel="Yapay çökme" onPress={() => setCrash(true)} style={[styles.chip, { backgroundColor: theme.surfaceField }]}>
            <Text style={{ color: theme.onSurface, fontSize: F.footnote, fontWeight: '600' }}>Çökme testi</Text>
          </Touchable>
        </View>

        <SectionHeader title="Tipografi (F)" theme={theme} tr />
        <View style={[styles.card, { backgroundColor: theme.surfaceCard }]}>
          {(Object.keys(F) as (keyof typeof F)[]).map((k) => (
            <Text key={k} style={{ fontSize: F[k], color: theme.onSurface }}>
              {k} · {Math.round(F[k])}
            </Text>
          ))}
        </View>

        <SectionHeader title="Tema renkleri — iki tema" theme={theme} tr />
        <View style={styles.row}>
          {(['light', 'dark'] as const).map((s) => (
            <View key={s} style={[styles.card, { flex: 1, backgroundColor: Colors[s].background }]}>
              {(['primary', 'secondary', 'tertiary', 'error', 'onSurface', 'onSurfaceVariant', 'onSurfaceMuted', 'surfaceCard'] as const).map((k) => (
                <View key={k} style={styles.swatchRow}>
                  <View style={[styles.swatch, { backgroundColor: Colors[s][k], borderColor: Colors[s].separator }]} />
                  <Text style={{ fontSize: F.caption, color: Colors[s].onSurfaceVariant }}>{k}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        <SectionHeader title="Mod vurguları — dolgu / metin" theme={theme} tr />
        <View style={[styles.card, { backgroundColor: theme.surfaceCard }]}>
          {(Object.keys(ModeAccents) as (keyof typeof ModeAccents)[]).map((m, i) => (
            <View key={m}>
              {i > 0 && <Separator theme={theme} />}
              <View style={[styles.swatchRow, { paddingVertical: S.xs }]}>
                <View style={[styles.swatch, { backgroundColor: ModeAccents[m][isDark ? 'dark' : 'light'], borderColor: theme.separator }]} />
                <Text style={{ flex: 1, fontSize: F.body, color: ModeAccentsText[m][isDark ? 'dark' : 'light'] }}>{m}</Text>
                <ProgressRail variant="bar" value={60} color={ModeAccents[m][isDark ? 'dark' : 'light']} />
              </View>
            </View>
          ))}
        </View>

        <SectionHeader title="Hareket (RSPRING)" theme={theme} tr />
        <View style={[styles.card, { backgroundColor: theme.surfaceCard, gap: S.sm }]}>
          {(Object.keys(RSPRING) as (keyof typeof RSPRING)[]).map((k) => <SpringDemo key={k} name={k} />)}
        </View>

        <SectionHeader title="Titreşim" theme={theme} tr />
        <View style={[styles.card, { backgroundColor: theme.surfaceCard, gap: S.sm }]}>
          <Text style={{ fontSize: F.footnote, color: hapticsAvailable() ? theme.success : theme.error }}>
            Native modül: {hapticsAvailable() ? 'yüklü' : 'YOK — dev client yeniden derlenmeli'}
          </Text>
          <View style={[styles.row, { flexWrap: 'wrap' }]}>
            {(Object.keys(haptic) as (keyof typeof haptic)[]).map((k) => (
              <Touchable key={k} accessibilityRole="button" accessibilityLabel={`${k} titreşimini dene`} onPress={() => (k === 'splash' ? haptic.splash([{ at: 0, kind: 'soft' }, { at: 140, kind: 'tick' }, { at: 280, kind: 'tick' }, { at: 600, kind: 'firm' }]) : (haptic[k] as () => void)())} style={[styles.chip, { backgroundColor: theme.surfaceField }]}>
                <Text style={{ fontSize: F.footnote, color: theme.onSurface }}>{k}</Text>
              </Touchable>
            ))}
          </View>
        </View>

        <SectionHeader title="İlerleme ve ikon" theme={theme} tr />
        <View style={[styles.card, styles.row, { backgroundColor: theme.surfaceCard }]}>
          <Touchable accessibilityRole="button" accessibilityLabel="İlerlemeyi artır" onPress={() => setRing((r) => (r + 1) % 6)}>
            <SubtaskProgressRing total={5} completed={ring} size={40} activeColor={theme.primary} inactiveColor={theme.surfaceVariant} />
          </Touchable>
          <AppIcon Icon={Star} color={theme.primary} />
          <View style={{ flex: 1 }}>
            <ProgressRail variant="segments" value={ring} total={5} color={theme.tertiary} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SpringDemo({ name }: { name: keyof typeof RSPRING }) {
  const { theme } = useAppTheme();
  const x = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <Touchable accessibilityRole="button" accessibilityLabel={`${name} yayını oynat`} onPress={() => { x.value = withSpring(x.value === 0 ? 200 : 0, RSPRING[name]); }} style={{ paddingVertical: S.xs }}>
      <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant, marginBottom: S.xs }}>{name} — dokun</Text>
      <Animated.View style={[styles.dot, { backgroundColor: theme.primary }, style]} />
    </Touchable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  card: { borderRadius: R.lg, padding: S.md, gap: S.xs },
  chip: { borderRadius: R.full, paddingHorizontal: S.md, paddingVertical: S.xs },
  swatchRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  swatch: { width: 20, height: 20, borderRadius: R.sm, borderWidth: HAIRLINE },
  dot: { width: 24, height: 24, borderRadius: R.full },
});
export { RouteErrorBoundary as ErrorBoundary } from '@/shared/components/CrashFallback'; // çökerse yalnız bu ekran düşer
