import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { startDataExport } from '@/shared/utils/startDataExport';
import { CloudUpload, Lock } from 'lucide-react-native';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { Touchable } from '@/shared/components/Touchable';
import { CustomAlert as Alert } from '@/shared/components/CustomAlert';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { haptic } from '@/shared/utils/haptics';
import { S, F, ICON, HAIRLINE, touchSlop } from '@/shared/constants/tokens';
import { langOf } from '@/shared/utils/lang';
import { DEVICE_ONLY_COPY } from './deviceOnlyCopy';

/*
  CİHAZDA KALAN VERİ NOTU (2026-10-25, kullanıcı: "cihazda kalsın ama bunu daha şık
  belirtelim, kullanıcı bilsin").

  Kilo ve bırakma kayıtları KVKK'da özel nitelikli sağlık verisi, bütçe finansal veri;
  bilerek sunucuya gönderilmiyor (gizlilik politikası §2.6). Kullanıcı bunu yalnız çıkış
  onayında öğreniyordu — yani veri kaybolmak üzereyken. Artık veriyi GİRDİĞİ kartın dibinde
  sakin bir satır: kilit + "Yalnız bu cihazda". Dokununca gerekçe ve yedek yolu.
  Bir uyarı değil, bir güvence: renk nötr, kırmızı/sarı yok.
*/

export function DeviceOnlyNote({ kind, backup }: { kind: 'health' | 'budget'; /** Verilirse kullanıcı onayıyla hesabına yedeklenebilir (kilo verilmez: bilerek cihazda). */ backup?: 'budget' | 'quit' }) {
  const consent = usePrefsStore(s => (backup ? s.dataBackup?.[backup] : undefined));
  const setDataBackup = usePrefsStore(s => s.setDataBackup);
  const { theme } = useAppTheme();
  const { language, t } = useLanguageStore();
  const c = DEVICE_ONLY_COPY[langOf(language)];

  const explain = () => {
    haptic.select();
    Alert.alert(c.title, kind === 'health' ? c.healthBody : c.budgetBody, [
      // Yedeği BURADA başlatır; eskiden Ayarlar'ın en üstünü açıp kullanıcıyı satırı aramaya bırakıyordu.
      { text: c.backup, onPress: () => startDataExport({ copy: t.exportFormat }) },
      { text: c.ok, style: 'cancel' },
    ]);
  };

  /*
    YEDEK AÇIK RIZAYLA (2026-11-06). Bu kayıtlara "sunucuya gitmez" diye söz verildi, bırakma sağlık verisi sayılabilir: sessizce taşınmaz, kullanıcı burada onaylar.
    Kapatınca sunucudaki kopya silinir (bkz. syncToCloud).
  */
  if (backup && consent === true) {
    return (
      <View style={[styles.wrap, { borderTopColor: theme.outlineVariant }]}>
        <Touchable
          onPress={() => { Alert.alert(c.offTitle, c.offBody, [{ text: c.offYes, style: 'destructive', onPress: () => setDataBackup(backup, false) }, { text: c.offNo, style: 'cancel' }]); }}
          accessibilityRole="button"
          accessibilityLabel={`${c.backedLine}. ${c.backedAction}`}
          hitSlop={touchSlop(32)}
          style={styles.row}
        >
          <CloudUpload size={ICON.xs} color={theme.success} strokeWidth={2.2} />
          <Text style={[styles.text, { color: theme.onSurfaceMuted }]}>
            {c.backedLine}
            <Text style={{ color: theme.onSurfaceVariant, fontWeight: '600' }}>{'  ·  '}{c.backedAction}</Text>
          </Text>
        </Touchable>
      </View>
    );
  }
  if (backup) {
    return (
      <View style={[styles.wrap, { borderTopColor: theme.outlineVariant }]}>
        <Touchable
          onPress={() => { haptic.select(); Alert.alert(c.askTitle, backup === 'quit' ? c.askQuit : c.askBudget, [{ text: c.askYes, onPress: () => setDataBackup(backup, true) }, { text: c.askNo, style: 'cancel' }]); }}
          accessibilityRole="button"
          accessibilityLabel={`${c.line}. ${c.backupCta}`}
          hitSlop={touchSlop(32)}
          style={styles.row}
        >
          <Lock size={ICON.xs} color={theme.onSurfaceMuted} strokeWidth={2.2} />
          <Text style={[styles.text, { color: theme.onSurfaceMuted }]}>
            {c.line}
            <Text style={{ color: theme.primary, fontWeight: '600' }}>{'  ·  '}{c.backupCta}</Text>
          </Text>
        </Touchable>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { borderTopColor: theme.outlineVariant }]}>
      <Touchable
        onPress={explain}
        accessibilityRole="button"
        accessibilityLabel={c.a11y}
        hitSlop={touchSlop(32)}
        style={styles.row}
      >
        <Lock size={ICON.xs} color={theme.onSurfaceMuted} strokeWidth={2.2} />
        <Text style={[styles.text, { color: theme.onSurfaceMuted }]}>
          {c.line}
          <Text style={{ color: theme.onSurfaceVariant, fontWeight: '600' }}>{'  ·  '}{c.why}</Text>
        </Text>
      </Touchable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderTopWidth: HAIRLINE, marginHorizontal: S.md, paddingVertical: S.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, minHeight: 32 },
  text: { fontSize: F.caption },
});
