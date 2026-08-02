import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/**
 * VERİ TAŞINABİLİRLİĞİ.
 *
 * Hesap SİLME zaten vardı; kullanıcının verisini yanına ALMA yolu yoktu. İki eksik:
 *  · GÜVEN — kullanıcı verisinin nerede durduğunu ve telefon kaybolursa ne olacağını
 *    bilmiyordu.
 *  · YASAL — KVKK ve GDPR "veri taşınabilirliği" hakkı tanıyor.
 */
describe('veri dışa aktarma', () => {
  const src = read('shared/utils/dataExport.ts');

  /**
   * EN KRİTİK KURAL. Dışa aktarma dosyası WhatsApp'tan gönderilebilen bir şey;
   * içine oturum jetonu yazmak, o dosyayı eline geçiren herkese hesap erişimi
   * vermek demektir.
   */
  it('oturum jetonu ASLA dışa aktarılmaz', () => {
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
      .join('\n');
    expect(code).not.toMatch(/\btoken\b/i);
    expect(code).not.toMatch(/refreshToken/);
    expect(code).not.toMatch(/password/i);
  });

  it('kullanıcıdan yalnız kimlik alanları alınır', () => {
    expect(src).toContain('return { id: s.user?.id, name: s.user?.name, email: s.user?.email };');
  });

  it('biçim SÜRÜMLÜ — ileride şema değişirse okunabilsin', () => {
    // Sürümsüz bir dışa aktarma, biçim bir kez değişince çöpe döner.
    expect(src).toContain('formatVersion: 1');
  });

  it('paylaşım desteği ÖNCE kontrol edilir', () => {
    // Dosyayı yazıp paylaşamamak, kullanıcının erişemeyeceği bir dosya bırakmaktır.
    const i = src.indexOf('Sharing.isAvailableAsync');
    const j = src.indexOf('writeAsStringAsync');
    expect(i).toBeGreaterThan(-1);
    expect(i).toBeLessThan(j);
  });

  /*
    KAPSAM — buluta gitmeyen veriler ÖZELLİKLE burada olmalı.

    Kilo geçmişi, bırakma kaydı ve konu ilerlemesi yalnız cihazda duruyor: çıkış yapıldığında
    siliniyor ve sunucudan geri gelmiyor. Dışa aktarma, kullanıcının bu veriye ulaşabildiği
    TEK yol. Listeden biri düşerse hem taşınabilirlik hakkı hem pratik kurtarma imkânı
    sessizce kaybolur — ve bunu ancak verisini kaybetmiş bir kullanıcı fark eder.
  */
  it('yalnız cihazda duran veriler dışa aktarmada', () => {
    expect(src).toMatch(/weight: safe\(/);
    expect(src).toMatch(/quit: safe\(/);       // bırakma: ad, başlangıç, NÜKS tarihleri
    expect(src).toMatch(/subjects: safe\(/);   // konu/müfredat ilerlemesi
  });

  it('buluta giden veriler de eksiksiz', () => {
    for (const key of ['tasks', 'habits', 'focus', 'achievements', 'preferences']) {
      expect(src).toMatch(new RegExp(`${key}: safe\\(`));
    }
  });

  it('her store ayrı korunuyor — biri çökerse dışa aktarma ölmez', () => {
    // Tek bir store bozuksa (eski sürümden kalan veri) tüm dışa aktarma
    // başarısız olmamalı; o alan null geçer, gerisi kurtulur.
    expect(src).toContain('const safe = <T,>(fn: () => T, label: string)');
  });
});

describe('dışa aktarma arayüzü', () => {
  const settings = read('app/settings.tsx');

  it('ayarlarda görünür ve erişilebilir', () => {
    expect(settings).toContain("exportUserData");
    expect(settings).toMatch(/'Verilerimi indir' : 'Download my data'/);
    expect(settings).toMatch(/accessibilityLabel=\{language === 'tr' \? 'Verilerimi dışa aktar'/);
  });

  /**
   * SIRA BİLİNÇLİ: hesabını silmeye giden kullanıcı, verisini yanına alabileceğini
   * TAM O ANDA görmeli. Ayrı bir sekmeye gömülseydi kimse bulamaz, veri kalıcı
   * olarak kaybolurdu.
   */
  it('silme düğmesinin ÜSTÜNDE — önce al, sonra sil', () => {
    const exportIdx = settings.indexOf('exportUserData');
    const deleteIdx = settings.indexOf('onPress={openDeleteAccount}');
    expect(exportIdx).toBeGreaterThan(-1);
    expect(deleteIdx).toBeGreaterThan(exportIdx);
  });
});

/**
 * TEK AD KURALI — aynı özellik üç adla anılıyordu:
 *   onboarding "Yaşam Modları" · sekme "Modlar" · ekran "Dönemsel Modlar"
 * Kullanıcı bir adı duyup başkasını arıyor, üçüncüsünü buluyordu.
 *
 * "Dönemsel" ayrıca YANLIŞTI: sigarayı bırakmak ve para biriktirmek dönemsel değil.
 */
describe('özellik adlandırması tek', () => {
  const FILES = [
    'app/modlar.tsx',
    'app/promo.tsx',
    'features/onboarding/components/HelpTourModal.tsx',
    'shared/components/BottomNavBar.tsx',
  ];

  it('kullanıcıya görünen metinde "Dönemsel" kalmadı', () => {
    const offenders: string[] = [];
    for (const f of FILES) {
      const code = read(f)
        .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
        .split('\n')
        .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
        .join('\n');
      if (/Dönemsel|Seasonal Modes/.test(code)) offenders.push(f);
    }
    expect(offenders).toEqual([]);
  });

  it('onboarding ile ekran okuyucu AYNI adı söylüyor', () => {
    const i18n = read('shared/constants/i18n.ts');
    expect(i18n).toContain("onboardingTitleModes: 'Yaşam Modları'");
    expect(read('shared/components/BottomNavBar.tsx'))
      .toContain("modlar: { tr: 'Yaşam Modları', en: 'Life Modes' }");
  });

  it('sekmedeki KISA etiket kısa kalıyor', () => {
    // Sekme etiketleri kısaltmadır; tam ad ekran okuyucuya verilir.
    expect(read('shared/components/BottomNavBar.tsx'))
      .toContain("modlar: { tr: 'Modlar', en: 'Modes' }");
  });
});
