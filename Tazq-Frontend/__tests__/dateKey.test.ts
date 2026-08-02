import fs from 'fs';
import path from 'path';
import { toDateKey, dateKeyFromNow, parseDateKey } from '@/shared/utils/dateKey';

/**
 * TAKVİM TARİHİ — "seçtiğim gün bir gün kaymış" hatasının testi.
 *
 * Tarih seçicilerden dönen Date, `toISOString().split('T')[0]` ile kaydediliyordu.
 * `toISOString()` UTC'ye çevirir; kullanıcı ise YEREL bir gün seçmiştir. İkisi günün
 * saatine ve saat dilimine göre ayrışır ve seçilen tarih yanlış güne yazılır — buna
 * bağlı her şey de kayar: geri sayım, "tarih geçti" kontrolü, bildirim zamanı.
 */
describe('toDateKey — yerel takvim günü', () => {
  it('gece yarısından hemen sonra seçilen gün KAYMAZ', () => {
    // UTC+3'te bu tarih toISOString ile "2026-08-02" oluyordu (bir gün geri).
    expect(toDateKey(new Date(2026, 7, 3, 1, 30))).toBe('2026-08-03');
  });

  it('akşam geç saatte seçilen gün de KAYMAZ', () => {
    // Negatif ofsetli saat dilimlerinde (ABD) bu tarih bir gün ileri kayıyordu.
    expect(toDateKey(new Date(2026, 7, 3, 23, 45))).toBe('2026-08-03');
  });

  it('günün hangi saatinde seçilirse seçilsin aynı anahtar', () => {
    // Asıl değişmez bu: takvim günü, seçim saatinden bağımsızdır.
    const keys = [0, 3, 9, 12, 18, 23].map(h => toDateKey(new Date(2026, 7, 3, h, 30)));
    expect(new Set(keys).size).toBe(1);
    expect(keys[0]).toBe('2026-08-03');
  });

  it('ay ve yıl sınırlarında doğru', () => {
    expect(toDateKey(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
    expect(toDateKey(new Date(2027, 0, 1, 0, 1))).toBe('2027-01-01');
    expect(toDateKey(new Date(2028, 1, 29, 2, 0))).toBe('2028-02-29'); // artık yıl
  });

  it('tek haneli ay/gün sıfırla dolduruluyor', () => {
    // 'YYYY-MM-DD' biçimi string karşılaştırmasıyla sıralanıyor (weightLog, seasonal
    // tarihleri); dolgu bozulursa sıralama sessizce yanlışa döner.
    expect(toDateKey(new Date(2026, 0, 5, 12, 0))).toBe('2026-01-05');
  });

  it('dateKeyFromNow gün sayısını yerel takvimde ilerletir', () => {
    const today = toDateKey(new Date());
    expect(dateKeyFromNow(0)).toBe(today);

    const in30 = new Date();
    in30.setDate(in30.getDate() + 30);
    expect(dateKeyFromNow(30)).toBe(toDateKey(in30));
  });
});

/**
 * OKUMA TARAFI — `new Date('2026-08-03')` tuzağı.
 *
 * JavaScript yalnız-tarih ISO metnini UTC gece yarısı sayar, sonra `getDate()`/`setHours()`
 * yerel saatte okur. Negatif ofsetli saat dilimlerinde bu, tarihi bir gün geri kaydırır:
 * geri sayım bir eksik çıkar, "tarih geçti" bir gün erken tetiklenir, mod erken kapanır.
 * Türkiye'de (UTC+3) doğru çalıştığı için hata yerelde hiç görünmez.
 */
describe('parseDateKey — anahtar yerel gece yarısı olarak çözülür', () => {
  it('yerel gece yarısını verir, UTC gece yarısını değil', () => {
    const d = parseDateKey('2026-08-03');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7); // Ağustos
    expect(d.getDate()).toBe(3);
    expect(d.getHours()).toBe(0);
  });

  it('gidiş-dönüş kayıpsız: anahtar → Date → anahtar', () => {
    for (const key of ['2026-01-01', '2026-08-03', '2026-12-31', '2028-02-29']) {
      expect(toDateKey(parseDateKey(key))).toBe(key);
    }
  });

  it('saat bilgisi taşıyan metinde takvim günü korunur', () => {
    // Bazı alanlar tam zaman damgası tutuyor; anahtar çözücü gün kısmını almalı.
    expect(toDateKey(parseDateKey('2026-08-03T21:30:00.000Z'))).toBe('2026-08-03');
  });

  it('gün sonu hesabı doğru güne düşer', () => {
    // Modların "tarih geçti" ve "kaç gün kaldı" hesapları bu kalıbı kullanıyor.
    const end = parseDateKey('2026-08-03');
    end.setHours(23, 59, 59, 999);
    expect(toDateKey(new Date(end))).toBe('2026-08-03');
    expect(end.getHours()).toBe(23);
  });
});

/**
 * Yardımcının VAR olması yetmez, KULLANILIYOR olması gerek. Eski kalıp tek bir yerde
 * geri gelse o ekran sessizce yanlış güne yazmaya başlar ve bunu ancak farklı saat
 * diliminden bir kullanıcı fark eder.
 */
describe('eski UTC kalıbı geri gelmemeli', () => {
  const ROOT = path.resolve(__dirname, '..');
  const SKIP = ['node_modules', '.expo', 'android', 'ios', 'dist', '.git', '__tests__', '__mocks__'];

  const walk = (dir: string): string[] => {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) return [];
    return fs.readdirSync(abs, { withFileTypes: true }).flatMap((e) => {
      if (SKIP.includes(e.name)) return [];
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) return walk(rel);
      return /\.tsx?$/.test(e.name) ? [rel] : [];
    });
  };

  it("hiçbir dosyada toISOString().split('T')[0] ile gün anahtarı üretilmiyor", () => {
    const offenders = ['app', 'shared', 'features']
      .flatMap(walk)
      // Yardımcının kendi açıklama yorumu hariç (hatayı anlatıyor, üretmiyor).
      .filter((f) => f !== 'shared/utils/dateKey.ts')
      .filter((f) => fs.readFileSync(path.join(ROOT, f), 'utf8').includes("toISOString().split('T')[0]"));
    expect(offenders).toEqual([]);
  });
});
