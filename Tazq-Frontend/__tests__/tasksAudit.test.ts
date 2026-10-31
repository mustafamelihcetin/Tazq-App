import fs from 'fs';
import path from 'path';

const read = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

/**
 * GÖREVLER EKRANI — impeccable denetimi (2026-10-31), 13/20. Cihaz görüntüsü + kod.
 */
describe('Görevler — sıralama menüsü ekran okuyucuya durumunu söylüyor', () => {
  const SRC = read('app/tasks.tsx');
  const block = (from: string) => SRC.slice(SRC.indexOf(from), SRC.indexOf('</Touchable>', SRC.indexOf(from)));

  it('"Tamamlananları gizle" bir onay kutusu: açık/kapalı okunur', () => {
    const b = block('setHideCompleted(!hideCompleted)');
    expect(b).toContain('accessibilityRole="checkbox"');
    expect(b).toContain('accessibilityState={{ checked: hideCompleted }}');
  });

  it('sıralama seçenekleri hangisinin seçili olduğunu söyler', () => {
    const b = block('setSortBy(key)');
    expect(b).toContain('accessibilityRole="button"');
    expect(b).toContain('accessibilityState={{ selected: sortBy === key }}');
  });

  it('arşiv satırı düğme olarak okunur', () => {
    expect(block("router.push('/archive')")).toContain('accessibilityRole="button"');
  });
});

describe('Görevler — dokunma alanı 44 pt', () => {
  it('üst çubuktaki 40 pt düğmeler dokunma alanını tamamlar', () => {
    const SRC = read('app/tasks.tsx');
    expect((SRC.match(/hitSlop=\{HEADER_SLOP\}/g) ?? []).length).toBe(3);
  });

  it('açılan satırdaki 32 pt düğmeler dokunma alanını tamamlar', () => {
    const ROW = read('features/tasks/components/TaskListItem.tsx');
    expect((ROW.match(/hitSlop=\{touchSlop\(ACTION_H\)\}/g) ?? []).length).toBe(2);
  });
});

describe('Görevler — boş liste ekranı', () => {
  const SRC = read('app/tasks.tsx');
  const empty = SRC.slice(SRC.indexOf('ListEmptyComponent'), SRC.indexOf('renderItem='));

  it('ikon bir kez oynar ve durur (sonsuz döngü yok)', () => {
    expect(empty).not.toMatch(/loop:\s*true/);
  });

  it('ham renk yok; başlık cümle düzeninde', () => {
    expect(empty).not.toContain('#F59E0B');
    expect(empty).toContain("'Bugün dünyayı kurtardın!'");
    expect(empty).not.toContain('Dünyayı Kurtardın');
  });
});

describe('Görevler — menü yazımı cümle düzeninde (Türkçe)', () => {
  it('"Sadece bugün", "Tamamlananları gizle", "Arşiv klasörü", "Bitiş tarihi"', () => {
    const SRC = read('app/tasks.tsx');
    expect(SRC).toContain("'Sadece bugün'");
    expect(SRC).toContain("'Tamamlananları gizle'");
    expect(SRC).toContain("'Arşiv klasörü'");
    expect(read('shared/constants/i18n.ts')).toContain("sortByDate: 'Bitiş tarihi'");
  });
});

describe('Görevler — terim ve ton (2026-10-31)', () => {
  const I18N = read('shared/constants/i18n.ts');
  it('ekran başlığı sekmeyle aynı: "Görevler" (eskiden "Aksiyon Merkezi")', () => {
    expect(I18N).toContain("actionCenter: 'Görevler'");
    expect(I18N).toContain("actionCenter: 'Tasks'");
    expect(I18N).not.toMatch(/: 'Aksiyon Merkezi'/);
  });
  it('sayı nötr: "N görevin var" (eskiden "seni bekliyor")', () => {
    expect(I18N).toContain("tasksPending: '{n} görevin var'");
    expect(read('app/index.tsx')).not.toContain('görevin seni bekliyor');
  });
  it('kullanıcının gördüğü yerde eski ad kalmadı', () => {
    expect(read('features/modes/components/modes/BirakmaCard.tsx')).not.toMatch(/'[^']*Aksiyon[^']*'/);
    expect(read('features/promo/promoCopy.ts')).not.toContain('Aksiyon Merkezi');
  });
});

describe('Görevler — ham renk ve başlık kalabalığı', () => {
  const SRC = read('app/tasks.tsx');

  it('arama çubuğu tema renklerinden', () => {
    expect(SRC).not.toContain("'#FFFFFF'");
    expect(SRC).not.toMatch(/borderColor: isDark \? 'rgba\(255,255,255,0\.15\)'/);
  });

  it('başlık tek satır: "N görev seni bekliyor" + temizle (üstte küçük etiket ve "Sırada Ne Var?" yok)', () => {
    expect(SRC).not.toContain('styles.subHeadline');
    expect(SRC).not.toContain('{t.upcoming}');
  });
});
