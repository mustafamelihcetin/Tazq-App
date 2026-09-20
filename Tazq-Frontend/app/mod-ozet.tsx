import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { useRouter } from 'expo-router';
import { CalendarClock, Layers, Flame, Compass, type LucideIcon } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { useActiveModeSummary, type ModeSummaryEntry } from '@/features/modes/hooks/useActiveModeSummary';
import { ICON, S, R, F, B, HAIRLINE, SPRING, topBarSpace } from '@/shared/constants/tokens';
import { useContentMaxWidth } from '@/shared/components/ResponsiveColumns';
import { track } from '@/shared/utils/analytics';
import { renderModeEmojiIcon } from '@/features/modes';
import { AppIcon } from '@/shared/components/AppIcon';
import { ProgressRail } from '@/shared/components/ProgressRail';

/**
 * MODLARIN ÖZETİ — "karmaşık ve çirkin, uygulamayla uyuşmuyor" (2026-09-20).
 *
 * ── ÖLÇÜLEN SORUN ─────────────────────────────────────────────────────────────
 * Bu ekran uygulamanın geri kalanından önce yazılmıştı ve kendi görsel dilini
 * konuşuyordu:
 *  · Üç ölçüt HAM iOS SİSTEM RENKLERİYLE boyanmıştı (sistem turuncusu, sistem yeşili) —
 *    uygulamanın geri kalanı `theme.streak`/`theme.success` gibi semantik tema
 *    token'ları kullanıyor, burada koyu temada hiç değişmeyen sabit hex'ler vardı.
 *  · Ekranda AYRI AYRI kenarlıklı 4+N kutu duruyordu: 3 istatistik kartı, bir "GENEL
 *    DURUM" kutusu, bir "Bugünkü plan" kutusu, N tane mod satırı — hepsi kendi
 *    kenarlığını çiziyordu. Göz her birini ayrı bir yüzey sanıyor, hiçbiri öne çıkmıyordu.
 *  · İlerleme raw `<View>` çubuklarıyla elle çiziliyordu — uygulamanın geri kalanı
 *    `ProgressRail`i kullanıyor (biriken/tek-yönlü "bar" ile periyodik/sayılabilir
 *    "segments" ayrımı burada yoktu, iki farklı ilerleme aynı çubukla anlatılıyordu).
 *
 * ── ÇÖZÜM: TEK KAHRAMAN KART + TEK LİSTE KABI ──────────────────────────────────
 * Dört-beş kutu yerine iki: üstte tek bir özet kartı (genel durum cümlesi + üç ölçüt
 * + bugünkü plan, hepsi aynı kartın içinde, aralarında ince ayırıcı), altta tek bir
 * liste kabı (mod satırları kendi kenarlığını taşımaz, `Separator` ile ayrılır — aynı
 * desen `app/modlar.tsx`teki "Geçmiş Hedefler" bölümünde de kullanılıyor).
 */

// Etiketteki ham emoji'leri temizle (preset adı "⚖️ Kilo Yönetimi" gibi).
const stripEmoji = (s: string) => s
  .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{200D}]/gu, '')
  .replace(/\s+/g, ' ')
  .trim();

/** Bir mod satırının gün metni — ayrı yerlerde üç kez yazılmasın diye tek fonksiyon. */
function daysLabel(days: number | null, tr: boolean): string {
  if (days === null) return tr ? 'Süresiz' : 'Open-ended';
  if (days === -1) return tr ? 'Tarih geçti' : 'Date passed';
  if (days === 0) return tr ? 'Bugün!' : 'Today!';
  return tr ? `${days} gün kaldı` : `${days} days left`;
}

function ModeRow({ c, tr, theme, isDark, isFirst }: { c: ModeSummaryEntry; tr: boolean; theme: ReturnType<typeof useAppTheme>['theme']; isDark: boolean; isFirst: boolean }) {
  return (
    <View style={{ paddingVertical: S.md, borderTopWidth: isFirst ? 0 : HAIRLINE, borderTopColor: theme.separator, gap: S.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
        <View style={{ width: 40, height: 40, borderRadius: R.md, backgroundColor: c.color + (isDark ? '26' : '18'), alignItems: 'center', justifyContent: 'center' }}>
          {renderModeEmojiIcon(c.emoji, 20, c.color)}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body }} numberOfLines={1}>{stripEmoji(c.label) || c.label}</Text>
          <Text style={{ color: c.days === -1 ? theme.error : c.textColor, fontSize: F.caption, fontWeight: '600', marginTop: S.xxs }}>
            {daysLabel(c.days, tr)}
          </Text>
        </View>
        {c.todayTotal > 0 && (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.caption }}>{c.todayDone}/{c.todayTotal}</Text>
            <Text style={{ color: theme.onSurfaceMuted, fontSize: 10, fontWeight: '600' }}>{tr ? 'bugün' : 'today'}</Text>
          </View>
        )}
      </View>
      {/* Haftalık alışkanlık RİTMİ — biriken bir yol değil, her hafta sıfırlanan bir
          sayı. `segments`, `bar`dan ayrı bir dil konuşur (bkz. ProgressRail). */}
      {c.habitCount > 0 && (
        <View style={{ gap: S.xs }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '600' }}>{tr ? 'Bu hafta alışkanlık' : 'Habits this week'}</Text>
            <Text style={{ color: c.textColor, fontSize: F.caption, fontWeight: '700' }}>{c.weekActive}/{c.habitCount} · %{c.pct}</Text>
          </View>
          <ProgressRail variant="segments" value={c.weekActive} total={c.habitCount} color={c.color} />
        </View>
      )}
    </View>
  );
}

export default function ModOzetScreen() {
  const { theme, isDark } = useAppTheme();
  const { language } = useLanguageStore();
  const tr = language === 'tr';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  /* Tablette içerik 600pt'lik şeride sıkışmasın — üç kademeli genişlik. */
  const contentW = useContentMaxWidth();

  /*
    HESAP ORTAK BİR HOOK'TA (bkz. useActiveModeSummary).

    Ana ekran da aynı özeti gösteriyor; kopyalansaydı iki ekran zamanla ayrışırdı —
    biri slot modlarını sayar diğeri saymaz, biri tarihi geçmiş modu aktif gösterir.
  */
  const summary = useActiveModeSummary();
  const { entries: computed, activeCount, nearest, totalHabits, overallPct, todayDoneAll, todayTotalAll } = summary;

  React.useEffect(() => { track('mode_summary_opened'); }, []);

  // Kural-tabanlı tek satırlık içgörü (ücretsiz).
  const coachLine = (() => {
    if (activeCount === 0) return '';
    if (nearest && nearest.days! <= 3) return tr ? `“${nearest.label}” çok yakın — bu hafta tam odaklan.` : `“${nearest.label}” is very close — full focus this week.`;
    if (overallPct >= 80) return tr ? 'Tüm modlarda harika bir istikrar yakaladın, böyle devam!' : 'Great consistency across all modes — keep it up!';
    if (overallPct < 40 && totalHabits > 0) return tr ? 'Bu hafta alışkanlıklar biraz geride — küçük bir adım bile ivmeyi geri getirir.' : 'Habits are lagging this week — even one small step rebuilds momentum.';
    if (nearest) return tr ? `En yakın hedefin “${nearest.label}” (${nearest.days} gün). Günlük plana sadık kal.` : `Nearest goal: “${nearest.label}” (${nearest.days} days). Stick to the daily plan.`;
    return tr ? 'Kendi tempondasın — düzenli küçük adımlar fark yaratır.' : 'At your own pace — steady small steps win.';
  })();

  // ── iOS HIG: büyük başlık çöküşü + buzlu cam header (her iki platform) ──
  const scrollY = useRef(new Animated.Value(0)).current;
  const onScroll = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true });
  const navTitle = tr ? 'Modların Özeti' : 'Modes Overview';

  // Hero kartının vurgusu: en yakın hedefin rengi, yoksa nötr birincil renk.
  const heroColor = nearest?.color ?? theme.primary;
  const heroText = nearest?.textColor ?? theme.primary;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Ortak başlık — ana ekranlarla aynı sistem. */}
      <ScreenHeader onBack={() => router.back()} title={navTitle} />

      {activeCount === 0 ? (
        <View style={[styles.center, { paddingTop: topBarSpace(insets.top) }]}>
          <Text style={{ fontSize: 40, marginBottom: S.md }}>🧭</Text>
          <Text style={{ color: theme.onSurface, fontSize: F.subhead, fontWeight: '700', textAlign: 'center', marginBottom: S.sm }}>{tr ? 'Henüz aktif mod yok' : 'No active modes yet'}</Text>
          <Text style={{ color: theme.onSurfaceVariant, fontSize: F.body, textAlign: 'center', lineHeight: 20, marginBottom: S.lg }}>{tr ? 'Bir hedef aç — buradan tüm modlarının gidişatını tek bakışta görürsün.' : 'Turn on a goal — track all your modes at a glance here.'}</Text>
          <TouchableOpacity onPress={() => router.back()} style={{ paddingHorizontal: S.lg, paddingVertical: S.sm, borderRadius: R.full, backgroundColor: theme.primary }} accessibilityRole="button">
            <Text style={{ color: theme.onPrimary, fontWeight: '700' }}>{tr ? 'Mod Seç' : 'Pick a Mode'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Animated.ScrollView
          contentContainerStyle={{ paddingHorizontal: S.lg, paddingTop: topBarSpace(insets.top) + S.md, paddingBottom: insets.bottom + S.xxl, gap: S.lg, width: '100%', maxWidth: contentW, alignSelf: 'center' }}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={onScroll}
        >
          {/*
            TEK KAHRAMAN KARTI — genel durum + üç ölçüt + bugünkü plan, hepsi TEK
            kartın içinde, aralarında yalnız ince ayırıcı. Eskiden bunlar üç ayrı
            kenarlıklı kutuydu; göz hiçbirini "ana yüzey" sayamıyordu.
          */}
          <MotiView
            from={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={SPRING}
            style={[styles.hero, { backgroundColor: isDark ? heroColor + '1A' : heroColor + '12', borderColor: heroColor + (isDark ? '40' : '30') }]}
          >
            {coachLine ? (
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: S.sm }}>
                <Compass size={ICON.sm} color={heroText} strokeWidth={2.5} style={{ marginTop: S.xxs }} />
                <Text style={{ flex: 1, color: theme.onSurface, fontSize: F.body, fontWeight: '600', lineHeight: 20 }}>{coachLine}</Text>
              </View>
            ) : null}

            <View style={{ height: HAIRLINE, backgroundColor: theme.separator, marginVertical: S.md }} />

            {/* Üç ölçüt — kendi kenarlığı YOK, aralarında ince dikey çizgi. */}
            <View style={{ flexDirection: 'row' }}>
              <Metric Icon={Layers} iconColor={theme.primary}
                value={`${activeCount}`} label={tr ? 'Aktif mod' : 'Active modes'} theme={theme} />
              <View style={{ width: HAIRLINE, backgroundColor: theme.separator }} />
              <Metric Icon={CalendarClock} iconColor={heroColor}
                value={nearest ? `${nearest.days}` : '∞'} unit={nearest ? (tr ? 'gün' : 'days') : undefined}
                label={tr ? 'En yakın hedef' : 'Nearest goal'} theme={theme} />
              <View style={{ width: HAIRLINE, backgroundColor: theme.separator }} />
              <Metric Icon={Flame} iconColor={theme.streak}
                value={totalHabits > 0 ? `%${overallPct}` : '—'} label={tr ? 'Hafta istikrar' : 'Week consistency'} theme={theme} />
            </View>

            {todayTotalAll > 0 && (
              <>
                <View style={{ height: HAIRLINE, backgroundColor: theme.separator, marginVertical: S.md }} />
                <View style={{ gap: S.xs }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body }}>{tr ? 'Bugünkü plan' : "Today's plan"}</Text>
                    <Text style={{ color: todayDoneAll >= todayTotalAll ? theme.success : theme.onSurfaceVariant, fontWeight: '700', fontSize: F.caption }}>{todayDoneAll}/{todayTotalAll}</Text>
                  </View>
                  <ProgressRail variant="segments" value={todayDoneAll} total={todayTotalAll} color={todayDoneAll >= todayTotalAll ? theme.success : heroColor} height={8} />
                </View>
              </>
            )}
          </MotiView>

          {/* Mod listesi — TEK kap, satırlar kendi kenarlığını taşımaz. Aynı desen
              modlar.tsx'teki "Geçmiş Hedefler" bölümünde de kullanılıyor. */}
          <View style={{ gap: S.sm }}>
            <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', paddingHorizontal: S.xs }}>{tr ? 'Modlar' : 'Modes'}</Text>
            <MotiView
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ type: 'timing', duration: 250 }}
              style={[styles.list, { backgroundColor: isDark ? theme.surfaceContainer : theme.surfaceContainerLow, borderColor: theme.outlineVariant, paddingHorizontal: S.md }]}
            >
              {computed.map((c, i) => (
                <ModeRow key={c.key} c={c} tr={tr} theme={theme} isDark={isDark} isFirst={i === 0} />
              ))}
            </MotiView>
          </View>
        </Animated.ScrollView>
      )}
    </View>
  );
}

/**
 * Tek ölçüt: renkli glif + büyük sayı + etiket — kenarlıksız, dikey ayırıcıyla
 * komşularından ayrılır.
 *
 * `unit` — sayı ile birimi ASLA bitiştirme ("84g" gibi bir kısaltma soğuk ve
 * okunaksız durur). Uygulamanın geri kalanında büyük sayı ile birimi hep AYRI
 * yazılır (bkz. modlar.tsx'teki KAHRAMAN SATIRI: sayı + altında/yanında "GÜN").
 * Burada yanına, hafif ve küçük — kendi başına ikinci bir hero olmasın diye.
 */
function Metric({ Icon, iconColor, value, unit, label, theme }: { Icon: LucideIcon; iconColor: string; value: string; unit?: string; label: string; theme: ReturnType<typeof useAppTheme>['theme'] }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: S.xxs }}>
      <AppIcon Icon={Icon} color={iconColor} size={28} radius={R.full} iconSize={ICON.xs} />
      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: S.xxs }}>
        <Text style={{ color: theme.onSurface, fontSize: F.title, fontWeight: '700', letterSpacing: -0.5 }}>{value}</Text>
        {unit ? (
          <Text style={{ color: theme.onSurfaceMuted, fontSize: F.caption, fontWeight: '600', marginLeft: S.xxs }}>{unit}</Text>
        ) : null}
      </View>
      <Text style={{ color: theme.onSurfaceMuted, fontSize: 10, fontWeight: '600', textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: S.xl },
  hero: { borderRadius: R.lg, borderWidth: B.thin, padding: S.lg },
  list: { borderRadius: R.lg, borderWidth: B.thin, overflow: 'hidden' },
});
