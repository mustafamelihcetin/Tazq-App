import React, { useEffect, useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import { Canvas, Circle, Path, Skia } from '@shopify/react-native-skia';
import { Easing, useDerivedValue, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { Coffee } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { CompletionBurst } from '@/shared/components/CompletionBurst';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';
// Saf metin yardımcısı utils'e taşındı (uyku sınıflandırıcısı da kullanıyor);
// buradan yeniden dışa veriliyor ki mevcut içe aktarmalar kırılmasın.
import { compactHabitLabel } from '@/features/habits/utils/habitLabel';
import { describeHabit } from '@/shared/utils/a11y';
export { compactHabitLabel };
import { renderModeEmojiIcon } from '@/features/modes';
import type { AppTheme } from '@/shared/constants/Colors';
import { DISPLAY_FONT } from '@/shared/components/DisplayPanel';
import { F, S, R, ICON } from '@/shared/constants/tokens';

/*
  ALIŞKANLIKTA RENK = NEREDEN GELDİĞİ, DURUM = BİÇİM (2026-10-30). Mod alışkanlığı modunun rengini,
  elle eklenen kullanıcının ölçülmüş paletten seçtiği rengi taşır (bkz. habitColor.ts). "Yapıldı mı"yı
  renk tonu değil DOLULUK söyler: boş iz → bekliyor, dolan yay + dolu disk → yapıldı. Böylece renk
  tek anlam taşır (ön-dikkat), renk körü kullanıcı da durumu biçimden okur.
*/

/*
  ALIŞKANLIK HALKASI (2026-10-30) — kullanıcı: "ana sayfadaki alışkanlıklar kısmı çok çirkin;
  yukarıdaki ekranla uyumlu, şık, premium, işlevsel, minimalist; animasyonel de olabilir".
  Eski baloncuk: nötr çerçeve + dolgu + iki rozet (alev, tik) + dört renk kuralı.
  Yeni dil — üstteki dijital panelin ve gün çiçeğinin akrabası:
    · İnce bir İZ halkası; ilerleme alışkanlığın renginde bir YAY olarak dolar (Skia, animasyonlu).
      Miktarlıda yay adım adım (3/8), tekilde tek dokunuşta tam tur.
    · Tamamlanınca iç disk yumuşakça renklenir + tek seferlik kıvılcım. Rozet yok, yay söyler.
    · Mola: kehribar kesik iz + fincan. Dün kaçtıysa ("iki kez kaçırma") köşede küçük nokta:
      bugün yaparsan zincir sürer.
    · Sayaç (3/8, haftalık 2/3) eş aralıklı rakamla, panelle aynı dijital yazı.
  Hareket azaltılmışsa yay animasyonsuz çizilir.
*/

/** Etiket satır yüksekliği; yuva iki satırlık sabit yükseklik taşır (kısa ve uzun adlar aynı hizada biter). */
const LABEL_LINE = 12;

/**
 * YUVA GENİŞLİĞİ — halkadan geniş, çünkü ETİKETİ o taşıyor. 268 alışkanlık adının 218'i 18
 * karakterden uzun; 78pt'de iki satırda ~34 karakter sığar. Sayı TEK: şeritteki "Ekle" de bunu okur.
 */
export const HABIT_SLOT = 78;

const SIZE = 52;
const STROKE = 3;

/** İlerleme yayı — Canvas'ın İÇİNDE (yol nesnesi yalnız gerçek Skia ortamında kurulur). */
const Arc = ({ progress, color }: { progress: SharedValue<number>; color: string }) => {
  const path = useMemo(() => {
    const p = Skia.Path.Make();
    const r = SIZE / 2 - STROKE / 2;
    p.addArc({ x: SIZE / 2 - r, y: SIZE / 2 - r, width: r * 2, height: r * 2 }, -90, 359.9);
    return p;
  }, []);
  const end = useDerivedValue(() => progress.value);
  return <Path path={path} style="stroke" strokeWidth={STROKE} strokeCap="round" color={color} start={0} end={end} />;
};

export interface HabitBubbleProps {
  item: any;
  theme: AppTheme;
  isDark: boolean;
  tr: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

export const HabitBubble = React.memo<HabitBubbleProps>(({ item, theme, isDark, tr, onPress, onLongPress }) => {
  const reduce = useReduceMotion();
  /*
    İYİMSER ÇİZİM (2026-10-25, cihazda ölçüldü): halka ana sayfa baştan çizilmeden önce
    yerel durumla dolar; asıl kayıt bir sonraki karede yapılır.
  */
  const target: number = item.target ?? 1;
  const [optCount, setOptCount] = useState<number | null>(null);
  const [optDone, setOptDone] = useState<boolean | null>(null);
  useEffect(() => { setOptCount(null); setOptDone(null); }, [item.isCompleted, item.count]);
  const isCompleted: boolean = optDone ?? !!item.isCompleted;
  const count: number = optCount ?? item.count ?? (item.isCompleted ? target : 0);
  const isSkipped: boolean = !!item.isSkipped;
  const ratio = isSkipped ? 0 : isCompleted ? 1 : Math.min(1, count / target);

  // Yay ve iç disk animasyonla gelir (ilk çizimde de: şerit açılırken halkalar dolar).
  const progress = useSharedValue(0);
  const fill = useSharedValue(0);
  useEffect(() => {
    const cfg = { duration: reduce ? 0 : 520, easing: Easing.out(Easing.cubic) };
    progress.value = withTiming(ratio, cfg);
    fill.value = withTiming(isCompleted ? 1 : 0, { duration: reduce ? 0 : 360 });
  }, [ratio, isCompleted, reduce]);
  const discOpacity = useDerivedValue(() => fill.value * (isDark ? 0.24 : 0.16));

  const [burst, setBurst] = useState(0);
  const handlePress = () => {
    if (target > 1) {
      const next = count >= target ? 0 : count + 1;
      if (next >= target) setBurst(b => b + 1);
      setOptCount(next);
      setOptDone(next >= target);
    } else {
      if (!item.isCompleted) setBurst(b => b + 1);
      setOptDone(!item.isCompleted);
    }
    requestAnimationFrame(() => onPress());
  };

  const meta: string | null = isSkipped ? null
    : target > 1 && !isCompleted && count > 0 ? `${count}/${target}`
    : (item.weekBadge ?? null);
  const track = isSkipped ? theme.warning + '66' : theme.onSurface + (isDark ? '33' : '24');
  const iconColor = isSkipped ? theme.warning : isCompleted ? item.color : theme.onSurfaceVariant;
  const a11yLabel = item.title ?? item.name ?? '';

  return (
    <Touchable
      onPress={handlePress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={describeHabit({ doneToday: isCompleted, skipped: isSkipped, streak: item.streak }, a11yLabel, tr ? 'tr' : 'en') + (meta ? `, ${meta}` : '')}
      accessibilityState={{ checked: !!isCompleted }}
      accessibilityHint={tr ? 'Dokun: işaretle · Basılı tut: mola' : 'Tap to check · Hold for a break'}
      style={{ alignItems: 'center', width: HABIT_SLOT, gap: S.sm }}
    >
      <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
        <Canvas style={{ position: 'absolute', width: SIZE, height: SIZE }}>
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={SIZE / 2 - STROKE * 1.5} color={item.color} opacity={discOpacity} />
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={SIZE / 2 - STROKE / 2} style="stroke" strokeWidth={STROKE} color={track} />
          <Arc progress={progress} color={item.color} />
        </Canvas>
        <CompletionBurst trigger={burst} color={item.color} radius={SIZE / 2} />
        {isSkipped ? <Coffee size={ICON.md} color={theme.warning} /> : renderModeEmojiIcon(item.emoji ?? '📌', 20, iconColor)}
        {item.missed && !isCompleted && !isSkipped && (
          <View accessible={false} style={{ position: 'absolute', top: 1, right: 1, width: S.sm, height: S.sm, borderRadius: R.full, backgroundColor: theme.warning, borderWidth: 1.5, borderColor: theme.surfaceCard }} />
        )}
        {!!meta && (
          <View style={{ position: 'absolute', bottom: -S.xs, paddingHorizontal: S.xs, borderRadius: R.full, backgroundColor: theme.surfaceCard }}>
            <Text style={{ fontFamily: DISPLAY_FONT.digits, fontSize: F.caption, color: theme.onSurface, fontVariant: ['tabular-nums'] }}>{meta}</Text>
          </View>
        )}
      </View>

      {/* İKİ SATIR, sabit yükseklik: tek satırda adların neredeyse hepsi kesiliyordu. Üstü çizilmez —
          alışkanlık 'iptal' değil 'yapıldı'; yay bunu söylüyor. Soluk görünüm renk SEVİYESİNDEN gelir. */}
      <Text
        style={{
          fontSize: F.caption,
          lineHeight: LABEL_LINE,
          height: LABEL_LINE * 2,
          fontWeight: '600',
          color: isCompleted ? theme.onSurfaceMuted : theme.onSurface,
          textAlign: 'center',
          width: '100%',
        }}
        numberOfLines={2}
      >
        {compactHabitLabel(item.title)}
      </Text>
    </Touchable>
  );
});
