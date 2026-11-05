import fs from 'fs';
import path from 'path';
import { openFirst, tasksOnDay } from '../features/week/weekDay';
import { composeRoute, type RouteGoal, type RouteItem } from '../features/modes/utils/dayRoute';

const TODAY = '2026-11-05';
const read = (f: string) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const task = (id: number, dueDate: string | null, over: object = {}) => ({ id, title: `t${id}`, dueDate, isCompleted: false, tags: [] as string[], ...over });

describe('günün işleri ana ekranla aynı sayılır (ana ekran "11 görev", Hafta "Görev yok" diyordu)', () => {
  const ids = (x: { id: number }[]) => x.map(t => t.id);
  it('bugün: bugünün işi ve bitmemiş geciken; tarihsiz günün hedefine girmez', () => {
    expect(ids(tasksOnDay([task(1, TODAY), task(2, '2026-11-01'), task(3, null), task(4, '2026-11-09')], TODAY, TODAY))).toEqual([1, 2]);
  });
  it('plan işi ayrı tutulmaz', () => {
    expect(ids(tasksOnDay([task(1, TODAY, { tags: ['exam', 'daily'] })], TODAY, TODAY))).toEqual([1]);
  });
  it('bugün biten geciken iş bugünde görünür, geçmiş gün kendi işini gösterir', () => {
    const t = [task(1, '2026-11-04', { isCompleted: true, completedAt: `${TODAY}T10:00:00` }), task(2, '2026-11-04')];
    expect(ids(tasksOnDay(t, TODAY, TODAY)).sort()).toEqual([1, 2]);
    expect(ids(tasksOnDay(t, '2026-11-04', TODAY)).sort()).toEqual([1, 2]);
  });
  it('gelecek gün yalnız kendi işi, gecikenler oraya taşınmaz', () => {
    expect(ids(tasksOnDay([task(1, '2026-11-09'), task(2, '2026-11-01')], '2026-11-09', TODAY))).toEqual([1]);
  });
  it('arşivlenen sayılmaz', () => {
    expect(tasksOnDay([task(2, TODAY, { tags: ['archived'] }), task(3, TODAY, { isArchived: true })], TODAY, TODAY)).toEqual([]);
  });
  it('bitmemiş üstte, kendi içinde sıra sabit', () => {
    expect(ids(openFirst([task(1, TODAY, { isCompleted: true }), task(2, TODAY), task(3, TODAY)]))).toEqual([2, 3, 1]);
  });
});

describe('haftanın önceliği gerçekten etki eder', () => {
  const item = (key: string, slot: string): RouteItem => ({ key, kind: 'task', refId: key, slot, type: 'tez', goal: slot, title: key, minutes: 15, done: false });
  const goal = (slot: string, over: Partial<RouteGoal> = {}): RouteGoal => ({ slot, type: 'tez', goal: slot, daysLeft: 100, lastActive: TODAY, items: [item(`${slot}0`, slot), item(`${slot}1`, slot)], ...over });
  it('seçilen hedef, tarihi daha yakın olanın önüne geçer', () => {
    const goals = [goal('yakin', { daysLeft: 25 }), goal('secilen', { priority: true })];
    const r = composeRoute(goals, 1, TODAY);
    expect(r.keys[0].startsWith('secilen')).toBe(true);
    expect(r.reasons[r.keys[0]]).toBe('priority');
  });
  it('seçilen hedef rotada bir adım fazla alabilir, öteki unutulmaz', () => {
    const goals = [goal('a'), goal('secilen', { priority: true, items: ['0', '1', '2'].map(n => item(`s${n}`, 'secilen')) })];
    const keys = composeRoute(goals, 5, TODAY).keys;
    expect(keys.filter(k => k.startsWith('s'))).toHaveLength(3);
    expect(keys.some(k => k.startsWith('a'))).toBe(true);
  });
  it('sınavı bir haftadan yakın hedefin önüne geçmez: tarih gerçektir', () => {
    const r = composeRoute([goal('sinav', { daysLeft: 3 }), goal('secilen', { priority: true })], 1, TODAY);
    expect(r.keys[0].startsWith('sinav')).toBe(true);
  });
});

describe('Hafta ekranı kararları (kullanıcı: "karmaşa, minimalist değil")', () => {
  const COCKPIT = read('app/cockpit.tsx');
  it('sayfa adı sekmeyle aynı; üst bar simetrik: solda Takvim, sağda özet', () => {
    expect(read('features/week/weekDay.ts')).toContain("title: 'Hafta'");
    expect(COCKPIT).not.toContain("router.push('/gun')");
    expect(COCKPIT).not.toContain('Sunrise');
    const header = COCKPIT.slice(COCKPIT.indexOf('<ScreenHeader'), COCKPIT.indexOf('<View style={{ flex: 1 }}>'));
    expect(header).toContain('left={');
    expect(header).toContain('right={');
    expect(header).toContain("'/takvim'");
    expect(header).toContain("'/report'");
  });
  it('gökyüzü sebebin yaşandığı yerde: Odak sağ üst ve seans sonu; geriye bakış Geri Bakış\'ta; Hafta\'da değil', () => {
    const FOCUS = read('app/focus.tsx');
    expect(COCKPIT).not.toContain('<WeekSky');
    expect(FOCUS).toContain('<WeekSkySheet');
    expect(FOCUS).toContain('setSkyOpen(true)');
    expect(FOCUS).toContain('onOpenSky=');
    expect(read('features/focus/components/SessionSummary.tsx')).toContain('onPress={onOpenSky}');
    expect(read('app/report.tsx')).toContain('<WeekSky');
  });
  it('seans sırasında gökyüzü düğmesi çıkmaz: seans sade kalır', () => {
    expect(read('app/focus.tsx')).toContain('sessionStarted ? <View style={styles.closeBtn} />');
  });
  it('bağlanmayan plan sayfası kalktı, öncelik rotaya bağlı', () => {
    expect(COCKPIT).not.toContain('Gelecek haftayı planla');
    expect(read('features/modes/hooks/useDayRoute.ts')).toContain('priority:');
  });
  it('alışkanlıklar seçili günü izler ve günün işlerinin hemen altında (kullanıcı: "ulaşması zor, havada kalıyor")', () => {
    expect(COCKPIT).toContain('dayKey={selectedDay}');
    expect(COCKPIT).toContain('handleToggleHabit(h.id, selectedDay)');
    expect(COCKPIT.indexOf('<WeekPanel')).toBeLessThan(COCKPIT.indexOf('<WeekHabits'));
    expect(COCKPIT.indexOf('<WeekHabits')).toBeLessThan(COCKPIT.indexOf('<WeekPriority'));
    expect(read('features/week/WeekHabits.tsx')).toContain('disabled={dayKey > todayKey}');
  });
  it('alışkanlık sayacı sütunla aynı paydayı kullanır (sütun tam doluyken "1/4" yazıyordu)', () => {
    expect(COCKPIT).toContain('Math.max(habitsDoneOnDay, selectedDayObj?.habitsExpected ?? 0)');
  });
  it('kişisel ve hedef alışkanlıkları ayrı görünür', () => {
    expect(read('features/week/WeekHabits.tsx')).toContain('fromGoals');
    expect(COCKPIT).toContain('ownLimit={HABIT_LIMIT}');
  });
  it('alışkanlık halkası sıvıyla dolar', () => {
    expect(read('features/habits/components/HabitBubble.tsx')).toContain('<HabitLiquid');
    expect(read('features/week/WeekHabits.tsx')).toContain('<HabitLiquid');
    // Mod satırı gizlenmez: çalışırken gizlendiğinde Android'de ana sayfa boşalıyordu.
    expect(read('features/modes/components/ModeTodayCard.tsx')).not.toContain('hasRoute');
  });
  it('gün listesi plan işlerini de sayar', () => {
    expect(COCKPIT).toContain('tasksOnDay(');
    expect(COCKPIT).not.toContain('personalTasks');
  });
  it('ana sayfa gün ekranına gitmeyi sürdürür', () => {
    expect(read('app/index.tsx')).toContain("pathname: '/gun'");
  });
});
