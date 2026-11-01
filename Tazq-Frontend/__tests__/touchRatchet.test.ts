import fs from 'fs';
import path from 'path';

/**
 * DOKUNUŞ TUTARLILIĞI (B6, 2026-11-01) — her basılabilir aynı yaylı basılmayı ve aynı titreşim
 * eşlemesini ORTAK yerden alır: `shared/components/Touchable` (boyuta göre 0.96/0.98, 150 ms) ve
 * `shared/utils/haptics` (anlamsal API).
 *
 * Denetimde titreşim zaten tek yerdeydi; ham basılabilirler 10 dosyada 18 yerde kaldı ve çoğu
 * meşru (pencere arka planı, giriş alanına odak veren yüzey). Mandal: sayı dosya başına yalnız
 * AZALIR, listede olmayan dosya ham basılabilir EKLEYEMEZ. Temizlenen dosyanın satırı silinir.
 */
const ROOT = path.join(__dirname, '..');
const RAW = /<(TouchableOpacity|TouchableHighlight|Pressable)\b/g;

const CEILING: Record<string, number> = {
  'app/admin.tsx': 1,                                  // tam ekran perde
  'app/login.tsx': 3,                                  // şifre göster, yeniden gönder (form içi küçük bağlantılar)
  'app/register.tsx': 1,
  'app/settings.tsx': 1,                               // şifre göster
  'app/verify-email.tsx': 2,
  'features/modes/components/ModeField.tsx': 1,         // alanı odaklayan yüzey
  'features/tasks/components/QuickAddSheet.tsx': 1,     // alanı odaklayan yüzey (erişilebilir değil)
  'features/tasks/components/TaskFormModal.tsx': 3,
  'features/user/components/ReviewPromptModal.tsx': 3,
  'shared/components/PeekMenu.tsx': 1,                  // perde
};

function walk(dir: string): string[] {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name).replace(/\\/g, '/')) : /\.tsx?$/.test(e.name) ? [`${dir}/${e.name}`.replace(/\\/g, '/')] : []);
}
const FILES = ['app', 'features', 'shared'].flatMap(walk);

describe('dokunuş mandalı', () => {
  it('ham basılabilir sayısı dosya başına artmaz; yeni dosya ekleyemez', () => {
    const offenders: string[] = [];
    for (const f of FILES) {
      if (f === 'shared/components/Touchable.tsx') continue;
      const n = (fs.readFileSync(path.join(ROOT, f), 'utf8').match(RAW) ?? []).length;
      if (n > (CEILING[f] ?? 0)) offenders.push(`${f}: ${n} > ${CEILING[f] ?? 0}`);
    }
    expect(offenders).toEqual([]);
  });

  it('tavan bayatlamaz — temizlenen dosyanın satırı silinir', () => {
    const stale = Object.entries(CEILING).filter(([f, max]) => {
      const p = path.join(ROOT, f);
      return !fs.existsSync(p) || (fs.readFileSync(p, 'utf8').match(RAW) ?? []).length < max;
    }).map(([f]) => f);
    expect(stale).toEqual([]);
  });

  it('titreşim yalnız ortak eşlemeden (expo-haptics doğrudan içe aktarılmaz)', () => {
    const offenders = FILES.filter((f) => f !== 'shared/utils/haptics.ts'
      && /from ['"]expo-haptics['"]/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
    expect(offenders).toEqual([]);
  });
});
