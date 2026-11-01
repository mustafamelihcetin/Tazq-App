import fs from 'fs';
import path from 'path';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';

const read = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

/**
 * İLK DAKİKA ÖLÇÜMÜ (C0, 2026-10-31).
 *
 * `track()` yalnız Sentry kırıntısı yazıyor; kırıntı bir hata olmadan görünmez, SAYILAMAZ. "Kaç kişi
 * yazdı, kaç kişi atladı, kaç madde ekledi" sorusu bu yüzden tercih alanıyla ölçülür: buluta eşitlenen
 * `firstCapture` (yalnız sayı ve enum — yazılan metin ASLA), sunucuda AnalyticsService.FirstMinuteOf toplar.
 */
describe('firstCapture tercihi', () => {
  beforeEach(() => usePrefsStore.getState().resetUserData());

  it('başta yok; bir kez yazılır, ikinci yazım ezmez (ilk dakika bir kez olur)', () => {
    expect(usePrefsStore.getState().firstCapture).toBeNull();
    usePrefsStore.getState().recordFirstCapture({ result: 'wrote', items: 3, habits: 1, modeSuggested: 'exam', modeAccepted: true });
    usePrefsStore.getState().recordFirstCapture({ result: 'skipped', items: 0, habits: 0, modeSuggested: null, modeAccepted: false });
    const fc = usePrefsStore.getState().firstCapture;
    expect(fc).toMatchObject({ result: 'wrote', items: 3, habits: 1, modeSuggested: 'exam', modeAccepted: true });
    expect(typeof fc?.at).toBe('string');
  });

  it('çıkışta sıfırlanır', () => {
    usePrefsStore.getState().recordFirstCapture({ result: 'skipped', items: 0, habits: 0, modeSuggested: null, modeAccepted: false });
    usePrefsStore.getState().resetUserData();
    expect(usePrefsStore.getState().firstCapture).toBeNull();
  });

  it('buluta eşitlenir ve içinde metin alanı yok', () => {
    const store = read('features/modes/store/usePrefsStore.ts');
    const keys = store.slice(store.indexOf('const CLOUD_PREF_KEYS'), store.indexOf('];', store.indexOf('const CLOUD_PREF_KEYS')));
    expect(keys).toContain("'firstCapture'");
    const type = store.slice(store.indexOf('export interface FirstCapture'), store.indexOf('}', store.indexOf('export interface FirstCapture')));
    expect(type).not.toMatch(/text|title|source/i);
  });

  it('yönetim panelinde "İlk dakika" bölümü sunucu alanını okur', () => {
    expect(read('shared/services/api.ts')).toContain('firstMinute');
    expect(read('features/admin/components/AnalyticsCenter.tsx')).toContain('r.firstMinute');
  });
});
