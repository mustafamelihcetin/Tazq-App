import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet } from 'react-native';
import { X, Check } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { renderModeEmojiIcon } from '@/features/modes';
import { haptic } from '@/shared/utils/haptics';
import type { AppTheme } from '@/shared/constants/Colors';
import { HabitPlanFields } from '@/features/habits/components/HabitPlanFields';
import { planSummary } from '@/features/habits/utils/planCopy';
import type { PlanFields } from '@/features/habits/utils/habitSchedule';
import { habitColor, HABIT_PALETTE, type PaletteColor } from '@/features/habits/utils/habitColor';
import { S, R, F, ICON, MIN_TOUCH } from '@/shared/constants/tokens';

/*
  YENİ ALIŞKANLIK FORMU — Yeni Hedef formuyla AYNI dil (2026-10-25, kullanıcı: "çok çirkin,
  zarafetimize yakışmıyor"). Cihazda görülen sorunlar ve karşılıkları:
   · İkon ızgarası sola yaslıydı, sağda ~30 dp boşluk kalıyordu → sütun sayısı ve hücre
     genişliği kabın ÖLÇÜLEN genişliğinden hesaplanır; ızgara iki kenara da tam oturur.
   · Renk satırı kenarda kesiliyordu (son renk yarım) → renkler de aynı ölçümle eşit
     aralıklı dağılır, hepsi görünür. Seçim büyütmeyle değil eşmerkezli halkayla gösterilir.
   · Ad ayrı çerçeveli bir kutuydu, "Her gün takip edilir" uygulamanın mavisiyle uyumsuz
     renkli bir çipti → tek önizleme kartı: seçilen simge + ad + sakin alt yazı.
   · Formun dibindeki büyük gri "Ekle" → başlık çubuğunun sağında (Yeni Hedef ile aynı),
     klavye açıkken de erişilebilir; ad boşken pasif.
*/

const COPY = {
  tr: { lang: 'tr' as const, title: 'Yeni Alışkanlık', add: 'Ekle', close: 'Kapat', placeholder: 'Alışkanlık adı', daily: 'Her gün takip edilir', icon: 'SİMGE', color: 'RENK', iconA11y: (i: number) => `Simge ${i + 1}`, colorA11y: (i: number) => `Renk ${i + 1}` },
  en: { lang: 'en' as const, title: 'New Habit', add: 'Add', close: 'Close', placeholder: 'Habit name', daily: 'Tracked every day', icon: 'ICON', color: 'COLOR', iconA11y: (i: number) => `Icon ${i + 1}`, colorA11y: (i: number) => `Color ${i + 1}` },
};

/** Izgara hücresi en az bu kadar geniş (dokunma hedefi + ikon nefesi). */
const MIN_CELL = 48;
const GAP = S.sm;
const DOT = 32;
/** Seçim halkasının noktadan taşması — halka boyu, negatif kenar ve satırın yan payı aynı sayıdan. */
const RING = 4;

/** Kabın genişliğine en çok kaç sütun sığar ve hücre ne kadar olur — iki kenara da tam oturur. */
export function gridFit(width: number, count: number, minCell = MIN_CELL, gap = GAP) {
  if (width <= 0 || count <= 0) return { cols: 0, cell: 0 };
  const cols = Math.max(1, Math.min(count, Math.floor((width + gap) / (minCell + gap))));
  // AŞAĞI yuvarlanır: kesirli genişlikler toplanınca kabı bir pikselin altında aşıyor,
  // flexWrap son hücreyi alt satıra atıp ızgarayı 4 sütuna düşürüyordu (cihazda görüldü).
  const cell = Math.floor((width - gap * (cols - 1)) / cols);
  return { cols, cell };
}

export interface NewHabitFormProps {
  name: string;
  onNameChange: (v: string) => void;
  emoji: string;
  onEmojiChange: (v: string) => void;
  /** Seçili palet renginin AÇIK tonu (kayıtlı değer); ekranda temaya göre çözülür. */
  color: string;
  onColorChange: (v: string) => void;
  emojis: string[];
  /** Ölçülmüş alışkanlık paleti (bkz. habitColor.ts). */
  colors: PaletteColor[];
  onAdd: () => void;
  onClose: () => void;
  theme: AppTheme;
  isDark: boolean;
  tr: boolean;
  inputRef?: React.RefObject<TextInput | null>;
  /** Sıklık/miktar/dilim/otomatik (bkz. HabitPlanFields). Verilmezse bölüm görünmez. */
  plan?: PlanFields;
  onPlanChange?: (p: PlanFields) => void;
}

export function NewHabitForm({
  name, onNameChange, emoji, onEmojiChange, color: stored, onColorChange, emojis, colors, onAdd, onClose, theme, isDark, tr, inputRef, plan, onPlanChange,
}: NewHabitFormProps) {
  const c = tr ? COPY.tr : COPY.en;
  // Kayıtlı değer AÇIK ton; ekrandaki ton temaya göre (koyu temada aynı rengin koyu tonu).
  const color = habitColor({ color: stored }, isDark);
  const [w, setW] = useState(0);
  const grid = gridFit(w, emojis.length);
  const canAdd = name.trim().length > 0;

  return (
    <>
      <View style={styles.header}>
        <View style={styles.side}>
          <Touchable onPress={onClose} accessibilityRole="button" accessibilityLabel={c.close} style={[styles.closeBtn, { backgroundColor: theme.surfaceField }]}>
            <X size={ICON.sm} color={theme.onSurfaceVariant} strokeWidth={2.2} />
          </Touchable>
        </View>
        <Text numberOfLines={1} accessibilityRole="header" style={[styles.title, { color: theme.onSurface }]}>{c.title}</Text>
        <View style={[styles.side, styles.sideEnd]}>
          <Touchable
            onPress={onAdd}
            disabled={!canAdd}
            accessibilityRole="button"
            accessibilityLabel={c.add}
            accessibilityState={{ disabled: !canAdd }}
            style={[styles.addBtn, { backgroundColor: canAdd ? theme.primary : theme.surfaceField }]}
          >
            <Text style={[styles.addText, { color: canAdd ? theme.onPrimary : theme.onSurfaceMuted }]}>{c.add}</Text>
          </Touchable>
        </View>
      </View>

      <ScrollView
        style={{ flexShrink: 1 }}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* ÖNİZLEME — seçilen simge kendi renginde, yanında ad: alışkanlık listede nasıl görünecekse öyle. */}
        <View style={[styles.preview, { backgroundColor: theme.surfaceField }]}>
          <View style={[styles.previewIcon, { backgroundColor: color + (isDark ? '2E' : '1F') }]}>
            {renderModeEmojiIcon(emoji, 24, color)}
          </View>
          <View style={{ flex: 1 }}>
            <TextInput
              ref={inputRef}
              value={name}
              onChangeText={onNameChange}
              placeholder={c.placeholder}
              placeholderTextColor={theme.onSurfaceMuted}
              style={[styles.nameInput, { color: theme.onSurface }]}
              maxLength={40}
              returnKeyType="done"
              onSubmitEditing={() => { if (canAdd) onAdd(); }}
              accessibilityLabel={c.placeholder}
              underlineColorAndroid="transparent"
            />
            <Text style={[styles.caption, { color: theme.onSurfaceMuted }]}>{plan ? planSummary(plan, c.lang) : c.daily}</Text>
          </View>
        </View>

        {/* PLAN — sıklık, miktar, zaman, otomatik. Dokunmayan için bugünkü davranış: her gün. */}
        {plan && onPlanChange && (
          <HabitPlanFields plan={plan} onChange={onPlanChange} theme={theme} isDark={isDark} lang={c.lang} accent={color} />
        )}

        <View onLayout={(e) => setW(e.nativeEvent.layout.width)}>
          <Text style={[styles.label, { color: theme.onSurfaceMuted }]}>{c.icon}</Text>
          {grid.cols > 0 && (
            <View accessibilityRole="radiogroup" style={styles.grid}>
              {/* Açık satırlar: her satır iki kenara yaslanır (space-between), son satır boş
                  yer tutucularla tamamlanır — sütunlar dikeyde de hizalı kalır. */}
              {Array.from({ length: Math.ceil(emojis.length / grid.cols) }, (_, r) => (
              <View key={r} style={styles.gridRow}>
              {Array.from({ length: grid.cols }, (_, k) => {
                const i = r * grid.cols + k;
                const e = emojis[i];
                if (e === undefined) return <View key={`pad-${k}`} style={{ width: grid.cell }} />;
                const selected = e === emoji;
                return (
                  <Touchable
                    key={e}
                    accessibilityRole="radio"
                    accessibilityState={{ selected, checked: selected }}
                    accessibilityLabel={c.iconA11y(i)}
                    onPress={() => { if (!selected) { haptic.select(); onEmojiChange(e); } }}
                    style={[
                      styles.cell,
                      {
                        width: grid.cell,
                        height: Math.min(grid.cell, 56),
                        backgroundColor: selected ? color + (isDark ? '2E' : '1F') : theme.surfaceField,
                        borderColor: selected ? color : 'transparent',
                      },
                    ]}
                  >
                    {renderModeEmojiIcon(e, 22, selected ? color : theme.onSurfaceVariant)}
                  </Touchable>
                );
              })}
              </View>
              ))}
            </View>
          )}

          {/* RENK — ölçülmüş paletten (mod renkleriyle aynı aile; bkz. habitColor.ts). Örnek, bu
              temadaki tonuyla çizilir; kayıt açık ton olarak tutulur. */}
          <Text style={[styles.label, styles.labelSpaced, { color: theme.onSurfaceMuted }]}>{c.color}</Text>
          <View accessibilityRole="radiogroup" style={styles.colors}>
            {colors.map((p, i) => {
              const col = isDark ? p.dark : p.light;
              const selected = p.light === stored || p.dark === stored;
              return (
                <Touchable
                  key={p.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected, checked: selected }}
                  accessibilityLabel={c.colorA11y(i)}
                  hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                  onPress={() => { if (!selected) { haptic.select(); onColorChange(p.light); } }}
                  // Seçim: eşmerkezli halka (renk + zemin aralığı) — büyütme komşuları itiyordu.
                  style={[styles.dotRing, { borderColor: selected ? col : 'transparent' }]}
                >
                  <View style={[styles.dot, { backgroundColor: col }]}>
                    {selected ? <Check size={ICON.xs} color="#FFFFFF" strokeWidth={3} /> : null}
                  </View>
                </Touchable>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingBottom: S.md },
  side: { flex: 1, alignItems: 'flex-start' },
  sideEnd: { alignItems: 'flex-end' },
  title: { fontSize: F.subhead, fontWeight: '600', letterSpacing: -0.2, maxWidth: '55%' },
  closeBtn: { width: 36, height: 36, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  addBtn: { minWidth: 72, height: 36, paddingHorizontal: S.md, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  addText: { fontSize: F.body, fontWeight: '600' },
  body: { paddingBottom: S.md, gap: S.lg },
  preview: { flexDirection: 'row', alignItems: 'center', gap: S.smd, padding: S.smd, borderRadius: R.lg },
  previewIcon: { width: 48, height: 48, borderRadius: R.md, alignItems: 'center', justifyContent: 'center' },
  nameInput: { fontSize: F.subhead, fontWeight: '600', paddingVertical: S.xs },
  caption: { fontSize: F.caption2, fontWeight: '500' },
  label: { fontSize: F.caption, fontWeight: '600', letterSpacing: 1.2, marginBottom: S.sm, marginLeft: S.xs },
  labelSpaced: { marginTop: S.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  gridRow: { width: '100%', flexDirection: 'row', justifyContent: 'space-between' },
  cell: { minHeight: MIN_TOUCH, borderRadius: R.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  // Renkler iki kenara yaslanır (space-between): hesaplanan kesirli aralık son rengi alt
  // satıra düşürüyordu (8 renkten 7'si görünüyordu, cihazda görüldü). Sığmazsa sarar, kesilmez.
  // Yan pay = halkanın taşması (4): ilk/son renk seçiliyken halka sütunun dışında kırpılmasın.
  colors: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: S.sm, paddingHorizontal: RING },
  dotRing: { width: DOT + RING * 2, height: DOT + RING * 2, borderRadius: R.full, borderWidth: 2, alignItems: 'center', justifyContent: 'center', margin: -RING },
  dot: { width: DOT, height: DOT, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
});
