import type React from 'react';
import { CloudRain, Wind, Coffee, Trees, Waves, Flame, Music2, Headphones, AudioLines } from 'lucide-react-native';

/**
 * Bu ekranın metinleri — iki dil YAN YANA.
 * Satır içi `tr ? '...' : '...'` dallanması iki dalı elle senkron tutmayı gerektiriyor
 * ve pratikte ayrışıyor (bkz. i18nRatchet).
 */
export const FOCUS_COPY = {
  tr: {
    pickTask: 'Neye odaklanıyorsun?',
    note: 'Not',
    soundsLabel: 'Sesler',
    soundOff: 'Ses kapalı',
    openIdle: 'Sen bitirene kadar sayar',
    elapsed: (m: number) => `Geçen süre ${m} dakika`,
    paused: 'DURAKLATILDI',
    skipBreak: 'Molayı atla',
    endConfirm: 'Emin misin?',
    todayProgress: (m: number, g: number) => `Bugün ${m} / ${g} dk`,
    todayDone: 'Bugünkü hedefin tamam ✦',
    keepAwake: 'Ekran Açık Kalsın',
    keepAwakeDesc: 'Seans boyunca ekran kararmaz',
    strictDesc: 'Duraklatma yok. 10 sn+ ayrılırsan saat durur',
    remaining: (m: number) => `Kalan süre ${m} dakika`,
    notifOff: 'Bildirimler kapalı — süre bitince haber veremeyiz.',
    presetLabel: (name: string, m: number) => `${name}, ${m} dakika`,
    streak: (n: number) => `${n} gün seri`,
    weekA11y: (mins: number[], streak: number) => `Son 7 gün odak dakikaları: ${mins.join(', ')}. Seri ${streak} gün.`,
    custom: 'Özel',
    customLabel: 'Özel süre',
  },
  en: {
    pickTask: 'What are you focusing on?',
    note: 'Note',
    soundsLabel: 'Sounds',
    soundOff: 'Sound off',
    openIdle: 'Counts up until you finish',
    elapsed: (m: number) => `${m} minutes elapsed`,
    paused: 'PAUSED',
    skipBreak: 'Skip break',
    endConfirm: 'Are you sure?',
    todayProgress: (m: number, g: number) => `Today ${m} / ${g} min`,
    todayDone: 'Today’s goal reached ✦',
    keepAwake: 'Keep Screen On',
    keepAwakeDesc: 'The screen stays awake during a session',
    strictDesc: 'No pausing. Leaving for 10s+ stops the clock',
    remaining: (m: number) => `${m} minutes remaining`,
    notifOff: 'Notifications are off — we cannot tell you when time is up.',
    presetLabel: (name: string, m: number) => `${name}, ${m} minutes`,
    streak: (n: number) => `${n}-day streak`,
    weekA11y: (mins: number[], streak: number) => `Focus minutes, last 7 days: ${mins.join(', ')}. Streak ${streak} days.`,
    custom: 'Custom',
    customLabel: 'Custom duration',
  },
};

export const PRESETS = [
  { key: 'sprint',   labelTr: 'Sprint',   labelEn: 'Sprint',   workMins: 15, shortBreak: 3,  longBreak: 8,  descTr: '15dk hızlı odak',    descEn: '15m quick focus' },
  { key: 'classic',  labelTr: 'Klasik',   labelEn: 'Classic',  workMins: 25, shortBreak: 5,  longBreak: 15, descTr: '25dk standart odak', descEn: '25m standard focus' },
  { key: 'extended', labelTr: 'Uzatılmış',labelEn: 'Extended', workMins: 50, shortBreak: 10, longBreak: 20, descTr: '50dk derin odak',     descEn: '50m deep focus' },
  { key: 'ultra',    labelTr: 'Ultra',    labelEn: 'Ultra',    workMins: 90, shortBreak: 20, longBreak: 30, descTr: '90dk akış durumu',   descEn: '90m flow state' },
] as const;
export type PresetKey = typeof PRESETS[number]['key'];

export type AmbientSound = 'off' | 'rain' | 'wind' | 'cafe' | 'forest' | 'ocean' | 'fireplace' | 'relaxing' | 'binaural' | 'brown';

export const SOUND_LABELS: Record<AmbientSound, { icon: React.ComponentType<any> | null; labelTr: string; labelEn: string }> = {
  off:       { icon: null,       labelTr: 'Sessiz',       labelEn: 'Off'       },
  rain:      { icon: CloudRain,  labelTr: 'Yağmur',       labelEn: 'Rain'      },
  wind:      { icon: Wind,       labelTr: 'Rüzgar',        labelEn: 'Wind'      },
  cafe:      { icon: Coffee,     labelTr: 'Kafe',          labelEn: 'Café'      },
  forest:    { icon: Trees,      labelTr: 'Orman',         labelEn: 'Forest'    },
  ocean:     { icon: Waves,      labelTr: 'Okyanus',       labelEn: 'Ocean'     },
  fireplace: { icon: Flame,      labelTr: 'Şömine',       labelEn: 'Fireplace' },
  relaxing:  { icon: Music2,     labelTr: 'Rahatlatıcı',  labelEn: 'Relaxing'  },
  binaural:  { icon: Headphones, labelTr: 'Frekans',      labelEn: 'Binaural'  },
  brown:     { icon: AudioLines, labelTr: 'Derin Gürültü', labelEn: 'Brown Noise' },
};

