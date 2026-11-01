import React from 'react';
import { View, Text, Modal, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Inbox, Wallet, MessageSquare, Award, CalendarDays, CheckCircle2, X } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { GlassSurface } from '@/shared/components/GlassSurface';
import { SheetGrabber } from '@/shared/components/DragToClose';
import { F, S, R, B, W, ICON, MIN_TOUCH, TOP_ITEM_SIZE, SCRIM } from '@/shared/constants/tokens';
import type { AppTheme } from '@/shared/constants/Colors';
import type { InboxItem } from '@/features/dashboard/utils/inboxItems';

/*
  GELEN KUTUSU (2026-11-01) — Bugün'ün sağ üstü. Uygulamanın uyarıları TEK yerde: Zen önerisi, raf, yaklaşan ödeme,
  destek yanıtı, yeni başarım, yarının yükü. Zen ve raf kalemleri kendi eylemli kartlarıyla (dışarıdan verilir);
  diğerleri tek satır → sahibine götürür. Pencere içinden pencere açılmaz (iOS'ta görünmüyordu): eylem önce
  kutuyu kapatır, sonra hedefi açar (çağıran taraf yapar).
*/
const COPY = {
  tr: { title: 'Gelen', sub: 'Uygulamanın sana söylemek istedikleri, tek yerde.', empty: 'Her şey yolunda', emptySub: 'Yeni bir şey olunca burada görünür.', button: 'Gelen kutusu', unread: (n: number) => `${n} yeni`, clear: 'Temizle', remove: 'Kaldır' },
  en: { title: 'Inbox', sub: 'Everything the app wants to tell you, in one place.', empty: 'All clear', emptySub: 'New things will show up here.', button: 'Inbox', unread: (n: number) => `${n} new`, clear: 'Clear', remove: 'Remove' },
};

const ICONS = { payment: Wallet, support: MessageSquare, badge: Award, tomorrow: CalendarDays } as const;

export function InboxButton({ count, onPress, theme, language }: { count: number; onPress: () => void; theme: AppTheme; language: 'tr' | 'en' }) {
  const c = COPY[language];
  return (
    <Touchable
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? `${c.button}, ${c.unread(count)}` : c.button}
      style={styles.btnWrap}
    >
      <View style={[styles.btn, { borderColor: theme.outline, backgroundColor: theme.surfaceField }]}>
        <Inbox size={ICON.md} color={count > 0 ? theme.primary : theme.onSurface} strokeWidth={2} />
      </View>
      {count > 0 && (
        <View pointerEvents="none" style={[styles.badge, { backgroundColor: theme.primary, borderColor: theme.background }]}>
          <Text style={[styles.badgeText, { color: theme.onPrimary }]}>{count > 9 ? '9+' : count}</Text>
        </View>
      )}
    </Touchable>
  );
}

export function InboxSheet({ visible, onClose, items, zenCard, somedayCard, onItem, onDismiss, theme, language }: {
  visible: boolean;
  onClose: () => void;
  items: InboxItem[];
  zenCard: React.ReactNode;
  somedayCard: React.ReactNode;
  onItem: (item: InboxItem) => void;
  /** Kaldırma: tek kalem (çarpı) ya da hepsi (Temizle). */
  onDismiss: (ids: string[]) => void;
  theme: AppTheme;
  language: 'tr' | 'en';
}) {
  const c = COPY[language];
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  return (
    <Modal supportedOrientations={['portrait', 'landscape']} visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      {/* Düz karartma — bulanık zemin, arkadaki Skia aurasını kenarda yinelenmiş gibi gösteriyordu (iOS). */}
      <View style={styles.backdrop}>
        <Touchable style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} accessibilityRole="button" accessibilityLabel={language === 'en' ? 'Close' : 'Kapat'} />
        <View style={[styles.sheet, { maxHeight: height * 0.82, paddingBottom: insets.bottom + S.md }]}>
          <GlassSurface radius={R.sheet} corners="top" />
          <SheetGrabber onClose={onClose} color={theme.outlineVariant} />
          <View style={styles.head}>
            <View style={styles.headRow}>
              <Text accessibilityRole="header" style={[styles.title, { color: theme.onSurface }]}>{c.title}</Text>
              {items.length > 0 && (
                <Touchable onPress={() => onDismiss(items.map(it => it.id))} accessibilityRole="button" accessibilityLabel={c.clear} style={styles.clearBtn}>
                  <Text style={[styles.clearText, { color: theme.primary }]}>{c.clear}</Text>
                </Touchable>
              )}
            </View>
            <Text style={[styles.sub, { color: theme.onSurfaceMuted }]}>{c.sub}</Text>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: S.md }} showsVerticalScrollIndicator={false}>
            {items.length === 0 ? (
              <View style={styles.empty}>
                <CheckCircle2 size={ICON.xl} color={theme.success} />
                <Text style={[styles.emptyTitle, { color: theme.onSurface }]}>{c.empty}</Text>
                <Text style={[styles.sub, { color: theme.onSurfaceMuted, textAlign: 'center' }]}>{c.emptySub}</Text>
              </View>
            ) : items.map(item => {
              if (item.kind === 'zen') return <View key={item.id}>{zenCard}</View>;
              if (item.kind === 'someday') return <View key={item.id}>{somedayCard}</View>;
              const Icon = ICONS[item.kind];
              const tone = item.tone === 'error' ? theme.error : item.tone === 'warning' ? theme.warning : theme.onSurfaceMuted;
              return (
                <Touchable
                  key={item.id}
                  onPress={() => onItem(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title ?? ''}, ${item.sub ?? ''}`}
                  style={[styles.row, { backgroundColor: theme.surfaceCard, borderColor: theme.outlineVariant }]}
                >
                  <View style={[styles.rowIcon, { backgroundColor: theme.primary + '14' }]}>
                    <Icon size={ICON.sm} color={theme.primary} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={[styles.rowTitle, { color: theme.onSurface }]}>{item.title}</Text>
                    {!!item.sub && <Text numberOfLines={2} style={[styles.rowSub, { color: tone }]}>{item.sub}</Text>}
                  </View>
                  <Touchable onPress={() => onDismiss([item.id])} accessibilityRole="button" accessibilityLabel={`${c.remove}: ${item.title ?? ''}`} hitSlop={S.sm} style={styles.x}>
                    <X size={ICON.sm} color={theme.onSurfaceMuted} />
                  </Touchable>
                </Touchable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  btnWrap: { minWidth: MIN_TOUCH, minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  btn: { width: TOP_ITEM_SIZE, height: TOP_ITEM_SIZE, borderRadius: R.full, borderWidth: B.thin, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: S.xxs, right: S.xxs, minWidth: 18, height: 18, borderRadius: R.full, alignItems: 'center', justifyContent: 'center', paddingHorizontal: S.xs, borderWidth: B.medium },
  badgeText: { fontSize: F.caption, fontWeight: W.bold, fontVariant: ['tabular-nums'] },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: SCRIM },
  sheet: { borderTopLeftRadius: R.sheet, borderTopRightRadius: R.sheet, overflow: 'hidden', paddingTop: S.sm },
  handle: { width: 40, height: 4, borderRadius: R.full, alignSelf: 'center', marginBottom: S.md },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  clearBtn: { minHeight: MIN_TOUCH, justifyContent: 'center', paddingHorizontal: S.sm },
  clearText: { fontSize: F.body, fontWeight: W.semibold },
  x: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center', marginRight: -S.sm },
  head: { paddingHorizontal: S.lg, marginBottom: S.md, gap: S.xxs },
  title: { fontSize: F.title, fontWeight: W.bold, letterSpacing: -0.5 },
  sub: { fontSize: F.footnote, lineHeight: 18 },
  empty: { alignItems: 'center', gap: S.sm, paddingVertical: S.xxl, paddingHorizontal: S.lg },
  emptyTitle: { fontSize: F.subhead, fontWeight: W.semibold },
  row: { flexDirection: 'row', alignItems: 'center', gap: S.smd, marginHorizontal: S.lg, marginBottom: S.sm, padding: S.smd, borderRadius: R.lg, borderWidth: B.thin },
  rowIcon: { width: 36, height: 36, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: F.body, fontWeight: W.semibold },
  rowSub: { fontSize: F.footnote, marginTop: S.xxs },
});
