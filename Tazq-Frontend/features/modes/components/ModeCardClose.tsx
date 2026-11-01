import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Touchable } from '@/shared/components/Touchable';
import { CustomAlert as Alert } from '@/shared/components/CustomAlert';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { haptic } from '@/shared/utils/haptics';
import { S, F, HAIRLINE, touchSlop } from '@/shared/constants/tokens';
import { langOf } from '@/shared/utils/lang';

/*
  MOD KARTINI KAPATMA SATIRI (2026-10-31, denetim).

  Kartın başlığında bir anahtar (Switch) vardı. Ama kart yalnız mod AÇIKKEN listeleniyor:
  anahtar hep "açık" görünüyor, kapatınca kart planıyla birlikte siliniyordu — anahtar
  kılığında bir sil düğmesi, üstelik adsız ("anahtar, açık").

  Başlığa konan çarpı "çıkmaya yöneltiyor", "⋯" ise kapatmayla ilgisiz bulundu (cihazda).
  Uygulamanın kendi kalıbı: geri dönüşü ağır eylem EN ALTTA, sakin bir metin satırı
  (Ayarlar → hesabı sil; kartlardaki "Yalnız bu cihazda" notu aynı biçim). Başlık yalnız
  hedefi anlatır. Dokununca TEK pencere: ne kaldırılacağı ve hemen geri alınabileceği;
  ikinci onay yok, güvence "Geri al" bildirimi (closeModeWithUndo).
  Ramazan kartı bunu KULLANMAZ: kapalıyken de öneri olarak görünür, anahtar orada gerçek.
*/
const COPY = {
  tr: {
    name: { exam: 'Sınav takibi', tez: 'Tez / proje', mulakat: 'İş mülakatı', spor: 'Spor', tasarruf: 'Tasarruf', birakma: 'Bırakma' },
    row: { exam: 'Sınav takibini kapat', tez: 'Tez modunu kapat', mulakat: 'Mülakat modunu kapat', spor: 'Spor modunu kapat', tasarruf: 'Tasarruf modunu kapat', birakma: 'Bırakma modunu kapat' },
    withItems: 'Bu hedefin eklediği alışkanlık ve görevler kaldırılır. Hemen ardından geri alabilirsin.',
    empty: 'Kurulum kapanır; istediğin zaman yeniden açabilirsin.',
    close: 'Kapat', cancel: 'Vazgeç',
  },
  en: {
    name: { exam: 'Exam tracking', tez: 'Thesis / project', mulakat: 'Job interview', spor: 'Fitness', tasarruf: 'Savings', birakma: 'Quit habit' },
    row: { exam: 'Close exam tracking', tez: 'Close thesis mode', mulakat: 'Close interview mode', spor: 'Close fitness mode', tasarruf: 'Close savings mode', birakma: 'Close quit mode' },
    withItems: 'The habits and tasks this goal added will be removed. You can undo right after.',
    empty: 'Setup closes; you can open it again anytime.',
    close: 'Close', cancel: 'Cancel',
  },
};
export type ClosableMode = keyof typeof COPY.tr.name;

export function ModeCardClose({ mode, hasItems, onClose }: { mode: ClosableMode; hasItems: boolean; onClose: () => void }) {
  const { theme } = useAppTheme();
  const { language } = useLanguageStore();
  const c = COPY[langOf(language)];
  return (
    <View style={[styles.wrap, { borderTopColor: theme.outlineVariant }]}>
      <Touchable
        accessibilityRole="button"
        accessibilityLabel={c.row[mode]}
        onPress={() => {
          haptic.select();
          Alert.alert(c.name[mode], hasItems ? c.withItems : c.empty, [
            { text: c.cancel, style: 'cancel' },
            { text: c.close, style: 'destructive', onPress: onClose },
          ]);
        }}
        hitSlop={touchSlop(32)}
        style={styles.row}
        activeOpacity={0.6}
      >
        <Text style={[styles.text, { color: theme.onSurfaceMuted }]}>{c.row[mode]}</Text>
      </Touchable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderTopWidth: HAIRLINE, marginHorizontal: S.md, paddingVertical: S.sm },
  row: { alignItems: 'center', justifyContent: 'center', minHeight: 32 },
  text: { fontSize: F.caption, fontWeight: '600' },
});
