import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { Bell, BellOff, ChevronDown } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { S, R, F, W, B, ICON, MIN_TOUCH } from '@/shared/constants/tokens';
import { PaymentPalette, type AppTheme } from '@/shared/constants/Colors';
import { PAYMENT_ICONS, PAYMENT_KINDS, REMINDER_OPTIONS } from '@/features/payments/utils/paymentLook';

/*
  TÜR · GÖRÜNÜM · HATIRLATMA (2026-11-05). Form kalabalıklaşmasın: hazır türler hep görünür (tek dokunuş yeter),
  ikon ve renk bir kapağın altında. Hatırlatma tek satır: kapalı, aynı gün, 1, 3, 7 gün önce.
*/
const COPY = {
  tr: { kinds: 'TÜR', custom: 'İkon ve renk', icon: 'İkon', color: 'Renk', remind: 'Vadeden önce hatırlat', off: 'Kapalı', same: 'Aynı gün', before: (n: number) => `${n} gün`, colorA11y: (i: number) => `Renk ${i}` },
  en: { kinds: 'TYPE', custom: 'Icon and color', icon: 'Icon', color: 'Color', remind: 'Remind before due', off: 'Off', same: 'Same day', before: (n: number) => `${n}d`, colorA11y: (i: number) => `Color ${i}` },
};

export function PaymentAppearance({ theme, lang, icon, color, reminder, onIcon, onColor, onReminder, onKind }: {
  theme: AppTheme; lang: 'tr' | 'en';
  icon: string | null; color: string | null; reminder: number;
  onIcon: (k: string) => void; onColor: (c: string) => void; onReminder: (d: number) => void;
  onKind: (name: string, icon: string, color: string) => void;
}) {
  const c = COPY[lang];
  const [open, setOpen] = useState(false);
  const tint = color ?? theme.primary;
  return (
    <View style={{ gap: S.sm }}>
      <Text style={[styles.label, { color: theme.onSurfaceMuted }]}>{c.kinds}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: S.xs }}>
        {PAYMENT_KINDS.map(k => {
          const Ic = PAYMENT_ICONS[k.icon];
          const on = icon === k.icon && color === k.color;
          return (
            <Touchable key={k.id} onPress={() => onKind(k[lang], k.icon, k.color)} accessibilityRole="button" accessibilityState={{ selected: on }}
              style={[styles.kind, { backgroundColor: on ? k.color + '1F' : theme.surfaceField, borderColor: on ? k.color : 'transparent' }]}>
              <Ic size={ICON.sm} color={k.color} />
              <Text style={{ fontSize: F.footnote, fontWeight: W.medium, color: theme.onSurface }}>{k[lang]}</Text>
            </Touchable>
          );
        })}
      </ScrollView>

      <Touchable onPress={() => setOpen(v => !v)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={styles.disclosure}>
        <Text style={{ flex: 1, fontSize: F.footnote, fontWeight: W.semibold, color: theme.onSurfaceVariant }}>{c.custom}</Text>
        <MotiView animate={{ rotate: open ? '180deg' : '0deg' }} transition={{ type: 'timing', duration: 180 }}>
          <ChevronDown size={ICON.sm} color={theme.onSurfaceMuted} />
        </MotiView>
      </Touchable>
      {open && (
        <MotiView from={{ opacity: 0, translateY: -4 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 200 }} style={{ gap: S.sm }}>
          <View style={styles.wrap}>
            {Object.entries(PAYMENT_ICONS).map(([k, Ic]) => {
              const on = icon === k;
              return (
                <Touchable key={k} onPress={() => onIcon(k)} accessibilityRole="button" accessibilityLabel={`${c.icon} ${k}`} accessibilityState={{ selected: on }}
                  style={[styles.iconCell, { backgroundColor: on ? tint + '24' : theme.surfaceField, borderColor: on ? tint : 'transparent' }]}>
                  <Ic size={ICON.sm} color={on ? tint : theme.onSurfaceVariant} />
                </Touchable>
              );
            })}
          </View>
          <View style={styles.wrap}>
            {PaymentPalette.map((pc, i) => (
              <Touchable key={pc} onPress={() => onColor(pc)} accessibilityRole="button" accessibilityLabel={c.colorA11y(i + 1)} accessibilityState={{ selected: color === pc }} style={styles.swatchHit}>
                <View style={[styles.swatch, { backgroundColor: pc, borderColor: color === pc ? theme.onSurface : 'transparent' }]} />
              </Touchable>
            ))}
          </View>
        </MotiView>
      )}

      <View style={styles.remindRow}>
        {reminder < 0 ? <BellOff size={ICON.sm} color={theme.onSurfaceMuted} /> : <Bell size={ICON.sm} color={theme.primary} />}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: S.xs }}>
          {REMINDER_OPTIONS.map(d => {
            const on = reminder === d;
            const label = d < 0 ? c.off : d === 0 ? c.same : c.before(d);
            return (
              <Touchable key={d} onPress={() => onReminder(d)} accessibilityRole="button" accessibilityLabel={`${c.remind}: ${label}`} accessibilityState={{ selected: on }}
                style={[styles.remind, { backgroundColor: on ? theme.primary + '1F' : 'transparent' }]}>
                <Text style={{ fontSize: F.footnote, fontWeight: on ? W.semibold : W.regular, color: on ? theme.primary : theme.onSurfaceVariant }}>{label}</Text>
              </Touchable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: F.caption, fontWeight: W.bold, letterSpacing: 0.3 },
  kind: { flexDirection: 'row', alignItems: 'center', gap: S.xs, minHeight: 40, paddingHorizontal: S.smd, borderRadius: R.full, borderWidth: B.thin },
  disclosure: { flexDirection: 'row', alignItems: 'center', minHeight: MIN_TOUCH },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: S.xs },
  iconCell: { width: 44, height: 44, borderRadius: R.md, borderWidth: B.thin, alignItems: 'center', justifyContent: 'center' },
  swatchHit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 30, height: 30, borderRadius: R.full, borderWidth: B.medium },
  remindRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  remind: { minHeight: 40, justifyContent: 'center', paddingHorizontal: S.smd, borderRadius: R.full },
});
