import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Modal, StyleSheet, useWindowDimensions } from 'react-native';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppTheme } from '@/shared/constants/Colors';
import { S, F, ICON } from '@/shared/constants/tokens';
import { Touchable } from '@/shared/components/Touchable';
import { GlassSheet } from '@/shared/components/GlassSheet';
import { haptic } from '@/shared/utils/haptics';
import { HabitPlanFields } from '@/features/habits/components/HabitPlanFields';
import { planSummary, type PlanLang } from '@/features/habits/utils/planCopy';
import type { PlanFields } from '@/features/habits/utils/habitSchedule';

/** Mevcut bir alışkanlığın planını düzenler (sıklık, miktar, dilim, otomatik). Geçmiş işaretlere dokunmaz. */
export function HabitPlanSheet({ visible, title, color, initial, onSave, onClose, theme, isDark, lang }: {
  visible: boolean; title: string; color: string; initial: PlanFields; onSave: (p: PlanFields) => void; onClose: () => void;
  theme: AppTheme; isDark: boolean; lang: PlanLang;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [plan, setPlan] = useState<PlanFields>(initial);
  // Yalnız AÇILIŞTA başlangıca dön: `initial` her çizimde yeni nesne, ona bağlanmak seçimi sıfırlardı.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (visible) setPlan(initial); }, [visible]);
  const copy = lang === 'tr' ? { save: 'Kaydet', close: 'Kapat' } : { save: 'Save', close: 'Close' };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.backdrop, { paddingTop: insets.top + S.md, paddingBottom: insets.bottom + S.md }]}>
        <Touchable style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} accessibilityRole="button" accessibilityLabel={copy.close} />
        <GlassSheet maxWidth={520} padding={S.md}>
          <View style={styles.header}>
            <Touchable onPress={onClose} accessibilityRole="button" accessibilityLabel={copy.close} hitSlop={{ top: S.xs, bottom: S.xs, left: S.xs, right: S.xs }}>
              <X size={ICON.md} color={theme.onSurface} />
            </Touchable>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={[styles.title, { color: theme.onSurface }]}>{title}</Text>
              <Text numberOfLines={1} style={[styles.sub, { color: theme.onSurfaceMuted }]}>{planSummary(plan, lang)}</Text>
            </View>
            <Touchable onPress={() => { haptic.success(); onSave(plan); onClose(); }} accessibilityRole="button">
              <Text style={[styles.save, { color: theme.primary }]}>{copy.save}</Text>
            </Touchable>
          </View>
          <ScrollView style={{ maxHeight: height * 0.62 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <HabitPlanFields plan={plan} onChange={setPlan} theme={theme} isDark={isDark} lang={lang} accent={color} />
          </ScrollView>
        </GlassSheet>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: S.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  title: { fontSize: F.subhead, fontWeight: '700' },
  sub: { fontSize: F.caption },
  save: { fontSize: F.body, fontWeight: '700' },
});
