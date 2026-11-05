import fs from 'fs';
import path from 'path';
import { probeDelay, probeOnce } from '../shared/hooks/useConnectivityProbe';

const read = (f: string) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

describe('internet geri gelince', () => {
  it('yoklama seyrekleşir, 30 sn üstüne çıkmaz', () => {
    expect(probeDelay(0)).toBe(3000);
    expect(probeDelay(4)).toBe(30000);
    expect(probeDelay(99)).toBe(30000);
  });
  it('yanıt veren her sunucu çevrimiçidir; ağ hatası değildir', async () => {
    await expect(probeOnce('x', (async () => ({ status: 401 })) as never)).resolves.toBe(true);
    await expect(probeOnce('x', (async () => { throw new Error('net'); }) as never)).resolves.toBe(false);
  });
  it('uygulama kökünde çalışır', () => {
    expect(read('app/_layout.tsx')).toContain('useConnectivityProbe(');
  });
});

describe('çevrimdışı yapılan iş buluta geç de olsa gider', () => {
  it('deneme, konu ve öğrenme değişikliği bekleyen işareti yakar', () => {
    const src = read('shared/hooks/usePrefsSync.ts');
    expect(src).toContain('useStudyPlanStore');
    expect(src).toContain('usePlanAffinityStore');
  });
  it('bağlantı gelince kuyruk ve bekleyen tercih akar', () => {
    expect(read('shared/hooks/useOfflineSync.ts')).toContain('if (!isOnline) return;');
    expect(read('shared/hooks/usePrefsSync.ts')).toContain('if (isLoggedIn && isOnline && dirty.current)');
  });
});
