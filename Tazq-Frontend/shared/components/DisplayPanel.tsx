import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle, type TextStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { DisplayColors } from '@/shared/constants/Colors';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { S, R, F, W } from '@/shared/constants/tokens';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { upperFor } from '@/shared/utils/localeCase';
import { AnimatedNumber } from '@/shared/components/AnimatedNumber';

/*
  DİJİTAL PANEL — uygulamanın özet/sayı yüzeylerinin ortak dili (2026-10-30).

  Kullanıcı: "dijital ekran gibi olsa, çok rahatsız etmeden premium hissini versek, hem daha
  derli toplu UI". İlk sürüm yalnız "tek koyu kutu" idi ("aydınlık temada karanlık oldu?",
  "tek kutuya aldın sadece, bu nasıl ekran?"). Şimdiki dil bir KULLANICI gözüyle seçilen hibrit:
   · GÖMÜLÜ EKRAN: panel sayfaya gömülü bir cihaz ekranı — üst kenardan içe gölge (derinlik),
     alt kenarda ince ışık, 1px çerçeve. Temaya uyar: açıkta soluk cam, koyuda koyu cam.
   · DURUM ŞERİDİ: en üstte gün · tarih · CANLI saat (dakikada bir). Ekran hissini en çok
     bu verir: panel bir kart değil, "açık duran" bir ekran.
   · OKUMALAR: araç göstergesi gibi — küçük büyük-harf etiket, altında sabit genişlikli rakam
     (JetBrains Mono): sayılar değişirken satır oynamaz.
  Referans: react-native-skia örnekleri (FrostedCard/LiquidGlass). Tarama çizgili CRT (Severance)
  BİLEREK alınmadı: oyuncak durur, göz yorar. Statik: animasyon/Skia yok (saat hariç, dakikada 1).
*/

export const DISPLAY_FONT = { digits: 'Mono-SemiBold', digitsLight: 'Mono-Medium' } as const;

/** Aktif temanın panel paleti. */
export function useDisplayColors() {
  const { isDark } = useAppTheme();
  return isDark ? DisplayColors.dark : DisplayColors.light;
}

interface PanelProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: number;
  /** Arka ışığın tonu (çok hafif) — genelde temanın birincil rengi. */
  glow?: string;
}

export function DisplayPanel({ children, style, padding = S.lg, glow }: PanelProps) {
  const { theme, isDark } = useAppTheme();
  const c = isDark ? DisplayColors.dark : DisplayColors.light;
  const tint = glow ?? theme.primary;
  return (
    <View style={[styles.panel, { borderColor: c.bezel }, style]}>
      <LinearGradient colors={c.bg as unknown as [string, string]} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={[tint + (isDark ? '1A' : '0D'), tint + '00']} start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 0.6 }} style={StyleSheet.absoluteFill} />
      {/* Gömülü ekran: üstten içe düşen gölge + alt kenarda ışık çizgisi. */}
      <LinearGradient colors={[c.inset, 'rgba(0,0,0,0)']} style={styles.inset} />
      <View style={[styles.lip, { backgroundColor: c.lip }]} />
      <View style={{ padding }}>{children}</View>
    </View>
  );
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Saati dakika başında tazeler (saniyelik çizim yok). */
function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let iv: ReturnType<typeof setInterval> | null = null;
    const first = setTimeout(() => {
      setNow(new Date());
      iv = setInterval(() => setNow(new Date()), 60_000);
    }, (60 - new Date().getSeconds()) * 1000);
    return () => { clearTimeout(first); if (iv) clearInterval(iv); };
  }, []);
  return now;
}

/*
  AÇILIŞ SELAMI — ayrı bir "Günaydın, Melih" bloğu ekranın tepesinde ~110 pt tutuyor ve hiçbir
  şey söylemiyordu (kullanıcı: "hem statik hem çok yer yiyor"). Artık selam, ekranın durum
  şeridinde açılışta birkaç saniye durup tarih · saate dönüşür: cihaz açılırken seni karşılar,
  sonra işine döner. Uygulama oturumu başına BİR kez (her sekme dönüşünde tekrar etmez).
  Geçiş OPAKLIKLA DEĞİL, yalnız kaymayla: görünmezken kurulan ekranda opaklık animasyonu
  takılıp metni boş bırakıyordu (bkz. authNavigation.test "selamlama bir animasyona bağlı değil").
*/
const INTRO_MS = 4000;
let introPlayed = false;

function useIntro(intro?: string): boolean {
  const [on, setOn] = useState(() => !!intro && !introPlayed);
  useEffect(() => {
    if (!on) return;
    introPlayed = true;
    const t = setTimeout(() => setOn(false), INTRO_MS);
    return () => clearTimeout(t);
  }, [on]);
  return on;
}

/**
 * Ekranın durum şeridi: GÜN · TARİH (solda) — canlı SAAT (sağda).
 * `date` verilirse o günü gösterir (geçmişe kaydırılmış ekran); `right` saatin yerine geçer.
 * `intro`: açılışta birkaç saniye gösterilen selam (oturumda bir kez).
 */
export function DisplayStatus({ label, date, right, intro }: { label?: string; date?: Date; right?: React.ReactNode; intro?: string }) {
  const c = useDisplayColors();
  const language = useLanguageStore(st => st.language);
  const now = useMinuteClock();
  const showIntro = useIntro(intro);
  const locale = language === 'en' ? 'en-US' : 'tr-TR';
  const day = (date ?? now).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  if (showIntro && intro && !date) {
    return (
      <MotiView key="intro" from={{ translateY: 4 }} animate={{ translateY: 0 }} transition={{ type: 'timing', duration: 360 }} style={styles.status}>
        <Text style={[styles.intro, { color: c.ink }]} numberOfLines={1}>{intro}</Text>
      </MotiView>
    );
  }
  return (
    <MotiView key="status" from={{ translateY: 4 }} animate={{ translateY: 0 }} transition={{ type: 'timing', duration: 360 }} style={styles.status}>
      <Text style={[styles.statusText, { color: c.label }]} numberOfLines={1}>
        {upperFor(label ? `${label} · ${day}` : day, language)}
      </Text>
      {right ?? <Text style={[styles.clock, { color: c.muted }]}>{`${pad2(now.getHours())}:${pad2(now.getMinutes())}`}</Text>}
    </MotiView>
  );
}

/** Panel içi ayraç. */
export function DisplayDivider({ spacing = S.md }: { spacing?: number }) {
  const c = useDisplayColors();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.divider, marginVertical: spacing }} />;
}

/** Gösterge okuması: küçük büyük-harf etiket + sabit genişlikli değer. */
export function DisplayReadout({ label, value, accent, style }: { label: string; value: string; accent?: string; style?: StyleProp<TextStyle> }) {
  const c = useDisplayColors();
  const language = useLanguageStore(st => st.language);
  const lead = /^(\d+)(.*)$/.exec(value);
  return (
    <View>
      <Text style={[styles.readLabel, { color: c.label }]} numberOfLines={1}>{upperFor(label, language)}</Text>
      <Text style={[styles.readValue, { color: accent ?? c.ink }, style]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
        {/* Baştaki sayı SAYARAK değişir (bir şey tamamlanınca ne değiştiği görülür); kalanı düz metin. */}
        {lead ? <AnimatedNumber value={Number(lead[1])} duration={450} style={[styles.readValue, { color: accent ?? c.ink }, style]} /> : value}
        {lead ? lead[2] : null}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderRadius: R.lg, overflow: 'hidden', borderWidth: 1 },
  inset: { position: 'absolute', top: 0, left: 0, right: 0, height: 10 },
  lip: { position: 'absolute', bottom: 0, left: S.md, right: S.md, height: 1 },
  status: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: S.sm, marginBottom: S.md },
  intro: { flexShrink: 1, fontSize: F.callout, fontWeight: W.semibold },
  statusText: { flexShrink: 1, fontSize: F.caption, fontWeight: W.semibold, letterSpacing: 1.2 },
  clock: { fontFamily: DISPLAY_FONT.digits, fontSize: F.footnote, letterSpacing: 0.5, fontVariant: ['tabular-nums'] },
  readLabel: { fontSize: F.caption2, fontWeight: W.semibold, letterSpacing: 1.1 },
  readValue: { fontFamily: DISPLAY_FONT.digits, fontSize: F.title3, letterSpacing: -0.3, fontVariant: ['tabular-nums'], marginTop: S.xxs },
});
