import fs from 'fs';
import path from 'path';
import {
  navBarSpace,
  NAV_BAR_HEIGHT,
  NAV_BAR_LIFT,
  NAV_BAR_MIN_INSET,
  NAV_ICON_SIZE,
  NAV_LABEL_SIZE,
  topBarSpace,
  TOP_BAR_HEIGHT,
  TOP_BAR_LIFT,
  TOP_TITLE_SIZE,
  TOP_ITEM_SIZE,
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

describe('navBarSpace hesabi', () => {
  /**
   * Bar artik YUZMUYOR: ekranin dibine yapisik, tam genislikte standart sekme cubugu
   * (yuzen pill + arkadaki kayan hap kaldirildi). Dolayisiyla kapladigi alan
   * "icerik yuksekligi + guvenli alan" oldu; yukselti (LIFT) sifir.
   *
   * DEGISMEYEN GUVENCE: navBarSpace, barin GERCEKTEN kapladigi yuksekligi vermeli.
   * Yanlissa son gorev barin arkasinda kalir ve kullanici ona ULASAMAZ — sessiz hata:
   * kod calisir, tsc susar, test gecer.
   */
  it('navbar in kapladigi alani dogru verir — Apple olcusu', () => {
    // UIKit UITabBar: icerik 49pt, guvenli alan (home gostergesi 34pt) ALTINA eklenir.
    // iPhone'da toplam 83pt — Apple'in kendi sayisi.
    expect(navBarSpace(34)).toBe(34 + NAV_BAR_LIFT + NAV_BAR_HEIGHT);
    expect(navBarSpace(34)).toBe(83);
  });

  it('home gostergesi yoksa cubuk dibe tam yapisir', () => {
    // inset 0 -> 0 + 0 + 49 = 49. Apple da ekstra pay EKLEMEZ (iPhone SE davranisi).
    expect(navBarSpace(0)).toBe(NAV_BAR_MIN_INSET + NAV_BAR_LIFT + NAV_BAR_HEIGHT);
    expect(navBarSpace(0)).toBe(49);
  });

  it('Apple sekme cubugu olculeri korunur', () => {
    // Bu uc sayi tasarim karari, tahmin degil. Degistirilirse bilincli olsun.
    expect(NAV_BAR_HEIGHT).toBe(49);   // UITabBar standart icerik yuksekligi
    expect(NAV_BAR_LIFT).toBe(0);      // yuzmez, dibe yapisik
    expect(NAV_BAR_MIN_INSET).toBe(0); // ekstra nefes payi yok
  });

  it('cubuk icerigi OLCEKLENMEZ — kap sabitken icerik buyuyemez', () => {
    /**
     * Gercek bir hata: yukseklik ham 49 iken ikon ICON.lg (moderateScale) ve etiket
     * olcekli yazilmisti. Ekran genisledikce icerik buyuyor, kap buyumuyordu:
     * 430pt telefonda yigin 41.2pt, tablette 43.1pt -> ust/alt pay 3pt (sikisik).
     * Apple'da sekme cubugunun ucu de sabittir; cubuk icerik degil CHROME'dur.
     */
    expect(NAV_ICON_SIZE).toBe(22);
    expect(NAV_LABEL_SIZE).toBe(10);
    // Yigin (ikon + 2pt bosluk + ~1.25em satir) cubuga nefes payiyla sigmali.
    const stack = NAV_ICON_SIZE + 2 + NAV_LABEL_SIZE * 1.25;
    expect(NAV_BAR_HEIGHT - stack).toBeGreaterThanOrEqual(8); // ust+alt toplam >= 8pt

    const src = fs.readFileSync(path.join(ROOT, 'shared/components/BottomNavBar.tsx'), 'utf8');
    expect(src).toContain('size={NAV_ICON_SIZE}');
    expect(src).toContain('fontSize: NAV_LABEL_SIZE');
    // Olcekli token'lar cubukta kullanilmamali.
    expect(src).not.toMatch(/size=\{ICON\./);
    expect(src).not.toMatch(/fontSize: F\./);
  });

  it('inset buyudukce bosluk buyur — asla kucumez', () => {
    expect(navBarSpace(50)).toBeGreaterThan(navBarSpace(34));
    expect(navBarSpace(0)).toBeLessThanOrEqual(navBarSpace(16));
  });

  it('bar dibe yapisik: yukselti yok', () => {
    // Yuzen tasarimin kalintisi geri gelirse burasi kirilir.
    expect(NAV_BAR_LIFT).toBe(0);
  });

  it('bosluk her zaman barin icerik yuksekliginden buyuk', () => {
    // Eski regresyon kaydi ("64 yetersizdi") yuzen tasarima ozeldi ve artik gecersiz;
    // yerine olcekten bagimsiz gercek degismez: bosluk >= icerik + taban pay.
    for (const inset of [0, 8, 20, 34, 50]) {
      expect(navBarSpace(inset)).toBeGreaterThanOrEqual(NAV_BAR_HEIGHT + NAV_BAR_MIN_INSET);
    }
  });

  it('bilesen kendi olcusunu tokenlardan kurar — sayfa ile ayrisamaz', () => {
    const src = fs.readFileSync(path.join(ROOT, 'shared/components/BottomNavBar.tsx'), 'utf8');
    expect(src).toContain('NAV_BAR_HEIGHT');
    expect(src).toContain('NAV_BAR_MIN_INSET');
    // Dibe yapisik olmali: yan bosluk/yuvarlak kabuk yok, ust ayrac cizgisi var.
    expect(src).toMatch(/bottom: 0/);
    expect(src).toContain('borderTopWidth: HAIRLINE');
  });
});

describe('topBarSpace hesabı', () => {
  it('başlığın kapladığı alanı doğru verir', () => {
    // insets.top + 8 (yükselti) + 54 (bar) = insets.top + 62
    expect(topBarSpace(59)).toBe(59 + TOP_BAR_LIFT + TOP_BAR_HEIGHT);
  });

  it('Apple nav bar olculeri korunur', () => {
    /**
     * Baslik cubugu da sekme cubugu gibi CHROME: dibe/ustune yapisik, tam genislikte,
     * hairline ayracli. Eski hal 54pt yuzen bir pill'di ve 54 sayisi ICERIKTEN
     * turetilmisti (StatusHub 38 + 2x8) — kacinilmak istenen seyin ta kendisi.
     * UIKit standardi 44pt; baslik 17pt semibold.
     *
     * NOT: eski "S.xxl (64) yetersizdi" regresyon kaydi 54pt YUZEN cubuga ozeldi
     * (o zaman bar insetTop + 62 kapliyordu, sayfalar 64 birakiyordu -> 2pt pay).
     * 44pt yapisik cubukta o kosul artik gecerli degil; yerine olculer cakiliyor.
     */
    expect(TOP_BAR_HEIGHT).toBe(44);
    expect(TOP_BAR_LIFT).toBe(0);        // yuzmez
    expect(TOP_TITLE_SIZE).toBe(17);     // Apple nav bar basligi
    expect(topBarSpace(0)).toBe(TOP_BAR_LIFT + TOP_BAR_HEIGHT);
  });

  it('baslik OLCEKLENMEZ ve tipografi bilesende — ekranlar ayrisamaz', () => {
    /**
     * Ekranlar basligi kendi `center` yuvasina F.title3 + adjustsFontSizeToFit ile
     * yaziyordu. Sonuc: ayni baslik dar ekranda ~14pt, genis ekranda ~20pt ciziliyordu
     * — sabit yuksekligin sagladigi tutarliligi baslik boyutu geri bozuyordu.
     */
    // Yorumlardaki gerekce metni sayilmasin (eski yaklasimdan SOZ etmek serbest).
    const strip = (src: string) =>
      src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n')
        .filter((l) => !l.trim().startsWith('//'))
        .join('\n');
    const hdr = strip(fs.readFileSync(path.join(ROOT, 'shared/components/ScreenHeader.tsx'), 'utf8'));
    expect(hdr).toContain('fontSize: TOP_TITLE_SIZE');
    expect(hdr).not.toMatch(/adjustsFontSizeToFit/);
    expect(hdr).toContain('borderBottomWidth: HAIRLINE');
    // Golge yok: koyu temada eski golge `primary` renkliydi (mavi parilti).
    expect(hdr).not.toMatch(/shadowOpacity/);

    // Ekranlar artik `title=` kullanir, kendi Text'ini yazmaz.
    // Sabit karakter penceresi kirilgandi (tasks'in `left` yuvasi tek basina 400+):
    // ScreenHeader blogunu bastan kapanisina kadar cikar.
    // `/>` ile kesmek YANLIŞTI: yuvaların içindeki her self-closing JSX (ör.
    // `<X size={ICON.lg} />`) blogu erken bitiriyordu. Kapanış, KENDİ girintisinde
    // tek başına duran `/>` satırıdır.
    const headerBlock = (src: string) => {
      const lines = src.split('\n');
      const start = lines.findIndex((l) => l.includes('<ScreenHeader'));
      if (start < 0) return '';
      const end = lines.findIndex((l, i) => i > start && l.trim() === '/>');
      return lines.slice(start, end < 0 ? undefined : end).join('\n');
    };
    for (const f of ['tasks.tsx', 'cockpit.tsx', 'modlar.tsx']) {
      const block = headerBlock(fs.readFileSync(path.join(ROOT, 'app', f), 'utf8'));
      expect({ file: f, usesTitle: /title=\{/.test(block) }).toEqual({ file: f, usesTitle: true });
      // Baslik puntosu ekranda YAZILMAZ — bilesende.
      expect({ file: f, ownTitleType: /adjustsFontSizeToFit/.test(block) }).toEqual({ file: f, ownTitleType: false });
    }
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

describe('baslik cubugu ogeleri', () => {
  /**
   * "Sikismislik" hissinin olculmus sebebi: baslik ogeleri 54pt'lik ESKI cubuga gore
   * boyutlanmisti. Cubuk Apple olcusu 44pt'ye inince
   *   · TAZQ logosu (30 + 2x12 bosluk = 54.5pt) cubuga TASTI,
   *   · avatar scale(34) ≈ 40.4pt olup kenara 1.8pt birakti,
   *   · StatusHub 38pt olup 3pt birakti.
   * Apple'in bar button item'i ~24-30pt gorseldir; cubugu doldurmaz, icinde nefes alir.
   * Dokunma hedefi ayri ve her zaman 44pt.
   */
  it('oge olcusu cubuga nefes payi birakir', () => {
    // 30 -> 32: cubuktaki kelime isareti kalkinca geriye iki KENAR ogesi kaldi
    // (avatar ve durum rozeti) ve ikisi ayni olcuye getirildi. Bkz. TOP_AVATAR_SIZE.
    expect(TOP_ITEM_SIZE).toBe(32);
    // Ust + alt toplam en az 12pt (her yanda >= 6pt).
    expect(TOP_BAR_HEIGHT - TOP_ITEM_SIZE).toBeGreaterThanOrEqual(12);
  });

  it('baslik ogeleri OLCEKLENMEZ — chrome her cihazda ayni', () => {
    // Yorumlardaki gerekce metni sayilmasin (eski olcuden SOZ etmek serbest).
    const strip = (src: string) =>
      src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n')
        .filter((l) => !l.trim().startsWith('//'))
        .join('\n');
    const src = strip(fs.readFileSync(path.join(ROOT, 'app/index.tsx'), 'utf8'));
    // scale(34) tablette 42.5'e cikiyordu; 44pt cubukta kabul edilemez.
    expect(src).not.toMatch(/scale\(34\)/);
    expect(src).toContain('TOP_ITEM_SIZE');
    const hub = fs.readFileSync(path.join(ROOT, 'shared/components/StatusHub.tsx'), 'utf8');
    expect(hub).toContain('const HUB = TOP_ITEM_SIZE;');
  });
});

describe('sayfa üstü boşluğu', () => {
  it('ortak başlıklı sayfalar bulunmalı — tarama boşa düşmemeli', () => {
    // 4 -> 9: alt sayfalar da (settings/report/archive/legal/mod-ozet) ortak başlığa
    // taşındı. Her biri kendi satırını çiziyordu ve başlık puntosu 14–30pt arasında
    // dağılmıştı; ana ekranlar 17pt olunca alt sayfaya inince başlık BÜYÜYORDU.
    expect(headerScreens.length).toBe(9);
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

  it('başlığı olan HER sayfa ortak bileşeni kullanmalı', () => {
    // Başlık önce dört dosyada AYRI tanımlıydı; kopyalar ayrışıp boyları farklılaşmıştı.
    // Sonra alt sayfalar da katıldı: settings 22pt, archive 22pt, report 20pt,
    // legal 14pt(!), mod-ozet kendi çöken 52pt başlığı + ölçek dışı 30pt.
    // Artık dokuzu tek bileşenden çiziyor: eşitlik yapısal, ayrışma imkânsız.
    expect(shared.sort()).toEqual([
      'archive.tsx', 'cockpit.tsx', 'index.tsx', 'legal.tsx', 'mod-ozet.tsx',
      'modlar.tsx', 'report.tsx', 'settings.tsx', 'tasks.tsx',
    ]);
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
    //
    // 5 → 4: navbar artık YALNIZCA gerçek sekmelerde (ana · görevler · haftalık · modlar).
    // profil ve ayarlar SEKME DEĞİL (dashboard avatarından / profilden push edilir); orada
    // tab-bar "hiçbir sekme aktif değil" halinde duruyordu — iOS deseni gereği geri butonu +
    // tam ekran yapıldı. Derin Odak zaten immersive olduğu için hiç çizmiyor.
    expect(screens.length).toBeGreaterThanOrEqual(4);
  });

  it.each(screens)('%s dibini navBarSpace’ten türetmeli', (file) => {
    const src = fs.readFileSync(path.join(ROOT, 'app', file), 'utf8');

    // Sayfanın ANA scroll'u: contentContainerStyle içinde paddingBottom.
    // Yatay filtre şeritleri gibi iç scroll'lar navbar'a değmez — onlar hariç,
    // bu yüzden yalnızca türetilmiş boşluğun HİÇ geçmediği durumu hata sayıyoruz.
    //
    // `fabSafeBottom` de kabul: kendisi `navBarSpace` üstüne kuruluyor (bkz. tokens.ts)
    // ve FAB'li ekranlarda düğmenin dinlenme yerini de hesaba katıyor. Kuralın amacı
    // "sabit sayı yazma, çubuktan türet" — o amaç ikisinde de karşılanıyor.
    expect(src).toMatch(/paddingBottom:\s*(navBarSpace|fabSafeBottom)\(/);
  });

  /**
   * FAB ÇİZEN EKRANLAR DAHA FAZLA PAY BIRAKMALI.
   *
   * `navBarSpace` yalnız sekme çubuğunu sayıyor; FAB onun ÜSTÜNDE duruyor ve en dibe
   * inildiğinde son satırı örtüyordu — listenin sonundaki görevin üstünde mavi bir daire.
   */
  it('FAB’li ekranlar düğmenin yerini de ayırır', () => {
    const withFab = ['index.tsx', 'tasks.tsx'];
    const missing = withFab.filter((f) => {
      const src = fs.readFileSync(path.join(ROOT, 'app', f), 'utf8');
      return !/paddingBottom:\s*fabSafeBottom\(/.test(src);
    });
    expect(missing).toEqual([]);
  });

  /**
   * Aynı eylem her ekranda AYNI yerde durmalı — kalıcı bir eylem düğmesinin tek
   * gerekçesi kas hafızasıdır. İki ekran ayrı konum saklıyordu: kullanıcı dashboard'da
   * düğmeyi sola taşıyıp Görevler'e geçince düğme sağda kalıyordu.
   */
  it('FAB konumu TEK anahtarda saklanır', () => {
    const keys = ['index.tsx', 'tasks.tsx'].map((f) => {
      const src = fs.readFileSync(path.join(ROOT, 'app', f), 'utf8');
      return src.match(/storageKey=\{`([^`]+)`\}/)?.[1];
    });
    expect(keys[0]).toBe(keys[1]);
    expect(keys[0]).toBeTruthy();
  });
});
