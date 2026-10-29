/**
 * Madde 4 — "Odaklan" yalnız zihinsel efor isteyen işte. "Su iç" için 25 dakikalık
 * zamanlayıcı önermek, düğmenin anlamını öldürür.
 */
import { isFocusWorthy } from '@/features/focus/focusWorthy';

const t = (title: string, tags: string[] = []) => ({ title, description: null, tags });

describe('isFocusWorthy', () => {
  it.each([
    'Su iç', 'Bugün 2+ litre su iç ve şekerli içecekten kaçın', 'Suyunu iç',
    'Tartıl', 'Sabah tartıl', 'Kilonu gir',
    'İlacını al', 'Vitamin al',
    'Faturayı öde', 'Zekat hesapla ve öde', 'Kirayı öde',
    'Annemi ara', 'Doktoru ara',
    'Drink water', 'Weigh in', 'Take your pills', 'Pay the rent', 'Call mom',
  ])('anlık eylem: %s → odak YOK', (title) => {
    expect(isFocusWorthy(t(title))).toBe(false);
  });

  it.each([
    'Literatür oku ve not al', '20 yeni kelime öğren ve örnek cümleyle kaydet',
    'Proje takip panosu kur', 'Paragraf denemesi çöz', 'Sunumu bitir',
    'Araştırma yap', 'Arayüz tasarımını gözden geçir', 'Ödev hazırla', 'Ödevi bitir',
    'Write the report', 'Study chapter 3', 'Research competitors',
  ])('zihinsel iş: %s → odak VAR', (title) => {
    expect(isFocusWorthy(t(title))).toBe(true);
  });

  it('hatırlatıcı / etkinlik / not / kilo girişi etiketleri odak dışı', () => {
    expect(isFocusWorthy(t('Toplantı', ['etkinlik']))).toBe(false);
    expect(isFocusWorthy(t('Ekmek', ['hatırlatıcı']))).toBe(false);
    expect(isFocusWorthy(t('Fikir', ['note']))).toBe(false);
    expect(isFocusWorthy(t('Haftalık tartı', ['weight_entry']))).toBe(false);
  });

  it('mod görevinde iki dilli yükten okunur', () => {
    const mode = { title: 'x', description: JSON.stringify({ tr: 'Su iç', en: 'Drink water' }), tags: [] };
    expect(isFocusWorthy(mode)).toBe(false);
  });

  it('görev yoksa odak serbest (boş seans)', () => {
    expect(isFocusWorthy(null)).toBe(true);
  });
});
