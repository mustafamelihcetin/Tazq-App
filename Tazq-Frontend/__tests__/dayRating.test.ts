import fs from 'fs';
import path from 'path';
import { dayRatingKey } from '@/features/modes/utils/dayRating';

const read = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

/**
 * GÜNÜN DEĞERLENDİRMESİ — tek anahtar (2026-10-31, yeniden düzenleme A3 · K-2).
 *
 * Puan (1–5) ana sayfa momentumunu ±10 kaydırır. Yazan (mod bandı, Hedefler) ile okuyan
 * (ana sayfa) anahtarı ayrı ayrı kuruyordu: YKS/KPSS'de band `exam` yuvasına yazıyor, ana
 * sayfa `yks`/`kpss` okuyordu. Band ana sayfadan kalkınca bu kullanıcıların puanı
 * momentuma hiç ulaşmayacaktı.
 */
describe('dayRatingKey', () => {
  it('YKS/KPSS, Hedefler ekranındaki sınav yuvasıyla aynı kaydı kullanır', () => {
    expect(dayRatingKey('yks', '2026-10-31')).toBe(dayRatingKey('exam', '2026-10-31'));
    expect(dayRatingKey('kpss', '2026-10-31')).toBe('tazq_eval_exam_2026-10-31');
  });

  it('ikinci/üçüncü sınav ayrı kalır (biri diğerini ezmez)', () => {
    expect(dayRatingKey('exam2', '2026-10-31')).not.toBe(dayRatingKey('exam', '2026-10-31'));
  });

  it('diğer modlar kendi adıyla', () => {
    expect(dayRatingKey('ramazan', '2026-10-31')).toBe('tazq_eval_ramazan_2026-10-31');
  });

  it('yazan da okuyan da aynı fonksiyonu kullanır', () => {
    expect(read('features/modes/components/TurkishModeBanner.tsx')).toContain('dayRatingKey(');
    expect(read('app/index.tsx')).toContain('dayRatingKey(');
    expect(read('app/index.tsx')).not.toContain('`tazq_eval_');
  });
});
