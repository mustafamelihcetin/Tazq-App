/**
 * UYKU SINIFLANDIRICISI — "yeterince uyudun" yapılmamış işi yapılmış saymaz.
 *
 * ÖLÇÜLEN SORUN: eski kural üç ölçütten HERHANGİ BİRİ tutunca uyku diyordu
 * (healthMetric | emoji === '😴' | adlarda "uyku"/"sleep"). Spor planının toparlanma
 * alışkanlığı ikisine birden takılıyordu:
 *     { name: 'Dinlenme', nameTr: 'Toparlanma: uyku + aktif dinlenme', emoji: '😴' }
 * Kullanıcı yalnızca uyuduğu için "aktif dinlenme" otomatik işaretleniyor, seri ve
 * momentum olmamış bir işi olmuş gösteriyordu.
 *
 * Aynı gevşek kural KAYIT anında da çalışıp `healthMetric: 'sleep'` damgasını kalıcı
 * depoya yazdığı için, yalnız okumayı düzeltmek mevcut kullanıcıları kurtarmıyordu.
 */
import fs from 'fs';
import path from 'path';
import { isSleepHabit, inferSleepFromNames } from '@/features/habits/utils/sleepHabit';

const ROOT = path.join(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** Yorumları at — "eski kural kalmadı" iddiası KODA bakmalı, onu anlatan yoruma değil. */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !l.trim().startsWith('//')).join('\n');

/** Plan verisinden GERÇEK kayıtlar (turkishModes.ts). */
const SLEEP_HABITS = [
  { name: 'Uyku', nameTr: 'Düzenli uyku (7–9 saat)', emoji: '😴' },
  { name: 'Uyku', nameTr: 'Düzenli uyku (7–9 saat) — kas onarımı için kritik', emoji: '😴' },
  { name: 'Uyku', nameTr: 'Kaliteli uyku — kaslar geceleri onarılır', emoji: '😴' },
  { name: 'Uyku', nameTr: 'Uyku kalitesi — kaslar uyurken büyür', emoji: '😴' },
];

/** Bu HATANIN kaynağı olan kayıt — uyku SAYILMAMALI. */
const RECOVERY_HABIT = { name: 'Dinlenme', nameTr: 'Toparlanma: uyku + aktif dinlenme', emoji: '😴' };

describe('gerçek uyku alışkanlıkları', () => {
  it.each(SLEEP_HABITS)('uyku sayılır: $nameTr', (h) => {
    expect(isSleepHabit(h)).toBe(true);
  });

  it('İngilizce kullanıcıda da uyku sayılır (görünen ad name alanında)', () => {
    // TurkishModeBanner: addHabit(tr ? nameTr : name, ..., nameTr, name)
    expect(isSleepHabit({ name: 'Uyku', nameTr: 'Düzenli uyku (7–9 saat)', nameEn: 'Uyku' })).toBe(true);
  });
});

describe('toparlanma alışkanlığı — HATANIN kaynağı', () => {
  it('Türkçe kullanıcıda uyku SAYILMAZ', () => {
    // tr: görünen ad = nameTr
    expect(isSleepHabit({
      name: RECOVERY_HABIT.nameTr,
      nameTr: RECOVERY_HABIT.nameTr,
      nameEn: RECOVERY_HABIT.name,
      emoji: RECOVERY_HABIT.emoji,
    })).toBe(false);
  });

  it('İngilizce kullanıcıda uyku SAYILMAZ', () => {
    expect(isSleepHabit({
      name: RECOVERY_HABIT.name,
      nameTr: RECOVERY_HABIT.nameTr,
      nameEn: RECOVERY_HABIT.name,
      emoji: RECOVERY_HABIT.emoji,
    })).toBe(false);
  });

  it('bu kayıt hâlâ plan verisinde duruyor — test hayali bir vakayı korumuyor', () => {
    const src = read('features/modes/utils/turkishModes.ts');
    expect(src).toContain("nameTr: 'Toparlanma: uyku + aktif dinlenme'");
  });
});

describe('emoji tek başına yetmez', () => {
  it('😴 taşıyan ama uykuyla ilgisiz alışkanlık uyku sayılmaz', () => {
    expect(isSleepHabit({ name: 'Meditasyon', emoji: '😴' })).toBe(false);
    expect(isSleepHabit({ name: 'Ekran molası', emoji: '😴' })).toBe(false);
  });

  it('emojisiz gerçek uyku alışkanlığı yine de uyku sayılır', () => {
    expect(isSleepHabit({ name: 'Uyku', emoji: '📌' })).toBe(true);
  });
});

describe('bileşik adlar — uyumak tek başına bitirmez', () => {
  it.each([
    'Toparlanma: uyku + aktif dinlenme',
    'Uyku ve su',
    'Sleep and stretch',
    'Uyku, spor, su',
    'Uyku ile meditasyon',
    'Sleep & recovery',
  ])('bileşik sayılır: %s', (name) => {
    expect(inferSleepFromNames({ name })).toBe(false);
  });
});

describe('açıklama konuyu belirlemez', () => {
  it('parantez içi ve uzun tireli açıklama atılır, kimlik kalır', () => {
    expect(inferSleepFromNames({ name: 'Düzenli uyku (7–9 saat) — kas onarımı için kritik' })).toBe(true);
    // Açıklamada "uyku" geçiyor ama KİMLİK başka bir iş
    expect(inferSleepFromNames({ name: 'Esneme — uyku kalitesini artırır' })).toBe(false);
  });
});

describe('açık damga tahmine üstündür', () => {
  it('healthMetric kazanır', () => {
    expect(isSleepHabit({ name: 'Gece rutini', healthMetric: 'sleep' })).toBe(true);
  });

  it('damga yoksa adlara bakılır', () => {
    expect(isSleepHabit({ name: 'Gece rutini' })).toBe(false);
  });
});

describe('kenar durumlar', () => {
  it('boş girdide çöker değil, false döner', () => {
    expect(isSleepHabit({})).toBe(false);
    expect(isSleepHabit({ name: '', nameTr: null, nameEn: undefined })).toBe(false);
    expect(isSleepHabit({ name: '   ' })).toBe(false);
  });
});

describe('kural TEK yerde — kayıt ve okuma ayrışamaz', () => {
  it('useHabitStore kendi kopyasını tutmaz', () => {
    const src = stripComments(read('features/habits/store/useHabitStore.ts'));
    expect(src).toContain("from '@/features/habits/utils/sleepHabit'");
    expect(src).not.toMatch(/emoji === '😴'/);
  });

  it('useSleepHealthSync kendi kopyasını tutmaz', () => {
    const src = stripComments(read('features/habits/hooks/useSleepHealthSync.ts'));
    expect(src).toContain("from '@/features/habits/utils/sleepHabit'");
    expect(src).not.toContain('function isSleepHabit');
  });

  it('hidrasyonda yanlış damga düzeltiliyor — eski kullanıcılar da kurtulur', () => {
    const src = read('features/habits/store/useHabitStore.ts');
    const merge = src.slice(src.indexOf('merge: (persisted'), src.indexOf('merge: (persisted') + 2200);
    expect(merge).toContain('inferSleepFromNames(h)');
    expect(merge).toContain('healthMetric');
  });

  it('hidrasyon geçmiş TAMAMLAMALARA dokunmaz — sessiz veri silme yok', () => {
    const src = read('features/habits/store/useHabitStore.ts');
    const merge = src.slice(src.indexOf('merge: (persisted'), src.indexOf('merge: (persisted') + 2200);
    // completedDates yalnız "dizi mi" korumasından geçer, filtrelenmez
    expect(merge).toContain('Array.isArray(h.completedDates) ? h.completedDates : []');
    expect(merge).not.toMatch(/completedDates\s*[:=][^;]*\.filter\(/);
  });
});
