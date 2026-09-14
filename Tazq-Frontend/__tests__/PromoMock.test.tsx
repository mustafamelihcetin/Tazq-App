import React from 'react';
import { render } from '@testing-library/react-native';
import { PromoMock, type PromoKind, type PromoMode } from '@/features/promo/components/PromoMock';
import { PROMO_DEVICES, PROMO_DEVICE_ORDER } from '@/features/promo/promoDevices';

/**
 * TANITIM MOCK'U — mağaza görselinin bekçisi.
 *
 * ── NEDEN BU TEST VAR ─────────────────────────────────────────────────────────
 * Bu ekran iki kez elle bozuldu ve ikisini de KULLANICI yakaladı:
 *   1. İkon listesi sadeleştirilirken mock gövdesinde hâlâ kullanılan glifler
 *      (`Home`, `ListChecks`…) silindi → ekran açılır açılmaz ReferenceError.
 *   2. Ölçek referansı yanlış alındı (234, oysa cihaz 393) → her şey 1.68 kat büyük
 *      çizildi, yazılar sığmadı.
 *
 * İlkini bir render testi yakalar; tanıtım ekranı admin'e özel olduğu için normal
 * kullanımda hiç açılmıyor ve hata yıllarca sessiz kalabilir. İkincisi için ölçek
 * sözleşmesi aşağıda çivileniyor.
 *
 * Ekranın GÖRÜNÜŞÜ teste konu değil — bu bir görsel tasarım işi. Test yalnız
 * "açılıyor mu, dört cihazda ve iki dilde metinler yerinde mi, ölçek gerçek cihaza
 * mı bağlı" sorularını yanıtlıyor.
 */

const KINDS: PromoKind[] = ['modes', 'focus', 'tasks', 'momentum', 'cockpit', 'home'];
const MODES: PromoMode[] = ['light', 'dark'];
const LANGS: ('tr' | 'en')[] = ['tr', 'en'];

/** Gerçek cihazın slayta sığdırılmış hâli — promo.tsx ile aynı hesap. */
const fit = (id: keyof typeof PROMO_DEVICES) => {
  const d = PROMO_DEVICES[id];
  const screenW = (852 * 0.62 * d.w) / d.h;
  return { device: d, frameWidth: screenW, scale: screenW / d.w };
};

const readSrc = (rel: string) => {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  return fs.readFileSync(path.resolve(__dirname, '..', rel), 'utf8');
};

describe('tanıtım mock ekranı', () => {
  it('altı ekran · dört cihaz · iki tema · iki dil — 96 kombinasyonun hepsi ÇİZİLİYOR', () => {
    for (const kind of KINDS) {
      for (const id of PROMO_DEVICE_ORDER) {
        for (const mode of MODES) {
          for (const lang of LANGS) {
            expect(() =>
              render(<PromoMock kind={kind} mode={mode} lang={lang} {...fit(id)} />),
            ).not.toThrow();
          }
        }
      }
    }
  });

  it('sekme adları uygulamanın KENDİ adlarıyla aynı', () => {
    /*
      Mağaza görselindeki etiketle uygulamadaki etiket ayrışırsa, indiren kişi
      tanımadığı bir arayüzle karşılaşır. Kaynak: BottomNavBar → TAB_SHORT.
    */
    const tr = render(<PromoMock kind="home" mode="light" lang="tr" {...fit('iphone')} />);
    for (const label of ['Ana Sayfa', 'Görevler', 'Odak', 'Haftalık', 'Modlar']) {
      expect(tr.getByText(label)).toBeTruthy();
    }

    const en = render(<PromoMock kind="home" mode="dark" lang="en" {...fit('pixel')} />);
    for (const label of ['Home', 'Tasks', 'Focus', 'Weekly', 'Modes']) {
      expect(en.getByText(label)).toBeTruthy();
    }
  });

  it('iki sözlük de aynı anahtarları taşıyor — mock hiçbir dilde boş metin çizmiyor', () => {
    // Dil değişince bir anahtarın unutulması en kolay hata: iki sözlük de aynı
    // anahtarları taşımalı, yoksa mock'ta `undefined` çizilir.
    const tr = render(<PromoMock kind="cockpit" mode="light" lang="tr" {...fit('ipad')} />);
    expect(tr.getByText('Haftalık Merkez')).toBeTruthy();
    const en = render(<PromoMock kind="cockpit" mode="light" lang="en" {...fit('pixelTablet')} />);
    expect(en.getByText('Weekly Hub')).toBeTruthy();
  });

  it('ÖLÇEK gerçek cihaza bağlı — mock kendi referansını UYDURMAZ', () => {
    /*
      Bu testin koruduğu şey bir sayı değil, bir SÖZLEŞME: mock'un içindeki `px(n)`,
      "uygulamadaki n pt, aynı oranda" demek. Referans gerçek cihaz olmazsa korunan
      oran var olmayan bir cihazın oranı olur — bir kez tam olarak bu oldu.
    */
    const promo = readSrc('app/promo.tsx');
    expect(promo).toMatch(/const device = PROMO_DEVICES\[deviceId\];/);
    expect(promo).toMatch(/screenW = \(screenH \* device\.w\) \/ device\.h;/);
    expect(promo).toMatch(/const S = screenW \/ device\.w;/);

    const mock = readSrc('features/promo/components/PromoMock.tsx');
    expect(mock).toContain('const px = (n: number) => n * S;');
    // Güvenli alanlar da cihazdan gelir, koda elle yazılmaz.
    expect(mock).toContain('const TOP_INSET = px(device.topInset);');
    expect(mock).toContain('const BOT_INSET = px(device.bottomInset);');
  });

  it('dört cihazın da ölçüleri GERÇEK — tek tabloda, elle dağılmadan', () => {
    // Sayı değişecekse tek yerde değişsin; mock ve çerçeve aynı kaynaktan okur.
    expect(PROMO_DEVICES.iphone).toMatchObject({ platform: 'ios', w: 393, h: 852, island: true, wide: false });
    expect(PROMO_DEVICES.ipad).toMatchObject({ platform: 'ios', w: 1032, h: 1376, island: false, wide: true });
    expect(PROMO_DEVICES.pixel).toMatchObject({ platform: 'android', w: 412, h: 915, island: false, wide: false });
    expect(PROMO_DEVICES.pixelTablet).toMatchObject({ platform: 'android', w: 800, h: 1280, island: false, wide: true });
    // Dynamic Island YALNIZ iPhone'da; ötekiler kamerayı uzun kenara taşıdı.
    expect(PROMO_DEVICE_ORDER.filter((id) => PROMO_DEVICES[id].island)).toEqual(['iphone']);
    // "Geniş" olan cihazlar gerçekten MAX_W'den (600) geniş olmalı, yoksa sütun kuralı yalan.
    for (const id of PROMO_DEVICE_ORDER) {
      expect(PROMO_DEVICES[id].w > 600).toBe(PROMO_DEVICES[id].wide);
    }
  });

  it('ANDROID ayrı bir platform — küçültülmüş bir iPhone değil', () => {
    /*
      Android varyantı "köşeleri başka yuvarlatılmış bir iPhone" olursa Play görseli
      yalan söyler. Uygulamada gerçekten ayrışan üç şey burada da ayrışmalı:
      sekme çubuğu (yüzen cam kapsül ↔ dibe yapışık opak çubuk), başlık düğmesi
      (cam kabuk ↔ çıplak glif) ve yazı yüzü (SF ↔ Plus Jakarta Sans).
    */
    const mock = readSrc('features/promo/components/PromoMock.tsx');
    expect(mock).toContain('const NAV_INSET = px(isIOS ? 16 : 0);');
    expect(mock).toContain('const NAV_LIFT = px(isIOS ? 8 : 0);');
    expect(mock).toContain('const NAV_RADIUS = isIOS ? 999 : 0;');
    // Yazı yüzü eşlemesi ortak dosyada (iki mock da oradan okuyor).
    expect(readSrc('features/promo/promoTheme.ts')).toContain("'Jakarta-SemiBold'");
    expect(mock).toContain('promoWeight(isIOS, w)');
    // Gösterge sırası da ayrışıyor: Android wifi'yi sinyalden önce koyar.
    expect(mock).toMatch(/<Wifi[\s\S]{0,200}<SignalHigh/);
    // Başlık düğmesinin kabuğu YALNIZ iOS'ta çiziliyor (bkz. ChromeShell).
    expect(mock).toMatch(/Shl: React\.FC<\{ Ic: Glyph \}> = \(\{ Ic \}\) => \(\s*isIOS/);
  });

  it('TABLETTE düzen İKİYE bölünüyor — tek sütunda kalmıyor', () => {
    /*
      Uygulamanın kendi kuralı (tokens.ts → contentMaxWidth + WideSplit): geniş ekranda
      kap 1240'a açılır AMA içerik iki sütuna ayrılır. Mock bunu yapmazsa tablet
      görseli, uygulamanın hiç görünmediği bir hâli gösterir.
    */
    const mock = readSrc('features/promo/components/PromoMock.tsx');
    expect(mock).toContain('const COL = px(wide ? 1240 : 600);');
    expect(mock).toMatch(/const Cols: React\.FC/);
    // İçerik ve başlık çubuğu aynı kaba hizalı.
    expect((mock.match(/maxWidth: COL/g) ?? []).length).toBeGreaterThanOrEqual(2);
    /*
      Sekme kapsülü bu kuralın DIŞINDA ve öyle kalmalı: beş sekme 1240pt'ye yayılırsa
      dokunma hedefleri birbirinden kopar (uygulamada da kapsül 600'de kalıyor).
    */
    expect(mock).toContain("maxWidth: px(600), height: NAV_H");

    // Uygulama tarafı: aynı ayrım gerçek ekranlarda da var.
    for (const f of ['app/index.tsx', 'app/cockpit.tsx']) {
      expect(readSrc(f)).toContain('<WideSplit>');
    }
    expect(readSrc('app/tasks.tsx')).toMatch(/numColumns=\{wide \? 2 : 1\}/);
    expect(readSrc('shared/constants/tokens.ts')).toContain('export const WIDE_MIN = 700;');
  });

  it('mock ekranların ÖLÇÜLERİ uygulamanın jetonlarından geliyor', () => {
    // 44pt başlık · 49pt sekme kapsülü · 16pt yan pay · 32pt başlık öğesi · 54pt FAB
    const mock = readSrc('features/promo/components/PromoMock.tsx');
    for (const token of ['px(44)', 'px(49)', 'px(16)', 'px(32)', 'px(54)', 'px(24)']) {
      expect(mock).toContain(token);
    }
  });
});
