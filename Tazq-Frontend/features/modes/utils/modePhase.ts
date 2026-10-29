/**
 * MODUN FAZI — durum rozeti ve yol haritası için (madde 7).
 *
 * Sınavda faz modeli ZATEN var (examPresets.getPhase: şablon önerisi ve günlük motor
 * onu kullanıyor); burada ikinci bir sınav modeli yazmak, rozetin "Hızlanma" derken
 * motorun "Pekiştirme" görevi üretmesi demek olurdu. Diğer tarihli modlar (tez,
 * mülakat, spor) kalan güne göre dört faza ayrılır. Süresiz modların (Ramazan,
 * tasarruf, bırakma) fazı yoktur — onlarda ilerleme konuşulur.
 */
import { getPhase, type StudyPhase } from '@/shared/utils/examPresets';

type Name = { tr: string; en: string };

const EXAM_ORDER: StudyPhase[] = ['foundation', 'deepen', 'reinforce', 'accelerate', 'sprint'];
const EXAM_NAMES: Record<StudyPhase, Name> = {
  foundation: { tr: 'Temel İnşa', en: 'Foundation' },
  deepen: { tr: 'Derinleşme', en: 'Deepening' },
  reinforce: { tr: 'Pekiştirme', en: 'Reinforcement' },
  accelerate: { tr: 'Hızlanma', en: 'Acceleration' },
  sprint: { tr: 'Son Sprint', en: 'Final Sprint' },
};

const GENERIC_NAMES: Name[] = [
  { tr: 'Hazırlık', en: 'Groundwork' },
  { tr: 'Gelişim', en: 'Build-up' },
  { tr: 'Yoğunlaşma', en: 'Intensify' },
  { tr: 'Son Düzlük', en: 'Final Stretch' },
];
const genericIndex = (daysLeft: number) => (daysLeft > 60 ? 0 : daysLeft > 30 ? 1 : daysLeft > 7 ? 2 : 3);

const DATED = new Set(['exam', 'tez', 'mulakat', 'spor']);

export interface ModePhase extends Name {
  index: number;
  total: number;
  names: Name[];
}

/** `slot`: exam, exam2, tez, spor3… (rakam soneki yuvadır, tür değil). */
export function modePhase(slot: string, daysLeft: number | null): ModePhase | null {
  const kind = slot.replace(/\d+$/, '');
  if (!DATED.has(kind) || daysLeft == null || daysLeft < 0) return null;
  if (kind === 'exam') {
    const phase = getPhase(daysLeft);
    return { ...EXAM_NAMES[phase], index: EXAM_ORDER.indexOf(phase), total: EXAM_ORDER.length, names: EXAM_ORDER.map(p => EXAM_NAMES[p]) };
  }
  const index = genericIndex(daysLeft);
  return { ...GENERIC_NAMES[index], index, total: GENERIC_NAMES.length, names: GENERIC_NAMES };
}
