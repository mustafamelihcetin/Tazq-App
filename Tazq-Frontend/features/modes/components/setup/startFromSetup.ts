import { openPlan } from '@/features/modes/components/plan/PlanLink';
import { usePrefsStore, type PlanMode } from '@/features/modes/store/usePrefsStore';
import { useSporStore } from '@/features/modes/store/useSporStore';
import { startBirakmaPlan, startTasarrufPlan } from '@/features/modes/utils/lifePlanStart';
import { useStudyPlanStore } from '@/features/studyplan/store/useStudyPlanStore';
import { runStudySync, studyToday } from '@/features/studyplan/sync';
import { planKeyFor } from '@/features/studyplan/utils/planCore';
import type { SetupResult } from './GoalSetupHost';

/*
  ADIM ADIM KURULUM BİTTİ (bkz. SetupShell). Cevaplar yalnız burada kaydedilir: vazgeçene kayıt yok.
  Sınav, tez, mülakat ve spor planı Hedefler ekranındaki ortak uygulama yolundan sorusuz geçer; birikim ve bırakma kendi başlatıcısından. Sonunda Planım açılır.
  Girdi durumları da aynı anda yazılır: planı kuran kod onları okuyor (mod önizlemesi, kilo görevi).
*/
type Pair = [(v: string) => void, (v: string) => void];
type Pref = (key: never, value: never) => void;
export interface SetupContext {
  lang: 'tr' | 'en';
  setSeasonalPref: Pref;
  runAdaptations: (force?: boolean) => unknown;
  preview: (p: Record<string, unknown>) => void;
  examTemplate: (minutes?: number) => string;
  inputs: Record<string, Pair>;
}

/** Plan uygulandı: sınavda seviyeler işlenir, Planım açılır. */
export function finishSetup(done: { slot: string; after?: () => void }): void {
  done.after?.();
  openPlan(done.slot);
}

export function startFromSetup(r: SetupResult, ctx: SetupContext): void {
  const set = (k: string, v: unknown) => (ctx.setSeasonalPref as unknown as (a: string, b: unknown) => void)(k, v);
  const key = Date.now();
  const refresh = () => { setTimeout(() => ctx.runAdaptations(true), 300); };

  if (r.kind === 'exam') {
    const prefix = r.slot === 'exam' ? 'exam' : r.slot;
    set('examMode', true);
    set(`${prefix}Name`, r.name);
    set(`${prefix}Date`, r.date);
    usePrefsStore.getState().setPlanDraftMinutes(r.slot as PlanMode, r.minutes);
    const after = () => {
      runStudySync();
      const today = studyToday();
      const store = useStudyPlanStore.getState();
      for (const [subject, level] of Object.entries(r.levels)) if (level !== 'yok') store.setLevel(planKeyFor(r.name), subject, level, today);
    };
    ctx.preview({ type: 'exam', key, setup: { slot: r.slot, after, minutes: r.minutes }, examSlot: r.slot, examName: r.name, examDate: r.date, templateId: ctx.examTemplate(r.minutes), examTipTr: r.preset?.tipTr, examTipEn: r.preset?.tipEn });
    return;
  }
  if (r.kind === 'tez' || r.kind === 'mulakat') {
    set(`${r.kind}Mode`, true);
    set(`${r.slot}Name`, r.name);
    set(`${r.slot}Date`, r.date);
    ctx.inputs[r.slot][0](r.name);
    ctx.inputs[r.slot][1](r.date);
    usePrefsStore.getState().setWeakTopicIds(r.slot as PlanMode, r.areas);
    ctx.preview(r.kind === 'tez' ? { type: 'tez', key, setup: { slot: 'tez' } } : { type: 'mulakat', key, mulakatSlot: r.slot, setup: { slot: r.slot } });
    return;
  }
  if (r.kind === 'spor') {
    set('sporMode', true);
    set(`${r.slot}Goal`, r.goal);
    set(`${r.slot}Date`, r.date);
    ctx.inputs[r.slot][0](r.goal);
    ctx.inputs[r.slot][1](r.date);
    if (r.slot === 'spor') {
      const spor = useSporStore.getState();
      // Kilo uydurulmaz: yalnız kullanıcının girdiği yazılır.
      if (r.typeKey === 'kilo') { spor.setCurrentWeight(r.cw); spor.setTargetWeight(r.tw); if (r.height) spor.setHeightCm(r.height); if (r.age) spor.setAgeYears(r.age); }
      if (r.typeKey === 'maraton') { spor.setWeeklyKm(r.weeklyKm); spor.setTargetEvent(r.event as never); }
      if (r.trainingDays) spor.setTrainingDays(r.trainingDays);
    }
    ctx.preview({ type: 'spor', key, sporSlot: r.slot, setup: { slot: r.slot } });
    return;
  }
  if (r.kind === 'tasarruf') {
    void startTasarrufPlan({ type: r.type, start: r.start, target: r.target, monthly: r.monthly, cover: r.cover, months: r.months, area: r.area, lang: ctx.lang }).then(() => { refresh(); openPlan('tasarruf'); });
    return;
  }
  const quit = r as Extract<SetupResult, { kind: 'birakma' }>;
  void startBirakmaPlan({ keys: quit.keys, custom: quit.custom, trigger: quit.trigger, lang: ctx.lang }).then(() => { refresh(); openPlan('birakma'); });
}
