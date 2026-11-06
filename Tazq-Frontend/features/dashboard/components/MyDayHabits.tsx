import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Plus } from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';
import { HABIT_SLOT } from '@/features/habits/components/HabitBubble';
import { HabitTile, type HabitTileProps } from '@/features/habits/components/HabitTile';
import { keepOrder } from '@/features/habits/utils/habitSchedule';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { Touchable } from '@/shared/components/Touchable';
import { F, S, R, W, ICON, B, MIN_TOUCH } from '@/shared/constants/tokens';
import { DISPLAY_FONT } from '@/shared/components/DisplayPanel';
import type { AppTheme } from '@/shared/constants/Colors';

/**
 * Günüm kartının alışkanlıkları — tamamı görünen ızgara.
 *
 * NEDEN IZGARA (2026-11-06): yatay şerit dördüncüden sonrasını ekranın dışına saklıyordu; yapılmamış alışkanlık görünmeyince
 * unutuluyordu. Baktığımız repoların (Kado, Loop, Habo, mhabit, Streak) hiçbiri kaydırmanın arkasına saklamıyor. Dikey liste de
 * görevleri aşağı iterdi; iki sütun hepsini aynı düzlemde tutar: hangisini önce yaptığın önemli değil, yapman önemli.
 *
 * DAVRANIŞ BURADA DEĞİL: bir alışkanlığa basınca ses çalıyor, hepsi bitmişse konfeti
 * patlıyor ve odak puanı ekleniyor. O mantık çağıranda (index.tsx) — buraya taşımak
 * bileşeni beş store'a bağlar ve test edilemez kılardı. Burası ne olduğunu bilmez,
 * yalnızca "basıldı" der.
 */

/*
  YUVA GENİŞLİĞİ ARTIK TEK YERDE — HabitBubble'ın kendisinde (HABIT_SLOT).

  Burada 78 yazıyordu ve gerekçesi uzun uzun anlatılıyordu, ama BALONCUKLAR o sayıyı
  hiç görmüyordu: HabitBubble kendi içinde 62 kullanmaya devam ediyordu. Yani ölçülüp
  belgelenen düzeltme yalnız aşağıdaki "Ekle" kısayoluna uygulanmış, asıl öğelere
  ulaşmamıştı — etiketler kesilmeye devam ediyor, üstelik "Ekle" kutusu ötekilerden
  geniş kaldığı için şeridin ritmi bozuluyordu.

  Gerekçenin tamamı artık HABIT_SLOT'un başında duruyor; iki yer aynı sayıyı okuyor.
*/
const COPY = {
  tr: {
    add: 'Alışkanlık ekle', addShort: 'Ekle', title: 'ALIŞKANLIKLAR',
    done: (d: number, n: number) => `${d} / ${n} tamamlandı`,
    guide: 'Günlük alışkanlıklarını belirle. Yaşam modlarını açtığında hedeflerin buraya otomatik gelir.',
  },
  en: {
    add: 'Add habit', addShort: 'Add', title: 'HABITS',
    done: (d: number, n: number) => `${d} of ${n} done`,
    guide: 'Set daily habits. Active life modes will automatically populate habits here.',
  },
};

const BUBBLE = 50;
const ADD_RING = 40;
/** Kutunun en dar hali: halka + iki satır ad + 7 günlük iz. */
const TILE_MIN = 150;

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
  ({ habits, onToggle, onSkip, onAddHabit, theme, isDark, tr }) => {
    // Telefonda iki sütun; geniş ekranda (tablet, yatay) kutu daralmadan sütun artar (mhabit'in en büyük genişlik ızgarası).
    const [gridWidth, setGridWidth] = useState(0);
    const columns = Math.max(2, Math.floor(gridWidth / TILE_MIN));
    const cell = { width: `${100 / columns}%` as const };
    const lang = tr ? 'tr' : 'en';
    const c = COPY[lang];
    const orderRef = useRef<string[]>([]);
    const ordered = keepOrder(orderRef.current, habits as { id: string }[]) as typeof habits;
    orderRef.current = ordered.map((h: { id: string }) => h.id);
    // Sayaç: mola günleri paydadan düşer (mola bir kaçırma değildir).
    const counted = habits.filter(h => !h.isSkipped).length;
    const done = habits.filter(h => h.isCompleted && !h.isSkipped).length;
    // Ekle yuvası TEK tanım: boş durumda ve dolu şeritte aynı öğe.
    // Kesikli çerçeve "burası henüz boş, doldurabilirsin" der; dolu baloncuklarla
    // aynı boyutta — eşit yuva, eşit ritim.
    const addSlot = (
      <Touchable
        testID="add-habit"
        onPress={onAddHabit}
        activeOpacity={0.7}
        style={styles.slot}
        accessibilityRole="button"
        accessibilityLabel={c.add}
      >
        {/*
          Kesikli çember SVG ile: Android, yuvarlak köşeli `borderStyle: 'dashed'`ı tırtıklı çiziyor
          ve koyu temada koyu dolgu "siyah delik" gibi duruyordu (2026-10-30, cihazda). Dolgu yok.
        */}
        <View style={styles.addBubble}>
          <Svg width={BUBBLE} height={BUBBLE} style={StyleSheet.absoluteFill}>
            <Circle cx={BUBBLE / 2} cy={BUBBLE / 2} r={BUBBLE / 2 - 1} fill="none" stroke={theme.outline} strokeWidth={B.medium} strokeDasharray="4 4" />
          </Svg>
          {/* İkon rengi SEVİYEDEN geliyor. Eskiden `opacity: 0.6` uygulanıyordu —
              ölçülmüş rengi kullanım yerinde kısmak, metinde olduğu gibi ikonda da
              ölçüyü çöpe atar. */}
          <Plus size={ICON.md} color={theme.onSurfaceMuted} />
        </View>
        <Text style={[styles.addLabel, { color: theme.onSurfaceMuted }]}>{c.addShort}</Text>
      </Touchable>
    );
    return (
    <>
      {/*
        BAŞLIK — üstteki dijital panelle aynı dil (2026-10-30): harf aralıklı küçük etiket + sağda
        eş aralıklı sayaç. "Bas / basılı tut" açıklama satırı kalktı (halkaların erişilebilirlik
        ipucunda); her gün okunan bir talimat, ilk günden sonra yalnız yer kaplıyordu.
      */}
      <View style={styles.header}>
        <Text style={[styles.headerLabel, { color: theme.onSurfaceMuted }]}>{c.title}</Text>
        {counted > 0 && (
          <Text accessibilityLabel={c.done(done, counted)}
            style={[styles.headerCount, { color: done >= counted ? theme.success : theme.onSurface }]}>{`${done}/${counted}`}</Text>
        )}
      </View>

      {/*
        BOŞ DURUM KAYMAZ (2026-10-25, cihazda görüldü): rehber balonu yatay kayan şeridin
        İÇİNDE ve sabit 220 genişlikteydi; 360 dp telefonda kartın sağ kenarından taşıp
        kesiliyordu ("hedeflerin b…"). Alışkanlık yokken kaydırılacak bir şey de yok —
        ekle yuvası + rehber sabit bir satır, rehber kalan alanı doldurur.
      */}
      {habits.length === 0 ? (
        <View style={[styles.row, styles.emptyRow]}>
          {addSlot}
          <View style={[styles.guide, { backgroundColor: theme.surfaceContainerLow, borderColor: theme.outline }]}>
            <Text style={[styles.guideText, { color: theme.onSurfaceVariant }]}>
              {c.guide}
            </Text>
          </View>
        </View>
      ) : (
      <View testID="habit-grid" style={styles.grid} onLayout={e => setGridWidth(e.nativeEvent.layout.width)}>
        {ordered.map((item) => (
          <View key={`habit-${item.id}`} style={[cell, styles.cell]}>
            <HabitTile
              item={item as HabitTileProps['item']}
              theme={theme}
              isDark={isDark}
              lang={lang}
              onPress={() => onToggle(item)}
              onLongPress={() => onSkip(item)}
            />
          </View>
        ))}
        <View style={[cell, styles.cell]}>
          <Touchable
            testID="add-habit"
            onPress={onAddHabit}
            activeOpacity={0.7}
            style={styles.addTile}
            accessibilityRole="button"
            accessibilityLabel={c.add}
          >
            <View style={styles.addRing}>
              <Svg width={ADD_RING} height={ADD_RING} style={StyleSheet.absoluteFill}>
                <Circle cx={ADD_RING / 2} cy={ADD_RING / 2} r={ADD_RING / 2 - 1} fill="none" stroke={theme.outline} strokeWidth={B.medium} strokeDasharray="4 4" />
              </Svg>
              <Plus size={ICON.sm} color={theme.onSurfaceMuted} />
            </View>
            <Text style={[styles.addLabel, { color: theme.onSurfaceMuted }]}>{c.addShort}</Text>
          </Touchable>
        </View>
      </View>
      )}
    </>
    );
  },
);

MyDayHabits.displayName = 'MyDayHabits';

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: S.md - S.xs, paddingVertical: S.sm },
  cell: { paddingHorizontal: S.xs },
  addTile: { flexDirection: 'row', alignItems: 'center', gap: S.sm, minHeight: MIN_TOUCH + S.sm, paddingVertical: S.xs },
  addRing: { width: ADD_RING, height: ADD_RING, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: S.md, paddingTop: S.md },
  headerLabel: { fontSize: F.caption, fontWeight: W.semibold, letterSpacing: 1.2 },
  headerCount: { fontFamily: DISPLAY_FONT.digits, fontSize: F.footnote, fontVariant: ['tabular-nums'] },
  emptyRow: { flexDirection: 'row' },
  row: {
    paddingHorizontal: S.md,
    paddingVertical: S.smd,
    gap: S.md,
    alignItems: 'flex-start',
  },
  slot: {
    alignItems: 'center',
    width: HABIT_SLOT,
    gap: S.sm,
    // Dokunma hedefi Apple'ın alt sınırında: baloncuk 50pt ama yuva etiketle birlikte
    // daha yüksek — yine de açıkça garanti ediyoruz.
    minHeight: MIN_TOUCH,
  },
  addBubble: {
    width: BUBBLE,
    height: BUBBLE,
    // Kesikli (SVG, yukarıda): dolu baloncuklardan ayrılsın. Düz çerçeve "boş alışkanlık" gibi okunurdu.
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
    flex: 1,
    alignSelf: 'center',
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
