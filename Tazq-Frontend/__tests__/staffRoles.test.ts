/**
 * Ekip rolleri — sunucudaki StaffPolicy merdiveniyle aynı (bkz. Tazq-Backend/Authorization/StaffRoles.cs).
 * Destek rolü kullanıcıları görmez; moderatör banlar; kişisel veri ve sistem yalnız süper adminde.
 */
import { canStaff, roleLabel, roleDescription, STAFF_ROLES, isAnalystOnly } from '@/shared/utils/staffRoles';

describe('ekip rolleri', () => {
  // Sütunlar: staff (panel), support, users, insights, moderate, super — sunucu matrisiyle aynı.
  it.each([
    ['User', false, false, false, false, false, false],
    ['Support', true, true, false, false, false, false],
    ['Analyst', true, false, false, true, false, false],
    ['Moderator', true, true, true, false, true, false],
    ['Admin', true, true, true, true, true, true],
    [undefined, false, false, false, false, false, false],
    ['Root', false, false, false, false, false, false], // bilinmeyen rol hiçbir şey açmaz
  ])('%s', (role, staff, support, users, insights, moderate, sup) => {
    const r = role as string | undefined;
    expect([canStaff(r, 'staff'), canStaff(r, 'support'), canStaff(r, 'users'), canStaff(r, 'insights'), canStaff(r, 'moderate'), canStaff(r, 'super')])
      .toEqual([staff, support, users, insights, moderate, sup]);
  });

  it('roller sunucuyla aynı küme ve okunur etiketli', () => {
    expect(STAFF_ROLES).toEqual(['User', 'Support', 'Analyst', 'Moderator', 'Admin']);
    expect(roleLabel('Admin', 'tr')).toBe('Süper admin');
    expect(roleLabel('Analyst', 'tr')).toBe('Ürün Analisti');
    expect(isAnalystOnly('Analyst')).toBe(true);
    expect(isAnalystOnly('Admin')).toBe(false);
  });

  it('her rolün iki dilde ayrı bir açıklaması var (rol seçicide karışmasın)', () => {
    for (const lang of ['tr', 'en']) {
      const ds = STAFF_ROLES.map(r => roleDescription(r, lang));
      expect(new Set(ds).size).toBe(STAFF_ROLES.length);
      ds.forEach(d => expect(d.length).toBeGreaterThan(10));
    }
    expect(roleDescription('Analyst', 'tr')).toMatch(/kişi/);
  });
});
