import { Platform } from 'react-native';

/**
 * Tazq Design System — v7
 *
 * Light: Cool Ceramic — iOS sistem grileriyle hizalı soğuk nötr
 * Dark:  Cool Charcoal — aynı aile, koyu uçta
 *
 * ── Yön: "native iOS uygulaması gibi — kaliteli, elit, minimalist" ─────────────
 *
 * v6'da nötrleri Stone'a (ılık) çevirmiştim. YANLIŞTI ve geri alındı:
 * Apple'ın sistem nötrlerinin HEPSİ soğuktur (mavi alt tonlu) —
 * secondarySystemBackground #F2F2F7, systemGray6 #1C1C1E, secondaryLabel #3C3C43.
 * Zinc bunların Tailwind karşılığıdır (Zinc 100 #F4F4F5 ≈ systemGray6 #F2F2F7),
 * yani v5'in nötrleri zaten doğru yerdeydi. "Ilıklaştırma" iOS'tan uzaklaştırıyordu.
 * Üstelik görünmüyordu da: #F4F4F5 -> #F5F5F4 arasındaki fark 1 RGB birimi.
 *
 * Elit/minimalist his iki şeyden gelir:
 *   (a) Rengin ANLAMI olması. "Renk = anlam" kuralı: bir isim ne eylem ne durum bildirir,
 *       o yüzden renklenmez. Marka mavisiyle boyanan her şey "tıklanabilir/kritik" der;
 *       öyle olmayan şeye söylerse yalan söyler ve ekran ucuzlar.
 *   (b) Rengin AZ kullanılması. Apple uygulamaları büyük ölçüde gri tonlamadır; tint
 *       yalnızca etkileşimli metin, küçük glif ve tek birincil butonda görünür.
 *
 * v7'de korunanlar (v6'nın gerçek kazanımları — hepsi ölçülmüş hatalardı):
 * - Semantik token'lar Apple HIG'den Tailwind ailesine taşındı. Eskiden palet iki
 *   ayrı sistemin karışımıydı ve Apple tarafı %100 doygunluktaydı; tam o dördü
 *   WCAG'den kalıyordu (warning 2.00:1, streak 2.58:1). Apple'ın kendi renkleri
 *   bu değerlerde okunaklı değil — "elit kalite" okunmamayı kapsamaz.
 * - İki farklı kırmızı (error #DC2626 / priorityHigh #FF3B30) tek kırmızıya indi.
 * - Koyu tema birincil butonu: beyaz yazı Indigo 400 üstünde 2.98:1 idi. Artık koyu
 *   tema kendi (daha açık) mavisini kullanıyor — Apple gibi. Bkz. darkPalette.primary.
 * - Marka mavisi hue 221'den (Blue 600) 210'a çekildi. "Sert lacivert" şikayetinin
 *   ölçülebilir sebebi buydu: 221 indigo/mor tarafına bakıyordu. iOS systemBlue 211'dir.
 *   Açıklık meselesi değildi — Blue 600 (%53) systemBlue'dan (%50) daha AÇIKTI bile.
 *
 * Bu dosya ekranların TEK renk kaynağıdır. Eskiden değildi: 870 sabit hex ekranların
 * içine yazılıydı ve paleti değiştirmek hiçbir şeyi değiştirmiyordu. Aşağıdaki üç
 * palet (tema / kategori / mod vurgusu) o dağınıklığın toplanmış hâlidir.
 *
 * Her iki temada WCAG AA ihlali: 0. Ölçüm: metin >= 4.5:1, UI öğesi >= 3:1.
 * Bkz. __tests__/colorContrast.test.ts — palet artık gözle değil testle korunuyor.
 */

const lightPalette = {
  // Marka mavisi, iOS'un hue bandında (210). Eski Blue 600 hue 221'deydi: indigo/mor
  // tarafına kayık olduğu için "sert lacivert" okunuyordu. iOS systemBlue hue 211'dir
  // ve turkuaz tarafına bakar — canlı görünmesinin sebebi bu, açıklık değil (systemBlue
  // %50, Blue 600 %53 — yani eskisi daha AÇIKTI ama daha lacivert duruyordu).
  // Beyaz yazı 5.28:1 (AA) · açık zemin 4.80:1 · koyu zemin 3.77:1 — üçü de geçiyor.
  primary: '#2A5BCB',
  primaryFill: '#2A5BCB',
  primaryDim: '#1E429A',        // basılı durum
  primaryContainer: '#DFE8FF',  // Blue 100
  onPrimary: '#FFFFFF',         // 5.17:1
  onPrimaryFill: '#FFFFFF',
  onPrimaryContainer: '#14306F',  // primary'nin koyu ucu (hue 210 ailesi)

  secondary: '#7C3AED',         // Violet 600
  secondaryContainer: '#EDE9FE', // Violet 100
  onSecondary: '#FFFFFF',       // 5.70:1

  tertiary: '#047857',          // Emerald 700 — beyaz yazı için 5.48:1 (Emerald 600 3.77:1 ile kalıyordu)
  tertiaryContainer: '#D1FAE5', // Emerald 100
  onTertiary: '#FFFFFF',

  error: '#B91C1C',             // Red 700 — Red 600 (#DC2626) 4.43:1 ile kıl payı kalıyordu
  onError: '#FFFFFF',           // 6.47:1 — dolu kırmızı (yıkıcı buton) üstündeki yazı/glif
  onBackground: '#18181B',      // Zinc 900
  onSurface: '#18181B',         // Zinc 900 — 16.12:1
  onSurfaceVariant: '#52525B',  // Zinc 600 — 7.03:1 (İKİNCİL metin)
  // ÜÇÜNCÜL metin — gerçekten yardımcı bilgi (zaman damgası, ipucu, birim).
  //
  // Neden token: 140 yerde `onSurfaceVariant` + `opacity` yazılmıştı. Token tek başına
  // 7.03:1 iken opacity 0.6 onu 2.90:1'e düşürüyordu — yani her kullanım yerinde elle,
  // ölçülmeden soluklaştırılıyordu. Kıyas: Apple'ın kendi secondaryLabel'ı 3.44:1.
  //
  // Zinc 500 iki temada da çalışıyor (açık 4.40 / koyu 4.12) ve ikisi de Apple'ın
  // değerinden iyi. Soluklaştırma artık ÖLÇÜLMÜŞ bir seviye, keyfi bir çarpan değil.
  // Metne opacity uygulama — bu token'ı kullan. Bkz. __tests__/colorContrast.test.ts
  onSurfaceMuted: '#71717A',    // Zinc 500 — 4.40:1

  background: '#F4F4F5',        // Zinc 100 — iOS systemGray6 (#F2F2F7) hizasında
  surface: '#F4F4F5',
  surfaceVariant: '#E4E4E7',    // Zinc 200
  surfaceContainerLowest: '#FFFFFF',
  surfaceContainerLow: '#FAFAFA',
  surfaceContainer: '#F0F0F2',
  surfaceContainerHigh: '#E0E0E4',
  surfaceContainerHighest: '#D4D4D8',   // Zinc 300 — ikincil metin için 5.10:1

  outline: Platform.OS === 'android' ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.08)',
  outlineVariant: Platform.OS === 'android' ? 'rgba(0,0,0,0.03)' : 'rgba(0,0,0,0.04)',

  // Liste satırı AYIRICISI — outline'dan ayrı bir iş.
  //
  // outline bir NESNENİN sınırıdır (kartın nerede bittiği). separator bir RİTİMDİR
  // (aynı grup içinde iki satırın nerede ayrıldığı). İkisi aynı token olunca ayırıcılar
  // kart kenarı kadar soluk kaldı ve 16 yerde elle rgba yazıldı.
  //
  // Apple systemSeparator (light): rgba(60,60,67,0.29). Bizim outline'dan 3.6× daha
  // belirgin — ÇÜNKÜ hairline (@3x'te 0.33pt) çizilir. İnce+belirgin = iOS'un kesin
  // çizgisi; kalın+soluk = web'in bulanık çizgisi. Kalınlık için: HAIRLINE (tokens.ts).
  separator: 'rgba(60,60,67,0.29)',

  /**
   * YÜZEN kabuk zemini (navbar, başlık) — YALNIZ ANDROID'DE kullanılır.
   *
   * iOS'ta bu değer hiç okunmuyor: orada zemin `'transparent'` verilip altına gerçek
   * bir BlurView konuyor. Buna rağmen renk `rgba(255,255,255,0.95)` yazılıydı ve
   * gerekçesi "iOS'ta blur görünsün diye saydam olmak zorunda" diye not düşülmüştü —
   * kod o hâle geçerken güncellenmemiş, artık doğru olmayan bir gerekçe.
   *
   * Bedeli Android'de görünüyordu: %5 saydamlık, altından kayan içeriği
   * BULANIKLAŞTIRMADAN geçiriyor. iOS'ta blur onu bir malzemeye çevirir; Android'de
   * blur olmadığı için sadece okunabilir bir hayalet kalıyor — durum çubuğunun
   * hizasında sayfadaki başlıklar seçiliyordu. Kullanıcı bunu "cam" diye değil,
   * "çizim hatası" diye okur. Android'in kendi dili de zaten opak app bar'dır.
   *
   * Sayfa zemininden (#F4F4F5) ayrı tutuluyor ki kabuk "üstte duruyor" okunsun.
   */
  surfaceFloating: '#FFFFFF',
  /**
   * KART YÜZEYİ — mod kartları, liste kartları, panel kutuları.
   *
   * Token yoktu; 9 dosya `isDark ? '#1C1C22' : theme.surfaceContainerLowest`
   * diye ELLE yazıyordu. Ham hex demek: palet değişince kartlar değişmez ve
   * koyu tema tonu tek yerden ayarlanamaz. Açıkta beyaz, koyuda zeminden bir
   * tık açık (#1C1C22) — kartın "yüzeyden yükseldiğini" söyleyen fark.
   */
  surfaceCard: '#FFFFFF',

  /**
   * FORM ALANI ZEMİNİ — metin kutusu, tarih/saat seçici, segment düğmesi.
   *
   * ── ÖLÇÜLEN SORUN ───────────────────────────────────────────────────────────
   * Alanlar `isDark ? surfaceContainerHigh : surfaceContainerLow` yazıyordu.
   * Aydınlık temada sayfa/kart zemini #FFFFFF, alan zemini #FAFAFA: aradaki fark
   * %2, kontrast 1.04:1. Koyu temada durum daha kötüydü — sayfa zemini de alan
   * zemini de AYNI token'dı (#222228), yani fark tam sıfır. Kullanıcı görev formunu
   * açtığında yazı kutusunun ve tarih seçicinin nerede olduğunu göremiyordu.
   *
   * ── ÇÖZÜM KENAR ÇİZGİSİ DEĞİL ───────────────────────────────────────────────
   * İlk denemede alanlara 1px kenar verildi ve GERİ ALINDI: kullanıcı "çok kaba
   * duruyor" dedi, haklıydı. Apple da formlarda kutu çizmez — iOS'ta bir yazı
   * alanının sınırını ZEMİN FARKI söyler (systemGray6 ≈ #F2F2F7, beyaz kartın
   * üstünde). Kenar çizgisi Material'ın dili; bu uygulama iOS dilini konuşuyor.
   *
   * Asıl hata zaten kenarın yokluğu değil, farkın %2 olmasıydı. Fark gerçek bir
   * adım olunca (%7) tek başına yetiyor: alan, üstünde durduğu kart/sayfadan iki
   * temada da bir tık KOYU — "içine yazılan bir oyuk".
   *
   * Odaklanılan alan kenarla değil, hafif bir MAVİ YIKAMA ile ayrılıyor
   * (bkz. TaskFormModal → fieldFill): yine çizgi yok, yine yumuşak.
   */
  surfaceField: '#EDEDF2',

  // Interaction overlays
  pressedOverlay: 'rgba(0, 0, 0, 0.08)',
  hoverOverlay: 'rgba(0, 0, 0, 0.04)',

  // Semantic / status tokens — tema sisteminde merkezi tanım.
  // Hepsi Tailwind ailesinden ve AA geçen tonlarda. v5'teki Apple HIG karşılıkları
  // %100 doygunluktaydı: ılık zeminde yabancı duruyor ve kontrasttan kalıyorlardı.
  warning: '#B45309',          // Amber 700 — 4.60:1 (eski #FF9500: 2.00:1 ✗)
  priorityHigh: '#B91C1C',     // error ile aynı: "dikkat gerekiyor" tek kırmızı (eski #FF3B30)
  priorityMedium: '#B45309',   // Amber 700 — warning ile aynı ton (eski #FF9500: 2.00:1 ✗)
  priorityLow: '#71717A',      // Zinc 500 — nötr aileyle aynı (eski Slate 500)
  streak: '#EA580C',           // Orange 600 — 3.26:1, ödül rengi sıcak kalmalı (eski #FF6B35: 2.58:1 ✗)
  success: '#047857',          // Emerald 700 — tertiary ile aynı marka yeşili
  info: '#0284C7',             // Sky 600 — 3.75:1
};

const darkPalette = {
  // Koyu temanın mavisi AÇIK temanınkinden daha AÇIK — bu kasıtlı.
  // Bir ara "tek marka mavisi" diye ikisini eşitledim, YANLIŞTI: açık zeminde çalışan
  // #0B6BCB koyu zeminde metin olarak 3.77:1 veriyor (gereken 4.5) ve bölüm başlıkları
  // ("Bugünkü Alışkanlıklarım", "Günlük Görevler") okunmuyordu. Apple'ın da iki mavisi
  // olmasının sebebi bu: systemBlue açıkta #007AFF, koyuda #0A84FF. Aşağıdaki değer
  // Apple'ın koyu tema mavisinin ta kendisi — metin olarak 5.45:1.
  primary: '#86AEFF',
  primaryFill: '#3B6FE0',
  primaryDim: '#3B6FE0',        // basılı durum — açık temanın mavisi
  primaryContainer: '#16264F',  // primary'nin koyu ucu (hue 210 ailesi)
  // 2026-10-25 kullanıcı kararı: BEYAZ (iOS'un koyu teması gibi). Önce Material 3 kuralıyla
  // koyuydu (5.45:1) ama mavi düğmelerde siyah glif sert/teknik duruyordu. Beyaz 3.65:1 —
  // buton etiketleri kalın/büyük ve ikonlar UI bileşeni: WCAG eşiği 3:1 (bkz. colorContrast.test).
  // Tek mavi hem metin hem beyaz zemini için 4.5 veremez; metin rolü 4.5'te korunuyor.
  onPrimary: '#FFFFFF',
  onPrimaryFill: '#FFFFFF',
  onPrimaryContainer: '#C9D8FF', // Blue 200, hue 213 — eskiden #C7D2FE (Indigo 200, hue 228): konteyner 210 ailesindeyken yazısı indigoydu. 10.24:1

  secondary: '#A78BFA',         // Violet 400
  secondaryContainer: '#2D1B69',// Violet 950
  onSecondary: '#18181B',       // 6.38:1 (eski #F3F0FF: açık yazı açık zeminde)

  tertiary: '#34D399',          // Emerald 400
  tertiaryContainer: '#064E3B', // Emerald 950
  onTertiary: '#052E16',        // 7.75:1 (eski #ECFDF5: 1.4:1 ✗)

  error: '#F87171',             // Red 400
  // Koyu temada kırmızı AÇIK → yazı KOYU (onPrimary ile aynı kural). Token yokken yıkıcı
  // butonlar '#FFFFFF' yazıyordu: 2.77:1 — "Hesabı sil" koyu temada okunmuyordu.
  onError: '#18181B',           // 6.40:1

  onBackground: '#F4F4F5',      // Zinc 100
  onSurface: '#F4F4F5',         // 18.24:1
  onSurfaceVariant: '#A1A1AA',  // Zinc 400 — 7.76:1 (İKİNCİL metin)
  // ÜÇÜNCÜL metin — açık temayla AYNI değer (Zinc 500). Nadir bir denge: bu ton hem
  // beyaza hem siyaha yeterince uzak. Bkz. lightPalette.onSurfaceMuted.
  onSurfaceMuted: '#71717A',    // Zinc 500 — 4.12:1

  background: '#09090B',        // Zinc 950 — iOS systemBackground (dark) hizasında
  surface: '#09090B',
  surfaceVariant: '#18181B',    // Zinc 900

  surfaceContainerLowest: '#000000',
  surfaceContainerLow: '#0F0F12',
  surfaceContainer: '#17171C',
  surfaceContainerHigh: '#222228',
  surfaceContainerHighest: '#2C2C34',

  outline: Platform.OS === 'android' ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.07)',
  outlineVariant: Platform.OS === 'android' ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.03)',

  // Apple systemSeparator (dark): rgba(84,84,88,0.65). Açık temadakinden daha yüksek
  // opaklık — koyu zeminde bir çizginin "görünmesi" için daha çok ışık gerekir; aynı
  // opaklıkla çevrilseydi koyu temada ayırıcılar kaybolurdu. Bkz. lightPalette.separator.
  separator: 'rgba(84,84,88,0.65)',

  // Bkz. lightPalette.surfaceFloating — orada neden opak olduğu anlatılıyor.
  // Zinc 950'nin (#09090B) bir tık üstü: yüzen kabuk zeminden ayrılmalı ki
  // "üstte duruyor" okunsun.
  surfaceFloating: '#0F0F12',
  surfaceCard: '#1C1C22',

  // Bkz. lightPalette.surfaceField — orada NEDEN kenar çizgisi OLMADIĞI anlatılıyor.
  // Kart #1C1C22, sayfa kabuğu #222228; alan ikisinden de koyu → aynı oyuk hissi.
  // #16161B idi: karttan farkı 1.06:1 — açık temada "alan görünmüyor" diye düzeltilen
  // %2 sorununun koyu temadaki ikizi. Açık tema 1.17; burada 1.11 (daha koyuya inmek
  // sayfa zeminine (#09090B) yapışır). Bkz. __tests__/colorContrast.test.ts → alan/kart.
  surfaceField: '#111115',

  // Interaction overlays
  pressedOverlay: 'rgba(255, 255, 255, 0.08)',
  hoverOverlay: 'rgba(255, 255, 255, 0.04)',

  // Semantic / status tokens — açık tema ile aynı aile, koyuda okunur tonlarda.
  warning: '#FBBF24',          // Amber 400 — 11.83:1
  priorityHigh: '#F87171',     // error ile aynı: tek kırmızı (açık tema ile tutarlı)
  priorityMedium: '#FBBF24',   // Amber 400 — warning ile aynı ton
  priorityLow: '#A1A1AA',      // Zinc 400 — nötr aileyle aynı
  streak: '#FB923C',           // Orange 400 — 8.73:1 (eski #FF6B35 iki temada da aynıydı)
  success: '#34D399',          // Emerald 400 — tertiary ile aynı marka yeşili
  info: '#38BDF8',             // Sky 400 — 9.22:1
};

export const Colors = {
  light: lightPalette,
  dark: darkPalette,
};

/**
 * ── AÇILIŞ ZEMİNİ: UYGULAMANIN KENDİ ZEMİNİ ───────────────────────────────────
 * Bir tur açılışın tamamı marka lacivertine (#1E2A66) boyandı. Geri alındı: o renk
 * uygulamanın HİÇBİR yerinde yok (paleti soğuk nötrler + mavi vurgu) ve tam ekran
 * kaplayınca hem boğucu duruyor hem de içeri girince tamamen farklı bir dünyaya
 * geçiliyormuş gibi oluyordu.
 *
 * Doğrusu Apple'ın kuralı: açılış ekranı uygulamanın İLK EKRANINA benzemeli ki geçiş
 * görünmesin. Bu yüzden zemin `Colors.light/dark.background` — yani sayfa zemininin
 * ta kendisi. Marka rengi kayboluyor değil: ortadaki OPAK ikonda duruyor, tam ekran
 * bir alan olarak değil.
 */

/**
 * Kategori paleti — mod alışkanlıklarının/görevlerinin kimlik renkleri.
 *
 * Neden ayrı: bunlar semantik değil KATEGORİK. "Hata Defteri kırmızı, Konu Testi yeşil"
 * demek bir durum bildirmez, sadece kalemleri birbirinden ayırır. Apple'ın Hatırlatıcılar'ı
 * da liste başına renk verir — meşru bir desen.
 *
 * Neden burada: bu 8 renk zaten kullanılıyordu ama HİÇBİR YERDE TANIMLI DEĞİLDİ —
 * turkishModes.ts içine 270 kez elle yazılmıştı. Sonuç: uygulamada paralel bir "gölge
 * palet" (Tailwind 500 serisi) tema paletiyle (600/700 serisi) yan yana çalışıyordu.
 * Aynı anda iki renk sistemi = renklerin birbirini tutmaması. Artık tek kaynak burası.
 *
 * Neden temaya duyarlı değil: bu renkler alışkanlık kaydına YAZILIYOR (kalıcı veri).
 * Temaya göre değişen bir değer saklanamaz — bu yüzden her ton İKİ temada da >= 3:1
 * verecek şekilde seçildi. Parlak 500 serisi açık temada kalıyordu (Amber 500: 1.95:1),
 * o yüzden yeşil/amber/turuncu bir ton koyulaştırıldı.
 *
 * Doğrulama: __tests__/colorContrast.test.ts — her renk iki zeminde de test edilir.
 */
export const CategoryColors = {
  blue:    '#3B82F6', // Blue 500    — açık 3.35:1 · koyu 5.41:1
  green:   '#059669', // Emerald 600 — açık 3.43:1 · koyu 5.28:1  (500 açıkta 2.31 ✗)
  violet:  '#8B5CF6', // Violet 500  — açık 3.85:1 · koyu 4.70:1
  amber:   '#B45309', // Amber 700   — açık 4.57:1 · koyu 3.96:1  (500 açıkta 1.95 ✗)
  red:     '#EF4444', // Red 500     — açık 3.42:1 · koyu 5.29:1
  indigo:  '#6366F1', // Indigo 500  — açık 4.06:1 · koyu 4.45:1
  pink:    '#EC4899', // Pink 500    — açık 3.21:1 · koyu 5.64:1
  orange:  '#EA580C', // Orange 600  — açık 3.24:1 · koyu 5.59:1  (500 açıkta 2.55 ✗)
  cyan:    '#0891B2', // Cyan 600    — açık 3.35:1 · koyu 5.40:1  (500 açıkta 2.21 ✗)
  teal:    '#0D9488', // Teal 600    — açık 3.41:1 · koyu 5.31:1  (500 açıkta 2.26 ✗)
} as const;

export type CategoryColor = typeof CategoryColors[keyof typeof CategoryColors];

/**
 * AYAR ÇİPLERİ (2026-10-31, kullanıcı: "düzgün, sağlam, elit görünmeli; güven vermeli").
 * Eskiden karışık Tailwind tonlarıydı (canlı turuncu + indigo 500 + teal 600 — üç ayrı aile) ve
 * "çekirdek" satırlar VURGU RENGİNE bağlıydı: kişi vurguyu değiştirince Ses/Titreşim/Destek
 * ikonları da renk değiştiriyordu — ayar ekranı oynak görünüyordu.
 * Şimdi: kategori başına TEK, SABİT renk; hepsi aynı OKLCH ailesinden (L ≈0.55, C ≈0.13; hesap
 * nötr arduvaz). Bir sayfadaki bütün satırlar o kategorinin rengini taşır (renk = nerede olduğun).
 * Beyaz glif her çipte ≥4:1; koyu kartta çip sınırı ≥3:1. İki temada aynı (iOS Ayarlar gibi).
 */
/**
 * AÇILIŞ SÜRÜMLERİNİN RENKLERİ (2026-10-31) — her açılış bir sürüm seçer (bkz. AnimatedSplash).
 * Küratörlü sabit set: marka mavisi + ayar çipleriyle aynı ailenin üç tonu; kişinin vurgusu DEĞİL.
 */
export const SplashEditionColors = {
  blue: { light: '#2A5BCB', dark: '#86AEFF' },
  teal: { light: '#00877C', dark: '#1AA7A0' },
  coral: { light: '#C35045', dark: '#E06C5F' },
  lavender: { light: '#7B4EAF', dark: '#A579DD' },
} as const;

export const SettingsChip = {
  notify: '#C35045',     // Bildirimler — mercan kırmızısı (dikkat, ama alarm değil)
  appearance: '#5864BF', // Görünüm & Dil — indigo
  health: '#00877C',     // Uyku & Sağlık — deniz yeşili
  account: '#666F7E',    // Hesap, Yasal & Destek — arduvaz (sessiz, güvenilir)
  payments: '#258651',   // Ödemeler — zümrüt
  rewards: '#B66C18',    // Ödüller (odak puanı, seri kalkanı) — kehribar
} as const;

/**
 * Bilinen fatura/abonelik sağlayıcılarının AYIRT EDİCİ rengi (bkz. shared/utils/
 * paymentProviders.ts). CategoryColors'tan farkı: on sabit ton yetmez — onlarca
 * sağlayıcı, her biri kendi kimliğini taşımalı (İGDAŞ turuncu, Turkcell sarı,
 * Netflix kırmızı…). Gerçek marka logosu DEĞİL (paymentProviders.ts başlığına bkz.)
 * — yalnız kavram ikonunun rengi. Tek tondur (CategoryColors gibi, ModeAccents'in
 * aksine açık/koyu ayrımı yok) çünkü kalıcı veriye yazılmaz, her render'da sağlayıcı
 * id'sinden türer.
 */
/** Ödemelerde kullanıcının seçebildiği renkler (bkz. paymentLook). */
export const PaymentPalette = ['#2563EB', '#0891B2', '#059669', '#65A30D', '#D97706', '#EA580C', '#DC2626', '#DB2777', '#7C3AED', '#475569'] as const;

export const PaymentProviderColors = {
  // Dünyada ve Türkiye'de en çok abone olunan dijital ürünler (2026-11-06)
  appleTv: '#111827', paramountPlus: '#2563EB', hulu: '#16A34A', peacock: '#CA8A04', crunchyroll: '#EA580C', discoveryPlus: '#1D4ED8',
  dazn: '#1F2937', espnPlus: '#DC2626', youtubeTv: '#DC2626', tod: '#7C3AED', tvPlus: '#2563EB', deezer: '#7C3AED',
  tidal: '#111827', soundcloud: '#EA580C', amazonMusic: '#0891B2', muud: '#DB2777', kindleUnlimited: '#CA8A04', scribd: '#0D9488',
  blinkist: '#16A34A', appleOne: '#111827', evernote: '#16A34A', todoist: '#DC2626', zoom: '#2563EB', slack: '#7C3AED',
  figma: '#DB2777', capcut: '#111827', grammarly: '#16A34A', onePassword: '#2563EB', surfshark: '#0D9488', proton: '#7C3AED',
  copilotPro: '#2563EB', grok: '#111827', cursor: '#1F2937', xPremium: '#111827', linkedinPremium: '#1D4ED8', discordNitro: '#4F46E5',
  telegramPremium: '#0891B2', snapchatPlus: '#CA8A04', twitch: '#7C3AED', tinder: '#DC2626', bumble: '#CA8A04', hinge: '#1F2937',
  eaPlay: '#DC2626', ubisoftPlus: '#2563EB', geforceNow: '#16A34A', appleArcade: '#111827', googlePlayPass: '#16A34A', robloxPremium: '#1F2937',
  duolingo: '#16A34A', babbel: '#EA580C', cambly: '#CA8A04', masterclass: '#1F2937', strava: '#EA580C', peloton: '#DC2626',
  myfitnesspal: '#2563EB', headspace: '#EA580C', calm: '#2563EB', uberOne: '#111827', walmartPlus: '#2563EB', doordash: '#DC2626',
  instacart: '#16A34A', yemeksepeti: '#DB2777', getir: '#7C3AED', migros: '#EA580C', nyt: '#111827', medium: '#1F2937',
  substack: '#EA580C',
  // Doğalgaz — turuncu/kehribar ailesi
  igdas: '#EA580C',
  baskentgaz: '#EA580C',
  kayserigaz: '#EA580C',
  bursagaz: '#EA580C',
  izgaz: '#EA580C',
  // Elektrik — amber ailesi
  bedas: '#D97706',
  ayedas: '#D97706',
  ckBogazici: '#D97706',
  enerjisa: '#D97706',
  baskentEdas: '#D97706',
  akdenizElektrik: '#D97706',
  osmangazi: '#D97706',
  // Su — camgöbeği ailesi
  iski: '#0891B2',
  aski: '#0891B2',
  buski: '#0891B2',
  izsu: '#0891B2',
  // Mobil hat
  turkcell: '#EAB308',
  vodafone: '#DC2626',
  turkTelekom: '#2563EB',
  // İnternet — mor/sarı/mavi (operatörden ayırmak için farklı aile)
  turknet: '#7C3AED',
  superonline: '#EAB308',
  ttnet: '#2563EB',
  millenicom: '#7C3AED',
  vodafoneNet: '#DC2626',
  // Video/TV aboneliği — kırmızı/mavi/koyu ailesi
  netflix: '#DC2626',
  disneyPlus: '#2563EB',
  exxen: '#111827',
  blutv: '#2563EB',
  amazonPrime: '#2563EB',
  youtubePremium: '#DC2626',
  beinConnect: '#111827',
  digiturk: '#111827',
  gain: '#DC2626',
  mubi: '#111827',
  tabii: '#2563EB',
  tivibu: '#2563EB',
  sSport: '#DC2626',
  dSmart: '#111827',
  puhutv: '#EA580C',
  // Müzik aboneliği — yeşil/kırmızı
  spotify: '#16A34A',
  appleMusic: '#DC2626',
  youtubeMusic: '#DC2626',
  fizy: '#16A34A',
  // Bulut & üretkenlik — indigo/mor ailesi
  icloud: '#2563EB',
  googleOne: '#2563EB',
  microsoft365: '#2563EB',
  adobeCc: '#DC2626',
  dropbox: '#2563EB',
  canva: '#7C3AED',
  notion: '#111827',
  // Yapay zeka abonelikleri — mor/kehribar
  chatgptPlus: '#16A34A',
  claudePro: '#D97706',
  geminiAdvanced: '#2563EB',
  perplexityPro: '#0891B2',
  githubCopilot: '#111827',
  midjourney: '#111827',
  // VPN / gizlilik abonelikleri
  nordvpn: '#2563EB',
  expressvpn: '#DC2626',
  // Sesli kitap / podcast aboneliği
  audible: '#EA580C',
  storytel: '#7C3AED',
  // Eğitim platformları (kurumsal/online)
  coursera: '#2563EB',
  linkedinLearning: '#2563EB',
  // Bulut depolama
  mega: '#DC2626',
  pcloud: '#2563EB',
  // Yayın hizmeti
  hboMax: '#7C3AED',
  // Mobil hat
  pttcell: '#EAB308',
  // Spor salonu zinciri
  sportive: '#059669',
  // Sigorta şirketleri
  allianz: '#2563EB',
  axaSigorta: '#DC2626',
  turkiyeSigorta: '#DC2626',
  // Oyun abonelikleri — indigo ailesi
  playstationPlus: '#2563EB',
  xboxGamePass: '#16A34A',
  nintendoOnline: '#DC2626',
  steam: '#111827',
  // Alışveriş aboneliği
  trendyolPremium: '#EA580C',
  hepsiburadaPremium: '#EA580C',
  // Spor/eğitim/sigorta — yaygın diğer abonelik türleri
  gym: '#059669',
  education: '#7C3AED',
  udemy: '#7C3AED',
  insurance: '#0891B2',
  // Marka-bağımsız GENEL kategoriler — hiçbir ülkenin tüm sağlayıcıları
  // tek tek listelenemez (190+ ülke). Kullanıcı kendi yerel sağlayıcısını
  // yazdığında yine de doğru ikon+renk alması için (bkz. paymentProviders.ts
  // başlığındaki "yurt dışı" notu).
  electricGeneric: '#D97706',
  gasGeneric: '#EA580C',
  waterGeneric: '#0891B2',
  mobileGeneric: '#475569',
  internetGeneric: '#7C3AED',
  // Uluslararası mobil operatörler (ABD/İngiltere)
  att: '#2563EB',
  verizon: '#DC2626',
  tMobile: '#DB2777',
  ee: '#7C3AED',
  o2: '#2563EB',
  three: '#111827',
  // Uluslararası internet/kablo sağlayıcıları (ABD/İngiltere)
  comcastXfinity: '#2563EB',
  spectrum: '#2563EB',
  cox: '#DC2626',
  bt: '#7C3AED',
  sky: '#2563EB',
  virginMedia: '#DC2626',
  // Uluslararası enerji sağlayıcıları (İngiltere)
  britishGas: '#EA580C',
  eon: '#DC2626',
  edfEnergy: '#2563EB',
  octopusEnergy: '#7C3AED',
  // Uluslararası sigorta şirketleri (ABD/İngiltere)
  geico: '#16A34A',
  stateFarm: '#DC2626',
  allstate: '#2563EB',
  progressive: '#2563EB',
  directLine: '#DC2626',
  aviva: '#DC2626',
} as const;

/**
 * Mod vurgu renkleri — her dönemsel modun kimliği (Ramazan, YKS, Tez, Mülakat, Spor…).
 *
 * CategoryColors'tan farkı: bunlar KALICI VERİYE YAZILMIYOR, render sırasında moda göre
 * seçiliyor. Bu yüzden temaya duyarlı olabiliyorlar — açık temada derin, koyu temada
 * açık ton. (CategoryColors alışkanlık kaydına yazıldığı için bu lüksü taşımıyor.)
 *
 * Eskiden TurkishModeBanner.tsx ve modlar.tsx içinde ayrı ayrı, iç içe ternary'lerle
 * elle yazılıydı — iki yerde tutulan, hiçbir yerde tanımlı olmayan bir palet daha.
 *
 * Doğrulama: __tests__/colorContrast.test.ts — her mod, kendi temasının zemininde >= 3:1.
 */
/*
  Önceki sürüm (Radix 9 dolgu + Tailwind 500/600 açık tonlar) 2026-10-30'da aşağıdaki
  yumuşak palete geçti; eski tonlar git geçmişinde. Mülakat jade/teal yakınlığı dersi
  (OKLab ≥0.03) yeni palette de bekçi testiyle korunuyor (modeAccentDistinct.test.ts).
*/
/*
  YUMUŞAK MOD PALETİ (2026-10-30, madde 15 — kullanıcı: "tasarruf ve bırakma daha soft ama
  sınav, spor ve diğerleri göz yorabiliyor, iki tema için de"). Ölçüldü (OKLCH): yumuşak
  görünenler DÜŞÜK DOYGUNLUKTAYDI (tasarruf C 0.10, mülakat 0.13); göz yoranlar 0.19–0.22
  (spor, sınav, tez, ramazan, bırakma). Sorun ton değil DOYGUNLUK. Çözüm: her modun TONU
  korunur, açıklık ve doygunluk TEK BANDA çekilir — açık L 0.585 / C 0.125, koyu L 0.665 /
  C 0.115. Böylece hiçbir mod diğerlerinden "bağırmaz".
  Kısıtlar (hepsi ölçüldü): dolgu ≥3.9:1 · küçük metin ≥5.6:1 · modlar arası OKLab ≥0.047
  (eşik 0.03). Tonlar biraz açıldı (mülakat daha yeşil, tasarruf daha camgöbeği, mavi/mor
  ayrıldı): normal görüşte en yakın çift ΔE 4.9 → 9.1. Renk körlüğünde mavi/mor yakın kalır —
  mod rengi hiçbir yerde tek başına değil, hep simge + adla birlikte (ikincil kodlama).
*/
export const ModeAccents = {
  ramazan:  { light: '#6873C5', dark: '#818DDA' }, // Indigo
  yks:      { light: '#3E7FC3', dark: '#5D97D8' }, // Mavi
  exam:     { light: '#3E7FC3', dark: '#5D97D8' }, // Mavi — yks ile aynı aile (ikisi de sınav)
  kpss:     { light: '#3E7FC3', dark: '#5D97D8' }, // Mavi
  tez:      { light: '#8A68B9', dark: '#A182CE' }, // Mor
  mulakat:  { light: '#468F4A', dark: '#64A666' }, // Yeşil
  spor:     { light: '#BE693A', dark: '#CC7D52' }, // Turuncu (L +0.025: düşük açıklıkta kahveye kayıyordu)
  tasarruf: { light: '#068E89', dark: '#1CA9A3' }, // Teal
  birakma:  { light: '#BA5A59', dark: '#D17673' }, // Tuğla kırmızı
  default:  { light: '#B25983', dark: '#C9759B' }, // Gül
} as const;

/**
 * MOD VURGUSUNUN METİN VARYANTI — küçük yazı için.
 *
 * `ModeAccents` dolgu/ikon/çubuk/büyük-rakam içindir; oradaki tonlar açık temada
 * 3.5–4.5:1 bandında, yani WCAG'ın BÜYÜK metin eşiğini (3:1) geçer ama KÜÇÜK metin
 * eşiğini (4.5:1) geçmez. Oysa mod renkleri caption boyutunda da kullanılıyor
 * ("GÜN", "%40", "bugün 2/5"). Aynı tonu her iki işe koşmak, ya dolguyu soldurmak
 * ya yazıyı okunmaz bırakmak demekti.
 *
 * Çözüm iki rol: aynı ton ailesinin bir adım koyusu yalnız METİN için. Kimlik
 * korunur (aynı hue), okunabilirlik kazanılır. Koyu temada zaten açık tonlar
 * 10:1+ verdiği için aynen kullanılır.
 *
 * Ölçüm (2026-10-30, beyaz zemin): en düşük mulakat/tasarruf ~5.6:1 — hepsi AA ✓.
 * Doğrulama: __tests__/colorContrast.test.ts
 */
// Aynı tonlar, metin açıklığında: açık L 0.50 (≥5.6:1), koyu L 0.81 (≥10:1).
export const ModeAccentsText = {
  ramazan:  { light: '#525BA6', dark: '#B0BCFF' }, // Indigo
  yks:      { light: '#2765A5', dark: '#94C5FD' }, // Mavi
  exam:     { light: '#2765A5', dark: '#94C5FD' }, // Mavi — yks ile aynı aile (ikisi de sınav)
  kpss:     { light: '#2765A5', dark: '#94C5FD' }, // Mavi
  tez:      { light: '#70509B', dark: '#CCB3F5' }, // Mor
  mulakat:  { light: '#2F7434', dark: '#9AD29B' }, // Yeşil
  spor:     { light: '#984A1A', dark: '#F4AF8B' }, // Turuncu
  tasarruf: { light: '#06726E', dark: '#70D5CE' }, // Teal
  birakma:  { light: '#9C4343', dark: '#F8A9A5' }, // Tuğla kırmızı
  default:  { light: '#95426A', dark: '#F1A8C7' }, // Gül
} as const;

/**
 * KOYU TEMADA DOLU SİMGE KUTUSU (AppIcon: dolu zemin + beyaz glif). Koyu dolgu tonu (L 0.665)
 * beyaz glifle yalnız ~2.5:1 verir; eskiden ekran açık tonu koyu temada da kullanıyordu ve
 * parlak kutular koyu kartta "parlıyordu". Bu ton L 0.52: beyaz glif ≥5.2:1, kartta sakin.
 */
export const ModeTileDark = {
  ramazan:  '#5A63A2',
  yks:      '#3B6CA1',
  exam:     '#3B6CA1',
  kpss:     '#3B6CA1',
  tez:      '#745A99',
  mulakat:  '#417843',
  spor:     '#975532',
  tasarruf: '#147874',
  birakma:  '#9A504E',
  default:  '#944F6F',
} as const;

/** Mod simge kutusunun (AppIcon) dolgusu — açıkta dolgu tonu, koyuda sakin kutu tonu. */
export function modeTile(type: string | undefined, isDark: boolean): string {
  if (!isDark) return modeAccent(type, false);
  return (ModeTileDark as Record<string, string>)[type ?? ''] ?? ModeTileDark.default;
}

/**
 * VURGU RENGİ PALETLERİ (2026-10-31) — kullanıcı seçer: "en kaliteli renklerle, herkese göre, tarzımıza
 * uymalı". Tek ölçülü aile: OKLCH'de aynı açıklık (açık L 0.52, koyu L 0.66; Gece 0.45/0.62) ve doygunluk
 * (canlılar C 0.15, yumuşaklar C ≈0.06) — hangisi seçilse tarz bozulmaz.
 *  · 18 ton = 6'lık üç sıra: ilk iki sıra renk çemberini dolaşır (Mavi → … → Gök), üçüncü sıra yumuşak tonlar.
 *    Seçici kapalıyken yalnız ACCENT_FEATURED (6) görünür; "tümü" açılır liste gibi açılır (bkz. AccentPicker).
 *  · Yeşil/turuncu/kırmızı başta dışarıdaydı (durum renkleriyle karışır diye) → "palet yetersiz": Apple
 *    da vurgu renginde hepsine izin verir. Durum renkleri ayrı jetondur ve hep simge + metinle gelir.
 *  · Hiçbir iki ton ΔE <5 (OKLab×100) değil; elenenler: Orkide, Mürver, Petrol, Kil, Zeytin, Kum.
 *  · Mavi = marka mavisi BİREBİR (varsayılan; seçmeyen için hiçbir şey değişmez).
 *  · Her palet iki temada ölçülü: primary metin ≥4.5, beyaz düğme yazısı açık ≥4.5 / koyu ≥3,
 *    container yazısı ≥4.5 (bkz. __tests__/accentContrast.test.ts). Düğme yazısı beyaz, sarı tonlarda koyu (onPrimary).
 */
export type AccentId = 'blue' | 'lavender' | 'red' | 'sun' | 'emerald' | 'graphite' | 'rose' | 'coral' | 'amber' | 'leaf' | 'teal' | 'sky' | 'plum' | 'wine' | 'cocoa' | 'sage' | 'slate' | 'sand';
/**
 * primary = metin ve simge (zeminde okunur). primaryFill = dolgu (düğme, seçili öğe); üstündeki yazı onPrimaryFill.
 * onPrimary her tonda beyazdır: tamamlandı yeşili, mod rengi gibi vurgu OLMAYAN dolguların üstünde de kullanılır (2026-11-06: sarıda siyaha dönmüştü).
 * Çoğu tonda ikisi aynı. Sarıda ayrılır: gerçek sarı zeminde metin olarak okunmaz, koyu altın da sarı görünmez (Kado'daki color/onFill ayrımı).
 */
export interface AccentTokens { primary: string; primaryFill: string; primaryDim: string; primaryContainer: string; onPrimary: string; onPrimaryFill: string; onPrimaryContainer: string }
export interface AccentPalette { id: AccentId; label: { tr: string; en: string }; light: AccentTokens; dark: AccentTokens }
export const AccentPalettes: AccentPalette[] = [
  /* Varsayılan (2026-11-06): 18 ton ölçüldü. Mavi ailesi başarı/uyarı/hata ve renk körlüğü simülasyonunda en az karışan aile; ton 210°→222°, ikonun lacivertine (227°) yaklaştı, doygunluk indi. Koyuda yazı 8,8:1, dolgu üstünde beyaz AA. */
  { id: 'blue', label: { tr: 'TAZQ Mavisi', en: 'TAZQ Blue' }, light: { primary: '#2A5BCB', primaryFill: '#2A5BCB', primaryDim: '#1E429A', primaryContainer: '#DFE8FF', onPrimary: '#FFFFFF', onPrimaryFill: '#FFFFFF', onPrimaryContainer: '#14306F' }, dark: { primary: '#86AEFF', primaryFill: '#3B6FE0', primaryDim: '#3B6FE0', primaryContainer: '#16264F', onPrimary: '#FFFFFF', onPrimaryFill: '#FFFFFF', onPrimaryContainer: '#C9D8FF' } },
  { id: 'lavender', label: { tr: 'Nebula', en: 'Nebula' }, light: { primary: '#735FC3', primaryFill: '#735FC3', primaryDim: '#3A2770', primaryContainer: '#EEECFE', onPrimary: '#FFFFFF', onPrimaryFill: '#FFFFFF', onPrimaryContainer: '#362B60' }, dark: { primary: '#9784EC', primaryFill: '#9784EC', primaryDim: '#735FC3', primaryContainer: '#2B244B', onPrimary: '#FFFFFF', onPrimaryFill: '#FFFFFF', onPrimaryContainer: '#D6D2FA' } },
  { id: 'red', label: { tr: 'Nar', en: 'Pomegranate' }, light: { primary: '#C34247', primaryFill: '#C34247', primaryDim: '#6C0515', primaryContainer: '#FEE9E7', onPrimary: '#FFFFFF', onPrimaryFill: '#FFFFFF', onPrimaryContainer: '#5E1A1D' }, dark: { primary: '#EE696A', primaryFill: '#EE696A', primaryDim: '#C34247', primaryContainer: '#481B1B', onPrimary: '#FFFFFF', onPrimaryFill: '#FFFFFF', onPrimaryContainer: '#FACAC7' } },
  { id: 'sun', label: { tr: 'Safran', en: 'Saffron' }, light: { primary: '#563E00', primaryFill: '#EDB83F', primaryDim: '#493400', primaryContainer: '#FFE5B1', onPrimary: '#FFFFFF', onPrimaryFill: '#2A1E00', onPrimaryContainer: '#3D2A00' }, dark: { primary: '#F7C24B', primaryFill: '#EDB83F', primaryDim: '#563E00', primaryContainer: '#392800', onPrimary: '#FFFFFF', onPrimaryFill: '#2A1E00', onPrimaryContainer: '#E9D5AF' } },
  { id: 'emerald', label: { tr: 'Orman', en: 'Forest' }, light: { primary: '#2A7D57', primaryFill: '#2A7D57', primaryDim: '#01442A', primaryContainer: '#DEF5E8', onPrimary: '#FFFFFF', onPrimaryFill: '#FFFFFF', onPrimaryContainer: '#133F2B' }, dark: { primary: '#52A27A', primaryFill: '#52A27A', primaryDim: '#2A7D57', primaryContainer: '#003520', onPrimary: '#FFFFFF', onPrimaryFill: '#FFFFFF', onPrimaryContainer: '#B9E3CB' } },
  { id: 'graphite', label: { tr: 'Mürekkep', en: 'Ink' }, light: { primary: '#232833', primaryFill: '#232833', primaryDim: '#333840', primaryContainer: '#ECEEF3', onPrimary: '#FFFFFF', onPrimaryFill: '#FFFFFF', onPrimaryContainer: '#32363C' }, dark: { primary: '#8C93A3', primaryFill: '#8C93A3', primaryDim: '#232833', primaryContainer: '#282B32', onPrimary: '#FFFFFF', onPrimaryFill: '#FFFFFF', onPrimaryContainer: '#D3D8DF' } },
  { id: 'rose', label: { tr: 'Gül', en: 'Rose' }, light: { primary: '#B44B6E', primaryFill: '#B44B6E', primaryDim: '#631633', primaryContainer: '#FFE8ED', onPrimary: '#FFFFFF', onPrimaryFill: '#FFFFFF', onPrimaryContainer: '#572032' }, dark: { primary: '#DE7192', primaryFill: '#DE7192', primaryDim: '#B44B6E', primaryContainer: '#461A29', onPrimary: '#FFFFFF', onPrimaryFill: '#FFFFFF', onPrimaryContainer: '#F8C9D4' } },
  { id: 'coral', label: { tr: 'Kor', en: 'Ember' }, light: { primary: '#B45127', primaryFill: '#B45127', primaryDim: '#621F00', primaryContainer: '#FFE9E1', onPrimary: '#FFFFFF', onPrimaryFill: '#FFFFFF', onPrimaryContainer: '#58240D' }, dark: { primary: '#DE774E', primaryFill: '#DE774E', primaryDim: '#B45127', primaryContainer: '#471D0C', onPrimary: '#FFFFFF', onPrimaryFill: '#FFFFFF', onPrimaryContainer: '#F8CCBC' } },
  { id: 'amber', label: { tr: 'Bal', en: 'Honey' }, light: { primary: '#5E3905', primaryFill: '#E29940', primaryDim: '#512F01', primaryContainer: '#FEE3C6', onPrimary: '#FFFFFF', onPrimaryFill: '#2A1E00', onPrimaryContainer: '#432600' }, dark: { primary: '#FFBB70', primaryFill: '#E29940', primaryDim: '#5E3905', primaryContainer: '#402400', onPrimary: '#FFFFFF', onPrimaryFill: '#2A1E00', onPrimaryContainer: '#F0D1B1' } },
  { id: 'leaf', label: { tr: 'Zeytin', en: 'Olive' }, light: { primary: '#64762E', primaryFill: '#64762E', primaryDim: '#313E03', primaryContainer: '#EBF2DC', onPrimary: '#FFFFFF', onPrimaryFill: '#FFFFFF', onPrimaryContainer: '#303A14' }, dark: { primary: '#879B53', primaryFill: '#879B53', primaryDim: '#64762E', primaryContainer: '#263000', onPrimary: '#FFFFFF', onPrimaryFill: '#FFFFFF', onPrimaryContainer: '#D1DEB6' } },
  { id: 'teal', label: { tr: 'Gelgit', en: 'Tide' }, light: { primary: '#187B7C', primaryFill: '#187B7C', primaryDim: '#004141', primaryContainer: '#DCF4F4', onPrimary: '#FFFFFF', onPrimaryFill: '#FFFFFF', onPrimaryContainer: '#0B3D3D' }, dark: { primary: '#47A1A0', primaryFill: '#47A1A0', primaryDim: '#187B7C', primaryContainer: '#003333', onPrimary: '#FFFFFF', onPrimaryFill: '#FFFFFF', onPrimaryContainer: '#B5E2E1' } },
  { id: 'sky', label: { tr: 'Gök', en: 'Sky' }, light: { primary: '#23769F', primaryFill: '#23769F', primaryDim: '#003D58', primaryContainer: '#DDF2FF', onPrimary: '#FFFFFF', onPrimaryFill: '#FFFFFF', onPrimaryContainer: '#0F3A50' }, dark: { primary: '#4D9BC6', primaryFill: '#4D9BC6', primaryDim: '#23769F', primaryContainer: '#003045', onPrimary: '#FFFFFF', onPrimaryFill: '#FFFFFF', onPrimaryContainer: '#B5DEF7' } },
  { id: 'plum', label: { tr: 'Erik', en: 'Plum' }, light: { primary: '#955A98', primaryFill: '#955A98', primaryDim: '#4F2452', primaryContainer: '#F9E8FA', onPrimary: '#FFFFFF', onPrimaryFill: '#FFFFFF', onPrimaryContainer: '#472849' }, dark: { primary: '#BB7EBF', primaryFill: '#BB7EBF', primaryDim: '#955A98', primaryContainer: '#3C1E3E', onPrimary: '#FFFFFF', onPrimaryFill: '#FFFFFF', onPrimaryContainer: '#EBCCEC' } },
  { id: 'wine', label: { tr: 'Bordo', en: 'Wine' }, light: { primary: '#8A2340', primaryFill: '#8A2340', primaryDim: '#5F1D2A', primaryContainer: '#FEE8EA', onPrimary: '#FFFFFF', onPrimaryFill: '#FFFFFF', onPrimaryContainer: '#54242B' }, dark: { primary: '#E56D80', primaryFill: '#E56D80', primaryDim: '#8A2340', primaryContainer: '#481A22', onPrimary: '#FFFFFF', onPrimaryFill: '#FFFFFF', onPrimaryContainer: '#F9C9CE' } },
  { id: 'cocoa', label: { tr: 'Kakao', en: 'Cocoa' }, light: { primary: '#8B6754', primaryFill: '#8B6754', primaryDim: '#4B3123', primaryContainer: '#F8ECE5', onPrimary: '#FFFFFF', onPrimaryFill: '#FFFFFF', onPrimaryContainer: '#433126' }, dark: { primary: '#B18B77', primaryFill: '#B18B77', primaryDim: '#8B6754', primaryContainer: '#3B261A', onPrimary: '#FFFFFF', onPrimaryFill: '#FFFFFF', onPrimaryContainer: '#E9D2C6' } },
  { id: 'sage', label: { tr: 'Adaçayı', en: 'Sage' }, light: { primary: '#5E7562', primaryFill: '#5E7562', primaryDim: '#2C3D2F', primaryContainer: '#E9F1EA', onPrimary: '#FFFFFF', onPrimaryFill: '#FFFFFF', onPrimaryContainer: '#2D392F' }, dark: { primary: '#819985', primaryFill: '#819985', primaryDim: '#5E7562', primaryContainer: '#212F24', onPrimary: '#FFFFFF', onPrimaryFill: '#FFFFFF', onPrimaryContainer: '#CEDCD0' } },
  { id: 'slate', label: { tr: 'Arduvaz', en: 'Slate' }, light: { primary: '#5E7182', primaryFill: '#5E7182', primaryDim: '#2C3A46', primaryContainer: '#E9EFF5', onPrimary: '#FFFFFF', onPrimaryFill: '#FFFFFF', onPrimaryContainer: '#2D3740' }, dark: { primary: '#8296A8', primaryFill: '#8296A8', primaryDim: '#5E7182', primaryContainer: '#212D37', onPrimary: '#FFFFFF', onPrimaryFill: '#FFFFFF', onPrimaryContainer: '#CDD9E4' } },
  { id: 'sand', label: { tr: 'Kum', en: 'Sand' }, light: { primary: '#4A4130', primaryFill: '#C0AF8D', primaryDim: '#41361F', primaryContainer: '#F0E7D4', onPrimary: '#FFFFFF', onPrimaryFill: '#2A1E00', onPrimaryContainer: '#352D1C' }, dark: { primary: '#DAC9A6', primaryFill: '#C0AF8D', primaryDim: '#4A4130', primaryContainer: '#332A16', onPrimary: '#FFFFFF', onPrimaryFill: '#2A1E00', onPrimaryContainer: '#E0D7C4' } },
];
export const DEFAULT_ACCENT: AccentId = 'blue';
/**
 * TAZQ RENKLERİ (2026-11-06). Kullanıcı: "en fark yaratacak, herkesi içine almalı"; ilk denemede en doygun değerler "çok Paint" oldu.
 * Kural: her tonun doygunluğu elle seçilir, aydınlığı kontrast kuralının izin verdiği en yüksek değerdir. İlk sıra soğuk, sıcak, sarı, doğa ve nötrü
 * yan yana koyar; kırmızı ve sarı artık var. Adlar TAZQ'ın kendi dünyasından.
 */
export const ACCENT_FEATURED: AccentId[] = ['blue', 'lavender', 'red', 'sun', 'emerald', 'graphite'];
/** Kaldırılan tonu seçmiş kullanıcı maviye düşmez, en yakın yeni tona geçer. */
const ACCENT_MOVED: Record<string, AccentId> = { indigo: 'lavender', mauve: 'plum', orange: 'coral', mustard: 'amber', night: 'slate' };
export const accentOf = (id: string | null | undefined): AccentPalette => {
  const wanted = (id && ACCENT_MOVED[id]) || id;
  return AccentPalettes.find(a => a.id === wanted) ?? AccentPalettes[0];
};

/**
 * ELLE EKLENEN ALIŞKANLIK PALETİ (2026-10-30) — ModeAccents ile AYNI açıklık/doygunluk ailesi
 * (mod ve elle eklenen alışkanlıklar yan yana uyumlu). dataviz doğrulayıcısı açık + koyu: açıklık
 * bandı, doygunluk tabanı, normal görüş ayrımı, ≥3:1 kontrast GEÇTİ; renk körü komşu ayrımı 6.7–7.3
 * (simge + ad ikincil kodlama). Kullanımı: features/habits/utils/habitColor.ts.
 */
/** Sıra dataviz doğrulayıcısında en iyi komşu ayrımını veren dizilim. */
export const HabitPalette = [
  { id: 'blue', light: '#3E7FC3', dark: '#5D97D8' },
  { id: 'brick', light: '#BA5A59', dark: '#D17673' },
  { id: 'teal', light: '#00938C', dark: '#1CA9A3' },
  { id: 'violet', light: '#8A68B9', dark: '#A182CE' },
  { id: 'orange', light: '#BE693A', dark: '#CC7D52' },
  { id: 'indigo', light: '#6873C5', dark: '#818DDA' },
  { id: 'green', light: '#468F4A', dark: '#64A666' },
  { id: 'rose', light: '#B25983', dark: '#C9759B' },
] as const;

export type ModeAccentKey = keyof typeof ModeAccents;

/**
 * Modun vurgu rengini aktif temaya göre çözer — DOLGU/İKON/ÇUBUK/büyük rakam için.
 * Küçük yazıda `modeAccentText` kullan (kontrast).
 */
export function modeAccent(type: string | undefined, isDark: boolean): string {
  const entry = (ModeAccents as Record<string, { light: string; dark: string }>)[type ?? ''] ?? ModeAccents.default;
  return isDark ? entry.dark : entry.light;
}

/**
 * Dolu aksan zemininin ÜSTÜNDEKİ yazı/ikon rengi.
 *
 * Dolu butonlar ("Planı Seç ›", "Kaydet", "Planı Uygula") zeminlerine `modeAccent`
 * alıp yazılarını SABİT beyaz yazıyordu. Açık temada bu doğru: aksan koyu ton
 * (#3B82F6 gibi), beyaz yazı AA geçiyor. Koyu temada ise aksan pastele dönüyor
 * (#93C5FD) — beyaz yazı orada 1.4:1, yani okunmuyor. Koyu temada yazı koyulaşır.
 *
 * Ölçüm (koyu tema, #10131A yazı): exam 11.6 · tez 11.0 · mulakat 12.3 ·
 * spor 10.4 · ramazan 10.6 · tasarruf 13.1 · birakma 10.2 — hepsi AA ✓.
 */
export function modeAccentOn(isDark: boolean, fill?: string): string {
  if (!isDark) return '#FFFFFF';
  /*
    Koyu dolgular artık Radix 9 (canlı) — tek bir koyu yazı hepsine uymuyor: indigo ve
    violet beyaz ister (#10131A üstlerinde 3.5:1), turuncu/mavi/yeşil koyu ister (beyaz
    2.97–3.26:1). Radix de aynısını söyler: "çoğu 9 beyazla, bazıları koyu yazıyla".
    Dolgu verilirse yüksek kontrastlı olan seçilir.
  */
  if (fill && contrastOf('#FFFFFF', fill) > contrastOf('#10131A', fill)) return '#FFFFFF';
  return '#10131A';
}

function luminanceOf(hex: string): number {
  const c = hex.replace('#', '');
  const f = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const [r, g, b] = [0, 2, 4].map((i) => f(parseInt(c.substr(i, 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrastOf(a: string, b: string): number {
  const [hi, lo] = [luminanceOf(a), luminanceOf(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Modun METİN rengi — caption/etiket gibi küçük yazılar için AA (4.5:1) garantili. */
export function modeAccentText(type: string | undefined, isDark: boolean): string {
  const entry = (ModeAccentsText as Record<string, { light: string; dark: string }>)[type ?? ''] ?? ModeAccentsText.default;
  return isDark ? entry.dark : entry.light;
}

/**
 * Bileşenlere geçirilen tema nesnesinin tipi (useAppTheme().theme).
 *
 * Elle yazılmıyor, lightPalette'ten türetiliyor: palet büyüdüğünde tip kendiliğinden
 * büyür ve iki kaynak birbirinden ayrışamaz. Daha önce her bileşen `theme: any`
 * alıyordu — yani var olmayan bir renk token'ı yazmak derlemede yakalanmıyordu.
 */
export type AppTheme = typeof lightPalette;

// darkPalette'in light ile aynı anahtarlara sahip olduğunu derleme zamanında doğrular.
// Biri diğerine token eklenip ötekine eklenmezse burası hata verir.
const _darkPaletteMatchesLight: AppTheme = darkPalette;
void _darkPaletteMatchesLight;

/*
  NEFES SEANSI PALETİ (madde 14) — seans ekranı temadan bağımsız KOYU ve sakindir
  (odak ekranı gibi: göz kapanmaya yakınken parlak zemin rahatsız eder). Her amacın
  kendi doygunluğu düşük tonu var; madde 15'teki "göz yoran renk" uyarısıyla aynı
  ilke: pastel yapraklar, koyu zemin, vurgu yalnız yazı/düğmede.
    petals: kürenin iki yaprak tonu (ekran karışımıyla üst üste biner)
    bg:     zemin (üst → alt) · accent: başlık, düğme, ilerleme
*/
export const BreathPalette = {
  sigh:      { petals: ['#5EC4B0', '#4A9BB0'], bg: ['#0B1E24', '#06121A'], accent: '#7DD3C0' }, // Sakinleş — deniz
  box:       { petals: ['#7C8CF0', '#5B6FD8'], bg: ['#10142C', '#080B1A'], accent: '#A5B4FC' }, // Odaklan — çivit
  sleep:     { petals: ['#A78BDA', '#7C6BC4'], bg: ['#160F2A', '#0A0718'], accent: '#C4B5FD' }, // Uyu — lavanta
  resonance: { petals: ['#8CC79E', '#5FA383'], bg: ['#0E1D17', '#07110D'], accent: '#A7D7B5' }, // Denge — adaçayı
} as const;

/** Kumbaradaki sikkenin metali: vurgu rengine bağlı değil, para her temada altındır. */
export const CoinMetal = { light: '#FBEBB0', mid: '#E9C25A', deep: '#B98A2C', shade: '#8A6318' } as const;
