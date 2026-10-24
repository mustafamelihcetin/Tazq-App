import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Modal, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppBlur } from '@/shared/components/AppBlur';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { X } from 'lucide-react-native';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { useAchievementStore, useMomentumStore, ACHIEVEMENTS } from '@/features/user';
import { FocusService } from '@/shared/services/api';
import { swallow } from '@/shared/utils/swallow';
import type { Achievement } from '@/features/user/store/useAchievementStore';
import { ACHIEVEMENT_ICONS, renderAchievementIcon } from '@/shared/utils/achievementIcons';
import { BackButton } from '@/shared/components/BackButton';
import { Touchable } from '@/shared/components/Touchable';
import { GlassSurface } from '@/shared/components/GlassSurface';
import { S, R, F, W, B, ICON, MIN_TOUCH, RSPRING } from '@/shared/constants/tokens';
import { useContentMaxWidth } from '@/shared/components/ResponsiveColumns';
import { haptic } from '@/shared/utils/haptics';
import { upperFor } from '@/shared/utils/localeCase';

/*
  ── BAŞARILAR — Apple Fitness "Ödüller" ızgarası ──────────────────────────────────
  Önceki hâl: 2 sütun, her rozet kendi kartında; 14 rozet ~4 ekran boyu kaydırma ve
  10 gri kutu. Kilitli karelerin altında her biri FARKLI renkte (turuncu, kırmızı,
  mavi, mor, yeşil) ilerleme çubukları — ekranın en canlı rengi henüz kazanılmamış
  şeylerdeydi. Fitness'ın ödül ızgarasından alınan kurallar:
    · kutu YOK — madalyanın kendisi nesne; 3 sütun (genişte 4), ekran yarıya iner
    · renk yalnız KAZANILMIŞ madalyada; kilitli olan soluk, gri glif
    · ilerleme madalyanın ETRAFINDA ince halka (TodayRings ile aynı dil), çubuk değil
    · kazanılmışın altında "✓ Açıldı" yerine TARİH — ne zaman kazandığın hikâyedir
*/

// Kategoriler — vitrin bu sıra ve gruplarla gezilir (her aile bir "koleksiyon").
const CATEGORIES = [
  { key: 'streak', ids: ['streak_3', 'streak_7', 'streak_14', 'streak_30', 'streak_100'] },
  { key: 'momentum', ids: ['momentum_50', 'momentum_75', 'momentum_90', 'momentum_100'] },
  { key: 'focus', ids: ['focus_first', 'focus_5h', 'focus_25h'] },
  { key: 'milestone', ids: ['first_task', 'daily_perfect'] },
] as const;

type CatKey = typeof CATEGORIES[number]['key'];

/** Sözlük — satır içi `tr ? '...' : '...'` yerine (bkz. i18nRatchet). */
const COPY = {
  tr: {
    locale: 'tr-TR',
    title: 'Başarılar',
    cats: { streak: 'Seri', momentum: 'Momentum', focus: 'Odak', milestone: 'Kilometre taşları' } as Record<CatKey, string>,
    nextUp: 'Sıradaki',
    locked: 'Kilitli',
    earnedBadge: '✓ Başarım açıldı',
    close: 'Kapat',
    howTo: 'Nasıl açılır',
    none: 'İlk madalyan çok yakın.',
    all: 'Koleksiyon tamamlandı. Efsane.',
    some: (pct: number) => `Koleksiyonun %${pct} dolu`,
    hint: (id: string): string => {
      const n = id.split('_')[1];
      if (id.startsWith('streak_')) return `${n} günlük seri yakala`;
      if (id.startsWith('momentum_')) return `Momentum'u %${n} seviyesine çıkar`;
      const fixed: Record<string, string> = {
        focus_first: 'İlk odak seansını başlat',
        focus_5h: 'Toplam 5 saat odaklan',
        focus_25h: 'Toplam 25 saat odaklan',
        first_task: 'İlk görevini tamamla',
        daily_perfect: 'Bir günün tüm görevlerini bitir',
      };
      return fixed[id] ?? '';
    },
  },
  en: {
    locale: 'en-US',
    title: 'Achievements',
    cats: { streak: 'Streaks', momentum: 'Momentum', focus: 'Focus', milestone: 'Milestones' } as Record<CatKey, string>,
    nextUp: 'Next up',
    locked: 'Locked',
    earnedBadge: '✓ Achievement earned',
    close: 'Close',
    howTo: 'How to unlock',
    none: 'Your first medal is within reach.',
    all: 'Collection complete. Legendary.',
    some: (pct: number) => `Your collection is ${pct}% full`,
    hint: (id: string): string => {
      const n = id.split('_')[1];
      if (id.startsWith('streak_')) return `Reach a ${n}-day streak`;
      if (id.startsWith('momentum_')) return `Get momentum to ${n}%`;
      const fixed: Record<string, string> = {
        focus_first: 'Start your first focus session',
        focus_5h: 'Focus for 5 hours total',
        focus_25h: 'Focus for 25 hours total',
        first_task: 'Complete your first task',
        daily_perfect: "Complete all of a day's tasks",
      };
      return fixed[id] ?? '';
    },
  },
};

/**
 * KAZANILMIŞ MADALYAYA "KUPA" HİSSİ — köşeden çapraz geçen ince bir parlaklık.
 * Yalnız KAZANILMIŞ madalyalarda: kilitli olan parlamaz, parlamak bir ÖDÜL.
 */
function MedalShine() {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
      start={{ x: 0.15, y: 0 }}
      end={{ x: 0.75, y: 0.9 }}
      style={StyleSheet.absoluteFill}
    />
  );
}

type Progress = { cur: number; target: number; unit?: string };

const RING_W = 3;
const RING_GAP = 4;

export default function AchievementsScreen() {
  const { theme, isDark } = useAppTheme();
  const { language } = useLanguageStore();
  const c = COPY[language];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  /* Tablette içerik 600pt'lik şeride sıkışmasın — üç kademeli genişlik. */
  const contentW = useContentMaxWidth();
  const { width } = useWindowDimensions();
  const { unlocked, unlockedAt } = useAchievementStore();
  const momentumHistory = useMomentumStore(s => s.history);
  const params = useLocalSearchParams<{ streak?: string; focusHours?: string }>();

  // Kendi kendine yeten: param'la TOHUMLA (anında görün) → getStats ile TAZELE (stats yarışı biter).
  const [streak, setStreak] = useState(Number(params.streak ?? 0));
  const [focusHours, setFocusHours] = useState(Number(params.focusHours ?? 0));
  useEffect(() => {
    FocusService.getStats()
      .then((s: any) => { setStreak(s.activeStreak ?? 0); setFocusHours(s.totalFocusHours ?? 0); })
      .catch((e: any) => swallow('achievements.getStats', e));
  }, []);

  // Momentum: dashboard kavramı; son 7 günün EN İYİsi = "eşiğe ne kadar yaklaştın" için doğru ölçü.
  const momentum = momentumHistory.length
    ? Math.max(0, ...momentumHistory.slice(-7).map(d => d.score))
    : 0;

  const [detail, setDetail] = useState<(Achievement & { earned: boolean }) | null>(null);

  const allIds: string[] = CATEGORIES.flatMap(cat => [...cat.ids]);
  const total = allIds.length;
  const earnedCount = allIds.filter(id => unlocked.includes(id)).length;
  const pctAll = Math.round((earnedCount / total) * 100);

  // İlerleme — profilden gelen metrikle (seri + odak saati). Görev metriği burada yok → ipucu.
  const progressOf = (id: string): Progress | null => {
    if (id.startsWith('streak_')) { const t = Number(id.split('_')[1]); return { cur: Math.min(streak, t), target: t }; }
    if (id.startsWith('momentum_')) { const t = Number(id.split('_')[1]); return { cur: Math.min(Math.round(momentum), t), target: t, unit: '%' }; }
    if (id === 'focus_5h') return { cur: Math.min(Math.round(focusHours), 5), target: 5 };
    if (id === 'focus_25h') return { cur: Math.min(Math.round(focusHours), 25), target: 25 };
    return null;
  };

  /*
    SIRADAKİ HEDEF — en yakın (yüzdece en ileri) kilitli başarım. İkili (evet/hayır)
    başarımlar sayılmıyor çünkü "%kaç kaldı" sorusuna cevapları yok.
  */
  const nearestIncomplete = allIds
    .filter(id => !unlocked.includes(id))
    .map(id => ({ id, p: progressOf(id) }))
    .filter((x): x is { id: string; p: Progress } => x.p !== null)
    .sort((a, b) => (b.p.cur / b.p.target) - (a.p.cur / a.p.target))[0] ?? null;

  // Izgara: içerik genişliğinden (iPad'de pencere değil, içerik şeridi). Dar telefonda
  // 3, geniş şeritte 4 sütun — madalya boyu her yerde aynı kalır, sütun sayısı artar.
  const innerW = Math.min(width, contentW) - S.lg * 2;
  const cols = innerW >= 520 ? 4 : 3;
  const colGap = S.sm;
  const tileW = Math.floor((innerW - colGap * (cols - 1)) / cols);
  const medal = Math.min(76, tileW - (RING_W + RING_GAP) * 2 - S.xs);

  const open = (a: Achievement, earned: boolean) => { haptic.select(); setDetail({ ...a, earned }); };
  const shortDate = (ts: number) => new Date(ts).toLocaleDateString(c.locale, { day: 'numeric', month: 'short' });

  const Medal = ({ id, earned, size, progress }: { id: string; earned: boolean; size: number; progress?: Progress | null }) => {
    const color = ACHIEVEMENT_ICONS[id]?.color || theme.primary;
    const box = size + (RING_W + RING_GAP) * 2;
    const r = box / 2 - RING_W / 2;
    const len = 2 * Math.PI * r;
    const frac = progress ? Math.min(1, progress.cur / progress.target) : 0;
    return (
      <View style={{ width: box, height: box, alignItems: 'center', justifyContent: 'center' }}>
        {/* İlerleme halkası yalnız kilitli rozette VE gerçekten ilerleme varken. 0'da çizilen
            gri iz her kilitli madalyayı kalın çerçeveli bir diske çeviriyordu — ızgara
            kalabalıklaşıyordu. İz rozetin kendi renginin soluğu (TodayRings kuralı). */}
        {!earned && frac > 0 && (
          <Svg width={box} height={box} style={StyleSheet.absoluteFill}>
            <Circle cx={box / 2} cy={box / 2} r={r} fill="none" stroke={color + '33'} strokeWidth={RING_W} />
            <Circle
              cx={box / 2} cy={box / 2} r={r} fill="none" stroke={color} strokeWidth={RING_W}
              strokeLinecap="round" strokeDasharray={`${len}`} strokeDashoffset={len * (1 - frac)}
              transform={`rotate(-90 ${box / 2} ${box / 2})`}
            />
          </Svg>
        )}
        <View
          style={[
            {
              width: size, height: size, borderRadius: R.full,
              alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
              backgroundColor: earned ? color : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.035)'),
            },
            earned && { shadowColor: color, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
          ]}
        >
          {earned && <MedalShine />}
          {renderAchievementIcon(id, Math.round(size * 0.42), !earned)}
        </View>
      </View>
    );
  };

  const nextUp = nearestIncomplete ? ACHIEVEMENTS[nearestIncomplete.id] : null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <BackButton onPress={() => router.back()} style={{ position: 'absolute', top: insets.top + S.xs, left: S.md, zIndex: 20 }} />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: S.lg, paddingTop: MIN_TOUCH + S.md, paddingBottom: insets.bottom + S.xxl, width: '100%', maxWidth: contentW, alignSelf: 'center' }}
        >
          {/* ── Kahraman: koleksiyon ilerlemesi ── */}
          <View style={{ alignItems: 'center', marginBottom: S.lg }}>
            <Text accessibilityRole="header" style={{ color: theme.onSurfaceMuted, fontSize: F.caption, fontWeight: W.semibold, letterSpacing: 1.2 }}>
              {upperFor(c.title, language)}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: S.xs, marginTop: S.sm }}>
              <Text style={{ color: theme.onSurface, fontSize: F.hero, fontWeight: W.bold, letterSpacing: -1, fontVariant: ['tabular-nums'] }}>{earnedCount}</Text>
              <Text style={{ color: theme.onSurfaceMuted, fontSize: F.title, fontWeight: W.semibold }}>/ {total}</Text>
            </View>
            <View style={{ width: '56%', height: 6, borderRadius: R.full, backgroundColor: theme.tertiary + '29', overflow: 'hidden', marginTop: S.smd }}>
              <View style={{ width: `${Math.max(3, pctAll)}%`, height: '100%', backgroundColor: theme.tertiary, borderRadius: R.full }} />
            </View>
            <Text style={{ color: theme.onSurfaceMuted, fontSize: F.footnote, fontWeight: W.medium, marginTop: S.sm, textAlign: 'center' }}>
              {earnedCount === 0 ? c.none : earnedCount === total ? c.all : c.some(pctAll)}
            </Text>
          </View>

          {/* Sıradaki hedef — soyut yüzdeye somut bir davet. Pill yerine satır: madalyası,
              adı ve ilerlemesi birlikte; dokununca detay. */}
          {nearestIncomplete && nextUp && (
            <Touchable
              activeOpacity={0.8}
              onPress={() => open(nextUp, false)}
              accessibilityRole="button"
              accessibilityLabel={`${c.nextUp}: ${language === 'tr' ? nextUp.titleTr : nextUp.titleEn}, ${nearestIncomplete.p.cur}/${nearestIncomplete.p.target}${nearestIncomplete.p.unit ?? ''}`}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: S.smd, padding: S.smd, marginBottom: S.xl,
                borderRadius: R.lg, backgroundColor: theme.surfaceCard, borderWidth: isDark ? B.thin : 0, borderColor: theme.outline,
              }}
            >
              <Medal id={nearestIncomplete.id} earned={false} size={40} progress={nearestIncomplete.p} />
              <View style={{ flex: 1, gap: S.xxs }}>
                <Text style={{ color: theme.onSurfaceMuted, fontSize: F.caption, fontWeight: W.semibold }}>{c.nextUp}</Text>
                <Text numberOfLines={1} style={{ color: theme.onSurface, fontSize: F.body, fontWeight: W.semibold }}>
                  {language === 'tr' ? nextUp.titleTr : nextUp.titleEn}
                </Text>
              </View>
              <Text style={{ color: theme.onSurfaceVariant, fontSize: F.callout, fontWeight: W.semibold, fontVariant: ['tabular-nums'] }}>
                {nearestIncomplete.p.cur}/{nearestIncomplete.p.target}{nearestIncomplete.p.unit ?? ''}
              </Text>
            </Touchable>
          )}

          {/* ── Kategoriler ── */}
          {CATEGORIES.map(cat => (
            <View key={cat.key} style={{ marginBottom: S.xl }}>
              <Text accessibilityRole="header" style={{ color: theme.onSurfaceMuted, fontSize: F.caption, fontWeight: W.semibold, letterSpacing: 0.6, marginBottom: S.md }}>
                {upperFor(c.cats[cat.key], language)}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: colGap, rowGap: S.lg }}>
                {cat.ids.map(id => {
                  const a = ACHIEVEMENTS[id];
                  if (!a) return null;
                  const earned = unlocked.includes(id);
                  const p = !earned ? progressOf(id) : null;
                  const title = language === 'tr' ? a.titleTr : a.titleEn;
                  const caption = earned
                    ? (unlockedAt[id] ? shortDate(unlockedAt[id]) : '')
                    : p ? `${p.cur}/${p.target}${p.unit ?? ''}` : c.locked;
                  return (
                    <Touchable
                      key={id}
                      activeOpacity={0.7}
                      onPress={() => open(a, earned)}
                      accessibilityRole="button"
                      accessibilityLabel={`${title}, ${earned ? c.earnedBadge.replace('✓ ', '') : caption}`}
                      style={{ width: tileW, alignItems: 'center' }}
                    >
                      <Medal id={id} earned={earned} size={medal} progress={p} />
                      <Text
                        numberOfLines={2}
                        style={{ color: earned ? theme.onSurface : theme.onSurfaceVariant, fontSize: F.footnote, fontWeight: W.semibold, textAlign: 'center', marginTop: S.sm, lineHeight: 17 }}
                      >
                        {title}
                      </Text>
                      {!!caption && (
                        <Text style={{ color: theme.onSurfaceMuted, fontSize: F.caption, fontWeight: W.medium, marginTop: S.xxs, fontVariant: ['tabular-nums'] }}>
                          {caption}
                        </Text>
                      )}
                    </Touchable>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>

      {/*
        ── Tam-ekran madalya detayı (Alert değil — hayran olunacak an) ──
        `animationType="none"` BİLEREK: "fade" RN Modal'ın TÜM içeriğinin
        (blur dahil) opaklığını native tarafta animasyonluyor — gerçek zamanlı
        hesaplanan blur bu sırada titriyor/yırtılıyor (bkz. CelebrationOverlay'deki
        aynı düzeltme). Blur burada anında belirir; kart yine de MotiView ile
        yumuşak giriyor, göz "ani"yi fark etmiyor.
      */}
      <Modal visible={!!detail} transparent animationType="none" onRequestClose={() => setDetail(null)}>
        {detail && (() => {
          const color = ACHIEVEMENT_ICONS[detail.id]?.color || theme.primary;
          const p = !detail.earned ? progressOf(detail.id) : null;
          // Kapatma katmanı `accessible={false}`: kendisi adsız bir kontrol olarak odak
          // almasın; içindeki rozet kartı okunmaya devam eder.
          return (
            <Touchable accessible={false} activeOpacity={1} onPress={() => setDetail(null)} style={{ flex: 1 }}>
              <AppBlur material="thick" />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.20)' }]} />
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: S.xl }}>
                <MotiView
                  from={{ opacity: 0, scale: 0.85, translateY: 12 }}
                  animate={{ opacity: 1, scale: 1, translateY: 0 }}
                  transition={{ type: 'spring', ...RSPRING.pop }}
                  style={{
                    width: '100%', maxWidth: 340, alignItems: 'center',
                    borderColor: theme.separator, borderWidth: B.thin,
                    borderRadius: R.sheet, padding: S.xl,
                  }}
                >
                  <GlassSurface radius={R.sheet} />
                  <View
                    style={{
                      width: 112, height: 112, borderRadius: R.full, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                      backgroundColor: detail.earned ? color : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                      borderWidth: detail.earned ? 0 : B.thin, borderColor: theme.separator,
                      shadowColor: color, shadowOffset: { width: 0, height: 10 }, shadowOpacity: detail.earned ? 0.35 : 0, shadowRadius: 18, elevation: detail.earned ? 8 : 0,
                    }}
                  >
                    {detail.earned && <MedalShine />}
                    {renderAchievementIcon(detail.id, 52, !detail.earned)}
                  </View>

                  <Text numberOfLines={2} style={{ color: theme.onSurface, fontSize: F.title, fontWeight: W.bold, letterSpacing: -0.4, textAlign: 'center', marginTop: S.lg }}>
                    {language === 'tr' ? detail.titleTr : detail.titleEn}
                  </Text>
                  <Text style={{ color: theme.onSurfaceMuted, fontSize: F.body, fontWeight: W.medium, textAlign: 'center', lineHeight: 21, marginTop: S.xs }}>
                    {language === 'tr' ? detail.subtitleTr : detail.subtitleEn}
                  </Text>

                  {detail.earned ? (
                    <View style={{ marginTop: S.lg, alignItems: 'center', gap: S.sm }}>
                      <View style={{ paddingHorizontal: S.md, paddingVertical: S.xs, borderRadius: R.full, backgroundColor: theme.tertiary + '1C' }}>
                        <Text style={{ color: theme.tertiary, fontSize: F.caption, fontWeight: W.bold, letterSpacing: 0.5 }}>
                          {upperFor(c.earnedBadge, language)}
                        </Text>
                      </View>
                      {unlockedAt[detail.id] && (
                        <Text style={{ color: theme.onSurfaceMuted, fontSize: F.caption, fontWeight: W.medium }}>
                          {new Date(unlockedAt[detail.id]).toLocaleDateString(c.locale, { day: 'numeric', month: 'long', year: 'numeric' })}
                        </Text>
                      )}
                    </View>
                  ) : (
                    <View style={{ marginTop: S.lg, width: '100%', alignItems: 'center', gap: S.sm }}>
                      <Text style={{ color: theme.onSurfaceVariant, fontSize: F.footnote, fontWeight: W.semibold, textAlign: 'center' }}>
                        {`${c.howTo}: ${c.hint(detail.id)}`}
                      </Text>
                      {p && (
                        <View style={{ width: '80%', gap: S.xxs }}>
                          <View style={{ height: 6, borderRadius: R.full, backgroundColor: color + '29', overflow: 'hidden' }}>
                            <View style={{ width: `${Math.max(4, Math.min(100, Math.round((p.cur / p.target) * 100)))}%`, height: '100%', backgroundColor: color, borderRadius: R.full }} />
                          </View>
                          <Text style={{ color: theme.onSurfaceMuted, fontSize: F.caption, fontWeight: W.bold, textAlign: 'center', fontVariant: ['tabular-nums'] }}>
                            {p.cur} / {p.target}{p.unit ?? ''}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  <Touchable
                    onPress={() => setDetail(null)}
                    accessibilityRole="button"
                    accessibilityLabel={c.close}
                    style={{ marginTop: S.lg, width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: R.full, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)' }}
                  >
                    <X size={ICON.md} color={theme.onSurfaceVariant} />
                  </Touchable>
                </MotiView>
              </View>
            </Touchable>
          );
        })()}
      </Modal>
    </View>
  );
}
