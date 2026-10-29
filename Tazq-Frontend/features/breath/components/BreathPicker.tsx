import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { MotiView } from 'moti';
import { Volume2, VolumeX } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { BreathPalette } from '@/shared/constants/Colors';
import { S, R, F, W, B, ICON, MIN_TOUCH } from '@/shared/constants/tokens';
import { useLowPowerGraphics } from '@/shared/hooks/useLowPowerGraphics';
import { BREATH_PATTERNS, type BreathId } from '@/features/breath/patterns';
import { BREATH_COPY } from '@/features/breath/breathCopy';
import { BreathPreview } from '@/features/breath/components/BreathOrb';

const INK = '#FFFFFF';
const DURATIONS = [1, 3, 5] as const;

/**
 * Seans seçici: dört amaç, her kartta ritmi CANLI oynatan küçük küre (kullanıcı:
 * "seçeneklerde de animasyonlu göster"). Düşük güçlü cihazda yalnız seçili kart oynar.
 * Seçili kart nedenini ve kaynağını açar — iddia değil çalışma.
 */
export function BreathPicker({ lang, id, minutes, sound, onPick, onMinutes, onSound, onStart }: {
  lang: 'tr' | 'en'; id: BreathId; minutes: number; sound: boolean;
  onPick: (id: BreathId) => void; onMinutes: (m: number) => void; onSound: () => void; onStart: () => void;
}) {
  const c = BREATH_COPY[lang];
  const low = useLowPowerGraphics();
  const accent = BreathPalette[id].accent;

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

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginTop: S.xs }}>
          <Text style={{ fontSize: F.caption, fontWeight: W.semibold, color: 'rgba(255,255,255,0.55)', marginRight: S.xs }}>{c.duration}</Text>
          {DURATIONS.map(m => {
            const on = m === minutes;
            return (
              <Touchable key={m} onPress={() => onMinutes(m)} accessibilityRole="button" accessibilityState={{ selected: on }}
                style={{ minHeight: MIN_TOUCH, paddingHorizontal: S.md, borderRadius: R.full, justifyContent: 'center', borderWidth: B.thin, borderColor: on ? accent : 'rgba(255,255,255,0.14)', backgroundColor: on ? 'rgba(255,255,255,0.08)' : 'transparent' }}>
                <Text style={{ fontSize: F.body, fontWeight: on ? W.semibold : W.regular, color: on ? accent : INK }}>{c.minutes(m)}</Text>
              </Touchable>
            );
          })}
          <View style={{ flex: 1 }} />
          <Touchable onPress={onSound} accessibilityRole="switch" accessibilityState={{ checked: sound }} accessibilityLabel={c.sound}
            style={{ width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: R.full, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' }}>
            {sound ? <Volume2 size={ICON.md} color={INK} /> : <VolumeX size={ICON.md} color="rgba(255,255,255,0.5)" />}
          </Touchable>
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: S.md, paddingBottom: S.md }}>
        <Touchable onPress={onStart} accessibilityRole="button" style={{ minHeight: 56, borderRadius: R.full, alignItems: 'center', justifyContent: 'center', backgroundColor: accent }}>
          <Text style={{ fontSize: F.callout, fontWeight: W.semibold, color: BreathPalette[id].bg[1] }}>{c.start(minutes)}</Text>
        </Touchable>
      </View>
    </View>
  );
}
