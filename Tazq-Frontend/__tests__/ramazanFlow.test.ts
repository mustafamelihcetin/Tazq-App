import fs from 'fs';
import path from 'path';
import { getCurrentRamadanStatus } from '../shared/utils/ramadanDates';
import { activeRamadanPreview, previewPeriod, ramadanRangesNow, ramadanStatusNow, previewStartForDay } from '../features/modes/utils/ramadanPreview';
import { usePrefsStore } from '../features/modes/store/usePrefsStore';
import { useAuthStore } from '../features/user/store/useAuthStore';
import { buildDailyTasks } from '../features/modes/utils/dailyPlanEngine';
import { buildRamazanAdaptationTasks } from '../features/modes/utils/planAdaptations';
import { goalStateOf } from '../features/modes/utils/goalRows';

const read = (f: string) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const setRole = (role?: string) => useAuthStore.setState({ user: role ? { role } as never : null } as never);
const setSeasonal = (patch: Record<string, unknown>) => usePrefsStore.setState(s => ({ seasonal: { ...s.seasonal, ...patch } }));

describe('gerçek takvim (Diyanet 2027)', () => {
  afterEach(() => jest.useRealTimers());
  const at = (y: number, m: number, d: number) => { jest.useFakeTimers(); jest.setSystemTime(new Date(y, m - 1, d, 12)); return getCurrentRamadanStatus(); };

  it('bugün (Kasım 2026): başlamadı, sıradaki dönem 2027', () => {
    const st = at(2026, 11, 5);
    expect(st.isActive).toBe(false);
    expect(st.period?.start).toBe('2027-02-08');
  });
  it('arefe günü başlamadı, ilk oruç günü başladı', () => {
    expect(at(2027, 2, 7).isActive).toBe(false);
    expect(at(2027, 2, 8).isActive).toBe(true);
  });
  it('arife son gün, bayramın ilk günü bitmiş', () => {
    expect(at(2027, 3, 8).isActive).toBe(true);
    expect(at(2027, 3, 9).isActive).toBe(false);
  });
});

describe('yönetici önizlemesi', () => {
  afterEach(() => { setSeasonal({ ramazan: false, ramazanPreviewStart: null }); setRole(); });
  const on = () => setSeasonal({ ramazan: true, ramazanPreviewStart: previewStartForDay(1) });

  it('yönetici için dönem başlar', () => {
    setRole('Admin');
    on();
    expect(activeRamadanPreview()).not.toBeNull();
    const st = ramadanStatusNow();
    expect(st.isActive).toBe(true);
    expect(st.daysRemaining).toBe(29);
    expect(ramadanRangesNow()[0].start).toBe(previewStartForDay(1));
  });
  it.each(['User', 'Support', 'Analyst', 'Moderator', undefined])('%s bayrak taşısa bile çalışmaz', (role) => {
    setRole(role);
    on();
    expect(activeRamadanPreview()).toBeNull();
    expect(ramadanStatusNow().period?.start).toBe(getCurrentRamadanStatus().period?.start);
  });
  it('mod kapanınca önizleme de biter', () => {
    setRole('Admin');
    setSeasonal({ ramazan: false, ramazanPreviewStart: previewStartForDay(1) });
    expect(activeRamadanPreview()).toBeNull();
  });
  it('gün seçimi: 25. günde 5 gün kalır, son günde 0', () => {
    setRole('Admin');
    setSeasonal({ ramazan: true, ramazanPreviewStart: previewStartForDay(25) });
    expect(ramadanStatusNow().daysRemaining).toBe(5);
    setSeasonal({ ramazanPreviewStart: previewStartForDay(30) });
    expect(ramadanStatusNow().daysRemaining).toBe(0);
    expect(ramadanStatusNow().isActive).toBe(true);
  });
  it('süresi dolan önizleme etkin dönem saymaz', () => {
    setRole('Admin');
    setSeasonal({ ramazan: true, ramazanPreviewStart: previewStartForDay(40) });
    expect(ramadanStatusNow().isActive).toBe(false);
    expect(previewPeriod('2027-01-01').end).toBe('2027-01-30');
  });
  it('keşfet satırı ve kart yalnız yetkiyle çizilir, önizleme belli olur', () => {
    const screen = read('app/modlar.tsx');
    expect(screen).toContain("canPreviewRamadan(myRole)");
    const card = read('features/modes/components/modes/RamazanCard.tsx');
    expect(card).toContain('isRamadanPreview()');
    expect(card).toContain('g.previewBadge');
  });
});

describe('Ramazan görevleri', () => {
  const spec = { kind: 'ramazan' as const, slot: 'ramazan', isRamazan: true, dailyMinutes: 40 };
  it('30 günün her birinde görev çıkar, yer tutucu kalmaz, iki dilli', () => {
    for (let d = 0; d < 30; d++) {
      const today = new Date(2027, 1, 8 + d, 12);
      const tr = buildDailyTasks({ ...spec, daysLeft: 29 - d }, [], 'tr', today) as unknown as { titleTr: string; titleEn: string; tags: string[] }[];
      expect(tr.length).toBeGreaterThan(0);
      for (const t of tr) {
        expect(t.titleTr).not.toContain('{name}');
        expect(t.titleEn.length).toBeGreaterThan(3);
        expect(t.tags).toContain('ramazan');
      }
    }
  });
  it('dönem bitince görev üretmez', () => {
    expect(buildDailyTasks({ ...spec, daysLeft: -1 }, [], 'tr', new Date(2027, 2, 9, 12))).toEqual([]);
  });
  it('Kadir Gecesi hatırlatması gece geçmeden gelir, geçtikten sonra gelmez', () => {
    const titles = (d: number) => buildRamazanAdaptationTasks(d, [], 'tr').length;
    expect(titles(15)).toBe(0);
    expect(titles(10)).toBe(1);
    expect(titles(4)).toBe(1);
    // 2027: Kadir 5 Mart, son gün 8 Mart: 3 gün kala gece geçmiş olur.
    expect(titles(2)).toBe(0);
  });
  it('başlamadan kurulan plan boş görünmez, ne zaman başlayacağını söyler', () => {
    expect(goalStateOf({ paused: false, restToday: false, daysLeft: 95, done: 0, total: 0, notStarted: true })).toBe('notStarted');
    expect(goalStateOf({ paused: true, restToday: false, daysLeft: 95, done: 0, total: 0, notStarted: true })).toBe('paused');
  });
});

describe('bulunan hatalar geri gelmesin', () => {
  it('görev rozetinde sabit 2026 tarihi yok', () => {
    expect(read('features/modes/utils/modeHelpers.ts')).not.toContain("start: '2026-02-17'");
  });
  it('otomatik kapanış yerel gün okur; UTC bir gün erken kapatıyordu', () => {
    const src = read('features/modes/hooks/usePlanAdaptations.ts');
    expect(src).not.toContain('new Date(r.start)');
    expect(src).not.toContain('new Date(r.end)');
  });
  it('plan kurulduysa kart "şimdiden hazırla" demez', () => {
    expect(read('features/modes/components/modes/RamazanCard.tsx')).toContain('!ramadanStatus.isActive && ramadanStatus.period && !hasPlan');
  });
});
