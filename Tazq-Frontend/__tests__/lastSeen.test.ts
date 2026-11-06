import fs from 'fs';
import path from 'path';
import { lastSeenLabel } from '@/features/admin/utils/lastSeen';

const NOW = new Date(2026, 10, 6, 15, 0, 0);

describe('son görülme', () => {
  it('az önce, bugün, dün ve tarih', () => {
    expect(lastSeenLabel(new Date(2026, 10, 6, 14, 59, 30).toISOString(), 'tr', NOW)).toBe('Az önce görüldü');
    expect(lastSeenLabel(new Date(2026, 10, 6, 9, 5).toISOString(), 'tr', NOW)).toMatch(/^Bugün 09[:.]05$/);
    expect(lastSeenLabel(new Date(2026, 10, 5, 23, 50).toISOString(), 'tr', NOW)).toMatch(/^Dün 23[:.]50$/);
    expect(lastSeenLabel(new Date(2026, 10, 3, 18, 20).toISOString(), 'tr', NOW)).toMatch(/^3 Kas.* 18[:.]20$/);
    expect(lastSeenLabel(new Date(2025, 10, 3, 18, 20).toISOString(), 'tr', NOW)).toContain('2025');
  });
  it('bilgi yoksa dürüst söyler, bozuk tarih çökertmez', () => {
    expect(lastSeenLabel(null, 'tr', NOW)).toBe('Henüz görülmedi');
    expect(lastSeenLabel('bozuk', 'en', NOW)).toBe('Not seen yet');
  });
  it('panel sunucunun gönderdiği alanı okur', () => {
    const admin = fs.readFileSync(path.join(__dirname, '../app/admin.tsx'), 'utf8');
    expect(admin).toContain('lastSeenLabel(user.lastActivityAt');
    // Sunucu sözleşmesi: UserListItem.LastActivityAt, JSON'da lastActivityAt.
    expect(fs.readFileSync(path.join(__dirname, '../../Tazq-Backend/Services/IAdminService.cs'), 'utf8')).toContain('DateTime? LastActivityAt');
  });
});
