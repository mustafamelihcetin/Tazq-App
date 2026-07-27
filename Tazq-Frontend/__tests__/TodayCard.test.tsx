import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TodayCard } from '@/features/dashboard/components/TodayCard';
import { Colors } from '@/shared/constants/Colors';
import { METRIC, F } from '@/shared/constants/tokens';

/**
 * "Bugün" kartı — index.tsx'ten çıkarılan ikinci bölüm.
 *
 * Kartın psikolojik işi ilerlemeyi göstermek: hedefe ulaşınca renk maviden yeşile döner.
 * Bu testlerin çoğu o "tek sinyal" kuralını koruyor — renk üç yerde (gradyan, halka,
 * sayı) birden dönmeli, biri unutulursa kart kendi içinde çelişir.
 */

const theme = Colors.light;

const setup = (over: Partial<React.ComponentProps<typeof TodayCard>> = {}) =>
  render(
    <TodayCard
      completed={3}
      goal={5}
      focusMinutes={20}
      focusGoalMinutes={60}
      highlight={false}
      surprise="Süpersin!"
      burstKey={0}
      onTap={jest.fn()}
      label="BUGÜN"
      isSmallScreen={false}
      isDark={false}
      tr
      theme={theme}
      padding={16}
      {...over}
    />,
  );

const styleOf = (node: any) =>
  Object.assign({}, ...[node.props.style].flat(Infinity).filter(Boolean));

describe('TodayCard', () => {
  it('ilerlemeyi sayı ve yüzde olarak gösterir', () => {
    const { getByText, getByTestId } = setup();
    expect(getByText('3')).toBeTruthy();
    expect(getByText('/5')).toBeTruthy();
    expect(getByText('60')).toBeTruthy(); // 3/5 = %60
  });

  it('hiç görev yokken “0/1” DEMEZ — kullanıcı bunu bildirdi', () => {
    /**
     * Gerçek hata: çağıran taraf `todayTasks.length || 1` yazıyordu. Sıfıra bölme
     * korkusuyla konmuş bir hileydi ama kullanıcıya YALAN söylüyordu — hiç görev
     * yokken "0/1 görev tamamlandı" gösteriyordu.
     *
     * Koruma verinin değil hesabın işi: veri gerçeği söyler (0), bileşen bölmeyi
     * korur. Bunu ilk testi yazarken görmüştüm ama `|| 1`'i bir garanti sanıp
     * geçmiştim — hataya bakıp "bu tasarım" demişim.
     */
    const { queryByText, getByTestId } = setup({ completed: 0, goal: 0 });
    expect(queryByText('/1')).toBeNull();
    expect(queryByText('/0')).toBeNull(); // "/0" da bir hedef değil, hata gibi okunur
    expect(getByTestId('today-completed').props.children).toBe(0);
  });

  it('görev yokken KUTLAMAZ — “yok” ile “bitti” aynı şey değil', () => {
    // 0 >= 0 doğrudur, yani naif kod yeşil "Tümü tamamlandı 🎉" derdi. Yapacak bir şey
    // yokken alkışlamak, gerçekten bir şey bitirdiğinde gelen alkışı da değersizleştirir.
    const { getByText, getByTestId } = setup({ completed: 0, goal: 0 });
    expect(getByText('Bugün için planın boş')).toBeTruthy();
    expect(styleOf(getByTestId('today-pct')).color).not.toBe(theme.tertiary);
  });

  it('görev yokken renk NÖTR — ne mavi ne yeşil', () => {
    // Mavi "şunu yap" der (yapacak iş yok), yeşil "başardın" der (başarılacak şey yoktu).
    const { getByTestId } = setup({ completed: 0, goal: 0 });
    expect(styleOf(getByTestId('today-pct')).color).toBe(theme.onSurface);
  });

  it('0/0 ile çökmez — bölme koruması yerinde', () => {
    expect(() => setup({ completed: 0, goal: 0 })).not.toThrow();
  });

  /**
   * GÜN BAŞI AYRI BİR AN — "devam ediyor"un alt hâli değil.
   *
   * Kart bu anda aynı gerçeği üç kez söylüyordu: büyük `0`, yanında `/3`, sağda `%0`
   * yazan boş bir halka. Üçü de olumsuz ve ikisi gereksiz. Boş çember ilerleme
   * göstermez, ekranda delik gibi durur; "görev tamamlandı" cümlesi de 0'ın yanında
   * "hiçbir şey tamamlamadın" diye okunur.
   */
  it('gün başında halkanın içi HEDEFİ gösterir — çift sıfır olmasın', () => {
    const { queryByTestId, getByTestId } = setup({ completed: 0, goal: 3 });
    // Solda zaten `0 /3` duruyor; halkada `%0` yazmak aynı gerçeğin ikinci kopyasıydı.
    expect(queryByTestId('today-pct')).toBeNull();
    // Halka KALDIRILMIYOR — kaldırılınca kartın sağ yanı boşalıp kart tek yana yatıyordu.
    expect(getByTestId('today-goal')).toBeTruthy();
  });

  it('gün başında alt satır ileri bakar', () => {
    const { getByText, getByTestId } = setup({ completed: 0, goal: 3 });
    expect(styleOf(getByTestId('today-completed')).color).toBe(theme.onSurface);
    expect(getByText('gün yeni başlıyor')).toBeTruthy();
  });

  it('ilk görev bitince halka geri gelir — artık gösterecek ilerleme var', () => {
    const { getByTestId } = setup({ completed: 1, goal: 3 });
    expect(getByTestId('today-pct')).toBeTruthy();
  });

  it('hedefe ulaşılmadan MAVİ kalır', () => {
    const { getByText, getByTestId } = setup({ completed: 3, goal: 5 });
    expect(styleOf(getByTestId('today-pct')).color).toBe(theme.onSurface);
  });

  it('hedefe ulaşınca YEŞİLE döner — başarının tek sinyali', () => {
    // Renk burada süs değil: "başardın" diyen tek şey bu.
    const { getByText, getByTestId } = setup({ completed: 5, goal: 5 });
    expect(styleOf(getByTestId('today-pct')).color).toBe(theme.tertiary);
  });

  it('hedef aşılsa da yüzde 100’ü geçmez', () => {
    // Halka dolumu 1'e kırpılıyor; kırpılmasaydı yay kendi üstüne sarardı.
    const { getByText, getByTestId } = setup({ completed: 9, goal: 5 });
    expect(getByTestId('today-pct').props.children).toBe(180); // sayı gerçeği söyler
    expect(styleOf(getByTestId('today-pct')).color).toBe(theme.tertiary);
  });

  /**
   * Metin "Tümü tamamlandı 🎉" idi. Emoji üç sebeple yanlış: uygulamanın geri kalanı
   * lucide glifleri kullanıyor (tek emoji sistemi bozar), emoji cihaza göre farklı
   * çizilir (yani tasarım bizim kontrolümüzde değil) ve rengini kendi taşır (paletle
   * konuşmaz). Yerine vurgu rengini alan flat bir onay işareti kondu.
   */
  it('tamamlandığında kutlama metni gösterir — EMOJİSİZ', () => {
    const { getByText } = setup({ completed: 5, goal: 5 });
    expect(getByText('Tümü tamamlandı')).toBeTruthy();
  });

  it('kolay yumurta açıkken sürpriz metnini vurgu rengiyle gösterir', () => {
    const { getByText, getByTestId } = setup({ highlight: true, surprise: 'Süpersin!' });
    const s = styleOf(getByText('Süpersin!'));
    expect(s.color).toBe(theme.primary);
    // Eskiden `opacity: highlight ? 1 : 0.55` vardı — palet rengini kullanım yerinde
    // kısmak ölçülen kontrastı çöpe atar. Artık iki ayrı SEVİYE.
    expect(s.opacity).toBeUndefined();
  });

  it('normal durumda alt metni opacity ile değil, seviyeyle soluklaştırır', () => {
    const s = styleOf(setup().getByText('görev tamamlandı'));
    expect(s.color).toBe(theme.onSurfaceMuted);
    expect(s.opacity).toBeUndefined();
  });

  /**
   * PAYDA GEREKLİ. Yalnız `20dk` yazıyordu; yanındaki çubugun neye göre dolduğunu
   * açıklayan hiçbir şey yoktu. Sıfırdayken de sayfadaki ÜÇÜNCÜ çıplak sıfır oluyordu
   * (`0/5` ve `%0`ın yanında `0dk`). `0/60` bir eksiklik değil, bir başlangıç noktasıdır.
   */
  it('odak dakikasını HEDEFİYLE birlikte gösterir', () => {
    expect(setup().getByText('20/60dk')).toBeTruthy();
    expect(setup({ tr: false }).getByText('20/60m')).toBeTruthy();
  });

  it('odak sıfırken de payda görünür', () => {
    expect(setup({ focusMinutes: 0 }).getByText('0/60dk')).toBeTruthy();
  });

  it('dokunmayı iletir — çift dokunma kolay yumurtası buna bağlı', () => {
    const onTap = jest.fn();
    const { getByText, getByTestId } = setup({ onTap });
    fireEvent.press(getByTestId('today-completed'));
    expect(onTap).toHaveBeenCalled();
  });

  it('ana sayı METRİK ölçeğinden gelir — F değil', () => {
    // 44pt elle yazılıydı. Bu bir METİN değil, bir bakışta okunan SAYI; F okuma
    // ölçeğidir ve 34'te biter. Apple da büyük sayıları tip ölçeğinin dışında tutar.
    expect(styleOf(setup().getByTestId('today-completed')).fontSize).toBe(METRIC.md);
    expect(styleOf(setup({ isSmallScreen: true }).getByTestId('today-completed')).fontSize).toBe(METRIC.sm);
  });

  it('hedef sayısı ana sayıdan küçük ve soluk — hangisi başarı belli olmalı', () => {
    const { getByText, getByTestId } = setup();
    const main = styleOf(getByTestId('today-completed'));
    const goal = styleOf(getByText('/5'));
    expect(goal.fontSize).toBeLessThan(main.fontSize);
    expect(goal.color).toBe(theme.onSurfaceMuted);
    expect(main.color).toBe(theme.onSurface);
  });

  it('harf aralığı puntodan türetilir — sabit değil', () => {
    // -2.5 ve -1.2 sabit yazılıydı, ölçekten kopuk.
    const s = styleOf(setup().getByTestId('today-completed'));
    expect(s.letterSpacing).toBeLessThan(0); // büyük punto sıkı olmalı
  });

  it('koyu temada da renk kararı aynı — palete bağlı', () => {
    const { getByText, getByTestId } = setup({ theme: Colors.dark, isDark: true, completed: 5, goal: 5 });
    expect(styleOf(getByTestId('today-pct')).color).toBe(Colors.dark.tertiary);
  });
});
