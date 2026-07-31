import { Platform } from 'react-native';
import type { DayActivity, ActivityWorkout } from '@/shared/utils/activityMatch';
import { emptyActivity } from '@/shared/utils/activityMatch';

/**
 * HAREKET VERİSİ — adım, mesafe ve antrenman seansları (Apple Sağlık / Health Connect).
 *
 * Kardeşi `sleepHealth.ts` ile aynı sözleşme: platform kütüphaneleri TEMBEL yükleniyor,
 * her çağrı sessizce başarısız olabiliyor ve hiçbir veri cihazdan çıkmıyor.
 *
 * ── NEDEN TOPLAMA (aggregate) API'Sİ, HAM KAYIT DEĞİL ───────────────────────────
 * Uyku tarafında ham kayıtları okuyup elle birleştirmek (union) zorunda kaldık: aynı
 * geceyi birden fazla uygulama yazdığında süreler toplanınca 14 saat uyku gibi saçma
 * sonuçlar çıkıyordu. Adım/mesafe tarafında bu risk daha da büyük — telefon, saat ve
 * üçüncü parti uygulamalar aynı adımları ayrı ayrı yazar.
 *
 * İki platform da bunun için hazır bir yol sunuyor: iOS'ta `queryStatisticsForQuantity`,
 * Android'de `aggregateRecord`. İkisi de çakışan kaynakları KENDİSİ tekilleştiriyor.
 * Ham kayıtları toplasaydık kullanıcının adımı iki-üç katına çıkar, "8000 adım" eşiği
 * anlamını yitirir ve görevler haksız yere otomatik tamamlanırdı.
 *
 * ── YALNIZCA BUGÜN ──────────────────────────────────────────────────────────────
 * Uyku senkronunda geriye dönük doldurma var (kullanıcı uygulamayı 3 gün açmasa da
 * alışkanlık serisi kırılmasın diye). Burada bilinçli olarak YOK: hareket görevleri
 * güne bağlı görevler ve geçmiş bir günün görevini sonradan kapatmak, o günün
 * momentum kaydı çoktan yazılmışken tabloyu geriye dönük değiştirirdi. Bugünün verisi
 * zaten kullanıcı uygulamayı ne zaman açarsa açsın eksiksiz geliyor.
 */

let _hk: any = null;
function getHK(): any {
  if (_hk !== null) return _hk;
  try { _hk = require('@kingstinct/react-native-healthkit'); } catch { _hk = false; }
  return _hk;
}

let _hc: any = null;
function getHC(): any {
  if (_hc !== null) return _hc;
  try { _hc = require('react-native-health-connect'); } catch { _hc = false; }
  return _hc;
}

/**
 * OKUNAN TİPLER — hepsi SALT OKUNUR, hiçbir şey yazılmıyor.
 *
 * TAM HealthKit tanımlayıcıları yazılmak ZORUNDA. Burada bir hata yapıldı ve cihazda
 * ortaya çıktı: kısa adlar ('stepCount', 'appleExerciseTime') yazılmıştı. HealthKit bu
 * dizeleri tanımıyor, `requestAuthorization` hata fırlatıyor ve ayarlardaki anahtar
 * "Sağlık izni verilmedi" diyerek geri dönüyordu — yani özellik hiç açılmıyordu.
 *
 * NEDEN DERLEYİCİ YAKALAMADI: `getHK()` tembel `require` yaptığı için `any` dönüyor.
 * Kütüphanenin `QuantityTypeIdentifier` birleşim tipi bu dizeleri anında reddederdi ama
 * `any` o kapıyı kapatıyor. Bu, `typeSafety.test.ts`te anlatılan hatanın birebir aynısı:
 * `any`, derleyicinin yakalayacağı bir hatayı cihazda bulunan bir hataya çeviriyor.
 * Aşağıdaki değerler artık `healthIdentifiers.test.ts` ile korunuyor.
 */
const HK_STEPS = 'HKQuantityTypeIdentifierStepCount';
const HK_DISTANCE = 'HKQuantityTypeIdentifierDistanceWalkingRunning';
/** iOS'un "tempolu hareket" saydığı dakika — `move` görevleri için en doğrudan ölçü. */
const HK_EXERCISE = 'HKQuantityTypeIdentifierAppleExerciseTime';
/** Antrenman örnekleri ayrı bir tip; nicelik değil, `HKWorkoutType`. */
const HK_WORKOUT = 'HKWorkoutTypeIdentifier';

/**
 * ANTRENMAN TÜRÜ KODLARI.
 *
 * Koşu ve yürüyüş AYRI tutuluyor çünkü maraton modunda bu ayrım antrenman planının
 * kendisi: "bugünkü koşunu tamamla" görevini iki saatlik bir yürüyüş kapatmamalı.
 */
// HealthKit HKWorkoutActivityType
const HK_RUN = 37;
const HK_WALK = 52;
const HK_HIKE = 24;
// Health Connect ExerciseType
const HC_RUN = 56;
const HC_RUN_TREADMILL = 57;
const HC_WALK = 79;

/** Saçma değerler veriyi kirletmesin — bir günde 24 saat antrenman olmaz. */
const MAX_PLAUSIBLE_WORKOUT_MIN = 8 * 60;
const MAX_PLAUSIBLE_STEPS = 100000;

/**
 * Miktarı dakikaya çevirir. Birim adı platformlar ve sürümler arasında değişebiliyor
 * ('min', 'sec', 's'), o yüzden birime BAKIYORUZ — sabit bir birim varsaymak, sessizce
 * 60 kat sapan sürelere yol açardı.
 */
function toMinutes(q: { unit?: string; quantity?: number } | undefined | null): number {
  if (!q || typeof q.quantity !== 'number' || !Number.isFinite(q.quantity)) return 0;
  const u = String(q.unit ?? '').toLowerCase();
  if (u.startsWith('s')) return q.quantity / 60;   // sec / s
  if (u.startsWith('h')) return q.quantity * 60;   // hr / h
  return q.quantity;                                // min (varsayılan)
}

function toMeters(q: { unit?: string; quantity?: number } | undefined | null): number {
  if (!q || typeof q.quantity !== 'number' || !Number.isFinite(q.quantity)) return 0;
  const u = String(q.unit ?? '').toLowerCase();
  if (u === 'km') return q.quantity * 1000;
  if (u === 'mi') return q.quantity * 1609.34;
  return q.quantity;
}

function toCount(q: { quantity?: number } | undefined | null): number {
  if (!q || typeof q.quantity !== 'number' || !Number.isFinite(q.quantity)) return 0;
  return Math.max(0, Math.round(q.quantity));
}

/** Günün 00:00 - şu an aralığı. Adım "bugün" demek, son 24 saat demek değil. */
function todayWindow(): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date(to);
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

function hkWorkoutKind(type: unknown): ActivityWorkout['kind'] {
  const n = typeof type === 'number' ? type : Number(type);
  if (n === HK_RUN) return 'run';
  if (n === HK_WALK || n === HK_HIKE) return 'walk';
  return 'other';
}

function hcWorkoutKind(type: unknown): ActivityWorkout['kind'] {
  const n = typeof type === 'number' ? type : Number(type);
  if (n === HC_RUN || n === HC_RUN_TREADMILL) return 'run';
  if (n === HC_WALK) return 'walk';
  return 'other';
}

export type ActivityAvailability = 'unsupported' | 'needs-permission' | 'ready';

export const ActivityHealth = {
  isSupported(): boolean {
    if (Platform.OS === 'ios') return !!getHK();
    if (Platform.OS === 'android') return !!getHC();
    return false;
  },

  async isDataAvailable(): Promise<boolean> {
    if (Platform.OS === 'ios') {
      const hk = getHK();
      if (!hk) return false;
      try {
        const fn = hk.isHealthDataAvailable;
        return typeof fn === 'function' ? !!(await fn()) : true;
      } catch { return false; }
    }
    if (Platform.OS === 'android') {
      const hc = getHC();
      if (!hc) return false;
      try {
        if (typeof hc.getSdkStatus === 'function') {
          const status = await hc.getSdkStatus();
          const ok = hc.SdkAvailabilityStatus?.SDK_AVAILABLE;
          return ok == null ? true : status === ok;
        }
        return true;
      } catch { return false; }
    }
    return false;
  },

  /**
   * İzin ister. UYKUDAN AYRI istenir — kullanıcı yalnız uykuyu paylaşmak isteyebilir.
   *
   * Tek seferde her şeyi istemek, izin ekranını uzatıp reddedilme ihtimalini artırır ve
   * "bu uygulama neden koşularımı istiyor" sorusunu yanlış anda sordurur. Hareket izni
   * ancak spor/kilo modu açıkken ve kullanıcı özelliği isterken sorulur.
   */
  async requestAuthorization(): Promise<boolean> {
    if (Platform.OS === 'ios') {
      const hk = getHK();
      if (!hk || typeof hk.requestAuthorization !== 'function') return false;
      try {
        // v14 (Nitro) TEK nesne bekler: { toRead: [...] }. Yanlış imza NATIVE CRASH yapar.
        const res = await hk.requestAuthorization({ toRead: [HK_STEPS, HK_DISTANCE, HK_EXERCISE, HK_WORKOUT] });
        // iOS, OKUMA izninin verilip verilmediğini bilerek GİZLER (kullanıcı "hayır"
        // dediğinde uygulama bunu anlayamasın diye — mahremiyet kararı). Yani buradaki
        // `true` "izin verildi" demek değil, "izin ekranı hatasız gösterildi" demek.
        // Gerçek cevap ilk okumada belli olur: veri gelmezse satır çizilmez.
        return typeof res === 'boolean' ? res : true;
      } catch { return false; }
    }
    if (Platform.OS === 'android') {
      const hc = getHC();
      if (!hc) return false;
      try {
        if (typeof hc.initialize === 'function') { const ok = await hc.initialize(); if (ok === false) return false; }
        const granted = await hc.requestPermission([
          { accessType: 'read', recordType: 'Steps' },
          { accessType: 'read', recordType: 'Distance' },
          { accessType: 'read', recordType: 'ExerciseSession' },
        ]);
        return Array.isArray(granted) ? granted.length > 0 : !!granted;
      } catch { return false; }
    }
    return false;
  },

  /**
   * Bugünün hareket özeti.
   *
   * `null` döner = OKUNAMADI (izin yok / kütüphane yok / hata). Sıfır aktiviteyle
   * karıştırılmamalı: biri "veri yok" der, öteki "kullanıcı hiç hareket etmedi". İkisini
   * aynı saymak, izin vermemiş bir kullanıcıya "bugün hiç hareket etmedin" dedirtirdi.
   */
  async getTodayActivity(): Promise<DayActivity | null> {
    const { from, to } = todayWindow();

    if (Platform.OS === 'ios') {
      const hk = getHK();
      if (!hk) return null;
      try {
        const filter = { filter: { date: { startDate: from, endDate: to } } };
        const out = emptyActivity();
        let anyRead = false;

        // Her ölçü AYRI korunuyor: kullanıcı adımı paylaşıp antrenmanı paylaşmamış
        // olabilir. Tek bir try bloğu olsaydı ilk reddedilen izin diğerlerini de yutardı.
        if (typeof hk.queryStatisticsForQuantity === 'function') {
          try {
            const s = await hk.queryStatisticsForQuantity(HK_STEPS, ['cumulativeSum'], filter);
            out.steps = Math.min(toCount(s?.sumQuantity), MAX_PLAUSIBLE_STEPS);
            anyRead = true;
          } catch { /* izin yok — diğer ölçüler denenmeye devam */ }
          try {
            const d = await hk.queryStatisticsForQuantity(HK_DISTANCE, ['cumulativeSum'], { ...filter, unit: 'm' });
            out.distanceMeters = Math.round(toMeters(d?.sumQuantity));
            anyRead = true;
          } catch { /* yok say */ }
          try {
            const e = await hk.queryStatisticsForQuantity(HK_EXERCISE, ['cumulativeSum'], { ...filter, unit: 'min' });
            out.exerciseMinutes = Math.round(toMinutes(e?.sumQuantity));
            anyRead = true;
          } catch { /* yok say */ }
        }

        if (typeof hk.queryWorkoutSamples === 'function') {
          try {
            const ws: any[] = (await hk.queryWorkoutSamples({ ...filter, limit: 0 })) ?? [];
            for (const w of ws) {
              const minutes = Math.round(toMinutes(w?.duration));
              if (minutes <= 0 || minutes > MAX_PLAUSIBLE_WORKOUT_MIN) continue;
              out.workouts.push({
                kind: hkWorkoutKind(w?.workoutActivityType),
                minutes,
                distanceMeters: Math.round(toMeters(w?.totalDistance)),
              });
            }
            anyRead = true;
          } catch { /* yok say */ }
        }

        return anyRead ? out : null;
      } catch { return null; }
    }

    if (Platform.OS === 'android') {
      const hc = getHC();
      if (!hc) return null;
      try {
        if (typeof hc.initialize === 'function') await hc.initialize();
        const timeRangeFilter = { operator: 'between', startTime: from.toISOString(), endTime: to.toISOString() };
        const out = emptyActivity();
        let anyRead = false;

        if (typeof hc.aggregateRecord === 'function') {
          try {
            const s = await hc.aggregateRecord({ recordType: 'Steps', timeRangeFilter });
            const n = Number(s?.COUNT_TOTAL);
            if (Number.isFinite(n)) { out.steps = Math.min(Math.max(0, Math.round(n)), MAX_PLAUSIBLE_STEPS); anyRead = true; }
          } catch { /* yok say */ }
          try {
            const d = await hc.aggregateRecord({ recordType: 'Distance', timeRangeFilter });
            // Health Connect uzunluğu `{ inMeters }` sarmalıyla döndürür.
            const m = Number(d?.DISTANCE?.inMeters ?? d?.DISTANCE);
            if (Number.isFinite(m)) { out.distanceMeters = Math.max(0, Math.round(m)); anyRead = true; }
          } catch { /* yok say */ }
        }

        if (typeof hc.readRecords === 'function') {
          try {
            const res = await hc.readRecords('ExerciseSession', { timeRangeFilter });
            const records: any[] = res?.records ?? res ?? [];
            for (const r of records) {
              const start = Date.parse(r?.startTime);
              const end = Date.parse(r?.endTime);
              if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
              const minutes = Math.round((end - start) / 60000);
              if (minutes <= 0 || minutes > MAX_PLAUSIBLE_WORKOUT_MIN) continue;
              out.workouts.push({ kind: hcWorkoutKind(r?.exerciseType), minutes, distanceMeters: 0 });
            }
            anyRead = true;
          } catch { /* yok say */ }
        }

        /**
         * Android'de iOS'un "egzersiz dakikası" karşılığı YOK. Bunun yerine antrenman
         * seanslarının toplam süresi kullanılıyor — `move` görevi için doğru vekil ölçü.
         * Uydurma bir formülle (adımdan dakika tahmin etmek gibi) doldurmak, eşiği
         * ölçülemez hale getirirdi.
         */
        out.exerciseMinutes = out.workouts.reduce((n, w) => n + w.minutes, 0);

        return anyRead ? out : null;
      } catch { return null; }
    }

    return null;
  },

  async getAvailability(): Promise<ActivityAvailability> {
    if (!this.isSupported()) return 'unsupported';
    if (!(await this.isDataAvailable())) return 'unsupported';
    const a = await this.getTodayActivity();
    return a != null ? 'ready' : 'needs-permission';
  },
};
