import fs from 'fs';
import path from 'path';
import {
  MAX_W, MAX_W_TABLET, MAX_W_WIDE, TABLET_MIN, WIDE_MIN, contentMaxWidth,
} from '@/shared/constants/tokens';

/**
 * DUYARLILIK BEKÇİSİ.
 *
 * ── NEDEN VAR ─────────────────────────────────────────────────────────────────
 * Uygulama tablette "ekranın ortasına yapıştırılmış bir telefon" gibi duruyordu:
 * içerik 600pt'lik bir şeritte, iki yan boş. Düzeltilirken iki ayrı tuzağa düşüldü ve
 * ikisi de burada çivileniyor:
 *
 *   1. TEK EŞİK YETMİYOR. Sayfayı 700pt'de iki sütuna bölmek boşluğu kapatmadı,
 *      BÜYÜTTÜ: bölünme içeriğin boyunu yarıya indirir ve dikey tablette ekranın
 *      dörtte üçü boşalır (ölçüm: tek sütunda %66 dolu, iki sütunda %39). "Tablet mi"
 *      ile "iki sütuna bölünecek kadar geniş mi" AYRI sorular.
 *
 *   2. ÖLÇÜ DONMUŞ OLAMAZ. `Dimensions.get()` modül yüklenirken bir kez okunur;
 *      döndürmede, bölünmüş ekranda ve katlanabilir açılıp kapanınca yeniden render
 *      etmez. Düzen kararı veren her yer `useWindowDimensions` kullanmak zorunda.
 */

const ROOT = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
/** Yorumları eler — bir kuralı ANLATAN not, kuralın ihlali sayılmasın. */
const stripComments = (src: string) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
    .join('\n');

/** Ana içerik ekranları — hepsi aynı genişlik kuralına uymalı. */
const CONTENT_SCREENS = [
  'app/index.tsx', 'app/tasks.tsx', 'app/cockpit.tsx', 'app/modlar.tsx', 'app/gun.tsx',
  'app/achievements.tsx', 'app/archive.tsx', 'app/mod-ozet.tsx', 'app/profile.tsx',
  'app/report.tsx', 'app/settings.tsx', 'app/admin.tsx',
];

describe('üç kademeli genişlik', () => {
  it('eşikler AYRI — "tablet" ile "iki sütun" aynı şey değil', () => {
    expect(TABLET_MIN).toBe(700);
    expect(WIDE_MIN).toBe(1100);
    expect(WIDE_MIN).toBeGreaterThan(TABLET_MIN);
  });

  it('eşik telefonla tabletin ARASINDA — hiçbir telefon tablet düzenine düşmez', () => {
    // En geniş telefon ~440pt (Pro Max), en dar tablet ~744pt (iPad mini).
    expect(TABLET_MIN).toBeGreaterThan(440);
    expect(TABLET_MIN).toBeLessThan(744);
  });

  it('üç kademe de doğru genişliği veriyor', () => {
    expect(contentMaxWidth(393)).toBe(MAX_W);          // iPhone 16 Pro
    expect(contentMaxWidth(412)).toBe(MAX_W);          // Pixel 8
    expect(contentMaxWidth(440)).toBe(MAX_W);          // en geniş telefon
    expect(contentMaxWidth(800)).toBe(MAX_W_TABLET);   // Pixel Tablet (dikey)
    expect(contentMaxWidth(1032)).toBe(MAX_W_TABLET);  // iPad Pro 13" (dikey)
    expect(contentMaxWidth(1194)).toBe(1194);          // iPad (yatay) — ekrandan geniş olamaz
    expect(contentMaxWidth(1376)).toBe(MAX_W_WIDE);    // iPad Pro 13" (yatay)
  });

  it('kademeler arasında GERİ GİTMİYOR — genişledikçe sütun da genişler', () => {
    let prev = 0;
    for (const w of [320, 393, 440, 700, 800, 1032, 1100, 1376, 2000]) {
      const c = contentMaxWidth(w);
      expect(c).toBeGreaterThanOrEqual(prev);
      prev = c;
    }
  });

  it('sütun hiçbir zaman EKRANDAN geniş olmuyor', () => {
    /*
      Kaplar `width: '100%'` taşıdığı için ekranda taşma zaten oluşmuyordu — ama sayı
      yalan söylüyordu: eşiğin tam üstünde (700pt) 760 dönüyordu ve bu sayıyı okuyup
      kendi hesabını yapan yerler (ızgara kart genişliği gibi) yanlış bölüyordu.
      Telefon kademesi hariç: orada ekran zaten MAX_W'den dar.
    */
    for (const w of [700, 744, 800, 1032, 1100, 1194, 1376, 2000]) {
      expect(contentMaxWidth(w)).toBeLessThanOrEqual(w);
    }
  });
});

describe('ölçüler CANLI okunuyor', () => {
  it('düzen kararı veren hiçbir ekran donmuş genişlik okumuyor', () => {
    /*
      `Dimensions.get('window').width` modül yüklenirken bir kez okunur. Döndürmede,
      bölünmüş ekranda ve katlanabilir açılıp kapanınca yeniden render ETMEZ — düzen
      eski ekranın ölçüsünde kalır. Bu tam olarak bir kez yaşandı (modlar.tsx'te kart
      genişlikleri) ve tablette ızgarayı kabından taşırdı.
    */
    const offenders = CONTENT_SCREENS.filter((f) =>
      /Dimensions\.get\(['"]window['"]\)\.width/.test(stripComments(read(f))),
    );
    expect(offenders).toEqual([]);
  });

  it('StyleSheet içinde dondurulmuş ekran genişliği yok', () => {
    // StyleSheet.create modül yüklenirken çalışır: oraya yazılan bir ekran ölçüsü
    // uygulamanın ömrü boyunca değişmez (bkz. RocketFeedback layoutWrapper).
    const walk = (dir: string): string[] =>
      fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
        if (['node_modules', '.expo', 'android', 'ios', 'dist', '.git'].includes(e.name)) return [];
        const rel = `${dir}/${e.name}`;
        return e.isDirectory() ? walk(rel) : /\.tsx?$/.test(e.name) ? [rel] : [];
      });

    const offenders = ['app', 'shared', 'features']
      .flatMap(walk)
      .filter((f) => {
        const src = stripComments(read(f));
        const sheet = src.indexOf('StyleSheet.create(');
        if (sheet < 0) return false;
        return /Dimensions\.get\(['"](window|screen)['"]\)\.(width|height)/.test(src.slice(sheet));
      });
    expect(offenders).toEqual([]);
  });
});

describe('içerik genişliği TEK kuraldan geliyor', () => {
  it('hiçbir içerik ekranı kabını elle MAX_W ile sınırlamıyor', () => {
    /*
      Sekiz ekran `maxWidth: MAX_W` yazıyordu ve tablette hepsi 600pt'lik bir şeride
      sıkışıyordu. Kural tek yerde (contentMaxWidth / useContentMaxWidth); elle yazan
      bir ekran, geniş ekran düzeltmesinin DIŞINDA kalır ve ötekilerden ayrışır.

      Sekme kapsülü ve sayfa (modal) yüzeyleri bilerek 600'de kalıyor — onlar içerik
      kabı değil (bkz. BottomNavBar, StatusHubModal).
    */
    const offenders = CONTENT_SCREENS.filter((f) => stripComments(read(f)).includes('maxWidth: MAX_W'));
    expect(offenders).toEqual([]);
  });

  it('üç ana ekran geniş ekranda gerçekten BÖLÜNÜYOR', () => {
    expect(stripComments(read('app/index.tsx'))).toContain('<WideSplit>');
    expect(stripComments(read('app/cockpit.tsx'))).toContain('<WideSplit>');
    expect(stripComments(read('app/tasks.tsx'))).toContain('const listCols = wide ? 3 : tablet ? 2 : 1;');
  });

  it('bölünme TELEFONDA ağaca hiçbir şey eklemiyor', () => {
    /*
      Dar ekranda WideSplit ve WideCol yalnız Fragment dönmeli. Araya bir View girerse
      telefon düzeni sessizce değişir — bu değişiklik telefonlara DOKUNMAMALIYDI.
    */
    const src = stripComments(read('shared/components/ResponsiveColumns.tsx'));
    expect(src).toMatch(/if \(!wide\) return <>\{children\}<\/>;/);
    expect(src).toMatch(/export const WideCol[\s\S]{0,140}=> \(\s*<>\{children\}<\/>\s*\);/);
  });
});
