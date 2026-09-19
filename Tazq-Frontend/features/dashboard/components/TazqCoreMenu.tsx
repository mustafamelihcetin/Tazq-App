import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { Plus, Wind, Target, Settings, type LucideIcon } from 'lucide-react-native';
import { GlassSurface } from '@/shared/components/GlassSurface';
import { Touchable } from '@/shared/components/Touchable';
import { F, S, R, W, ICON, MIN_TOUCH, topBarSpace } from '@/shared/constants/tokens';
import type { AppTheme } from '@/shared/constants/Colors';

/**
 * TAZQ CORE — marka işaretinin açtığı menü.
 *
 * ── ÖNCEKİ HÂLİN SORUNLARI ────────────────────────────────────────────────────
 *  · Menü kapanırken bir sonraki yüzeyi `setTimeout(50)` ile açıyordu. iOS bir modal
 *    kapanırken ikincisini açmayı SESSİZCE reddedebilir: "Hızlı Ekle"ye basınca bazen
 *    hiçbir şey açılmıyordu. Eylem artık menü GERÇEKTEN kapandıktan sonra çalışıyor
 *    (iOS: onDismiss; Android'de o olay yok, kapanış anında; güvenlik için süreli yedek).
 *  · `if (!visible) return null` modalı kapanış animasyonu bitmeden söküyordu — iOS'ta
 *    onDismiss de bu yüzden hiç gelmezdi. Modal artık hep bağlı; görünürlüğü prop yönetiyor.
 *  · "Ayarlar" profil sayfasına gidiyordu; ayarların kendi sayfası var.
 *  · "Sıradaki İş" hangi işe odaklanılacağını söylemiyordu ve kırmızıydı (kırmızı hata
 *    içindir). Satır artık görevin adını gösteriyor; iş yoksa serbest odak olduğunu.
 *  · Ekran okuyucu satırların düğme olduğunu duymuyordu; zemin opak ve sabit renkliydi.
 */

export interface TazqCoreMenuProps {
  visible: boolean;
  onClose: () => void;
  onQuickAdd: () => void;
  onSaveTheDay: () => void;
  onFocus: () => void;
  /** Odak seansının bağlanacağı görev — yoksa serbest odak. */
  focusTaskTitle: string | null;
  onSettings: () => void;
  theme: AppTheme;
  tr: boolean;
}

const copy = (tr: boolean) => tr
  ? {
      menu: 'TAZQ menüsü',
      quickAdd: 'Ara veya Ekle',
      saveDay: 'Günü Kurtar',
      saveDayHint: 'Birikeni dağıtır ya da günü sadeleştirir',
      focus: 'Odaklan',
      freeFocus: 'Serbest odak · 25 dk',
      settings: 'Ayarlar',
    }
  : {
      menu: 'TAZQ menu',
      quickAdd: 'Search or Add',
      saveDay: 'Save the Day',
      saveDayHint: 'Spreads the backlog or simplifies today',
      focus: 'Focus',
      freeFocus: 'Free focus · 25 min',
      settings: 'Settings',
    };

/** iOS'ta onDismiss gelmezse eylemin yine de çalışacağı üst süre. */
const DISMISS_FALLBACK_MS = 450;

export const TazqCoreMenu = React.memo<TazqCoreMenuProps>(({
  visible, onClose, onQuickAdd, onSaveTheDay, onFocus, focusTaskTitle, onSettings, theme, tr,
}) => {
  const c = copy(tr);
  const insets = useSafeAreaInsets();
  const pendingRef = useRef<(() => void) | null>(null);
  const fallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Bekleyen eylemi EN FAZLA BİR KEZ çalıştırır. */
  const flush = () => {
    if (fallbackRef.current) { clearTimeout(fallbackRef.current); fallbackRef.current = null; }
    const run = pendingRef.current;
    pendingRef.current = null;
    run?.();
  };

  useEffect(() => {
    if (visible || !pendingRef.current) return;
    if (Platform.OS !== 'ios') { flush(); return; }
    fallbackRef.current = setTimeout(flush, DISMISS_FALLBACK_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => () => { if (fallbackRef.current) clearTimeout(fallbackRef.current); }, []);

  const choose = (action: () => void) => {
    pendingRef.current = action;
    onClose();
  };

  const items: { key: string; icon: LucideIcon; title: string; sub?: string; color: string; action: () => void }[] = [
    { key: 'add', icon: Plus, title: c.quickAdd, color: theme.primary, action: onQuickAdd },
    { key: 'zen', icon: Wind, title: c.saveDay, sub: c.saveDayHint, color: theme.tertiary, action: onSaveTheDay },
    { key: 'focus', icon: Target, title: c.focus, sub: focusTaskTitle ?? c.freeFocus, color: theme.primary, action: onFocus },
    { key: 'settings', icon: Settings, title: c.settings, color: theme.onSurfaceMuted, action: onSettings },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
      onDismiss={flush}
    >
      <View style={[styles.root, { paddingTop: topBarSpace(insets.top) + S.xs }]}>
        <Touchable
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.25)' }]}
          activeOpacity={1}
          onPress={onClose}
          accessible={false}
        />

        <MotiView
          from={{ opacity: 0, scale: 0.94, translateY: -8 }}
          animate={{ opacity: 1, scale: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 260 }}
          style={styles.card}
          accessibilityViewIsModal
          accessibilityLabel={c.menu}
        >
          <GlassSurface radius={R.lg} />
          {items.map((it, i) => {
            const Icon = it.icon;
            return (
              <Touchable
                key={it.key}
                onPress={() => choose(it.action)}
                accessibilityRole="menuitem"
                accessibilityLabel={it.sub ? `${it.title}, ${it.sub}` : it.title}
                style={[
                  styles.row,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.outlineVariant },
                ]}
              >
                <View style={styles.rowText}>
                  <Text style={[styles.title, { color: theme.onSurface }]}>{it.title}</Text>
                  {it.sub ? (
                    <Text style={[styles.sub, { color: theme.onSurfaceMuted }]} numberOfLines={1}>{it.sub}</Text>
                  ) : null}
                </View>
                <Icon size={ICON.md} color={it.color} strokeWidth={2.2} />
              </Touchable>
            );
          })}
        </MotiView>
      </View>
    </Modal>
  );
});

TazqCoreMenu.displayName = 'TazqCoreMenu';

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', paddingHorizontal: S.lg },
  card: {
    width: '100%',
    maxWidth: 300,
    borderRadius: R.lg,
    overflow: 'hidden',
    ...(Platform.OS === 'android' ? { elevation: 8 } : null),
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: S.md, minHeight: MIN_TOUCH, paddingVertical: S.smd, paddingHorizontal: S.md,
  },
  rowText: { flex: 1 },
  title: { fontSize: F.body, fontWeight: W.medium },
  sub: { fontSize: F.caption, marginTop: S.xxs },
});
