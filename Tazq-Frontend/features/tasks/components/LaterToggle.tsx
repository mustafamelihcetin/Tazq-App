import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { F, S, R, W, ICON, MIN_TOUCH } from '@/shared/constants/tokens';
import type { AppTheme } from '@/shared/constants/Colors';
import { horizonCopy } from '@/features/tasks/utils/horizon';
import type { AppLang } from '@/shared/utils/lang';

/**
 * "DAHA SONRA · N GÖREV" — açık ufkun ötesindeki görevleri açıp kapatan satır.
 *
 * Listenin SONUNDA duruyor (FlatList'in alt bileşeni): geniş ekranda liste iki-üç
 * sütunlu ve sütunlu bir listenin ortasına tam genişlikte bir başlık konamıyor.
 * Açılınca uzak görevler listenin sonuna eklenir ve satır "gizle"ye döner.
 */
export function LaterToggle({ count, open, onToggle, theme, lang }: {
  count: number; open: boolean; onToggle: () => void; theme: AppTheme; lang: AppLang;
}) {
  if (count <= 0) return null;
  const c = horizonCopy(lang);
  const label = open ? c.hideLater : c.showLater(count);
  const Icon = open ? ChevronUp : ChevronDown;
  return (
    <Touchable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ expanded: open }}
      style={[styles.row, { backgroundColor: theme.surfaceField }]}
    >
      <Text style={[styles.label, { color: theme.onSurfaceVariant }]}>{label}</Text>
      <Icon size={ICON.sm} color={theme.onSurfaceVariant} />
    </Touchable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs,
    minHeight: MIN_TOUCH, borderRadius: R.md, marginTop: S.sm,
  },
  label: { fontSize: F.body, fontWeight: W.semibold },
});
