import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, useWindowDimensions, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { AppBlur } from '@/shared/components/AppBlur';
import { MotiView } from 'moti';
import { useRouter } from 'expo-router';
import { X, EyeOff, Moon, Sun } from 'lucide-react-native';
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

// Bu slaytın ARKA PLANI koyu mu? Odak ve marka her modda koyu (derin odak koyu ekran, kapanış dramatik).
type Mode = PromoMode;
type Kind = PromoKind;

const backdropIsDark = (kind: Kind, mode: Mode) => mode === 'dark' || kind === 'focus' || kind === 'brand';

export default function PromoScreen() {
  const router = useRouter();
  const { language } = useLanguageStore();
  // Promo içinde yerel dil + tema — uygulamanın genel ayarını değiştirmeden TR/EN ve açık/koyu screenshot al
  const [lang, setLang] = useState<'tr' | 'en'>(language === 'en' ? 'en' : 'tr');
  const [mode, setMode] = useState<Mode>('dark');
  const tr = lang === 'tr';
  const role = useAuthStore((s) => s.user?.role);
  const { width: W, height: H } = useWindowDimensions();

  const [chrome, setChrome] = useState(true);
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

  // Telefon çerçevesi ölçüsü
  let fh = H * 0.62;
  let fw = fh / 2.05;
  if (fw > W * 0.72) { fw = W * 0.72; fh = fw * 2.05; }
  const S = fw / 234; // ölçek (temel genişlik 234)

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
                <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 450 }}>
                  <Text style={{ color: accent, fontSize: 13, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase' }}>{tr ? slide.ebTr : slide.ebEn}</Text>
                  <Text style={{ color: titleColor, fontSize: Math.min(32, W * 0.08), fontWeight: '800', letterSpacing: -0.6, marginTop: 8, lineHeight: Math.min(42, W * 0.108), paddingBottom: 2 }}>{tr ? slide.tTr : slide.tEn}</Text>
                  <Text style={{ color: subColor, fontSize: 14, fontWeight: '500', marginTop: 8, lineHeight: 20 }}>{tr ? slide.sTr : slide.sEn}</Text>
                </MotiView>
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <MotiView from={{ opacity: 0, scale: 0.94, translateY: 14 }} animate={{ opacity: 1, scale: 1, translateY: 0 }} transition={{ type: 'timing', duration: 550, delay: 120 }}>
                    {slide.kind === 'brand' ? (
                      <MotiView from={{ scale: 0.92 }} animate={{ scale: 1 }} transition={{ loop: true, repeatReverse: true, type: 'timing', duration: 3200 }} style={{ alignItems: 'center' }}>
                        <View style={{ width: 168, height: 168, borderRadius: 84, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(167,139,250,0.16)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.34)' }}>
                          <TazqLogo size={90} variant="white" />
                        </View>
                      </MotiView>
                    ) : (
                      /* Telefon çerçevesi + temsili ekran */
                      <View style={{ width: fw, height: fh, borderRadius: 34 * S, backgroundColor: '#000', padding: 6 * S, borderWidth: 2, borderColor: 'rgba(255,255,255,0.16)', shadowColor: accent, shadowOpacity: bd ? 0.5 : 0.32, shadowRadius: 28, shadowOffset: { width: 0, height: 12 } }}>
                        <View style={{ flex: 1, borderRadius: 29 * S, overflow: 'hidden' }}>
                          <PromoMock kind={slide.kind} mode={mode} lang={lang} frameWidth={fw} scale={S} />
                        </View>
                        <View style={{ position: 'absolute', top: 12 * S, alignSelf: 'center', width: fw * 0.3, height: 7 * S, borderRadius: 4, backgroundColor: '#000' }} />
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
              <Touchable accessibilityRole="button" accessibilityLabel={lang === 'tr' ? 'Kapat' : 'Close'} hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }} onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' }}>
                <X size={20} color="#FFFFFF" />
              </Touchable>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {/* Açık / Koyu tema düğmesi */}
                <Touchable accessibilityRole="button" accessibilityLabel={mode === 'dark' ? (tr ? 'Açık tema' : 'Light theme') : (tr ? 'Koyu tema' : 'Dark theme')} hitSlop={{ top: 2, bottom: 2, left: 0, right: 0 }} onPress={() => setMode((m) => (m === 'dark' ? 'light' : 'dark'))} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' }}>
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
                  <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>{tr ? 'Temiz' : 'Clean'}</Text>
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
              <Text style={{ color: pageDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', fontSize: 11 }}>{tr ? `${page + 1} / ${SLIDES.length} · kaydır` : `${page + 1} / ${SLIDES.length} · swipe`}</Text>
            </View>
          </SafeAreaView>
        </>
      ) : (
        <SafeAreaView edges={['top']} style={{ position: 'absolute', top: 0, right: 0 }}>
          <Touchable onPress={() => setChrome(true)} activeOpacity={1} style={{ width: 56, height: 56 }} accessibilityRole="button" accessibilityLabel={tr ? 'Arayüzü göster' : 'Show controls'} />
        </SafeAreaView>
      )}
    </View>
  );
}
