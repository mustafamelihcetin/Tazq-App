import type { BudgetType } from '@/shared/store/useBudgetStore';

/*
  KURULUM KURALLARI (2026-11-05). Saf: ekran bilmez, test edilir. Spor kartının ve Hedefler ekranının kullandığı kurallarla aynı eşikler.
  Sağlıklı tempo: kilo verme haftada 0,5 kg, kilo alma haftada 0,25 kg. Sağlıklı alt sınır BMI 18,5.
*/
export type KiloProblem = 'empty' | 'range' | 'far' | 'same' | 'low' | null;

export function kiloCheck(cwText: string, twText: string, heightText: string) {
  const cw = parseFloat(cwText);
  const tw = parseFloat(twText);
  const h = parseFloat(heightText);
  const heightM = h >= 100 && h <= 250 ? h / 100 : 0;
  const minKg = heightM > 0 ? parseFloat((18.5 * heightM * heightM).toFixed(1)) : 0;
  const gaining = tw > cw;
  const rate = gaining ? 0.25 : 0.5;
  const diff = cw > 0 && tw > 0 ? Math.abs(cw - tw) : 0;
  let problem: KiloProblem = null;
  if (!(cw > 0) || !(tw > 0)) problem = 'empty';
  else if (cw < 30 || cw > 300 || tw < 30 || tw > 300) problem = 'range';
  else if (diff > 100) problem = 'far';
  else if (cw === tw) problem = 'same';
  else if (minKg > 0 && tw < minKg) problem = 'low';
  return { ok: problem === null, problem, gaining, rate, diff, minKg, weeks: problem === null ? Math.ceil(diff / rate) : null };
}

/** Türe göre başlangıç ve hedef: borç sıfıra iner, acil fon aylık gider × ay, birikim kullanıcının hedefi. */
export function moneyCheck(type: Exclude<BudgetType, ''> | '', start: number, target: number, monthly: number, cover: number) {
  if (type === 'borc') return { ok: start > 0, start, target: 0 };
  if (type === 'acilfon') { const t = monthly * cover; return { ok: monthly > 0 && t > start, start, target: t }; }
  if (type === 'birikim') return { ok: target > start, start, target };
  return { ok: false, start, target: 0 };
}

/** Ayda gereken tutar; yukarı yuvarlanır ki son ay eksik kalmasın. */
export const monthlyNeed = (start: number, target: number, months: number): number => (months > 0 ? Math.ceil(Math.abs(target - start) / months) : 0);
