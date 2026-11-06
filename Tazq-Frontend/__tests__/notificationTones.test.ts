import fs from 'fs';
import path from 'path';
import { TONES_SINCE, tonesSupported } from '@/shared/utils/notificationTones';

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'shared/utils/notifications.ts'), 'utf8');
const layout = fs.readFileSync(path.join(root, 'app/_layout.tsx'), 'utf8');
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
const FILES = ['tazq_hatirlatma.wav', 'tazq_odak.wav', 'tazq_odeme.wav', 'tazq_ozet.wav'];

describe('TAZQ bildirim sesleri', () => {
  const plugin = app.expo.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-notifications');

  it('dört ses de derlemeye girer ve dosyası vardır', () => {
    for (const f of FILES) {
      expect(plugin[1].sounds).toContain(`./assets/sounds/notify/${f}`);
      expect(fs.existsSync(path.join(root, 'assets/sounds/notify', f))).toBe(true);
    }
  });

  it('Android kaynak adı kuralı: küçük harf, rakam, alt çizgi', () => {
    for (const f of FILES) expect(f.replace('.wav', '')).toMatch(/^[a-z][a-z0-9_]*$/);
  });

  it('sistem sesiyle giden bildirim kalmadı', () => {
    expect(src).not.toMatch(/sound: (true|'default')/);
  });

  it('kurulan her bildirimin bir sesi ve kanalı var', () => {
    const calls = src.split('scheduleNotificationAsync({').slice(1).map(c => c.slice(0, 1800));
    expect(calls.length).toBeGreaterThan(8);
    for (const c of calls) {
      expect(c).toMatch(/sound: (TONE\.\w+\.file|toneOfCategory)/);
      expect(c).toMatch(/channelId: (TONE\.\w+\.channel|toneOfCategory)/);
    }
    expect(layout).toContain('TONE.reminder.channel');
  });

  it('kanal kimliği sürümlü: Android kanal sesini sonradan değiştirmez', () => {
    expect(fs.readFileSync(path.join(root, 'shared/utils/notificationTones.ts'), 'utf8')).toContain('`tazq-${name}-1`');
  });

  it('eski derlemede sesler istenmez: hata ve kanal kilidi olmaz', () => {
    expect(tonesSupported('2.0.0')).toBe(false);
    expect(tonesSupported('1.9.9')).toBe(false);
    expect(tonesSupported(null)).toBe(false);
    expect(tonesSupported('2.1.0')).toBe(true);
    expect(tonesSupported('2.1')).toBe(true);
    expect(tonesSupported('10.0.0')).toBe(true);
  });

  it('sürümü sesleri içeren derlemeyi açar', () => {
    expect(tonesSupported(app.expo.version, TONES_SINCE)).toBe(true);
  });
});
