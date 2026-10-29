import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { router, usePathname, type ErrorBoundaryProps } from 'expo-router';
import { ShieldCheck, RotateCcw, Home } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { reportRenderCrash } from '@/shared/utils/reportCrash';
import { goHome as navigateHome } from '@/shared/utils/authNavigation';
import { F, S, ICON, R } from '@/shared/constants/tokens';

interface Props {
  error: Error | null;
  onRetry: () => void;
  onHome: () => void;
}

/**
 * Çökme yedek ekranı — kök sınır ile rota sınırlarının ORTAK yüzü.
 *
 * Eski ekran kırmızı bir alarm ikonu, iki dili iç içe ("Bir Şeyler Ters Gitti /
 * Something went wrong") ve yalnız "Tekrar dene" gösteriyordu; hata ana sayfanın
 * kendisindeyse bu düğme aynı hataya geri döndürüyordu. Şimdi: sakin dil, verinin
 * güvende olduğu söylenir, ana sayfaya güvenli dönüş her zaman var. Ham hata mesajı
 * yalnız geliştirmede görünür.
 */
export function CrashFallback({ error, onRetry, onHome }: Props) {
  const { theme } = useAppTheme();
  const t = useLanguageStore(s => s.t.crash);
  const reduceMotion = useReduceMotion();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <MotiView
        from={reduceMotion ? undefined : { opacity: 0, scale: 0.94, translateY: 12 }}
        animate={{ opacity: 1, scale: 1, translateY: 0 }}
        transition={{ type: 'spring', damping: 18, stiffness: 180 }}
        style={styles.content}
      >
        <View style={[styles.iconWrap, { backgroundColor: theme.primaryContainer }]}>
          <ShieldCheck size={ICON.xl} color={theme.primary} strokeWidth={1.8} />
        </View>
        <Text style={[styles.title, { color: theme.onSurface }]} accessibilityRole="header">{t.title}</Text>
        <Text style={[styles.body, { color: theme.onSurfaceVariant }]}>{t.body}</Text>
        {__DEV__ && error?.message ? (
          <Text style={[styles.dev, { color: theme.onSurfaceVariant }]} numberOfLines={3}>{error.message}</Text>
        ) : null}

        <Touchable
          onPress={onHome}
          style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
          accessibilityRole="button"
          accessibilityLabel={t.home}
        >
          <Home size={ICON.sm} color={theme.onPrimary} />
          <Text style={[styles.primaryText, { color: theme.onPrimary }]}>{t.home}</Text>
        </Touchable>
        <Touchable
          onPress={onRetry}
          style={styles.secondaryBtn}
          accessibilityRole="button"
          accessibilityLabel={t.retry}
        >
          <RotateCcw size={ICON.sm} color={theme.primary} />
          <Text style={[styles.secondaryText, { color: theme.primary }]}>{t.retry}</Text>
        </Touchable>
        <Text style={[styles.note, { color: theme.onSurfaceVariant }]}>{t.reported}</Text>
      </MotiView>
    </View>
  );
}

/**
 * Rota düzeyi sınır — expo-router her ekran dosyasından dışa aktarılan
 * `ErrorBoundary`'yi kullanır: yalnız o ekran düşer, uygulamanın geri kalanı ayakta.
 * Kullanım: `export { RouteErrorBoundary as ErrorBoundary } from '@/shared/components/CrashFallback';`
 */
export function RouteErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const pathname = usePathname();
  const reported = useRef(false);
  useEffect(() => {
    if (reported.current) return;
    reported.current = true;
    reportRenderCrash(error);
  }, [error]);

  // Çöken ekran ana sayfanın kendisiyse "eve dön" yeniden denemekten başka bir şey olamaz.
  const goHome = () => (pathname === '/' ? retry() : navigateHome(router));
  return <CrashFallback error={error} onRetry={retry} onHome={goHome} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: S.lg },
  content: { width: '100%', maxWidth: 380, alignItems: 'center', gap: S.smd },
  iconWrap: { width: 72, height: 72, borderRadius: R.full, alignItems: 'center', justifyContent: 'center', marginBottom: S.sm },
  title: { fontSize: F.title3, fontWeight: '700', textAlign: 'center', letterSpacing: -0.4 },
  body: { fontSize: F.body, textAlign: 'center', lineHeight: 22, marginBottom: S.md },
  dev: { fontSize: F.caption2, textAlign: 'center' },
  primaryBtn: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, paddingVertical: S.md, borderRadius: R.xl },
  primaryText: { fontSize: F.body, fontWeight: '700' },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingVertical: S.smd, paddingHorizontal: S.md },
  secondaryText: { fontSize: F.body, fontWeight: '600' },
  note: { fontSize: F.caption, textAlign: 'center', marginTop: S.xs },
});
