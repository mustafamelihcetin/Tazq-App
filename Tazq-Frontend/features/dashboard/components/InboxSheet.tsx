import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Modal, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { Inbox, Wallet, MessageSquare, Award, CalendarDays, X } from 'lucide-react-native';
import { TickCircle } from '@/shared/components/TickCircle';
import { QuietStar } from '@/features/dashboard/components/QuietStar';
import { UNDO_WINDOW_MS } from '@/shared/utils/deferredCommit';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';
import { haptic } from '@/shared/utils/haptics';
import { Touchable } from '@/shared/components/Touchable';
import { GlassSurface } from '@/shared/components/GlassSurface';
import { SheetGrabber } from '@/shared/components/DragToClose';
import { F, S, R, B, W, ICON, MIN_TOUCH, TOP_ITEM_SIZE, SCRIM, HAIRLINE } from '@/shared/constants/tokens';
import { DISPLAY_FONT } from '@/shared/components/DisplayPanel';
import { useContentMaxWidth } from '@/shared/components/ResponsiveColumns';
import { upperFor } from '@/shared/utils/localeCase';
import type { AppTheme } from '@/shared/constants/Colors';
import { isInfoKind, type InboxItem } from '@/features/dashboard/utils/inboxItems';

/*
  GELEN KUTUSU (2026-11-01) — Bugün'ün sağ üstü. Uygulamanın uyarıları TEK yerde: Zen önerisi, raf, yaklaşan ödeme,
  destek yanıtı, yeni başarım, yarının yükü. Zen ve raf kalemleri kendi eylemli kartlarıyla (dışarıdan verilir);
  diğerleri tek satır → sahibine götürür. Pencere içinden pencere açılmaz (iOS'ta görünmüyordu): eylem önce
  kutuyu kapatır, sonra hedefi açar (çağıran taraf yapar).
*/
const COPY = {
  tr: { pay: 'Ödendi işaretle', paid: (t: string) => `${t} ödendi`, undo: 'Geri al', removed: (t: string) => `${t} kaldırıldı`, action: 'Yapılacak', info: 'Bilgi', isNew: 'yeni', title: 'Gelen',
    summary: (pay: number, sup: number, other: number) => [pay ? `${pay} ödeme bekliyor` : '', sup ? `${sup} yanıt` : '', other ? `${other} bildirim` : ''].filter(Boolean).join(' · '), empty: 'Her şey yolunda', emptySub: 'Yeni bir şey olunca burada görünür.', button: 'Gelen kutusu', unread: (n: number) => `${n} yeni`, clear: 'Temizle', remove: 'Kaldır' },
  en: { pay: 'Mark as paid', paid: (t: string) => `${t} paid`, undo: 'Undo', removed: (t: string) => `${t} removed`, action: 'To do', info: 'Updates', isNew: 'new', title: 'Inbox',
    summary: (pay: number, sup: number, other: number) => [pay ? `${pay} payment${pay === 1 ? '' : 's'} waiting` : '', sup ? `${sup} repl${sup === 1 ? 'y' : 'ies'}` : '', other ? `${other} update${other === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · '), empty: 'All clear', emptySub: 'New things will show up here.', button: 'Inbox', unread: (n: number) => `${n} new`, clear: 'Clear', remove: 'Remove' },
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
        <View pointerEvents="none" style={[styles.badge, { backgroundColor: theme.primaryFill, borderColor: theme.background }]}>
          <Text style={[styles.badgeText, { color: theme.onPrimaryFill }]}>{count > 9 ? '9+' : count}</Text>
        </View>
      )}
    </Touchable>
  );
}

const TICK_MS = 300;

/**
 * Ödeme satırının başındaki daire. Sabit tutarlıda tik çizilir, sonra ödenir; değişken tutarlıda tutar sorulacağı için
 * tik çizilmez, doğrudan çağıran devralır.
 */
function PayCheck({ item, onPay, theme, label }: { item: InboxItem; onPay: () => void; theme: AppTheme; label: string }) {
  const [checked, setChecked] = useState(false);
  const reduce = useReduceMotion();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const press = () => {
    if (checked) return;
    if (item.variable) { onPay(); return; }
    setChecked(true);
    haptic.commit();
    timer.current = setTimeout(onPay, reduce ? 0 : TICK_MS);
  };
  return (
    <Touchable onPress={press} accessibilityRole="button" accessibilityLabel={`${label}: ${item.title ?? ''}`} style={styles.payCheck}>
      <TickCircle checked={checked} size={ICON.lg} color={theme.success} ringColor={theme.outline} tickColor={theme.onPrimary} />
    </Touchable>
  );
}

/** Ödenen satır yerinde kalır ve geri alma süresince "Geri al" sunar; pencere üstünde bildirim görünmediği için (iOS) burada. */
interface Settled { item: InboxItem; index: number; text: string; undo: () => boolean }

export function InboxSheet({ visible, onClose, items, zenCard, somedayCard, onItem, onPay, onDismiss, onRestore, fresh, theme, language }: {
  visible: boolean;
  onClose: () => void;
  items: InboxItem[];
  zenCard: React.ReactNode;
  somedayCard: React.ReactNode;
  onItem: (item: InboxItem) => void;
  /** Satırdan ödeme. Geri alma işlevi döner; tutar sorulacaksa ya da ödeme yoksa null. */
  onPay?: (item: InboxItem) => (() => boolean) | null;
  /** Kaldırma: tek kalem (çarpı) ya da bilgi grubu (Temizle). */
  onDismiss: (ids: string[]) => void;
  /** Kaldırmayı geri alır: satır geri alma süresince yerinde kalır. */
  onRestore?: (ids: string[]) => void;
  /** Kutu açıldığında yeni olanlar (Actual'daki unseenOnOpen): görüldü işareti açılışta konur ama nokta bu oturum boyunca kalır. */
  fresh?: string[];
  theme: AppTheme;
  language: 'tr' | 'en';
}) {
  const c = COPY[language];
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  // Tablette ve yatayda satırlar ekran boyu uzamaz.
  const contentW = useContentMaxWidth();
  const [settled, setSettled] = useState<Settled[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const settle = (id: string) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    setSettled(list => list.filter(x => x.item.id !== id));
  };
  // Kapanınca süreler işlemi sessizce tamamlar (bkz. deferredCommit); satırlar yeniden açılışta kalmaz.
  useEffect(() => {
    if (visible) return;
    timers.current.forEach(clearTimeout);
    timers.current.clear();
    setSettled([]);
  }, [visible]);
  useEffect(() => {
    const map = timers.current;
    return () => map.forEach(clearTimeout);
  }, []);
  const pay = (item: InboxItem, index: number) => {
    const undo = onPay?.(item);
    if (!undo) return;
    keep(item, index, c.paid(item.title ?? ''), undo);
  };
  const keep = (item: InboxItem, index: number, text: string, undo: () => boolean) => {
    setSettled(list => [...list, { item, index, text, undo }]);
    timers.current.set(item.id, setTimeout(() => settle(item.id), UNDO_WINDOW_MS));
  };
  const remove = (item: InboxItem, index: number) => {
    onDismiss([item.id]);
    if (onRestore) keep(item, index, c.removed(item.title ?? ''), () => { onRestore([item.id]); return true; });
  };
  // Ödenen satır listede eski yerinde durur; süre bitince kapanır, aradaki satırlar yukarı kayar.
  const live = items.filter(it => !settled.some(x => x.item.id === it.id));
  const rows: { item: InboxItem; settled?: Settled }[] = live.map(item => ({ item }));
  for (const x of [...settled].sort((a, b) => a.index - b.index)) rows.splice(Math.min(x.index, rows.length), 0, { item: x.item, settled: x });
  const indexed = rows.map((r, index) => ({ ...r, index }));
  const cards = indexed.filter(r => !r.settled && (r.item.kind === 'zen' || r.item.kind === 'someday'));
  const actions = indexed.filter(r => !isInfoKind(r.item.kind) && r.item.kind !== 'zen' && r.item.kind !== 'someday');
  const infos = indexed.filter(r => isInfoKind(r.item.kind));
  const liveInfo = infos.filter(r => !r.settled).map(r => r.item.id);
  const count = (k: InboxItem['kind']) => live.filter(i => i.kind === k).length;
  const summary = c.summary(count('payment'), count('support'), live.length - count('payment') - count('support'));

  const renderRow = ({ item, settled: done, index }: (typeof indexed)[number], first: boolean) => {
    const divider = first ? null : { borderTopWidth: HAIRLINE, borderTopColor: theme.separator };
    if (done) {
      return (
        <Animated.View key={item.id} entering={FadeIn.duration(160)} exiting={FadeOut.duration(160)} layout={LinearTransition.duration(220)} style={[styles.row, divider]}>
          <Text numberOfLines={1} accessibilityLiveRegion="polite" style={[styles.rowTitle, { flex: 1, color: theme.onSurfaceVariant }]}>{done.text}</Text>
          <Touchable onPress={() => { done.undo(); settle(item.id); }} accessibilityRole="button" accessibilityLabel={`${c.undo}: ${item.title ?? ''}`} style={styles.clearBtn}>
            <Text style={[styles.clearText, { color: theme.primary }]}>{c.undo}</Text>
          </Touchable>
        </Animated.View>
      );
    }
    const Icon = ICONS[item.kind as keyof typeof ICONS];
    const tone = item.tone === 'error' ? theme.error : item.tone === 'warning' ? theme.warning : theme.onSurfaceMuted;
    const isFresh = fresh?.includes(item.id);
    return (
      <Animated.View key={item.id} layout={LinearTransition.duration(220)} exiting={FadeOut.duration(160)}>
        <Touchable
          onPress={() => onItem(item)}
          accessibilityRole="button"
          accessibilityLabel={[item.title, item.amount, item.sub, isFresh ? c.isNew : null].filter(Boolean).join(', ')}
          style={[styles.row, divider]}
        >
          {item.kind === 'payment' && onPay && typeof item.ref === 'number' ? (
            <PayCheck item={item} theme={theme} label={c.pay} onPay={() => pay(item, index)} />
          ) : (
            <View style={[styles.rowIcon, { backgroundColor: theme.primaryFill + '14' }]}>
              <Icon size={ICON.sm} color={theme.primary} />
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.titleLine}>
              {isFresh && <View testID="inbox-fresh" style={[styles.freshDot, { backgroundColor: theme.primaryFill }]} />}
              <Text numberOfLines={1} style={[styles.rowTitle, { flexShrink: 1, color: theme.onSurface }]}>{item.title}</Text>
            </View>
            {!!item.sub && <Text numberOfLines={2} style={[styles.rowSub, { color: tone }]}>{item.sub}</Text>}
          </View>
          {!!item.amount && <Text numberOfLines={1} style={[styles.amount, { color: theme.onSurface }]}>{item.amount}</Text>}
          <Touchable onPress={() => remove(item, index)} accessibilityRole="button" accessibilityLabel={`${c.remove}: ${item.title ?? ''}`} style={styles.x}>
            <X size={ICON.sm} color={theme.onSurfaceMuted} />
          </Touchable>
        </Touchable>
      </Animated.View>
    );
  };
  const group = (list: typeof indexed) => (
    <View style={[styles.group, { backgroundColor: theme.surfaceCard, borderColor: theme.outlineVariant }]}>
      {list.map((r, i) => renderRow(r, i === 0))}
    </View>
  );

  return (
    <Modal supportedOrientations={['portrait', 'landscape']} visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      {/* Düz karartma — bulanık zemin, arkadaki Skia aurasını kenarda yinelenmiş gibi gösteriyordu (iOS). */}
      <View style={styles.backdrop}>
        <Touchable style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} accessibilityRole="button" accessibilityLabel={language === 'en' ? 'Close' : 'Kapat'} />
        <View style={[styles.sheet, { width: '100%', maxWidth: contentW, alignSelf: 'center', maxHeight: height * 0.82, paddingBottom: insets.bottom + S.md }]}>
          <GlassSurface radius={R.sheet} corners="top" />
          <SheetGrabber onClose={onClose} color={theme.outlineVariant} />
          <View style={styles.head}>
            <Text accessibilityRole="header" style={[styles.title, { color: theme.onSurface }]}>{c.title}</Text>
            {!!summary && <Text style={[styles.sub, { color: theme.onSurfaceMuted }]}>{summary}</Text>}
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: S.md }} showsVerticalScrollIndicator={false}>
            {rows.length === 0 ? (
              <View style={styles.empty}>
                <QuietStar color={theme.warning} />
                <Text style={[styles.emptyTitle, { color: theme.onSurface }]}>{c.empty}</Text>
                <Text style={[styles.sub, { color: theme.onSurfaceMuted, textAlign: 'center' }]}>{c.emptySub}</Text>
              </View>
            ) : (
              <>
                {cards.map(({ item }) => <View key={item.id}>{item.kind === 'zen' ? zenCard : somedayCard}</View>)}
                {actions.length > 0 && (
                  <>
                    {infos.length > 0 && <Text accessibilityRole="header" style={[styles.groupLabel, { color: theme.onSurfaceMuted }]}>{upperFor(c.action, language)}</Text>}
                    {group(actions)}
                  </>
                )}
                {infos.length > 0 && (
                  <>
                    <View style={styles.groupHead}>
                      <Text accessibilityRole="header" style={[styles.groupLabel, styles.groupLabelFlush, { color: theme.onSurfaceMuted }]}>{upperFor(c.info, language)}</Text>
                      {liveInfo.length > 0 && (
                        <Touchable onPress={() => onDismiss(liveInfo)} accessibilityRole="button" accessibilityLabel={c.clear} style={styles.clearBtn}>
                          <Text style={[styles.clearText, { color: theme.primary }]}>{c.clear}</Text>
                        </Touchable>
                      )}
                    </View>
                    {group(infos)}
                  </>
                )}
              </>
            )}
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
  payCheck: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center', marginVertical: -S.xs },
  x: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center', marginLeft: -S.sm, marginRight: -S.xs },
  head: { paddingHorizontal: S.lg, marginBottom: S.md, gap: S.xxs },
  title: { fontSize: F.title, fontWeight: W.bold, letterSpacing: -0.5 },
  sub: { fontSize: F.footnote, lineHeight: 18 },
  empty: { alignItems: 'center', gap: S.sm, paddingVertical: S.xxl, paddingHorizontal: S.lg },
  emptyTitle: { fontSize: F.subhead, fontWeight: W.semibold },
  group: { marginHorizontal: S.lg, marginBottom: S.md, borderRadius: R.lg, borderWidth: B.thin, overflow: 'hidden' },
  groupHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: S.lg },
  groupLabel: { fontSize: F.caption, fontWeight: W.semibold, letterSpacing: 1.2, marginHorizontal: S.lg, marginBottom: S.sm },
  groupLabelFlush: { marginHorizontal: 0, marginBottom: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: S.smd, paddingVertical: S.smd, paddingLeft: S.smd, paddingRight: S.sm, minHeight: MIN_TOUCH + S.md },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: S.xs },
  freshDot: { width: S.xs, height: S.xs, borderRadius: R.full },
  amount: { fontFamily: DISPLAY_FONT.digits, fontSize: F.footnote, fontVariant: ['tabular-nums'] },
  rowIcon: { width: 36, height: 36, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: F.body, fontWeight: W.semibold },
  rowSub: { fontSize: F.footnote, marginTop: S.xxs },
});
