import React from 'react';
import { View, Text, Modal, StyleSheet } from 'react-native';
import { GlassSheet } from '@/shared/components/GlassSheet';
import { Bell, Sunrise, Sunset, ListChecks } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { S, R, F, ICON } from '@/shared/constants/tokens';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { haptic } from '@/shared/utils/haptics';

/**
 * BİLDİRİM ÖN-BİLGİLENDİRMESİ — sistem diyaloğundan ÖNCE, kendi dilimizle.
 *
 * ── ÖLÇÜLEN SORUN ─────────────────────────────────────────────────────────────
 * `_layout` girişten hemen sonra `requestNotificationPermissions()` çağırıyordu.
 * Kullanıcı henüz tek görev bile eklememişken sistem diyaloğunu görüyordu:
 * "TAZQ size bildirim göndermek istiyor". Ne göndereceğimiz yazmıyordu.
 *
 * iOS'ta o diyalog kullanıcı başına BİR KEZ gösterilebilir. Reddedilirse uygulama
 * bir daha SORAMAZ — kullanıcının Ayarlar'a gidip elle açması gerekir. Yani bağlamsız
 * sorulan tek bir soru, sabah özetini, akşam özetini, görev ve alışkanlık
 * hatırlatıcılarını kalıcı olarak kapatabiliyordu.
 *
 * ── ÇÖZÜM: ÖNCE BİZ ANLATIRIZ, SONRA SİSTEM SORAR ─────────────────────────────
 * Bu ekran ne göndereceğimizi tek tek sayar ve iki çıkış verir:
 *   · "Bildirimleri aç" → sistem diyaloğu açılır (tek hak burada kullanılır)
 *   · "Şimdi değil"     → sistem diyaloğu HİÇ açılmaz, hak DURUR
 *
 * İkinci seçenek asıl kazanç: fikrini sonra değiştiren kullanıcı Ayarlar'a gitmek
 * zorunda kalmaz, çünkü sistem ona hiç sormamıştır.
 *
 * ZAMANLAMA: giriş anında değil, kullanıcının hatırlatılacak bir şeyi olduğunda
 * gösterilir (bkz. _layout — en az bir görev). İzin, işe yarayacağı an istenir.
 */

export type NotificationPrimerProps = {
  visible: boolean;
  /** Kullanıcı kabul etti → sistem diyaloğunu açan çağrı burada yapılır. */
  onEnable: () => void;
  /** "Şimdi değil" → sistem diyaloğu açılmaz. */
  onDismiss: () => void;
};

export function NotificationPrimer({ visible, onEnable, onDismiss }: NotificationPrimerProps) {
  const { theme, isDark } = useAppTheme();
  // Metinler i18n sözlüğünden — bu ekranda satır içi iki dilli dallanma YOK.
  // Bkz. __tests__/i18nRatchet.test.ts (yeni kod sözlüğü kullanmak zorunda).
  const t = useLanguageStore(s2 => s2.t).notifPrimer;

  const rows = [
    { Icon: Sunrise, title: t.morningTitle, sub: t.morningSub },
    { Icon: ListChecks, title: t.taskTitle, sub: t.taskSub },
    { Icon: Sunset, title: t.eveningTitle, sub: t.eveningSub },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <GlassSheet>
          <View style={[styles.badge, { backgroundColor: theme.primary + '18' }]}>
            <Bell size={ICON.lg} color={theme.primary} strokeWidth={2.2} />
          </View>

          <Text style={[styles.title, { color: theme.onSurface }]}>
            {t.title}
          </Text>

          <Text style={[styles.sub, { color: theme.onSurfaceVariant }]}>
            {t.sub}
          </Text>

          <View style={styles.rows}>
            {rows.map(({ Icon, title, sub }) => (
              <View key={title} style={styles.row}>
                <Icon size={ICON.sm} color={theme.primary} strokeWidth={2.2} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, { color: theme.onSurface }]}>{title}</Text>
                  <Text style={[styles.rowSub, { color: theme.onSurfaceMuted }]}>{sub}</Text>
                </View>
              </View>
            ))}
          </View>

          <Touchable
            onPress={() => { haptic.commit(); onEnable(); }}
            accessibilityRole="button"
            accessibilityLabel={t.enable}
            style={[styles.primary, { backgroundColor: theme.primary }]}
          >
            <Text style={[styles.primaryText, { color: theme.onPrimary }]}>
              {t.enable}
            </Text>
          </Touchable>

          <Touchable
            onPress={() => { haptic.surface(); onDismiss(); }}
            accessibilityRole="button"
            accessibilityLabel={t.dismiss}
            accessibilityHint={t.dismissHint}
            style={styles.secondary}
          >
            <Text style={[styles.secondaryText, { color: theme.onSurfaceVariant }]}>
              {t.dismiss}
            </Text>
          </Touchable>
        </GlassSheet>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: S.lg },
  badge: { width: 52, height: 52, borderRadius: R.full, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  title: { fontSize: F.title3, fontWeight: '700', textAlign: 'center', letterSpacing: -0.3 },
  sub: { fontSize: F.body, textAlign: 'center', lineHeight: 20 },
  rows: { gap: S.smd, marginTop: S.xxs },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: S.smd },
  rowTitle: { fontSize: F.body, fontWeight: '700' },
  rowSub: { fontSize: F.caption + 1, fontWeight: '500', marginTop: S.xxs },
  primary: { paddingVertical: S.md, borderRadius: R.md, alignItems: 'center', marginTop: S.xs },
  primaryText: { fontSize: F.body, fontWeight: '700' },
  secondary: { paddingVertical: S.sm, alignItems: 'center' },
  secondaryText: { fontSize: F.body, fontWeight: '600' },
});
