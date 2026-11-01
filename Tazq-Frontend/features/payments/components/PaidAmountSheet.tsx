import React, { useEffect, useState } from 'react';
import { View, Text, Modal, StyleSheet, KeyboardAvoidingView, TextInput } from 'react-native';
import { Touchable } from '@/shared/components/Touchable';
import { GlassSurface } from '@/shared/components/GlassSurface';
import { F, S, R, B, W, SCRIM } from '@/shared/constants/tokens';
import type { AppTheme } from '@/shared/constants/Colors';

/*
  "BU AY NE KADAR ÖDEDİN?" (2026-11-01, kullanıcı: "fiyatı sabit olmayan ama her ay ödenen — elektrik gibi").
  Değişken tutarlı ödemede "ödendi"ye basınca açılır: alan, son ödenen tutarla (tahmin) DOLU gelir — çoğu ay
  yalnız rakamı düzeltip onaylamak yeter. Girilen tutar geçmişe yazılır ve bir sonraki ayın tahmini olur.
*/
export function PaidAmountSheet({ visible, title, estimate, symbol, locale, theme, t, onConfirm, onCancel }: {
  visible: boolean;
  title: string;
  estimate: number;
  symbol: string;
  locale: string;
  theme: AppTheme;
  t: { paidAmountTitle: string; paidAmountSub: (title: string) => string; paidAmountConfirm: string; cancel: string };
  onConfirm: (amount: number) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState('');
  useEffect(() => {
    if (visible) setValue(estimate > 0 ? estimate.toLocaleString(locale, { useGrouping: false, maximumFractionDigits: 2 }) : '');
  }, [visible, estimate, locale]);
  const num = parseFloat(value.replace(',', '.'));
  const ok = Number.isFinite(num) && num > 0;

  return (
    <Modal supportedOrientations={['portrait', 'landscape']} visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={styles.backdrop}>
        <Touchable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityRole="button" accessibilityLabel={t.cancel} activeOpacity={1} />
        <View style={[styles.card, { borderColor: theme.outlineVariant }]}>
          {/* Bütün pencereler tek zeminden: cam yüzey (bkz. ios27Chrome testi). */}
          <GlassSurface radius={R.xl} />
          <Text accessibilityRole="header" style={[styles.title, { color: theme.onSurface }]}>{t.paidAmountTitle}</Text>
          <Text numberOfLines={1} style={[styles.sub, { color: theme.onSurfaceMuted }]}>{t.paidAmountSub(title)}</Text>
          <View style={[styles.field, { backgroundColor: theme.surfaceField }]}>
            <TextInput
              value={value}
              onChangeText={setValue}
              keyboardType="decimal-pad"
              autoFocus
              selectTextOnFocus
              accessibilityLabel={t.paidAmountTitle}
              style={[styles.input, { color: theme.onSurface }]}
              underlineColorAndroid="transparent"
              returnKeyType="done"
              onSubmitEditing={() => ok && onConfirm(num)}
            />
            <Text style={[styles.symbol, { color: theme.onSurfaceVariant }]}>{symbol}</Text>
          </View>
          <View style={styles.actions}>
            <Touchable onPress={onCancel} accessibilityRole="button" accessibilityLabel={t.cancel} style={[styles.btn, { borderColor: theme.outlineVariant, borderWidth: B.thin }]}>
              <Text style={[styles.btnText, { color: theme.onSurfaceVariant }]}>{t.cancel}</Text>
            </Touchable>
            <Touchable
              onPress={() => ok && onConfirm(num)}
              disabled={!ok}
              accessibilityRole="button"
              accessibilityLabel={t.paidAmountConfirm}
              accessibilityState={{ disabled: !ok }}
              style={[styles.btn, styles.primary, { backgroundColor: ok ? theme.primary : theme.primary + '55' }]}
            >
              <Text style={[styles.btnText, { color: theme.onPrimary }]}>{t.paidAmountConfirm}</Text>
            </Touchable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', paddingHorizontal: S.lg, backgroundColor: SCRIM },
  card: { borderRadius: R.xl, borderWidth: B.thin, padding: S.lg, gap: S.sm, overflow: 'hidden' },
  title: { fontSize: F.title3, fontWeight: W.bold, letterSpacing: -0.3 },
  sub: { fontSize: F.footnote },
  field: { flexDirection: 'row', alignItems: 'center', height: 56, borderRadius: R.md, paddingHorizontal: S.md, marginTop: S.sm },
  input: { flex: 1, height: '100%', fontSize: F.title, fontWeight: W.bold, fontVariant: ['tabular-nums'] },
  symbol: { fontSize: F.subhead, fontWeight: W.semibold },
  actions: { flexDirection: 'row', gap: S.sm, marginTop: S.md },
  btn: { flex: 1, height: 48, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  primary: { flex: 2 },
  btnText: { fontSize: F.body, fontWeight: W.semibold },
});
