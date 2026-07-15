import fs from 'fs';
import path from 'path';
import {
  navBarSpace,
  NAV_BAR_HEIGHT,
  NAV_BAR_LIFT,
  NAV_BAR_MIN_INSET,
  topBarSpace,
  TOP_BAR_HEIGHT,
  TOP_BAR_LIFT,
  S,
} from '@/shared/constants/tokens';

/**
 * Yüzen navbar'ın altında içerik kaybolmasın.
 *
 * Navbar `position: absolute` — scroll içeriği onun altından geçer. Sayfa dibinde onun
 * kapladığı kadar boşluk bırakılmazsa son öğeye ULAŞILAMAZ. Sessiz bir hata: kod
 * çalışır, test geçer, tsc susar; sadece kullanıcı en alta inemez.
 *
 * Beş sayfanın beşi de yanlıştı ve her biri AYRI tahmin etmişti:
 *   index/tasks/profile/cockpit → S.xxl (64)          → 42pt gizli
 *   modlar                      → S.xxl + inset (98)  → 8pt gizli
 * Yani kimse ölçmemiş, herkes uydurmuş. Çözüm sayıyı düzeltmek değil, tahmini
 * imkânsız kılmak: yükseklik navbar'ın kendi dosyasında, sayfalar ondan türetiyor.
 */

const ROOT = path.resolve(__dirname, '..');

describe('navBarSpace hesabı', () => {
  it('navbar’ın kapladığı alanı doğru verir', () => {
    // home göstergeli iPhone: 34 + 4 + 68 = 106
    expect(navBarSpace(34)).toBe(34 + NAV_BAR_LIFT + NAV_BAR_HEIGHT);
    expect(navBarSpace(34)).toBe(106);
  });

  it('gösterge yokken taban boşluğa düşer', () => {
    // inset 0 → max(0,16)=16 → 16 + 4 + 68 = 88. Bar ekranın dibine yapışmaz.
    expect(navBarSpace(0)).toBe(NAV_BAR_MIN_INSET + NAV_BAR_LIFT + NAV_BAR_HEIGHT);
    expect(navBarSpace(0)).toBe(88);
  });

  it('inset büyüdükçe boşluk büyür — asla küçülmez', () => {
    expect(navBarSpace(50)).toBeGreaterThan(navBarSpace(34));
    expect(navBarSpace(0)).toBeLessThanOrEqual(navBarSpace(16));
  });

  it('eski sabit (S.xxl ≈ 64) yetersizdi — regresyon kaydı', () => {
    // Bu test hatayı BELGELİYOR: 64 yazmak her cihazda eksik kalıyordu.
    // Sayı tekrar sabitlenirse aşağıdaki test kırılır; bu ise nedenini anlatır.
    expect(navBarSpace(34)).toBeGreaterThan(64);
    expect(navBarSpace(0)).toBeGreaterThan(64);
  });
});

describe('topBarSpace hesabı', () => {
  it('başlığın kapladığı alanı doğru verir', () => {
    // insets.top + 8 (yükselti) + 54 (bar) = insets.top + 62
    expect(topBarSpace(59)).toBe(59 + TOP_BAR_LIFT + TOP_BAR_HEIGHT);
  });

  it('eski sabit (S.xxl ≈ 64) payı 2pt’ye düşürüyordu — regresyon kaydı', () => {
    // Başlık insets.top + 62 kaplarken sayfalar insets.top + 64 bırakıyordu.
    // tasks/cockpit/modlar'da ilk öğe barın 2pt altındaydı, yani değiyordu.
    // (index farkı görüp hero'ya elle marginTop eklemişti — yama, çözüm değil.)
    // Ölçekten BAĞIMSIZ ifade: S.xxl geniş ekranda 64 değil 72 olur, o yüzden çıplak
    // sayı yazmak testi cihaza bağlar. Bulgu şu: eski sabit, başlığın altında bir
    // nefes payı (S.md) bile bırakmıyordu.
    expect(S.xxl - topBarSpace(0)).toBeLessThan(S.md);
    // Yeni değer o payı sağlıyor (sayfalar üstüne ayrıca S.lg ekliyor).
    expect(topBarSpace(0)).toBe(TOP_BAR_LIFT + TOP_BAR_HEIGHT);
  });

  it('durum çubuğu büyüdükçe boşluk büyür', () => {
    expect(topBarSpace(59)).toBeGreaterThan(topBarSpace(20));
  });
});

/**
 * Yüzen başlığı olan sayfalar — ortak bileşenle ya da kendi kopyasıyla.
 * TEK tespit: eskiden her blok kendi taramasını yapıyordu ve index göç edince biri
 * onu kaçırdı. Aynı soruya iki yerde cevap aranırsa er geç ayrışır.
 */
const headerScreens = fs
  .readdirSync(path.join(ROOT, 'app'))
  .filter((f) => f.endsWith('.tsx'))
  .filter((f) => {
    const src = fs.readFileSync(path.join(ROOT, 'app', f), 'utf8');
    return src.includes('<ScreenHeader') || /topBarContent: \{/.test(src);
  });

describe('sayfa üstü boşluğu', () => {
  it('yüzen başlıklı sayfalar bulunmalı — tarama boşa düşmemeli', () => {
    expect(headerScreens.length).toBe(4);
  });

  it.each(headerScreens)('%s üstünü topBarSpace’ten türetmeli', (file) => {
    const src = fs.readFileSync(path.join(ROOT, 'app', file), 'utf8');
    expect(src).toMatch(/paddingTop:\s*topBarSpace\(/);
  });
});

describe('başlık kutusu', () => {
  // Bir sayfa başlığı ya ortak bileşenle çizer (doğru, yapısal) ya da KENDİ kopyasıyla
  // (miras — göç edene kadar en azından aynı yüksekliği kullanmalı).
  const read = (f: string) => fs.readFileSync(path.join(ROOT, 'app', f), 'utf8');
  const appFiles = fs.readdirSync(path.join(ROOT, 'app')).filter((f) => f.endsWith('.tsx'));

  const shared = appFiles.filter((f) => read(f).includes('<ScreenHeader'));

  it('dört sayfa da ortak başlığı kullanmalı', () => {
    // Başlık dört dosyada AYRI tanımlıydı; kopyalar ayrışıp boyları farklılaşmıştı
    // (index 54pt, diğerleri ~40pt), çünkü yükseklik içerikten doğuyordu.
    // Artık dördü tek bileşenden çiziyor: eşitlik yapısal, ayrışmaları imkânsız.
    expect(shared.sort()).toEqual(['cockpit.tsx', 'index.tsx', 'modlar.tsx', 'tasks.tsx']);
  });

  it('hiçbir sayfa kendi başlık kopyasını taşımamalı', () => {
    // Ölü stil bırakmak yalnızca çöp değil: bir sayfanın "kendi başlığı var" gibi
    // görünmesine yol açar ve taramaları yanıltır (bu testin eski hâli tam olarak
    // buna kandı — index göç ettiği hâlde geriye kalan ölü stili görüp yeşil yandı).
    for (const f of appFiles) {
      expect({ file: f, own: /floatingTopBar|topBarContent: \{/.test(read(f)) }).toEqual({
        file: f,
        own: false,
      });
    }
  });

  it('başlık yüksekliği sabit olmalı — içerikten doğmamalı', () => {
    const src = fs.readFileSync(path.join(ROOT, 'shared/components/ScreenHeader.tsx'), 'utf8');

    // Kural dosyanın TAMAMINA değil, içerik stiline uygulanır: dosyanın doküman
    // yorumu "eskiden paddingVertical vardı" diye ANLATIYOR ve kaba bir arama bunu
    // kuralın ihlali sanıyor. (Aynı tuzağa BentoCard gölge testinde de düşmüştüm.)
    const style = /content: \{[^}]*\}/.exec(src);
    expect(style).not.toBeNull();

    // İçerikten doğan yükseklik, başlığa bir öğe eklendiğinde sayfaların üst boşluk
    // hesabını sessizce bozar (bkz. topBarSpace).
    expect(style![0]).toContain('height: TOP_BAR_HEIGHT');
    expect(style![0]).not.toContain('paddingVertical');
  });
});

describe('sayfa dibi boşluğu', () => {
  // Navbar çizen her sayfa dibini navBarSpace'ten türetmeli.
  const screens = fs
    .readdirSync(path.join(ROOT, 'app'))
    .filter((f) => f.endsWith('.tsx'))
    .filter((f) => fs.readFileSync(path.join(ROOT, 'app', f), 'utf8').includes('<BottomNavBar'));

  it('navbar’lı sayfalar bulunmalı — tarama boşa düşmemeli', () => {
    // Bu test alttakinin bekçisi: dosya düzeni değişip liste boşalırsa alttaki test
    // hiçbir şey denemeden yeşil yanar. Sessiz geçen test, testsizlikten kötüdür.
    expect(screens.length).toBeGreaterThanOrEqual(5);
  });

  it.each(screens)('%s dibini navBarSpace’ten türetmeli', (file) => {
    const src = fs.readFileSync(path.join(ROOT, 'app', file), 'utf8');

    // Sayfanın ANA scroll'u: contentContainerStyle içinde paddingBottom.
    // Yatay filtre şeritleri gibi iç scroll'lar navbar'a değmez — onlar hariç,
    // bu yüzden yalnızca navBarSpace'in HİÇ geçmediği durumu hata sayıyoruz.
    expect(src).toMatch(/paddingBottom:\s*navBarSpace\(/);
  });
});
