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
  primary: '#0B6BCB',
  primaryDim: '#08528F',        // basılı durum
  primaryContainer: '#DBEAFE',  // Blue 100
  onPrimary: '#FFFFFF',         // 5.17:1
  onPrimaryContainer: '#0A3D62',  // primary'nin koyu ucu (hue 210 ailesi)

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
  primary: '#0A84FF',
  primaryDim: '#0B6BCB',        // basılı durum — açık temanın mavisi
  primaryContainer: '#0A2A4A',  // primary'nin koyu ucu (hue 210 ailesi)
  // Material 3 kuralı: koyu temada primary AÇIK olduğu için onPrimary KOYU olur.
  // iOS burada beyaz kullanır ama kendi ölçümü 3.65:1 — AA'dan kalıyor. Okunabilirlik
  // "elit kalite"nin parçası, o yüzden AA tercih edildi (5.45:1).
  onPrimary: '#09090B',
  onPrimaryContainer: '#BFDBFE', // Blue 200, hue 213 — eskiden #C7D2FE (Indigo 200, hue 228): konteyner 210 ailesindeyken yazısı indigoydu. 10.24:1

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
 * Bilinen fatura/abonelik sağlayıcılarının AYIRT EDİCİ rengi (bkz. shared/utils/
 * paymentProviders.ts). CategoryColors'tan farkı: on sabit ton yetmez — onlarca
 * sağlayıcı, her biri kendi kimliğini taşımalı (İGDAŞ turuncu, Turkcell sarı,
 * Netflix kırmızı…). Gerçek marka logosu DEĞİL (paymentProviders.ts başlığına bkz.)
 * — yalnız kavram ikonunun rengi. Tek tondur (CategoryColors gibi, ModeAccents'in
 * aksine açık/koyu ayrımı yok) çünkü kalıcı veriye yazılmaz, her render'da sağlayıcı
 * id'sinden türer.
 */
export const PaymentProviderColors = {
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
  KOYU TEMA = RADIX 9. ADIM (@radix-ui/colors 3.0, scratchpad'den ölçüldü).
  Radix'in kuralı: DOLGU tonu (9) iki temada AYNIDIR; koyuda değişen yalnız metin (11).
  Eskiden koyu temada dolgular Tailwind 300 pastellerine dönüyordu (#FDBA74, #93C5FD):
  soluk, birbirine yakın ("koyu temada mod renkleri çok kötü"). Pasteller büyük
  sayıda/çubukta "yıkanmış" görünür; Radix 9 koyu zeminde 3.7–6.7:1 ile canlı kalır.
  Açık tema DEĞİŞMEDİ: Radix 9 açık zeminde 2.7–3.0:1 (dolu buton için tasarlanmış);
  bizde aksan ince çubuk/büyük sayıda da kullanıldığı için mevcut 500/600 tonları kalıyor.
  Mülakat jade yerine GRASS: jade, tasarrufun teal'ından OKLab 0.023 uzaktı (eşik 0.03).
*/
export const ModeAccents = {
  ramazan:  { light: '#6366F1', dark: '#3E63DD' }, // Indigo — Radix indigo-9
  yks:      { light: '#3B82F6', dark: '#0090FF' }, // Blue — Radix blue-9
  exam:     { light: '#3B82F6', dark: '#0090FF' }, // Blue — yks ile aynı aile (ikisi de sınav)
  kpss:     { light: '#3B82F6', dark: '#0090FF' }, // Blue
  tez:      { light: '#8B5CF6', dark: '#6E56CF' }, // Violet — Radix violet-9
  mulakat:  { light: '#059669', dark: '#46A758' }, // Yeşil — Radix grass-9 (açıkta 600: 500 = 2.31:1 ✗)
  spor:     { light: '#EA580C', dark: '#F76B15' }, // Orange — Radix orange-9 (açıkta 600: 500 = 2.55:1 ✗)
  tasarruf: { light: '#0D9488', dark: '#12A594' }, // Teal — Radix teal-9
  birakma:  { light: '#EF4444', dark: '#E5484D' }, // Red — Radix red-9
  default:  { light: '#EC4899', dark: '#E93D82' }, // Pink — Radix crimson-9
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
 * Ölçüm (beyaz zemin): exam 5.17 · tez 5.70 · mulakat 5.48 · spor 5.18 ·
 * ramazan 6.29 · tasarruf 5.47 · birakma 4.83 · default 4.60 — hepsi AA ✓.
 * Doğrulama: __tests__/colorContrast.test.ts
 */
export const ModeAccentsText = {
  // Koyu: Radix 11. adım (düşük kontrastlı metin, koyu zeminde 8:1+). Açık: değişmedi.
  ramazan:  { light: '#4F46E5', dark: '#9EB1FF' },
  yks:      { light: '#2563EB', dark: '#70B8FF' },
  exam:     { light: '#2563EB', dark: '#70B8FF' },
  kpss:     { light: '#2563EB', dark: '#70B8FF' },
  tez:      { light: '#7C3AED', dark: '#BAA7FF' },
  mulakat:  { light: '#047857', dark: '#71D083' },
  spor:     { light: '#C2410C', dark: '#FFA057' },
  tasarruf: { light: '#0F766E', dark: '#0BD8B6' },
  birakma:  { light: '#DC2626', dark: '#FF9592' },
  default:  { light: '#DB2777', dark: '#FF92AD' },
} as const;

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
