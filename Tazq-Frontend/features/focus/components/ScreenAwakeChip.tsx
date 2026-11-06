import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Smartphone } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { B, F, ICON, R, S } from '@/shared/constants/tokens';
import { useToastStore } from '@/shared/store/useToastStore';
import { shouldOfferScreenOff } from '@/features/focus/utils/pomodoroRhythm';

const COPY = {
  tr: {
    on: 'Ekran açık',
    off: 'Ekran kapanabilir',
    offer: 'Ekran kapansa da süre işler',
    action: 'Kapansın',
  },
  en: {
    on: 'Screen on',
    off: 'Screen can sleep',
    offer: 'The timer runs with the screen off',
    action: 'Let it sleep',
  },
};

/*
  EKRAN SEÇENEĞİ (2026-11-06, kullanıcı: "100 dakikalık seansta ekranı açık tutmak istemeyebilir, şarjı az olabilir"). Ayar sayfasına gömülü değil, seansın içinde tek dokunuş.
  Süre bitiş anından hesaplandığı ve bitiş bildirimi kurulduğu için ekran kapalıyken de seans doğru biter. Şarj düzeyi okunmuyor: yeni yerel paket ister, seçim kullanıcıda.
*/
export function ScreenAwakeChip({ on, onToggle, language, color }: { on: boolean; onToggle: () => void; language: 'tr' | 'en'; color: string }) {
  const c = COPY[language];
  return (
    <Touchable onPress={onToggle} accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel={c.on} style={styles.chip}>
      <Smartphone size={ICON.xs} color={color} />
      <Text numberOfLines={1} style={[styles.label, { color }]}>{on ? c.on : c.off}</Text>
    </Touchable>
  );
}

/** Uzun seans başlayınca bir kez, sessizce önerir. Seans bitince yeniden hakkı olur. */
export function useLongSessionOffer(p: { sessionStarted: boolean; totalSeconds: number; keepAwake: boolean; strict: boolean; notifBlocked: boolean; language: 'tr' | 'en'; onScreenOff: () => void }) {
  const offered = useRef(false);
  const { sessionStarted } = p;
  useEffect(() => {
    if (!sessionStarted) { offered.current = false; return; }
    if (!shouldOfferScreenOff({ ...p, offered: offered.current })) return;
    offered.current = true;
    const c = COPY[p.language];
    useToastStore.getState().show(c.offer, 'info', { label: c.action, onAction: p.onScreenOff });
  });
}

const styles = StyleSheet.create({
  // Ses çipiyle aynı ölçü: yan yana tek sıra.
  chip: { flexDirection: 'row', alignItems: 'center', gap: S.xs, paddingHorizontal: S.md, paddingVertical: S.sm, borderRadius: R.full, borderWidth: B.thin, borderColor: 'transparent', backgroundColor: 'rgba(255,255,255,0.06)' },
  label: { fontSize: F.caption2, fontWeight: '700', letterSpacing: 0.1 },
});
