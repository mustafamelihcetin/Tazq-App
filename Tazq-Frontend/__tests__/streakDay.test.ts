import {
  dayKeyOf, todayKey, dayStamp, daysBetween, legacyDayString, weekdayIndex,
  completedTasksOn, completedHabitsOn, focusMinutesOn, wasActiveOn, decideStreak,
  computeStreakFromHistory,
} from '@/features/dashboard/utils/streakDay';

/**
 * SERİNİN GÜN HESABI.
 *
 * ── NEDEN BU TEST VAR ─────────────────────────────────────────────────────────
 * Burada üç kusur aynı anda yaşıyordu ve üçü de aynı kökten geliyordu: ekran "bugün"ü
 * üç ayrı biçimde tanımlıyordu. Hiçbiri test edilebilir değildi, çünkü karar bir
 * `useEffect` gövdesine gömülüydü — mağaza yazan, ses çalan, uyarı gösteren bir
 * gövdeye. Kararlar saf hâle getirildi; aşağıdaki testler tam olarak o üç kusuru
 * çiviliyor.
 *
 * Kusurların ortak özelliği: hiçbiri ekrana bakarak görünmüyor. Yanlış hesaplanan bir
 * seri, ancak günler sonra ve geri alınamaz biçimde ortaya çıkar.
 */

/** Ürünün gün tanımı 3 saat tamponlu: gece 02:00 hâlâ ÖNCEKİ gündür. */
const at = (iso: string) => new Date(iso);

describe('gün anahtarı — ürünün tek gün tanımı', () => {
  it('gece yarısından sonraki ilk üç saat HÂLÂ önceki gün', () => {
    /*
      Bu tampon ürünün kendi kararı (bkz. fmtDateKey) ve alışkanlıklar ona göre
      yazılıyor. Seri hesabı ise tamponsuz `toDateString()` kullanıyordu: saat
      00:01'de DÜNÜN alışkanlıkları yeni günün serisini artırıyordu — geceyi
      uygulamada geçiren herkese her gece bedava bir seri günü.
    */
    expect(todayKey(at('2026-09-16T00:01:00'))).toBe('2026-09-15');
    expect(todayKey(at('2026-09-16T02:59:00'))).toBe('2026-09-15');
    expect(todayKey(at('2026-09-16T03:00:00'))).toBe('2026-09-16');
    expect(todayKey(at('2026-09-16T23:59:00'))).toBe('2026-09-16');
  });

  it('geçersiz ya da boş tarih null döner — "bilinmiyor" ile "bugün" karışmaz', () => {
    expect(dayKeyOf(null)).toBeNull();
    expect(dayKeyOf('')).toBeNull();
    expect(dayKeyOf('bozuk-tarih')).toBeNull();
  });
});

describe('gün farkı', () => {
  it('ESKİ biçimdeki kayıtlar da okunuyor — güncelleme seriyi yeniden yargılamıyor', () => {
    /*
      Bu düzeltmeden önce `lastCheckedDate` alanına `toDateString()` yazılıyordu ve
      diskte o değerler duruyor. Yalnız yeni biçimi anlasaydık, güncellemeden sonraki
      ilk açılışta alan "okunamaz" sayılır ve kullanıcının serisi baştan yargılanırdı.
    */
    expect(dayStamp('2026-09-15')).toBe(new Date(2026, 8, 15).getTime());
    expect(dayStamp('Tue Sep 15 2026')).toBe(new Date(2026, 8, 15).getTime());
    expect(dayStamp('2026-09-15')).toBe(dayStamp('Tue Sep 15 2026'));
  });

  it('ISO biçimi YEREL gün olarak çözülüyor — saat dilimi kadar kaymıyor', () => {
    // `new Date("2026-09-15")` UTC gece yarısıdır; ham kullanılsaydı doğuda bir
    // gün ileri, batıda bir gün geri okunurdu.
    const d = new Date(dayStamp('2026-09-15'));
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 8, 15]);
  });

  it('gün sayısı doğru', () => {
    expect(daysBetween('2026-09-15', '2026-09-16')).toBe(1);
    expect(daysBetween('2026-09-15', '2026-09-15')).toBe(0);
    expect(daysBetween('2026-09-10', '2026-09-15')).toBe(5);
    // Ay ve yıl sınırları
    expect(daysBetween('2026-08-31', '2026-09-01')).toBe(1);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
  });

  it('okunamayan bir kayıt 0 döner — çöp veriyle ceza verilmez', () => {
    expect(daysBetween('', '2026-09-16')).toBe(0);
    expect(daysBetween('bozuk', '2026-09-16')).toBe(0);
  });
});

describe('eski biçimdeki bayrakla göç', () => {
  it('eski karşılık ÜRÜNÜN gününden türüyor, ham saatten değil', () => {
    /*
      Diskte `toDateString()` biçiminde yazılmış bayraklar var ve göç kontrolü onlarla
      karşılaştırma yapıyor. İncelik: karşılaştırma `new Date().toDateString()` ile
      yapılamaz, çünkü o TAMPONSUZDUR.

      Somut senaryo: kullanıcı dün 22:00'de bir görev bitirdi, bayrak "Tue Sep 15 2026"
      olarak yazıldı. Saat 01:00'de uygulamayı açıyor. Ürünün günü hâlâ 15 Eylül, yani
      seri zaten artırılmış. Ama ham `toDateString()` "Wed Sep 16 2026" der, eşleşme
      olmaz ve seri İKİNCİ kez artar — düzeltilen kusurun ta kendisi.
    */
    const key = todayKey(at('2026-09-16T01:00:00'));   // → 2026-09-15 (tamponlu)
    expect(key).toBe('2026-09-15');
    expect(legacyDayString(key)).toBe(new Date(2026, 8, 15).toDateString());
    // Ham saatin söylediğiyle AYNI DEĞİL — testin koruduğu fark bu.
    expect(legacyDayString(key)).not.toBe(at('2026-09-16T01:00:00').toDateString());
  });

  it('gündüz saatlerinde ikisi zaten aynı günü söyler', () => {
    const key = todayKey(at('2026-09-16T10:00:00'));
    expect(key).toBe('2026-09-16');
    expect(legacyDayString(key)).toBe(at('2026-09-16T10:00:00').toDateString());
  });

  it('okunamayan anahtar boş döner — yanlışlıkla bir günle eşleşmez', () => {
    expect(legacyDayString('bozuk')).toBe('');
  });
});

describe('hafta günü — şeritte "bugün" hangi sütun', () => {
  it('Pazartesi 0, Pazar 6', () => {
    // 2026-09-14 Pazartesi
    expect(weekdayIndex(at('2026-09-14T10:00:00'))).toBe(0);
    expect(weekdayIndex(at('2026-09-18T10:00:00'))).toBe(4); // Cuma
    expect(weekdayIndex(at('2026-09-20T10:00:00'))).toBe(6); // Pazar
  });

  it('gece yarısından sonraki ilk üç saat ÖNCEKİ sütunda kalıyor', () => {
    /*
      Bu soru iki yerde ayrı ayrı cevaplanıyordu: ana ekran tamponu uyguluyor, durum
      merkezindeki grafik ham `getDay()` kullanıyordu. Gece 01:00'de dakikalar bir
      çubuğa yazılıyor, "bugün" çerçevesi YANINDAKİNE çiziliyordu.
    */
    expect(weekdayIndex(at('2026-09-15T02:00:00'))).toBe(0); // hâlâ Pazartesi
    expect(weekdayIndex(at('2026-09-15T03:00:00'))).toBe(1); // artık Salı
  });

  it('gün anahtarıyla AYNI günü söylüyor — ikisi ayrışamaz', () => {
    for (const iso of ['2026-09-14T23:30:00', '2026-09-15T01:30:00', '2026-09-15T12:00:00', '2026-09-20T22:00:00']) {
      const d = at(iso);
      const fromKey = new Date(`${todayKey(d)}T12:00:00`).getDay();
      expect(weekdayIndex(d)).toBe(fromKey === 0 ? 6 : fromKey - 1);
    }
  });
});

describe('o gün aktif miydi', () => {
  const base = { dayKey: '2026-09-15', tasks: [], habits: [], focusDate: '', focusMinutes: 0, focusGoalMinutes: 25 };

  it('ODAK SEANSI sayılıyor — eskiden HİÇ sayılmıyordu', () => {
    /*
      Kusurun kendisi: karşılaştırma `dailyFocusDate === todayStr` biçimindeydi.
      Solda mağazanın yazdığı "2026-09-15", sağda `toDateString()` çıktısı
      "Tue Sep 15 2026". Bu eşitlik HİÇBİR ZAMAN doğru olmaz; yani yalnız odak
      çalışan kullanıcı seri kazanmıyor, dün yalnız odaklanmışsa ertesi gün
      kalkanını kaybediyordu.
    */
    expect(wasActiveOn({ ...base, focusDate: '2026-09-15', focusMinutes: 25 })).toBe(true);
    // Hedefin altında kalan seans yetmez.
    expect(wasActiveOn({ ...base, focusDate: '2026-09-15', focusMinutes: 24 })).toBe(false);
    // BAŞKA bir günün dakikası bu güne sayılmaz.
    expect(wasActiveOn({ ...base, focusDate: '2026-09-14', focusMinutes: 120 })).toBe(false);
    expect(focusMinutesOn({ dayKey: '2026-09-15', focusDate: '2026-09-14', focusMinutes: 120 })).toBe(0);
  });

  it('görev "ne zaman BİTİRİLDİ"ye göre sayılıyor, vadesine göre değil', () => {
    /*
      Eski hesap `dueDate`e bakıyordu: üç gün önce bitirilmiş ama vadesi bugüne
      yazılmış bir görev, bugün hiçbir şey yapmamış kullanıcıyı aktif gösteriyordu.
    */
    const done3DaysAgoDueToday = { isCompleted: true, completedAt: '2026-09-12T10:00:00', dueDate: '2026-09-15T09:00:00' };
    expect(completedTasksOn({ dayKey: '2026-09-15', tasks: [done3DaysAgoDueToday] })).toBe(0);

    const doneToday = { isCompleted: true, completedAt: '2026-09-15T10:00:00', dueDate: '2026-09-20T09:00:00' };
    expect(completedTasksOn({ dayKey: '2026-09-15', tasks: [doneToday] })).toBe(1);
  });

  it('completedAt YOKSA vadeye düşülüyor — düzeltme kimsenin serisini kırmıyor', () => {
    /*
      Sunucu `completedAt` tutmuyor (bkz. useTaskStore.setTasks). Yedek dal olmasaydı
      bu kayıtları taşıyan kullanıcıların serisi, bir kusur düzeltilirken kırılırdı.
    */
    const serverTask = { isCompleted: true, completedAt: null, dueDate: '2026-09-15T09:00:00' };
    expect(completedTasksOn({ dayKey: '2026-09-15', tasks: [serverTask] })).toBe(1);
  });

  it('tamamlanmamış görev hiçbir güne sayılmaz', () => {
    expect(completedTasksOn({ dayKey: '2026-09-15', tasks: [{ isCompleted: false, completedAt: '2026-09-15T10:00:00' }] })).toBe(0);
  });

  it('alışkanlık aynı gün anahtarıyla eşleşiyor', () => {
    expect(completedHabitsOn({ dayKey: '2026-09-15', habits: [{ completedDates: ['2026-09-15'] }] })).toBe(1);
    expect(completedHabitsOn({ dayKey: '2026-09-15', habits: [{ completedDates: ['2026-09-14'] }] })).toBe(0);
    expect(completedHabitsOn({ dayKey: '2026-09-15', habits: [{ completedDates: null }] })).toBe(0);
  });

  it('görev, alışkanlık ve odak AYNI ağırlıkta — biri yeter', () => {
    expect(wasActiveOn({ ...base, tasks: [{ isCompleted: true, completedAt: '2026-09-15T08:00:00' }] })).toBe(true);
    expect(wasActiveOn({ ...base, habits: [{ completedDates: ['2026-09-15'] }] })).toBe(true);
    expect(wasActiveOn(base)).toBe(false);
  });
});

describe('kalkan kararı', () => {
  const S = { daysMissed: 2, metGoalOnMissedDay: false, currentStreak: 5, shields: 3 };

  it('gün kaçırılmadıysa hiçbir şey olmaz', () => {
    expect(decideStreak({ ...S, daysMissed: 0 }).action).toBe('none');
  });

  it('serisi olmayana ceza yok', () => {
    expect(decideStreak({ ...S, currentStreak: 0 }).action).toBe('none');
  });

  it('tek gün kaçırıldıysa ve o gün aktifse kayıp yok', () => {
    expect(decideStreak({ ...S, daysMissed: 1, metGoalOnMissedDay: true }).action).toBe('none');
    expect(decideStreak({ ...S, daysMissed: 1, metGoalOnMissedDay: false }).action).toBe('protect');
  });

  it('iki gün kaçırıldıysa "o gün aktifti" mazereti GEÇMEZ', () => {
    // Tek günlük kontrol yalnız tek güne bakabiliyor; ikinci gün için elde veri yok.
    expect(decideStreak({ ...S, daysMissed: 2, metGoalOnMissedDay: true }).action).toBe('protect');
  });

  it('kalkan yeterliyse harcanır, kalanı bildirilir', () => {
    expect(decideStreak({ ...S, daysMissed: 2, shields: 3 })).toEqual({ action: 'protect', daysMissed: 2, shieldsLeft: 1 });
    expect(decideStreak({ ...S, daysMissed: 3, shields: 3 })).toEqual({ action: 'protect', daysMissed: 3, shieldsLeft: 0 });
  });

  it('kalkan yetmiyorsa seri sıfırlanır', () => {
    expect(decideStreak({ ...S, daysMissed: 4, shields: 3 })).toEqual({ action: 'reset', daysMissed: 4, shieldsHad: 3 });
    expect(decideStreak({ ...S, daysMissed: 1, shields: 0 })).toEqual({ action: 'reset', daysMissed: 1, shieldsHad: 0 });
  });
});

describe('seri geçmişten hesaplanır — sunucunun sayısı değil', () => {
  /*
    Sunucu seriyi görevin VADE gününe göre hesaplıyor (veritabanında tamamlanma tarihi
    alanı yok). Bu sayı yeni cihazda yerel seriyi tohumluyor, profil ekranında ise
    DOĞRUDAN gösteriliyordu: aynı kullanıcı ana ekranda başka, profilde başka bir seri
    görüyordu. Hesap artık ekranın kendi kuralıyla (wasActiveOn) yapılıyor.
  */
  const NOW = new Date(2026, 8, 20, 12, 0); // 20 Eylül 2026, öğlen
  const doneAt = (y: number, m: number, d: number) => ({ isCompleted: true, completedAt: new Date(y, m, d, 12).toISOString(), dueDate: null });
  const empty = { tasks: [], habits: [], focusDate: '', focusMinutes: 0, focusGoalMinutes: 25, now: NOW };

  it('arka arkaya aktif günleri sayar', () => {
    const tasks = [doneAt(2026, 8, 20), doneAt(2026, 8, 19), doneAt(2026, 8, 18)];
    expect(computeStreakFromHistory({ ...empty, tasks })).toBe(3);
  });

  it('bugün henüz boşsa seri DÜNDEN sayılır — gün bitmeden seri kırılmaz', () => {
    const tasks = [doneAt(2026, 8, 19), doneAt(2026, 8, 18)];
    expect(computeStreakFromHistory({ ...empty, tasks })).toBe(2);
  });

  it('boşluk seriyi bitirir', () => {
    const tasks = [doneAt(2026, 8, 20), doneAt(2026, 8, 18), doneAt(2026, 8, 17)];
    expect(computeStreakFromHistory({ ...empty, tasks })).toBe(1);
  });

  it('alışkanlık da seri sayar; hiç veri yoksa 0', () => {
    expect(computeStreakFromHistory({ ...empty, habits: [{ completedDates: ['2026-09-20', '2026-09-19'] }] })).toBe(2);
    expect(computeStreakFromHistory(empty)).toBe(0);
  });

  it('VADE günü yalnız yedek — tamamlanma tarihi varsa o kazanır', () => {
    // Vadesi bugüne yazılmış ama üç gün önce bitirilmiş görev bugüne seri KAZANDIRMAZ.
    const tasks = [{ isCompleted: true, completedAt: new Date(2026, 8, 17, 12).toISOString(), dueDate: new Date(2026, 8, 20, 12).toISOString() }];
    expect(computeStreakFromHistory({ ...empty, tasks })).toBe(0);
  });
});
