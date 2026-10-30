import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { MotiView } from 'moti';
import { Touchable } from '@/shared/components/Touchable';
import { BreathPalette } from '@/shared/constants/Colors';
import { S, R, F, W, B, ICON, MIN_TOUCH } from '@/shared/constants/tokens';
import { useLowPowerGraphics } from '@/shared/hooks/useLowPowerGraphics';
import { BREATH_PATTERNS, patternOf, cyclesFor, type BreathId } from '@/features/breath/patterns';
import { BREATH_COPY } from '@/features/breath/breathCopy';
import { BreathPreview } from '@/features/breath/components/BreathOrb';
import { BREATH_SOUNDS, type BreathSound } from '@/features/breath/breathCues';

const INK = '#FFFFFF';

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <View style={{ gap: S.xs, marginTop: S.xs }}>
    <Text style={{ fontSize: F.caption, fontWeight: W.semibold, color: 'rgba(255,255,255,0.55)' }}>{label}</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>{children}</View>
  </View>
);

const Chip = ({ on, accent, label, recommended, onPress }: { on: boolean; accent: string; label: string; recommended?: string; onPress: () => void }) => (
  <Touchable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={recommended ? `${label}, ${recommended}` : label}
    style={{ minHeight: MIN_TOUCH, paddingHorizontal: S.md, borderRadius: R.full, justifyContent: 'center', borderWidth: B.thin, borderColor: on ? accent : 'rgba(255,255,255,0.14)', backgroundColor: on ? 'rgba(255,255,255,0.08)' : 'transparent' }}>
    <Text style={{ fontSize: F.body, fontWeight: on ? W.semibold : W.regular, color: on ? accent : INK }}>
      {label}{recommended ? <Text style={{ fontSize: F.caption2, color: accent }}>{'  ★'}</Text> : null}
    </Text>
  </Touchable>
);

/**
 * Seans seçici: dört amaç, her kartta ritmi CANLI oynatan küçük küre (kullanıcı:
 * "seçeneklerde de animasyonlu göster"). Düşük güçlü cihazda yalnız seçili kart oynar.
 * Seçili kart nedenini ve kaynağını açar — iddia değil çalışma.
 */
export function BreathPicker({ lang, id, minutes, sound, theme, onPick, onMinutes, onTheme, onMute, onStart }: {
  lang: 'tr' | 'en'; id: BreathId; minutes: number; sound: boolean; theme: BreathSound;
  onPick: (id: BreathId) => void; onMinutes: (m: number) => void; onTheme: (t: BreathSound) => void; onMute: () => void; onStart: () => void;
}) {
  const c = BREATH_COPY[lang];
  const low = useLowPowerGraphics();
  const accent = BreathPalette[id].accent;
  const pattern = patternOf(id);
  // Seçenek ve etiket tekniğe göre: 4-7-8 nefes sayısıyla, diğerleri dakikayla (bkz. patterns.options).
  const doseLabel = (m: number) => (pattern.byBreaths ? c.breaths(cyclesFor(pattern, m)) : c.minutes(m));
  const same = (a: number, b: number) => Math.abs(a - b) < 0.01;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: S.md, paddingBottom: S.lg, gap: S.smd }}>
        <Text style={{ fontSize: F.hero, fontWeight: W.bold, color: INK }}>{c.title}</Text>
        <Text style={{ fontSize: F.body, color: 'rgba(255,255,255,0.62)', marginBottom: S.xs }}>{c.sub}</Text>

        <View accessibilityRole="radiogroup" style={{ gap: S.sm }}>
          {BREATH_PATTERNS.map(p => {
            const sel = p.id === id;
            const it = c.items[p.id];
            const pal = BreathPalette[p.id];
            return (
              <Touchable
                key={p.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: sel, checked: sel }}
                accessibilityLabel={`${it.title}. ${it.technique}`}
                onPress={() => onPick(p.id)}
                style={{ borderRadius: R.lg, borderWidth: B.medium, borderColor: sel ? pal.accent : 'rgba(255,255,255,0.08)', backgroundColor: sel ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)', padding: S.smd, gap: S.sm }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.smd }}>
                  <BreathPreview id={p.id} size={64} still={low && !sel} />
                  <View style={{ flex: 1, gap: S.xxs }}>
                    <Text style={{ fontSize: F.callout, fontWeight: W.semibold, color: sel ? pal.accent : INK }}>{it.title}</Text>
                    <Text style={{ fontSize: F.caption, color: 'rgba(255,255,255,0.6)' }}>{it.technique}</Text>
                  </View>
                </View>
                {sel && (
                  <MotiView from={{ opacity: 0, translateY: -4 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240 }} style={{ gap: S.xxs }}>
                    <Text style={{ fontSize: F.caption, lineHeight: 18, color: 'rgba(255,255,255,0.78)' }}>{it.why}</Text>
                    <Text style={{ fontSize: F.caption2, color: 'rgba(255,255,255,0.45)' }}>{it.source}</Text>
                  </MotiView>
                )}
              </Touchable>
            );
          })}
        </View>

        <Row label={c.duration}>
          {pattern.options.map(m => (
            <Chip key={m} on={same(m, minutes)} accent={accent} label={doseLabel(m)} recommended={same(m, pattern.minutes) ? c.recommended : undefined} onPress={() => onMinutes(m)} />
          ))}
        </Row>
        <Text style={{ fontSize: F.caption, lineHeight: 18, color: 'rgba(255,255,255,0.55)' }}>{c.items[id].dose}</Text>
        {/* Ses teması: dokununca kısa önizleme çalar (herkes aynı sesi sevmez). */}
        <Row label={c.soundLabel}>
          {BREATH_SOUNDS.map(t => (
            <Chip key={t} on={sound && t === theme} accent={accent} label={c.themes[t]} onPress={() => onTheme(t)} />
          ))}
          <Chip on={!sound} accent={accent} label={c.soundOff} onPress={onMute} />
        </Row>
      </ScrollView>

      <View style={{ paddingHorizontal: S.md, paddingBottom: S.md }}>
        <Touchable onPress={onStart} accessibilityRole="button" style={{ minHeight: 56, borderRadius: R.full, alignItems: 'center', justifyContent: 'center', backgroundColor: accent }}>
          <Text style={{ fontSize: F.callout, fontWeight: W.semibold, color: BreathPalette[id].bg[1] }}>{c.start(doseLabel(minutes))}</Text>
        </Touchable>
      </View>
    </View>
  );
}
