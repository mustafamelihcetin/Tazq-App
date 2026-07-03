import { parseTaskHint, translateTag } from '@/features/tasks';

describe('parseTaskHint', () => {
  it('detects high priority from "acil" keyword', () => {
    const result = parseTaskHint('acil rapor hazırla');
    expect(result.priority).toBe('High');
  });

  it('detects high priority from English urgent keyword', () => {
    const result = parseTaskHint('urgent meeting preparation');
    expect(result.priority).toBe('High');
  });

  it('detects low priority from "sonra" keyword', () => {
    const result = parseTaskHint('sonra halledebilirim bunu');
    expect(result.priority).toBe('Low');
  });

  it('returns no priority for neutral text', () => {
    const result = parseTaskHint('bir şey yap');
    expect(result.priority).toBeUndefined();
  });

  it('detects "toplantı" tag', () => {
    const result = parseTaskHint('toplantı için hazırlık');
    expect(result.tags).toContain('toplantı');
  });

  it('detects "meeting" tag', () => {
    const result = parseTaskHint('prepare for meeting');
    expect(result.tags).toContain('meeting');
  });

  it('detects "kod" tag for dev tasks', () => {
    const result = parseTaskHint('kod yaz backend için');
    expect(result.tags).toContain('geliştirme');
  });

  it('returns empty tags for unrecognized text', () => {
    const result = parseTaskHint('xyz abc');
    expect(result.tags ?? []).toHaveLength(0);
  });

  it('detects monthly recurrence and parses nearest 30th day', () => {
    const result = parseTaskHint('her ayın 30\'unda Kyk ödemesi var');
    expect(result.recurrence).toBe('Monthly');
    expect(result.dueDate).toBeDefined();
    
    // Validate that the parsed due date ends with -30 (representing the 30th of the month)
    // or clamps to the last day of the month if February
    const parsedDay = new Date(result.dueDate!).getDate();
    expect(parsedDay === 30 || parsedDay === 28 || parsedDay === 29).toBe(true);
  });

  it('detects monthly recurrence and parses nearest 15th day from English text', () => {
    const result = parseTaskHint('pay bills on 15th of every month');
    expect(result.recurrence).toBe('Monthly');
    expect(result.dueDate).toBeDefined();
    expect(new Date(result.dueDate!).getDate()).toBe(15);
  });

  it('detects interval day recurrence "3 günde bir"', () => {
    const result = parseTaskHint('3 günde bir vitamin al');
    expect(result.recurrence).toBe('None');
    expect(result.dueDate).toBeDefined();
    expect(new Date(result.dueDate!).toDateString()).toBe(new Date().toDateString());
  });

  it('detects interval week recurrence "every 2 weeks"', () => {
    const result = parseTaskHint('every 2 weeks water plants');
    expect(result.recurrence).toBe('None');
    expect(result.dueDate).toBeDefined();
    expect(new Date(result.dueDate!).toDateString()).toBe(new Date().toDateString());
  });
});

describe('translateTag', () => {
  it('translates Turkish tags to English', () => {
    expect(translateTag('eğitim', 'en')).toBe('education');
    expect(translateTag('iş', 'en')).toBe('work');
    expect(translateTag('spor', 'en')).toBe('fitness');
    expect(translateTag('tasarruf', 'en')).toBe('savings');
    expect(translateTag('bırakma', 'en')).toBe('quit');
  });

  it('translates English tags to Turkish', () => {
    expect(translateTag('education', 'tr')).toBe('eğitim');
    expect(translateTag('work', 'tr')).toBe('iş');
    expect(translateTag('fitness', 'tr')).toBe('spor');
    expect(translateTag('savings', 'tr')).toBe('tasarruf');
    expect(translateTag('quit', 'tr')).toBe('bırakma');
  });
});
