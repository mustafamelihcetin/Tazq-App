/**
 * Alışkanlık rengi = nereden geldiği: mod alışkanlığı modunun rengi, elle eklenen kullanıcının
 * ölçülmüş paletten seçtiği renk (iki tema için ayrı ton). Eski renkler en yakın palet rengine.
 */
import { habitColor, paletteOf, modeFamily, HABIT_PALETTE } from '@/features/habits/utils/habitColor';
import { ModeAccents, CategoryColors } from '@/shared/constants/Colors';

describe('alışkanlık rengi', () => {
  it('mod alışkanlığı modunun rengini taşır — şablondaki renk yok sayılır', () => {
    expect(habitColor({ planMode: 'tez', color: CategoryColors.red }, false)).toBe(ModeAccents.tez.light);
    expect(habitColor({ planMode: 'tez', color: CategoryColors.red }, true)).toBe(ModeAccents.tez.dark);
  });

  it('modun 2./3. yuvası aynı ailenin rengi', () => {
    expect(modeFamily('exam2')).toBe('exam');
    expect(habitColor({ planMode: 'spor3' }, false)).toBe(ModeAccents.spor.light);
  });

  it('elle eklenen: kayıtlı açık ton, koyu temada aynı rengin koyu tonu', () => {
    const p = HABIT_PALETTE[2];
    expect(habitColor({ color: p.light }, false)).toBe(p.light);
    expect(habitColor({ color: p.light }, true)).toBe(p.dark);
  });

  it('eski renkler en yakın palet tonuna eşlenir; bozuk değer maviye düşer', () => {
    expect(paletteOf('#7C3AED').id).toBe('violet'); // eski secondary
    expect(paletteOf('#EF4444').id).toBe('brick');  // eski kırmızı
    expect(paletteOf(undefined).id).toBe('blue');
    expect(paletteOf('xyz').id).toBe('blue');
  });
});
