import fs from 'fs';
import path from 'path';
import { splitByHorizon, isLater, whenLabel, horizonCopy, NEAR_DAYS } from '@/features/tasks/utils/horizon';

/**
 * UFUK — Görevler listesinde uzak işler KATLANIR, gizlenmez.
 *
 * Eskiden "İleri Tarihli Eklenenleri Göster" anahtarı vardı: kapalıyken yarına eklenen
 * görev kaydedilir kaydedilmez listeden kayboluyordu, açıkken aylar sonrası listeyi
 * dolduruyordu. Sabit an: 19 Eylül 2026 Cumartesi, 10:00.
 */
const NOW = new Date(2026, 8, 19, 10, 0, 0);
const t = (dueDate: string | null, isCompleted = false) => ({ dueDate, isCompleted });

describe('ufuk sınırı', () => {
  it(`${NEAR_DAYS}. gün AÇIK, ${NEAR_DAYS + 1}. gün katlı`, () => {
    expect(isLater(t('2026-09-26T00:00:00Z'), NOW)).toBe(false); // +7
    expect(isLater(t('2026-09-27T00:00:00Z'), NOW)).toBe(true);  // +8
  });

  it('yarın, bugün ve gecikmiş hep açık', () => {
    for (const d of ['2026-09-20', '2026-09-19', '2026-09-01']) expect(isLater(t(d), NOW)).toBe(false);
  });

  it('tarihsiz, "tarih yok" ve TAMAMLANMIŞ görev hiçbir zaman katlanmaz', () => {
    expect(isLater(t(null), NOW)).toBe(false);
    expect(isLater(t('0001-01-01T00:00:00Z'), NOW)).toBe(false);
    expect(isLater(t('2027-01-01', true), NOW)).toBe(false);
  });

  it('ayırma sırayı BOZMAZ — elle sıralama ve öncelik sıralaması korunur', () => {
    const list = [t('2026-12-01'), t('2026-09-20'), t('2026-11-01'), t(null)];
    const { near, later } = splitByHorizon(list, NOW);
    expect(near).toEqual([list[1], list[3]]);
    expect(later).toEqual([list[0], list[2]]);
  });
});

describe('"nereye eklendi" etiketi', () => {
  it('bugün, geçmiş ve tarihsiz için sessiz — görev zaten önünde', () => {
    expect(whenLabel('2026-09-19', 'tr', NOW)).toBeNull();
    expect(whenLabel('2026-09-10', 'tr', NOW)).toBeNull();
    expect(whenLabel(null, 'tr', NOW)).toBeNull();
  });

  it('yarın → "Yarın", bu hafta → gün adı, sonrası → tarih', () => {
    expect(whenLabel('2026-09-20', 'tr', NOW)).toBe('Yarın');
    expect(whenLabel('2026-09-25T00:00:00.000Z', 'tr', NOW)).toBe('Cuma');
    expect(whenLabel('2026-10-25', 'tr', NOW)).toBe('25 Ekim');
    expect(whenLabel('2026-10-25', 'en', NOW)).toBe('October 25');
  });

  it('mesajlar doğal okunur', () => {
    const tr = horizonCopy('tr');
    expect(tr.added('Yarın')).toBe('Yarın için eklendi');
    expect(tr.titled('Kira', 'Yarın')).toBe('"Kira" yarın için eklendi.');
    expect(tr.titled('Kira', '25 Ekim')).toBe('"Kira" 25 Ekim için eklendi.');
    expect(horizonCopy('en').titled('Rent', 'Tomorrow')).toBe('"Rent" added for tomorrow.');
  });
});

describe('Görevler ekranı bağlantısı', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'app/tasks.tsx'), 'utf8');

  it('eski "ileri tarihlileri göster" anahtarı geri gelmez', () => {
    expect(src).not.toContain('showFutureManualTasks');
    expect(src).not.toContain('İleri Tarihli Eklenenleri Göster');
  });

  it('arama/etiket/tarih süzgecinde KATLAMA YOK — aranan görev saklı kalmasın', () => {
    expect(src).toMatch(/searchQuery\.trim\(\) \|\| tagFilter \|\| dateFilter/);
  });

  it('yalnız ileride işi olan kullanıcıya "hiç planın yok" denmez', () => {
    expect(src).toContain('const onlyLater = !isSearch && horizon.later.length > 0;');
  });
});
