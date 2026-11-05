import React, { useState } from 'react';
import { ScrollView, View, Text, useWindowDimensions } from 'react-native';
import Reanimated, { FadeIn, FadeInDown, runOnJS, ZoomIn } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Touchable } from '@/shared/components/Touchable';
import { BreathPalette } from '@/shared/constants/Colors';
import { S, R, F, W, MIN_TOUCH } from '@/shared/constants/tokens';
import { useLowPowerGraphics } from '@/shared/hooks/useLowPowerGraphics';
import { BREATH_PATTERNS, patternOf, cyclesFor, type BreathId } from '@/features/breath/patterns';
import { BREATH_COPY } from '@/features/breath/breathCopy';
import { BreathPreview } from '@/features/breath/components/BreathOrb';
import { BREATH_SOUNDS, type BreathSound } from '@/features/breath/breathCues';

const INK = '#FFFFFF';
/** Küre dışındaki her şeyin kapladığı yükseklik: küre geri kalanını alır, ekran kaydırılmaz. */
const CHROME_H = 520;
const ORB_MIN = 110;
const ORB_MAX = 300;
const SWIPE = 40;

/*
  TEK EKRAN (2026-11-05, kullanıcı: "daha meditasyonel, minimalist, kaliteli; süre ve ses kısmını çoğu user fark etmez bile, aşağıda kalıyor").
  Liste yok. Ortada ritmi yaşayan tek küre, altında amaç. Yana kaydırınca ya da adına dokununca amaç değişir; arka plan, küre ve yazı birlikte döner.
  Süre ve ses "Başla"nın hemen üstünde, kutusuz iki sakin satır: görünür ama bağırmaz. Neden işe yaradığı isteyene açılır (iddia değil çalışma).
*/
function QuietRow({ label, accent, items, selected, onPick }: { label: string; accent: string; selected: number; items: { key: string; label: string; a11y?: string }[]; onPick: (i: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }} accessibilityRole="radiogroup">
      <Text style={{ width: S.xxl + S.md, fontSize: F.footnote, color: 'rgba(255,255,255,0.5)' }}>{label}</Text>
      {items.map((it, i) => {
        const on = i === selected;
        return (
          <Touchable key={it.key} onPress={() => onPick(i)} accessibilityRole="radio" accessibilityState={{ selected: on, checked: on }} accessibilityLabel={it.a11y ?? it.label} style={{ flex: 1, minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' }}>
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: F.footnote, fontWeight: on ? W.semibold : W.regular, color: on ? accent : 'rgba(255,255,255,0.62)' }}>{it.label}</Text>
          </Touchable>
        );
      })}
    </View>
  );
}

export function BreathPicker({ lang, id, minutes, sound, theme, onPick, onMinutes, onTheme, onMute, onStart }: {
  lang: 'tr' | 'en'; id: BreathId; minutes: number; sound: boolean; theme: BreathSound;
  onPick: (id: BreathId) => void; onMinutes: (m: number) => void; onTheme: (t: BreathSound) => void; onMute: () => void; onStart: () => void;
}) {
  const c = BREATH_COPY[lang];
  const low = useLowPowerGraphics();
  const { width, height } = useWindowDimensions();
  const [why, setWhy] = useState(false);
  const pal = BreathPalette[id];
  const accent = pal.accent;
  const pattern = patternOf(id);
  const it = c.items[id];
  // Seçenek ve etiket tekniğe göre: 4-7-8 nefes sayısıyla, diğerleri dakikayla (bkz. patterns.options).
  const doseLabel = (m: number) => (pattern.byBreaths ? c.breaths(cyclesFor(pattern, m)) : c.minutes(m));
  const same = (a: number, b: number) => Math.abs(a - b) < 0.01;
  const orb = why ? ORB_MIN : Math.max(ORB_MIN, Math.min(width * 0.72, ORB_MAX, height - CHROME_H));

  const step = (d: number) => {
    const i = BREATH_PATTERNS.findIndex(p => p.id === id);
    onPick(BREATH_PATTERNS[(i + d + BREATH_PATTERNS.length) % BREATH_PATTERNS.length].id);
  };
  const swipe = Gesture.Pan().activeOffsetX([-SWIPE / 2, SWIPE / 2]).failOffsetY([-SWIPE, SWIPE]).onEnd(e => {
    if (e.translationX < -SWIPE) runOnJS(step)(1);
    else if (e.translationX > SWIPE) runOnJS(step)(-1);
  });

  return (
    // Sığdığı sürece kaymaz; küçük telefonda, yatayda ya da "neden" açıkken "Başla" ekranın dışında kalmasın diye kayar.
    <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: S.lg }}>
      <GestureDetector gesture={swipe}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: S.sm }}>
          <Reanimated.View key={`${id}-${orb}`} entering={ZoomIn.duration(600)}>
            <BreathPreview id={id} size={orb} still={low} />
          </Reanimated.View>
          <Reanimated.Text key={`t-${id}`} entering={FadeInDown.duration(500)} accessibilityRole="header" style={{ fontSize: F.display, fontWeight: W.regular, letterSpacing: 0.5, color: INK }}>{it.title}</Reanimated.Text>
          <Reanimated.Text key={`s-${id}`} entering={FadeIn.delay(150).duration(500)} style={{ fontSize: F.footnote, textAlign: 'center', color: 'rgba(255,255,255,0.6)' }}>{it.technique}</Reanimated.Text>
          {why && (
            <Reanimated.View entering={FadeIn.duration(300)} style={{ gap: S.xs, alignItems: 'center' }}>
              <Text style={{ fontSize: F.footnote, lineHeight: 20, textAlign: 'center', color: 'rgba(255,255,255,0.8)' }}>{it.why}</Text>
              <Text style={{ fontSize: F.caption, lineHeight: 17, textAlign: 'center', color: 'rgba(255,255,255,0.55)' }}>{it.dose}</Text>
              <Text style={{ fontSize: F.caption2, textAlign: 'center', color: 'rgba(255,255,255,0.45)' }}>{it.source}</Text>
            </Reanimated.View>
          )}
          <Touchable accessibilityRole="button" accessibilityState={{ expanded: why }} onPress={() => setWhy(v => !v)} hitSlop={8} style={{ minHeight: MIN_TOUCH - S.sm, justifyContent: 'center' }}>
            <Text style={{ fontSize: F.caption, color: 'rgba(255,255,255,0.5)' }}>{c.why}</Text>
          </Touchable>
        </View>
      </GestureDetector>

      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', justifyContent: 'center', gap: S.xs, marginBottom: S.sm }}>
        {BREATH_PATTERNS.map(p => {
          const on = p.id === id;
          return (
            <Touchable key={p.id} accessibilityRole="radio" accessibilityState={{ selected: on, checked: on }} accessibilityLabel={`${c.items[p.id].title}. ${c.items[p.id].technique}`} onPress={() => onPick(p.id)} style={{ flex: 1, minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center', gap: S.xxs }}>
              <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: F.subhead, fontWeight: on ? W.semibold : W.regular, color: on ? accent : 'rgba(255,255,255,0.55)' }}>{c.items[p.id].title}</Text>
              <View style={{ width: S.xs, height: S.xs, borderRadius: R.full, backgroundColor: on ? accent : 'transparent' }} />
            </Touchable>
          );
        })}
      </View>

      <QuietRow label={c.duration} accent={accent}
        items={pattern.options.map(m => ({ key: String(m), label: doseLabel(m), a11y: same(m, pattern.minutes) ? `${doseLabel(m)}, ${c.recommended}` : doseLabel(m) }))}
        selected={pattern.options.findIndex(m => same(m, minutes))}
        onPick={i => onMinutes(pattern.options[i])} />
      {/* Ses teması: dokununca kısa önizleme çalar (herkes aynı sesi sevmez). */}
      <QuietRow label={c.soundLabel} accent={accent}
        items={[...BREATH_SOUNDS.map(t => ({ key: t, label: c.themes[t] })), { key: 'off', label: c.soundOff }]}
        selected={sound ? BREATH_SOUNDS.indexOf(theme) : BREATH_SOUNDS.length}
        onPick={i => (i === BREATH_SOUNDS.length ? onMute() : onTheme(BREATH_SOUNDS[i]))} />

      <Touchable onPress={onStart} accessibilityRole="button" style={{ minHeight: 56, marginTop: S.sm, marginBottom: S.md, borderRadius: R.full, alignItems: 'center', justifyContent: 'center', backgroundColor: accent }}>
        <Text style={{ fontSize: F.callout, fontWeight: W.semibold, color: pal.bg[1] }}>{c.start(doseLabel(minutes))}</Text>
      </Touchable>
    </ScrollView>
  );
}
