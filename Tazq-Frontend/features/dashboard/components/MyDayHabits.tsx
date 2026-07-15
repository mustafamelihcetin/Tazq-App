import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Plus } from 'lucide-react-native';
import { HabitBubble } from '@/shared/components/HabitBubble';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { Touchable } from '@/shared/components/Touchable';
import { F, S, R, W, ICON, B, MIN_TOUCH } from '@/shared/constants/tokens';
import type { AppTheme } from '@/shared/constants/Colors';

/**
 * Günüm kartının alışkanlık şeridi — yatay kaydırmalı baloncuklar.
 *
 * NEDEN YATAY: alışkanlıklar günde 3-6 tane ve hepsi eşit önemde. Dikey liste onları
 * sıralı bir yapılacaklar gibi gösterirdi (üstteki "önce" olur); yatay şerit ise
 * hepsini aynı düzlemde tutuyor — hangisini önce yaptığın önemli değil, yapman önemli.
 *
 * DAVRANIŞ BURADA DEĞİL: bir alışkanlığa basınca ses çalıyor, hepsi bitmişse konfeti
 * patlıyor ve odak puanı ekleniyor. O mantık çağıranda (index.tsx) — buraya taşımak
 * bileşeni beş store'a bağlar ve test edilemez kılardı. Burası ne olduğunu bilmez,
 * yalnızca "basıldı" der.
 */

/** Baloncuk yuvası — HabitBubble'ın kendi genişliğiyle hizalı. */
const SLOT = 62;
const BUBBLE = 50;

export interface MyDayHabitsProps {
  habits: any[];
  onToggle: (item: any) => void;
  /** Uzun basma: "bugün mola" — alışkanlığı bozmadan atlama. */
  onSkip: (item: any) => void;
  onAddHabit: () => void;
  theme: AppTheme;
  isDark: boolean;
  tr: boolean;
}

export const MyDayHabits = React.memo<MyDayHabitsProps>(
  ({ habits, onToggle, onSkip, onAddHabit, theme, isDark, tr }) => (
    <>
      <SectionHeader
        title={tr ? 'Bugünkü alışkanlıklarım' : 'My daily habits'}
        hint={
          tr
            ? 'Alışkanlığı tamamlamak için bas, mola için basılı tut'
            : 'Tap habit to complete, hold for a break'
        }
        theme={theme}
        tr={tr}
        inset={S.md}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {habits.map((item) => (
          <HabitBubble
            key={`habit-${item.id}`}
            item={item}
            theme={theme}
            isDark={isDark}
            tr={tr}
            onPress={() => onToggle(item)}
            onLongPress={() => onSkip(item)}
          />
        ))}

        {/* Ekleme kısayolu — kesikli çerçeve "burası henüz boş, doldurabilirsin" der.
            Dolu baloncuklarla aynı boyutta: eşit yuva, eşit ritim. */}
        <Touchable
          testID="add-habit"
          onPress={onAddHabit}
          activeOpacity={0.7}
          style={styles.slot}
          accessibilityRole="button"
          accessibilityLabel={tr ? 'Alışkanlık ekle' : 'Add habit'}
        >
          <View style={[styles.addBubble, { borderColor: theme.outline, backgroundColor: theme.surfaceContainerLow }]}>
            {/* İkon rengi SEVİYEDEN geliyor. Eskiden `opacity: 0.6` uygulanıyordu —
                ölçülmüş rengi kullanım yerinde kısmak, metinde olduğu gibi ikonda da
                ölçüyü çöpe atar. */}
            <Plus size={ICON.md} color={theme.onSurfaceMuted} />
          </View>
          <Text style={[styles.addLabel, { color: theme.onSurfaceMuted }]}>{tr ? 'Ekle' : 'Add'}</Text>
        </Touchable>

        {/* Boş durum rehberi — yalnızca hiç alışkanlık yokken. Ekleme kısayolunun
            yanında durur: "ne yapacağını" değil "neden yapacağını" anlatır. */}
        {habits.length === 0 && (
          <View style={[styles.guide, { backgroundColor: theme.surfaceContainerLow, borderColor: theme.outline }]}>
            <Text style={[styles.guideText, { color: theme.onSurfaceVariant }]}>
              {tr
                ? 'Günlük alışkanlıklarını belirle. Yaşam modlarını açtığında hedeflerin buraya otomatik gelir.'
                : 'Set daily habits. Active life modes will automatically populate habits here.'}
            </Text>
          </View>
        )}
      </ScrollView>
    </>
  ),
);

MyDayHabits.displayName = 'MyDayHabits';

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: S.md,
    paddingVertical: S.smd,
    gap: S.md,
    alignItems: 'flex-start',
  },
  slot: {
    alignItems: 'center',
    width: SLOT,
    gap: S.sm,
    // Dokunma hedefi Apple'ın alt sınırında: baloncuk 50pt ama yuva etiketle birlikte
    // daha yüksek — yine de açıkça garanti ediyoruz.
    minHeight: MIN_TOUCH,
  },
  addBubble: {
    width: BUBBLE,
    height: BUBBLE,
    borderRadius: R.full,
    borderWidth: B.medium,
    // Kesikli: dolu baloncuklardan ayrılsın. Düz çerçeve "boş alışkanlık" gibi okunurdu.
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addLabel: {
    // 9.5pt yazılıydı — okunabilirliğin alt sınırı 11. Yani etiket görünmüyordu.
    fontSize: F.caption,
    fontWeight: W.semibold,
    textAlign: 'center',
  },
  guide: {
    borderRadius: R.md,
    paddingHorizontal: S.smd,
    paddingVertical: S.sm,
    marginLeft: S.xs,
    maxWidth: 220,
    borderWidth: B.thin,
    justifyContent: 'center',
  },
  guideText: {
    // Burası da 9.5pt idi.
    fontSize: F.caption,
    fontWeight: W.regular,
    lineHeight: F.caption * 1.45,
  },
});
