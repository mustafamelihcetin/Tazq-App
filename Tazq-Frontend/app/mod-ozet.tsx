import React, { useMemo, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Animated, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { useRouter } from 'expo-router';
import { ArrowLeft, CalendarClock, Layers, Flame, Compass } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { useActiveModeSummary } from '@/features/modes/hooks/useActiveModeSummary';
import { useHabitStore } from '@/features/habits';
import { useTaskStore, useActiveTasks } from '@/features/tasks';
import { ICON, S, R, F, B, TRACKING, SPRING, MAX_W , topBarSpace} from '@/shared/constants/tokens';
import { useContentMaxWidth } from '@/shared/components/ResponsiveColumns';
import { track } from '@/shared/utils/analytics';
import { renderModeEmojiIcon } from '@/features/modes';
import { localizeSporGoal } from '@/features/modes';
import { modeAccent, modeAccentText } from '@/shared/constants/Colors';
import { toDateKey, parseDateKey } from '@/shared/utils/dateKey';

// Bu haftanın (Pzt–Paz) 'YYYY-MM-DD' anahtarları.

// Etiketteki ham emoji'leri temizle (preset adı "⚖️ Kilo Yönetimi" gibi).
const stripEmoji = (s: string) => s
  .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{200D}]/gu, '')
  .replace(/\s+/g, ' ')
  .trim();



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

    Bu blok eskiden burada, ~60 satır olarak duruyordu. Ana ekran da aynı özeti
    göstermeye başlayınca kopyalanması gerekecekti; iki kopya zamanla ayrışır —
    biri slot modlarını sayar diğeri saymaz, biri tarihi geçmiş modu aktif gösterir.
    Aynı soruya iki farklı cevap veren iki ekran güveni bitirir.
  */
  const summary = useActiveModeSummary();
  const computed = summary.entries;
  const activeCount = summary.activeCount;
  const nearest = summary.nearest;
  const totalHabits = summary.totalHabits;
  const overallPct = summary.overallPct;
  const todayDoneAll = summary.todayDoneAll;
  const todayTotalAll = summary.todayTotalAll;

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

  const Stat = ({ icon, value, label, color }: { icon: React.ReactNode; value: string; label: string; color: string }) => (
    <View style={[styles.statCard, { backgroundColor: isDark ? theme.surfaceContainer : theme.surfaceContainerLow, borderColor: theme.outlineVariant }]}>
      <View style={{ width: 32, height: 32, borderRadius: R.sm, backgroundColor: color, alignItems: 'center', justifyContent: 'center', marginBottom: S.xs }}>{icon}</View>
      <Text style={{ color: theme.onSurface, fontSize: F.title, fontWeight: '700', letterSpacing: -0.5 }}>{value}</Text>
      <Text style={{ color: theme.onSurfaceMuted, fontSize: F.caption, fontWeight: '600' }}>{label}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Ortak başlık. Burası uygulamadaki TEK çöken/buzlu başlıktı — kendi kopyası,
          kendi 52pt yüksekliği ve ölçek dışı 30pt büyük başlığıyla. Tek örnek olması
          onu "özel" değil TUTARSIZ yapıyordu; ana ekranlarla aynı sisteme alındı. */}
      <ScreenHeader onBack={() => router.back()} title={navTitle} />

      {activeCount === 0 ? (
        <View style={[styles.center, { paddingTop: topBarSpace(insets.top) }]}>
          <Text style={{ fontSize: 40, marginBottom: S.md }}>🧭</Text>
          <Text style={{ color: theme.onSurface, fontSize: F.subhead, fontWeight: '700', textAlign: 'center', marginBottom: S.sm }}>{tr ? 'Henüz aktif mod yok' : 'No active modes yet'}</Text>
          <Text style={{ color: theme.onSurfaceVariant, fontSize: F.body, textAlign: 'center', lineHeight: 20, marginBottom: S.lg }}>{tr ? 'Bir hedef aç — buradan tüm modlarının gidişatını tek bakışta görürsün.' : 'Turn on a goal — track all your modes at a glance here.'}</Text>
          <TouchableOpacity onPress={() => router.back()} style={{ paddingHorizontal: S.lg, paddingVertical: S.sm, borderRadius: R.full, backgroundColor: theme.primary }} accessibilityRole="button">
            <Text style={{ color: '#fff', fontWeight: '700' }}>{tr ? 'Mod Seç' : 'Pick a Mode'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Animated.ScrollView
          contentContainerStyle={{ paddingHorizontal: S.lg, paddingTop: topBarSpace(insets.top) + S.md, paddingBottom: insets.bottom + S.xxl, gap: S.lg, width: '100%', maxWidth: contentW, alignSelf: 'center' }}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={onScroll}
        >


          {/* İçgörü satırı */}
          {coachLine ? (
            <View style={[styles.coach, { backgroundColor: (nearest?.color ?? theme.primary) + '14', borderColor: (nearest?.color ?? theme.primary) + '33' }]}>
              {/* Bölüm işareti ÇİZGİSEL ikon: sistem emojisi platformdan platforma farklı
                  çiziliyor ve temayı dinlemiyor. İşaret korunuyor, dili düzeltiliyor. */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, marginBottom: S.xs }}>
                <Compass size={ICON.xs} color={nearest?.color ?? theme.primary} strokeWidth={2.5} />
                <Text style={{ color: nearest?.color ?? theme.primary, fontSize: F.caption, fontWeight: '700', letterSpacing: 0.5 }}>{tr ? 'GENEL DURUM' : 'OVERVIEW'}</Text>
              </View>
              <Text style={{ color: theme.onSurface, fontSize: F.subhead, fontWeight: '700', lineHeight: 22 }}>{coachLine}</Text>
            </View>
          ) : null}

          {/* Özet ölçütleri */}
          <View style={{ flexDirection: 'row', gap: S.sm }}>
            <Stat icon={<Layers size={ICON.sm} color={theme.onPrimary} />} value={`${activeCount}`} label={tr ? 'Aktif mod' : 'Active modes'} color={theme.primary} />
            <Stat icon={<CalendarClock size={ICON.sm} color="#FF9500" />} value={nearest ? `${nearest.days}${tr ? 'g' : 'd'}` : '∞'} label={tr ? 'En yakın hedef' : 'Nearest goal'} color="#FF9500" />
            <Stat icon={<Flame size={ICON.sm} color="#34C759" />} value={totalHabits > 0 ? `%${overallPct}` : '—'} label={tr ? 'Hafta istikrar' : 'Week consistency'} color="#34C759" />
          </View>

          {/* Bugünkü plan genel */}
          {todayTotalAll > 0 && (
            <View style={[styles.section, { backgroundColor: isDark ? theme.surfaceContainer : theme.surfaceContainerLow, borderColor: theme.outlineVariant }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: S.sm }}>
                <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body }}>{tr ? 'Bugünkü plan' : "Today's plan"}</Text>
                <Text style={{ color: theme.onSurfaceVariant, fontWeight: '700', fontSize: F.caption }}>{todayDoneAll}/{todayTotalAll}</Text>
              </View>
              <View style={{ height: 8, borderRadius: R.xs, backgroundColor: theme.onSurfaceVariant + '20', overflow: 'hidden' }}>
                <View style={{ height: 8, borderRadius: R.xs, width: `${Math.round((todayDoneAll / todayTotalAll) * 100)}%`, backgroundColor: '#34C759' }} />
              </View>
            </View>
          )}

          {/* Mod kartları */}
          <View style={{ gap: S.sm }}>
            <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' }}>{tr ? 'Modlar' : 'Modes'}</Text>
            {computed.map((c, i) => (
              <MotiView
                key={c.key}
                from={{ opacity: 0, translateY: 8 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ ...SPRING, delay: i * 60 }}
                style={[styles.modeRow, { backgroundColor: isDark ? theme.surfaceContainer : theme.surfaceContainerLow, borderColor: c.color + (isDark ? '33' : '22') }]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                  <View style={{ width: 40, height: 40, borderRadius: R.md, backgroundColor: c.color + (isDark ? '26' : '18'), alignItems: 'center', justifyContent: 'center' }}>
                    {renderModeEmojiIcon(c.emoji, 20, c.color)}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body }} numberOfLines={1}>{stripEmoji(c.label) || c.label}</Text>
                    <Text style={{ color: c.days === -1 ? theme.error : c.color, fontSize: F.caption, fontWeight: '600', marginTop: S.xxs }}>
                      {c.days === null ? (tr ? 'Süresiz' : 'Open-ended') : c.days === -1 ? (tr ? 'Tarih geçti' : 'Date passed') : c.days === 0 ? (tr ? 'Bugün!' : 'Today!') : (tr ? `${c.days} gün kaldı` : `${c.days} days left`)}
                    </Text>
                  </View>
                  {c.todayTotal > 0 && (
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.caption }}>{c.todayDone}/{c.todayTotal}</Text>
                      <Text style={{ color: theme.onSurfaceVariant, fontSize: 10, fontWeight: '600' }}>{tr ? 'bugün' : 'today'}</Text>
                    </View>
                  )}
                </View>
                {/* haftalık alışkanlık istikrarı */}
                {c.habitCount > 0 && (
                  <View style={{ marginTop: S.sm }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: S.xs }}>
                      <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '600' }}>{tr ? 'Bu hafta alışkanlık' : 'Habits this week'}</Text>
                      <Text style={{ color: c.textColor, fontSize: F.caption, fontWeight: '700' }}>{c.weekActive}/{c.habitCount} · %{c.pct}</Text>
                    </View>
                    <View style={{ height: 5, borderRadius: R.xs, backgroundColor: theme.onSurfaceVariant + '20', overflow: 'hidden' }}>
                      <View style={{ height: 5, borderRadius: R.xs, width: `${c.pct}%`, backgroundColor: c.color }} />
                    </View>
                  </View>
                )}
              </MotiView>
            ))}
          </View>
        </Animated.ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: S.md, paddingVertical: S.sm },
  title: { fontSize: F.title3, fontWeight: '700', letterSpacing: TRACKING.title },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: S.xl },
  statCard: { flex: 1, borderRadius: R.lg, borderWidth: B.thin, padding: S.md, gap: S.xxs },
  section: { borderRadius: R.lg, borderWidth: B.thin, padding: S.md },
  coach: { borderRadius: R.lg, borderWidth: B.thin, padding: S.lg },
  modeRow: { borderRadius: R.lg, borderWidth: B.thin, padding: S.md },
});
