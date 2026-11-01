import fs from 'fs';
import path from 'path';
import { ambientAction, shouldResumeOnFocus } from '@/features/focus/utils/ambientPlan';
import { ambientStatusText } from '@/features/focus/components/AmbientStatus';

/*
  ODAK ORTAM SESİ (2026-11-01, kullanıcı: "seslerin odak varken ve yokken düzgün çalmasını, durmasını,
  bugda kalmamasını sağla" · "ne zaman çalıyor çalmıyor anlamak zor, daha iyi sunum lazım").
*/
const ROOT = path.resolve(__dirname, '..');
const FOCUS = fs.readFileSync(path.join(ROOT, 'app/focus.tsx'), 'utf8');

describe('ses kararı (ambientAction)', () => {
  it('seans başlar → seçili ses çalar; "Sessiz" ise durur', () => {
    expect(ambientAction({ wasActive: false, isActive: true, sound: 'rain' })).toBe('play');
    expect(ambientAction({ wasActive: false, isActive: true, sound: 'off' })).toBe('stop');
  });

  it('seans sürerken ses değişir → yenisi çalar', () => {
    expect(ambientAction({ wasActive: true, isActive: true, sound: 'wind' })).toBe('play');
  });

  it('duraklatma / bitiş / sıfırlama → yumuşakça susar (eskiden duraklatınca çalmaya DEVAM ediyordu)', () => {
    expect(ambientAction({ wasActive: true, isActive: false, sound: 'rain' })).toBe('fadeOut');
  });

  it('seans yokken ses seçmek → karar önizlemeye karışmaz (düğme 7 sn çalar)', () => {
    expect(ambientAction({ wasActive: false, isActive: false, sound: 'rain' })).toBe('none');
    expect(ambientAction({ wasActive: false, isActive: false, sound: 'off' })).toBe('stop');
  });

  it('ekrana dönüş: seans sürüyor, ses seçili ve çalan yoksa geri gelir (eskiden sessiz kalıyordu)', () => {
    expect(shouldResumeOnFocus({ isActive: true, sound: 'rain', playing: false })).toBe(true);
    expect(shouldResumeOnFocus({ isActive: true, sound: 'rain', playing: true })).toBe(false);
    expect(shouldResumeOnFocus({ isActive: false, sound: 'rain', playing: false })).toBe(false);
    expect(shouldResumeOnFocus({ isActive: true, sound: 'off', playing: false })).toBe(false);
  });
});

describe('durum satırı: seçili ≠ çalıyor', () => {
  const base = { sound: 'Yağmur', sessionActive: false, paused: false, language: 'tr' as const };
  it.each([
    [{ ...base, sound: null, audible: 'off' as const }, 'Ses kapalı'],
    [{ ...base, audible: 'preview' as const }, 'Yağmur önizlemesi · seans başlayınca sürer'],
    [{ ...base, audible: 'off' as const }, 'Yağmur seçili · seans başlayınca çalar'],
    [{ ...base, paused: true, audible: 'off' as const }, 'Yağmur seçili · devam edince çalar'],
    [{ ...base, sessionActive: true, audible: 'session' as const }, 'Yağmur çalıyor'],
  ])('%j → %s', (p, text) => {
    expect(ambientStatusText(p)).toBe(text);
  });
});

describe('odak ekranı kararı uygular', () => {
  it('tek karar yeri + ekrana dönüşte geri getirme', () => {
    expect(FOCUS).toContain('ambientAction({ wasActive: wasActiveRef.current, isActive, sound: ambientSound })');
    expect(FOCUS).toContain("else if (action === 'fadeOut') stopAmbientSoundFaded();");
    expect(FOCUS).toContain('shouldResumeOnFocus({');
  });

  it('seans bitince ya da sıfırlanınca TERCİH silinmez (her seansta yeniden seçmek gerekiyordu)', () => {
    expect(FOCUS).not.toMatch(/stopAmbientSound(Faded)?\(\);[^\n]*\n\s*setAmbientSound\('off'\)/);
  });

  it('gecikmesiz: susan çalar bırakılmaz, aynı ses yeniden istenince yüklenmez; seçili ses önceden yüklenir', () => {
    // Susturma çaları duraklatır, bırakmaz.
    const faded = FOCUS.slice(FOCUS.indexOf('const stopAmbientSoundFaded'), FOCUS.indexOf('const preloadAmbient'));
    expect(faded).toContain('player.pause();');
    expect(faded).not.toContain('release()');
    // Aynı ses yüklüyse yeniden kullanılır.
    expect(FOCUS).toContain('const reuse = soundRef.current && currentSoundTypeRef.current === type ? soundRef.current : null;');
    expect(FOCUS).toContain("else if (action === 'none' && !previewTimerRef.current) preloadAmbient(ambientSound);");
    // Ekrana dönüşte "çalıyor mu" yüklü çalara değil, gerçekten çalmasına bakar.
    expect(FOCUS).toContain('playing: !!soundRef.current?.playing');
  });

  it('çalan sesin simgesi kendi karakteriyle hareket eder, altta durum satırı var; seçili ama susmuş sese dokunmak önizlemeyi yeniden çalar', () => {
    expect(FOCUS).toContain('const playing = active && audible !== \'off\';');
    expect(FOCUS).toContain('<SoundIcon kind={type as SoundKind} size={14} color={theme.primary} />');
    expect(FOCUS).toContain('<AmbientStatus');
    expect(FOCUS).toContain('const next = active && (isActive || playing) ? \'off\' : type;');
  });

  it('Rüzgar ayrı bir seçenek; her sesin dosyası var ve stereo kayıt boyutunda', () => {
    for (const s of ['rain', 'wind', 'forest', 'ocean', 'fireplace', 'cafe', 'relaxing', 'binaural', 'brown']) {
      expect(FOCUS).toContain(`require('../assets/sounds/${s}.m4a')`);
      expect(fs.statSync(path.join(ROOT, `assets/sounds/${s}.m4a`)).size).toBeGreaterThan(500_000);
    }
    expect(FOCUS).toContain("wind:      { icon: Wind,       labelTr: 'Rüzgar'");
  });

  it('nefes YAZILI ve görünür: seans başlamadan, başlatın altında (yalnız simge ne olduğunu söylemiyordu)', () => {
    expect(FOCUS).toMatch(/\{!sessionStarted && \([\s\S]{0,600}Başlamadan önce 1 dakika nefes/);
    // Saf gezinme titreşmez (bkz. haptics.test); doğrudan 1 dk sakinleşme açılır.
    expect(FOCUS).toContain("onPress={() => router.push('/nefes?p=sigh&m=1')}");
  });
});

describe('odak ekranı başlığı duruma göre', () => {
  const { focusTitle } = require('@/features/focus/utils/focusTitle');
  it.each([
    [{ inBreak: false, pomodoroMode: false, language: 'tr' }, 'ODAK'],
    [{ inBreak: true, pomodoroMode: false, language: 'tr' }, 'MOLA'],
    [{ inBreak: true, pomodoroMode: true, language: 'tr' }, 'MOLA'],
    [{ inBreak: false, pomodoroMode: true, language: 'tr' }, 'POMODORO'],
    [{ inBreak: false, pomodoroMode: false, language: 'en' }, 'FOCUS'],
  ])('%j → %s', (p, title) => {
    expect(focusTitle(p)).toBe(title);
  });

  it('"DERİN ODAK" her durumda yazmıyor', () => {
    expect(FOCUS).toContain('{focusTitle({ inBreak, pomodoroMode, language })}');
    expect(FOCUS).not.toContain('t.focusLabel || t.deepFocus');
  });
});
