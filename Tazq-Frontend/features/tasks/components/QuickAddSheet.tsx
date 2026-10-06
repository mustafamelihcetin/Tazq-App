import React, { useState, useEffect } from 'react';
import { View, Text, Modal, Animated, TextInput, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { Zap, Sparkles } from 'lucide-react-native';
import { useSwipeToDismiss } from '@/shared/hooks/useSwipeToDismiss';
import { useKeyboardHeight } from '@/shared/hooks/useKeyboardHeight';
import { Touchable } from '@/shared/components/Touchable';
import { GlassSurface } from '@/shared/components/GlassSurface';
import { ICON, S, R, F, B, scale, verticalScale } from '@/shared/constants/tokens';
import type { AppTheme } from '@/shared/constants/Colors';
import { parseTaskHint } from '@/features/tasks/utils/taskParser';
import { buildNlpChips } from '@/features/tasks/utils/nlpChips';
import { NlpHintRow, EMPTY_NLP_HINT, type NlpHint } from '@/features/tasks/components/NlpHintRow';

/**
 * HIZLI EKLEME — görev eklemenin VARSAYILAN yolu.
 *
 * ── ÖLÇÜLEN SORUN ─────────────────────────────────────────────────────────────
 * Görevler ekranındaki + düğmesi yedi bölümlü tam formu açıyordu: başlık, açıklama,
 * öncelik, tarih, saat, tekrar, alt görevler, etiketler. İlk görevini eklemek isteyen
 * kullanıcı için bu ağır bir karşılama — ve görevlerin çoğu için gereksiz, çünkü
 * ayrıştırıcı tarihi, saati, önceliği ve tekrarı zaten CÜMLEDEN çıkarıyor.
 *
 * "yarın 15:00 toplantı" tek satır; form yedi alan. Aynı sonuç.
 *
 * ── DETAY KAYBOLMUYOR, İKİNCİ ADIMA GEÇİYOR ───────────────────────────────────
 * Tam form silinmedi: "Detaylar" düğmesi yazılan metni TAŞIYARAK onu açıyor. Yani
 * hızlı yol varsayılan, ayrıntılı yol bir dokunuş uzakta. Tersi değil.
 *
 * ── NE ANLADIĞIMIZI GÖSTERİR ──────────────────────────────────────────────────
 * Kullanıcı yazarken ayrıştırıcının okuduğu tarih/saat/tekrar/etiket parçaları altta
 * beliriyor. Bu olmadan hızlı ekleme bir KARA KUTU olurdu: görevin yarına kurulduğunu
 * ancak listeye dönünce anlardı.
 */

interface QuickAddSheetProps {
  visible: boolean;
  onClose: () => void;
  /** `dayChoice`: metinde tarih yoksa kullanıcının chip ile seçtiği gün (yoksa null). */
  onSave: (title: string, dayChoice: DayChoice) => Promise<void>;
  /**
   * Verilirse "Detaylar" düğmesi çizilir — yazılan metinle tam formu açar.
   * Tam formun bulunmadığı ekranlarda verilmez.
   */
  onDetails?: (title: string) => void;
  theme: AppTheme;
  isDark: boolean;
  language: string;
  t: any;
}

export type DayChoice = 'today' | 'tomorrow' | null;

export const QuickAddSheet: React.FC<QuickAddSheetProps> = ({
  visible, onClose, onSave, onDetails, theme, isDark, language, t,
}) => {
  const [draft, setDraft] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hint, setHint] = useState<NlpHint>(EMPTY_NLP_HINT);
  const [dayChoice, setDayChoice] = useState<DayChoice>(null);
  const [textHasDate, setTextHasDate] = useState(false);
  const keyboardHeight = useKeyboardHeight();
  // Metinler i18n sözlüğünden — bu ekranda satır içi iki dilli dallanma YOK.
  const q = t.quickAdd;

  const { panResponder, animatedStyle, prepare, slideIn } = useSwipeToDismiss({ onDismiss: onClose });

  useEffect(() => {
    if (visible) {
      prepare();
      setDraft('');
      setHint(EMPTY_NLP_HINT);
      setDayChoice(null);
      setTextHasDate(false);
      setIsSaving(false);
    }
  }, [visible, prepare]);

  const handleChange = (text: string) => {
    setDraft(text);
    if (!text.trim()) {
      setHint(EMPTY_NLP_HINT);
      setTextHasDate(false);
      return;
    }
    const parsed = parseTaskHint(text, language as 'tr' | 'en');
    setHint({ message: '', chips: buildNlpChips(parsed, language) });
    setTextHasDate(!!parsed.dueDate);
  };

  const handleSave = async () => {
    if (!draft.trim() || isSaving) return;
    setIsSaving(true);
    try {
      await onSave(draft.trim(), textHasDate ? null : dayChoice);
      onClose();
    } catch {
      // Hata ÇAĞIRANIN sorumluluğunda: toast/uyarı orada gösteriliyor, sayfa açık kalır.
    } finally {
      setIsSaving(false);
    }
  };

  const canSave = !!draft.trim();

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} onShow={slideIn}>
      <View style={styles.overlay}>
        <Touchable
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={q.close}
        />
        <View style={[styles.wrapper, { marginBottom: Platform.OS === 'ios' ? keyboardHeight : 0 }]}>
          <Animated.View
            style={[
              animatedStyle,
              styles.sheet,
              {
                paddingBottom: keyboardHeight > 0 ? S.md : S.xl,
                borderBottomLeftRadius: keyboardHeight > 0 ? R.sheet : 0,
                borderBottomRightRadius: keyboardHeight > 0 ? R.sheet : 0,
              },
            ]}
          >
            {/* Klavye açıkken sayfa klavyenin üstünde yüzer → dört köşe; kapalıyken dibe yapışık → üst köşeler. */}
            <GlassSurface corners={keyboardHeight > 0 ? 'all' : 'top'} />

            <View {...panResponder.panHandlers} style={styles.handleArea}>
              <View style={styles.handle} />
            </View>

            <View style={styles.header}>
              <View style={[styles.badge, { backgroundColor: theme.primary + '20' }]}>
                <Zap size={ICON.md} color={theme.primary} fill={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.title, { color: theme.onSurface }]}>
                  {q.title}
                </Text>
                <Text style={[styles.sub, { color: theme.onSurfaceVariant }]}>{q.sub}</Text>
              </View>
            </View>

            <View style={[styles.inputGroup, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
              <TextInput
                style={[styles.input, { color: theme.onSurface }]}
                placeholder={q.placeholder}
                placeholderTextColor={theme.onSurfaceVariant + '99'}
                value={draft}
                onChangeText={handleChange}
                returnKeyType="done"
                onSubmitEditing={handleSave}
                underlineColorAndroid="transparent"
                accessibilityLabel={q.title}
                autoFocus
              />
            </View>

            {/* Ayrıştırıcının okudukları — hızlı ekleme kara kutu olmasın. */}
            <NlpHintRow hint={hint} theme={theme} />

            {/* Metinde tarih yoksa tek dokunuşla gün seç; metin tarih içeriyorsa chip'ler gizli. */}
            {canSave && !textHasDate && (
              <View style={styles.dayRow}>
                {(['today', 'tomorrow'] as const).map((d) => {
                  const active = dayChoice === d;
                  return (
                    <Touchable
                      key={d}
                      onPress={() => setDayChoice(active ? null : d)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={d === 'today' ? q.dayToday : q.dayTomorrow}
                      style={[
                        styles.dayChip,
                        { backgroundColor: active ? theme.primary : (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)') },
                      ]}
                    >
                      <Text style={[styles.dayChipText, { color: active ? theme.onPrimary : theme.onSurface }]}>
                        {d === 'today' ? q.dayToday : q.dayTomorrow}
                      </Text>
                    </Touchable>
                  );
                })}
                <Text style={[styles.dayHint, { color: theme.onSurfaceMuted }]}>{dayChoice ? '' : q.dayHint}</Text>
              </View>
            )}

            <View style={styles.note}>
              <Sparkles size={ICON.xs} color={theme.onSurfaceMuted} />
              <Text style={[styles.noteText, { color: theme.onSurfaceMuted }]}>{q.note}</Text>
            </View>

            <View style={styles.actions}>
              {onDetails && (
                <Touchable
                  onPress={() => onDetails(draft.trim())}
                  accessibilityRole="button"
                  accessibilityLabel={q.details}
                  accessibilityHint={q.detailsHint}
                  style={[styles.secondary, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)' }]}
                >
                  <Text style={[styles.secondaryText, { color: theme.onSurface }]}>{q.details}</Text>
                </Touchable>
              )}
              <Touchable
                onPress={handleSave}
                disabled={isSaving || !canSave}
                accessibilityRole="button"
                accessibilityLabel={q.save}
                accessibilityState={{ disabled: !canSave || isSaving, busy: isSaving }}
                style={[styles.primary, { backgroundColor: canSave ? theme.primary : theme.surfaceContainerHigh }]}
              >
                {isSaving
                  ? <ActivityIndicator color={theme.onPrimary} />
                  : <Text style={[styles.primaryText, { color: canSave ? theme.onPrimary : theme.onSurfaceVariant }]}>{q.save}</Text>}
              </Touchable>
            </View>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  wrapper: { width: '100%' },
  sheet: {
    width: '100%',
    borderTopLeftRadius: R.sheet,
    borderTopRightRadius: R.sheet,
    padding: S.lg,
    borderWidth: B.thin,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  handleArea: { paddingTop: S.sm, paddingBottom: S.lmd, alignItems: 'center' },
  handle: { width: scale(40), height: scale(4), borderRadius: R.sm, backgroundColor: 'rgba(128,128,128,0.2)' },
  header: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  badge: { width: scale(40), height: scale(40), borderRadius: R.md, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: F.title, fontWeight: '700', letterSpacing: -0.5 },
  sub: { fontSize: F.caption, fontWeight: '600', marginTop: S.xxs },
  inputGroup: { borderRadius: R.lg, paddingHorizontal: S.md, minHeight: verticalScale(64), justifyContent: 'center', marginTop: S.md },
  input: { fontWeight: '600', fontSize: F.subhead, paddingVertical: S.sm },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: S.xs, marginTop: S.sm, flexWrap: 'wrap' },
  dayChip: { paddingHorizontal: S.md, paddingVertical: S.xs + 2, borderRadius: R.full },
  dayChipText: { fontSize: F.caption2, fontWeight: '700' },
  dayHint: { fontSize: F.caption, fontWeight: '600', flex: 1, minWidth: 120 },
  note: { flexDirection: 'row', alignItems: 'center', gap: S.xs, marginTop: S.sm },
  noteText: { fontSize: F.caption, fontWeight: '600', flex: 1 },
  actions: { flexDirection: 'row', gap: S.sm, marginTop: S.lg },
  secondary: { flex: 1, height: verticalScale(56), borderRadius: R.md, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontWeight: '700', fontSize: F.body },
  primary: { flex: 2, height: verticalScale(56), borderRadius: R.md, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontWeight: '700', fontSize: F.body },
});
