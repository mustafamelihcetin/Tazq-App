import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { MotiView } from 'moti';
import { CheckCircle2, Wind } from 'lucide-react-native';
import { BentoCard } from '@/shared/components/BentoCard';
import { Touchable } from '@/shared/components/Touchable';
import { F, S, R, W, ICON, LH, MIN_TOUCH } from '@/shared/constants/tokens';
import type { AppTheme } from '@/shared/constants/Colors';
import type { RebalancePlan } from '@/features/tasks/utils/taskBalancer';
import type { AppliedRebalance } from '@/features/tasks/utils/rebalanceActions';

/**
 * TAZQ ZEN KARTI — birikmiş işi dengelemeyi ÖNERİR.
 *
 * ── ÖNCEKİ HÂLİN SORUNLARI ────────────────────────────────────────────────────
 *  · Kendini "Zen" diye tanıtıyordu ama Zen motorunu ÇAĞIRMIYORDU: "Dengele" bütün
 *    gecikmişleri YARINA yığıyordu. Yarın hepsi yine gecikiyor, kart yine çıkıyordu.
 *    Menüdeki "Günü Kurtar" ise gerçek dağıtımı yapıyordu — aynı ekranda aynı soruna
 *    iki zıt cevap.
 *  · Ne yapacağını söylemeden yapıyordu. Onlarca görevin tarihini değiştiren bir
 *    düğmenin sonucu, basmadan ÖNCE bilinmeli.
 *  · "Ben hallederim" kalıcı değildi; uygulama yeniden açılınca kart geri geliyordu.
 *  · Başarı görünümü 4 saniye sonra kartı OTURUM BOYUNCA kapatıyordu: sonradan yeni
 *    birikim olsa bile öneri bir daha çıkmıyordu.
 *
 * Kart artık motorun kendi önizlemesini gösteriyor, aynı motorla uyguluyor ve geri
 * alma tutamacını motorun kendisinden alıyor. Görünürlük kararı dışarıda (useZen);
 * burası yalnız bir işlemin üç anını çiziyor: öneri · uygulanıyor · bitti (geri al).
 *
 * İKİNCİ HÂL — TAŞAN GÜN: birikim yokken bugün kapasiteyi aşıyorsa kart bunu söyler
 * ve triage'ı açar. Triage eskiden yalnız logonun menüsünden ulaşılabiliyordu; çoğu
 * kullanıcının hiç bulamayacağı bir yer.
 */

type Phase = 'idle' | 'working' | 'done';

export interface TazqZenCardProps {
  /** Öneri görünmeli mi (birikim ≥ eşik ve bugün reddedilmedi). */
  visible: boolean;
  /** Motorun önizlemesi — basınca TAM OLARAK bu olur. */
  plan: RebalancePlan;
  /** Gecikmiş TÜM görevler (sabitler dahil) — dürüst sayı için. */
  overdueTotal: number;
  onRebalance: () => Promise<AppliedRebalance>;
  onDismiss: () => void;
  /** Taşan gün: birikim kartı yokken gösterilir; null ise çizilmez. */
  overload?: { count: number; onOpen: () => void } | null;
  theme: AppTheme;
  tr: boolean;
}

const copy = (tr: boolean) => tr
  ? {
      eyebrow: 'TAZQ ZEN',
      headline: 'Dengeye dönme vakti',
      body: (n: number) => `${n} görevin birikti.`,
      preview: (s: number, d: number) =>
        `Dengelersen ${s > 0 ? `${s} tanesi önümüzdeki günlere yayılır` : ''}${s > 0 && d > 0 ? ', ' : ''}${d > 0 ? `${d} tanesi Belki Bir Gün'e alınır` : ''} — hiçbir gün 5 görevi aşmaz.`,
      fixedNote: (p: number) => `Saatli, tekrarlayan ve plan görevlerine (${p}) dokunulmaz.`,
      dismiss: 'Ben hallederim',
      act: 'Dengele',
      working: 'Dengeleniyor',
      done: 'Denge sağlandı. Takvimin nefes aldı.',
      undo: 'Geri al',
      overTitle: (n: number) => `Bugün ${n} işin var`,
      overBody: 'Hepsi bir güne sığmaz. Bugün kalacak 1–3 işi seç, gerisini önümüzdeki günlere yayayım.',
      overAct: 'Sadeleştir',
    }
  : {
      eyebrow: 'TAZQ ZEN',
      headline: 'Time to rebalance',
      body: (n: number) => `${n} tasks have piled up.`,
      preview: (s: number, d: number) =>
        `Rebalancing will ${s > 0 ? `spread ${s} over the coming days` : ''}${s > 0 && d > 0 ? ' and ' : ''}${d > 0 ? `move ${d} to Someday` : ''} — no day goes over 5 tasks.`,
      fixedNote: (p: number) => `Timed, recurring and plan tasks (${p}) are left as they are.`,
      dismiss: 'I got this',
      act: 'Rebalance',
      working: 'Rebalancing',
      done: 'Balanced. Your schedule can breathe.',
      undo: 'Undo',
      overTitle: (n: number) => `${n} tasks today`,
      overBody: "That won't fit in one day. Pick the 1–3 that stay today and I'll spread the rest.",
      overAct: 'Simplify',
    };

/** Başarı görünümünün ekranda kalma süresi — geri alma penceresi. */
const DONE_MS = 6000;

export const TazqZenCard = React.memo<TazqZenCardProps>(
  ({ visible, plan, overdueTotal, onRebalance, onDismiss, overload, theme, tr }) => {
    const c = copy(tr);
    const [phase, setPhase] = useState<Phase>('idle');
    const handleRef = useRef<AppliedRebalance | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

    const rebalance = async () => {
      if (phase !== 'idle') return; // çift dokunuş iki kez dağıtmasın
      setPhase('working');
      const applied = await onRebalance();
      if (applied.moved === 0) {
        // Hiçbir şey taşınmadıysa "denge sağlandı" demek yalan olur.
        setPhase('idle');
        return;
      }
      handleRef.current = applied; // titreşim useZen'de — üç girişte de aynı
      setPhase('done');
      // Süre dolunca kart KAPANMIYOR, öneri durumuna dönüyor: yeni birikim varsa
      // yeniden önerilir, yoksa `visible` zaten false olduğu için hiçbir şey çizilmez.
      timerRef.current = setTimeout(() => { handleRef.current = null; setPhase('idle'); }, DONE_MS);
    };

    const undo = async () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      const h = handleRef.current;
      handleRef.current = null;
      setPhase('idle');
      if (h) await h.undo();
    };

    if (phase === 'done') {
      return (
        <MotiView from={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} style={styles.wrap}>
          <BentoCard index={0} style={styles.card}>
            <View style={styles.doneRow}>
              <CheckCircle2 size={ICON.md} color={theme.tertiary} />
              <Text style={[styles.doneText, { color: theme.onSurface }]}>{c.done}</Text>
              <Touchable
                onPress={undo}
                accessibilityRole="button"
                accessibilityLabel={c.undo}
                hitSlop={{ top: S.sm, bottom: S.sm, left: S.sm, right: S.sm }}
                style={[styles.undoBtn, { backgroundColor: theme.tertiary + '14' }]}
              >
                <Text style={[styles.undoText, { color: theme.tertiary }]}>{c.undo}</Text>
              </Touchable>
            </View>
          </BentoCard>
        </MotiView>
      );
    }

    if ((!visible || plan.moves.length === 0) && overload) {
      return (
        <MotiView from={{ opacity: 0, translateY: -8 }} animate={{ opacity: 1, translateY: 0 }} style={styles.wrap}>
          <BentoCard index={0} style={[styles.card, { backgroundColor: theme.tertiary + '0A', borderColor: theme.tertiary + '26', borderWidth: 1 }]}>
            <View style={styles.eyebrowRow}>
              <Wind size={ICON.xs} color={theme.tertiary} />
              <Text style={[styles.eyebrow, { color: theme.tertiary }]}>{c.eyebrow}</Text>
            </View>
            <Text style={[styles.headline, { color: theme.onSurface }]} accessibilityRole="header">{c.overTitle(overload.count)}</Text>
            <Text style={[styles.body, { color: theme.onSurfaceMuted }]}>{c.overBody}</Text>
            <View style={styles.actions}>
              <Touchable onPress={onDismiss} accessibilityRole="button" accessibilityLabel={c.dismiss} style={styles.dismissBtn}>
                <Text style={[styles.dismissText, { color: theme.onSurfaceMuted }]}>{c.dismiss}</Text>
              </Touchable>
              <Touchable onPress={overload.onOpen} accessibilityRole="button" accessibilityLabel={c.overAct} style={[styles.actBtn, { backgroundColor: theme.tertiary }]}>
                <Wind size={ICON.sm} color={theme.onTertiary} />
                <Text style={[styles.actText, { color: theme.onTertiary }]}>{c.overAct}</Text>
              </Touchable>
            </View>
          </BentoCard>
        </MotiView>
      );
    }

    if (!visible || plan.moves.length === 0) return null;

    const fixedCount = Math.max(0, overdueTotal - plan.moves.length);
    const working = phase === 'working';

    return (
      <MotiView
        from={{ opacity: 0, translateY: -8 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'spring', damping: 16 }}
        style={styles.wrap}
      >
        <BentoCard
          index={0}
          style={[styles.card, { backgroundColor: theme.tertiary + '0A', borderColor: theme.tertiary + '26', borderWidth: 1 }]}
        >
          <View style={styles.eyebrowRow}>
            <Wind size={ICON.xs} color={theme.tertiary} />
            <Text style={[styles.eyebrow, { color: theme.tertiary }]}>{c.eyebrow}</Text>
          </View>

          <Text style={[styles.headline, { color: theme.onSurface }]} accessibilityRole="header">
            {c.headline}
          </Text>
          <Text style={[styles.body, { color: theme.onSurfaceMuted }]}>
            {c.body(plan.moves.length)} {c.preview(plan.scheduled, plan.someday)}
            {fixedCount > 0 ? ` ${c.fixedNote(fixedCount)}` : ''}
          </Text>

          <View style={styles.actions}>
            <Touchable
              onPress={onDismiss}
              disabled={working}
              accessibilityRole="button"
              accessibilityLabel={c.dismiss}
              style={styles.dismissBtn}
            >
              <Text style={[styles.dismissText, { color: theme.onSurfaceMuted }]}>{c.dismiss}</Text>
            </Touchable>

            <Touchable
              onPress={rebalance}
              disabled={working}
              accessibilityRole="button"
              accessibilityLabel={c.act}
              accessibilityState={{ busy: working, disabled: working }}
              style={[styles.actBtn, { backgroundColor: theme.tertiary, opacity: working ? 0.7 : 1 }]}
            >
              {working
                ? <ActivityIndicator size="small" color={theme.onTertiary} />
                : <Wind size={ICON.sm} color={theme.onTertiary} />}
              <Text style={[styles.actText, { color: theme.onTertiary }]}>{working ? c.working : c.act}</Text>
            </Touchable>
          </View>
        </BentoCard>
      </MotiView>
    );
  },
);

TazqZenCard.displayName = 'TazqZenCard';

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: S.lg, marginBottom: S.lg },
  card: { padding: S.lg, overflow: 'hidden' },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: S.xs, marginBottom: S.sm },
  eyebrow: { fontSize: F.caption, fontWeight: W.bold, letterSpacing: 1.2 },
  headline: { fontSize: F.title3, fontWeight: W.semibold, letterSpacing: -0.4, marginBottom: S.xs },
  body: { fontSize: F.body, lineHeight: F.body * LH.relaxed },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: S.md, marginTop: S.md },
  dismissBtn: { minHeight: MIN_TOUCH, justifyContent: 'center', paddingHorizontal: S.sm },
  dismissText: { fontSize: F.body, fontWeight: W.medium },
  actBtn: {
    flexDirection: 'row', alignItems: 'center', gap: S.xs, minHeight: MIN_TOUCH,
    paddingHorizontal: S.md, borderRadius: R.full,
  },
  actText: { fontSize: F.body, fontWeight: W.semibold },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: S.smd },
  doneText: { flex: 1, fontSize: F.body, fontWeight: W.medium },
  undoBtn: { paddingHorizontal: S.smd, paddingVertical: S.xs, borderRadius: R.sm },
  undoText: { fontSize: F.body, fontWeight: W.semibold },
});
