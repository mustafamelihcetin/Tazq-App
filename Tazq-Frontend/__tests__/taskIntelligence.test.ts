import { categorizeTask } from '@/features/tasks';

describe('taskIntelligence - categorizeTask', () => {
  it('should categorize work-related tasks', async () => {
    const result = await categorizeTask('Yarın toplantı var');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('work');
    expect(result?.label).toBe('iş');
    expect(result?.confidence).toBe(1.0);
  });

  it('should categorize health-related tasks', async () => {
    const result = await categorizeTask('Doktor randevusu al');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('health');
    expect(result?.label).toBe('sağlık');
  });

  it('should categorize finance-related tasks', async () => {
    const result = await categorizeTask('Fatura ödeme');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('finance');
  });

  it('should return null for short input (< 3 chars)', async () => {
    const result = await categorizeTask('ab');
    expect(result).toBeNull();
  });

  it('should return null when no anchor matches', async () => {
    const result = await categorizeTask('Bir şey düşünüyorum');
    expect(result).toBeNull();
  });

  it('should return first matching category for multi-anchor input', async () => {
    // "toplantı" matches work, should return work as it comes first in CATEGORIES
    const result = await categorizeTask('toplantı için spor ayakkabı al');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('work');
  });

  it('should handle empty string', async () => {
    const result = await categorizeTask('');
    expect(result).toBeNull();
  });

  it('should categorize study-related tasks', async () => {
    const result = await categorizeTask('Final sınavına çalış');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('education');
    expect(result?.label).toBe('eğitim');
  });
});
