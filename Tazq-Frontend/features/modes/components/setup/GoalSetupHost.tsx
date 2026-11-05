import React from 'react';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { ExamSetup, WorkSetup, type ExamResult, type WorkResult } from './ExamWorkSetups';
import { MoneySetup, QuitSetup, SporSetup, type MoneyResult, type QuitResult, type SporResult } from './LifeSetups';
import { useGoalSetupStore } from './SetupShell';

export type SetupResult = ExamResult | WorkResult | SporResult | MoneyResult | QuitResult;

/** Hangi hedef açıldıysa onun soruları. Her açılış temiz başlar: durum bileşenle ölür, vazgeçilirse hiçbir şey kaydedilmez. */
export function GoalSetupHost({ onDone }: { onDone: (r: SetupResult) => void }) {
  const req = useGoalSetupStore(s => s.req);
  const close = useGoalSetupStore(s => s.close);
  const language = useLanguageStore(s => s.language);
  if (!req) return null;
  const lang = language === 'en' ? 'en' : 'tr';
  const finish = (r: SetupResult) => { close(); onDone(r); };
  const key = `${req.kind}-${req.slot}`;
  if (req.kind === 'exam') return <ExamSetup key={key} slot={req.slot} lang={lang} onClose={close} onDone={finish} />;
  if (req.kind === 'tez' || req.kind === 'mulakat') return <WorkSetup key={key} kind={req.kind} slot={req.slot} lang={lang} onClose={close} onDone={finish} />;
  if (req.kind === 'spor') return <SporSetup key={key} slot={req.slot} lang={lang} onClose={close} onDone={finish} />;
  if (req.kind === 'tasarruf') return <MoneySetup key={key} lang={lang} onClose={close} onDone={finish} />;
  return <QuitSetup key={key} lang={lang} onClose={close} onDone={finish} />;
}

export { useGoalSetupStore } from './SetupShell';
export { finishSetup, startFromSetup } from './startFromSetup';
