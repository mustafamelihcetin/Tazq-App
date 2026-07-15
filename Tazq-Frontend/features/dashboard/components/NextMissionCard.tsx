import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { Rocket, Zap, ChevronRight, Plus } from 'lucide-react-native';
import { BentoCard } from '@/shared/components/BentoCard';
import { Touchable } from '@/shared/components/Touchable';
import { F, S, R, W, ICON, MIN_TOUCH, trackingFor } from '@/shared/constants/tokens';
import type { AppTheme } from '@/shared/constants/Colors';

/**
 * "Sonraki görev" kartı — dashboard'ın tek EYLEM çağrısı.
 *
 * PSİKOLOJİK ROL: yukarıdaki kartlar durumu anlatır (ne yaptın, neredesin); burası
 * "şimdi şunu yap" der. Ekranda tek dolu buton bunun olması bilinçli — iOS'ta da
 * bir ekranda tek birincil eylem vardır; ikisi olunca ikisi de birincil olmaz.
 *
 * Öncelik rengi kartın kimliği: aciliyet gradyanda, rozette ve rozet yazısında AYNI
 * kaynaktan gelir (bkz. accent). Eskiden iki yerde ayrı ayrı hesaplanıyordu —
 * biri değişse kart kendi içinde çelişirdi.
 */

export interface NextMissionCardProps {
  /** Sıradaki görev. Yoksa kart "görev ekle" davetine döner. */
  task: { id: string | number; priority: string } | null;
  /** Görevin başlığı (yerelleştirilmiş) — yoksa boş durum metni. */
  title: string;
  /** Açıklama ya da bekleme metni. */
  subtitle: string;
  /** Rozet metni ("SIRADAKİ"). */
  badgeLabel: string;
  /** Aciliyet rozeti gösterilsin mi (yüksek öncelik + mod görevi değil). */
  showUrgent: boolean;
  urgentLabel: string;
  primaryLabel: string;
  seeAllLabel: string;
  onOpenTask: () => void;
  onSeeAll: () => void;
  /** Önceliği renge çeviren TEK kaynak. */
  priorityColor: (p: string) => string;
  isSmallScreen: boolean;
  isDark: boolean;
  theme: AppTheme;
  padding: number;
}

export const NextMissionCard = React.memo<NextMissionCardProps>(
  ({
    task, title, subtitle, badgeLabel, showUrgent, urgentLabel, primaryLabel, seeAllLabel,
    onOpenTask, onSeeAll, priorityColor, isSmallScreen, isDark, theme, padding,
  }) => {
    // TEK kaynak: gradyan, rozet ve rozet yazısı hep bunu kullanır. Eskiden gradyan
    // önceliği kendi if/else'iyle renge çeviriyordu, rozet ise priorityColor() ile —
    // aynı eşleme iki yerde yazılıydı.
    const accent = task ? priorityColor(task.priority) : theme.onSurfaceVariant;

    return (
      <View style={styles.wrap}>
        <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: 'timing', duration: 250 }}>
          <BentoCard index={1} style={[styles.card, { minHeight: isSmallScreen ? 120 : 140, padding }]}>
            {/* Dekoratif katman — metin değil, o yüzden opacity meşru. */}
            <LinearGradient
              colors={[accent, 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, { opacity: isDark ? 0.25 : 0.12 }]}
            />

            <View style={styles.header}>
              <View style={[styles.badge, { backgroundColor: accent + (isDark ? '25' : '18') }]}>
                <Rocket size={ICON.xs} color={accent} />
                <Text style={[styles.badgeText, { color: accent }]}>{badgeLabel}</Text>
              </View>

              {showUrgent && (
                <View style={[styles.badge, { backgroundColor: theme.error + '20' }]}>
                  <Zap size={ICON.xs} color={theme.error} fill={theme.error} />
                  <Text style={[styles.badgeText, { color: theme.error }]}>{urgentLabel}</Text>
                </View>
              )}
            </View>

            <View style={styles.content}>
              <Text
                testID="mission-title"
                adjustsFontSizeToFit
                minimumFontScale={0.85}
                numberOfLines={2}
                style={[styles.title, { color: theme.onSurface }]}
              >
                {title}
              </Text>
              <Text style={[styles.sub, { color: theme.onSurfaceMuted }]} numberOfLines={2}>
                {subtitle}
              </Text>
            </View>

            <View style={styles.footer}>
              <Touchable
                testID="mission-primary"
                onPress={task ? onOpenTask : onSeeAll}
                accessibilityRole="button"
                accessibilityLabel={primaryLabel}
                style={[
                  styles.primaryBtn,
                  { backgroundColor: task ? theme.primary : theme.surfaceContainerHigh },
                ]}
              >
                {/*
                  Görev yoksa buton "ekle" davetine döner: dolu mavi yerine sessiz zemin,
                  çünkü ortada henüz bir eylem yok — davet var. Renk = anlam.
                */}
                {!task && <Plus size={ICON.md} color={theme.onSurface} />}
                <Text style={[styles.primaryText, { color: task ? theme.onPrimary : theme.onSurface }]}>
                  {primaryLabel}
                </Text>
                {/*
                  Ok SAĞDA. Eskiden metinden ÖNCE geliyordu: sağı gösteren bir ok, etiketin
                  solunda durup metne doğru bakıyordu. Ok "ileri" der; solda durunca
                  gösterdiği yer etiketin kendisi olur ve anlamı kaybolur.
                */}
                {task && <ChevronRight size={ICON.md} color={theme.onPrimary} />}
              </Touchable>

              <Touchable
                onPress={onSeeAll}
                accessibilityRole="button"
                accessibilityLabel={seeAllLabel}
                style={styles.seeAllBtn}
              >
                <Text style={[styles.seeAllText, { color: theme.onSurfaceVariant }]}>{seeAllLabel}</Text>
                <ChevronRight size={ICON.sm} color={theme.onSurfaceVariant} />
              </Touchable>
            </View>
          </BentoCard>
        </MotiView>
      </View>
    );
  },
);

NextMissionCard.displayName = 'NextMissionCard';

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: S.lg, marginBottom: S.lg },
  card: { justifyContent: 'space-between', overflow: 'hidden' },
  header: { flexDirection: 'row', gap: S.sm },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.xs,
    paddingHorizontal: S.sm,
    paddingVertical: S.xs,
    borderRadius: R.full,
  },
  badgeText: { fontSize: F.caption, fontWeight: W.medium, letterSpacing: 0.5 },
  content: { marginTop: S.xxs },
  title: {
    fontSize: F.subhead,
    fontWeight: W.semibold,
    letterSpacing: trackingFor(F.subhead),
  },
  sub: { fontSize: F.body, fontWeight: W.regular, marginTop: S.xs },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: S.md,
    gap: S.sm,
  },
  primaryBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: S.sm,
    paddingHorizontal: S.md,
    // Dokunma hedefi Apple'ın alt sınırının üstünde. 52 yazılıydı — doğruydu ama
    // sayının nereden geldiği belli değildi; artık sınırla ilişkisi görünüyor.
    height: MIN_TOUCH + S.sm,
    borderRadius: R.md,
  },
  // Buradaki metnin rengi HER ZAMAN kullanım yerinden gelir (task ? onPrimary : onSurface).
  // Stilde `color: 'white'` yazılıydı: ezilmediği an koyu temada yanlış olurdu, çünkü
  // koyu temada onPrimary KOYU'dur (bkz. Colors.ts). Sessiz bekleyen bir tuzaktı.
  primaryText: { fontWeight: W.semibold, fontSize: F.subhead },
  seeAllBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: S.xs,
    height: MIN_TOUCH + S.sm,
  },
  seeAllText: { fontSize: F.body, fontWeight: W.semibold },
});
