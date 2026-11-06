import React from 'react';
import { Text } from 'react-native';
import { ChevronDown, Plus } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { F, ICON, R, S, W, MIN_TOUCH } from '@/shared/constants/tokens';
import type { AppTheme } from '@/shared/constants/Colors';

const COPY = { tr: 'Yeni hedef ekle', en: 'Add a new goal' };

/** Hedef varken keşif listesi sayfayı doldurmaz: tek satırda açılır (Kado'nun tek "ekle" girişi). */
export function DiscoverToggle({ open, onToggle, language, theme }: { open: boolean; onToggle: () => void; language: 'tr' | 'en'; theme: AppTheme }) {
  return (
    <Touchable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={COPY[language]}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, minHeight: MIN_TOUCH + S.xs, borderRadius: R.lg, backgroundColor: theme.surfaceCard }}
    >
      <Plus size={ICON.sm} color={theme.primary} />
      <Text style={{ fontSize: F.body, fontWeight: W.semibold, color: theme.primary }}>{COPY[language]}</Text>
      <ChevronDown size={ICON.sm} color={theme.onSurfaceMuted} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
    </Touchable>
  );
}
