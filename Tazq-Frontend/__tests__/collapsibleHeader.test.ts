import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/**
 * ÇUBUK KAYDIRINCA BELİRİR — sayfa tepedeyken "header yok gibi".
 *
 * İstenen davranış: sayfa açıldığında üstte hiçbir şerit görünmez, ekranın tamamı
 * içeriğe kalır; kaydırıldıkça çubuk ve başlık belirir. Kazanç görsel değil ölçülebilir:
 * 44pt'lik şerit kalıcı olarak işgal edilmez.
 *
 * ── BİR DENEME GERİ ALINDI ──────────────────────────────────────────────────────
 * İlk uygulamada iOS'un "büyük başlık" deseni de eklenmişti: ekran adı içeriğin
 * tepesine 28 puntoyla yazılıp kaydırınca çubuğa çöküyordu. Yanlıştı — çünkü çubuk
 * zaten o adı söylüyor ve ikinci kez, kocaman yazmak yalnızca yer kaplayan bir TEKRAR.
 *
 * Ana sayfadaki büyük yazının işe yaramasının sebebi ekran adı OLMAMASI: orada
 * "Günaydın, Melih" yazıyor, yani bilgi taşıyor. Büyük başlık ancak bilgi taşıdığında
 * değer katar; ekran adını büyütmek katmaz.
 *
 * Desen iki parçalı ve İKİSİ DE gerekli:
 *   1. `onScroll` — kaydırma değerini besleyen bağlantı
 *   2. `ScreenHeader`e `scrollY` + `collapseAt` — çubuğun ne zaman belireceği
 *
 * Biri eksikse hata SESSİZ olur ve ters yönlerde bozar:
 *   · `onScroll` yoksa → çubuk hiç belirmez, başlık hiçbir zaman görünmez.
 *   · `scrollY` yoksa → çubuk hep açık kalır, yani hiçbir şey kazanılmaz.
 */
describe('çöken başlık bağlanan ekranlarda eksiksiz', () => {
  const SCREENS = [
    'app/archive.tsx',
    'app/settings.tsx',
    'app/cockpit.tsx',
    'app/modlar.tsx',
    'app/tasks.tsx',
  ];

  it.each(SCREENS)('%s iki parçayı da bağlıyor', (rel) => {
    const src = read(rel);
    expect(src).toContain('useCollapsibleHeader(');
    expect(src).toMatch(/scrollY=\{/);
    expect(src).toMatch(/onScroll=\{onScroll\}/);
  });

  it.each(SCREENS)('%s ekran ADINI içeriğe büyük yazmıyor', (rel) => {
    // Çubuk zaten adı söylüyor; ikinci kez kocaman yazmak yer kaplayan bir tekrar.
    expect(read(rel)).not.toContain('<LargeTitle');
  });

  it('BAŞLIK tepedeyken de görünür — gizlenen yalnız çubuktur', () => {
    /*
      "Header yok gibi" demek "başlık yok" demek değil: KUTU yok demek.

      İlk uygulamada başlık da gizleniyordu ve sayfa açıldığında nerede olduğunu
      söyleyen hiçbir şey kalmıyordu. Ana sayfada bu sorun yok çünkü orada dinlenme
      hâlinde marka işareti duruyor; diğer ekranlarda ise ekran tamamen isimsiz kalıyordu.

      Sözleşme: `collapseAt` VERİLMEZSE başlık her zaman görünür, yalnız çubuğun zemini
      ve ayracı kaydırmayla belirir. `collapseAt` ancak sayfanın İÇİNDE devralacak bir
      büyük başlık varsa verilir (ana sayfadaki selamlama gibi).
    */
    const src = read('shared/components/ScreenHeader.tsx');
    expect(src).toMatch(/if \(collapseAt == null\) return null;/);
  });

  it('çubuğun zemini kaydırmayla belirir', () => {
    const src = read('shared/components/ScreenHeader.tsx');
    expect(src).toContain('chromeOpacity');
    expect(src).toMatch(/inputRange: \[0, 16\]/);
  });

  it('içerikte büyük başlık VARSA eşik ölçülür', () => {
    // O durumda sabit sayı yanlış anda çökmeye yol açardı: başlık hâlâ ekrandayken
    // çubuk da belirir ve aynı yazı iki yerde görünür.
    const src = read('shared/components/LargeTitle.tsx');
    expect(src).toContain('e.nativeEvent.layout.height');
    expect(src).toMatch(/titleHeight > 0/);
  });

  it('kaydırma değeri NATIVE sürücüyle beslenmez', () => {
    // `ScreenHeader` bu değeri renk/zemin opaklığına bağlıyor; native sürücü yalnız
    // dönüşüm ve opaklığı destekler. `true` verilirse çubuk kaydırmaya hiç tepki
    // vermez VE hata da alınmaz — sessizce çalışmayan bir animasyon kalır.
    const src = read('shared/components/LargeTitle.tsx');
    expect(src).toContain('useNativeDriver: false');
  });

  it('modlar ekranının MEVCUT kaydırma davranışı korunmuş', () => {
    // Bu ekran kaydırma ofsetini bir ref'e yazıyordu (klavye/otomatik kaydırma için).
    // `Animated.event`in `listener` seçeneği ikisini birlikte çalıştırır; birini
    // seçmek gerekmez. Kaybolsaydı klavye açılınca sayfa yanlış yere kayardı.
    const src = read('app/modlar.tsx');
    expect(src).toContain('scrollOffsetRef.current = e.nativeEvent.contentOffset.y');
    expect(src).toContain('listener:');
  });
});
