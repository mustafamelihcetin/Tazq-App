import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle, type TextStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { S, R, F, W, B } from '@/shared/constants/tokens';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { upperFor } from '@/shared/utils/localeCase';
import { AnimatedNumber } from '@/shared/components/AnimatedNumber';
import { useMinuteClock } from '@/shared/hooks/useMinuteClock';

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
  ZEMİN KARTLARLA AYNI (kullanıcı: "diğer kutularla uyumlu değil arkaplanı"): panel ayrı bir
  degrade/palet kullanınca sayfada yamalı duruyordu. Zemin, köşe ve çerçeve BentoCard'ınki;
  yazı/ayraç temanın ölçülmüş tonları. "Ekran"ı rengi değil YAPISI söyler: durum şeridi,
  mono okumalar, üst kenardan çok hafif içe gölge.
  Referans: react-native-skia örnekleri (FrostedCard/LiquidGlass). Tarama çizgili CRT (Severance)
  BİLEREK alınmadı: oyuncak durur, göz yorar. Statik: animasyon/Skia yok (saat hariç, dakikada 1).
*/

export const DISPLAY_FONT = { digits: 'Mono-SemiBold', digitsLight: 'Mono-Medium' } as const;

/** Panelin yazı/ayraç tonları — temanın ölçülmüş renkleri (ayrı palet yok). */
export function useDisplayColors() {
  const { theme } = useAppTheme();
  return { ink: theme.onSurface, muted: theme.onSurfaceVariant, label: theme.onSurfaceMuted, divider: theme.separator };
}

interface PanelProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: number;
}

export function DisplayPanel({ children, style, padding = S.lg }: PanelProps) {
  const { theme, isDark } = useAppTheme();
  return (
    <View style={[styles.panel, {
      // BentoCard'ın zemini/çerçevesi — sayfadaki diğer kartlarla tek aile.
      backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLowest,
      borderColor: isDark ? theme.outline : 'transparent',
      borderWidth: isDark ? B.thin : 0,
    }, style]}>
      {/* Gömülü ekran: üst kenardan çok hafif içe gölge (rengi değil derinliği söyler). */}
      <LinearGradient colors={[isDark ? 'rgba(0,0,0,0.28)' : 'rgba(15,23,42,0.045)', 'rgba(0,0,0,0)']} style={styles.inset} />
      <View style={{ padding }}>{children}</View>
    </View>
  );
}

const pad2 = (n: number) => String(n).padStart(2, '0');


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

/**
 * Dijital DEĞER — sabit genişlikli rakam; baştaki sayı SAYARAK değişir (bir şey tamamlanınca
 * ne değiştiği görülür), kalanı düz metin. Etiketsiz; okumalar ve KPI satırları kullanır.
 */
export function DisplayValue({ value, color, style }: { value: string; color?: string; style?: StyleProp<TextStyle> }) {
  const c = useDisplayColors();
  // Binlik/ondalık ayraçlı tutarda ("1.250 ₺") sayma YOK: yalnız baştaki "1" sayılırdı.
  const lead = /^(\d+)(?![.,]\d)(.*)$/.exec(value);
  const st = [styles.readValue, { color: color ?? c.ink }, style];
  return (
    <Text style={st} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
      {lead ? <AnimatedNumber value={Number(lead[1])} duration={450} style={st} /> : value}
      {lead ? lead[2] : null}
    </Text>
  );
}

/** Gösterge okuması: küçük büyük-harf etiket + sabit genişlikli değer. */
export function DisplayReadout({ label, value, accent, style }: { label: string; value: string; accent?: string; style?: StyleProp<TextStyle> }) {
  const c = useDisplayColors();
  const language = useLanguageStore(st => st.language);
  return (
    <View>
      <Text style={[styles.readLabel, { color: c.label }]} numberOfLines={1}>{upperFor(label, language)}</Text>
      <DisplayValue value={value} color={accent} style={[{ marginTop: S.xxs }, style]} />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderRadius: R.md, overflow: 'hidden' },
  inset: { position: 'absolute', top: 0, left: 0, right: 0, height: 10 },
  status: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: S.sm, marginBottom: S.md },
  intro: { flexShrink: 1, fontSize: F.callout, fontWeight: W.semibold },
  statusText: { flexShrink: 1, fontSize: F.caption, fontWeight: W.semibold, letterSpacing: 1.2 },
  clock: { fontFamily: DISPLAY_FONT.digits, fontSize: F.footnote, letterSpacing: 0.5, fontVariant: ['tabular-nums'] },
  readLabel: { fontSize: F.caption2, fontWeight: W.semibold, letterSpacing: 1.1 },
  readValue: { fontFamily: DISPLAY_FONT.digits, fontSize: F.title3, letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
});
