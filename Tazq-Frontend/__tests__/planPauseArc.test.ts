import { pauseUntilKey, isPausedOn, pauseDaysLeft } from '@/features/modes/utils/planPause';
import { planArcFor } from '@/features/modes/utils/planArc';
import { addGoalRecord, removeGoalRecord, MAX_GOAL_HISTORY, type GoalRecord } from '@/features/modes/utils/goalHistory';

/**
 * Bu üç kural, "hedef kurma aracı"nı "hedefle birlikte yaşayan sayfa"ya çeviren
 * kurallar: ara verebilmek, kat edilen yolu görmek, biten hedefin izini bırakmak.
 */

describe('planı duraklatma', () => {
  it('bugün dahil N gün: 1 gün = yalnız bugün', () => {
    expect(pauseUntilKey(1, '2026-09-20')).toBe('2026-09-20');
    expect(pauseUntilKey(3, '2026-09-20')).toBe('2026-09-22');
    expect(pauseUntilKey(7, '2026-09-20')).toBe('2026-09-26');
  });

  it('ay ve yıl sınırını doğru geçer', () => {
    expect(pauseUntilKey(3, '2026-09-30')).toBe('2026-10-02');
    expect(pauseUntilKey(3, '2026-12-31')).toBe('2027-01-02');
    // Şubat 2028 artık yıl.
    expect(pauseUntilKey(2, '2028-02-28')).toBe('2028-02-29');
  });

  it('sınır günü DAHİL duraklıdır, ertesi gün plan kendiliğinden devam eder', () => {
    expect(isPausedOn('2026-09-22', '2026-09-20')).toBe(true);
    expect(isPausedOn('2026-09-22', '2026-09-22')).toBe(true);
    expect(isPausedOn('2026-09-22', '2026-09-23')).toBe(false);
  });

  it('duraklatma yoksa hiçbir gün duraklı değildir', () => {
    expect(isPausedOn(null, '2026-09-20')).toBe(false);
    expect(isPausedOn(undefined, '2026-09-20')).toBe(false);
    expect(isPausedOn('', '2026-09-20')).toBe(false);
  });

  it('kalan gün bugünü sayar', () => {
    expect(pauseDaysLeft('2026-09-22', '2026-09-20')).toBe(3);
    expect(pauseDaysLeft('2026-09-22', '2026-09-22')).toBe(1);
    expect(pauseDaysLeft('2026-09-22', '2026-09-23')).toBe(0);
    expect(pauseDaysLeft(null, '2026-09-20')).toBe(0);
  });
});

describe('kat edilen yol', () => {
  const base = { startKey: '2026-09-01', targetKey: '2026-09-30', todayKey: '2026-09-25' };

  it('geçen gün, toplam gün ve yüzde', () => {
    const arc = planArcFor({ ...base, habitCompletions: [] })!;
    expect(arc.elapsedDays).toBe(25);
    expect(arc.totalDays).toBe(30);
    expect(arc.pct).toBe(83);
  });

  it('emek ölçüsü: kaç AYRI günde çalışıldı (aynı gün iki alışkanlık = 1 gün)', () => {
    const arc = planArcFor({
      ...base,
      habitCompletions: [
        ['2026-09-02', '2026-09-03', '2026-09-04'],
        ['2026-09-03', '2026-09-10'],
      ],
    })!;
    expect(arc.effortDays).toBe(4);
  });

  it('plan aralığı DIŞINDAKİ tamamlamalar sayılmaz', () => {
    // Aynı alışkanlık önceki bir plandan kalmış olabilir.
    const arc = planArcFor({
      ...base,
      habitCompletions: [['2026-08-15', '2026-09-05', '2026-09-28']],
    })!;
    expect(arc.effortDays).toBe(1);
  });

  it('emek geçen günü AŞAMAZ', () => {
    const arc = planArcFor({
      startKey: '2026-09-20', targetKey: null, todayKey: '2026-09-21',
      habitCompletions: [['2026-09-20', '2026-09-21']],
    })!;
    expect(arc.elapsedDays).toBe(2);
    expect(arc.effortDays).toBe(2);
  });

  it('süresiz hedefte yüzde yoktur ama geçen gün vardır', () => {
    const arc = planArcFor({ startKey: '2026-09-01', targetKey: null, todayKey: '2026-09-10', habitCompletions: [] })!;
    expect(arc.totalDays).toBeNull();
    expect(arc.pct).toBeNull();
    expect(arc.elapsedDays).toBe(10);
  });

  it('başlangıcı bilinmeyen ESKİ planda uydurma sayı üretilmez', () => {
    expect(planArcFor({ startKey: null, targetKey: '2026-09-30', todayKey: '2026-09-25', habitCompletions: [] })).toBeNull();
  });

  it('başlangıç gelecekteyse (saat kayması) sessizce çıkar', () => {
    expect(planArcFor({ startKey: '2026-09-26', targetKey: null, todayKey: '2026-09-25', habitCompletions: [] })).toBeNull();
  });

  it('hedef tarihi geçmişse yüzde 100’de durur, taşmaz', () => {
    const arc = planArcFor({ startKey: '2026-09-01', targetKey: '2026-09-10', todayKey: '2026-09-25', habitCompletions: [] })!;
    expect(arc.pct).toBe(100);
  });
});

describe('geçmiş hedefler', () => {
  const rec = (id: string): GoalRecord => ({
    id, mode: 'exam', name: 'ALES', emoji: '🎯',
    startKey: '2026-06-01', closedKey: '2026-09-01', targetKey: '2026-08-30',
    days: 92, effortDays: 70,
  });

  it('en yeni başta durur', () => {
    const list = addGoalRecord(addGoalRecord([], rec('a')), rec('b'));
    expect(list.map(r => r.id)).toEqual(['b', 'a']);
  });

  it('aynı kayıt iki kez yazılmaz', () => {
    const list = addGoalRecord(addGoalRecord([], rec('a')), rec('a'));
    expect(list).toHaveLength(1);
  });

  it('liste sınırı aşılmaz (bulut tercihleri şişmesin)', () => {
    let list: GoalRecord[] = [];
    for (let i = 0; i < MAX_GOAL_HISTORY + 5; i++) list = addGoalRecord(list, rec('g' + i));
    expect(list).toHaveLength(MAX_GOAL_HISTORY);
    expect(list[0].id).toBe('g' + (MAX_GOAL_HISTORY + 4));
  });

  it('kapatmayı geri alan kullanıcı kaydı geçmişte de görmez', () => {
    const list = addGoalRecord(addGoalRecord([], rec('a')), rec('b'));
    expect(removeGoalRecord(list, 'b').map(r => r.id)).toEqual(['a']);
  });
});

/**
 * "1 gün bile ilerletmediğim hedef 'Tamamlandı' yazıyor" — kullanıcı raporu.
 *
 * `days == null` yalnız "ne kadar sürdüğünü BİLMİYORUZ" demek (başlangıç damgalanmamış),
 * "başarıyla bitirdi" demek değil. İkisi aynı cümleye sıkıştırılmıştı.
 */
describe('geçmiş hedef metni süreyi bilmemekle tamamlanmayı KARIŞTIRMAZ', () => {
  const fs = require('fs');
  const path = require('path');
  const MODLAR = fs.readFileSync(path.resolve(__dirname, '../app/modlar.tsx'), 'utf8');

  it('süre bilinmiyorsa "Tamamlandı" değil "Kapatıldı" yazar', () => {
    const trBlock = MODLAR.slice(MODLAR.indexOf('const HISTORY_COPY'), MODLAR.indexOf('en: {', MODLAR.indexOf('const HISTORY_COPY')));
    expect(trBlock).toContain("'Kapatıldı'");
    expect(trBlock).not.toContain("days == null ? 'Tamamlandı'");
  });

  it("Bırakma kendi başlangıcını useQuitStore'dan okur (planSpecs'e hiç yazmaz)", () => {
    const UNDO = fs.readFileSync(path.resolve(__dirname, '../features/modes/utils/modeUndo.ts'), 'utf8');
    expect(UNDO).toContain("mode === 'birakma'");
    expect(UNDO).toContain('useQuitStore.getState().items.map(i => i.start)');
  });
});
