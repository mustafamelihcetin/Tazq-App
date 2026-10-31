import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { MotiView } from 'moti';
import { Easing } from 'react-native-reanimated';
import { TrendingUp, TrendingDown, Minus, CheckCircle2, Zap, Flame, Shield, Info } from 'lucide-react-native';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { ICON, S, F, R, B, METRIC, LH, trackingFor } from '@/shared/constants/tokens';
import { modeAccentOn } from '@/shared/constants/Colors';
import { Touchable } from '@/shared/components/Touchable';
import { GlassSurface } from '@/shared/components/GlassSurface';
import { useMomentumStore } from '@/features/user/store/useMomentumStore';
import { swallow } from '@/shared/utils/swallow';
import { Separator } from '@/shared/components/Separator';
import { BentoCard } from '@/shared/components/BentoCard';
import { AnimatedNumber } from '@/shared/components/AnimatedNumber';
import { MomentumOrb } from '@/features/user/components/MomentumOrb';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';
import { useEntranceReady, useFirstInSession } from '@/shared/components/EntranceStage';
import { DISPLAY_FONT } from '@/shared/components/DisplayPanel';
import { useSettledValue, useHasSettled } from '@/shared/hooks/useSettledValue';
import { haptic } from '@/shared/utils/haptics';
import { isBestDayOfWeek } from '@/shared/utils/momentum';

interface DayScore { date: string; score: number }

interface Props {
  score: number;
  history: DayScore[];
  language: string;
  /**
   * Skorun girdileri henüz gelmedi (ana sayfa: haftalık istatistik + görevler). Görevler gelmeden
   * skor EKSİK veriyle hesaplanır — açılışta cihazda "0" görüldü. İskelet yalnız ilk yüklemede.
   */
  loading?: boolean;
  /**
   * Başka bir kartın İÇİNDE çizilir (ana sayfa "Bugün" özeti): kendi kartı ve dış
   * boşluğu yok. Isı şeridi, bilgi penceresi ve trend aynen kalır.
   */
  embedded?: boolean;
  /** Uyanış sinyali: artınca küre bir nefes alır, çubuklar sırayla yeniden yükselir (bkz. TodayRings). */
  wake?: number;
}

/** Gömülüyken düz kap, değilken kendi kartı — modül düzeyinde ki her render'da yeniden kurulmasın. */
const CardBox = ({ embedded, children }: { embedded?: boolean; children: React.ReactNode }) =>
  embedded
    ? <View style={{ overflow: 'hidden' }}>{children}</View>
    : <BentoCard index={0} style={{ padding: S.md, overflow: 'hidden' }}>{children}</BentoCard>;

/** İlk gün (tek veri noktası) grafiğin yerine geçen cümle — iki dil yan yana (i18nRatchet). */
/*
  Giriş eğrisi: sekmeden yerine oturan ease-out (better-ui: "bounce 0"). Eskiden yaylar
  (damping 16-18) hedefi aşıp geri dönüyordu — sayı ve çubuk bir an YANLIŞ değeri gösteriyordu.
*/
const ENTER = { type: 'timing' as const, duration: 300, easing: Easing.out(Easing.cubic) };

/**
 * İLK YÜKLEME İSKELETİ — gerçek içerikle AYNI ölçüler (küre, sayı + etiket, 7 çubuk + alt
 * yazı): veri gelince hiçbir şey yer değiştirmez. Durağan; sonsuz parıltı yok (hareket durur).
 */
const MomentumSkeleton = ({ embedded, tone }: { embedded?: boolean; tone: string }) => {
  const orb = embedded ? 28 : 40;
  const num = embedded ? F.title : METRIC.sm;
  return (
    <View testID="momentum-skeleton" accessible={false} style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
      <View style={{ width: orb, height: orb, borderRadius: R.full, backgroundColor: tone }} />
      <View style={{ gap: S.xs }}>
        <View style={{ width: num * 1.6, height: num * LH.tight * 0.8, borderRadius: R.xs, backgroundColor: tone }} />
        <View style={{ width: 64, height: F.caption, borderRadius: R.xs, backgroundColor: tone }} />
      </View>
      <View style={{ flex: 1, gap: S.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: S.xs, height: 24 }}>
          {[10, 14, 9, 16, 12, 18, 15].map((h, i) => <View key={i} style={{ flex: 1, height: h, borderRadius: R.xs, backgroundColor: tone }} />)}
        </View>
        <View style={{ width: 56, height: F.caption, borderRadius: R.xs, backgroundColor: tone }} />
      </View>
    </View>
  );
};

const FIRST_DAY = {
  tr: 'Gidişatın yarından itibaren burada çizilecek.',
  en: 'Your trend starts drawing here tomorrow.',
} as const;

export const MomentumPulse: React.FC<Props> = ({ score, history, language, loading, embedded, wake = 0 }) => {
  const reduceMotion = useReduceMotion();
  // Açılış animasyonları (sayım, çubuklar, giriş) açılış katmanı KALKINCA oynar — altında boşa gitmesin.
  const ready = useEntranceReady();
  // Skor durulmadan sayı GÖSTERİLMEZ: hidrasyondaki geçici 0 ekranda gerçek skor gibi durmasın.
  const scoreSettled = useHasSettled(score, 400);
  // Sayım ve giriş yalnız oturumdaki İLK gösterimde; sekmeden dönüşte değer (oturum verisiyle) anında.
  const first = useFirstInSession('home.momentum');
  const scoreShown = !first || (ready && scoreSettled);
  const { theme, colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';
  const [infoVisible, setInfoVisible] = useState(false);
  const { 
    momentumShieldActive, 
    toggleMomentumShield, 
    shieldCharges, 
    focusMinutesForNextCharge, 
    tasksCompletedForNextCharge,
  } = useMomentumStore();


  // Skor birden çok store'dan (görev, odak, seri, alışkanlık) beslendiği için ilk açılışta
  // her biri hidrate oldukça yeniden hesaplanıyor. Durulmasını bekleyip TEK bir hedef
  // değere sayıyoruz; ara değerler ekrana hiç çıkmıyor.
  const targetScore = useSettledValue(score, 400);

  /*
    ── SADE MOD KARARI BURADA DEĞİL ─────────────────────────────────────────────
    Bu bileşen üç ayrı yerde `usePrefsStore.getState().uiMode` okuyup Sade moda göre
    dallanıyordu. Üçü de KALDIRILDI, iki sebeple:

     1. ULAŞILAMIYORDU. Sade modda bu kart zaten hiç çizilmiyor — karar üst bileşende
        (bkz. app/index.tsx → `momentumRow = !isLite ? ... : null` ve
        __tests__/liteMode.test.ts "ivme skoru Sade modda çizilmez"). Nitekim o testin
        başındaki not, buradaki kontrolün YETERSİZ kaldığını anlatıyor: yalnız sayma
        animasyonunu kapatıyordu, kart ekranda duruyordu. Doğru çözüm üstte bulundu;
        buradaki kalıntı geride kalmış.
     2. ÇALIŞMAZDI. Okuma `require` + `getState()` ile yapılıyordu, yani REAKTİF değil:
        kullanıcı modu değiştirse bileşen yeniden çizilmiyor, eski değerde kalıyordu.

    Ulaşılamayan ve çalışmayan bir koruma, korumadan kötüdür: okuyan kişi burada bir
    güvence olduğunu sanır.
  */
  // Renk hedef değerden türetilir: sayım eşikleri geçerken renk gri→turuncu→yeşil
  // diye titremesin, en baştan varacağı rengi alsın.
  const accentColor = targetScore >= 75 ? theme.tertiary : targetScore >= 40 ? theme.streak : theme.onSurfaceVariant;

  // Week-over-week delta: yesterday vs 7 days ago
  const isEight = history.length >= 8;
  const yesterday = isEight ? (history[6]?.score ?? -1) : (history[5]?.score ?? -1);
  const weekAgo   = history[0]?.score ?? -1;
  const delta = (yesterday >= 0 && weekAgo >= 0) ? yesterday - weekAgo : null;

  const tr = language === 'tr';

  /*
    YER TUTUCU YALNIZ İLK YÜKLEMEDE. `useWeeklyStats` ekrana her dönüşte loading=true yapıyor;
    kart her seferinde boş kutuya dönüp yeniden mount ediliyordu (zıplama, 0'dan sayma, küre
    baştan nefes). Bir kez çizildikten sonra eldeki veri ekranda kalır, yenisi gelince yerinde
    güncellenir. Bayrak tek yönlü (yalnız true olur), render'da yazmak güvenli.
  */
  const shownOnce = useRef(false);
  if (!loading) shownOnce.current = true;
  if (loading && !shownOnce.current) {
    const skeleton = <MomentumSkeleton embedded={embedded} tone={theme.onSurface + '0F'} />;
    return embedded ? skeleton : <View style={{ paddingHorizontal: S.lg, marginBottom: S.lg }}><CardBox>{skeleton}</CardBox></View>;
  }

  /**
   * Kaç günün gerçek verisi var — grafiğin NE söylediğini bu belirliyor.
   *
   * Veri olmayan günler 3px'lik soluk çubuklara düşüyor. Yedi tanesi yan yana gelince
   * grafik düz bir çizgi gibi okunuyor, yani "hiç ilerlemen yok" diyor — halbuki
   * söylemek istediği "henüz ölçecek kadar gün geçmedi". İkisi çok farklı cümleler.
   *
   * Blok bir ara tamamen gizlenmişti; yanlıştı — çalışan bir özelliği kullanıcıdan
   * saklamak, kötü görünen bir durumu düzeltmek değil. Bunun yerine grafik, veri
   * yetersizken NE OLDUĞUNU söylüyor (bkz. aşağıdaki altyazı).
   */
  const daysWithData = history.filter((d) => d.score >= 0).length;
  const buildingUp = daysWithData < 3;

  const displayHistory = isEight ? history.slice(1) : history;

  /**
   * BUGÜN HAFTANIN EN İYİ GÜNÜ MÜ — grafikteki tek canlı öğenin kapısı.
   *
   * Momentum kutusu açılış animasyonundan sonra tamamen donuyordu: sayı sayılıyor,
   * çubuklar yükseliyor, sonra ekran ölü bir resme dönüşüyordu.
   *
   * Buraya süs eklemek kolaydı; doğrusu değildi. Bu kod tabanında hareketin kuralı belli
   * (bkz. StatusHub nabzı): HAREKET BİLGİ TAŞIR. O yüzden "bugün hâlâ yükseltilebilir"
   * gibi neredeyse her zaman doğru olan bir koşul seçilmedi — sürekli yanan bir ışık
   * bilgi değil gürültüdür, birkaç gün sonra göz onu görmez bile.
   *
   * Seçilen koşul NADİR ve ÖDÜL: bugünkü skor son yedi günün en iyisiyse. Parıltı
   * "şu an haftanın en iyi günündesin" der. Kullanıcı bunu bir kez gördüğünde ne
   * anlama geldiğini anlar ve tekrar görmek ister — bağlayan şey animasyonun kendisi
   * değil, kazanılıyor olması.
   *
   * Karar SAF FONKSİYONDA (utils/momentum.ts): eşitlik, sıfır skor ve veri yokluğu gibi
   * kenar durumlar grafiğe bakarak fark edilmez, teste bakarak edilir.
   */
  const isBestDay = isBestDayOfWeek(displayHistory.map((d) => d.score));

  return (
    <>
    {/*
      KART İÇİNDE — sayfadaki TEK kartsız öğe olmaktan çıktı.

      Bu blok çıplak bir `View`di ve etrafındaki her şey BentoCard'dı. Gruplanmış-inset
      düzende (iOS Ayarlar deseni) kapsayıcısı olmayan bir öğe "sisteme ait değil" diye
      okunur — göz onu içerik değil artık sayar. Selamlama ile ilk kartın arasında
      duruyordu, yani en görünür yerde.

      Kural basit: gruplanmış bir sayfada her öğe bir gruba aittir. Ya bir gruba katılır
      ya da kendisi grup olur. Bu blok artık kendisi bir grup.

      Dolgu kartın varsayılanından (S.lg) küçük: içerik tek satır yüksekliğinde, tam
      dolgu kartı boş gösterirdi.
    */}
    <View style={embedded ? undefined : { paddingHorizontal: S.lg, marginBottom: S.lg }}>
    {/*
      ISI ŞERİDİ — kaldırılan "aura"nın yerine.

      ── NE VARDI ─────────────────────────────────────────────────────────────
      Kartın ARKASINDA, 20px bulanıklıkla çizilen ve SONSUZ döngüde nabız atan renkli
      bir dikdörtgen vardı. Üç ayrı sorunu birden taşıyordu:

       · RENGİ ANLAMSIZDI: hangi modun açık olduğuna bakıyordu ve spor modunda
         `theme.error` — yani HATA kırmızısı — seçiyordu. Kullanıcının etrafı kırmızı
         parlayan bir kutu görmesi için tek sebep, o gün spor modunu açmış olmasıydı.
         Uygulamanın renk sözleşmesinde kırmızı "bir şey ters gitti" demek.
       · BİLGİ TAŞIMIYORDU: parıltının şiddeti ısıyla değişiyordu ama bulanık bir
         halenin "ne kadar" olduğu okunamaz. Göz onu bir ölçü değil, bir süs sayar.
       · DURMUYORDU: döngü ekran açık kaldığı sürece çalışıyordu. Hiçbir şey anlatmayan
         sürekli hareket, dikkati çalar.

      ── NE VAR ───────────────────────────────────────────────────────────────
      Aynı veri (motor ısısı) kartın ÜST KENARINDA 2pt'lik bir şerit olarak duruyor:
      genişliği ısının kendisi, rengi uygulamanın kendi ölçeği (normal → sıcak → aşırı).
      Okunur, ölçülebilir ve değer değiştiğinde bir kez yumuşakça büyür — dinamik ama
      gürültüsüz. Parlama yok, sonsuz döngü yok.
    */}
    <CardBox embedded={embedded}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>

      {/* Skoru okutan küre: açılınca üç nefes alır, sonra skor seviyesinde durur (bkz. MomentumOrb).
          Panel içinde küçük: ana öğe gün çiçeği, momentum alt bilgi ("daha minimalist", 2026-10-30). */}
      <MomentumOrb score={targetScore} color={accentColor} size={embedded ? 28 : 40} wake={wake} />

      {/* Score + info */}
      <View>
      <MotiView
        from={{ opacity: first ? 0 : 1, translateY: first ? 4 : 0 }}
        animate={{ opacity: scoreShown ? 1 : 0, translateY: scoreShown ? 0 : 4 }}
        transition={ENTER}
      >
        <AnimatedNumber
          value={scoreShown ? targetScore : 0}
          from={first ? 0 : undefined}
          duration={1100}
          /*
            İKİNCİL SAYI ÖLÇEĞİ — kart kahramanından KÜÇÜK olmak zorunda.

            48pt elle yazılıydı, yani METRIC ölçeğinin dışındaydı; ölçekte `md: 44`
            "kart kahramanı", `sm: 32` "ikincil sayı" demek. Sonuç: momentum sayfadaki
            EN BÜYÜK sayıydı ve "Bugün" kartının 44pt'lik ana sayısını eziyordu.

            Hiyerarşi tersti ve en çok da başarı anında görünüyordu: kullanıcı günün
            hedefinin %100'ünü bitirdiğinde ekranın en büyük öğesi hâlâ gri bir momentum
            puanı oluyor, asıl başarı onun altında daha küçük duruyordu. Momentum
            BAĞLAMDIR (uzun vadeli eğilim); günün sonucu ise KONUDUR. Punto bunu söylemeli.

            Harf aralığı ve satır yüksekliği de puntodan türüyor artık — -3 ve 52 elle
            yazılıydı, yani 48'e göreydi ve punto değişince sessizce bozulurlardı.
          */
          style={{
            fontSize: embedded ? F.title : METRIC.sm,
            fontWeight: '700',
            // Dijital panelin içindeyken panelin sabit genişlikli rakamı (bkz. DisplayPanel).
            ...(embedded ? { fontFamily: DISPLAY_FONT.digits, fontWeight: undefined } : null),
            letterSpacing: trackingFor(embedded ? F.title : METRIC.sm),
            color: accentColor,
            lineHeight: (embedded ? F.title : METRIC.sm) * LH.tight,
          }}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, marginTop: -2 }}>
          {/*
            ETİKET NÖTR, SAYI RENKLİ. Etiket de skor rengini alıp `opacity: 0.5` ile
            kısılıyordu; iki ayrı hata: (a) rengi kullanım yerinde kısmak ölçülen
            kontrastı geçersiz kılar (bkz. colorContrast.test.ts), (b) hem sayı hem
            etiket renkliyken renk "durum" demeyi bırakır, dekora döner. Renk TEK yerde
            konuşsun: sayıda. `fontSize: F.caption` da ölçek dışıydı — F.caption ölçekten gelir.
          */}
          <Text style={{ fontSize: F.caption, fontWeight: '700', letterSpacing: 1.2, color: theme.onSurfaceMuted }}>
            MOMENTUM
          </Text>
          {/*
            `ⓘ` bir METİN karakteriydi — yazı tipine göre farklı çizilir ve satır
            hizasına oturmaz. Uygulamanın her yerinde lucide glifleri var; tek bir metin
            sembolü sistemi bozuyordu. Daire zemin de kalktı: Apple bar içi yardım
            glifini çıplak çizer.
          */}
          <Touchable
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
            onPress={() => { haptic.surface(); setInfoVisible(true); }}
            accessibilityRole="button"
            accessibilityLabel={tr ? 'Momentum nedir?' : 'What is momentum?'}
          >
            <Info size={ICON.xs} color={theme.onSurfaceVariant} strokeWidth={2.5} />
          </Touchable>
        </View>
      </MotiView>
      </View>

      {/*
        DİKEY AYIRAÇ KALDIRILDI. Uygulamada başka hiçbir yerde dikey saç teli çizgi yok;
        bu bir "widget" deseni, iOS deseni değil. Rengi de ham `rgba()` ile tema başına
        elle yazılıydı, yani paletin dışındaydı. Kart kenarı ve aradaki boşluk ayırma
        işini zaten yapıyor — çizgi yalnız gürültü ekliyordu.
      */}

      {/* Sparkline */}
      <View style={{ flex: 1, gap: S.xs }}>
        {/*
          İLK GÜN GRAFİK YOK, CÜMLE VAR. Tek veri noktasıyla grafik yedi boş kesik çizgi +
          bir çubuktu: yeni kullanıcının ilk gördüğü şey "boş bir grafik" oluyordu.
          İkinci günden itibaren çubuklar ve "N. gün · grafik doluyor" altyazısı (aşağıda)
          aynen sürüyor — "henüz dolmamış" fikri korunuyor, yalnız boş anı sözle anlatılıyor.
        */}
        {daysWithData <= 1 ? (
          <Text style={{ fontSize: F.footnote, fontWeight: '500', color: theme.onSurfaceVariant, lineHeight: 18 }}>
            {FIRST_DAY[language === 'en' ? 'en' : 'tr']}
          </Text>
        ) : (
        <>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: S.xs, height: 24 }}>
          {displayHistory.map((day, i) => {
            const has = day.score >= 0;
            const isToday = i === 6;
            const h = has ? Math.max(3, Math.round((day.score / 100) * 24)) : 3;
            // Veri olmayan gün PALET jetonuyla çiziliyor; ham `rgba()` ile tema başına
            // elle yazılıydı ve palet değişince sessizce eskiyordu.
            const barColor = !has
              ? theme.outlineVariant
              : day.score >= 75 ? theme.tertiary
              : day.score >= 40 ? theme.streak
              : theme.onSurfaceVariant;
            return (
              <View key={day.date} style={{ flex: 1, height: 24, justifyContent: 'flex-end' }}>
                {/*
                  HALE — çubuğun ARKASINDA, çubuğun KENDİSİNDE değil.

                  Çubuğun kendi opaklığını nefes ettirmek en kolay yoldu ama yanlış:
                  bu grafikte renk skoru kodluyor (yeşil/turuncu/gri) ve opaklık
                  kısılınca o kodlama okunamaz hâle geliyor — aynı gerekçeyle geçmiş
                  günlerin %45 soluklaştırması da kaldırılmıştı (bkz. aşağıdaki not).
                  Yükseklik de skoru kodluyor, onu oynatmak grafiği YALAN söyletirdi.

                  Geriye veri taşımayan tek kanal kalıyor: çubuğun etrafındaki boşluk.
                  Hale birkaç piksel dışarı taşan ayrı bir katman; çubuk tam opaklıkla
                  onun üstünde duruyor. Yani parıltı hiçbir okunur değeri bozmadan
                  ekleniyor.

                  Lite modda kapalı: o mod süslemeleri değil, sürekli çalışan işi keser.
                */}
                {isToday && isBestDay && ready && (
                  /*
                    SONLU: iki kez parlar, sonra soluk bir halede DURUR (eskiden sonsuz döngüydü —
                    "hareket durur" kuralı). Kalan hale durağan işarettir: animasyon tek kanal değil.
                  */
                  <MotiView
                    from={{ opacity: 0 }}
                    animate={{ opacity: [0.35, 0.1, 0.35, 0.18] }}
                    transition={{ type: 'timing', duration: 700 }}
                    style={{
                      position: 'absolute',
                      left: -3,
                      right: -3,
                      bottom: -3,
                      height: h + 6,
                      borderRadius: R.sm,
                      backgroundColor: barColor,
                    }}
                  />
                )}
              <MotiView
                // Uyanışta çubuk yeniden yükselir (anahtar `wake`): grafik yeniden okundu. Çubuk
                // etkileşimsiz, ekran okuyucu ağacında değil — yeniden mount güvenli.
                key={reduceMotion ? 'bar' : `bar-${wake}`}
                // İlk gösterimde ve uyanışta yükselir; sekmeden dönüşte (uyanıştan önce) yerinde çizilir.
                from={{ height: first || wake > 0 ? 0 : h }}
                animate={{ height: ready ? h : 0 }}
                transition={{ ...ENTER, duration: 450, delay: i * 35 }}
                /*
                  `opacity: isToday ? 1 : 0.45` KALDIRILDI. Geçmiş günleri %45'e kısmak
                  iki şeyi bozuyordu: renk skoru kodluyor (yeşil/turuncu/gri) ve kısılınca
                  o kodlama okunamaz hâle geliyordu; ayrıca ölçülen kontrast geçersiz
                  kalıyordu. Bugünü ayırt etmek için vurguya da gerek yok — grafiğin SON
                  çubuğu zaten bugün, konum bunu söylüyor. Apple'ın grafikleri de geçmiş
                  değerleri soluklaştırmaz.
                */
                style={{
                  borderRadius: R.xs,
                  backgroundColor: barColor,
                }}
              />
              </View>
            );
          })}
        </View>
        {/*
          ALTYAZI GRAFİĞİN NE OLDUĞUNU SÖYLER.
          "son 7 gün" yazıp neredeyse boş bir grafik göstermek yanlış bir cümle kuruyordu:
          kullanıcı 7 günlük verisine baktığını sanıp düz çizgi görüyor ve "hiç ilerlemem
          yok" diye okuyordu. Veri yetersizken grafik boş değil, HENÜZ DOLMAMIŞTIR —
          altyazı bunu söyleyince aynı görüntü suçlama olmaktan çıkıp beklenti oluyor.
        */}
        <Text style={{ fontSize: F.caption, fontWeight: '700', color: theme.onSurfaceMuted, letterSpacing: 0.3 }}>
          {buildingUp
            ? (tr ? `${daysWithData}. gün · grafik doluyor` : `day ${daysWithData} · chart filling up`)
            : (tr ? 'son 7 gün' : 'last 7 days')}
        </Text>
        </>
        )}
      </View>

      {/* Trend */}
      {delta !== null && (
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 300 }}
          style={{ alignItems: 'center', gap: S.xs }}
        >
          {delta > 0
            ? <TrendingUp size={ICON.sm} color={theme.tertiary} strokeWidth={2.5} />
            : delta < 0
            ? <TrendingDown size={ICON.sm} color={theme.error} strokeWidth={2.5} />
            : <Minus size={ICON.sm} color={theme.onSurfaceVariant} strokeWidth={2.5} />}
          <Text style={{
            fontSize: 11,
            fontWeight: '700',
            color: delta > 0 ? theme.tertiary : delta < 0 ? theme.error : theme.onSurfaceVariant,
            opacity: delta === 0 ? 0.4 : 1,
          }}>
            {delta > 0 ? `+${delta}` : delta}
          </Text>
        </MotiView>
      )}
    </View>
    </CardBox>
    </View>

    {/* Momentum formula info modal */}
    <Modal visible={infoVisible} transparent animationType="fade" onRequestClose={() => setInfoVisible(false)}>
      <Touchable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: S.slg }} activeOpacity={1} onPress={() => setInfoVisible(false)}>
        <MotiView
          from={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={ENTER}
          style={{ borderRadius: R.sheet, padding: S.lg, width: '100%', gap: S.md }}
        >
          <GlassSurface radius={R.sheet} />
          <Text style={{ fontSize: 16, fontWeight: '700', color: accentColor, letterSpacing: -0.5 }}>
            {tr ? 'Momentum Nasıl Hesaplanır?' : 'How is Momentum Calculated?'}
          </Text>
          <Text style={{ fontSize: 13, fontWeight: '500', color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)', lineHeight: 20 }}>
            {tr
              ? 'Momentum, takip etmen gereken tek skor. Görevlerin, odağın ve serin bir araya gelip onu besler:'
              : 'Momentum is the one score to watch. Your tasks, focus, and streak come together to feed it:'}
          </Text>
          {[
            { icon: <CheckCircle2 size={ICON.sm} color={theme.success} />, label: tr ? 'Görev Tamamlama' : 'Task Completion', pct: '40%', color: theme.success },
            { icon: <Zap size={ICON.sm} color={accentColor} />, label: tr ? 'Odak Süresi' : 'Focus Time', pct: '35%', color: accentColor },
            { icon: <Flame size={ICON.sm} color={theme.streak} />, label: tr ? 'Günlük Seri' : 'Daily Streak', pct: '25%', color: theme.streak },
          ].map((row) => (
            <View key={row.label} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.smd }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                {row.icon}
                <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.8)' }}>{row.label}</Text>
              </View>
              <Text style={{ fontSize: 14, fontWeight: '700', color: row.color }}>{row.pct}</Text>
            </View>
          ))}

          {/* Momentum Shield (İvme Kalkanı) Toggle Card */}
          <View style={{
            backgroundColor: momentumShieldActive ? theme.streak + '15' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'),
            borderRadius: R.lg,
            padding: S.md,
            borderWidth: B.thin,
            borderColor: momentumShieldActive ? theme.streak + '40' : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)'),
            gap: S.smd
          }}>
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.smd, flex: 1, marginRight: S.sm }}>
                <Shield size={ICON.md} color={momentumShieldActive ? theme.streak : theme.onSurfaceVariant} strokeWidth={2.2} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)' }}>
                    {tr ? 'İvme Kalkanı' : 'Momentum Shield'}
                  </Text>
                  <Text style={{ fontSize: 10, color: theme.onSurfaceMuted, marginTop: S.xxs, lineHeight: 13 }}>
                    {tr ? 'Hastalık / tatil günlerinde ivmeyi korur' : 'Freezes momentum on sick / vacation days'}
                  </Text>
                </View>
              </View>
              <Touchable
                disabled={!momentumShieldActive && shieldCharges <= 0}
                onPress={() => {
                  haptic.success();
                  toggleMomentumShield();
                }}
                style={{
                  backgroundColor: momentumShieldActive 
                    ? theme.streak 
                    : (shieldCharges <= 0 ? 'rgba(0,0,0,0.05)' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')),
                  paddingHorizontal: S.smd,
                  paddingVertical: S.sm,
                  borderRadius: R.sm,
                  borderWidth: 1,
                  borderColor: momentumShieldActive ? 'transparent' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'),
                  opacity: (!momentumShieldActive && shieldCharges <= 0) ? 0.4 : 1
                }}
              >
                {/* Koyu temada `theme.streak` açık turuncuya dönüyor; üstünde beyaz yazı
                     okunmuyordu. Dolu zeminin üstündeki yazı temaya göre çözülür. */}
                <Text style={{ fontSize: 10, fontWeight: '700', color: momentumShieldActive ? modeAccentOn(isDark) : theme.onSurfaceVariant }}>
                  {momentumShieldActive 
                    ? (tr ? 'AKTİF' : 'ACTIVE') 
                    : (shieldCharges <= 0 ? (tr ? 'ŞARJ YOK' : 'NO CHARGE') : (tr ? 'ETKİNLEŞTİR' : 'ACTIVATE'))}
                </Text>
              </Touchable>
            </View>

            {/* Divider */}
            <Separator theme={theme} />
            {/* Charges and progress details */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              {/* Charge Pills */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: theme.onSurfaceVariant, marginRight: S.xxs }}>
                  {tr ? 'Şarj:' : 'Charges:'}
                </Text>
                {Array.from({ length: 3 }).map((_, idx) => {
                  const filled = idx < shieldCharges;
                  return (
                    <View
                      key={idx}
                      style={{
                        width: 14,
                        height: 7,
                        borderRadius: R.xs,
                        backgroundColor: filled 
                          ? (momentumShieldActive ? theme.streak : theme.tertiary) 
                          : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'),
                      }}
                    />
                  );
                })}
              </View>

              {/* Progress to next charge */}
              {shieldCharges < 3 ? (
                <Text style={{ fontSize: F.caption, fontWeight: '700', color: theme.onSurfaceMuted }}>
                  {tr 
                    ? `Yeni şarj için: ${60 - focusMinutesForNextCharge}dk odak / ${5 - tasksCompletedForNextCharge} görev`
                    : `${60 - focusMinutesForNextCharge}m focus / ${5 - tasksCompletedForNextCharge} tasks next`
                  }
                </Text>
              ) : (
                <Text style={{ fontSize: F.caption, fontWeight: '700', color: theme.tertiary }}>
                  {tr ? 'Maksimum Şarj' : 'Maximum Charged'}
                </Text>
              )}
            </View>
          </View>

          <Touchable onPress={() => setInfoVisible(false)} style={{ backgroundColor: accentColor, borderRadius: R.md, paddingVertical: S.smd, alignItems: 'center', marginTop: S.xs }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>{tr ? 'Anladım' : 'Got it'}</Text>
          </Touchable>
        </MotiView>
      </Touchable>
    </Modal>
    </>
  );
};
