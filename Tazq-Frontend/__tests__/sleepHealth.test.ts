/**
 * Uyku süresi hesabı — regresyon testleri.
 *
 * Kök neden (giderildi): örneklerin süreleri DÜZ TOPLANIYORDU. HealthKit/Health
 * Connect'te aynı gece birden fazla kaynak tarafından yazılır (iPhone Uyku Odağı +
 * Apple Watch evreleri, üçüncü parti uygulamalar) → 7 saatlik uyku "14 saat" görünüyordu.
 * Ayrıca 26 saatlik pencereye düşen TÜM oturumlar toplanıyordu (gece + şekerleme,
 * hatta iki ayrı gece).
 */
import { lastSleepSessionMinutes, formatSleepDuration } from '@/shared/services/sleepHealth';
import fs from 'fs';
import path from 'path';

const iso = (s: string) => new Date(s).toISOString();

describe('lastSleepSessionMinutes', () => {
  it('aynı geceyi yazan iki kaynağı çift saymaz (union)', () => {
    // iPhone: 23:00–06:00 asleep (7s) + Apple Watch: aynı aralık core/deep/REM olarak
    const mins = lastSleepSessionMinutes([
      { start: iso('2026-07-25T23:00'), end: iso('2026-07-26T06:00') },
      { start: iso('2026-07-25T23:00'), end: iso('2026-07-26T02:30') },
      { start: iso('2026-07-26T02:30'), end: iso('2026-07-26T04:30') },
      { start: iso('2026-07-26T04:30'), end: iso('2026-07-26T06:00') },
    ]);
    expect(mins).toBe(7 * 60); // eskiden 14 * 60 idi
  });

  it('kısmen örtüşen kaynakları birleştirir', () => {
    const mins = lastSleepSessionMinutes([
      { start: iso('2026-07-25T23:00'), end: iso('2026-07-26T04:00') }, // 5s
      { start: iso('2026-07-26T03:00'), end: iso('2026-07-26T06:00') }, // 3s, 1s örtüşüyor
    ]);
    expect(mins).toBe(7 * 60); // 23:00–06:00, düz toplam 8s olurdu
  });

  it('iki ayrı geceyi toplamaz — yalnız EN SON oturumu alır', () => {
    const mins = lastSleepSessionMinutes([
      { start: iso('2026-07-24T22:00'), end: iso('2026-07-25T06:00') }, // 8s (önceki gece)
      { start: iso('2026-07-25T23:00'), end: iso('2026-07-26T06:00') }, // 7s (son uyku)
    ]);
    expect(mins).toBe(7 * 60); // eskiden 15s
  });

  it('gece uykusu + öğle şekerlemesini toplamaz', () => {
    const mins = lastSleepSessionMinutes([
      { start: iso('2026-07-25T23:00'), end: iso('2026-07-26T06:00') }, // 7s
      { start: iso('2026-07-26T14:00'), end: iso('2026-07-26T16:00') }, // 2s şekerleme
    ]);
    expect(mins).toBe(2 * 60); // en son oturum = şekerleme (toplam 9s DEĞİL)
  });

  it('gece içi kısa uyanmaları aynı oturum sayar ama uyanık süreyi eklemez', () => {
    const mins = lastSleepSessionMinutes([
      { start: iso('2026-07-25T23:00'), end: iso('2026-07-26T02:00') }, // 3s
      { start: iso('2026-07-26T02:30'), end: iso('2026-07-26T06:00') }, // 30dk sonra 3.5s
    ]);
    expect(mins).toBe(6 * 60 + 30); // 6.5s uyku; aradaki 30dk uyanıklık sayılmaz
  });

  it('akla yatkın olmayan süreyi (>16s) reddeder', () => {
    const mins = lastSleepSessionMinutes([
      { start: iso('2026-07-25T06:00'), end: iso('2026-07-26T00:00') }, // 18s
    ]);
    expect(mins).toBeNull();
  });

  it('boş / geçersiz girdide null döner', () => {
    expect(lastSleepSessionMinutes([])).toBeNull();
    expect(lastSleepSessionMinutes([{ start: 'abc', end: 'def' }])).toBeNull();
    // Bitiş başlangıçtan önce → geçersiz
    expect(lastSleepSessionMinutes([{ start: iso('2026-07-26T06:00'), end: iso('2026-07-26T05:00') }])).toBeNull();
  });
});

describe('formatSleepDuration', () => {
  it('tr/en biçimlendirir', () => {
    expect(formatSleepDuration(430, 'tr')).toBe('7s 10dk');
    expect(formatSleepDuration(420, 'tr')).toBe('7 saat');
    expect(formatSleepDuration(430, 'en')).toBe('7h 10m');
  });
});

/**
 * ANDROID EVRE FİLTRESİ — sessiz ve tek yönlü bir ölçüm hatasıydı.
 *
 * Kod `String(st.stage).toUpperCase().includes('AWAKE')` diye kontrol ediyordu ama
 * `react-native-health-connect` evreyi SAYI döndürüyor (`stage: number`). `String(1)`
 * = "1" ve bu asla "AWAKE" içermez → gece boyunca UYANIK geçen dakikalar UYKU olarak
 * sayılıyordu. Etkisi: her gece 20-60 dakika fazla uyku, hedefin hak edilmeden
 * tamamlanmış görünmesi.
 *
 * Sabitler (SleepStageType): 0 UNKNOWN · 1 AWAKE · 2 SLEEPING · 3 OUT_OF_BED
 *                            4 LIGHT · 5 DEEP · 6 REM · (7 AWAKE_IN_BED)
 */
describe('Android uyku evresi — uyanıklık ayıklanır', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'shared/services/sleepHealth.ts'), 'utf8');

  it('evre kontrolü METİN karşılaştırmasıyla yapılmaz', () => {
    // Bu satır hatanın kendisiydi; geri gelirse ölçüm yine sessizce bozulur.
    expect(src).not.toContain("String(st.stage ?? '').toUpperCase()");
  });

  it('uyanık evre kodları sabit tablodan gelir', () => {
    expect(src).toContain('const AWAKE_STAGE_CODES = new Set([1, 3, 7]);');
    expect(src).toContain('if (isAwakeStage(st.stage)) continue;');
  });

  it('UNKNOWN (0) uyku sayılır — kanıtsız dakika atılmaz', () => {
    // Bir uyku oturumunun İÇİNDE geçen belirsiz süre, uyanıklık kanıtı değildir.
    const m = src.match(/const AWAKE_STAGE_CODES = new Set\(\[([^\]]*)\]\)/);
    expect(m).not.toBeNull();
    expect(m![1]).not.toMatch(/\b0\b/);
    expect(m![1]).not.toMatch(/\b2\b/); // SLEEPING de atılmamalı
  });
});

/**
 * GERİYE DÖNÜK DOLDURMA — uygulama açılmadığı için kaybolan geceler.
 *
 * Veri katmanı yalnız son 26 saati okuyor, senkron yalnız BUGÜNÜ işaretliyordu.
 * Kullanıcı üç gün girmezse aradaki geceler platformda DURURKEN kayboluyor, uyku
 * alışkanlığı işaretlenmiyor, SERİ kırılıyor, momentum düşüyordu.
 */
describe('uyku geriye dönük doldurma', () => {
  const svc = fs.readFileSync(
    path.join(__dirname, '..', 'shared/services/sleepHealth.ts'), 'utf8');
  const sync = fs.readFileSync(
    path.join(__dirname, '..', 'features/habits/hooks/useSleepHealthSync.ts'), 'utf8');

  it('veri katmanı gün gün döküm verebiliyor', () => {
    expect(svc).toContain('async getSleepMinutesByDay(daysBack: number)');
    // Oturum UYANILAN güne yazılır (cur.end) — "dün gece kaç saat uyudum" sorusunun
    // cevabı o sabahın gününe işlenir.
    expect(svc).toContain('const d = new Date(cur.end);');
  });

  it('okuma mantığı TEK yerde — iki tüketici paylaşıyor', () => {
    // Ayrışsalardı biri düzeltilip öteki eskirdi; bu dosyada tam olarak bu olmuştu.
    expect(svc).toContain('async _readIntervals(from: Date, to: Date)');
    expect(svc).toContain('const intervals = await this._readIntervals(from, to);');
  });

  it('doldurma penceresi SINIRLI — geçmiş yeniden yazılmaz', () => {
    // Sınırsız doldurma, aylar sonra kurulan telefonda tüm geçmişi "başarı" yapardı.
    const m = sync.match(/const BACKFILL_DAYS = (\d+);/);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeLessThanOrEqual(7);
  });

  it('geçmiş günler SESSİZ doldurulur — toast yok', () => {
    const block = sync.match(/for \(let back = 1; back <= BACKFILL_DAYS[\s\S]*?\n      \}/)?.[0] ?? '';
    expect(block).not.toBe('');
    expect(block).not.toContain('Toast');
    expect(block).not.toContain('show(');
  });

  it('hedef tutmayan gün işaretlenmez — eksik BAŞARI tamamlanmaz', () => {
    expect(sync).toContain('if (mins < goalHours * 60) continue;');
  });

  it('zaten işaretli günde toggle ÇAĞRILMAZ — silmesin', () => {
    // `toggleDate` isminden belli: ikinci çağrı işareti KALDIRIR.
    expect(sync).toContain("if (!cur || (cur.completedDates ?? []).includes(key)) continue;");
  });
});
