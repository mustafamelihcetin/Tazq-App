import React from 'react';
import { Text } from 'react-native';
import { F, S } from '@/shared/constants/tokens';

/*
  ORTAM SESİ DURUMU (2026-11-01, kullanıcı: "ne zaman çalıyor çalmıyor, bugda mı kaldı anlamak zor").
  "Seçili" ile "çalıyor" artık ayrı görünür:
    · çalarken seçili düğmenin simgesi kendi karakteriyle hareket eder (bkz. SoundIcon), susunca durur;
    · altta tek satır: ne çalıyor, ne zaman çalacak.
  Önizleme (seans yokken dokununca 7 sn) bitince düğme seçili kalır — satır "seans başlayınca çalar" der.
*/
const COPY = {
  tr: {
    off: 'Ses kapalı',
    preview: (s: string) => `${s} önizlemesi · seans başlayınca sürer`,
    session: (s: string) => `${s} çalıyor`,
    idle: (s: string) => `${s} seçili · seans başlayınca çalar`,
    paused: (s: string) => `${s} seçili · devam edince çalar`,
  },
  en: {
    off: 'Sound off',
    preview: (s: string) => `${s} preview · continues when you start`,
    session: (s: string) => `${s} playing`,
    idle: (s: string) => `${s} selected · plays when you start`,
    paused: (s: string) => `${s} selected · plays when you resume`,
  },
};

export function ambientStatusText(p: { sound: string | null; audible: 'off' | 'preview' | 'session'; sessionActive: boolean; paused: boolean; language: 'tr' | 'en' }): string {
  const c = COPY[p.language];
  if (!p.sound) return c.off;
  if (p.audible === 'preview') return c.preview(p.sound);
  if (p.audible === 'session' || p.sessionActive) return c.session(p.sound);
  return p.paused ? c.paused(p.sound) : c.idle(p.sound);
}

export function AmbientStatus(props: { sound: string | null; audible: 'off' | 'preview' | 'session'; sessionActive: boolean; paused: boolean; language: 'tr' | 'en'; color: string; accent: string }) {
  const text = ambientStatusText(props);
  const live = props.audible !== 'off';
  return (
    <Text accessibilityLiveRegion="polite" numberOfLines={1}
      style={{ textAlign: 'center', fontSize: F.caption, color: live ? props.accent : props.color, opacity: props.sound ? 1 : 0.6, marginTop: S.sm }}>
      {text}
    </Text>
  );
}
