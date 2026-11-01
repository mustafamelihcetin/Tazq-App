import { initialsOf } from '@/features/user/components/AuraAvatar';

/* AURA AVATAR (2026-11-01): yalnız ilk harf — iki harf istenmeyen kısaltma üretebiliyordu ("Osman Çilingir" → "OÇ"). */
describe('aura harfi', () => {
  it('yalnız adın ilk harfi, Türkçe i → İ', () => {
    expect(initialsOf('Osman Çilingir')).toBe('O');
    expect(initialsOf('ilkay')).toBe('İ');
    expect(initialsOf('  Ayşe  Nur  Kaya ')).toBe('A');
  });
  it('ad yoksa harf yok (yalnız aura)', () => {
    expect(initialsOf('')).toBe('');
    expect(initialsOf(null)).toBe('');
  });
});
