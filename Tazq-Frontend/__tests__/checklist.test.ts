import { parseChecklist } from '@/features/tasks/nlp/checklist';

describe('kontrol listeli görev', () => {
  it('alım fiiliyle maddelere ayrılır', () => {
    expect(parseChecklist('süt, yumurta, ekmek al', 'tr')).toEqual({ title: 'Alışveriş', items: ['Süt', 'Yumurta', 'Ekmek'] });
    expect(parseChecklist('milk, eggs and bread buy', 'en')?.items).toEqual(['Milk', 'Eggs', 'Bread']);
  });
  it('önekle fiil gerekmez', () => {
    expect(parseChecklist('market: domates, biber, soğan', 'tr')?.items).toHaveLength(3);
  });
  it('sıradan cümleler bozulmaz', () => {
    expect(parseChecklist('Ali, Ayşe, Veli ile toplantı', 'tr')).toBeNull();
    expect(parseChecklist('süt al', 'tr')).toBeNull();
    expect(parseChecklist('süt ve ekmek al', 'tr')).toBeNull();
    expect(parseChecklist('raporu bitir, sunumu hazırla ve ofise git al', 'tr')?.items).toHaveLength(3);
  });
  it('uzun maddeli cümle liste sayılmaz', () => {
    expect(parseChecklist('annemi bu akşam mutlaka ara, faturayı öde, kargoyu al', 'tr')).toBeNull();
  });
});
