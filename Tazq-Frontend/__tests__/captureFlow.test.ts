import { capture } from '@/features/tasks/nlp/capture';
import { toDrafts, toggleKind, applyCapture, modePatch, shouldOfferCapture } from '@/features/onboarding/utils/captureFlow';
import { useTaskStore } from '@/features/tasks/store/useTaskStore';
import { useHabitStore } from '@/features/habits/store/useHabitStore';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { useNetworkStore } from '@/shared/store/useNetworkStore';
import { useOfflineQueue } from '@/shared/store/useOfflineQueue';

/**
 * "AKLINDAKİLERİ YAZ" AKIŞI (C2–C5, 2026-10-31) — ekranın arkasındaki saf karar ve tek kayıt yolu.
 *
 * Ekran hoş geldinden SONRA, turdan ÖNCE açılır (tanıtım slaytları girişten önce çalışıyor; orada
 * yazılan görevin yazılacağı hesap henüz yok). Yalnız yeni hesaplara, bir kez.
 */
const NOW = new Date(2026, 9, 31, 10, 0);

describe('taslaklar', () => {
  it('yakalama çıktısı düzenlenebilir taslağa döner; kanıt korunur', () => {
    const d = toDrafts(capture('yarın sunumu bitir, her sabah koşu', 'tr', NOW));
    expect(d.map(x => [x.kind, x.title])).toEqual([['task', 'Sunumu bitir'], ['habit', 'Koşu']]);
    expect(d[0].dueDate).toBe('2026-11-01');
    expect(d[1].evidence).toContain('her sabah');
    expect(new Set(d.map(x => x.id)).size).toBe(2);
  });

  it('görev → alışkanlık: günlük plan ve simge kazanır, tarih düşer; geri dönüşte plan düşer', () => {
    const [t] = toDrafts(capture('yarın kitap oku', 'tr', NOW));
    const h = toggleKind(t, 'tr');
    expect(h).toMatchObject({ kind: 'habit', schedule: { kind: 'daily' }, emoji: '📚' });
    expect(h.dueDate).toBeUndefined();
    expect(toggleKind(h, 'tr')).toMatchObject({ kind: 'task' });
    expect(toggleKind(h, 'tr').schedule).toBeUndefined();
  });
});

describe('mod önerisi', () => {
  it('kabul edilen mod açılır, tarih yazılır (yalnız tarih alanı olan modlarda)', () => {
    expect(modePatch({ mode: 'exam', date: '2026-12-12', evidence: 'sınavım' })).toEqual({ examMode: true, examDate: '2026-12-12' });
    expect(modePatch({ mode: 'birakma', evidence: 'sigara' })).toEqual({ birakmaMode: true });
    expect(modePatch({ mode: 'tez', evidence: 'tez' })).toEqual({ tezMode: true });
  });
});

describe('kimlere gösterilir', () => {
  it('yalnız yeni hesap, hoş geldin bittikten sonra ve henüz sonuç yokken', () => {
    expect(shouldOfferCapture({ capturePending: true, welcomeStatus: 'done', firstCapture: null })).toBe(true);
    expect(shouldOfferCapture({ capturePending: true, welcomeStatus: 'pending', firstCapture: null })).toBe(false);
    expect(shouldOfferCapture({ capturePending: false, welcomeStatus: 'done', firstCapture: null })).toBe(false);
    expect(shouldOfferCapture({ capturePending: true, welcomeStatus: 'done', firstCapture: { result: 'skipped', items: 0, habits: 0, modeSuggested: null, modeAccepted: false, at: 'x' } })).toBe(false);
  });
});

describe('kayıt — tek yol', () => {
  beforeEach(() => {
    useNetworkStore.setState({ isOnline: false } as never);
    useTaskStore.setState({ tasks: [] } as never);
    useHabitStore.setState({ habits: [] } as never);
    usePrefsStore.getState().resetUserData();
    useOfflineQueue.setState({ ops: [] } as never);
  });

  it('çevrimdışı/misafir: görevler kuyruğa ve yerel listeye, alışkanlıklar mağazaya; ölçüm sayı olarak', async () => {
    const drafts = toDrafts(capture('yarın sunumu bitir, her sabah koşu, sınavım 12 aralıkta', 'tr', NOW));
    const res = await applyCapture({ drafts, lang: 'tr', mode: { mode: 'exam', date: '2026-12-12', evidence: 'sınavım' }, acceptMode: true });
    expect(res).toEqual({ tasks: 1, habits: 1 });
    expect(useTaskStore.getState().tasks.map(t => t.title)).toEqual(['Sunumu bitir']);
    expect(useOfflineQueue.getState().ops).toHaveLength(1);
    expect(useHabitStore.getState().habits.map(h => h.name)).toEqual(['Koşu']);
    expect(usePrefsStore.getState().seasonal.examMode).toBe(true);
    expect(usePrefsStore.getState().seasonal.examDate).toBe('2026-12-12');
    expect(usePrefsStore.getState().firstCapture).toMatchObject({ result: 'wrote', items: 2, habits: 1, modeSuggested: 'exam', modeAccepted: true });
    expect(usePrefsStore.getState().capturePending).toBe(false);
  });

  it('alışkanlık sınırı aşılmaz: sığmayan madde GÖREV olarak eklenir, kaybolmaz', async () => {
    useHabitStore.setState({ habits: Array.from({ length: 7 }, (_, i) => ({ id: `h${i}`, name: `h${i}`, emoji: '✨', color: '#000', completedDates: [], createdAt: '' })) } as never);
    const drafts = toDrafts(capture('her gün su iç', 'tr', NOW));
    const res = await applyCapture({ drafts, lang: 'tr', acceptMode: false });
    expect(res).toEqual({ tasks: 1, habits: 0 });
    expect(useTaskStore.getState().tasks.map(t => t.title)).toEqual(['Su iç']);
  });

  it('atla: hiçbir şey eklenmez, ölçüm "skipped"', async () => {
    const res = await applyCapture({ drafts: [], lang: 'tr', acceptMode: false, skipped: true });
    expect(res).toEqual({ tasks: 0, habits: 0 });
    expect(usePrefsStore.getState().firstCapture).toMatchObject({ result: 'skipped', items: 0 });
    expect(usePrefsStore.getState().capturePending).toBe(false);
  });
});

/**
 * SIRA: hoş geldin → Aklındakileri yaz → varış → tur (C5). Tur, ekran açıkken ve varış animasyonu
 * sürerken bekler (%0 kayma kuralı: tur açıkken giriş animasyonu kapalı). Bildirim izni turdan sonra.
 */
describe('ana sayfada sıra (C5)', () => {
  const fs = require('fs');
  const path = require('path');
  const INDEX = fs.readFileSync(path.join(__dirname, '..', 'app/index.tsx'), 'utf8');

  it('ilk girişte bayrak kurulur, ekran hoş geldinden sonra açılır', () => {
    expect(INDEX).toMatch(/setWelcomeStatus\('pending'\);\s*\n\s*usePrefsStore\.getState\(\)\.setCapturePending\(true\);/);
    expect(INDEX).toContain('shouldOfferCapture({ capturePending, welcomeStatus, firstCapture }) && !profileSetupVisible');
    expect(INDEX).toContain('<CaptureSheet visible={captureOn} onDone={onCaptureDone} />');
  });

  it('tur, yazma ekranını ve varışı bekler', () => {
    expect(INDEX).toContain("useTourGate('dashboard', profileSetupVisible || welcomeStatus === 'pending' || captureOn || arriving)");
  });

  it('madde eklendiyse panel bir kez uyanır (varış), sonra tur', () => {
    const at = INDEX.indexOf('const onCaptureDone');
    const fn = INDEX.slice(at, INDEX.indexOf('});', at));
    expect(fn).toContain('wake()');
    expect(fn).toContain('setArriving(true)');
  });
});

describe('sınırlar — tür değişimi', () => {
  it('görev alışkanlığa dönünce ad 40 karaktere kısalır', () => {
    const [t] = toDrafts(capture('proje raporunun bütün bölümlerini gözden geçir ve tamamla', 'tr', NOW));
    expect(toggleKind(t, 'tr').title.length).toBeLessThanOrEqual(40);
  });
});
