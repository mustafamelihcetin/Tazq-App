import { extractPlanFromText } from '../utils/planExtractor';

describe('extractPlanFromText (kural-tabanlı Öner)', () => {
  it('splits comma-separated items into separate tasks/habits', () => {
    const { habits, tasks } = extractPlanFromText('Sabah koşusu, kilo vermek, daha sağlıklı beslenmek', true);
    // koşu + beslenme → alışkanlık; "kilo vermek" → görev
    expect(habits.length).toBeGreaterThanOrEqual(2);
    expect(tasks.some(t => /kilo/i.test(t.titleTr))).toBe(true);
  });

  it('detects habits from keywords', () => {
    const { habits } = extractPlanFromText('Her gün su içmek ve kitap okumak istiyorum', true);
    const names = habits.map(h => h.nameTr);
    expect(names).toEqual(expect.arrayContaining(['Su İçmek', 'Okuma']));
  });

  it('assigns High priority to action verbs', () => {
    const { tasks } = extractPlanFromText('Raporu bugün teslim et', true);
    expect(tasks[0]?.priority).toBe('High');
  });

  it('does not duplicate a short habit phrase as a task', () => {
    const { tasks } = extractPlanFromText('koşu', true);
    expect(tasks.length).toBe(0); // sadece alışkanlık olur
  });

  it('returns empty for empty input', () => {
    const { habits, tasks } = extractPlanFromText('', true);
    expect(habits).toHaveLength(0);
    expect(tasks).toHaveLength(0);
  });

  it('capitalizes task titles', () => {
    const { tasks } = extractPlanFromText('proje sunumunu hazırla', true);
    expect(tasks[0]?.titleTr.charAt(0)).toBe('P');
  });
});
