import { useMemo } from 'react';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { localizeSporGoal } from '@/features/modes/utils/turkishModes';
import { useHabitStore } from '@/features/habits';
import { useActiveTasks } from '@/features/tasks';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { modeAccent, modeAccentText } from '@/shared/constants/Colors';
import { toDateKey, parseDateKey } from '@/shared/utils/dateKey';
import { planProgressFor } from '@/features/modes/utils/planProgress';

/**
 * AKTİF MODLARIN ÖZETİ — tek kaynak.
 *
 * ── NEDEN HOOK ────────────────────────────────────────────────────────────────
 * Bu hesap (hangi modlar açık, kaç gün kaldı, bugünün plan görevlerinden kaçı bitti,
 * haftalık alışkanlık uyumu) yalnızca "Modların Özeti" ekranının İÇİNDE duruyordu.
 * Ana ekran artık aynı bilgiye ihtiyaç duyuyor: aktif bir dönem varsa günün sorusu
 * "bugün ne var" değil, "PLANIMDA bugün ne var".
 *
 * Kopyalansaydı iki ekran zamanla ayrışırdı — biri slot modlarını (ikinci/üçüncü
 * sınav, ikinci spor hedefi) sayar, diğeri saymazdı; biri geçmiş tarihli modu aktif
 * gösterirdi. Aynı soruya iki farklı cevap veren iki ekran, güveni bitirir.
 *
 * SIRALAMA: `entries` tarihi en yakın olan ÖNCE gelir (süresizler sonda). Ana ekran
 * ilk girişi gösteriyor; "en acil olan" kararını ekran değil bu hook veriyor.
 */

export interface ModeSummaryEntry {
  key: string;
  label: string;
  /** Dolgu/ikon/çubuk rengi (WCAG büyük-metin ≥3:1). */
  color: string;
  /** Küçük yazı rengi (WCAG AA ≥4.5:1) — caption/etiketlerde bunu kullan. */
  textColor: string;
  emoji: string;
  /** null = süresiz (ör. Ramazan), -1 = tarihi geçmiş. */
  days: number | null;
  habitIds: string[];
  taskIds: number[];
  habitCount: number;
  weekActive: number;
  /** Haftalık alışkanlık uyumu (%). */
  pct: number;
  todayDone: number;
  todayTotal: number;
  /** Tarihi ne olursa olsun HENÜZ bitmemiş plan görevleri. */
  openTotal: number;
  taskTotal: number;
}

export interface ModeSummary {
  entries: ModeSummaryEntry[];
  activeCount: number;
  /** Tarihi en yakın (geçmemiş) mod — yoksa null. */
  nearest: ModeSummaryEntry | null;
  totalHabits: number;
  totalWeekActive: number;
  overallPct: number;
  todayDoneAll: number;
  todayTotalAll: number;
}

function thisWeekKeys(): Set<string> {
  const now = new Date();
  const day = (now.getDay() + 6) % 7; // 0 = Pazartesi
  const monday = new Date(now);
  monday.setDate(now.getDate() - day);
  const keys = new Set<string>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    keys.add(toDateKey(d));
  }
  return keys;
}

function daysLeftOf(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const end = parseDateKey(dateStr).setHours(23, 59, 59, 999);
  if (end < Date.now()) return -1; // geçmiş
  return Math.max(0, Math.ceil((end - Date.now()) / 86400000));
}

export function useActiveModeSummary(): ModeSummary {
  const { isDark } = useAppTheme();
  const { language, t } = useLanguageStore();
  const tr = language === 'tr';
  // Mod adlari sozlukten — bu dosyada satir ici iki dilli dallanma YOK
  // (bkz. __tests__/i18nRatchet.test.ts).
  const names = t.modeNames;
  const prefs = usePrefsStore();
  const seasonal = prefs.seasonal;
  const habits = useHabitStore(s => s.habits);
  // Arşivlenmişler hariç: özet AKTİF planı anlatır.
  const tasks = useActiveTasks();

  return useMemo(() => {
    // Mod renkleri MERKEZİ PALETTEN — iki ekran aynı modu farklı tonda göstermesin.
    const MC = {
      exam: modeAccent('exam', isDark), tez: modeAccent('tez', isDark),
      mulakat: modeAccent('mulakat', isDark), spor: modeAccent('spor', isDark),
      ramazan: modeAccent('ramazan', isDark),
    };
    const MCT = {
      exam: modeAccentText('exam', isDark), tez: modeAccentText('tez', isDark),
      mulakat: modeAccentText('mulakat', isDark), spor: modeAccentText('spor', isDark),
      ramazan: modeAccentText('ramazan', isDark),
    };

    const examLbl = names.exam;
    const mulLbl = names.interview;
    const sporLbl = names.fitness;

    type RawEntry = Omit<ModeSummaryEntry, 'habitCount' | 'weekActive' | 'pct' | 'todayDone' | 'todayTotal' | 'openTotal' | 'taskTotal'>;
    const entries: RawEntry[] = [];

    if (seasonal.examMode) {
      entries.push({ key: 'exam', label: seasonal.examName || examLbl, color: MC.exam, textColor: MCT.exam, emoji: '🎯', days: daysLeftOf(seasonal.examDate), habitIds: prefs.examPlanHabitIds, taskIds: prefs.examPlanTaskIds });
      if (seasonal.exam2Name) entries.push({ key: 'exam2', label: seasonal.exam2Name, color: MC.exam, textColor: MCT.exam, emoji: '🎯', days: daysLeftOf(seasonal.exam2Date), habitIds: prefs.exam2PlanHabitIds, taskIds: prefs.exam2PlanTaskIds });
      if (seasonal.exam3Name) entries.push({ key: 'exam3', label: seasonal.exam3Name, color: MC.exam, textColor: MCT.exam, emoji: '🎯', days: daysLeftOf(seasonal.exam3Date), habitIds: prefs.exam3PlanHabitIds, taskIds: prefs.exam3PlanTaskIds });
    }
    if (seasonal.tezMode) entries.push({ key: 'tez', label: seasonal.tezName || names.thesis, color: MC.tez, textColor: MCT.tez, emoji: '📚', days: daysLeftOf(seasonal.tezDate), habitIds: prefs.tezPlanHabitIds, taskIds: prefs.tezPlanTaskIds });
    if (seasonal.mulakatMode) {
      entries.push({ key: 'mulakat', label: seasonal.mulakatName || mulLbl, color: MC.mulakat, textColor: MCT.mulakat, emoji: '💼', days: daysLeftOf(seasonal.mulakatDate), habitIds: prefs.mulakatPlanHabitIds, taskIds: prefs.mulakatPlanTaskIds });
      if (seasonal.mulakat2Name) entries.push({ key: 'mulakat2', label: seasonal.mulakat2Name, color: MC.mulakat, textColor: MCT.mulakat, emoji: '💼', days: daysLeftOf(seasonal.mulakat2Date), habitIds: prefs.mulakat2PlanHabitIds, taskIds: prefs.mulakat2PlanTaskIds });
      if (seasonal.mulakat3Name) entries.push({ key: 'mulakat3', label: seasonal.mulakat3Name, color: MC.mulakat, textColor: MCT.mulakat, emoji: '💼', days: daysLeftOf(seasonal.mulakat3Date), habitIds: prefs.mulakat3PlanHabitIds, taskIds: prefs.mulakat3PlanTaskIds });
    }
    if (seasonal.sporMode) {
      entries.push({ key: 'spor', label: localizeSporGoal(seasonal.sporGoal || '', tr) || sporLbl, color: MC.spor, textColor: MCT.spor, emoji: '💪', days: daysLeftOf(seasonal.sporDate), habitIds: prefs.sporPlanHabitIds, taskIds: prefs.sporPlanTaskIds });
      if (seasonal.spor2Goal) entries.push({ key: 'spor2', label: localizeSporGoal(seasonal.spor2Goal, tr), color: MC.spor, textColor: MCT.spor, emoji: '💪', days: daysLeftOf(seasonal.spor2Date), habitIds: prefs.spor2PlanHabitIds, taskIds: prefs.spor2PlanTaskIds });
      if (seasonal.spor3Goal) entries.push({ key: 'spor3', label: localizeSporGoal(seasonal.spor3Goal, tr), color: MC.spor, textColor: MCT.spor, emoji: '💪', days: daysLeftOf(seasonal.spor3Date), habitIds: prefs.spor3PlanHabitIds, taskIds: prefs.spor3PlanTaskIds });
    }
    if (seasonal.ramazan) entries.push({ key: 'ramazan', label: names.ramadan, color: MC.ramazan, textColor: MCT.ramazan, emoji: '🌙', days: null, habitIds: prefs.ramazanPlanHabitIds, taskIds: prefs.ramazanPlanTaskIds });

    const weekKeys = thisWeekKeys();
    const now = new Date();

    const computed: ModeSummaryEntry[] = entries.map(e => {
      const eHabits = habits.filter(h => e.habitIds.includes(h.id));
      const weekActive = eHabits.filter(h => (Array.isArray(h.completedDates) ? h.completedDates : []).some(d => weekKeys.has(d))).length;
      const pct = eHabits.length > 0 ? Math.round((weekActive / eHabits.length) * 100) : 0;
      /*
        GÖREV SAYIMI SAF FONKSİYONDA (bkz. planProgress).

        Burada `t.tags.includes('daily')` şartı vardı ve bu bir HATAYDI: o etiket yalnız
        günlük plan motorunun ürettiği görevlerde var. Mod kurulurken oluşan görevler
        (ör. "milestone planı yap") bugüne kurulmuş olsa bile sayılmıyordu — ana ekran
        "bugün plan görevin yok" derken Görevler ekranında görev duruyordu.

        `taskTotal` da artık GERÇEKTEN var olan görevleri sayıyor: eskiden kaydedilmiş
        id listesinin uzunluğuydu ve silinmiş görevler de sayılıyordu.
      */
      const progress = planProgressFor(tasks, e.taskIds, now);
      return { ...e, habitCount: eHabits.length, weekActive, pct, ...progress };
    });

    const dated = computed.filter(c => c.days !== null && c.days >= 0).sort((a, b) => (a.days! - b.days!));
    const totalHabits = computed.reduce((a, c) => a + c.habitCount, 0);
    const totalWeekActive = computed.reduce((a, c) => a + c.weekActive, 0);

    /*
      EN ACİL OLAN ÖNCE. Ana ekran listenin ilk girişini gösteriyor; hangisinin ilk
      olacağına ekran değil burası karar veriyor. Tarihi olanlar yakınlık sırasına
      göre, süresizler (Ramazan) sona.
    */
    const ordered = [...dated, ...computed.filter(c => !dated.includes(c))];

    return {
      entries: ordered,
      activeCount: computed.length,
      nearest: dated[0] ?? null,
      totalHabits,
      totalWeekActive,
      overallPct: totalHabits > 0 ? Math.round((totalWeekActive / totalHabits) * 100) : 0,
      todayDoneAll: computed.reduce((a, c) => a + c.todayDone, 0),
      todayTotalAll: computed.reduce((a, c) => a + c.todayTotal, 0),
    };
  }, [isDark, tr, names, seasonal, prefs, habits, tasks]);
}
