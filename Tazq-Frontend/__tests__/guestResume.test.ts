import fs from 'fs';
import path from 'path';
import { shouldAbandonGuest } from '@/features/onboarding/utils/guestResume';

/*
  MİSAFİR HOŞ GELDİNİ (2026-11-01, kullanıcı: "hesapsız giriş yapılıyorsa her girişinde profilini oluştur
  gelmesin; doldurmadan kapatıyorsa tekrar loginden devam etmeli · splash screenden önce geldi").
*/
const ROOT = path.resolve(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

describe('yarım kalan misafirlik', () => {
  it('hoş geldini bitirmemiş misafir açılışta bırakılır → giriş ekranı', () => {
    expect(shouldAbandonGuest({ isGuest: true, isLoggedIn: false, welcomeStatus: 'pending' })).toBe(true);
  });

  it('hoş geldini bitirmiş misafir devam eder; hesabı olan etkilenmez', () => {
    expect(shouldAbandonGuest({ isGuest: true, isLoggedIn: false, welcomeStatus: 'done' })).toBe(false);
    expect(shouldAbandonGuest({ isGuest: false, isLoggedIn: true, welcomeStatus: 'pending' })).toBe(false);
    expect(shouldAbandonGuest({ isGuest: false, isLoggedIn: false, welcomeStatus: 'pending' })).toBe(false);
  });

  it('karar yalnız soğuk açılışta, bir kez ve üç depo da diskten okunduktan sonra uygulanır', () => {
    const hook = read('features/onboarding/hooks/useGuestResume.ts');
    expect(hook).toContain('if (checked.current || !authReady || !sessionReady || !prefsReady) return;');
    expect(hook).toContain('checked.current = true;');
    expect(hook).toContain("prefs.setWelcomeStatus('unknown');");
    const layout = read('app/_layout.tsx');
    expect(layout).toContain('useGuestResume();');
    // Misafirlik bitince auth kapısı (isGuest bağımlılığıyla) giriş ekranına götürür.
    expect(layout).toMatch(/\}, \[_hasHydrated, isLoggedIn, isGuest, segments\]\);/);
  });

  it('hoş geldin açılış animasyonu bitmeden açılmaz (Modal açılışın üstüne biniyordu)', () => {
    expect((read('app/index.tsx') + read('features/dashboard/hooks/useHomeModel.tsx'))).toContain("if (welcomeStatus === 'pending' && !welcomeSetupShown && splashDone) {");
  });
});
