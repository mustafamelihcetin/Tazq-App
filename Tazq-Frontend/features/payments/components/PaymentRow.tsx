import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { Check, Wallet } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { SwipeableItem } from '@/shared/components/SwipeableItem';
import { AppIcon } from '@/shared/components/AppIcon';
import { ICON, S, R, F, W, B, HAIRLINE, RSPRING, touchSlop } from '@/shared/constants/tokens';
import type { AppTheme } from '@/shared/constants/Colors';
import type { TranslationKeys } from '@/shared/constants/i18n';
import { matchProvider } from '@/shared/utils/paymentProviders';
import type { PaymentView } from '@/features/payments/utils/paymentDates';

/*
  ── ÖDEME SATIRI — gruplu liste (Things / iOS Ayarlar, bkz. TaskListItem) ────────
  Eskiden her ödeme ayrı bir kutuydu; tutar alt satırda tarihle aynı soluk puntoda,
  her satırın sağında bir çöp kutusu vardı. Banka/Wallet listelerinin ortak dili:
    · TUTAR sağda, tabular rakam — göz sütun hâlinde tarar
    · tarih GÖRELİ ("3 gün sonra", "22 gün gecikti") — aciliyet renkle de söylenir
    · silme kaydırarak (ve uzun basarak / ekran okuyucu eylemiyle) — sürekli görünen
      çöp kutusu altı satırda altı kez "sil" diye bağırıyordu.
  Ödenen satır ÜSTÜ ÇİZİLMEZ (alışkanlıklarda da kaldırıldı): tik + soluklaşma yeter.
*/

type Copy = TranslationKeys['payments'];

/** Göreli vade metni ve tonu — 2 haftadan uzaksa yalnız tarih (45 gün sonra bilgi değil). */
export function dueText(v: PaymentView, t: Copy, dateLabel: string): { text: string; tone: 'error' | 'warning' | 'muted' } {
  if (v.status === 'paid') return { text: `${t.paidLabel} · ${dateLabel}`, tone: 'muted' };
  if (v.status === 'overdue') return { text: `${t.overdueBy(-v.days)} · ${dateLabel}`, tone: 'error' };
  if (v.days === 0) return { text: t.dueToday, tone: 'warning' };
  if (v.days === 1) return { text: `${t.dueTomorrow} · ${dateLabel}`, tone: 'warning' };
  if (v.days <= 14) return { text: `${t.dueIn(v.days)} · ${dateLabel}`, tone: 'muted' };
  return { text: dateLabel, tone: 'muted' };
}

const RING = 26;

interface Props {
  view: PaymentView;
  position: 'only' | 'first' | 'middle' | 'last';
  theme: AppTheme;
  t: Copy;
  amountLabel: string;
  dateLabel: string;
  onToggle: () => void;
  onDelete: () => void;
}

export const PaymentRow = React.memo(({ view, position, theme, t, amountLabel, dateLabel, onToggle, onDelete }: Props) => {
  const { p, status } = view;
  const paid = status === 'paid';
  const isTop = position === 'first' || position === 'only';
  const isBottom = position === 'last' || position === 'only';
  const provider = matchProvider(p.title);
  const due = dueText(view, t, dateLabel);
  const toneColor = due.tone === 'error' ? theme.error : due.tone === 'warning' ? theme.warning : theme.onSurfaceMuted;

  return (
    <SwipeableItem onDelete={onDelete} flush={!isBottom}>
      <Touchable
        activeOpacity={0.7}
        onPress={onToggle}
        onLongPress={onDelete}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: paid }}
        accessibilityLabel={`${p.title}, ${amountLabel}, ${due.text}`}
        accessibilityHint={paid ? t.undoPaid : t.markPaid}
        accessibilityActions={[{ name: 'delete', label: t.delete }]}
        onAccessibilityAction={(e) => { if (e.nativeEvent.actionName === 'delete') onDelete(); }}
        style={{
          flexDirection: 'row', alignItems: 'center', paddingLeft: S.md,
          backgroundColor: theme.surfaceCard,
          borderTopLeftRadius: isTop ? R.lg : 0, borderTopRightRadius: isTop ? R.lg : 0,
          borderBottomLeftRadius: isBottom ? R.lg : 0, borderBottomRightRadius: isBottom ? R.lg : 0,
        }}
      >
        {/* Halka: gecikmişte kırmızı çerçeve — rengi yalnız durum söyler (bkz. TaskListItem). */}
        <View
          hitSlop={touchSlop(RING)}
          style={[styles.ring, { borderWidth: paid ? 0 : B.medium, borderColor: status === 'overdue' ? theme.error : theme.onSurfaceMuted, backgroundColor: paid ? theme.success : 'transparent' }]}
        >
          {paid && (
            <MotiView from={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', ...RSPRING.pop }}>
              <Check size={ICON.xs} color={theme.onPrimary} strokeWidth={3} />
            </MotiView>
          )}
        </View>

        {/* Ayırıcı halkanın sağından başlar — Apple listelerinin imzası. */}
        <View style={[styles.body, { borderBottomWidth: isBottom ? 0 : HAIRLINE, borderBottomColor: theme.separator }]}>
          <MotiView animate={{ opacity: paid ? 0.5 : 1 }} transition={{ type: 'timing', duration: 220 }} style={styles.inner}>
            {provider
              ? <AppIcon Icon={provider.icon} color={provider.color} size={32} radius={R.sm} iconSize={ICON.sm} />
              : (
                // Sağlayıcı yoksa NÖTR kutu: gri dolgu + beyaz glif koyu temada açık gri
                // bir kare olarak parlıyordu. Soluk nötr dolgu + ikincil glif iki temada da sakin durur.
                <View style={[styles.generic, { backgroundColor: theme.onSurfaceMuted + '26' }]}>
                  <Wallet size={ICON.sm} color={theme.onSurfaceVariant} />
                </View>
              )}
            <View style={{ flex: 1, gap: S.xxs }}>
              <Text style={{ color: theme.onSurface, fontWeight: W.semibold, fontSize: F.body }} numberOfLines={1}>{p.title}</Text>
              <Text style={{ color: toneColor, fontSize: F.caption, fontWeight: due.tone === 'muted' ? W.regular : W.semibold }} numberOfLines={1}>{due.text}</Text>
            </View>
            <Text style={{ color: theme.onSurface, fontSize: F.callout, fontWeight: W.semibold, fontVariant: ['tabular-nums'] }} numberOfLines={1}>
              {amountLabel}
            </Text>
          </MotiView>
        </View>
      </Touchable>
    </SwipeableItem>
  );
});

PaymentRow.displayName = 'PaymentRow';

const styles = StyleSheet.create({
  ring: { width: RING, height: RING, borderRadius: R.full, alignItems: 'center', justifyContent: 'center', marginRight: S.md },
  body: { flex: 1, paddingVertical: S.smd, paddingRight: S.md, minHeight: 60, justifyContent: 'center' },
  inner: { flexDirection: 'row', alignItems: 'center', gap: S.smd },
  generic: { width: 32, height: 32, borderRadius: R.sm, alignItems: 'center', justifyContent: 'center' },
});
