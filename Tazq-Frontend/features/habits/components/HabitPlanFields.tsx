import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import type { AppTheme } from '@/shared/constants/Colors';
import { S, R, F, ICON } from '@/shared/constants/tokens';
import { Touchable } from '@/shared/components/Touchable';
import { SegmentedControl } from '@/shared/components/SegmentedControl';
import { haptic } from '@/shared/utils/haptics';
import { scheduleOf, targetOf, type PlanFields, type HabitSlot, type HabitAutoSource } from '@/features/habits/utils/habitSchedule';
import { PLAN_COPY, type PlanLang } from '@/features/habits/utils/planCopy';

/*
  ALIŞKANLIK PLANI ALANLARI (2026-10-30) — yeni alışkanlık formu ve "Planı düzenle" aynı bileşeni
  kullanır. Varsayılanlar bugünkü davranış (her gün, miktar 1, dilim yok, otomatik yok): hiçbir
  şeye dokunmayan kullanıcı için hiçbir şey değişmez; isteyen esnetir.
*/

type Kind = 'daily' | 'weekly' | 'days';

export function HabitPlanFields({ plan, onChange, theme, isDark, lang, accent }: {
  plan: PlanFields; onChange: (p: PlanFields) => void; theme: AppTheme; isDark: boolean; lang: PlanLang; accent: string;
}) {
  const c = PLAN_COPY[lang];
  const s = scheduleOf(plan);
  const target = targetOf(plan);
  const set = (p: Partial<PlanFields>) => onChange({ ...plan, ...p });

  const setKind = (k: Kind) => {
    if (k === s.kind) return;
    set({ schedule: k === 'daily' ? { kind: 'daily' } : k === 'weekly' ? { kind: 'weekly', times: 3 } : { kind: 'days', days: [0, 2, 4] } });
  };

  const Chip = ({ label, selected, onPress, flex }: { label: string; selected: boolean; onPress: () => void; flex?: boolean }) => (
    <Touchable onPress={() => { if (!selected) { haptic.select(); onPress(); } }} accessibilityRole="radio" accessibilityState={{ selected, checked: selected }}
      style={[styles.chip, flex && { flex: 1 }, { backgroundColor: selected ? accent + (isDark ? '2E' : '1F') : theme.surfaceField, borderColor: selected ? accent : 'transparent' }]}>
      <Text numberOfLines={1} style={[styles.chipText, { color: selected ? theme.onSurface : theme.onSurfaceVariant, fontWeight: selected ? '700' : '500' }]}>{label}</Text>
    </Touchable>
  );

  const Stepper = ({ value, min, max, onValue, label }: { value: number; min: number; max: number; onValue: (n: number) => void; label: string }) => (
    <View style={[styles.stepper, { backgroundColor: theme.surfaceField }]}>
      <Text style={[styles.stepLabel, { color: theme.onSurface }]}>{label}</Text>
      <Touchable disabled={value <= min} onPress={() => { haptic.select(); onValue(value - 1); }} accessibilityRole="button" accessibilityLabel={c.minus}
        style={[styles.stepBtn, { opacity: value <= min ? 0.35 : 1 }]}>
        <Minus size={ICON.sm} color={theme.onSurface} />
      </Touchable>
      <Text style={[styles.stepValue, { color: theme.onSurface }]}>{value}</Text>
      <Touchable disabled={value >= max} onPress={() => { haptic.select(); onValue(value + 1); }} accessibilityRole="button" accessibilityLabel={c.plus}
        style={[styles.stepBtn, { opacity: value >= max ? 0.35 : 1 }]}>
        <Plus size={ICON.sm} color={theme.onSurface} />
      </Touchable>
    </View>
  );

  return (
    <View style={{ gap: S.lg }}>
      <View style={styles.section}>
        <Text style={[styles.label, { color: theme.onSurfaceMuted }]}>{c.frequency}</Text>
        <SegmentedControl<Kind>
          options={(['daily', 'weekly', 'days'] as Kind[]).map(k => ({ key: k, label: c[k] }))}
          value={s.kind} onChange={setKind} theme={theme} isDark={isDark} accessibilityLabel={c.frequency}
        />
        {s.kind === 'weekly' && (
          <Stepper label={c.timesPerWeek(s.times)} value={s.times} min={1} max={6} onValue={n => set({ schedule: { kind: 'weekly', times: n } })} />
        )}
        {s.kind === 'days' && (
          <View style={styles.row}>
            {c.weekdays.map((wd, i) => {
              // Gün çipi bir AÇ/KAPA (en az bir gün kalır) — radyo değil.
              const on = s.days.includes(i);
              return (
                <Touchable key={wd} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={wd}
                  onPress={() => {
                    if (on && s.days.length === 1) return;
                    haptic.select();
                    set({ schedule: { kind: 'days', days: on ? s.days.filter(d => d !== i) : [...s.days, i].sort() } });
                  }}
                  style={[styles.chip, { flex: 1, paddingHorizontal: 0, backgroundColor: on ? accent + (isDark ? '2E' : '1F') : theme.surfaceField, borderColor: on ? accent : 'transparent' }]}>
                  <Text numberOfLines={1} style={[styles.chipText, { color: on ? theme.onSurface : theme.onSurfaceVariant, fontWeight: on ? '700' : '500' }]}>{wd}</Text>
                </Touchable>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: theme.onSurfaceMuted }]}>{c.amount}</Text>
        <Stepper label={c.perDay} value={target} min={1} max={30} onValue={n => set({ target: n })} />
        {target > 1 && (
          <TextInput value={plan.unit ?? ''} onChangeText={u => set({ unit: u.slice(0, 16) })} placeholder={c.unitPh} placeholderTextColor={theme.onSurfaceMuted}
            maxLength={16} underlineColorAndroid="transparent" style={[styles.unit, { backgroundColor: theme.surfaceField, color: theme.onSurface }]} />
        )}
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: theme.onSurfaceMuted }]}>{c.time}</Text>
        <View accessibilityRole="radiogroup" style={styles.row}>
          {(['any', 'morning', 'midday', 'evening'] as const).map(k => (
            <Chip key={k} flex label={c.slots[k]} selected={(plan.slot ?? 'any') === k} onPress={() => set({ slot: k === 'any' ? undefined : (k as HabitSlot) })} />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: theme.onSurfaceMuted }]}>{c.auto}</Text>
        <View accessibilityRole="radiogroup" style={styles.row}>
          {(['none', 'focus', 'breath'] as const).map(k => (
            <Chip key={k} flex label={c.autos[k]} selected={(plan.autoFrom ?? 'none') === k} onPress={() => set({ autoFrom: k === 'none' ? undefined : (k as HabitAutoSource) })} />
          ))}
        </View>
        {!!plan.autoFrom && <Text style={[styles.hint, { color: theme.onSurfaceMuted }]}>{c.autoHint}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: S.sm },
  label: { fontSize: F.caption, fontWeight: '600', letterSpacing: 0.6 },
  row: { flexDirection: 'row', gap: S.xs },
  chip: { minHeight: 40, paddingHorizontal: S.sm, borderRadius: R.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontSize: F.footnote },
  stepper: { flexDirection: 'row', alignItems: 'center', borderRadius: R.md, paddingLeft: S.smd, minHeight: 48 },
  stepLabel: { flex: 1, fontSize: F.body },
  stepBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  stepValue: { minWidth: S.lg, textAlign: 'center', fontSize: F.body, fontWeight: '700', fontVariant: ['tabular-nums'] },
  unit: { minHeight: 44, borderRadius: R.md, paddingHorizontal: S.smd, fontSize: F.body },
  hint: { fontSize: F.caption },
});
