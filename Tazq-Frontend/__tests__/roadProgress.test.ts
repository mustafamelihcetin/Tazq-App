import { roadProgress } from '@/features/modes/utils/roadProgress';

const NOW = new Date(2026, 9, 31, 14, 0);

describe('roadProgress', () => {
  it('başlangıçtan bugüne geçen, toplam yol içindeki pay', () => {
    // 21 Eki kuruldu (10 gün geçti), 30 gün kaldı → 10/40
    expect(roadProgress('2026-10-21T08:30:00', 30, NOW)).toBeCloseTo(0.25);
  });

  it('bugün kurulan plan yolun başında', () => {
    expect(roadProgress('2026-10-31T09:00:00', 20, NOW)).toBe(0);
  });

  it('başlangıç bilinmiyorsa ya da gelecekteyse halka yok', () => {
    expect(roadProgress(undefined, 20, NOW)).toBeNull();
    expect(roadProgress('0001-01-01T00:00:00', 20, NOW)).toBeNull();
    expect(roadProgress('2026-11-05', 20, NOW)).toBeNull();
  });

  it('hedef günü geldiyse yol tamam', () => {
    expect(roadProgress('2026-10-01', 0, NOW)).toBe(1);
  });
});
