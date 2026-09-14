import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, useWindowDimensions, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { AppBlur } from '@/shared/components/AppBlur';
import { MotiView } from 'moti';
import { useRouter } from 'expo-router';
import { X, EyeOff, Moon, Sun, Smartphone, Tablet } from 'lucide-react-native';
import { TazqLogo } from '@/shared/components/TazqLogo';
/*
  MOCK EKRANLAR KENDİ DOSYASINDA.

  Bu sayfa iki ayrı iş yapıyordu: (1) slayt/kaydırma/tema-dil kontrolü olan tanıtım
  kabuğu, (2) uygulamanın ölçülü bir kopyasını çizen mock motoru. İkincisi ilkinden
  uzun ve tamamen başka bir iş: uygulamanın arayüzü değiştiğinde değişiyor, tanıtım
  kurgusu değiştiğinde değil. İki farklı sebeple değişen iki şey aynı dosyada durmaz.
*/
import {
  PromoMock, ACCENTS, type AccentKey, type PromoKind, type PromoMode,
} from '@/features/promo/components/PromoMock';
import { PROMO_DEVICES, PROMO_DEVICE_ORDER, type PromoDeviceId } from '@/features/promo/promoDevices';
import { Touchable } from '@/shared/components/Touchable';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { useAuthStore } from '@/features/user';


type SlideDef = {
  kind: Kind;
  accentKey: AccentKey;
  darkColors: string[]; // koyu arka plan gradyanı (dark modda ve her zaman koyu kalan slaytlarda)
  ebTr: string; ebEn: string;
  tTr: string; tEn: string;
  sTr: string; sEn: string;
};

const SLIDES: SlideDef[] = [
  /*
    ── SIRA BİR TASARIM KARARI ──────────────────────────────────────────────────
    Mağazada dönüşümün büyük kısmını İLK İKİ görsel belirler; kullanıcı geri kalanını
    çoğu zaman hiç görmez. Sıra bir tur önce odak ekranıyla başlıyordu — güzel bir
    görseldi ama "bir pomodoro uygulaması daha" diyordu ve TAZQ'nun o kategoride
    ayırt edici bir sözü yok (Forest, Todoist, TickTick aynı rafta).

    Şimdi dönemsel modlar başta: Todoist'in yapmadığı, yapamayacağı şey bu — genel
    bir listeye özel bir dönem kurgusu koyulamaz. Aranan sorgu da bu ("YKS çalışma
    programı", "sigara bırakma takip"); görsel, aramayla aynı şeyi söylemeli.

    ── METİN KURALI ─────────────────────────────────────────────────────────────
    Başlık FAYDA söyler, alt satır bunu SOMUT bir örnekle kanıtlar. Özellik listesi
    yazmıyoruz: "Pomodoro, ambiyans sesleri ve zen modu" bir menü; "Bir saatliğine
    dünyayı sustur" bir vaat. Kullanıcı kaydırırken saniyenin altında okuyor.
  */

  // 1 — Dönemsel Modlar: TEK gerçek ayrıştırıcı, o yüzden ilk görsel · teal
  { kind: 'modes', accentKey: 'teal', darkColors: ['#062430', '#0c4258', '#051826'],
    ebTr: 'Yaşam Modları', ebEn: 'Life Modes',
    tTr: 'Tarihini gir,\nplanını biz kuralım', tEn: 'Set your date,\nwe build the plan',
    sTr: 'Sınavına 90 gün mü var? Her sabah o güne ait görevlerin hazır.',
    sEn: '90 days to your exam? Each morning, that day’s tasks are ready.' },

  // 2 — Odak (aurora): en güçlü görsel · violet. Derin odak HER ZAMAN koyu.
  { kind: 'focus', accentKey: 'violet', darkColors: ['#1a0b42', '#2f1280', '#140a30'],
    ebTr: 'Derin Odak', ebEn: 'Deep Focus',
    tTr: 'Bir saatliğine\ndünyayı sustur', tEn: 'Mute the world\nfor an hour',
    sTr: 'Pomodoro, ambiyans sesleri ve zen modu — dikkatin dağılmadan.',
    sEn: 'Pomodoro, ambient sound and zen mode — without losing your thread.' },

  // 3 — Görevler: kancası AKILLI GİRİŞ, liste tutmak değil · indigo
  { kind: 'tasks', accentKey: 'indigo', darkColors: ['#0f1140', '#25297a', '#0b0d30'],
    ebTr: 'Görevler & Alışkanlıklar', ebEn: 'Tasks & Habits',
    tTr: 'Yaz gitsin,\ngerisini TAZQ anlasın', tEn: 'Just type it.\nTAZQ gets the rest',
    sTr: '“yarın 15:00 toplantı” — tarih, saat ve öncelik kendiliğinden.',
    sEn: '“meeting tomorrow 3pm” — date, time and priority, automatically.' },

  // 4 — Momentum: ilerleme · emerald
  { kind: 'momentum', accentKey: 'emerald', darkColors: ['#06271f', '#0d4a3c', '#051c16'],
    ebTr: 'Momentum', ebEn: 'Momentum',
    tTr: 'Tek sayı,\nbütün hikâye', tEn: 'One number,\nthe whole story',
    sTr: 'Görev, odak ve serin tek skorda. Bugün iyi miydin, bir bakışta.',
    sEn: 'Tasks, focus and streak in one score. Was today good? One glance.' },

  // 5 — Haftalık Merkez · amber (ödül/karne tonu)
  { kind: 'cockpit', accentKey: 'amber', darkColors: ['#2a1a06', '#5c3c0f', '#1e1305'],
    ebTr: 'Haftalık Merkez', ebEn: 'Weekly Hub',
    tTr: 'Haftan nasıl\ngeçti gerçekten?', tEn: 'How did your week\nactually go?',
    sTr: 'Günlük tutarlılığın ve haftalık karnen — tahmin değil, ölçüm.',
    sEn: 'Daily consistency and a weekly report — measured, not guessed.' },

  // 6 — Ana ekran: genel bakış · primary (mavi, marka hero)
  { kind: 'home', accentKey: 'blue', darkColors: ['#08122f', '#123a86', '#070c26'],
    ebTr: 'Genel Bakış', ebEn: 'Overview',
    tTr: 'Günün\ntek ekranda', tEn: 'Your day,\none screen',
    sTr: 'Sırada ne var, ne kadar ilerledin, bugün ne kaldı.',
    sEn: 'What’s next, how far you’ve come, what’s left today.' },

  // 7 — Marka kapanışı · violet. Alt satır GİRİŞ ENGELİNİ kaldırıyor:
  //     son görselde okunan son cümle bu olmalı.
  { kind: 'brand', accentKey: 'violet', darkColors: ['#1a0b42', '#2f1280', '#140a30'],
    ebTr: 'TAZQ', ebEn: 'TAZQ',
    tTr: 'Odaklan. İlerle.\nDengede kal.', tEn: 'Focus. Progress.\nStay balanced.',
    sTr: 'Ücretsiz. Hesap açmadan denemeye başlayabilirsin.',
    sEn: 'Free. Start trying it without an account.' },
];

/*
  TANITIM KABUĞUNUN KENDİ ETİKETLERİ.

  Mock'un metinleri zaten sözlükten geliyor (bkz. promoCopy); geriye bu sayfanın kendi
  düğme adları kalmıştı ve satır içi dallanıyorlardı. Aynı kural burada da geçerli: iki
  dil YAN YANA dursun, biri güncellenip öteki unutulmasın (bkz. i18nRatchet). Çoğu
  ekran okuyucuya okunan ad — gözle görülmediği için ayrışması en kolay metin türü.
*/
const UI: Record<'tr' | 'en', {
  close: string; device: string; switchDevice: string; lightTheme: string;
  darkTheme: string; clean: string; swipe: string; showChrome: string;
}> = {
  tr: {
    close: 'Kapat', device: 'Cihaz', switchDevice: 'Değiştirmek için dokun',
    lightTheme: 'Açık tema', darkTheme: 'Koyu tema', clean: 'Temiz',
    swipe: 'kaydır', showChrome: 'Arayüzü göster',
  },
  en: {
    close: 'Close', device: 'Device', switchDevice: 'Tap to switch',
    lightTheme: 'Light theme', darkTheme: 'Dark theme', clean: 'Clean',
    swipe: 'swipe', showChrome: 'Show controls',
  },
};

// Bu slaytın ARKA PLANI koyu mu? Odak ve marka her modda koyu (derin odak koyu ekran, kapanış dramatik).
type Mode = PromoMode;
type Kind = PromoKind;

/**
 * Metin bloğunun sabit yüksekliği: göz kaşı + iki satır başlık + iki satır alt metin.
 * Slaytlar arasında kaydırırken telefon çerçevesinin zıplamaması için sabit.
 */
const TEXT_BLOCK_H = 168;

const backdropIsDark = (kind: Kind, mode: Mode) => mode === 'dark' || kind === 'focus' || kind === 'brand';

export default function PromoScreen() {
  const router = useRouter();
  const { language } = useLanguageStore();
  // Promo içinde yerel dil + tema — uygulamanın genel ayarını değiştirmeden TR/EN ve açık/koyu screenshot al
  const [lang, setLang] = useState<'tr' | 'en'>(language === 'en' ? 'en' : 'tr');
  const [mode, setMode] = useState<Mode>('dark');
  /*
    Hangi cihazın görseli çekiliyor. Dört ayrı mağaza yuvası var (App Store iPhone +
    iPad, Play telefon + tablet) ve uygulama dördünde de farklı duruyor — bkz.
    promoDevices. Düğme sırayla dolaşıyor.
  */
  const [deviceId, setDeviceId] = useState<PromoDeviceId>('iphone');
  const tr = lang === 'tr';
  const role = useAuthStore((s) => s.user?.role);
  const { width: W, height: H } = useWindowDimensions();

  const [chrome, setChrome] = useState(true);
  /*
    ── ÇERÇEVE, METNİN ALTINDA KALAN GERÇEK ALANA GÖRE ─────────────────────────
    Yükseklik ekranın sabit bir oranından (H * 0.66) hesaplanıyordu ve bu bir
    VARSAYIMDI: metin bloğunun ne kadar yer kaplayacağını bildiğini sanıyordu.
    Oysa blok slayda ve dile göre uzuyor — iki satırlık başlık + iki satırlık alt
    metin olduğunda çerçeve yukarı taşıp yazının üstüne biniyordu (Pixel Tablet,
    1. slayt). Tablet oranı geniş olduğu için önce orada görüldü ama varsayım
    baştan yanlıştı.

    Artık sahne kendi boyunu ÖLÇÜYOR. Metin bloğu da sabit yükseklikte: slaytlar
    arasında kaydırırken telefonun zıplamaması için (ölçü en uzun metne göre).
  */
  const [stageH, setStageH] = useState(0);
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => { if (role && role !== 'Admin') router.replace('/'); }, [role]);
  useEffect(() => {
    StatusBar.setBarStyle('light-content');
    StatusBar.setHidden(!chrome, 'fade');
  }, [chrome]);
  useEffect(() => () => { StatusBar.setHidden(false); }, []);

  if (role !== 'Admin') return null;

  const onScroll = (e: any) => {
    const p = Math.round(e.nativeEvent.contentOffset.x / W);
    if (p !== page) setPage(p);
  };

  const A = ACCENTS[mode];
  const u = UI[lang];

  /*
    ── TELEFON ÇERÇEVESİ GERÇEK BİR CİHAZIN ÖLÇEKLİ KOPYASI ──────────────────────
    İç ekran seçili cihazın mantıksal ölçülerinde kurgulanıp (bkz. DEVICES) TEK bir
    çarpanla küçültülüyor; mock'un içindeki her ölçü de aynı çarpandan geçiyor
    (bkz. PromoMock `px`).

    Referansın gerçek cihaz olması şart. Bir tur önce 234 alınmıştı: mock'taki her şey
    1.68 kat büyük çiziliyordu, yazılar sığmıyor ve kartlar iç içe giriyordu. "Oranı
    koruyorum" cümlesi ancak referans gerçek cihazsa bir anlam taşır — aksi hâlde
    korunan oran, var olmayan bir telefonun oranı olur.
  */
  const device = PROMO_DEVICES[deviceId];
  /*
    ── ÇERÇEVEYE AYRILAN ALAN FORM FAKTÖRÜNE GÖRE ──────────────────────────────
    Çerçeve hem yüksekliğe hem genişliğe sığmak zorunda. Telefonda yükseklik bağlar
    (dar ve uzun), tablette genişlik — tablet oranı 3:4'e yakın ve aynı bütçeyle
    çizilirse slaytın iki yanından taşar.

    Tablete daha cömert bir bütçe veriliyor ve bunun DÜRÜST sebebi şu: 13" iPad
    1032pt geniş, yani telefonun 2.6 katı. Aynı piksel genişliğine sığdırılınca her
    şey 2.6 kat küçülüyor ve 14pt'lik gövde yazısı okunamaz hâle geliyor. Bütçeyi
    büyütmek bunu tamamen çözmüyor — çözemez de, oran oran — ama tablet görselini
    "ne yazdığı seçilen" tarafta tutuyor. Oranlardan ödün verilmiyor; yalnız çerçeve
    slaytın daha büyük bir kısmını kaplıyor.
  */
  const maxW = W - 56 - (device.wide ? 0 : W * 0.3);   // 28pt sayfa payı × 2
  /*
    Ölçüm gelene kadar TEMKİNLİ bir tahmin: ilk karede çerçeve biraz küçük çizilip
    hemen doğru boyuna oturur. Tersi (büyük başlayıp küçülmek) ilk karede çakışma
    demek olurdu.
  */
  const maxH = (stageH > 0 ? stageH : H * 0.5) - 8;
  let screenH = maxH;
  let screenW = (screenH * device.w) / device.h;
  if (screenW > maxW) {
    screenW = maxW;
    screenH = (screenW * device.h) / device.w;
  }
  /** Uygulama pt'si → mock pt'si. Mock'un tamamı bu tek çarpanla ölçekleniyor. */
  const S = screenW / device.w;

  /*
    ── GÖVDE ──────────────────────────────────────────────────────────────────
    `BEZEL` ekranın etrafındaki siyah çerçeve, `RAIL` de gövdenin dış kenarındaki
    ince parlama (metal çerçeve). İkisi de ölçekle büyüyüp küçülüyor; sabit piksel
    verilince küçük telefonda kalın, büyükte kâğıt gibi ince kalıyordu.

    ÖLÇÜ SABİT PİKSEL DEĞİL, KUTU MODELİ HESABI. Önceki hâlde gövdeye `borderWidth`
    ve `padding` birlikte veriliyordu ama genişlik yalnız ekran + pay kadardı:
    RN'de ikisi de genişliğin İÇİNDEN yediği için iç ekran gövdeden 4px taşıyor,
    köşeler kayıyordu. Şimdi dış ölçü ikisini de kapsıyor.
  */
  const BEZEL = Math.max(3, Math.round(8 * S));
  const RAIL = 1;
  /** Eş merkezli köşe: dıştaki yarıçap = içteki + aradaki kalınlık. */
  const innerRadius = device.radius * S;
  const outerRadius = innerRadius + BEZEL + RAIL;

  // Şu an görünen slaytın alt kontrol (nokta/metin) rengi arka plana göre
  const pageDark = backdropIsDark(SLIDES[page]?.kind ?? 'focus', mode);

  return (
    <View style={{ flex: 1, backgroundColor: mode === 'dark' ? '#0a0f22' : '#EDEEF3' }}>
      <ScrollView ref={scrollRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={16}>
        {SLIDES.map((slide) => {
          const accent = A[slide.accentKey];
          const bd = backdropIsDark(slide.kind, mode);
          const bgColors = bd ? slide.darkColors : ['#FFFFFF', '#F4F5FA', '#ECEEF4'];
          const titleColor = bd ? '#FFFFFF' : '#12131A';
          const subColor = bd ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)';
          return (
          <View key={slide.kind} style={{ width: W, height: H }}>
            <LinearGradient colors={bgColors as any} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
            {/* Renk parıltısı — kenarsız köşe gradyanı (sert daire yok) */}
            <LinearGradient pointerEvents="none" colors={[accent + (bd ? '40' : '2E'), 'transparent']} start={{ x: 0.92, y: 0.04 }} end={{ x: 0.35, y: 0.5 }} style={StyleSheet.absoluteFill} />
            <LinearGradient pointerEvents="none" colors={['transparent', accent + (bd ? '1F' : '17')]} start={{ x: 0.4, y: 0.6 }} end={{ x: 0.05, y: 1 }} style={StyleSheet.absoluteFill} />
            <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
              <View style={{ flex: 1, paddingHorizontal: 28, paddingTop: H * 0.035, paddingBottom: 30 }}>
                {/* Sabit yükseklik: slaytlar arası kaydırmada telefon zıplamasın. */}
                <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 450 }} style={{ height: TEXT_BLOCK_H }}>
                  <Text style={{ color: accent, fontSize: 13, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase' }}>{tr ? slide.ebTr : slide.ebEn}</Text>
                  <Text style={{ color: titleColor, fontSize: Math.min(32, W * 0.08), fontWeight: '800', letterSpacing: -0.6, marginTop: 8, lineHeight: Math.min(42, W * 0.108), paddingBottom: 2 }}>{tr ? slide.tTr : slide.tEn}</Text>
                  <Text style={{ color: subColor, fontSize: 14, fontWeight: '500', marginTop: 8, lineHeight: 20 }}>{tr ? slide.sTr : slide.sEn}</Text>
                </MotiView>
                <View
                  style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
                  onLayout={(e) => {
                    const h = Math.round(e.nativeEvent.layout.height);
                    if (h > 0 && h !== stageH) setStageH(h);
                  }}
                >
                  <MotiView from={{ opacity: 0, scale: 0.94, translateY: 14 }} animate={{ opacity: 1, scale: 1, translateY: 0 }} transition={{ type: 'timing', duration: 550, delay: 120 }}>
                    {slide.kind === 'brand' ? (
                      <MotiView from={{ scale: 0.92 }} animate={{ scale: 1 }} transition={{ loop: true, repeatReverse: true, type: 'timing', duration: 3200 }} style={{ alignItems: 'center' }}>
                        <View style={{ width: 168, height: 168, borderRadius: 84, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(167,139,250,0.16)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.34)' }}>
                          <TazqLogo size={90} variant="white" />
                        </View>
                      </MotiView>
                    ) : (
                      /* Telefon çerçevesi + temsili ekran */
                      <View
                        style={{
                          // Dış ölçü, çerçeveyi VE kenar çizgisini kapsar: içeride tam
                          // olarak `screenW × screenH` kalır, hiçbir şey taşmaz.
                          width: screenW + (BEZEL + RAIL) * 2,
                          height: screenH + (BEZEL + RAIL) * 2,
                          borderRadius: outerRadius,
                          backgroundColor: '#000',
                          borderWidth: RAIL,
                          borderColor: 'rgba(255,255,255,0.22)',
                          padding: BEZEL,
                          shadowColor: accent,
                          shadowOpacity: bd ? 0.5 : 0.32,
                          shadowRadius: 28,
                          shadowOffset: { width: 0, height: 12 },
                          elevation: 12,
                        }}
                      >
                        <View style={{ width: screenW, height: screenH, borderRadius: innerRadius, overflow: 'hidden', backgroundColor: '#000' }}>
                          <PromoMock kind={slide.kind} mode={mode} lang={lang} device={device} frameWidth={screenW} scale={S} />
                          {/*
                            Kamera kesiti EKRANIN İÇİNDE çiziliyor — çünkü gerçekte de
                            ekranın içindeki bir delik. Gövdeye konsaydı köşe kırpmasının
                            dışında kalır ve iç payla hizası kayardı (bir kez öyle oldu).
                            Dynamic Island bir kapsül (125 × 37pt), Pixel'inki ortada
                            11dp'lik bir delik. Çentik ikisi de değil.
                          */}
                          {device.island ? (
                            <View style={{ position: 'absolute', top: 11 * S, left: (screenW - 125 * S) / 2, width: 125 * S, height: 37 * S, borderRadius: 999, backgroundColor: '#000' }} />
                          ) : (
                            <View style={{ position: 'absolute', top: 8.5 * S, left: (screenW - 11 * S) / 2, width: 11 * S, height: 11 * S, borderRadius: 999, backgroundColor: '#000' }} />
                          )}
                        </View>
                      </View>
                    )}
                  </MotiView>
                </View>
              </View>
            </SafeAreaView>
          </View>
          );
        })}
      </ScrollView>

      {chrome ? (
        <>
          <SafeAreaView edges={['top']} style={{ position: 'absolute', top: 0, left: 0, right: 0 }} pointerEvents="box-none">
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 6 }}>
              <Touchable accessibilityRole="button" accessibilityLabel={u.close} hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }} onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' }}>
                <X size={20} color="#FFFFFF" />
              </Touchable>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {/*
                  CİHAZ DÜĞMESİ — hangi mağazanın görselini çektiğini söyler.
                  Etiket cihaz adı ("iPhone"/"Pixel"), platform adı değil: ekrandaki
                  çerçeve o cihazın kendisi ve ölçüleri oradan geliyor.
                */}
                <Touchable
                  accessibilityRole="button"
                  accessibilityLabel={`${u.device}: ${device.label}. ${u.switchDevice}`}
                  hitSlop={{ top: 2, bottom: 2, left: 0, right: 0 }}
                  onPress={() => setDeviceId((d) => PROMO_DEVICE_ORDER[(PROMO_DEVICE_ORDER.indexOf(d) + 1) % PROMO_DEVICE_ORDER.length])}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 12, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.35)' }}
                >
                  {device.wide ? <Tablet size={16} color="#FFFFFF" /> : <Smartphone size={16} color="#FFFFFF" />}
                  <Text numberOfLines={1} style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>{device.label}</Text>
                </Touchable>
                {/* Açık / Koyu tema düğmesi */}
                <Touchable accessibilityRole="button" accessibilityLabel={mode === 'dark' ? u.lightTheme : u.darkTheme} hitSlop={{ top: 2, bottom: 2, left: 0, right: 0 }} onPress={() => setMode((m) => (m === 'dark' ? 'light' : 'dark'))} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' }}>
                  {mode === 'dark' ? <Sun size={18} color="#FFFFFF" /> : <Moon size={18} color="#FFFFFF" />}
                </Touchable>
                {/* TR / EN dil düğmesi */}
                <View style={{ flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 20, padding: 3 }}>
                  {(['tr', 'en'] as const).map((lg) => (
                    <Touchable key={lg} onPress={() => setLang(lg)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 17, backgroundColor: lang === lg ? '#FFFFFF' : 'transparent' }}>
                      <Text style={{ color: lang === lg ? '#000000' : '#FFFFFF', fontWeight: '800', fontSize: 12.5 }}>{lg.toUpperCase()}</Text>
                    </Touchable>
                  ))}
                </View>
                <Touchable hitSlop={{ top: 2, bottom: 2, left: 0, right: 0 }} onPress={() => setChrome(false)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.35)' }}>
                  <EyeOff size={16} color="#FFFFFF" />
                  <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>{u.clean}</Text>
                </Touchable>
              </View>
            </View>
          </SafeAreaView>
          <SafeAreaView edges={['bottom']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }} pointerEvents="box-none">
            <View style={{ alignItems: 'center', paddingBottom: 10, gap: 10 }}>
              <View style={{ flexDirection: 'row', gap: 7 }}>
                {SLIDES.map((_, i) => (
                  <View key={i} style={{ width: i === page ? 22 : 7, height: 7, borderRadius: 4, backgroundColor: i === page ? (pageDark ? '#FFFFFF' : '#12131A') : (pageDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.25)') }} />
                ))}
              </View>
              <Text style={{ color: pageDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', fontSize: 11 }}>{`${page + 1} / ${SLIDES.length} · ${u.swipe}`}</Text>
            </View>
          </SafeAreaView>
        </>
      ) : (
        <SafeAreaView edges={['top']} style={{ position: 'absolute', top: 0, right: 0 }}>
          <Touchable onPress={() => setChrome(true)} activeOpacity={1} style={{ width: 56, height: 56 }} accessibilityRole="button" accessibilityLabel={u.showChrome} />
        </SafeAreaView>
      )}
    </View>
  );
}
