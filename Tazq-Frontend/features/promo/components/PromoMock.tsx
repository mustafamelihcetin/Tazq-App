import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppBlur } from '@/shared/components/AppBlur';
import { TazqLogo } from '@/shared/components/TazqLogo';
import { Colors } from '@/shared/constants/Colors';
import { PromoFocusMock } from '@/features/promo/components/PromoFocusMock';
import { ACCENTS, NEUTRAL, promoWeight, type Glyph, type PromoKind, type PromoMode, type PromoWeight } from '@/features/promo/promoTheme';

/*
  Yeniden dışa aktarım: tanıtım sayfası ve testler bu bileşenin yanından okuyor.
  İkinci bir içe aktarma yolu açmamak için tek kapı burası kalıyor.
*/
export { ACCENTS } from '@/features/promo/promoTheme';
export type { AccentKey, PromoKind, PromoMode } from '@/features/promo/promoTheme';
import { PROMO_COPY } from '@/features/promo/promoCopy';
import type { PromoDevice } from '@/features/promo/promoDevices';
import {
  Moon, GraduationCap, Dumbbell, Coins, BookOpen, CheckCircle2, Circle, Check,
  Flame, Trophy, Gauge, Plus, Clock, Zap, Target, SlidersHorizontal, Search,
  CalendarClock, ChevronRight, BarChart3, Info, Ban, Briefcase, TrendingUp, Play, Library,
  // Alt sekme çubuğunun GERÇEK ikonları (bkz. BottomNavBar) — mock ile uygulama
  // arasındaki en görünür fark buydu: tanıtımda başka ikonlar duruyordu.
  LayoutGrid, CheckSquare, Sparkles, CalendarDays, Layers,
  Wifi, BatteryFull, SignalHigh,
} from 'lucide-react-native';

/**
 * Telefon çerçevesinin içini dolduran temsili ekran.
 *
 * ── NEDEN BU KADAR TİTİZ ─────────────────────────────────────────────────────
 * Mağaza görseli bir VAATTİR: kullanıcı orada gördüğü ekranı indirdikten sonra bulmayı
 * bekler. Mock "benzer" olduğunda kimse fark etmez ama YANLIŞ olduğunda fark edilir —
 * tanımadığı bir arayüzle karşılaşan kişi, gördüğü tanıtıma bir daha inanmaz.
 *
 * ── ÖLÇEK: TEK ÇARPAN, GERÇEK CİHAZ ──────────────────────────────────────────
 * Bu dosyadaki her ölçü uygulamanın KENDİ jetonundan geliyor (44pt başlık, 49pt yüzen
 * sekme kapsülü, 24pt sayfa kenarı, 16pt ritim, 12pt kart yarıçapı, 54pt FAB) ve tek bir
 * `px()` çarpanından geçiyor. Çarpanın referansı gerçek cihazın mantıksal genişliği
 * (bkz. `scale` — çağıran taraf `çerçeveGenişliği / 393` veriyor).
 *
 * Bu bir kez YANLIŞ kuruldu ve sonucu hemen görüldü: referans 234 alınmıştı, yani her
 * şey 1.68 kat büyük çiziliyordu — yazılar sığmıyor, kartlar iç içe giriyordu. Ölçek
 * referansı gerçek cihazdan başka bir şey olamaz; aksi hâlde "oranı koruyorum" demek
 * boş bir cümle olur. Doğru referansla mock, gerçek ekranın birebir küçültülmüş hâli:
 * gerçekte ne sığıyorsa burada da o sığar.
 *
 * @param device     Hangi cihaz çiziliyor (bkz. promoDevices) — güvenli alanlar,
 *                   ada ve platform dili oradan gelir. Mock cihaz UYDURMAZ.
 * @param frameWidth Çerçevenin İÇ genişliği — halka/şerit gibi oransal ölçüler buradan.
 * @param scale      frameWidth / device.w. Uygulama pt'sini mock pt'sine çeviren tek çarpan.
 */
export const PromoMock: React.FC<{
  kind: PromoKind;
  mode: PromoMode;
  lang: 'tr' | 'en';
  device: PromoDevice;
  frameWidth: number;
  scale: number;
}> = ({ kind, mode, lang, device, frameWidth, scale }) => {
  const fw = frameWidth;
  const S = scale;
  const isIOS = device.platform === 'ios';
  const A = ACCENTS[mode];
  const deepMode: PromoMode = (kind === 'focus' || kind === 'deepfocus') ? 'dark' : mode;
  const M = NEUTRAL[deepMode];
  const PAL = deepMode === 'dark' ? Colors.dark : Colors.light;
  const c = PROMO_COPY[lang];

  /** Uygulama pt'si → mock pt'si. TEK dönüşüm; oranlar burada korunur. */
  const px = (n: number) => n * S;

  /*
    ── GÜVENLİ ALANLAR CİHAZIN, UYGULAMANIN DEĞİL ──────────────────────────────
    iPhone'da üstte Dynamic Island için 59pt, altta ana ekran çubuğu için 34pt pay
    var; Pixel'de 28/24dp, tabletlerde 24/20-24. Aynı sayıları hepsine vermek, Android
    mock'unu "köşeleri yuvarlatılmış bir iPhone" yapardı. Sayılar cihaz tablosundan
    geliyor, buraya elle yazılmıyor.
  */
  const TOP_INSET = px(device.topInset);
  const BOT_INSET = px(device.bottomInset);

  const EDGE = px(24);       // S.lg — sayfa kenarı
  const GAP = px(16);        // S.md — dikey ritim
  const RAD = px(12);        // R.md — kart
  const RAD_L = px(16);      // R.lg — görev kartı
  const BAR_H = px(44);      // TOP_BAR_HEIGHT
  const NAV_H = px(49);      // NAV_BAR_HEIGHT — iki platformda da aynı
  /*
    ── SEKME ÇUBUĞU: İKİ PLATFORMUN İKİ DOĞRUSU ────────────────────────────────
    Bunlar uydurma değil, uygulamanın kendi jetonlarının platform dalları
    (bkz. tokens.ts → NAV_BAR_SIDE_INSET / NAV_BAR_LIFT / NAV_BAR_RADIUS).

    iOS 26 sistem sekme çubuğunu kenarlardan içeri alınmış, yüzen bir CAM KAPSÜLE
    çevirdi. Material'ın dili ise dibe yapışık, tam genişlikte, OPAK bir gezinme
    çubuğu. Yüzen kapsülü Android'e taşımak, platformun diline yabancı bir şey
    yapmak olurdu — bu yüzden uygulamada da ayrıldılar, mock'ta da ayrılıyorlar.
  */
  const NAV_INSET = px(isIOS ? 16 : 0);   // NAV_BAR_SIDE_INSET
  const NAV_LIFT = px(isIOS ? 8 : 0);     // NAV_BAR_LIFT
  const NAV_RADIUS = isIOS ? 999 : 0;     // NAV_BAR_RADIUS
  const ITEM = px(32);       // TOP_ITEM_SIZE — başlıktaki yuvarlak düğme
  // Punto ölçeği doğrudan F jetonlarının sayısal karşılığı (caption 11 … display 28).
  const T = {
    cap: px(11), c2: px(12), foot: px(13), body: px(14), call: px(16),
    sub: px(17), t3: px(20), disp: px(28), metric: px(44),
  };

  /*
    ── GENİŞ EKRANDA DÜZEN İKİYE BÖLÜNÜR ───────────────────────────────────────
    Uygulamanın kendi kuralı (bkz. tokens.ts → contentMaxWidth, WideSplit): telefonda
    içerik 600pt'lik tek sütunda, tablette 1240'a kadar açılan bir kapta AMA İKİ
    SÜTUN hâlinde durur.

    İki sütun, çünkü genişliği satırı uzatmak için kullanmak okunurluğu bozuyor: bir
    görev satırının solundaki onay kutusuyla sağındaki saat arasında yarım ekran
    boşluk kalır. iPadOS uygulamaları da genişliği ikinci bir sütun açmak için
    kullanır. Kartların kendi genişliği telefondakine yakın kalır.

    Sekme kapsülü bu kuralın DIŞINDA: o hep 600'de kalıyor (bkz. TabBar) — yüzen bir
    kapsülün beş sekmesi 1240pt'ye yayılırsa dokunma hedefleri birbirinden kopar.
  */
  /*
    ÜÇ KADEME, İKİ EŞİK — uygulamanın kendi kuralı (bkz. tokens.ts).
      · telefon (<700)           → tek sütun, 600pt
      · dikey tablet (700-1100)  → tek sütun ama 760pt, listeler ızgaraya döner
      · çok geniş (≥1100)        → sayfa İKİ SÜTUNA bölünür
    Bölünmeyi 700'de başlatmak boşluğu BÜYÜTÜYORDU: iki sütun içeriğin boyunu yarıya
    indirir ve dikey tablette ekranın dörtte üçü boşalır.
  */
  const tablet = device.wide;
  const twoCol = device.w >= 1100;
  const COL = px(twoCol ? 1240 : tablet ? 760 : 600);
  /** Kabın gerçek iç genişliği — yüzde değil, sayıyla; sütun ölçüleri buradan. */
  const CONTENT_W = Math.min(fw, COL) - EDGE * 2;
  /** Bir sütunun genişliği. */
  const HALF = (CONTENT_W - GAP) / 2;

  /*
    ── MAĞAZA GÖRSELİ O CİHAZDA NE SIĞIYORSA ONU GÖSTERİR ──────────────────────
    Tablette düzen ikiye bölününce her sütun yarı yüksekliğe düştü ve ekranın altı
    boş kaldı. Ama bu bir DÜZEN sorunu değil, bir İÇERİK sorunuydu: mock'un demo
    verisi telefona göre seçilmişti (beş görev, üç alışkanlık). Gerçek bir tablet
    kullanıcısının ekranında o kadar az satır olmaz — ekran daha uzun olduğu için
    daha fazlası görünür.

    Yani uydurulmuş bir dolgu değil: aynı liste, cihazın gösterebildiği kadarı.
    Telefon ilk N tanesini alıyor (gerisi zaten katlamanın altında kalırdı),
    tablet tamamını.
  */
  const take = <T,>(arr: T[], phoneCount: number) => (tablet ? arr : arr.slice(0, phoneCount));

  /**
   * Geniş ekranda iki sütun, dar ekranda tek akış — uygulamadaki WideSplit'in karşılığı.
   * Dar ekranda Fragment döndüğü için Shell'in kendi dikey ritmi (gap) bozulmuyor.
   */
  const Cols: React.FC<{ left: React.ReactNode; right: React.ReactNode }> = ({ left, right }) =>
    twoCol ? (
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: GAP }}>
        <View style={{ width: HALF, gap: GAP }}>{left}</View>
        <View style={{ width: HALF, gap: GAP }}>{right}</View>
      </View>
    ) : (
      <>{left}{right}</>
    );

  /** Görev ızgarası: telefonda 1, dikey tablette 2, çok geniş ekranda 3 sütun. */
  const listCols = twoCol ? 3 : tablet ? 2 : 1;
  /** Alışkanlık rozetlerinin kimlik renkleri — liste uzadıkça palet döner. */
  const HABIT_COLORS = [A.teal, A.violet, A.emerald, A.orange, A.amber, A.indigo];
  const Grid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: px(8) }}>
      {React.Children.map(children, (child, i) => (
        <View key={i} style={{ width: (CONTENT_W - px(8) * (listCols - 1)) / listCols }}>{child}</View>
      ))}
    </View>
  );

  // Yazı yüzü eşlemesi ortak (bkz. promoTheme → promoWeight).
  const wt = (w: PromoWeight) => promoWeight(isIOS, w);
  const W2 = wt('200'), W5 = wt('500'), W6 = wt('600'), W7 = wt('700');

  const CARD = { backgroundColor: M.card, borderRadius: RAD, borderWidth: 1, borderColor: M.border } as const;
  const LAB = { color: M.muted, ...W5, letterSpacing: 1.2, fontSize: T.cap };
  const row = { flexDirection: 'row' as const, alignItems: 'center' as const };
  /** Başlık çubuğundaki cam düğme kabuğu (bkz. ChromeShell). */
  const shell = { width: ITEM, height: ITEM, borderRadius: ITEM / 2, backgroundColor: M.chrome, borderWidth: 1, borderColor: M.border, alignItems: 'center' as const, justifyContent: 'center' as const };
  /*
    ── BAŞLIK DÜĞMESİ ──────────────────────────────────────────────────────────
    iOS 26'da araç çubuğu düğmeleri cam bir halkanın içinde durur; Material'ın araç
    çubuğu düğmeleri ÇIPLAK gliftir ve 24dp çizilir. Uygulamada ChromeShell zaten
    Android'de `null` dönüyor — mock da aynısını yapıyor.
  */
  const Shl: React.FC<{ Ic: Glyph }> = ({ Ic }) => (
    isIOS
      ? <View style={shell}><Ic size={px(20)} color={M.text} strokeWidth={2} /></View>
      : <View style={{ width: ITEM, height: ITEM, alignItems: 'center', justifyContent: 'center' }}>
          <Ic size={px(24)} color={M.text} strokeWidth={2} />
        </View>
  );
  /** Görev/mod satırındaki küçük bilgi çipi (saat, mod adı). */
  const Pill: React.FC<{ Ic: Glyph; label: string; color?: string; bg?: string }> = ({ Ic, label, color, bg }) => (
    <View style={[row, { gap: px(4), backgroundColor: bg ?? M.pill, borderRadius: px(8), paddingHorizontal: px(8), paddingVertical: px(3) }]}>
      <Ic size={px(12)} color={color ?? M.sub} />
      <Text style={{ color: color ?? M.sub, fontSize: T.cap, ...W6 }}>{label}</Text>
    </View>
  );

  /*
    ── DURUM ÇUBUĞU İŞLETİM SİSTEMİNİN, UYGULAMANIN DEĞİL ───────────────────────
    Buradaki hiçbir ölçü uygulamanın jetonlarından gelmiyor; iki sistemin kendi
    çizimi taklit ediliyor. Yazı yüzü de uygulamanınki DEĞİL: Android mock'unda
    Jakarta kullanmak yanlış olurdu, çünkü o satırı uygulama değil sistem çiziyor.

    iPhone — Dynamic Island'ın iki yanında birer "kulak" var: (393 − 125) / 2 = 134pt.
    Saat SOL kulağın, göstergeler SAĞ kulağın ortasına hizalanır ve ikisi de ADANIN
    DİKEY MERKEZİNDE durur. Önceki hâlde 59pt'lik bandın DİBİNE yaslanmışlardı: adanın
    altına düşüyor, çubuk iki katlı görünüyordu. Şikâyet edilen şey buydu.

    Pixel — ince, tek katlı bir şerit; saat solda 16dp'de, göstergeler sağda. Sıra da
    farklı: Android wifi'yi sinyalden ÖNCE koyar ve bataryayı DİK çizer.
  */
  const StatusRow = () => {
    // Sistem yüzü: burada `wt()` bilerek kullanılmıyor (bkz. yukarıdaki not).
    const sysFont = { fontWeight: '600' as const };

    if (device.island) {
      const EAR = (fw - px(125)) / 2;   // adanın iki yanındaki "kulak"
      const ISLAND_H = px(37);          // ada yüksekliği — hizanın dayandığı ölçü
      return (
        <View style={{ height: TOP_INSET, paddingTop: px(11), flexDirection: 'row' }}>
          <View style={{ width: EAR, height: ISLAND_H, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: M.text, fontSize: px(17), ...sysFont, letterSpacing: -0.2 }}>9:41</Text>
          </View>
          {/* Adanın kendisi çerçeve tarafından çiziliyor; burada yalnız yerini tutuyor. */}
          <View style={{ width: px(125) }} />
          <View style={[row, { width: EAR, height: ISLAND_H, justifyContent: 'center', gap: px(5) }]}>
            <SignalHigh size={px(15)} color={M.text} strokeWidth={2.6} />
            <Wifi size={px(15)} color={M.text} strokeWidth={2.6} />
            <BatteryFull size={px(24)} color={M.text} strokeWidth={1.8} />
          </View>
        </View>
      );
    }

    /*
      Adasız cihazlar (iPad, Pixel, Pixel Tablet): tek katlı ince şerit. Saat solda,
      göstergeler sağda. Platform yine ayrışıyor — iOS sinyali wifi'den önce koyar ve
      bataryayı YATAY çizer, Android tersi ve DİK.
    */
    return (
      <View style={[row, {
        height: TOP_INSET,
        justifyContent: 'space-between',
        /*
          YAN PAY YUVARLAK KÖŞEYİ HESABA KATAR. 16dp yazmak "Material'ın durum çubuğu
          payı 16dp" diye doğru görünüyordu ama Pixel'in köşe yarıçapı 34dp: o payla
          saat ve göstergeler eğrinin dibine giriyor, ekranın kenarına yapışmış gibi
          duruyor. Android'in kendisi de köşe yarıçapı kadar ek pay bırakır.
          iPad'in köşesi çok daha yumuşak ama durum çubuğu payı zaten geniştir.
        */
        paddingHorizontal: px(isIOS ? 30 : 26),
      }]}>
        <Text style={{ color: M.text, fontSize: px(isIOS ? 15 : 14), ...sysFont, letterSpacing: isIOS ? -0.2 : 0 }}>9:41</Text>
        <View style={[row, { gap: px(6) }]}>
          {isIOS ? (
            <>
              <SignalHigh size={px(15)} color={M.text} strokeWidth={2.6} />
              <Wifi size={px(15)} color={M.text} strokeWidth={2.6} />
              <BatteryFull size={px(24)} color={M.text} strokeWidth={1.8} />
            </>
          ) : (
            <>
              <Wifi size={px(14)} color={M.text} strokeWidth={2.4} />
              <SignalHigh size={px(14)} color={M.text} strokeWidth={2.4} />
              {/* Android'in batarya gliflerinde uç YUKARI bakar; lucide'ınki yana. */}
              <View style={{ transform: [{ rotate: '-90deg' }] }}>
                <BatteryFull size={px(16)} color={M.text} strokeWidth={2} />
              </View>
            </>
          )}
        </View>
      </View>
    );
  };

  /** 44pt başlık: iki yanda 32pt kabuk, ortada 17pt başlık (+ isteğe bağlı alt satır). */
  const TopBar: React.FC<{ title?: string; sub?: string; center?: React.ReactNode; left?: React.ReactNode; right?: React.ReactNode }> =
    ({ title, sub: subtitle, center, left, right }) => (
      <View style={[row, { height: BAR_H, paddingHorizontal: EDGE, width: '100%', maxWidth: COL, alignSelf: 'center' }]}>
        <View style={[row, { width: ITEM * 2.3, gap: px(8) }]}>{left}</View>
        <View style={{ flex: 1, alignItems: 'center' }}>
          {center ?? (
            <>
              {!!title && <Text numberOfLines={1} style={{ color: M.text, fontSize: T.sub, ...W6, letterSpacing: -0.3 }}>{title}</Text>}
              {/* Alt satır vurgu renginde — kokpitin tarih aralığı gerçekte de böyle. */}
              {!!subtitle && <Text style={{ color: PAL.primary, fontSize: T.cap, ...W6, letterSpacing: 0.6 }}>{subtitle}</Text>}
            </>
          )}
        </View>
        <View style={[row, { width: ITEM * 2.3, justifyContent: 'flex-end', gap: px(8) }]}>{right}</View>
      </View>
    );

  /*
    YÜZEN SEKME KAPSÜLÜ — gerçeğiyle aynı: kenarlardan 16pt içeride, tam yuvarlak (999),
    49pt, içeriğin ÜSTÜNDE ve alt güvenli alanın 8pt üzerinde. Aktif durumun TEK sinyali
    tint rengi; UIKit de böyle yapar (şekil gezdirmez, ikonu büyütmez). Çizgi kalınlığı
    2.1/1.8 — lucide çizgisel olduğu için "dolu varyant" yerine bir tık kalınlaşma.
  */
  const TAB_ICONS = [LayoutGrid, CheckSquare, Sparkles, CalendarDays, Layers];
  const TabBar: React.FC<{ active: number }> = ({ active }) => (
    <>
      {/* Kapsül de içerikle AYNI sütunda: geniş ekranda sekmeler sonsuza yayılmaz. */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: BOT_INSET + NAV_LIFT, paddingHorizontal: NAV_INSET, alignItems: 'center' }}>
      <View style={[row, {
        width: '100%', maxWidth: px(600), height: NAV_H,
        borderRadius: NAV_RADIUS,
        paddingHorizontal: px(6),
        // iOS: cam kapsül, tam çevre kenarı. Android: opak çubuk, yalnız üst ayraç —
        // yüzen bir kapsülde çizginin bağlanacağı kenar yok, dibe yapışıkta var.
        ...(isIOS
          ? { backgroundColor: M.chrome, borderWidth: 1, borderColor: M.border }
          : { backgroundColor: M.floating, borderTopWidth: 1, borderTopColor: M.border }),
      }]}>
        {TAB_ICONS.map((Ic, i) => (
          <View key={c.tabs[i]} style={{ flex: 1, alignItems: 'center', gap: px(2) }}>
            <Ic size={px(22)} color={i === active ? PAL.primary : M.sub} strokeWidth={i === active ? 2.1 : 1.8} />
            <Text numberOfLines={1} style={{ fontSize: px(10), ...W6, color: i === active ? PAL.primary : M.sub }}>
              {c.tabs[i]}
            </Text>
          </View>
        ))}
      </View>
      </View>
      {/* Sistemin kendi göstergesi — uygulamanın değil, cihazın parçası. Android'in
          jest şeridi daha kısa ve ince. */}
      <View style={{ position: 'absolute', alignSelf: 'center', bottom: px(isIOS ? 9 : 8), width: px(isIOS ? 140 : 108), height: px(isIOS ? 5 : 4), borderRadius: 999, backgroundColor: M.text, opacity: 0.3 }} />
    </>
  );

  /*
    FAB 54pt (FAB_SIZE) ve kapsülün ÜSTÜNDE duruyor. İkon ekrana göre değişiyor: ana
    sayfada Zap (hızlı taslak yakalama), Görevler'de Plus (yapılandırılmış ekleme).
    Aynı ekranda iki "+" olmasın diye ayrılmışlardı; mock da o ayrımı koruyor.
  */
  const Fab: React.FC<{ Ic: Glyph }> = ({ Ic }) => (
    <View style={{ position: 'absolute', right: EDGE, bottom: BOT_INSET + NAV_LIFT + NAV_H + px(16), width: px(54), height: px(54), borderRadius: px(27), backgroundColor: PAL.primary, alignItems: 'center', justifyContent: 'center' }}>
      <Ic size={px(24)} color={PAL.onPrimary} strokeWidth={2.5} fill={Ic === Zap ? PAL.onPrimary : 'transparent'} />
    </View>
  );

  const Shell: React.FC<{
    active: number; title?: string; sub?: string; center?: React.ReactNode;
    left?: React.ReactNode; right?: React.ReactNode; fab?: Glyph; children: React.ReactNode;
  }> = ({ active, title, sub: subtitle, center, left, right, fab, children }) => (
    <View style={{ flex: 1, backgroundColor: M.screen }}>
      <StatusRow />
      <TopBar title={title} sub={subtitle} center={center} left={left} right={right} />
      <View style={{ flex: 1, width: '100%', maxWidth: COL, alignSelf: 'center', paddingHorizontal: EDGE, paddingTop: px(20), gap: GAP }}>{children}</View>
      <View style={{ height: BOT_INSET + NAV_LIFT + NAV_H }} />
      <TabBar active={active} />
      {fab && <Fab Ic={fab} />}
    </View>
  );

  /** Ana sayfanın sol üstü: 32pt avatar, hairline halka (bkz. index.tsx notu). */
  const Avatar = () => (
    <View style={{ width: ITEM, height: ITEM, borderRadius: ITEM / 2, backgroundColor: PAL.primary + '22', borderWidth: 1, borderColor: M.border, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: PAL.primary, fontSize: T.body, ...W7 }}>{c.name.slice(0, 1)}</Text>
    </View>
  );

  if (kind === 'focus' || kind === 'deepfocus') {
    // Ekranın kendisi ayrı dosyada — ötekilerle hiçbir parçayı paylaşmıyor.
    return <PromoFocusMock px={px} ring={fw * 0.62} topInset={TOP_INSET} bottomInset={BOT_INSET} copy={c} isIOS={isIOS} />;
  }

  /*
    DÖNEM KARTI — ana sayfanın ve Modlar ekranının ortak yüzeyi (bkz. ModeTodayCard).
    İkon kabı dolu renkli kutu DEĞİL: `renk + '22'` zemin ve AYNI rengin glifi. Sağda
    geri sayım rozeti, altta durum satırı + ilerleme çubuğu.
  */
  const ModeCard: React.FC<{ Ic: Glyph; name: string; eyebrow: string; color: string; days: string; done: number; total: number }> =
    ({ Ic, name, eyebrow, color, days, done, total }) => (
      <View style={[CARD, { padding: px(16), gap: px(12) }]}>
        <View style={[row, { gap: px(12) }]}>
          <View style={{ width: px(40), height: px(40), borderRadius: RAD, backgroundColor: color + '22', alignItems: 'center', justifyContent: 'center' }}>
            <Ic size={px(20)} color={color} strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ color, fontSize: T.cap, ...W7, letterSpacing: 0.4 }}>{eyebrow}</Text>
            <Text numberOfLines={1} style={{ color: M.text, fontSize: T.sub, ...W7, letterSpacing: -0.3 }}>{name}</Text>
          </View>
          <Pill Ic={CalendarClock} label={`${days} ${c.daysLeft}`} color={color} bg={color + '18'} />
          <ChevronRight size={px(16)} color={M.sub} />
        </View>
        <View style={{ gap: px(6) }}>
          <Text style={{ color: M.sub, fontSize: T.c2, ...W6 }}>{done}/{total} {c.planTasks}</Text>
          <View style={{ height: px(6), borderRadius: px(4), backgroundColor: M.track, overflow: 'hidden' }}>
            <View style={{ width: `${Math.round((done / total) * 100)}%`, height: '100%', borderRadius: px(4), backgroundColor: color }} />
          </View>
        </View>
      </View>
    );

  if (kind === 'modes') {
    // Modlar ekranı: sol BarChart3 (Modların Özeti), sağ Info (turu yeniden aç).
    return (
      <Shell active={4} title={c.modesTitle} left={<Shl Ic={BarChart3} />} right={<Shl Ic={Info} />}>
        <Cols
          left={<>
            <ModeCard Ic={GraduationCap} name={c.examName} eyebrow={c.examEyebrow} color={A.teal} days="86" done={2} total={4} />
            <ModeCard Ic={Dumbbell} name={c.fitName} eyebrow={c.fitEyebrow} color={A.orange} days="34" done={1} total={2} />
            {tablet && <ModeCard Ic={Ban} name={c.quitName} eyebrow={c.quitEyebrow} color={A.emerald} days="41" done={1} total={1} />}
            {tablet && <ModeCard Ic={Moon} name={c.ramadanName} eyebrow={c.ramadanEyebrow} color={A.indigo} days="27" done={2} total={2} />}
          </>}
          right={<>
            <ModeCard Ic={Coins} name={c.saveName} eyebrow={c.saveEyebrow} color={A.amber} days="63" done={1} total={1} />
            <ModeCard Ic={BookOpen} name={c.thesisName} eyebrow={c.thesisEyebrow} color={A.indigo} days="112" done={1} total={3} />
            {tablet && <ModeCard Ic={Briefcase} name={c.interviewName} eyebrow={c.interviewEyebrow} color={A.violet} days="19" done={2} total={3} />}
            {tablet && <ModeCard Ic={Library} name={c.readingName} eyebrow={c.readingEyebrow} color={A.teal} days="55" done={1} total={2} />}
          </>}
        />
      </Shell>
    );
  }

  if (kind === 'tasks') {
    return (
      <Shell
        active={1}
        fab={Plus}
        title={c.tasksTitle}
        left={<Shl Ic={SlidersHorizontal} />}
        right={<><Shl Ic={CalendarDays} /><Shl Ic={Search} /></>}
      >
        {/* Filtre çipleri — seçili olan dolu, ötekiler kart yüzeyi. */}
        <View style={[row, { gap: px(8) }]}>
          {c.filters.map((f, i) => (
            <View key={f} style={{ paddingHorizontal: px(14), paddingVertical: px(7), borderRadius: 999, backgroundColor: i === 0 ? PAL.primary : M.card, borderWidth: 1, borderColor: i === 0 ? PAL.primary : M.border }}>
              <Text style={{ color: i === 0 ? PAL.onPrimary : M.sub, fontSize: T.c2, ...W6 }}>{f}</Text>
            </View>
          ))}
        </View>

        {/*
          HER GÖREV AYRI BİR KART (R.lg, 16pt iç pay, 8pt aralık) ve solunda 4pt'lik
          öncelik şeridi var — gerçek listede de böyle, tek bir kutunun içine dizilmiş
          satırlar değil.
        */}
        <Grid>
          {take(c.taskRows, 5).map((t2, i) => {
            // Öncelik şeridi: liste uzadıkça dizi yetmez, palet döner.
            const PRI = [PAL.error, A.orange, PAL.primary, A.teal, M.track];
            const pri = PRI[i % PRI.length];
            const meta = !!t2.time || !!t2.mode;
            return (
              <View key={t2.title} style={[row, { backgroundColor: M.card, borderRadius: RAD_L, borderWidth: 1, borderColor: t2.mode ? A.teal + '40' : M.border, padding: px(16), gap: px(10) }]}>
                <View style={{ width: px(4), alignSelf: 'stretch', minHeight: px(32), borderRadius: px(8), backgroundColor: pri, opacity: t2.done ? 0.3 : 1 }} />
                <View style={{ flex: 1, gap: meta ? px(6) : 0 }}>
                  <Text numberOfLines={1} style={{ color: M.text, fontSize: T.body, ...W6, opacity: t2.done ? 0.4 : 1, textDecorationLine: t2.done ? 'line-through' : 'none' }}>{t2.title}</Text>
                  {meta && (
                    <View style={[row, { gap: px(6), opacity: t2.done ? 0.4 : 1 }]}>
                      {!!t2.mode && <Pill Ic={Sparkles} label={t2.mode} color={A.teal} bg={A.teal + '1A'} />}
                      {!!t2.time && <Pill Ic={Clock} label={t2.time} />}
                    </View>
                  )}
                </View>
                <View style={{ width: px(28), height: px(28), borderRadius: px(12), alignItems: 'center', justifyContent: 'center', backgroundColor: t2.done ? PAL.success : M.pill }}>
                  <Check size={px(15)} color={t2.done ? PAL.onPrimary : M.muted} strokeWidth={3} />
                </View>
              </View>
            );
          })}
        </Grid>

        {/* Ekranın vaadi: doğal dille yazınca tarih/saat/öncelik kendiliğinden çıkıyor. */}
        <View style={[CARD, row, { padding: px(14), gap: px(12) }]}>
          <View style={{ width: px(32), height: px(32), borderRadius: px(10), backgroundColor: A.teal + '22', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={px(16)} color={A.teal} strokeWidth={2} />
          </View>
          <Text numberOfLines={2} style={{ flex: 1, color: M.sub, fontSize: T.c2, ...W6, lineHeight: T.c2 * 1.4 }}>{c.nlpHint}</Text>
        </View>
      </Shell>
    );
  }

  /** Haftalık odak sütunları — hem içgörü sayfasında hem kokpitte aynı grafik. */
  const FocusChart: React.FC<{ color: string }> = ({ color }) => {
    const bars = [0.45, 0.7, 0.55, 0.85, 1, 0.35, 0.6];
    return (
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: px(8), height: px(84) }}>
        {bars.map((v, i) => (
          <View key={c.dayShort[i]} style={{ flex: 1, alignItems: 'center', gap: px(6) }}>
            <View style={{ width: '100%', height: px(64) * v, backgroundColor: i === 4 ? color : color + '4D', borderRadius: px(5) }} />
            <Text style={{ color: M.muted, fontSize: T.cap, ...W6 }}>{c.dayInitial[i]}</Text>
          </View>
        ))}
      </View>
    );
  };

  if (kind === 'momentum') {
    /*
      İVME bir EKRAN değil, ana sayfanın sağ üstündeki durum düğmesinden açılan TAZQ
      INSIGHTS sayfası (bkz. StatusHubModal). Mock da onu böyle gösteriyor: arkada ana
      sayfa, üstünde karartma, altta yükselen sayfa. Bu bilgiye nasıl ulaşıldığı da
      görselin bir parçası — tek başına duran bir grafik "nerede bu?" sorusunu bırakırdı.
    */
    const ring = px(72);
    return (
      <View style={{ flex: 1, backgroundColor: M.screen }}>
        <StatusRow />
        <TopBar
          left={<Avatar />}
          center={<TazqLogo height={px(22)} variant={deepMode === 'dark' ? 'white' : 'dark'} />}
          right={<View style={[shell, { borderColor: PAL.primary + '55' }]}><Gauge size={px(20)} color={PAL.primary} strokeWidth={2} /></View>}
        />
        <View style={{ width: '100%', maxWidth: COL, alignSelf: 'center', paddingHorizontal: EDGE, paddingTop: px(20), gap: GAP }}>
          <View>
            <Text style={{ color: M.sub, fontSize: T.call, ...W6 }}>{c.greeting}</Text>
            <Text style={{ color: M.text, fontSize: T.disp, ...W6, letterSpacing: -0.8 }}>{c.name}</Text>
          </View>
          <ModeCard Ic={GraduationCap} name={c.examName} eyebrow={c.planEyebrow} color={A.teal} days="86" done={2} total={4} />
        </View>

        {/* Karartma: sayfa açıkken arkadaki ekran geri çekiliyor. */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' }} />

        {/*
          Sayfa TAM GENİŞLİK (yükselen bir yüzey öyledir) ama içeriği okunur bir sütunda
          kalıyor — uygulamada da böyle (bkz. StatusHubModal contentContainerStyle).
        */}
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: tablet ? '34%' : '26%', backgroundColor: M.sheet, borderTopLeftRadius: px(22), borderTopRightRadius: px(22), borderWidth: 1, borderColor: M.border, paddingHorizontal: px(20), paddingTop: px(10), alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: px(600) }}>
          <View style={{ alignSelf: 'center', width: px(40), height: px(5), borderRadius: 999, backgroundColor: M.track }} />

          <View style={{ alignItems: 'center', marginTop: px(14), marginBottom: GAP }}>
            <Text style={{ color: M.sub, fontSize: T.foot, ...W7, letterSpacing: 1.4 }}>{c.insights}</Text>
            <Text numberOfLines={1} style={{ color: M.muted, fontSize: T.cap, ...W6, marginTop: px(3) }}>{c.insightsSub}</Text>
          </View>

          {/* Kahraman: odak skoru halkası + değerlendirme (gerçekte de gradyanlı kart). */}
          <View style={{ borderRadius: px(22), overflow: 'hidden', borderWidth: 1, borderColor: M.border }}>
            <LinearGradient
              colors={deepMode === 'dark'
                ? ['rgba(59,130,246,0.15)', 'rgba(147,51,234,0.10)']
                : ['rgba(59,130,246,0.05)', 'rgba(147,51,234,0.03)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={[row, { padding: px(16), gap: px(16) }]}
            >
              <View style={{ width: ring, height: ring, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ position: 'absolute', width: ring, height: ring, borderRadius: ring / 2, borderWidth: px(6), borderColor: PAL.success + '26' }} />
                <View style={{ position: 'absolute', width: ring, height: ring, borderRadius: ring / 2, borderWidth: px(6), borderColor: 'transparent', borderTopColor: PAL.success, borderRightColor: PAL.success, borderBottomColor: PAL.success, transform: [{ rotate: '-45deg' }] }} />
                <Text style={{ color: M.text, fontSize: T.call, ...W7 }}>%84</Text>
              </View>
              <View style={{ flex: 1, gap: px(6) }}>
                <Text style={{ color: M.muted, fontSize: T.cap, ...W7, letterSpacing: 0.8 }}>{c.focusScore}</Text>
                <Text numberOfLines={3} style={{ color: M.text, fontSize: T.c2, ...W6, lineHeight: T.c2 * 1.4 }}>{c.focusEval}</Text>
              </View>
            </LinearGradient>
          </View>

          {/* Koç kartı: italik tek cümle — uygulamadaki hâliyle aynı. */}
          <View style={{ marginTop: GAP, borderRadius: px(16), borderWidth: 1, borderColor: M.border, padding: px(16), gap: px(10) }}>
            <View style={[row, { gap: px(8) }]}>
              <View style={{ width: px(6), height: px(6), borderRadius: 999, backgroundColor: PAL.success }} />
              <Text style={{ color: PAL.primary, fontSize: T.cap, ...W7, letterSpacing: 0.8 }}>{c.coachLabel}</Text>
            </View>
            <Text numberOfLines={3} style={{ color: M.text, fontSize: T.foot, ...W5, fontStyle: 'italic', lineHeight: T.foot * 1.45 }}>“{c.coachTip}”</Text>
          </View>

          <View style={{ marginTop: GAP, gap: px(10) }}>
            <Text style={LAB}>{c.weeklyFocus}</Text>
            <FocusChart color={PAL.primary} />
          </View>

          {/* İki metrik kutusu — ivme ve günün hedefi. */}
          <View style={[row, { marginTop: GAP, gap: px(12) }]}>
            <View style={{ flex: 1, borderRadius: RAD, backgroundColor: M.cardLow, padding: px(14), gap: px(6) }}>
              <Zap size={px(16)} color={PAL.success} fill={PAL.success} />
              <Text style={{ color: M.text, fontSize: T.t3, ...W6, letterSpacing: -0.5 }}>%84</Text>
              <Text style={{ color: M.muted, fontSize: T.cap, ...W6 }}>{c.momentum}</Text>
            </View>
            <View style={{ flex: 1, borderRadius: RAD, backgroundColor: M.cardLow, padding: px(14), gap: px(6) }}>
              <Target size={px(16)} color={PAL.secondary} />
              <Text style={{ color: M.text, fontSize: T.t3, ...W6, letterSpacing: -0.5 }}>4/5</Text>
              <Text style={{ color: M.muted, fontSize: T.cap, ...W6 }}>{c.goalLabel}</Text>
            </View>
          </View>
        </View>
        </View>
      </View>
    );
  }

  if (kind === 'cockpit') {
    const stats: [string, string, Glyph][] = [
      [c.statFocus, '45', Sparkles],
      [c.statTasks, '4/6', CheckSquare],
      [c.statHabits, '%80', Flame],
    ];
    return (
      <Shell active={3} title={c.weeklyTitle} sub={c.weeklyRange} left={<Shl Ic={BarChart3} />} right={<Shl Ic={Plus} />}>
        {/* Hafta şeridi — bugünün dolu kapsülü, ötekiler kart yüzeyi. */}
        <View style={[row, { gap: px(6) }]}>
          {c.dayShort.map((d2, i) => (
            <View key={d2} style={{ flex: 1, alignItems: 'center', gap: px(4), paddingVertical: px(9), borderRadius: RAD, backgroundColor: i === 4 ? PAL.primary : M.card, borderWidth: 1, borderColor: i === 4 ? PAL.primary : M.border }}>
              <Text style={{ color: i === 4 ? PAL.onPrimary : M.muted, fontSize: px(10), ...W6 }}>{d2.slice(0, 1)}</Text>
              <Text style={{ color: i === 4 ? PAL.onPrimary : M.text, fontSize: T.c2, ...W7 }}>{12 + i}</Text>
            </View>
          ))}
        </View>

        {/* Hafta şeridi bölünmenin ÜSTÜNDE: yedi gün yarım sütuna sığmaz. */}
        <Cols
          left={<>
        <View style={[row, { gap: px(12) }]}>
          {stats.map(([l, v, Ic]) => (
            <View key={l} style={[CARD, { flex: 1, padding: px(14), gap: px(6) }]}>
              <Ic size={px(16)} color={A.amber} strokeWidth={2} />
              <Text style={{ color: M.text, fontSize: T.t3, ...W6, letterSpacing: -0.4 }}>{v}</Text>
              <Text numberOfLines={1} style={{ color: M.muted, fontSize: T.cap, ...W6 }}>{l}</Text>
            </View>
          ))}
        </View>

        <View style={[CARD, { padding: px(16), gap: px(12) }]}>
          <View style={[row, { justifyContent: 'space-between' }]}>
            <Text style={LAB}>{c.weeklyFocus}</Text>
            <View style={[row, { gap: px(5) }]}>
              <Trophy size={px(14)} color={A.amber} />
              <Text style={{ color: A.amber, fontSize: T.cap, ...W7 }}>{c.peakWeek} · +18%</Text>
            </View>
          </View>
          <FocusChart color={A.amber} />
        </View>
          </>}
          right={<>
        {/* Alışkanlık şeridi — geniş ekranda SAĞ sütun: süreklilik. */}
        <View style={[CARD, { padding: px(16), gap: px(12) }]}>
          <Text style={LAB}>{c.habitsLabel}</Text>
          {take(c.habits, 3).map((h, i) => (
            <View key={h} style={[row, { gap: px(10) }]}>
              <View style={{ width: px(28), height: px(28), borderRadius: px(9), backgroundColor: HABIT_COLORS[i % HABIT_COLORS.length] + '22', alignItems: 'center', justifyContent: 'center' }}>
                <Flame size={px(14)} color={HABIT_COLORS[i % HABIT_COLORS.length]} />
              </View>
              <Text numberOfLines={1} style={{ flex: 1, color: M.text, fontSize: T.body, ...W6 }}>{h}</Text>
              <View style={[row, { gap: px(4) }]}>
                {[1, 1, 1, 0, 1, 1, i === 0 ? 1 : 0].map((on, k) => (
                  <View key={k} style={{ width: px(7), height: px(7), borderRadius: 999, backgroundColor: on ? PAL.success : M.track }} />
                ))}
              </View>
            </View>
          ))}
        </View>
          </>}
        />
      </Shell>
    );
  }

  /*
    ── ANA SAYFA ─────────────────────────────────────────────────────────────────
    Sıra uygulamadakiyle aynı ve o sıra bir KARARDI: selamlama → dönemin bugünü →
    bugünün durumu → günün işleri. İvme skoru bilerek yok: bir eylem değil, bir sonuç
    ve sağ üstteki durum düğmesinin arkasında duruyor.
  */
  const ringT = px(90);   // TodayCard'ın gerçek halka çapı (RING = 90)
  return (
    <Shell
      active={0}
      fab={Zap}
      left={<Avatar />}
      center={<TazqLogo height={px(22)} variant={deepMode === 'dark' ? 'white' : 'dark'} />}
      right={<Shl Ic={Gauge} />}
    >
      <View>
        <Text style={{ color: M.sub, fontSize: T.call, ...W6 }}>{c.greeting}</Text>
        <Text style={{ color: M.text, fontSize: T.disp, ...W6, letterSpacing: -0.8 }}>{c.name}</Text>
      </View>

      {/*
        Selamlama SAYFA BAŞLIĞI olduğu için bölünmenin dışında. Altında solda
        kullanıcının BAKTIĞI şey (plan, bugünün durumu), sağda YAPACAĞI şey (günün
        listesi) — uygulamadaki ayrımın aynısı (bkz. WideSplit).
      */}
      <Cols
        left={<>
      <ModeCard Ic={GraduationCap} name={c.examName} eyebrow={c.planEyebrow} color={A.teal} days="86" done={2} total={4} />

      {/* "Bugün" kartı: solda sayısal özet, sağda 90pt ilerleme halkası. */}
      <View style={[CARD, row, { padding: px(20), gap: px(20) }]}>
        <View style={{ flex: 1, gap: px(8) }}>
          <Text style={LAB}>{c.todayLabel}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: px(4) }}>
            <Text style={{ color: M.text, fontSize: T.metric, ...W6, letterSpacing: -1.6 }}>3</Text>
            <Text style={{ color: M.muted, fontSize: T.sub, ...W6 }}>/5</Text>
          </View>
          <Text style={{ color: M.muted, fontSize: T.cap, ...W6 }}>{c.tasksDone}</Text>
          <View style={[row, { gap: px(5) }]}>
            <Zap size={px(12)} color={PAL.primary} fill={PAL.primary} />
            <View style={{ flex: 1, height: px(3), borderRadius: px(4), backgroundColor: M.track, overflow: 'hidden' }}>
              <View style={{ width: '75%', height: '100%', borderRadius: px(4), backgroundColor: PAL.primary }} />
            </View>
            <Text style={{ color: M.muted, fontSize: T.cap, ...W6 }}>45/60</Text>
          </View>
        </View>

        <View style={{ width: ringT, height: ringT, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ position: 'absolute', width: ringT, height: ringT, borderRadius: ringT / 2, borderWidth: px(13), borderColor: PAL.primary + '26' }} />
          <View style={{ position: 'absolute', width: ringT, height: ringT, borderRadius: ringT / 2, borderWidth: px(13), borderColor: 'transparent', borderTopColor: PAL.primary, borderRightColor: PAL.primary, transform: [{ rotate: '36deg' }] }} />
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text style={{ color: M.text, fontSize: T.t3, ...W6, letterSpacing: -0.6 }}>60</Text>
            <Text style={{ color: M.muted, fontSize: T.cap, ...W6 }}>%</Text>
          </View>
        </View>
      </View>

      {/*
        İVME SATIRI ve SIRADAKİ KARTI — uygulamanın gerçek yüzeyleri.
        Telefonda ikisi de katlamanın altında kalıyor (kullanıcı kaydırınca görüyor);
        tablette sütun daha uzun olduğu için görünür hâle geliyorlar. Mock ikisini de
        yalnız geniş ekranda çiziyor: dar çerçevede yarısı kesilmiş bir kart göstermek,
        mağaza görselinde özensizlik olur.
      */}
      {tablet && (
        <View style={[CARD, row, { padding: px(16), gap: px(12) }]}>
          <View style={{ width: px(36), height: px(36), borderRadius: px(12), backgroundColor: PAL.success + '22', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={px(18)} color={PAL.success} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: M.sub, fontSize: T.cap, ...W6 }}>{c.momentumLabel}</Text>
            <Text style={{ color: M.text, fontSize: T.sub, ...W7, letterSpacing: -0.3 }}>84</Text>
          </View>
          <Text style={{ color: PAL.success, fontSize: T.c2, ...W6 }}>{c.momentumDelta}</Text>
        </View>
      )}

      {tablet && (
        <View style={[CARD, { padding: px(16), gap: px(12) }]}>
          <Text style={LAB}>{c.nextLabel}</Text>
          <Text numberOfLines={1} style={{ color: M.text, fontSize: T.call, ...W6, letterSpacing: -0.3 }}>{c.nextTask}</Text>
          <View style={[row, { gap: px(6), alignSelf: 'flex-start', backgroundColor: PAL.primary, borderRadius: 999, paddingHorizontal: px(14), paddingVertical: px(8) }]}>
            <Play size={px(13)} color={PAL.onPrimary} fill={PAL.onPrimary} />
            <Text style={{ color: PAL.onPrimary, fontSize: T.c2, ...W7 }}>{c.nextAction}</Text>
          </View>
        </View>
      )}
        </>}
        right={
      /* Günüm: bugünün işleri tek kartta. */
      <View style={[CARD, { paddingHorizontal: px(20), paddingVertical: px(6) }]}>
        <Text style={[LAB, { marginTop: px(12), marginBottom: px(4) }]}>{c.myDay}</Text>
        {take(c.homeRows, 3).map((title, i) => {
          const done = i === 1;
          return (
            <View key={title} style={[row, { gap: px(12), paddingVertical: px(12), borderTopWidth: i > 0 ? 1 : 0, borderTopColor: M.border }]}>
              {done ? <CheckCircle2 size={px(22)} color={PAL.success} /> : <Circle size={px(22)} color={M.muted} />}
              <Text numberOfLines={1} style={{ flex: 1, color: done ? M.muted : M.text, fontSize: T.body, ...W6, textDecorationLine: done ? 'line-through' : 'none' }}>{title}</Text>
              {i === 0 && <Flame size={px(15)} color={A.orange} />}
            </View>
          );
        })}
      </View>
        }
      />
    </Shell>
  );
};
