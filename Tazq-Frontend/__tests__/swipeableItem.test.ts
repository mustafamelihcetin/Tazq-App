import fs from 'fs';
import path from 'path';

/**
 * KAYDIRARAK SİLME — gizli düğme gerçekten gizli olmalı.
 *
 * ── ÖLÇÜLEN SORUN ─────────────────────────────────────────────────────────────
 * Silme düğmesinin görünürlüğü YALNIZ UI iş parçacığındaki bir paylaşılan değerle
 * (`deleteOpacity`) yönetiliyordu. React bunu bilmediği için düğme, kapalı
 * satırlarda da ağaçta duruyordu:
 *
 *   · EKRAN OKUYUCU her görev satırından sonra bir "Sil" düğmesi daha okuyordu.
 *     Yirmi görevlik bir listede yirmi görünmez silme düğmesi — gezinmeyi iki katına
 *     çıkaran ve hiçbirinin ne işe yaradığı belli olmayan bir gürültü.
 *   · Opaklığı sıfır olan bir düğme hâlâ dokunulabilir bir hedeftir. İçerik onu
 *     örtüyordu ama bu, çizim SIRASINA bağlı bir tesadüf; düzen değişirse yıkıcı bir
 *     eylem görünmez bir alana taşınmış olur.
 *
 * Ayrıca ölçek animasyonu `useAnimatedStyle` içinde `withSpring` çağırıyordu: yay her
 * karede yeniden kuruluyor ve sürükleme boyunca hiç oturmuyordu.
 */

const RAW = fs.readFileSync(
  path.resolve(__dirname, '../shared/components/SwipeableItem.tsx'),
  'utf8',
);
/*
  Yorumlar ELENİYOR — bir kuralı ANLATAN not, kuralın ihlali sayılmasın. Bu testin ilk
  hâli tam da buna takıldı: kaldırılan `withSpring` ve `#ff3b30`, onları neden
  kaldırdığımızı anlatan yorumların içinde geçtiği için "hâlâ duruyor" sanıldı.
*/
const SRC = RAW.replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter((l) => !l.trim().startsWith('//'))
  .join('\n');

describe('gizli silme düğmesi', () => {
  it('açık/kapalı durumu JS tarafında da biliniyor', () => {
    // UI iş parçacığındaki paylaşılan değer React'e görünmüyor; erişilebilirlik ve
    // dokunma hedefi kararları JS tarafında verilmek zorunda.
    expect(SRC).toContain('const [isOpen, setIsOpen] = React.useState(false);');
    expect(SRC).toMatch(/runOnJS\(setIsOpen\)\(true\)/);
    expect(SRC).toMatch(/runOnJS\(setIsOpen\)\(false\)/);
  });

  it('jestin İPTAL edildiği durumda da kapanıyor', () => {
    /*
      `onFinalize`, kaydırma kaydırmayla ya da sistem jestiyle bölündüğünde çalışıyor.
      Orada durum sıfırlanmazsa satır görsel olarak kapanıyor ama JS "açık" sanmaya
      devam ediyor — düğme yine ağaçta kalıyordu.
    */
    const finalize = SRC.slice(SRC.indexOf('.onFinalize('));
    expect(finalize).toMatch(/runOnJS\(setIsOpen\)\(false\)/);
  });

  it('kapalıyken ne dokunuluyor ne okunuyor', () => {
    expect(SRC).toContain("pointerEvents={isOpen ? 'auto' : 'none'}");
    expect(SRC).toContain('accessibilityElementsHidden={!isOpen}');
    expect(SRC).toContain("importantForAccessibility={isOpen ? 'auto' : 'no-hide-descendants'}");
  });
});

describe('animasyon ve renk', () => {
  it('animasyon stilinin İÇİNDE yay kurulmuyor', () => {
    /*
      `withSpring` bir animasyon stilinin içinde çağrılırsa her karede yeniden
      başlatılır: sürüklerken hedef sürekli değiştiği için yay hiç oturmaz ve ikon
      titrer. Ölçek doğrudan opaklıktan türetiliyor.
    */
    // Dilim, bildirimin kendisinden kapanışına kadar: `return (` daha ÖNCE geçtiği
    // için ona göre kesmek boş dilim veriyordu.
    const from = SRC.indexOf('const actionStyle');
    const actionStyle = SRC.slice(from, SRC.indexOf('}));', from) + 4);
    expect(actionStyle).not.toContain('withSpring');
    expect(actionStyle).toContain('scale: 0.8 + deleteOpacity.value * 0.2');
  });

  it('yıkıcı rengi PALETTEN geliyor', () => {
    // `#ff3b30` elle yazılıydı: tema değişince yerinde çakılı kalıyordu.
    expect(SRC).not.toContain('#ff3b30');
    expect(SRC).toContain('backgroundColor: theme.error');
  });

  it('glif rengi koyu temada kontrastı koruyor', () => {
    /*
      Koyu temada palet daha AÇIK bir kırmızı kullanıyor (#F87171); beyaz glif orada
      kontrastı kaybediyor. Paletin `onPrimary` için yazdığı gerekçenin aynısı.
    */
    expect(SRC).toContain("colorScheme === 'dark' ? theme.onPrimary : '#FFFFFF'");
  });
});
