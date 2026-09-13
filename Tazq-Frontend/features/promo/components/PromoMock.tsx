import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppBlur } from '@/shared/components/AppBlur';
import { TazqLogo } from '@/shared/components/TazqLogo';
import { Colors } from '@/shared/constants/Colors';
import {
  Moon, GraduationCap, Dumbbell, Coins, BookOpen, CheckCircle2, Circle, Check,
  Flame, Trophy, Gauge, Plus, Clock, Zap, Target, SlidersHorizontal, Search,
  CalendarClock, ChevronRight, BarChart3, Info,
  // Alt sekme çubuğunun GERÇEK ikonları (bkz. BottomNavBar) — mock ile uygulama
  // arasındaki en görünür fark buydu: tanıtımda başka ikonlar duruyordu.
  LayoutGrid, CheckSquare, Sparkles, CalendarDays, Layers,
  Wifi, BatteryFull, SignalHigh,
} from 'lucide-react-native';

export type PromoMode = 'dark' | 'light';

// Vurgu tonları — her biri aydınlık/karanlık çift (uygulama paletiyle aynı: primary/secondary/
// tertiary/warning/streak + CategoryColors indigo/teal). Koyuda parlak, açıkta koyu → iki temada da
// beyaz-glif çipte ve kart üstü yazıda okunur.
export const ACCENTS = {
  dark:  { blue: '#0A84FF', violet: '#A78BFA', indigo: '#6366F1', teal: '#2DD4BF', emerald: '#34D399', amber: '#FBBF24', orange: '#FB923C' },
  light: { blue: '#0B6BCB', violet: '#7C3AED', indigo: '#4F46E5', teal: '#0D9488', emerald: '#047857', amber: '#B45309', orange: '#EA580C' },
} as const;
export type AccentKey = keyof typeof ACCENTS['dark'];

export type PromoKind = 'focus' | 'deepfocus' | 'modes' | 'tasks' | 'momentum' | 'cockpit' | 'home' | 'brand';

/*
  MOCK PALETİ UYDURULMAZ — UYGULAMANIN PALETİNDEN GELİR.

  Buradaki renkler bir zamanlar elle yazılmıştı (#0C0C12 / #F2F2F7) ve uygulamanın
  gerçek zeminlerinden (#09090B / #F4F4F5) farklıydı. Mağaza görselinde görülen ekranla
  indirdikten sonra görülen ekran aynı olmalı; tek tık fark bile "bu o uygulama değil"
  hissi bırakır. Artık tek kaynak `Colors`.
*/
const NEUTRAL = {
  dark: {
    screen: Colors.dark.background,
    // Kart zemini BentoCard'ın koyu tema kuralı: surfaceContainerHigh + hairline outline.
    card: Colors.dark.surfaceContainerHigh,
    cardLow: Colors.dark.surfaceContainerLow,
    sheet: Colors.dark.surfaceContainer,
    border: Colors.dark.outline,
    text: Colors.dark.onSurface,
    sub: Colors.dark.onSurfaceVariant,
    muted: Colors.dark.onSurfaceMuted,
    track: Colors.dark.surfaceContainerHighest,
    chrome: 'rgba(23,23,28,0.72)',
    pill: 'rgba(255,255,255,0.06)',
  },
  light: {
    screen: Colors.light.background,
    card: Colors.light.surfaceContainerLowest,
    cardLow: Colors.light.surfaceContainerLow,
    sheet: Colors.light.surfaceContainerLowest,
    /*
      AÇIK TEMADA KARTIN GERÇEKTE ÇERÇEVESİ YOK (beyaz kart / #F4F4F5 zemin; ayıran şey
      kontrast). Mock'ta yine de paletin kendi `outline` jetonu çiziliyor: telefon
      çerçevesi gerçek ekranın ~%60'ı ve mağaza görselleri JPEG sıkıştırmasından geçiyor —
      o iki aşamada %1.5'lik parlaklık farkı yok oluyor ve kartlar zemine yapışıyor.
      Yeni bir renk uydurulmuyor, uygulamanın kendi kenar jetonu kullanılıyor.
    */
    border: Colors.light.outline,
    text: Colors.light.onSurface,
    sub: Colors.light.onSurfaceVariant,
    muted: Colors.light.onSurfaceMuted,
    track: Colors.light.surfaceContainerHighest,
    chrome: 'rgba(255,255,255,0.78)',
    pill: 'rgba(0,0,0,0.04)',
  },
} as const;

/*
  MOCK METİNLERİ TEK SÖZLÜKTE — satır içi `tr ? ... : ...` ile değil.

  Uygulamanın kuralı bu (bkz. __tests__/i18nRatchet.test.ts) ve tanıtım ekranı istisna
  değil; aksine METNİN tamamı iki dilde tek tek gözden geçirilecek tek yer olduğu için
  sözlük burada daha da gerekli: TR ve EN karşılıkları yan yana duruyor, biri
  güncellenip öteki unutulamıyor. Sekme adları BottomNavBar'daki TAB_SHORT ile birebir
  aynı — mağaza görselindeki etiketle uygulamadaki etiket ayrışamaz.
*/
type MockCopy = {
  tabs: string[];
  dayInitial: string[];
  dayShort: string[];
  focusEyebrow: string; remaining: string; zen: string; zenHint: string;
  modesTitle: string; planEyebrow: string; planTasks: string; daysLeft: string;
  examName: string; examEyebrow: string;
  fitName: string; fitEyebrow: string;
  saveName: string; saveEyebrow: string;
  thesisName: string; thesisEyebrow: string;
  tasksTitle: string; filters: string[];
  taskRows: { title: string; time?: string; mode?: string; done?: boolean }[];
  nlpHint: string;
  insights: string; insightsSub: string; focusScore: string; focusEval: string;
  coachLabel: string; coachTip: string; momentum: string; goalLabel: string; weeklyFocus: string;
  weeklyTitle: string; weeklyRange: string; statFocus: string; statTasks: string;
  statHabits: string; peakWeek: string; habitsLabel: string; habits: string[];
  greeting: string; name: string; todayLabel: string; tasksDone: string;
  myDay: string; homeRows: string[];
};

const COPY: Record<'tr' | 'en', MockCopy> = {
  tr: {
    tabs: ['Ana Sayfa', 'Görevler', 'Odak', 'Haftalık', 'Modlar'],
    dayInitial: ['P', 'S', 'Ç', 'P', 'C', 'C', 'P'],
    dayShort: ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'],
    focusEyebrow: 'Derin Odak', remaining: 'KALAN', zen: 'Zen Modu',
    zenHint: 'Sakinleşmek için çembere dokun',
    modesTitle: 'Yaşam Modları', planEyebrow: 'BUGÜNKÜ PLANIN', planTasks: 'plan görevi', daysLeft: 'gün',
    examName: 'YKS 2027', examEyebrow: 'SINAV',
    fitName: 'Kilo Hedefi', fitEyebrow: 'SPOR',
    saveName: 'Acil Fon', saveEyebrow: 'TASARRUF',
    thesisName: 'Tez Takibi', thesisEyebrow: 'AKADEMİ',
    tasksTitle: 'Aksiyon Merkezi',
    filters: ['Tümü', 'Bugün', 'Yüksek'],
    taskRows: [
      { title: 'Toplantı notlarını yaz', time: 'Bugün 09:30', done: true },
      { title: 'Paragraf denemesi çöz', time: '2 saat kaldı', mode: 'YKS 2027' },
      { title: 'Proje sunumunu hazırla', time: 'Bugün 15:00' },
      { title: 'Spor: 30 dk koşu', mode: 'Kilo Hedefi' },
      { title: 'Akşam okuma alışkanlığı' },
    ],
    nlpHint: '“yarın 15:00 toplantı” yaz — tarihi, saati ve önceliği TAZQ anlar',
    insights: 'TAZQ INSIGHTS',
    insightsSub: 'Haftalık odaklanma ve alışkanlık gelişimi analitiği',
    focusScore: 'HAFTALIK ODAK SKORU',
    focusEval: 'Harika gidiyorsun — hafta boyunca düzenli odaklandın.',
    coachLabel: 'AKILLI ODAK ÖNERİSİ',
    coachTip: 'Sabahları tek bir 25 dakikalık blok, akşam üç kısa denemeden daha çok iş bitiriyor.',
    momentum: 'Momentum', goalLabel: 'Hedef', weeklyFocus: 'HAFTALIK ODAK',
    weeklyTitle: 'Haftalık Merkez', weeklyRange: '12 – 18 EYL',
    statFocus: 'Odak', statTasks: 'Görev', statHabits: 'Alışkanlık',
    peakWeek: 'Zirve haftası', habitsLabel: 'ALIŞKANLIKLAR',
    habits: ['Su iç', 'Meditasyon', 'Kitap oku'],
    greeting: 'İyi akşamlar,', name: 'Deniz', todayLabel: 'BUGÜN',
    tasksDone: 'görev tamamlandı', myDay: 'GÜNÜM',
    homeRows: ['Soru çöz: 40 dakika', 'Hata defterini gözden geçir', 'Akşam yürüyüşü'],
  },
  en: {
    tabs: ['Home', 'Tasks', 'Focus', 'Weekly', 'Modes'],
    dayInitial: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
    dayShort: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    focusEyebrow: 'Deep Focus', remaining: 'REMAINING', zen: 'Zen Mode',
    zenHint: 'Tap the ring to calm',
    modesTitle: 'Life Modes', planEyebrow: 'YOUR PLAN TODAY', planTasks: 'plan tasks', daysLeft: 'days',
    examName: 'Final Exams', examEyebrow: 'EXAM',
    fitName: 'Weight Goal', fitEyebrow: 'FITNESS',
    saveName: 'Emergency Fund', saveEyebrow: 'SAVINGS',
    thesisName: 'Thesis Tracker', thesisEyebrow: 'ACADEMIC',
    tasksTitle: 'Action Center',
    filters: ['All', 'Today', 'High'],
    taskRows: [
      { title: 'Write up meeting notes', time: 'Today 09:30', done: true },
      { title: 'Reading practice set', time: '2 hours left', mode: 'Final Exams' },
      { title: 'Prepare project deck', time: 'Today 15:00' },
      { title: 'Workout: 30 min run', mode: 'Weight Goal' },
      { title: 'Evening reading habit' },
    ],
    nlpHint: '“meeting tomorrow 3pm” — TAZQ reads the date, time and priority',
    insights: 'TAZQ INSIGHTS',
    insightsSub: 'Weekly focus and habit growth analytics',
    focusScore: 'WEEKLY FOCUS SCORE',
    focusEval: 'You are on a roll — steady focus all week long.',
    coachLabel: 'SMART FOCUS ADVICE',
    coachTip: 'One 25-minute block in the morning finishes more than three short evening attempts.',
    momentum: 'Momentum', goalLabel: 'Goal', weeklyFocus: 'WEEKLY FOCUS',
    weeklyTitle: 'Weekly Hub', weeklyRange: 'SEP 12 – 18',
    statFocus: 'Focus', statTasks: 'Tasks', statHabits: 'Habits',
    peakWeek: 'Peak week', habitsLabel: 'HABITS',
    habits: ['Hydrate', 'Meditate', 'Read'],
    greeting: 'Good evening,', name: 'Alex', todayLabel: 'TODAY',
    tasksDone: 'tasks completed', myDay: 'MY DAY',
    homeRows: ['Practice set: 40 minutes', 'Review the error log', 'Evening walk'],
  },
};

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
 * @param frameWidth Çerçevenin İÇ genişliği — halka/şerit gibi oransal ölçüler buradan.
 * @param scale      frameWidth / 393. Uygulama pt'sini mock pt'sine çeviren tek çarpan.
 */
export const PromoMock: React.FC<{
  kind: PromoKind;
  mode: PromoMode;
  lang: 'tr' | 'en';
  frameWidth: number;
  scale: number;
}> = ({ kind, mode, lang, frameWidth, scale }) => {
  const fw = frameWidth;
  const S = scale;
  const A = ACCENTS[mode];
  const deepMode: PromoMode = (kind === 'focus' || kind === 'deepfocus') ? 'dark' : mode;
  const M = NEUTRAL[deepMode];
  const PAL = deepMode === 'dark' ? Colors.dark : Colors.light;
  const c = COPY[lang];

  /** Uygulama pt'si → mock pt'si. TEK dönüşüm; oranlar burada korunur. */
  const px = (n: number) => n * S;

  // Güvenli alanlar: gerçek cihazın kendi payları (üstte Dynamic Island, altta çubuk).
  const TOP_INSET = px(59);
  const BOT_INSET = px(34);

  const EDGE = px(24);       // S.lg — sayfa kenarı
  const GAP = px(16);        // S.md — dikey ritim
  const RAD = px(12);        // R.md — kart
  const RAD_L = px(16);      // R.lg — görev kartı
  const BAR_H = px(44);      // TOP_BAR_HEIGHT
  const NAV_H = px(49);      // NAV_BAR_HEIGHT
  const NAV_INSET = px(16);  // NAV_BAR_SIDE_INSET
  const NAV_LIFT = px(8);    // NAV_BAR_LIFT
  const ITEM = px(32);       // TOP_ITEM_SIZE — başlıktaki yuvarlak düğme
  // Punto ölçeği doğrudan F jetonlarının sayısal karşılığı (caption 11 … display 28).
  const T = {
    cap: px(11), c2: px(12), foot: px(13), body: px(14), call: px(16),
    sub: px(17), t3: px(20), disp: px(28), metric: px(44),
  };

  const CARD = { backgroundColor: M.card, borderRadius: RAD, borderWidth: 1, borderColor: M.border } as const;
  const LAB = { color: M.muted, fontWeight: '500' as const, letterSpacing: 1.2, fontSize: T.cap };
  const row = { flexDirection: 'row' as const, alignItems: 'center' as const };
  /** Başlık çubuğundaki cam düğme kabuğu (bkz. ChromeShell). */
  const shell = { width: ITEM, height: ITEM, borderRadius: ITEM / 2, backgroundColor: M.chrome, borderWidth: 1, borderColor: M.border, alignItems: 'center' as const, justifyContent: 'center' as const };
  const Shl: React.FC<{ Ic: any }> = ({ Ic }) => (
    <View style={shell}><Ic size={px(20)} color={M.text} strokeWidth={2} /></View>
  );
  /** Görev/mod satırındaki küçük bilgi çipi (saat, mod adı). */
  const Pill: React.FC<{ Ic: any; label: string; color?: string; bg?: string }> = ({ Ic, label, color, bg }) => (
    <View style={[row, { gap: px(4), backgroundColor: bg ?? M.pill, borderRadius: px(8), paddingHorizontal: px(8), paddingVertical: px(3) }]}>
      <Ic size={px(12)} color={color ?? M.sub} />
      <Text style={{ color: color ?? M.sub, fontSize: T.cap, fontWeight: '600' }}>{label}</Text>
    </View>
  );

  const StatusRow = () => (
    <View style={[row, { height: TOP_INSET, justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: px(8), paddingHorizontal: px(30) }]}>
      <Text style={{ color: M.text, fontSize: T.call, fontWeight: '600', letterSpacing: -0.2 }}>9:41</Text>
      <View style={[row, { gap: px(5) }]}>
        <SignalHigh size={px(16)} color={M.text} strokeWidth={2.4} />
        <Wifi size={px(16)} color={M.text} strokeWidth={2.4} />
        <BatteryFull size={px(20)} color={M.text} strokeWidth={2} />
      </View>
    </View>
  );

  /** 44pt başlık: iki yanda 32pt kabuk, ortada 17pt başlık (+ isteğe bağlı alt satır). */
  const TopBar: React.FC<{ title?: string; sub?: string; center?: React.ReactNode; left?: React.ReactNode; right?: React.ReactNode }> =
    ({ title, sub: subtitle, center, left, right }) => (
      <View style={[row, { height: BAR_H, paddingHorizontal: EDGE }]}>
        <View style={[row, { width: ITEM * 2.3, gap: px(8) }]}>{left}</View>
        <View style={{ flex: 1, alignItems: 'center' }}>
          {center ?? (
            <>
              {!!title && <Text numberOfLines={1} style={{ color: M.text, fontSize: T.sub, fontWeight: '600', letterSpacing: -0.3 }}>{title}</Text>}
              {/* Alt satır vurgu renginde — kokpitin tarih aralığı gerçekte de böyle. */}
              {!!subtitle && <Text style={{ color: PAL.primary, fontSize: T.cap, fontWeight: '600', letterSpacing: 0.6 }}>{subtitle}</Text>}
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
      <View style={[row, { position: 'absolute', left: NAV_INSET, right: NAV_INSET, bottom: BOT_INSET + NAV_LIFT, height: NAV_H, borderRadius: 999, backgroundColor: M.chrome, borderWidth: 1, borderColor: M.border, paddingHorizontal: px(6) }]}>
        {TAB_ICONS.map((Ic, i) => (
          <View key={c.tabs[i]} style={{ flex: 1, alignItems: 'center', gap: px(2) }}>
            <Ic size={px(22)} color={i === active ? PAL.primary : M.sub} strokeWidth={i === active ? 2.1 : 1.8} />
            <Text numberOfLines={1} style={{ fontSize: px(10), fontWeight: '600', color: i === active ? PAL.primary : M.sub }}>
              {c.tabs[i]}
            </Text>
          </View>
        ))}
      </View>
      {/* Sistemin kendi ana ekran göstergesi — uygulamanın değil, cihazın parçası. */}
      <View style={{ position: 'absolute', alignSelf: 'center', bottom: px(9), width: px(140), height: px(5), borderRadius: 999, backgroundColor: M.text, opacity: 0.3 }} />
    </>
  );

  /*
    FAB 54pt (FAB_SIZE) ve kapsülün ÜSTÜNDE duruyor. İkon ekrana göre değişiyor: ana
    sayfada Zap (hızlı taslak yakalama), Görevler'de Plus (yapılandırılmış ekleme).
    Aynı ekranda iki "+" olmasın diye ayrılmışlardı; mock da o ayrımı koruyor.
  */
  const Fab: React.FC<{ Ic: any }> = ({ Ic }) => (
    <View style={{ position: 'absolute', right: EDGE, bottom: BOT_INSET + NAV_LIFT + NAV_H + px(16), width: px(54), height: px(54), borderRadius: px(27), backgroundColor: PAL.primary, alignItems: 'center', justifyContent: 'center' }}>
      <Ic size={px(24)} color={PAL.onPrimary} strokeWidth={2.5} fill={Ic === Zap ? PAL.onPrimary : 'transparent'} />
    </View>
  );

  const Shell: React.FC<{
    active: number; title?: string; sub?: string; center?: React.ReactNode;
    left?: React.ReactNode; right?: React.ReactNode; fab?: any; children: React.ReactNode;
  }> = ({ active, title, sub: subtitle, center, left, right, fab, children }) => (
    <View style={{ flex: 1, backgroundColor: M.screen }}>
      <StatusRow />
      <TopBar title={title} sub={subtitle} center={center} left={left} right={right} />
      <View style={{ flex: 1, paddingHorizontal: EDGE, paddingTop: px(20), gap: GAP }}>{children}</View>
      <View style={{ height: BOT_INSET + NAV_LIFT + NAV_H }} />
      <TabBar active={active} />
      {fab && <Fab Ic={fab} />}
    </View>
  );

  /** Ana sayfanın sol üstü: 32pt avatar, hairline halka (bkz. index.tsx notu). */
  const Avatar = () => (
    <View style={{ width: ITEM, height: ITEM, borderRadius: ITEM / 2, backgroundColor: PAL.primary + '22', borderWidth: 1, borderColor: M.border, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: PAL.primary, fontSize: T.body, fontWeight: '700' }}>{c.name.slice(0, 1)}</Text>
    </View>
  );

  if (kind === 'focus' || kind === 'deepfocus') {
    /*
      Derin odak: TAM EKRAN aurora + minimal sayaç — ekranın gerçek hâli. Sekme çubuğu
      YOK, çünkü gerçek odak ekranında da yok: dikkat dağıtacak her şey kalkıyor,
      geriye sayaç kalıyor.
    */
    const ring = fw * 0.62;
    return (
      <View style={{ flex: 1, backgroundColor: '#05060E', overflow: 'hidden' }}>
        <View style={{ position: 'absolute', top: '-16%', left: '-30%', width: '108%', height: '56%', borderRadius: 999, backgroundColor: '#4F46E5', opacity: 0.5 }} />
        <View style={{ position: 'absolute', top: '20%', right: '-34%', width: '96%', height: '50%', borderRadius: 999, backgroundColor: '#2DD4BF', opacity: 0.32 }} />
        <View style={{ position: 'absolute', bottom: '-14%', left: '-18%', width: '108%', height: '54%', borderRadius: 999, backgroundColor: '#7C3AED', opacity: 0.44 }} />
        <View style={{ position: 'absolute', bottom: '4%', right: '-22%', width: '70%', height: '38%', borderRadius: 999, backgroundColor: '#DB2777', opacity: 0.24 }} />
        <AppBlur material="thick" tint="dark" />
        <LinearGradient colors={['rgba(5,6,14,0.55)', 'rgba(5,6,14,0.18)', 'rgba(5,6,14,0.7)']} style={StyleSheet.absoluteFill} />

        <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: T.foot, fontWeight: '700', letterSpacing: 2.5, textTransform: 'uppercase', textAlign: 'center', marginTop: TOP_INSET + px(24) }}>
          {c.focusEyebrow}
        </Text>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: ring, height: ring, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ position: 'absolute', width: ring, height: ring, borderRadius: ring / 2, borderWidth: px(8), borderColor: 'rgba(255,255,255,0.14)' }} />
            <View style={{ position: 'absolute', width: ring, height: ring, borderRadius: ring / 2, borderWidth: px(8), borderColor: 'transparent', borderTopColor: '#8FA6FF', borderLeftColor: '#8FA6FF', borderBottomColor: '#8FA6FF', transform: [{ rotate: '135deg' }] }} />
            <Text style={{ color: '#FFFFFF', fontSize: ring * 0.24, fontWeight: '200', letterSpacing: -1.5, textShadowColor: 'rgba(150,180,255,0.55)', textShadowRadius: 20 }}>24:18</Text>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: T.cap, fontWeight: '600', letterSpacing: 1, marginTop: px(4) }}>{c.remaining}</Text>
          </View>
        </View>

        <View style={{ alignItems: 'center', gap: px(10), paddingBottom: BOT_INSET + px(28) }}>
          <View style={[row, { gap: px(6), backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: px(16), paddingVertical: px(8), borderRadius: 999 }]}>
            <Moon size={px(14)} color="#C7D2FE" />
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: T.c2, fontWeight: '700' }}>{c.zen}</Text>
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.42)', fontSize: T.cap, fontWeight: '600' }}>{c.zenHint}</Text>
        </View>
      </View>
    );
  }

  /*
    DÖNEM KARTI — ana sayfanın ve Modlar ekranının ortak yüzeyi (bkz. ModeTodayCard).
    İkon kabı dolu renkli kutu DEĞİL: `renk + '22'` zemin ve AYNI rengin glifi. Sağda
    geri sayım rozeti, altta durum satırı + ilerleme çubuğu.
  */
  const ModeCard: React.FC<{ Ic: any; name: string; eyebrow: string; color: string; days: string; done: number; total: number }> =
    ({ Ic, name, eyebrow, color, days, done, total }) => (
      <View style={[CARD, { padding: px(16), gap: px(12) }]}>
        <View style={[row, { gap: px(12) }]}>
          <View style={{ width: px(40), height: px(40), borderRadius: RAD, backgroundColor: color + '22', alignItems: 'center', justifyContent: 'center' }}>
            <Ic size={px(20)} color={color} strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ color, fontSize: T.cap, fontWeight: '700', letterSpacing: 0.4 }}>{eyebrow}</Text>
            <Text numberOfLines={1} style={{ color: M.text, fontSize: T.sub, fontWeight: '700', letterSpacing: -0.3 }}>{name}</Text>
          </View>
          <Pill Ic={CalendarClock} label={`${days} ${c.daysLeft}`} color={color} bg={color + '18'} />
          <ChevronRight size={px(16)} color={M.sub} />
        </View>
        <View style={{ gap: px(6) }}>
          <Text style={{ color: M.sub, fontSize: T.c2, fontWeight: '600' }}>{done}/{total} {c.planTasks}</Text>
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
        <ModeCard Ic={GraduationCap} name={c.examName} eyebrow={c.examEyebrow} color={A.teal} days="86" done={2} total={4} />
        <ModeCard Ic={Dumbbell} name={c.fitName} eyebrow={c.fitEyebrow} color={A.orange} days="34" done={1} total={2} />
        <ModeCard Ic={Coins} name={c.saveName} eyebrow={c.saveEyebrow} color={A.amber} days="63" done={1} total={1} />
        <ModeCard Ic={BookOpen} name={c.thesisName} eyebrow={c.thesisEyebrow} color={A.indigo} days="112" done={1} total={3} />
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
              <Text style={{ color: i === 0 ? PAL.onPrimary : M.sub, fontSize: T.c2, fontWeight: '600' }}>{f}</Text>
            </View>
          ))}
        </View>

        {/*
          HER GÖREV AYRI BİR KART (R.lg, 16pt iç pay, 8pt aralık) ve solunda 4pt'lik
          öncelik şeridi var — gerçek listede de böyle, tek bir kutunun içine dizilmiş
          satırlar değil.
        */}
        <View style={{ gap: px(8) }}>
          {c.taskRows.map((t2, i) => {
            const pri = [PAL.error, A.orange, PAL.primary, A.teal, M.track][i];
            const meta = !!t2.time || !!t2.mode;
            return (
              <View key={t2.title} style={[row, { backgroundColor: M.card, borderRadius: RAD_L, borderWidth: 1, borderColor: t2.mode ? A.teal + '40' : M.border, padding: px(16), gap: px(10) }]}>
                <View style={{ width: px(4), alignSelf: 'stretch', minHeight: px(32), borderRadius: px(8), backgroundColor: pri, opacity: t2.done ? 0.3 : 1 }} />
                <View style={{ flex: 1, gap: meta ? px(6) : 0 }}>
                  <Text numberOfLines={1} style={{ color: M.text, fontSize: T.body, fontWeight: '600', opacity: t2.done ? 0.4 : 1, textDecorationLine: t2.done ? 'line-through' : 'none' }}>{t2.title}</Text>
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
        </View>

        {/* Ekranın vaadi: doğal dille yazınca tarih/saat/öncelik kendiliğinden çıkıyor. */}
        <View style={[CARD, row, { padding: px(14), gap: px(12) }]}>
          <View style={{ width: px(32), height: px(32), borderRadius: px(10), backgroundColor: A.teal + '22', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={px(16)} color={A.teal} strokeWidth={2} />
          </View>
          <Text numberOfLines={2} style={{ flex: 1, color: M.sub, fontSize: T.c2, fontWeight: '600', lineHeight: T.c2 * 1.4 }}>{c.nlpHint}</Text>
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
            <Text style={{ color: M.muted, fontSize: T.cap, fontWeight: '600' }}>{c.dayInitial[i]}</Text>
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
        <View style={{ paddingHorizontal: EDGE, paddingTop: px(20), gap: GAP }}>
          <View>
            <Text style={{ color: M.sub, fontSize: T.call, fontWeight: '600' }}>{c.greeting}</Text>
            <Text style={{ color: M.text, fontSize: T.disp, fontWeight: '600', letterSpacing: -0.8 }}>{c.name}</Text>
          </View>
          <ModeCard Ic={GraduationCap} name={c.examName} eyebrow={c.planEyebrow} color={A.teal} days="86" done={2} total={4} />
        </View>

        {/* Karartma: sayfa açıkken arkadaki ekran geri çekiliyor. */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' }} />

        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: '26%', backgroundColor: M.sheet, borderTopLeftRadius: px(22), borderTopRightRadius: px(22), borderWidth: 1, borderColor: M.border, paddingHorizontal: px(20), paddingTop: px(10) }}>
          <View style={{ alignSelf: 'center', width: px(40), height: px(5), borderRadius: 999, backgroundColor: M.track }} />

          <View style={{ alignItems: 'center', marginTop: px(14), marginBottom: GAP }}>
            <Text style={{ color: M.sub, fontSize: T.foot, fontWeight: '700', letterSpacing: 1.4 }}>{c.insights}</Text>
            <Text numberOfLines={1} style={{ color: M.muted, fontSize: T.cap, fontWeight: '600', marginTop: px(3) }}>{c.insightsSub}</Text>
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
                <Text style={{ color: M.text, fontSize: T.call, fontWeight: '700' }}>%84</Text>
              </View>
              <View style={{ flex: 1, gap: px(6) }}>
                <Text style={{ color: M.muted, fontSize: T.cap, fontWeight: '700', letterSpacing: 0.8 }}>{c.focusScore}</Text>
                <Text numberOfLines={3} style={{ color: M.text, fontSize: T.c2, fontWeight: '600', lineHeight: T.c2 * 1.4 }}>{c.focusEval}</Text>
              </View>
            </LinearGradient>
          </View>

          {/* Koç kartı: italik tek cümle — uygulamadaki hâliyle aynı. */}
          <View style={{ marginTop: GAP, borderRadius: px(16), borderWidth: 1, borderColor: M.border, padding: px(16), gap: px(10) }}>
            <View style={[row, { gap: px(8) }]}>
              <View style={{ width: px(6), height: px(6), borderRadius: 999, backgroundColor: PAL.success }} />
              <Text style={{ color: PAL.primary, fontSize: T.cap, fontWeight: '700', letterSpacing: 0.8 }}>{c.coachLabel}</Text>
            </View>
            <Text numberOfLines={3} style={{ color: M.text, fontSize: T.foot, fontWeight: '500', fontStyle: 'italic', lineHeight: T.foot * 1.45 }}>“{c.coachTip}”</Text>
          </View>

          <View style={{ marginTop: GAP, gap: px(10) }}>
            <Text style={LAB}>{c.weeklyFocus}</Text>
            <FocusChart color={PAL.primary} />
          </View>

          {/* İki metrik kutusu — ivme ve günün hedefi. */}
          <View style={[row, { marginTop: GAP, gap: px(12) }]}>
            <View style={{ flex: 1, borderRadius: RAD, backgroundColor: M.cardLow, padding: px(14), gap: px(6) }}>
              <Zap size={px(16)} color={PAL.success} fill={PAL.success} />
              <Text style={{ color: M.text, fontSize: T.t3, fontWeight: '600', letterSpacing: -0.5 }}>%84</Text>
              <Text style={{ color: M.muted, fontSize: T.cap, fontWeight: '600' }}>{c.momentum}</Text>
            </View>
            <View style={{ flex: 1, borderRadius: RAD, backgroundColor: M.cardLow, padding: px(14), gap: px(6) }}>
              <Target size={px(16)} color={PAL.secondary} />
              <Text style={{ color: M.text, fontSize: T.t3, fontWeight: '600', letterSpacing: -0.5 }}>4/5</Text>
              <Text style={{ color: M.muted, fontSize: T.cap, fontWeight: '600' }}>{c.goalLabel}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  if (kind === 'cockpit') {
    const stats: [string, string, any][] = [
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
              <Text style={{ color: i === 4 ? PAL.onPrimary : M.muted, fontSize: px(10), fontWeight: '600' }}>{d2.slice(0, 1)}</Text>
              <Text style={{ color: i === 4 ? PAL.onPrimary : M.text, fontSize: T.c2, fontWeight: '700' }}>{12 + i}</Text>
            </View>
          ))}
        </View>

        <View style={[row, { gap: px(12) }]}>
          {stats.map(([l, v, Ic]) => (
            <View key={l} style={[CARD, { flex: 1, padding: px(14), gap: px(6) }]}>
              <Ic size={px(16)} color={A.amber} strokeWidth={2} />
              <Text style={{ color: M.text, fontSize: T.t3, fontWeight: '600', letterSpacing: -0.4 }}>{v}</Text>
              <Text numberOfLines={1} style={{ color: M.muted, fontSize: T.cap, fontWeight: '600' }}>{l}</Text>
            </View>
          ))}
        </View>

        <View style={[CARD, { padding: px(16), gap: px(12) }]}>
          <View style={[row, { justifyContent: 'space-between' }]}>
            <Text style={LAB}>{c.weeklyFocus}</Text>
            <View style={[row, { gap: px(5) }]}>
              <Trophy size={px(14)} color={A.amber} />
              <Text style={{ color: A.amber, fontSize: T.cap, fontWeight: '700' }}>{c.peakWeek} · +18%</Text>
            </View>
          </View>
          <FocusChart color={A.amber} />
        </View>

        {/* Alışkanlık şeridi — kokpitin ikinci yarısı. */}
        <View style={[CARD, { padding: px(16), gap: px(12) }]}>
          <Text style={LAB}>{c.habitsLabel}</Text>
          {c.habits.map((h, i) => (
            <View key={h} style={[row, { gap: px(10) }]}>
              <View style={{ width: px(28), height: px(28), borderRadius: px(9), backgroundColor: [A.teal, A.violet, A.emerald][i] + '22', alignItems: 'center', justifyContent: 'center' }}>
                <Flame size={px(14)} color={[A.teal, A.violet, A.emerald][i]} />
              </View>
              <Text numberOfLines={1} style={{ flex: 1, color: M.text, fontSize: T.body, fontWeight: '600' }}>{h}</Text>
              <View style={[row, { gap: px(4) }]}>
                {[1, 1, 1, 0, 1, 1, i === 0 ? 1 : 0].map((on, k) => (
                  <View key={k} style={{ width: px(7), height: px(7), borderRadius: 999, backgroundColor: on ? PAL.success : M.track }} />
                ))}
              </View>
            </View>
          ))}
        </View>
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
        <Text style={{ color: M.sub, fontSize: T.call, fontWeight: '600' }}>{c.greeting}</Text>
        <Text style={{ color: M.text, fontSize: T.disp, fontWeight: '600', letterSpacing: -0.8 }}>{c.name}</Text>
      </View>

      <ModeCard Ic={GraduationCap} name={c.examName} eyebrow={c.planEyebrow} color={A.teal} days="86" done={2} total={4} />

      {/* "Bugün" kartı: solda sayısal özet, sağda 90pt ilerleme halkası. */}
      <View style={[CARD, row, { padding: px(20), gap: px(20) }]}>
        <View style={{ flex: 1, gap: px(8) }}>
          <Text style={LAB}>{c.todayLabel}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: px(4) }}>
            <Text style={{ color: M.text, fontSize: T.metric, fontWeight: '600', letterSpacing: -1.6 }}>3</Text>
            <Text style={{ color: M.muted, fontSize: T.sub, fontWeight: '600' }}>/5</Text>
          </View>
          <Text style={{ color: M.muted, fontSize: T.cap, fontWeight: '600' }}>{c.tasksDone}</Text>
          <View style={[row, { gap: px(5) }]}>
            <Zap size={px(12)} color={PAL.primary} fill={PAL.primary} />
            <View style={{ flex: 1, height: px(3), borderRadius: px(4), backgroundColor: M.track, overflow: 'hidden' }}>
              <View style={{ width: '75%', height: '100%', borderRadius: px(4), backgroundColor: PAL.primary }} />
            </View>
            <Text style={{ color: M.muted, fontSize: T.cap, fontWeight: '600' }}>45/60</Text>
          </View>
        </View>

        <View style={{ width: ringT, height: ringT, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ position: 'absolute', width: ringT, height: ringT, borderRadius: ringT / 2, borderWidth: px(13), borderColor: PAL.primary + '26' }} />
          <View style={{ position: 'absolute', width: ringT, height: ringT, borderRadius: ringT / 2, borderWidth: px(13), borderColor: 'transparent', borderTopColor: PAL.primary, borderRightColor: PAL.primary, transform: [{ rotate: '36deg' }] }} />
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text style={{ color: M.text, fontSize: T.t3, fontWeight: '600', letterSpacing: -0.6 }}>60</Text>
            <Text style={{ color: M.muted, fontSize: T.cap, fontWeight: '600' }}>%</Text>
          </View>
        </View>
      </View>

      {/* Günüm: bugünün işleri tek kartta. */}
      <View style={[CARD, { paddingHorizontal: px(20), paddingVertical: px(6) }]}>
        <Text style={[LAB, { marginTop: px(12), marginBottom: px(4) }]}>{c.myDay}</Text>
        {c.homeRows.map((title, i) => {
          const done = i === 1;
          return (
            <View key={title} style={[row, { gap: px(12), paddingVertical: px(12), borderTopWidth: i > 0 ? 1 : 0, borderTopColor: M.border }]}>
              {done ? <CheckCircle2 size={px(22)} color={PAL.success} /> : <Circle size={px(22)} color={M.muted} />}
              <Text numberOfLines={1} style={{ flex: 1, color: done ? M.muted : M.text, fontSize: T.body, fontWeight: '600', textDecorationLine: done ? 'line-through' : 'none' }}>{title}</Text>
              {i === 0 && <Flame size={px(15)} color={A.orange} />}
            </View>
          );
        })}
      </View>
    </Shell>
  );
};
