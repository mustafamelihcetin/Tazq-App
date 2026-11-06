import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { F, S, W } from '@/shared/constants/tokens';
import type { AppTheme } from '@/shared/constants/Colors';

/** Görev listesi bölüm başlığı: yalnız gecikme renk taşır, ötekiler sessiz durur. */
export function TaskGroupHeader({ label, count, tone, first, theme }: {
  label: string; count: number; tone: 'warn' | 'plain'; first: boolean; theme: AppTheme;
}) {
  return (
    <View accessibilityRole="header" accessible accessibilityLabel={`${label}, ${count}`} style={[styles.row, { paddingTop: first ? 0 : S.lg }]}>
      <Text numberOfLines={1} style={[styles.label, { color: tone === 'warn' ? theme.warning : theme.onSurfaceVariant }]}>{label}</Text>
      <Text style={[styles.count, { color: theme.onSurfaceMuted }]}>{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', gap: S.xs, paddingBottom: S.xs, paddingHorizontal: S.xs },
  label: { fontSize: F.footnote, fontWeight: W.semibold, flexShrink: 1 },
  count: { fontSize: F.footnote, fontWeight: W.medium, fontVariant: ['tabular-nums'] },
});
