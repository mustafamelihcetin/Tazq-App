import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { Touchable } from '@/shared/components/Touchable';
import { S, R, B, ICON, MIN_TOUCH } from '@/shared/constants/tokens';
import { PaymentPalette, type AppTheme } from '@/shared/constants/Colors';
import { PAYMENT_ICONS } from '@/features/payments/utils/paymentLook';

const COPY = {
  tr: { icon: 'İkon', color: (i: number) => `Renk ${i}` },
  en: { icon: 'Icon', color: (i: number) => `Color ${i}` },
};

/** İkon ve renk seçimi: formdaki ikona dokununca açılır. Ekranda eşit sütunlu ızgara, satır sonu boşluğu kalmaz. */
export function PaymentAppearance({ theme, lang, icon, color, onIcon, onColor }: {
  theme: AppTheme; lang: 'tr' | 'en';
  icon: string | null; color: string | null;
  onIcon: (k: string) => void; onColor: (c: string) => void;
}) {
  const c = COPY[lang];
  const tint = color ?? theme.primary;
  return (
    <MotiView from={{ opacity: 0, translateY: -4 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 200 }} style={{ gap: S.sm }}>
      <View style={styles.grid}>
        {Object.entries(PAYMENT_ICONS).map(([k, Ic]) => {
          const on = icon === k;
          return (
            <Touchable key={k} onPress={() => onIcon(k)} accessibilityRole="button" accessibilityLabel={`${c.icon} ${k}`} accessibilityState={{ selected: on }} style={styles.cell}>
              <View style={[styles.iconBox, { backgroundColor: on ? tint + '24' : theme.surfaceField, borderColor: on ? tint : 'transparent' }]}>
                <Ic size={ICON.sm} color={on ? tint : theme.onSurfaceVariant} />
              </View>
            </Touchable>
          );
        })}
      </View>
      <View style={styles.grid}>
        {PaymentPalette.map((pc, i) => (
          <Touchable key={pc} onPress={() => onColor(pc)} accessibilityRole="button" accessibilityLabel={c.color(i + 1)} accessibilityState={{ selected: color === pc }} style={styles.cell}>
            <View style={[styles.swatch, { backgroundColor: pc, borderColor: color === pc ? theme.onSurface : 'transparent' }]} />
          </Touchable>
        ))}
      </View>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  iconBox: { width: 38, height: 38, borderRadius: R.md, borderWidth: B.thin, alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 28, height: 28, borderRadius: R.full, borderWidth: B.medium },
});
