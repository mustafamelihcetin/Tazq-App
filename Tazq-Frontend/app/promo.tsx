import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, useWindowDimensions, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { MotiView } from 'moti';
import { useRouter } from 'expo-router';
import {
  X, EyeOff, Moon, GraduationCap, Dumbbell, Briefcase,
  CheckCircle2, Circle, Flame, TrendingUp, Home, Target, ListChecks, BarChart3, Sun,
  Wifi, BatteryFull, SignalHigh, Trophy,
} from 'lucide-react-native';
import { TazqLogo } from '@/shared/components/TazqLogo';
import { Touchable } from '@/shared/components/Touchable';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { useAuthStore } from '@/features/user';

type Mode = 'dark' | 'light';
// Vurgu tonları — her biri aydınlık/karanlık çift (uygulama paletiyle aynı: primary/secondary/
// tertiary/warning/streak + CategoryColors indigo/teal). Koyuda parlak, açıkta koyu → iki temada da
// beyaz-glif çipte ve kart üstü yazıda okunur.
const ACCENTS = {
  dark:  { blue: '#0A84FF', violet: '#A78BFA', indigo: '#6366F1', teal: '#2DD4BF', emerald: '#34D399', amber: '#FBBF24', orange: '#FB923C' },
  light: { blue: '#0B6BCB', violet: '#7C3AED', indigo: '#4F46E5', teal: '#0D9488', emerald: '#047857', amber: '#B45309', orange: '#EA580C' },
} as const;
type AccentKey = keyof typeof ACCENTS['dark'];

// Mock (telefon içi) nötr paleti — gerçek uygulamanın iki temasına sadık.
const NEUTRAL = {
  dark:  { screen: '#0C0C12', card: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.10)', text: '#FFFFFF', sub: 'rgba(255,255,255,0.60)', muted: 'rgba(255,255,255,0.42)', track: 'rgba(255,255,255,0.09)' },
  light: { screen: '#F2F2F7', card: '#FFFFFF', border: 'rgba(0,0,0,0.07)', text: '#1C1C1E', sub: 'rgba(0,0,0,0.55)', muted: 'rgba(0,0,0,0.42)', track: 'rgba(0,0,0,0.07)' },
} as const;

type Kind = 'focus' | 'deepfocus' | 'modes' | 'tasks' | 'momentum' | 'cockpit' | 'home' | 'brand';

type SlideDef = {
  kind: Kind;
  accentKey: AccentKey;
  darkColors: string[]; // koyu arka plan gradyanı (dark modda ve her zaman koyu kalan slaytlarda)
  ebTr: string; ebEn: string;
  tTr: string; tEn: string;
  sTr: string; sEn: string;
};

const SLIDES: SlideDef[] = [
  // 1 — Odak (aurora): en güçlü görsel, ilk izlenim · secondary (violet). Derin odak HER ZAMAN koyu.
  { kind: 'focus', accentKey: 'violet', darkColors: ['#1a0b42', '#2f1280', '#140a30'], ebTr: 'TAZQ', ebEn: 'TAZQ', tTr: 'Odağını topla,\nhayatını dengele', tEn: 'Focus deeply,\nlive in balance', sTr: 'Pomodoro, ambiyans sesleri ve zen moduyla derin odaklan.', sEn: 'Deep focus with Pomodoro, ambient sounds and zen mode.' },
  // 2 — Dönemsel Modlar: ayrıştırıcı özellik · teal
  { kind: 'modes', accentKey: 'teal', darkColors: ['#062430', '#0c4258', '#051826'], ebTr: 'Dönemsel Modlar', ebEn: 'Life Modes', tTr: 'Dönemine özel\ngünlük plan', tEn: 'A daily plan\nfor your season', sTr: 'Sınav, spor, kariyer — planın her gün otomatik hazır.', sEn: 'Exams, fitness, career — your plan ready daily.' },
  // 3 — Görevler & Alışkanlıklar: günlük yürütme · indigo
  { kind: 'tasks', accentKey: 'indigo', darkColors: ['#0f1140', '#25297a', '#0b0d30'], ebTr: 'Görevler & Alışkanlıklar', ebEn: 'Tasks & Habits', tTr: 'Bugünün planı,\nalışkanlıkların', tEn: "Today's plan,\nyour habits", sTr: 'Görevlerini, alışkanlıklarını ve serilerini takip et.', sEn: 'Track your tasks, habits and streaks.' },
  // 4 — Momentum: ilerleme · emerald
  { kind: 'momentum', accentKey: 'emerald', darkColors: ['#06271f', '#0d4a3c', '#051c16'], ebTr: 'Momentum', ebEn: 'Momentum', tTr: 'İlerlemeni gör,\nmomentumu koru', tEn: 'See progress,\nkeep momentum', sTr: 'Haftalık odak istatistikleri ve momentum skorun.', sEn: 'Weekly focus stats and your momentum score.' },
  // 5 — Kokpit / Haftalık Karne: başarı & ilerleme · amber (ödül/karne tonu)
  { kind: 'cockpit', accentKey: 'amber', darkColors: ['#2a1a06', '#5c3c0f', '#1e1305'], ebTr: 'Kokpit · Haftalık', ebEn: 'Cockpit · Weekly', tTr: 'Haftanı\nkarneyle bitir', tEn: 'Close your week\nwith a report', sTr: 'Günlük tutarlılığını gör, haftalık karnenle ilerlemeni ölç.', sEn: 'See daily consistency and measure progress with a weekly report.' },
  // 6 — Ana ekran: genel bakış · primary (mavi, marka hero)
  { kind: 'home', accentKey: 'blue', darkColors: ['#08122f', '#123a86', '#070c26'], ebTr: 'Genel Bakış', ebEn: 'Overview', tTr: 'Her şey\ntek yerde', tEn: 'Everything\nin one place', sTr: 'Odak, plan ve alışkanlıklar — dengeli bir gün.', sEn: 'Focus, plans and habits — a balanced day.' },
  // 7 — Marka kapanışı · violet. Dramatik kapanış HER ZAMAN koyu.
  { kind: 'brand', accentKey: 'violet', darkColors: ['#1a0b42', '#2f1280', '#140a30'], ebTr: 'TAZQ', ebEn: 'TAZQ', tTr: 'Odaklan. İlerle.\nDengede kal.', tEn: 'Focus. Progress.\nStay balanced.', sTr: 'Üretkenliğin ve huzurun bir arada. Bugün başla.', sEn: 'Productivity and calm, together. Start today.' },
];

// Bu slaytın ARKA PLANI koyu mu? Odak ve marka her modda koyu (derin odak koyu ekran, kapanış dramatik).
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
  const N = NEUTRAL[mode];

  // Telefon çerçevesi ölçüsü
  let fh = H * 0.62;
  let fw = fh / 2.05;
  if (fw > W * 0.72) { fw = W * 0.72; fh = fw * 2.05; }
  const S = fw / 234; // ölçek (temel genişlik 234)

  // Şu an görünen slaytın alt kontrol (nokta/metin) rengi arka plana göre
  const pageDark = backdropIsDark(SLIDES[page]?.kind ?? 'focus', mode);

  // ── Temsili ekranlar (gerçek uygulamaya sadık) ───────────────────────────
  // deepMode: bu mock koyu mu render edilsin? Odak (derin odak) her zaman koyu; gerisi genel temaya uyar.
  const MockScreen: React.FC<{ kind: Kind; accent: string }> = ({ kind, accent }) => {
    const deepMode: Mode = (kind === 'focus' || kind === 'deepfocus') ? 'dark' : mode;
    const M = NEUTRAL[deepMode];
    // ── Altın-oran temelli ortak tasarım tokenları ──
    const PHI = 1.618;
    const u = 8 * S;                               // temel birim
    const pad = Math.round(u * PHI);               // ~13
    const gap = Math.round(u * 1.5);               // 12
    const rad = Math.round(u * 2);                 // 16
    const CARD = { backgroundColor: M.card, borderWidth: 1, borderColor: M.border, borderRadius: rad } as const;
    const LAB = { color: M.muted, fontWeight: '800' as const, letterSpacing: 1.2, fontSize: 9.5 * S };
    // Tip ölçeği (φ adımlı): cap · body · h1 · big
    const T = { cap: 10.5 * S, body: 12.5 * S, sub: 11 * S, h1: 20 * S, big: 30 * S };
    // Solid AppIcon imzası: dolu renkli kutu + beyaz glif (uygulamanın güncel ikon dili).
    const chip = (c: string, sz: number) => ({ width: sz, height: sz, borderRadius: Math.round(sz * 0.32), backgroundColor: c, alignItems: 'center' as const, justifyContent: 'center' as const });

    // Gerçek iOS ekran iskeleti: durum çubuğu (saat + sinyal/wifi/batarya) · başlık payı ·
    // içerik (flex) · alt sekme çubuğu · home göstergesi. Paylar tek birimden (u) türetilir ki
    // boşluk ritmi tutarlı olsun; mock telefonun tamamını gerçek bir ekran gibi doldurur.
    const NAV = [Home, ListChecks, Target, BarChart3, Dumbbell];
    const Screen: React.FC<{ active: number; children: React.ReactNode }> = ({ active, children }) => (
      <View style={{ flex: 1, backgroundColor: M.screen }}>
        {/* Durum çubuğu — çentiğin iki yanına saat ve sistem göstergeleri */}
        <View style={{ height: u * 4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: pad + u * 0.5 }}>
          <Text style={{ color: M.text, fontSize: 9.5 * S, fontWeight: '800', letterSpacing: 0.2 }}>9:41</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 * S }}>
            <SignalHigh size={11 * S} color={M.text} strokeWidth={2.4} />
            <Wifi size={11 * S} color={M.text} strokeWidth={2.4} />
            <BatteryFull size={13 * S} color={M.text} strokeWidth={2} />
          </View>
        </View>
        {/* İçerik — yatay pay + üst başlık payı; kartlar arası ritim = gap */}
        <View style={{ flex: 1, paddingHorizontal: pad, paddingTop: u * 0.75, gap: gap }}>{children}</View>
        {/* Alt sekme çubuğu + home göstergesi */}
        <View style={{ borderTopWidth: 1, borderTopColor: M.border, backgroundColor: M.card, paddingTop: u * 1.1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }}>
            {NAV.map((Ic, i) => (
              <Ic key={i} size={20 * S} color={i === active ? A.blue : M.muted} strokeWidth={i === active ? 2.6 : 2} />
            ))}
          </View>
          <View style={{ alignSelf: 'center', marginTop: u * 1, marginBottom: u * 0.7, width: fw * 0.32, height: 3.5 * S, borderRadius: 999, backgroundColor: M.text, opacity: 0.26 }} />
        </View>
      </View>
    );

    if (kind === 'focus' || kind === 'deepfocus') {
      // Gerçek derin-odak ekranı: TAM EKRAN aurora (Skia aurora estetiği) + minimal sayaç.
      // Eski "çerçeveli daire + çip sırası" düzeni değil — akış hâlinde sakin bir gökyüzü.
      const ring = fw * 0.62;
      return (
        <View style={{ flex: 1, backgroundColor: '#05060E', overflow: 'hidden' }}>
          {/* Aurora arka plan: geniş renk lekeleri → BlurView ile yumuşar (Skia aurora hissi) */}
          <View style={{ position: 'absolute', top: '-16%', left: '-30%', width: '108%', height: '56%', borderRadius: 999, backgroundColor: '#4F46E5', opacity: 0.5 }} />
          <View style={{ position: 'absolute', top: '20%', right: '-34%', width: '96%', height: '50%', borderRadius: 999, backgroundColor: '#2DD4BF', opacity: 0.32 }} />
          <View style={{ position: 'absolute', bottom: '-14%', left: '-18%', width: '108%', height: '54%', borderRadius: 999, backgroundColor: '#7C3AED', opacity: 0.44 }} />
          <View style={{ position: 'absolute', bottom: '4%', right: '-22%', width: '70%', height: '38%', borderRadius: 999, backgroundColor: '#DB2777', opacity: 0.24 }} />
          <BlurView intensity={75} tint="dark" style={StyleSheet.absoluteFill} />
          <LinearGradient colors={['rgba(5,6,14,0.55)', 'rgba(5,6,14,0.18)', 'rgba(5,6,14,0.7)']} style={StyleSheet.absoluteFill} />

          {/* Üst etiket — ekranın ne olduğu net olsun */}
          <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: T.sub, fontWeight: '700', letterSpacing: 2.5, textTransform: 'uppercase', textAlign: 'center', marginTop: u * 2.2 }}>{tr ? 'Derin Odak' : 'Deep Focus'}</Text>

          {/* Merkezde net bir sayaç HALKASI — "bu bir odak zamanlayıcısı" anında okunur */}
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: ring, height: ring, alignItems: 'center', justifyContent: 'center' }}>
              {/* taban halka */}
              <View style={{ position: 'absolute', width: ring, height: ring, borderRadius: ring / 2, borderWidth: 6 * S, borderColor: 'rgba(255,255,255,0.14)' }} />
              {/* ilerleme yayı (~70%): iki kenar renklendirip döndürerek */}
              <View style={{ position: 'absolute', width: ring, height: ring, borderRadius: ring / 2, borderWidth: 6 * S, borderColor: 'transparent', borderTopColor: '#8FA6FF', borderLeftColor: '#8FA6FF', borderBottomColor: '#8FA6FF', transform: [{ rotate: '135deg' }] }} />
              <Text style={{ color: '#FFFFFF', fontSize: ring * 0.24, fontWeight: '200', letterSpacing: -1.5, textShadowColor: 'rgba(150,180,255,0.55)', textShadowRadius: 20 }}>24:18</Text>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: T.cap, fontWeight: '600', letterSpacing: 1, marginTop: 2 * S }}>{tr ? 'KALAN' : 'REMAINING'}</Text>
            </View>
          </View>

          {/* Alt: seans + zen ipucu */}
          <View style={{ alignItems: 'center', gap: 6 * S, paddingBottom: u * 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 * S, backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: u * 1.4, paddingVertical: u * 0.7, borderRadius: 999 }}>
              <Moon size={13 * S} color="#C7D2FE" />
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: T.cap, fontWeight: '700' }}>{tr ? 'Zen Modu' : 'Zen Mode'}</Text>
            </View>
            <Text style={{ color: 'rgba(255,255,255,0.42)', fontSize: T.cap, fontWeight: '600' }}>{tr ? 'Sakinleşmek için çembere dokun' : 'Tap the ring to calm'}</Text>
          </View>
        </View>
      );
    }

    if (kind === 'modes') {
      const rows = [
        [GraduationCap, tr ? 'Sınav Modu' : 'Exam Mode', tr ? 'Günlük çalışma bloğu' : 'Daily study block', A.amber, '68%'],
        [Dumbbell, tr ? 'Spor Modu' : 'Fitness Mode', tr ? 'Antrenman & alışkanlık' : 'Workout & habit', A.orange, '41%'],
        [Briefcase, tr ? 'Kariyer Modu' : 'Career Mode', tr ? 'Hedef odaklı görevler' : 'Goal-focused tasks', A.indigo, '25%'],
      ];
      return (
        <Screen active={4}>
          <View style={{ marginTop: u * 0.5 }}>
            <Text style={{ color: M.text, fontSize: T.h1, fontWeight: '800', letterSpacing: -0.4 }}>{tr ? 'Dönemsel Modlar' : 'Life Modes'}</Text>
            <Text style={{ color: M.sub, fontSize: T.sub, marginTop: 3 * S }} numberOfLines={1}>{tr ? 'Dönemine özel günlük planın' : 'Your daily plan for the season'}</Text>
          </View>
          {rows.map(([Ic, name, sub, c, pct]: any) => (
            <View key={name} style={[CARD, { padding: pad, gap: u * 1.1 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: u * 1.25 }}>
                <View style={chip(c, 40 * S)}><Ic size={20 * S} color="#FFFFFF" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: M.text, fontWeight: '700', fontSize: T.body + 1 }} numberOfLines={1}>{name}</Text>
                  <Text style={{ color: M.sub, fontSize: T.cap, marginTop: 2 * S }} numberOfLines={1}>{sub}</Text>
                </View>
                <Text style={{ color: c, fontWeight: '800', fontSize: T.body }}>{pct}</Text>
              </View>
              <View style={{ height: 5 * S, backgroundColor: M.track, borderRadius: 3 }}>
                <View style={{ width: pct, height: '100%', backgroundColor: c, borderRadius: 3 }} />
              </View>
            </View>
          ))}
        </Screen>
      );
    }

    if (kind === 'tasks') {
      const tasks: [string, boolean][] = [
        [tr ? 'Sabah 25 dk derin odak' : 'Morning 25 min deep focus', true],
        [tr ? 'Proje sunumunu hazırla' : 'Prepare project deck', false],
        [tr ? 'Spor: 30 dk koşu' : 'Workout: 30 min run', false],
        [tr ? 'Akşam okuma alışkanlığı' : 'Evening reading habit', false],
      ];
      return (
        <Screen active={1}>
          <View style={{ marginTop: u * 0.5 }}>
            <Text style={LAB}>{tr ? 'BUGÜN · 6 TEMMUZ' : 'TODAY · JUL 6'}</Text>
            <Text style={{ color: M.text, fontSize: T.h1, fontWeight: '800', letterSpacing: -0.4, marginTop: 3 * S }}>{tr ? 'Günün Planı' : 'Your Day'}</Text>
          </View>
          <View style={[CARD, { paddingHorizontal: pad, paddingVertical: u * 0.3 }]}>
            {tasks.map(([t, done], i) => (
              <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: u * 1.25, paddingVertical: u, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: M.border }}>
                {done ? <CheckCircle2 size={20 * S} color={A.emerald} /> : <Circle size={20 * S} color={M.muted} />}
                <Text style={{ flex: 1, color: done ? M.muted : M.text, fontSize: T.body, fontWeight: '600', textDecorationLine: done ? 'line-through' : 'none' }} numberOfLines={1}>{t}</Text>
              </View>
            ))}
          </View>
          <Text style={[LAB, { marginTop: u * 0.25 }]}>{tr ? 'ALIŞKANLIKLAR' : 'HABITS'}</Text>
          <View style={{ flexDirection: 'row', gap: u * 1.1 }}>
            {[[tr ? 'Su iç' : 'Hydrate', '12', A.teal], [tr ? 'Meditasyon' : 'Meditate', '7', A.emerald]].map(([n, s]: any) => (
              <View key={n} style={[CARD, { flex: 1, padding: pad, gap: u * 0.75 }]}>
                <Text style={{ color: M.text, fontSize: T.body, fontWeight: '700' }} numberOfLines={1} adjustsFontSizeToFit>{n}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 * S }}>
                  <Flame size={14 * S} color={A.orange} />
                  <Text style={{ color: A.orange, fontSize: T.body, fontWeight: '800' }}>{s} {tr ? 'gün' : 'd'}</Text>
                </View>
              </View>
            ))}
          </View>
        </Screen>
      );
    }

    if (kind === 'momentum') {
      const bars = [0.4, 0.65, 0.5, 0.85, 0.7, 0.95, 0.6];
      const days = ['P', 'S', 'Ç', 'P', 'C', 'C', 'P'];
      return (
        <Screen active={3}>
          <Text style={{ color: M.text, fontSize: T.h1, fontWeight: '800', lineHeight: T.h1 * 1.3, letterSpacing: -0.4, marginTop: u * 0.5 }}>{tr ? 'Momentum' : 'Momentum'}</Text>
          <View style={[CARD, { padding: pad, flexDirection: 'row', alignItems: 'center', gap: pad }]}>
            <View style={{ width: 76 * S, height: 76 * S, borderRadius: 38 * S, borderWidth: 5 * S, borderColor: A.emerald, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: M.text, fontSize: T.big, fontWeight: '800', letterSpacing: -0.5 }}>84</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 * S }}>
                <TrendingUp size={15 * S} color={A.emerald} />
                <Text style={{ color: M.text, fontSize: T.body + 1, fontWeight: '700' }}>{tr ? 'Momentum skoru' : 'Momentum'}</Text>
              </View>
              <Text style={{ color: M.sub, fontSize: T.sub, marginTop: 4 * S }}>{tr ? 'Bu hafta 6.5 sa odak' : '6.5 h focused this week'}</Text>
            </View>
          </View>
          <View style={[CARD, { padding: pad, gap: gap }]}>
            <Text style={LAB}>{tr ? 'HAFTALIK ODAK' : 'WEEKLY FOCUS'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: u * 0.8, height: 62 * S }}>
              {bars.map((v, i) => (
                <View key={i} style={{ flex: 1, alignItems: 'center', gap: 5 * S }}>
                  <View style={{ width: '100%', height: 54 * S * v, backgroundColor: i === 5 ? A.emerald : A.emerald + '59', borderRadius: 4 }} />
                  <Text style={{ color: M.muted, fontSize: 8 * S, fontWeight: '700' }}>{days[i]}</Text>
                </View>
              ))}
            </View>
          </View>
        </Screen>
      );
    }

    if (kind === 'cockpit') {
      const stats: [string, string, any][] = [
        [tr ? 'Toplam Odak' : 'Total Focus', tr ? '9.5 sa' : '9.5 h', Target],
        [tr ? 'Tamamlanan' : 'Completed', tr ? '28 görev' : '28 tasks', CheckCircle2],
      ];
      return (
        <Screen active={3}>
          <View style={{ marginTop: u * 0.5 }}>
            <Text style={LAB}>{tr ? 'KOKPİT · HAFTALIK' : 'COCKPIT · WEEKLY'}</Text>
            <Text style={{ color: M.text, fontSize: T.h1, fontWeight: '800', letterSpacing: -0.4, marginTop: 3 * S }}>{tr ? 'Haftalık Karne' : 'Weekly Review'}</Text>
          </View>
          {/* Karne hero: kupa + hafta skoru + gün-gün tutarlılık */}
          <View style={[CARD, { padding: pad, alignItems: 'center', gap: u }]}>
            <View style={chip(A.amber, 46 * S)}><Trophy size={24 * S} color="#FFFFFF" /></View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 * S }}>
              <Text style={{ color: M.text, fontSize: T.big, fontWeight: '800', letterSpacing: -0.5 }}>92</Text>
              <Text style={{ color: M.sub, fontSize: T.body, fontWeight: '700' }}>/100</Text>
            </View>
            <Text style={{ color: A.amber, fontSize: T.sub, fontWeight: '700' }}>{tr ? 'Zirve haftası · +18%' : 'Peak week · +18%'}</Text>
            <View style={{ flexDirection: 'row', gap: 5 * S, marginTop: u * 0.4 }}>
              {[1, 1, 1, 1, 1, 0, 1].map((on, i) => (
                <View key={i} style={{ width: 7 * S, height: 7 * S, borderRadius: 999, backgroundColor: on ? A.amber : M.track }} />
              ))}
            </View>
          </View>
          {/* iki özet stat */}
          <View style={{ flexDirection: 'row', gap: gap }}>
            {stats.map(([l, v, Ic]) => (
              <View key={l} style={[CARD, { flex: 1, padding: pad, gap: u * 0.6 }]}>
                <Ic size={16 * S} color={A.amber} />
                <Text style={{ color: M.text, fontSize: T.body + 1, fontWeight: '800' }}>{v}</Text>
                <Text style={{ color: M.sub, fontSize: T.cap, fontWeight: '600' }} numberOfLines={1}>{l}</Text>
              </View>
            ))}
          </View>
        </Screen>
      );
    }

    // home
    return (
      <Screen active={0}>
        <View style={{ marginTop: u * 0.5 }}>
          <Text style={{ color: M.sub, fontSize: T.sub }}>{tr ? 'İyi akşamlar,' : 'Good evening,'}</Text>
          <Text style={{ color: M.text, fontSize: T.h1, fontWeight: '800', letterSpacing: -0.4 }}>{tr ? 'Deniz' : 'Alex'}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: u * 1.1 }}>
          {[[Target, tr ? 'Odak' : 'Focus', '1.5 sa', A.blue], [ListChecks, tr ? 'Görev' : 'Tasks', '3/5', A.emerald], [Flame, tr ? 'Seri' : 'Streak', '12', A.orange]].map(([Ic, l, v, c]: any) => (
            <View key={l} style={[CARD, { flex: 1, padding: pad, alignItems: 'center', gap: u * 0.75 }]}>
              <View style={chip(c, 34 * S)}><Ic size={17 * S} color="#FFFFFF" /></View>
              <Text style={{ color: M.text, fontSize: T.body + 2.5, fontWeight: '800', letterSpacing: -0.3 }}>{v}</Text>
              <Text style={{ color: M.sub, fontSize: 9.5 * S, fontWeight: '700' }}>{l}</Text>
            </View>
          ))}
        </View>
        <View style={{ backgroundColor: A.blue + (deepMode === 'dark' ? '24' : '18'), borderWidth: 1, borderColor: A.blue + '40', borderRadius: rad, padding: pad, gap: u * 0.75 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: u }}>
            <View style={chip(A.blue, 30 * S)}><Home size={15 * S} color="#FFFFFF" /></View>
            <Text style={{ color: M.text, fontSize: T.body + 1, fontWeight: '700' }}>{tr ? 'Bugünün önceliği' : "Today's priority"}</Text>
          </View>
          <Text style={{ color: M.sub, fontSize: T.body }} numberOfLines={1}>{tr ? 'Proje sunumunu hazırla' : 'Prepare project deck'}</Text>
        </View>
        <View style={[CARD, { padding: pad, flexDirection: 'row', alignItems: 'center', gap: u * 1.25 }]}>
          <View style={chip(A.teal, 30 * S)}><BarChart3 size={16 * S} color="#FFFFFF" /></View>
          <Text style={{ flex: 1, color: M.text, fontSize: T.body, fontWeight: '600' }} numberOfLines={1}>{tr ? 'Haftalık momentum: 84' : 'Weekly momentum: 84'}</Text>
          <TrendingUp size={15 * S} color={A.emerald} />
        </View>
      </Screen>
    );
  };

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
                          <MockScreen kind={slide.kind} accent={accent} />
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
