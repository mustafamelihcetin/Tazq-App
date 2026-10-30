import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { ChevronRight, Shield } from 'lucide-react-native';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { S, R, F, W, B, ICON, HAIRLINE } from '@/shared/constants/tokens';
import { SettingsChip } from '@/shared/constants/Colors';
import { Touchable } from '@/shared/components/Touchable';

/*
  İLERLEME KARTI — Profil (2026-10-31, kullanıcı: "profil, başarılar, odak özetleri, ödüller, ayarlar
  ayrı ayrı yer kaplıyor; kompakt, şık, minimalist olmalı"). Üç ayrı blok + iki bölüm başlığı yerine
  TEK kart, üç satır — her satır bir soru:
    1. Ne yaptım?        → üç sayı yan yana (ikon yok; sayı konuşur)
    2. Ne kazandım?      → Başarılar: küçük madalyalar + 1/14  (dokun → vitrin)
    3. Neyle korunuyorum? → Seri kalkanı: 3 kalkan + sonraki kalkana puan çubuğu (dokun → kullan)
  Odak puanı ayrı satır değil: tek anlamı "sonraki kalkan" olduğu için kalkan satırının çubuğu.
*/

type Lang = 'tr' | 'en';
const COPY = {
  tr: {
    focus: 'sa odak', tasks: 'görev', streak: 'en uzun seri', retry: '↺ Yenile',
    achievements: 'Başarılar', firstMedal: 'İlk madalyanı kazan',
    shield: 'Seri kalkanı', points: (p: number) => `sonraki kalkana ${100 - p} puan`, full: 'kalkanlar dolu',
    shieldA11y: (n: number, p: number) => `Seri kalkanı, ${n} / 3 hazır, ${p} / 100 puan. Kullanmak için dokun: bugün mola olur, seri bozulmaz.`,
    achA11y: (e: number, t: number) => `Başarılar, ${e} / ${t} açıldı`,
  },
  en: {
    focus: 'focus hrs', tasks: 'tasks', streak: 'best streak', retry: '↺ Retry',
    achievements: 'Achievements', firstMedal: 'Earn your first medal',
    shield: 'Streak shield', points: (p: number) => `${100 - p} points to next shield`, full: 'shields full',
    shieldA11y: (n: number, p: number) => `Streak shield, ${n} of 3 ready, ${p} of 100 points. Tap to use: today becomes a break, streak stays.`,
    achA11y: (e: number, t: number) => `Achievements, ${e} of ${t} earned`,
  },
};

export function ProgressCard({ lang, stats, statsState, onRetry, medals, earnedCount, totalMedals, onShowcase, renderMedal, shields, points, onShield }: {
  lang: Lang;
  stats: { focusHours: number; tasks: number; bestStreak: number };
  statsState: 'loading' | 'error' | 'ok';
  onRetry: () => void;
  /** Önizlenecek madalyalar (en son kazanılan önde); kazanılmamışlar soluk çizilir. */
  medals: { id: string; earned: boolean; color: string }[];
  earnedCount: number; totalMedals: number;
  onShowcase: () => void;
  renderMedal: (id: string, size: number, dim: boolean) => React.ReactNode;
  shields: number; points: number;
  onShield: () => void;
}) {
  const { theme, isDark } = useAppTheme();
  const c = COPY[lang];
  const surface = isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLowest;
  const p = Math.max(0, Math.min(99, points % 100));
  const gold = SettingsChip.rewards;

  return (
    <View style={[styles.card, { backgroundColor: surface, borderColor: isDark ? theme.outline : 'transparent', borderWidth: isDark ? B.thin : 0 }]}>
      {/* 1 · NE YAPTIM */}
      {statsState === 'loading' ? (
        <MotiView animate={{ opacity: [0.35, 0.7, 0.35] }} transition={{ loop: true, duration: 1200 }}
          style={[styles.statsSkeleton, { backgroundColor: theme.surfaceContainerHigh }]} />
      ) : statsState === 'error' ? (
        <Touchable onPress={onRetry} accessibilityRole="button" style={styles.retry}>
          <Text style={{ color: theme.onSurfaceVariant, fontWeight: W.semibold, fontSize: F.caption }}>{c.retry}</Text>
        </Touchable>
      ) : (
        <View style={styles.stats}>
          {[
            { v: String(stats.focusHours), l: c.focus },
            { v: String(stats.tasks), l: c.tasks },
            { v: String(stats.bestStreak), l: c.streak },
          ].map((s, i) => (
            <View key={i} style={[styles.stat, i > 0 && { borderLeftWidth: HAIRLINE, borderLeftColor: theme.separator }]}>
              <Text style={[styles.statValue, { color: theme.onSurface }]}>{s.v}</Text>
              <Text style={[styles.statLabel, { color: theme.onSurfaceMuted }]} numberOfLines={1}>{s.l}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={[styles.divider, { backgroundColor: theme.separator }]} />

      {/* 2 · NE KAZANDIM */}
      <Touchable onPress={onShowcase} accessibilityRole="button" accessibilityLabel={c.achA11y(earnedCount, totalMedals)} style={styles.row}>
        <Text style={[styles.rowLabel, { color: theme.onSurface }]}>{c.achievements}</Text>
        <View style={styles.medals}>
          {earnedCount === 0 ? (
            <Text style={{ fontSize: F.caption, color: theme.onSurfaceMuted }}>{c.firstMedal}</Text>
          ) : medals.map(m => (
            <View key={m.id} style={[styles.medal, { backgroundColor: m.earned ? m.color : theme.surfaceContainerHigh }]}>
              {renderMedal(m.id, 13, !m.earned)}
            </View>
          ))}
        </View>
        <Text style={[styles.count, { color: theme.onSurfaceMuted }]}>{earnedCount}/{totalMedals}</Text>
        <ChevronRight size={ICON.sm} color={theme.onSurfaceMuted} />
      </Touchable>

      <View style={[styles.divider, { backgroundColor: theme.separator }]} />

      {/* 3 · NEYLE KORUNUYORUM — odak puanı = sonraki kalkanın çubuğu */}
      <Touchable onPress={onShield} accessibilityRole="button" accessibilityLabel={c.shieldA11y(shields, p)} style={styles.row}>
        <View style={{ flex: 1, gap: S.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
            <Text style={[styles.rowLabel, { color: theme.onSurface }]}>{c.shield}</Text>
            <View style={{ flexDirection: 'row', gap: S.xxs }}>
              {[1, 2, 3].map(n => (
                <Shield key={n} size={ICON.xs} color={n <= shields ? gold : theme.onSurfaceMuted}
                  fill={n <= shields ? gold : 'transparent'} opacity={n <= shields ? 1 : 0.4} />
              ))}
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
            <View style={[styles.track, { backgroundColor: theme.surfaceContainerHigh }]}>
              <View style={{ width: `${shields >= 3 ? 100 : p}%`, height: '100%', borderRadius: R.full, backgroundColor: gold }} />
            </View>
            <Text style={[styles.count, { color: theme.onSurfaceMuted }]}>{shields >= 3 ? c.full : c.points(p)}</Text>
          </View>
        </View>
        <ChevronRight size={ICON.sm} color={theme.onSurfaceMuted} />
      </Touchable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: S.lg, borderRadius: R.lg, paddingHorizontal: S.md },
  stats: { flexDirection: 'row', paddingVertical: S.smd },
  statsSkeleton: { height: 44, borderRadius: R.md, marginVertical: S.smd },
  retry: { alignSelf: 'center', paddingHorizontal: S.md, paddingVertical: S.smd },
  stat: { flex: 1, alignItems: 'center', gap: S.xxs },
  statValue: { fontSize: F.title3, fontWeight: W.bold, fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: F.caption },
  divider: { height: HAIRLINE },
  row: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingVertical: S.smd, minHeight: 52 },
  rowLabel: { fontSize: F.body, fontWeight: W.medium },
  medals: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: S.xxs },
  medal: { width: 24, height: 24, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  count: { fontSize: F.caption, fontVariant: ['tabular-nums'] },
  track: { flex: 1, height: S.xs, borderRadius: R.full, overflow: 'hidden' },
});
