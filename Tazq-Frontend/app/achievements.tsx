import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Modal, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { MotiView } from 'moti';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as HapticsOriginal from 'expo-haptics';
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
import { DottedBackground } from '@/shared/components/DottedBackground';
import { S, R, F, B, ICON, MIN_TOUCH } from '@/shared/constants/tokens';

const Haptics = {
  selectionAsync: () => HapticsOriginal.selectionAsync().catch(() => {}),
};

// Kategoriler — vitrin bu sıra ve gruplarla gezilir (her aile bir "koleksiyon").
const CATEGORIES = [
  { key: 'streak', titleTr: 'Seri', titleEn: 'Streaks', ids: ['streak_3', 'streak_7', 'streak_14', 'streak_30', 'streak_100'] },
  { key: 'momentum', titleTr: 'Momentum', titleEn: 'Momentum', ids: ['momentum_50', 'momentum_75', 'momentum_90', 'momentum_100'] },
  { key: 'focus', titleTr: 'Odak', titleEn: 'Focus', ids: ['focus_first', 'focus_5h', 'focus_25h'] },
  { key: 'milestone', titleTr: 'Kilometre Taşları', titleEn: 'Milestones', ids: ['first_task', 'daily_perfect'] },
];

// "Nasıl açılır" ipucu — eşiği id kodluyor.
function hint(id: string, tr: boolean): string {
  if (id.startsWith('streak_')) { const n = id.split('_')[1]; return tr ? `${n} günlük seri yakala` : `Reach a ${n}-day streak`; }
  if (id.startsWith('momentum_')) { const n = id.split('_')[1]; return tr ? `Momentum'u %${n} seviyesine çıkar` : `Get momentum to ${n}%`; }
  if (id === 'focus_first') return tr ? 'İlk odak seansını başlat' : 'Start your first focus session';
  if (id === 'focus_5h') return tr ? 'Toplam 5 saat odaklan' : 'Focus for 5 hours total';
  if (id === 'focus_25h') return tr ? 'Toplam 25 saat odaklan' : 'Focus for 25 hours total';
  if (id === 'first_task') return tr ? 'İlk görevini tamamla' : 'Complete your first task';
  if (id === 'daily_perfect') return tr ? "Bir günün tüm görevlerini bitir" : "Complete all of a day's tasks";
  return '';
}

export default function AchievementsScreen() {
  const { theme, isDark } = useAppTheme();
  const { language } = useLanguageStore();
  const tr = language === 'tr';
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

  const allIds = CATEGORIES.flatMap(c => c.ids);
  const total = allIds.length;
  const earnedCount = allIds.filter(id => unlocked.includes(id)).length;
  const pctAll = Math.round((earnedCount / total) * 100);

  // İlerleme — profilden gelen metrikle (seri + odak saati). Momentum/görev metriği burada yok → ipucu.
  const progressOf = (id: string): { cur: number; target: number; unit?: string } | null => {
    if (id.startsWith('streak_')) { const t = Number(id.split('_')[1]); return { cur: Math.min(streak, t), target: t }; }
    if (id.startsWith('momentum_')) { const t = Number(id.split('_')[1]); return { cur: Math.min(Math.round(momentum), t), target: t, unit: '%' }; }
    if (id === 'focus_5h') return { cur: Math.min(Math.round(focusHours), 5), target: 5 };
    if (id === 'focus_25h') return { cur: Math.min(Math.round(focusHours), 25), target: 25 };
    return null;
  };

  const colGap = S.md;
  const tileW = (width - S.lg * 2 - colGap) / 2;

  const open = (a: Achievement, earned: boolean) => { Haptics.selectionAsync(); setDetail({ ...a, earned }); };

  const Medal = ({ id, earned, size }: { id: string; earned: boolean; size: number }) => {
    const color = ACHIEVEMENT_ICONS[id]?.color || theme.primary;
    return (
      <View
        style={[
          {
            width: size, height: size, borderRadius: R.full,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: earned ? color : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.035)'),
            borderWidth: earned ? 0 : B.thin,
            borderColor: theme.separator,
          },
          earned && {
            shadowColor: color, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.30, shadowRadius: 14, elevation: 6,
          },
        ]}
      >
        {renderAchievementIcon(id, Math.round(size * 0.42), !earned)}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <DottedBackground color={theme.onBackground} opacity={isDark ? 0.05 : 0.08} size={24} dotSize={1} />

      <BackButton onPress={() => router.back()} style={{ position: 'absolute', top: insets.top + S.xs, left: S.md, zIndex: 20 }} />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: S.lg, paddingTop: MIN_TOUCH + S.md, paddingBottom: insets.bottom + S.xxl }}
        >
          {/* ── Kahraman: koleksiyon ilerlemesi ── */}
          <View style={{ alignItems: 'center', marginBottom: S.xl }}>
            <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '700', letterSpacing: 1.5 }}>
              {tr ? 'BAŞARILAR' : 'ACHIEVEMENTS'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: S.xs, marginTop: S.sm }}>
              <Text style={{ color: theme.onSurface, fontSize: F.hero, fontWeight: '700', letterSpacing: -1 }}>{earnedCount}</Text>
              <Text style={{ color: theme.onSurfaceMuted, fontSize: F.title, fontWeight: '700' }}>/ {total}</Text>
            </View>
            <View style={{ width: '62%', height: 6, borderRadius: R.full, backgroundColor: theme.separator, overflow: 'hidden', marginTop: S.md }}>
              <View style={{ width: `${Math.max(3, pctAll)}%`, height: '100%', backgroundColor: theme.tertiary, borderRadius: R.full }} />
            </View>
            <Text style={{ color: theme.onSurfaceMuted, fontSize: F.footnote, fontWeight: '500', marginTop: S.sm, textAlign: 'center' }}>
              {earnedCount === 0
                ? (tr ? 'İlk madalyanı kazanmaya çok yakınsın.' : 'Your first medal is within reach.')
                : earnedCount === total
                  ? (tr ? 'Koleksiyon tamamlandı. Efsane.' : 'Collection complete. Legendary.')
                  : (tr ? `Koleksiyonun %${pctAll} dolu — devam et.` : `Your collection is ${pctAll}% full — keep going.`)}
            </Text>
          </View>

          {/* ── Kategoriler ── */}
          {CATEGORIES.map(cat => (
            <View key={cat.key} style={{ marginBottom: S.xl }}>
              <Text style={{ color: theme.onSurfaceVariant, fontSize: F.footnote, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: S.md }}>
                {tr ? cat.titleTr : cat.titleEn}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: colGap }}>
                {cat.ids.map(id => {
                  const a = ACHIEVEMENTS[id];
                  if (!a) return null;
                  const earned = unlocked.includes(id);
                  const p = !earned ? progressOf(id) : null;
                  const color = ACHIEVEMENT_ICONS[id]?.color || theme.primary;
                  return (
                    <Touchable
                      key={id}
                      activeOpacity={0.85}
                      onPress={() => open(a, earned)}
                      style={{
                        width: tileW,
                        alignItems: 'center',
                        paddingVertical: S.lg,
                        paddingHorizontal: S.md,
                        borderRadius: R.lg,
                        borderWidth: B.thin,
                        borderColor: earned ? color + '2E' : theme.separator,
                        backgroundColor: earned
                          ? color + (isDark ? '14' : '0D')
                          : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'),
                      }}
                    >
                      <Medal id={id} earned={earned} size={64} />
                      <Text
                        numberOfLines={2}
                        style={{ color: earned ? theme.onSurface : theme.onSurfaceVariant, fontSize: F.footnote, fontWeight: '700', textAlign: 'center', marginTop: S.md, lineHeight: 16 }}
                      >
                        {tr ? a.titleTr : a.titleEn}
                      </Text>
                      {earned ? (
                        <Text style={{ color: theme.tertiary, fontSize: F.caption, fontWeight: '700', marginTop: S.xs }}>
                          {tr ? '✓ Açıldı' : '✓ Earned'}
                        </Text>
                      ) : p ? (
                        <View style={{ width: '82%', marginTop: S.sm, gap: S.xxs }}>
                          <View style={{ height: 4, borderRadius: R.full, backgroundColor: theme.separator, overflow: 'hidden' }}>
                            <View style={{ width: `${Math.max(4, Math.min(100, Math.round((p.cur / p.target) * 100)))}%`, height: '100%', backgroundColor: color, borderRadius: R.full }} />
                          </View>
                          <Text style={{ color: theme.onSurfaceMuted, fontSize: F.caption, fontWeight: '700', textAlign: 'center' }}>
                            {p.cur}/{p.target}{p.unit ?? ''}
                          </Text>
                        </View>
                      ) : (
                        <Text style={{ color: theme.onSurfaceMuted, fontSize: F.caption, fontWeight: '600', marginTop: S.xs }}>
                          {tr ? 'Kilitli' : 'Locked'}
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

      {/* ── Tam-ekran madalya detayı (Alert değil — hayran olunacak an) ── */}
      <Modal visible={!!detail} transparent animationType="fade" onRequestClose={() => setDetail(null)}>
        {detail && (() => {
          const color = ACHIEVEMENT_ICONS[detail.id]?.color || theme.primary;
          const p = !detail.earned ? progressOf(detail.id) : null;
          return (
            <Touchable activeOpacity={1} onPress={() => setDetail(null)} style={{ flex: 1 }}>
              <BlurView intensity={isDark ? 55 : 40} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.20)' }]} />
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: S.xl }}>
                <MotiView
                  from={{ opacity: 0, scale: 0.85, translateY: 12 }}
                  animate={{ opacity: 1, scale: 1, translateY: 0 }}
                  transition={{ type: 'spring', damping: 15, stiffness: 180 }}
                  style={{
                    width: '100%', maxWidth: 340, alignItems: 'center',
                    backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLowest,
                    borderColor: theme.separator, borderWidth: B.thin,
                    borderRadius: R.xl, padding: S.xl,
                  }}
                >
                  <View
                    style={{
                      width: 112, height: 112, borderRadius: R.full, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: detail.earned ? color : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                      borderWidth: detail.earned ? 0 : B.thin, borderColor: theme.separator,
                      shadowColor: color, shadowOffset: { width: 0, height: 10 }, shadowOpacity: detail.earned ? 0.35 : 0, shadowRadius: 18, elevation: detail.earned ? 8 : 0,
                    }}
                  >
                    {renderAchievementIcon(detail.id, 52, !detail.earned)}
                  </View>

                  <Text numberOfLines={2} style={{ color: theme.onSurface, fontSize: F.title, fontWeight: '700', letterSpacing: -0.4, textAlign: 'center', marginTop: S.lg }}>
                    {tr ? detail.titleTr : detail.titleEn}
                  </Text>
                  <Text style={{ color: theme.onSurfaceMuted, fontSize: F.body, fontWeight: '500', textAlign: 'center', lineHeight: 21, marginTop: S.xs }}>
                    {tr ? detail.subtitleTr : detail.subtitleEn}
                  </Text>

                  {detail.earned ? (
                    <View style={{ marginTop: S.lg, alignItems: 'center', gap: S.sm }}>
                      <View style={{ paddingHorizontal: S.md, paddingVertical: S.xs, borderRadius: R.full, backgroundColor: theme.tertiary + '1C' }}>
                        <Text style={{ color: theme.tertiary, fontSize: F.caption, fontWeight: '700', letterSpacing: 0.5 }}>
                          {tr ? '✓ BAŞARIM AÇILDI' : '✓ ACHIEVEMENT EARNED'}
                        </Text>
                      </View>
                      {unlockedAt[detail.id] && (
                        <Text style={{ color: theme.onSurfaceMuted, fontSize: F.caption, fontWeight: '500' }}>
                          {new Date(unlockedAt[detail.id]).toLocaleDateString(tr ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </Text>
                      )}
                    </View>
                  ) : (
                    <View style={{ marginTop: S.lg, width: '100%', alignItems: 'center', gap: S.sm }}>
                      <Text style={{ color: theme.onSurfaceVariant, fontSize: F.footnote, fontWeight: '600', textAlign: 'center' }}>
                        {tr ? `Nasıl açılır: ${hint(detail.id, true)}` : `How to unlock: ${hint(detail.id, false)}`}
                      </Text>
                      {p && (
                        <View style={{ width: '80%', gap: S.xxs }}>
                          <View style={{ height: 6, borderRadius: R.full, backgroundColor: theme.separator, overflow: 'hidden' }}>
                            <View style={{ width: `${Math.max(4, Math.min(100, Math.round((p.cur / p.target) * 100)))}%`, height: '100%', backgroundColor: color, borderRadius: R.full }} />
                          </View>
                          <Text style={{ color: theme.onSurfaceMuted, fontSize: F.caption, fontWeight: '700', textAlign: 'center' }}>
                            {p.cur} / {p.target}{p.unit ?? ''}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  <Touchable
                    onPress={() => setDetail(null)}
                    accessibilityRole="button"
                    accessibilityLabel={tr ? 'Kapat' : 'Close'}
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
