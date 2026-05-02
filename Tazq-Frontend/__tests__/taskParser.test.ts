import { parseTaskHint } from '../utils/taskParser';

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
    expect(result.tags).toContain('toplantı');
  });

  it('detects "kod" tag for dev tasks', () => {
    const result = parseTaskHint('kod yaz backend için');
    expect(result.tags).toContain('geliştirme');
  });

  it('returns empty tags for unrecognized text', () => {
    const result = parseTaskHint('xyz abc');
    expect(result.tags ?? []).toHaveLength(0);
  });
});
