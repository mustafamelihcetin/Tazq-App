import fs from 'fs';
import path from 'path';

/**
 * GİRİŞ/KAYIT SONRASI ÇİFT ANA SAYFA (cihazda görüldü, 2026-10-25).
 *
 * Misafir, kayıt ekranını ana sayfanın ÜSTÜNE açıyor (push). Kayıt bitince
 * `router.replace('/')` kayıt ekranını YENİ bir ana sayfayla değiştiriyordu; eskisi altta
 * kalıyordu → yığında iki ana sayfa. Görünen yenisi arka planda kurulduğu için giriş
 * animasyonları hiç çalışmadı: selamlama görünmez (opaklık 0'da kaldı), sekme vurgusu yok.
 * Geri tuşu ikinci ana sayfayı ortaya çıkarıyordu.
 *
 * Kural: kimlik doğrulama sonrası eve dönüş TEK yoldan — `goHomeAfterAuth` (dismissTo):
 * yığında ana sayfa varsa ona geri döner, yoksa açar.
 */
const ROOT = path.resolve(__dirname, '..');
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), 'utf8');

describe('kimlik doğrulama sonrası eve dönüş', () => {
  it.each(['app/register.tsx', 'app/login.tsx', 'app/verify-email.tsx'])('%s ana sayfayı yeniden kurmaz (replace yok)', (f) => {
    expect(read(f)).not.toMatch(/router\.replace\(\s*['"]\/['"]\s*\)/);
  });

  it('UYGULAMANIN HİÇBİR YERİ ana sayfayı replace ile yeniden kurmaz', () => {
    // Ayarlar → "turları yeniden göster" ve _layout'un giriş koruması da aynı hatayı
    // üretiyordu (cihazda görüldü). Kural tek dosyaya değil, tüm ekranlara.
    const walk = (dir: string): string[] => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })
      .flatMap((e) => e.isDirectory() ? walk(`${dir}/${e.name}`) : /\.tsx?$/.test(e.name) ? [`${dir}/${e.name}`] : []);
    const offenders = ['app', 'features', 'shared'].flatMap(walk)
      .filter((f) => /router\.replace\(\s*['"]\/['"]\s*\)/.test(read(f)));
    expect(offenders).toEqual([]);
  });

  it('ortak yardımcı dismissTo kullanır', () => {
    const src = read('shared/utils/authNavigation.ts');
    expect(src).toContain("dismissTo('/')");
  });
});

describe('selamlama bir animasyona bağlı değil', () => {
  // Görünmezken kurulan ana sayfada opaklık-0 girişi hiç çalışmıyor, selamlama boş kalıyordu.
  it('DashboardHero opaklık 0\'dan başlamaz', () => {
    expect(read('features/dashboard/components/DashboardHero.tsx')).not.toMatch(/from=\{\{\s*opacity:\s*0/);
  });
});

describe('Android geri tuşu sekmeden uygulamayı kapatmaz', () => {
  // Cihazda görüldü: Görevler sekmesinde geri tuşu uygulamadan çıkıyordu (Material: önce eve).
  it('sekme çubuğu odaktaki sekmede geri tuşunu eve yönlendirir', () => {
    const src = read('shared/components/BottomNavBar.tsx');
    expect(src).toContain("addEventListener('hardwareBackPress'");
    expect(src).toContain('useFocusEffect(');
    expect(src).toMatch(/if \(router\.canGoBack\(\)\) return false;\s*goHome\(router\);/);
  });
});
