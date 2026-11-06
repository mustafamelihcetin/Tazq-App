import fs from 'fs';
import path from 'path';
import { advance, DIAL_MAX } from '@/features/focus/components/DurationDial';
import { LONG_SESSION_SECONDS, pomodoroBreaks, pomodoroHint, shouldOfferScreenOff } from '@/features/focus/utils/pomodoroRhythm';

const src = fs.readFileSync(path.join(__dirname, '../app/focus.tsx'), 'utf8');

describe('Pomodoro ritmi', () => {
  it('mola çalışmadan türer', () => {
    expect(pomodoroBreaks(25)).toEqual({ short: 5, long: 15 });
    expect(pomodoroBreaks(50)).toEqual({ short: 10, long: 30 });
    expect(pomodoroBreaks(15)).toEqual({ short: 3, long: 9 });
  });
  it('uçlarda sınır: 1 dakikada bile mola var, 120 dakikada abartmaz', () => {
    expect(pomodoroBreaks(1).short).toBe(3);
    expect(pomodoroBreaks(120)).toEqual({ short: 24, long: 45 });
  });
  it('kadran Pomodoro açıkken de döner, serbest seans durağı yok', () => {
    expect(src).toContain("!sessionStarted && !(pomodoroMode && pomodoroPhase === 'break') && (");
    expect(src).toContain('allowOpen={!pomodoroMode}');
    expect(advance(DIAL_MAX, 0, 0.5, DIAL_MAX)).toBe(DIAL_MAX);
  });
  it('kadranda mola görünür', () => {
    expect(pomodoroHint(25, 'tr')).toBe('5 dk mola · 4 tur');
    expect(pomodoroHint(50, 'en')).toBe('10 min break · 4 rounds');
  });
});

describe('uzun seansta ekran', () => {
  const base = { sessionStarted: true, totalSeconds: LONG_SESSION_SECONDS, keepAwake: true, strict: false, notifBlocked: false, offered: false };
  it('uzun seansta bir kez önerir', () => {
    expect(shouldOfferScreenOff(base)).toBe(true);
    expect(shouldOfferScreenOff({ ...base, offered: true })).toBe(false);
  });
  it('kısa seansta, ekran zaten kapanabilirken ya da katı modda sormaz', () => {
    expect(shouldOfferScreenOff({ ...base, totalSeconds: 25 * 60 })).toBe(false);
    expect(shouldOfferScreenOff({ ...base, keepAwake: false })).toBe(false);
    expect(shouldOfferScreenOff({ ...base, strict: true })).toBe(false);
  });
  it('bildirim kapalıysa "haber veririz" sözü verilmez', () => {
    expect(shouldOfferScreenOff({ ...base, notifBlocked: true })).toBe(false);
  });
  it('seçenek seans içinde görünür, katı modda yok', () => {
    expect(src).toContain('sessionStarted && !strictMode && (');
    expect(src).toContain('<ScreenAwakeChip');
  });
});
