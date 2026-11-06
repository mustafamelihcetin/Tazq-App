import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Touchable } from '@/shared/components/Touchable';
import { F, MIN_TOUCH, R, S, W } from '@/shared/constants/tokens';
import type { AppTheme } from '@/shared/constants/Colors';
import { CURRENCIES, type CurrencyCode } from '@/shared/utils/currency';
import { haptic } from '@/shared/utils/haptics';

/** Para birimi tek küçük denetim: formda tutarın yanında, sayfada ana birim satırında. Dört geniş çip iki yerde tekrar ediyordu. */
export function CurrencyPick({ value, onChange, theme, label }: { value: CurrencyCode; onChange: (c: CurrencyCode) => void; theme: AppTheme; label: string }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.wrap, { backgroundColor: theme.surfaceField }]}>
      {CURRENCIES.map(c => {
        const on = c.code === value;
        return (
          <Touchable
            key={c.code}
            onPress={() => { if (!on) { haptic.select(); onChange(c.code); } }}
            accessibilityRole="radio"
            accessibilityLabel={c.code}
            accessibilityState={{ selected: on }}
            style={[styles.cell, on && { backgroundColor: theme.surfaceCard }]}
          >
            <Text style={{ fontSize: F.footnote, fontWeight: on ? W.bold : W.medium, color: on ? theme.onSurface : theme.onSurfaceMuted }}>{c.symbol}</Text>
          </Touchable>
        );
      })}
    </View>
  );
}

const CELL = MIN_TOUCH - S.sm;
const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', padding: S.xxs, borderRadius: R.full },
  cell: { width: CELL, height: CELL - S.xs, alignItems: 'center', justifyContent: 'center', borderRadius: R.full },
});
