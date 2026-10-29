/**
 * KLAVYE YAZI ALANINI ÖRTMEZ — uygulama genelinde (kullanıcı: "amatör bir hata").
 *
 * Kök neden: Android'de "pencere zaten küçülür" varsayımıyla klavye korumaları yalnız
 * iOS'ta açıktı. Uygulama kenardan kenara (edge-to-edge) çizildiğinden beri Android
 * pencereyi KÜÇÜLTMÜYOR; hızlı taslak, görev formu ve mod kurulumu klavyenin altında
 * kalıyordu (cihazda görüldü, 2026-10-29). Bu mandal o varsayımın geri gelmesini önler.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const walk = (d: string): string[] => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? walk(`${d}/${e.name}`) : /\.tsx$/.test(e.name) ? [`${d}/${e.name}`] : []);
const FILES = ['app', 'features', 'shared'].flatMap(walk).map(f => [f, fs.readFileSync(path.join(ROOT, f), 'utf8')] as const);

describe('klavye koruması iki platformda', () => {
  it('KeyboardAvoidingView Android\'de kapatılmaz', () => {
    const bad = FILES.filter(([, s]) => /behavior=\{Platform\.OS === 'ios' \? 'padding' : (undefined|'height')\}/.test(s)).map(([f]) => f);
    expect(bad).toEqual([]);
  });

  it('klavye yüksekliği yalnız iOS\'ta uygulanmaz', () => {
    const bad = FILES.filter(([, s]) => /Platform\.OS === 'ios' \? (keyboardHeight|kbHeight)\b/.test(s)).map(([f]) => f);
    expect(bad).toEqual([]);
  });

  it('alttan açılan ve yazı alanı olan her Modal bir klavye koruması taşır', () => {
    const bad = FILES.filter(([, s]) => s.includes('<Modal') && s.includes('<TextInput') && /justifyContent: 'flex-end'/.test(s)
      && !/KeyboardAvoidingView|useKeyboardHeight|kbHeight/.test(s)).map(([f]) => f);
    expect(bad).toEqual([]);
  });
});
