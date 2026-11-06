/*
  POMODORO RİTMİ (2026-11-06). Çalışma süresi kadrandan seçilir, mola ondan türer: 25→5, 50→10, 15→3. Ayrı pencere ve ayar yok.
  Goodtime'ın iş/mola oranı fikri; kısa mola çalışmanın beşte biri, uzun mola kısa molanın üç katı.
*/
const SHORT_MIN = 3;
const SHORT_MAX = 30;
const LONG_MAX = 45;

export function pomodoroBreaks(workMinutes: number): { short: number; long: number } {
  const short = Math.min(SHORT_MAX, Math.max(SHORT_MIN, Math.round(workMinutes / 5)));
  return { short, long: Math.min(LONG_MAX, short * 3) };
}

const COPY = {
  tr: { rhythm: (m: number) => `${m} dk mola · 4 tur` },
  en: { rhythm: (m: number) => `${m} min break · 4 rounds` },
};

export const pomodoroHint = (workMinutes: number, lang: 'tr' | 'en'): string => COPY[lang].rhythm(pomodoroBreaks(workMinutes).short);

/** Bu süreden uzun seansta ekranı açık tutmak şarjı belirgin yer: bir kez öneri çıkar. */
export const LONG_SESSION_SECONDS = 60 * 60;

export function shouldOfferScreenOff(p: { sessionStarted: boolean; totalSeconds: number; keepAwake: boolean; strict: boolean; notifBlocked: boolean; offered: boolean }): boolean {
  // Bildirim kapalıysa "bitince haber veririz" sözü tutmaz; katı modda ekran zaten açık kalmalı.
  return p.sessionStarted && p.totalSeconds >= LONG_SESSION_SECONDS && p.keepAwake && !p.strict && !p.notifBlocked && !p.offered;
}
