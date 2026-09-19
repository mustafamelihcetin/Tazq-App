import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { Inbox } from 'lucide-react-native';
import { BentoCard } from '@/shared/components/BentoCard';
import { Touchable } from '@/shared/components/Touchable';
import { F, S, R, W, ICON, MIN_TOUCH } from '@/shared/constants/tokens';
import type { AppTheme } from '@/shared/constants/Colors';

/**
 * RAF HATIRLATMASI — "Belki Bir Gün"de bekleyen işler için haftalık tek satır.
 *
 * Zen işi rafa kaldırınca o iş başka hiçbir yerde kendini hatırlatmıyordu; kullanıcı
 * için bu "uygulama işimi sildi" demekti. Ne zaman gösterileceği kancada (useZen):
 * haftada en fazla bir kez, rafta iş varken, Zen kartı ekranda değilken.
 *
 * Bilinçli olarak KÜÇÜK: bir uyarı değil, bir hatırlatma. İki eylemin ikisi de
 * sayacı sıfırlar — "Sonra" da bir cevaptır; aynı gün tekrar sorulmaz.
 */

export interface SomedayNudgeProps {
  visible: boolean;
  count: number;
  onOpen: () => void;
  onLater: () => void;
  theme: AppTheme;
  tr: boolean;
}

const copy = (tr: boolean) => tr
  ? {
      title: (n: number) => `Rafta ${n} iş bekliyor`,
      body: 'Belki Bir Gün\'e kaldırdıkların. Göz atmak ister misin?',
      open: 'Göz at',
      later: 'Sonra',
    }
  : {
      title: (n: number) => `${n} tasks waiting on the shelf`,
      body: 'Things you moved to Someday. Want to take a look?',
      open: 'Take a look',
      later: 'Later',
    };

export const SomedayNudge = React.memo<SomedayNudgeProps>(({ visible, count, onOpen, onLater, theme, tr }) => {
  if (!visible || count <= 0) return null;
  const c = copy(tr);
  return (
    <MotiView from={{ opacity: 0, translateY: -6 }} animate={{ opacity: 1, translateY: 0 }} style={styles.wrap}>
      <BentoCard index={0} style={styles.card}>
        <View style={styles.row}>
          <View style={[styles.icon, { backgroundColor: theme.tertiary + '14' }]}>
            <Inbox size={ICON.sm} color={theme.tertiary} />
          </View>
          <View style={styles.text}>
            <Text style={[styles.title, { color: theme.onSurface }]}>{c.title(count)}</Text>
            <Text style={[styles.body, { color: theme.onSurfaceMuted }]}>{c.body}</Text>
          </View>
        </View>
        <View style={styles.actions}>
          <Touchable onPress={onLater} accessibilityRole="button" accessibilityLabel={c.later} style={styles.btn}>
            <Text style={[styles.later, { color: theme.onSurfaceMuted }]}>{c.later}</Text>
          </Touchable>
          <Touchable onPress={onOpen} accessibilityRole="button" accessibilityLabel={c.open} style={styles.btn}>
            <Text style={[styles.open, { color: theme.tertiary }]}>{c.open}</Text>
          </Touchable>
        </View>
      </BentoCard>
    </MotiView>
  );
});

SomedayNudge.displayName = 'SomedayNudge';

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: S.lg, marginBottom: S.lg },
  card: { padding: S.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: S.smd },
  icon: { width: ICON.lg + S.sm, height: ICON.lg + S.sm, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1 },
  title: { fontSize: F.body, fontWeight: W.semibold },
  body: { fontSize: F.caption, marginTop: S.xxs },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: S.sm, marginTop: S.xs },
  btn: { minHeight: MIN_TOUCH, justifyContent: 'center', paddingHorizontal: S.sm },
  later: { fontSize: F.body, fontWeight: W.medium },
  open: { fontSize: F.body, fontWeight: W.semibold },
});
