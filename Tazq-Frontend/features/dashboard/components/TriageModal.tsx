import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';
import { GlassSheet } from '@/shared/components/GlassSheet';
import { Touchable } from '@/shared/components/Touchable';
import { F, S, R, W, ICON, LH, MIN_TOUCH } from '@/shared/constants/tokens';
import type { AppTheme } from '@/shared/constants/Colors';
import type { Task } from '@/features/tasks/store/useTaskStore';
import { getLocalizedTaskTitle } from '@/features/tasks';
import { TRIAGE_MAX_KEEP, type RebalancePlan } from '@/features/tasks/utils/taskBalancer';

/**
 * TAŞAN GÜN — "bugün yapacağın TEK işi seç, gerisini dağıtayım".
 *
 * ── ÖNCEKİ HÂLİN SORUNLARI ────────────────────────────────────────────────────
 *  · Bir satıra dokunmak ONAYSIZ olarak bugünün bütün öteki görevlerini taşıyordu.
 *    Listeyi kaydırırken yanlışlıkla değen parmak günü dağıtıyordu; geri alma yoktu.
 *  · Plan görevleri de listede ve taşınanlar arasındaydı. Plan motoru "bugün üretildi
 *    mi" sorusunu görevin tarihine bakarak cevapladığı için bu, aynı görevlerin yeniden
 *    üretilmesi demekti (bkz. taskBalancer → isMovable).
 *  · Taşınanlar kendi hesabıyla dağıtılıyordu; kart ve menü başka bir hesap yapıyordu.
 *
 * Artık seçmek hiçbir şey yapmaz, yalnız sonucu önizler. Asıl iş onay düğmesinde ve
 * motorun kendi planıyla (geri alınabilir) yapılır. Liste yalnız taşınabilir görevleri
 * gösterir; yerinde kalacak sabit görevler ayrıca söylenir.
 *
 * TEK değil 1–3 görev: gerçek bir günde kimse işini tek maddeye indirmiyor. Sınır
 * dolunca seçilmemiş satırlar pasifleşir — dördüncüye dokunmak sessizce yutulmaz,
 * satır neden seçilemediğini görünür biçimde söyler.
 */

export interface TriageModalProps {
  visible: boolean;
  onClose: () => void;
  /** Bugünün TAŞINABİLİR görevleri (plan, saatli ve tekrarlayan hariç). */
  tasks: Task[];
  /** Seçime göre ne olacağı — motorun kendi önizlemesi. */
  preview: (keepIds: readonly number[]) => RebalancePlan;
  onConfirm: (keepIds: readonly number[]) => void;
  /** Her durumda bugün yerinde kalacak sabit görev sayısı (plan, saatli, tekrarlayan). */
  fixedCount: number;
  theme: AppTheme;
  tr: boolean;
}

const copy = (tr: boolean) => tr
  ? {
      title: 'Bugün çok dolu',
      body: `Bugün yapacağın en önemli 1–${TRIAGE_MAX_KEEP} görevi seç. Gerisini önümüzdeki günlere dağıtayım.`,
      pick: 'Bugün kalacakları seç',
      allKept: 'Bugünün bütün işlerini seçtin — taşınacak bir şey kalmadı.',
      result: (s: number, d: number) => [
        s > 0 ? `${s} görev önümüzdeki günlere yayılır` : '',
        d > 0 ? `${d} görev Belki Bir Gün'e alınır` : '',
      ].filter(Boolean).join(', ') + '.',
      fixedNote: (p: number) => `Saatli, tekrarlayan ve plan görevlerin (${p}) bugün yerinde kalır.`,
      confirm: 'Günü sadeleştir',
      cancel: 'Vazgeç',
    }
  : {
      title: 'Today is overloaded',
      body: `Pick the 1–${TRIAGE_MAX_KEEP} tasks that matter most today. I will spread the rest over the coming days.`,
      pick: 'Pick what stays today',
      allKept: 'You picked everything for today — nothing left to move.',
      result: (s: number, d: number) => [
        s > 0 ? `${s} tasks spread over the coming days` : '',
        d > 0 ? `${d} moved to Someday` : '',
      ].filter(Boolean).join(', ') + '.',
      fixedNote: (p: number) => `Your timed, recurring and plan tasks (${p}) stay on today.`,
      confirm: 'Simplify my day',
      cancel: 'Cancel',
    };

export const TriageModal = React.memo<TriageModalProps>(({
  visible, onClose, tasks, preview, onConfirm, fixedCount, theme, tr,
}) => {
  const c = copy(tr);
  const insets = useSafeAreaInsets();
  const [picked, setPicked] = useState<number[]>([]);

  // Her açılış temiz başlar — önceki seferin seçimi bugünün listesinde olmayabilir.
  useEffect(() => { if (visible) setPicked([]); }, [visible]);

  // Seçili görev o arada listeden çıktıysa (tamamlandı, silindi) seçimden de düşer.
  const keepIds = picked.filter((id) => tasks.some((t) => t.id === id));
  const plan = keepIds.length > 0 ? preview(keepIds) : null;
  const full = keepIds.length >= TRIAGE_MAX_KEEP;
  // Her şey seçildiyse taşınacak iş yok — onay bir şey yapmayacağı için kapalı.
  const canConfirm = !!plan && plan.moves.length > 0;

  const toggle = (id: number) => setPicked((cur) => {
    const live = cur.filter((x) => tasks.some((t) => t.id === x));
    if (live.includes(id)) return live.filter((x) => x !== id);
    return live.length >= TRIAGE_MAX_KEEP ? live : [...live, id];
  });

  const confirm = () => {
    if (!canConfirm) return;
    onConfirm(keepIds);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[styles.scrim, { paddingTop: insets.top + S.lg, paddingBottom: insets.bottom + S.lg }]}>
        {/* Arka plan ağacın dışında: seçilmemiş bir yüzeye ad vermek, ekran okuyucu
            gezintisine boş bir durak ekler. Kapatmak için "Vazgeç" var. */}
        <Touchable style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} accessible={false} />

        <GlassSheet style={styles.sheet}>
          <View accessibilityViewIsModal>
            <Text style={[styles.title, { color: theme.onSurface }]} accessibilityRole="header">{c.title}</Text>
            <Text style={[styles.body, { color: theme.onSurfaceMuted }]}>{c.body}</Text>

            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {tasks.map((task, i) => {
                const checked = keepIds.includes(task.id);
                const blocked = full && !checked;
                const title = getLocalizedTaskTitle(task, tr);
                return (
                  <Touchable
                    key={task.id}
                    onPress={() => toggle(task.id)}
                    disabled={blocked}
                    accessibilityRole="checkbox"
                    accessibilityLabel={title}
                    accessibilityState={{ checked, disabled: blocked }}
                    style={[
                      styles.row,
                      blocked && { opacity: 0.4 },
                      i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.outlineVariant },
                    ]}
                  >
                    <Text style={[styles.rowTitle, { color: theme.onSurface }]} numberOfLines={2}>{title}</Text>
                    <View
                      style={[
                        styles.radio,
                        checked
                          ? { backgroundColor: theme.primary, borderColor: theme.primary }
                          : { borderColor: theme.outline },
                      ]}
                    >
                      {checked && <Check size={ICON.xs} color={theme.onPrimary} strokeWidth={3} />}
                    </View>
                  </Touchable>
                );
              })}
            </ScrollView>

            {/* Sonuç, seçimden SONRA ve düğmeden ÖNCE söyleniyor — basınca ne olacağı bilinsin. */}
            <Text
              style={[styles.result, { color: plan ? theme.onSurface : theme.onSurfaceMuted }]}
              accessibilityLiveRegion="polite"
            >
              {!plan ? c.pick : canConfirm ? c.result(plan.scheduled, plan.someday) : c.allKept}
              {canConfirm && fixedCount > 0 ? ` ${c.fixedNote(fixedCount)}` : ''}
            </Text>

            <Touchable
              onPress={confirm}
              disabled={!canConfirm}
              accessibilityRole="button"
              accessibilityLabel={c.confirm}
              accessibilityState={{ disabled: !canConfirm }}
              style={[styles.confirm, { backgroundColor: theme.primary, opacity: canConfirm ? 1 : 0.4 }]}
            >
              <Text style={[styles.confirmText, { color: theme.onPrimary }]}>{c.confirm}</Text>
            </Touchable>

            <Touchable onPress={onClose} accessibilityRole="button" accessibilityLabel={c.cancel} style={styles.cancel}>
              <Text style={[styles.cancelText, { color: theme.onSurfaceMuted }]}>{c.cancel}</Text>
            </Touchable>
          </View>
        </GlassSheet>
      </View>
    </Modal>
  );
});

TriageModal.displayName = 'TriageModal';

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: S.lg,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: { maxHeight: '100%' },
  title: { fontSize: F.title3, fontWeight: W.bold, textAlign: 'center', letterSpacing: -0.4, marginBottom: S.xs },
  body: { fontSize: F.body, textAlign: 'center', lineHeight: F.body * LH.relaxed, marginBottom: S.md },
  list: { maxHeight: 280, flexGrow: 0 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: S.md, minHeight: MIN_TOUCH, paddingVertical: S.smd,
  },
  rowTitle: { flex: 1, fontSize: F.body, fontWeight: W.medium },
  radio: {
    width: ICON.md, height: ICON.md, borderRadius: R.full, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  result: { fontSize: F.body, textAlign: 'center', lineHeight: F.body * LH.relaxed, marginTop: S.md, marginBottom: S.md },
  confirm: { minHeight: MIN_TOUCH, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  confirmText: { fontSize: F.body, fontWeight: W.semibold },
  cancel: { minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center', marginTop: S.xs },
  cancelText: { fontSize: F.body, fontWeight: W.medium },
});
