/**
 * Destek hazır yanıtları: {ad} ilk adla dolar; taslak doluysa şablon sona eklenir (yazılan silinmez).
 */
import { fillTemplate } from '@/features/admin/components/SupportTemplates';

describe('hazır yanıt doldurma', () => {
  it('{ad} → ilk ad', () => {
    expect(fillTemplate('Merhaba {ad}, teşekkürler.', 'Ayşe Yılmaz')).toBe('Merhaba Ayşe, teşekkürler.');
  });
  it('ad yoksa nötr hitap', () => {
    expect(fillTemplate('Merhaba {ad}.', '  ', '', 'merhaba')).toBe('Merhaba merhaba.');
  });
  it('taslak doluysa sona ekler', () => {
    expect(fillTemplate('İyi günler {ad}.', 'Can', 'Önce şunu yazdım  ')).toBe('Önce şunu yazdım\n\nİyi günler Can.');
  });
});
