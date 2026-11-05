import fs from 'fs';
import path from 'path';
import { composeRoute, minutesOf, orderStops, postponedTags, postponeOptions, routeCapacity, weekRoutes, withLog, type RouteGoal, type RouteItem } from '../features/modes/utils/dayRoute';
import { dayKeyOf, dayNum } from '../features/studyplan/utils/scheduler';

const TODAY = '2026-11-05'; // perşembe
const item = (key: string, slot: string, over: Partial<RouteItem> = {}): RouteItem => ({ key, kind: 'task', refId: key, slot, type: 'tez', goal: slot, title: key, minutes: 15, done: false, ...over });
const goal = (slot: string, n: number, over: Partial<RouteGoal> = {}): RouteGoal => ({ slot, type: 'tez', goal: slot, daysLeft: 100, lastActive: TODAY, items: Array.from({ length: n }, (_, i) => item(`${slot}${i}`, slot)), ...over });

describe('kapasite: gerçek davranıştan', () => {
  const past = (done: number[], planned = 5) => done.map((d, i) => ({ day: dayKeyOf(dayNum(TODAY) - done.length + i), planned, done: d }));
  it('veri yoksa küçük başlar', () => {
    expect(routeCapacity([], TODAY)).toBe(4);
  });
  it('çok yapan için büyür, az yapan için küçülür', () => {
    expect(routeCapacity(past([6, 6, 6, 5, 6], 6), TODAY)).toBeGreaterThanOrEqual(6);
    expect(routeCapacity(past([1, 2, 1, 2, 1]), TODAY)).toBe(3);
  });
  it('son üç rota bitince bir adım büyür, sınırı geçmez', () => {
    expect(routeCapacity(past([4, 4, 4], 4), TODAY)).toBe(5);
    expect(routeCapacity(past([9, 9, 9], 9), TODAY)).toBe(8);
  });
  it('zor gün, oruç ve bayram küçültür', () => {
    expect(routeCapacity(past([6, 6, 6], 7), TODAY, { lightDay: true })).toBe(5);
    expect(routeCapacity(past([6, 6, 6], 7), TODAY, { fasting: true })).toBe(4);
    expect(routeCapacity(past([6, 6, 6], 7), TODAY, { eid: true })).toBe(2);
  });
  it('bugün ve iki haftadan eski kayıt sayılmaz', () => {
    expect(routeCapacity([{ day: TODAY, planned: 8, done: 8 }, { day: '2026-01-01', planned: 8, done: 8 }], TODAY)).toBe(4);
  });
});

describe('seçim: adil ve gerekçeli', () => {
  it('20 iş varken bile kapasiteyi aşmaz, her hedef önce birer adım alır', () => {
    const goals = ['a', 'b', 'c', 'd'].map(s => goal(s, 5));
    const r = composeRoute(goals, 5, TODAY);
    expect(r.keys).toHaveLength(5);
    for (const s of ['a', 'b', 'c', 'd']) expect(r.keys.some(k => k.startsWith(s))).toBe(true);
  });
  it('hedef kapasiteden çoksa dışarıda kalan dinlenir', () => {
    const r = composeRoute(['a', 'b', 'c', 'd', 'e', 'f'].map(s => goal(s, 3)), 4, TODAY);
    expect(r.keys).toHaveLength(4);
    expect(r.resting).toHaveLength(2);
  });
  it('sınavı yakın olan öne geçer', () => {
    const r = composeRoute([goal('uzak', 1, { daysLeft: 200 }), goal('yakin', 1, { daysLeft: 5 })], 1, TODAY);
    expect(r.keys).toEqual(['yakin0']);
    expect(r.reasons.yakin0).toBe('soon');
  });
  it('kırılacak seri korunur', () => {
    const g = goal('a', 0, { items: [item('t', 'a'), item('h', 'a', { kind: 'habit', streak: 5 })] });
    const r = composeRoute([g], 1, TODAY);
    expect(r.keys).toEqual(['h']);
    expect(r.reasons.h).toBe('streak');
  });
  it('sevdiği iş öne, istemediği geriye', () => {
    const g = goal('a', 0, { items: [item('sev', 'a', { liking: 0.9 }), item('sevme', 'a', { liking: 0.1 })] });
    expect(composeRoute([g], 1, TODAY).keys).toEqual(['sev']);
  });
  it('yapılmış iş rotanın parçası, kapasiteyi yer', () => {
    const g = goal('a', 0, { items: [item('b1', 'a', { done: true }), item('b2', 'a', { done: true }), item('c', 'a')] });
    expect(composeRoute([g], 2, TODAY).keys).toEqual(['b1', 'b2']);
  });
  it('tek hedef rotayı doldurmaz: hedef başına sınır var, yakın sınavda bir fazla', () => {
    expect(composeRoute([goal('a', 9)], 8, TODAY).keys).toHaveLength(2);
    expect(composeRoute([goal('a', 9, { daysLeft: 5 })], 8, TODAY).keys).toHaveLength(3);
  });
  it('hiçbir hedef unutulmaz: 6 hedef, kapasite 3, en geç birkaç günde herkes sıra alır', () => {
    const slots = ['a', 'b', 'c', 'd', 'e', 'f'];
    const last: Record<string, string> = Object.fromEntries(slots.map(s => [s, TODAY]));
    let maxGap = 0;
    for (let d = 1; d <= 30; d++) {
      const day = dayKeyOf(dayNum(TODAY) + d);
      const r = composeRoute(slots.map(s => goal(s, 2, { lastActive: last[s], daysLeft: s === 'a' ? 10 : 100 })), 3, day);
      for (const s of slots) {
        if (r.keys.some(k => k.startsWith(s))) { maxGap = Math.max(maxGap, dayNum(day) - dayNum(last[s])); last[s] = day; }
      }
    }
    expect(maxGap).toBeLessThanOrEqual(4);
  });
});

describe('sıra', () => {
  it('önce kısa kazanım, biten işler başta', () => {
    const a = item('uzun', 'a', { minutes: 50 });
    const b = item('kisa', 'a', { minutes: 5 });
    const d = item('bitti', 'a', { done: true });
    expect(orderStops([a, b, d], ['uzun', 'kisa', 'bitti']).map(x => x.key)).toEqual(['bitti', 'kisa', 'uzun']);
  });
  it('oruçta günün vaktine göre', () => {
    const a = item('iftar', 'a');
    const b = item('sahur', 'a');
    expect(orderStops([a, b], ['iftar', 'sahur'], i => (i.key === 'sahur' ? 0 : 2)).map(x => x.key)).toEqual(['sahur', 'iftar']);
  });
  it('gün boyu iş yolu kesmez, sona düşer', () => {
    const su = item('su', 'a', { nature: 'allDay', minutes: 0 });
    const oku = item('oku', 'a', { nature: 'deep', minutes: 30 });
    expect(orderStops([su, oku], ['su', 'oku']).map(x => x.key)).toEqual(['oku', 'su']);
  });
  it('süre başlıktan okunur', () => {
    expect(minutesOf('task', '20 dakika tempolu yürü')).toBe(20);
    expect(minutesOf('task', 'Bugün 30+ dk hareket et')).toBe(30);
    expect(minutesOf('task', 'Follow a 10-minute video')).toBe(10);
    expect(minutesOf('task', 'DGS · Paragraf çalış · 35 dk')).toBe(35);
    expect(minutesOf('task', 'Write · 20 min')).toBe(20);
    expect(minutesOf('task', 'Yürü')).toBe(15);
    expect(minutesOf('habit', '')).toBe(5);
  });
});

describe('geçmiş', () => {
  it('hafta sayımı yalnız biten rotaları sayar', () => {
    let h = withLog([], '2026-11-03', 4, 4);
    h = withLog(h, '2026-11-04', 4, 2);
    h = withLog(h, TODAY, 4, 4);
    expect(weekRoutes(h, TODAY)).toBe(2);
  });
  it('aynı gün üzerine yazılır, 30 günden eski düşer', () => {
    let h = withLog([{ day: '2026-01-01', planned: 1, done: 1 }], TODAY, 4, 1);
    h = withLog(h, TODAY, 4, 3);
    expect(h).toEqual([{ day: TODAY, planned: 4, done: 3 }]);
  });
});

describe('ertele', () => {
  it('seçenekler gerçek gün, aynı gün tekrar etmez', () => {
    const o = postponeOptions(TODAY, null);
    expect(o.map(x => x.key)).toEqual(['tomorrow', 'twoDays', 'nextWeek']); // 2 gün sonrası zaten cumartesi
    expect(o[0].date).toBe('2026-11-06');
    expect(o[1].date).toBe('2026-11-07');
    expect(o[2].date).toBe('2026-11-09');
  });
  it('hafta başında hafta sonu ayrı seçenek', () => {
    expect(postponeOptions('2026-11-02', null).map(x => x.key)).toEqual(['tomorrow', 'twoDays', 'weekend', 'nextWeek']);
  });
  it('hedef tarihini aşan seçenek sunulmaz', () => {
    expect(postponeOptions(TODAY, '2026-11-06').map(x => x.key)).toEqual(['tomorrow']);
    expect(postponeOptions(TODAY, TODAY)).toEqual([]);
  });
  it('ertelenen günlük iş artık günlük üretim sayılmaz', () => {
    expect(postponedTags(['spor', 'daily', 'fitness'])).toEqual(['spor', 'fitness', 'postponed']);
    expect(postponedTags(null)).toEqual(['postponed']);
  });
});

describe('bağlantılar', () => {
  const read = (f: string) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  it('Hedefler özeti ve ana ekran rotaya götürür', () => {
    expect(read('features/modes/components/GoalRows.tsx')).toContain('openRoute');
    expect(read('features/modes/components/RouteBanner.tsx')).toContain("'/rota'");
    expect(read('features/modes/components/ModeTodayCard.tsx')).toContain('<RouteBanner');
  });
  it('Planım görev menüsünde gerçek ertele var, geri alınabilir', () => {
    expect(read('features/modes/components/plan/PlanToday.tsx')).toContain('PostponePicker');
    expect(read('features/modes/utils/planManage.ts')).toContain('export function postponePlanTask');
    expect(read('features/modes/utils/planManage.ts')).toContain('export function undoPostpone');
  });
  it('bütçe ekranlarında sabit ₺ kalmadı', () => {
    for (const f of ['features/modes/components/plan/track/SavingsTrack.tsx', 'features/modes/components/plan/PlanMeasure.tsx', 'features/modes/components/modes/TasarrufCard.tsx']) {
      expect(read(f)).not.toContain('₺');
    }
  });
});
