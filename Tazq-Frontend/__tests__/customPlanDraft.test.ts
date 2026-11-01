import fs from 'fs';
import path from 'path';
import { draftsFromText, QUICK_COLORS, QUICK_EMOJIS } from '@/features/modes/utils/customPlanDraft';

/**
 * "KENDİ PLANINI OLUŞTUR" → ÖNER (2026-10-31, yeniden düzenleme C1-b).
 *
 * Eski çıkarıcı (planExtractor) kelime İÇİNDE arıyordu: "okula" okuma alışkanlığı oluyordu.
 * Artık tek ayrıştırıcı var (features/tasks/nlp/capture.ts). Bu ekran bir modun planı:
 * yazılanlar çoğunlukla DÜZENLİ işler — tarihsiz/saatsiz ve alışkanlık sözlüğünde karşılığı
 * olan madde alışkanlık sayılır (sözlük kelime sınırına bakar; "okula" tuzağına düşmez).
 */
describe('draftsFromText', () => {
  it('virgülle ayrılmış maddeleri ayırır; bilinen etkinlik alışkanlık olur', () => {
    const { habits, tasks } = draftsFromText('Sabah koşusu, kilo vermek, daha sağlıklı beslenmek', 'tr');
    expect(habits.map(h => h.nameTr)).toEqual(expect.arrayContaining(['Sabah koşusu']));
    expect(tasks.some(t => /kilo/i.test(t.titleTr))).toBe(true);
  });

  it('açık tekrar her zaman alışkanlık', () => {
    const { habits } = draftsFromText('Her gün su içmek', 'tr');
    expect(habits.map(h => h.nameTr)).toEqual(['Su içmek']);
  });

  it('kelime içinde aramaz: "okula git" alışkanlık değil, görev', () => {
    const { habits, tasks } = draftsFromText('okula git', 'tr');
    expect(habits).toHaveLength(0);
    expect(tasks.map(t => t.titleTr)).toEqual(['Okula git']);
  });

  it('tarihli iş görevdir (alışkanlık sözlüğünde olsa bile)', () => {
    const { habits, tasks } = draftsFromText('yarın kitap oku', 'tr');
    expect(habits).toHaveLength(0);
    expect(tasks.map(t => t.titleTr)).toEqual(['Kitap oku']);
  });

  it('açık öncelik korunur, yoksa Orta', () => {
    const { tasks } = draftsFromText('acil: raporu teslim et. markete git', 'tr');
    expect(tasks.map(t => t.priority)).toEqual(['High', 'Medium']);
  });

  it('simge ve renk seçilebilir listeden gelir', () => {
    const { habits } = draftsFromText('her gün koşu, her gün meditasyon', 'tr');
    for (const h of habits) {
      expect(QUICK_COLORS).toContain(h.color);
      expect(typeof h.emoji).toBe('string');
    }
    expect(QUICK_EMOJIS.length).toBeGreaterThan(0);
  });

  it('boş girdi boş döner', () => {
    expect(draftsFromText('', 'tr')).toEqual({ habits: [], tasks: [] });
  });

  it('eski çıkarıcı kalmadı', () => {
    const root = path.join(__dirname, '..');
    expect(fs.existsSync(path.join(root, 'shared/utils/planExtractor.ts'))).toBe(false);
    expect(fs.readFileSync(path.join(root, 'features/modes/components/TurkishModeBanner.tsx'), 'utf8')).toContain('draftsFromText(');
  });
});
