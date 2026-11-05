import fs from 'fs';
import path from 'path';
import { kiloCheck, moneyCheck, monthlyNeed } from '@/features/modes/utils/setupRules';

/*
  Kullanıcı: "kpss için mod açtım, tarih seçtim, direkt başladı; ne konu sordu ne seviye sordu ne planıma yönlendirdi ne tarif var; bu mod belki sadece görünendi, hepsine bak, hepsi için kurguyu kendi mantığına göre kur".
*/
const read = (f: string) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const SHELL = read('features/modes/components/setup/SetupShell.tsx');
const WORK = read('features/modes/components/setup/ExamWorkSetups.tsx');
const LIFE = read('features/modes/components/setup/LifeSetups.tsx');
const HUB = read('app/modlar.tsx');
const START = read('features/modes/components/setup/startFromSetup.ts');

describe('her hedefin kendi kurulumu', () => {
  it('sınav: konu listesi varsa seviye sorulur, yoksa adım atlanır ve söylenir', () => {
    expect(WORK).toContain("...(bp ? [{\n      key: 'level'");
    expect(WORK).toContain('bp ? c.how : c.howCustom');
  });
  it('tez ve mülakat: ad, tarih, zorlandığın yer', () => {
    for (const k of ["key: 'name'", "key: 'date'", "key: 'area'"]) expect(WORK).toContain(k);
    expect(WORK).toContain('TEZ_AREAS');
    expect(WORK).toContain('INTERVIEW_AREAS');
  });
  it('spor: türe göre bilgi; kiloda tarih sorulmaz', () => {
    for (const k of ["key: 'kilo'", "key: 'run'", "key: 'days'"]) expect(LIFE).toContain(k);
    expect(LIFE).toContain("if (!isKilo) rows.push({ key: 'date'");
  });
  it('birikim: tutar türe göre, süre ayda ne gerektiğini gösterir', () => {
    expect(LIFE).toContain("type === 'borc' ? <><Question title={c.debtQ}");
    expect(LIFE).toContain('c.need(fmt(monthlyNeed(');
  });
  it('bırakma: tarih sorulmaz, en zor an sorulur', () => {
    expect(LIFE).toContain("key: 'when'");
  });
  it('hepsi tek kapıdan: Keşfet ve "ekle" satırları kuruluma gider', () => {
    for (const k of ['exam', 'spor', 'tez', 'mulakat', 'tasarruf', 'birakma']) expect(HUB).toContain(`useGoalSetupStore.getState().open('${k}', '${k}')`);
    expect(HUB).not.toContain("setSeasonalPref('examMode', true); focusCard('exam')");
    expect(read('features/modes/components/GoalRows.tsx')).toContain('useGoalSetupStore.getState().open(r.key, r.slot as string)');
  });
});

describe('kabuk', () => {
  it('cevaplanmadan ilerlenmez, son adım sahne, sonra Planım', () => {
    expect(SHELL).toContain('disabled={!cur.valid}');
    expect(SHELL).toContain('<LaunchScene');
    expect(SHELL).toContain('reduce ? SCENE_MS_REDUCED : SCENE_MS');
    expect(HUB).toContain('finishSetup(done)');
    expect(START).toContain('openPlan(done.slot)');
    expect(START).toContain("openPlan('tasarruf')");
    expect(START).toContain("openPlan('birakma')");
  });
  it('vazgeçene kayıt yok: kurulum dosyaları ayar yazmaz', () => {
    expect(SHELL + WORK + LIFE).not.toContain('setSeasonalPref');
    expect(WORK).not.toContain('planSpecs');
  });
  it('seviye plan kurulunca uygulanır', () => {
    expect(START).toContain('store.setLevel(planKeyFor(r.name), subject, level, today)');
  });
  it("Android'de vazgeçilen takvim tarih yazmaz", () => {
    expect(read('features/modes/components/modes/ExamDatePicker.tsx')).toContain("if (Platform.OS === 'ios') onPick(toDateKey(value))");
  });
  it('konu haritasında özet ve dolan halka', () => {
    const topics = read('features/studyplan/components/StudyTopics.tsx');
    expect(topics).toContain('<HabitLiquid');
    expect(topics).toContain('topicsHero');
  });
});

describe('kilo kuralları', () => {
  it('kilo uydurulmaz: boşsa geçmez', () => { expect(kiloCheck('', '70', '').problem).toBe('empty'); expect(kiloCheck('80', '', '').ok).toBe(false); });
  it('aralık, fark, aynı kilo', () => {
    expect(kiloCheck('20', '70', '').problem).toBe('range');
    expect(kiloCheck('250', '120', '').problem).toBe('far');
    expect(kiloCheck('70', '70', '').problem).toBe('same');
  });
  it('sağlıksız hedefe izin vermez', () => {
    const r = kiloCheck('60', '45', '175');
    expect(r.problem).toBe('low');
    expect(r.minKg).toBeCloseTo(56.7, 0);
  });
  it('tempo: verme 0,5, alma 0,25', () => {
    expect(kiloCheck('80', '75', '').weeks).toBe(10);
    expect(kiloCheck('60', '65', '').weeks).toBe(20);
  });
});

describe('para kuralları', () => {
  it('birikim hedefi mevcuttan büyük olmalı', () => { expect(moneyCheck('birikim', 100, 50, 0, 6).ok).toBe(false); expect(moneyCheck('birikim', 100, 500, 0, 6).ok).toBe(true); });
  it('borç sıfıra iner', () => { expect(moneyCheck('borc', 1000, 0, 0, 6)).toEqual({ ok: true, start: 1000, target: 0 }); });
  it('acil fon aylık gider × ay', () => { expect(moneyCheck('acilfon', 0, 0, 10000, 6).target).toBe(60000); expect(moneyCheck('acilfon', 70000, 0, 10000, 6).ok).toBe(false); });
  it('ayda gereken yukarı yuvarlanır', () => { expect(monthlyNeed(0, 1000, 3)).toBe(334); expect(monthlyNeed(1000, 0, 4)).toBe(250); });
});
