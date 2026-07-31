import { Platform } from 'react-native';

/**
 * Uyku sağlık entegrasyonu.
 *  - iOS  → Apple HealthKit (@kingstinct/react-native-healthkit, Nitro tabanlı).
 *  - Android → Health Connect (react-native-health-connect, Android-only).
 *
 * Tasarım: LAZY + GUARDED native erişim; modül yoksa/hatalıysa sessiz no-op (çökme yok).
 * ONAYLI/otomatik asistan üstte (useSleepHealthSync); burası yalnız veri katmanı.
 */

export type SleepAvailability = 'unsupported' | 'needs-permission' | 'ready';

// ── iOS: HealthKit (kingstinct + nitro) ────────────────────────────────────────
let _hk: any = null;
function getHK(): any {
  if (_hk !== null) return _hk;
  try { _hk = require('@kingstinct/react-native-healthkit'); } catch { _hk = false; }
  return _hk;
}
const SLEEP_ID = 'HKCategoryTypeIdentifierSleepAnalysis';
// HKCategoryValueSleepAnalysis: 0=inBed 1=asleepUnspecified 2=awake 3=asleepCore 4=asleepDeep 5=asleepREM
const ASLEEP_VALUES = new Set([1, 3, 4, 5]);
const IN_BED_VALUE = 0;

// ── Android: Health Connect ─────────────────────────────────────────────────────
let _hc: any = null;
function getHC(): any {
  if (_hc !== null) return _hc;
  try { _hc = require('react-native-health-connect'); } catch { _hc = false; }
  return _hc;
}

// "Son uyku" penceresi: son 26 saat (rolling). Sabit gece penceresi YERİNE rolling kullanıyoruz —
// böylece vardiyalı/gündüz uyuyan ya da düzensiz saatte uyuyan kullanıcının EN SON ana uykusu da
// yakalanır (gece varsayımı yok). 26 saat: >24h başlayıp süren bir uykuyu da kaçırmamak için pay.
function recentSleepWindow(): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date(to.getTime() - 26 * 60 * 60 * 1000);
  return { from, to };
}

/** İki uyku bloğu arasındaki bu süreden büyük boşluk → AYRI oturum (ör. gece uykusu vs. şekerleme). */
const SESSION_GAP_MIN = 90;
/** Tek oturumda makul üst sınır. Aşılırsa veri güvenilmez sayılır (sessiz no-op). */
const MAX_PLAUSIBLE_SLEEP_MIN = 16 * 60;

type Interval = { start: number; end: number };

/**
 * PLATFORM KAYIT ŞEKİLLERİ — neden `any` değil.
 *
 * Bu dosyadaki en pahalı hata `any` yüzünden kaçmıştı: Health Connect uyku evresini
 * SAYI döndürüyor ama kod `String(stage).includes('AWAKE')` diye metin arıyordu.
 * `stages: any[]` olduğu için derleyici "bu alan sayı, metin araman anlamsız" diyemedi;
 * hata sessizce her gece 20-60 dakika fazla uyku olarak birikti.
 *
 * Tipler GEVŞEK yazıldı (opsiyonel alanlar, `string | number`): amaç kütüphanenin
 * tam şemasını taklit etmek değil, OKUDUĞUMUZ alanları isimlendirmek. Sıkı yazmak
 * kütüphane sürümü değişince derlemeyi kırardı; gevşek yazmak yanlış varsayımı yakalar.
 */

/** HealthKit `HKCategoryTypeIdentifierSleepAnalysis` örneği. */
interface HKSleepSample {
  /** HKCategoryValueSleepAnalysis: 0=inBed 1=asleep 2=awake 3=core 4=deep 5=REM */
  value?: number | string;
  startDate?: string | number | Date;
  endDate?: string | number | Date;
  /** Eski sürüm alan adları — küçük harfli ve kısa biçimler görülüyor. */
  startdate?: string | number | Date;
  enddate?: string | number | Date;
  start?: string | number | Date;
  end?: string | number | Date;
}

/** Health Connect `SleepSession` kaydındaki tek bir evre. */
interface HCSleepStage {
  /** SleepStageType sabiti — SAYI. Metin karşılaştırması yapılmamalı. */
  stage?: number | string;
  startTime?: string;
  endTime?: string;
}

/** Health Connect `SleepSession` kaydı. */
interface HCSleepRecord {
  startTime?: string;
  endTime?: string;
  stages?: HCSleepStage[];
}

/**
 * Health Connect uyku EVRESİ uyanıklık mı?
 *
 * ÖLÇÜLEN HATA: kod `String(st.stage).toUpperCase().includes('AWAKE')` diye kontrol
 * ediyordu. Ama kütüphane evreyi SAYI olarak döndürüyor (`stage: number`, bkz.
 * react-native-health-connect/types/base.types.d.ts). `String(1)` = "1" ve bu asla
 * "AWAKE" içermez — yani gece boyunca UYANIK kalınan dakikalar UYKU olarak sayılıyordu.
 *
 * Etkisi sessiz ve tek yönlü: uyku süresi her gece 20-60 dakika FAZLA görünüyordu.
 * Kullanıcı "7 saat uyudum" derken aslında 6 saat 15 dakika uyumuş oluyordu ve
 * alışkanlık hedefi hak edilmeden tamamlanmış sayılıyordu.
 *
 * Health Connect sabitleri (SleepStageType):
 *   0 UNKNOWN · 1 AWAKE · 2 SLEEPING · 3 OUT_OF_BED · 4 LIGHT · 5 DEEP · 6 REM
 * Bazı sürümlerde 7 AWAKE_IN_BED da var.
 *
 * UNKNOWN (0) uyku sayılıyor: bir uyku oturumunun İÇİNDE geçen belirsiz süre, uyanıklık
 * kanıtı yok. Kanıtsız dakikayı atmak, veriyi eksik göstermek olurdu.
 *
 * Metin biçimi de destekleniyor — kütüphane sürümü değişip string dönerse kod sessizce
 * bozulmasın diye. Bu hatanın tam olarak nasıl oluştuğunu tekrar etmemek için.
 */
const AWAKE_STAGE_CODES = new Set([1, 3, 7]); // AWAKE · OUT_OF_BED · AWAKE_IN_BED

function isAwakeStage(stage: unknown): boolean {
  if (typeof stage === 'number') return AWAKE_STAGE_CODES.has(stage);
  const s = String(stage ?? '').toUpperCase();
  if (!s) return false;
  // Sayı metni olarak gelmişse ("1") yine sabit tablosuna bak.
  const n = Number(s);
  if (Number.isFinite(n)) return AWAKE_STAGE_CODES.has(n);
  return s.includes('AWAKE') || s.includes('OUT_OF_BED');
}

/** Platformlardan gelen tarih biçimleri: ISO metin, epoch sayısı ya da `Date`. */
type DateLike = string | number | Date | null | undefined;

function toInterval(a: DateLike, b: DateLike): Interval | null {
  // Boş değer ERKEN eleniyor. Eskiden `any` olduğu için `new Date(undefined)` sessizce
  // geçiyor ve Invalid Date üretiyordu; sonuç `isFinite` kontrolüne takılıp null
  // dönüyordu — yani davranış doğruydu ama YANLIŞLIKLA doğruydu. Tip eklenince
  // derleyici bunu hemen gösterdi.
  if (a == null || b == null) return null;
  const s = new Date(a).getTime();
  const e = new Date(b).getTime();
  if (!isFinite(s) || !isFinite(e) || e <= s) return null;
  return { start: s, end: e };
}

/**
 * Örtüşen/bitişik aralıkları BİRLEŞTİRİR (union) ve yalnız EN SON oturumun
 * dakikasını döndürür.
 *
 * Neden union: HealthKit/Health Connect'te aynı gece BİRDEN FAZLA kaynak tarafından
 * yazılır (iPhone Uyku Odağı `asleepUnspecified` + Apple Watch `core/deep/REM`,
 * ya da üçüncü parti uyku uygulamaları). Süreleri düz toplamak aynı geceyi iki kez
 * sayar → 7 saatlik uyku "14 saat" görünür. Union bu çift saymayı yapısal olarak
 * imkânsız kılar.
 *
 * Neden yalnız son oturum: 26 saatlik pencereye gece uykusu + öğle şekerlemesi
 * (hatta akşam açıldığında iki ayrı gece) birlikte düşebiliyordu ve hepsi toplanıyordu.
 * SESSION_GAP_MIN'den büyük boşluk yeni oturum sayılır; "son uyku" = en son oturum.
 *
 * @returns dakika, ya da veri anlamsız/güvenilmezse null.
 */
function lastSessionMinutes(raw: (Interval | null)[]): number | null {
  const items = raw.filter((x): x is Interval => x != null).sort((a, b) => a.start - b.start);
  if (items.length === 0) return null;

  // 1) Union: örtüşen ya da bitişik aralıkları tek bloğa indir.
  const merged: Interval[] = [];
  for (const it of items) {
    const last = merged[merged.length - 1];
    if (last && it.start <= last.end) {
      if (it.end > last.end) last.end = it.end;
    } else {
      merged.push({ ...it });
    }
  }

  // 2) Bloklar arası boşluk SESSION_GAP_MIN'i aşmıyorsa aynı oturum (gece içi kısa uyanmalar).
  //    Süre olarak blokların KENDİ toplamı alınır (span değil) → arada uyanık geçen
  //    dakikalar uyku süresine yazılmaz.
  const gapMs = SESSION_GAP_MIN * 60000;
  let total = merged[merged.length - 1].end - merged[merged.length - 1].start;
  let sessionStart = merged[merged.length - 1].start;
  for (let i = merged.length - 2; i >= 0; i--) {
    if (sessionStart - merged[i].end > gapMs) break;
    total += merged[i].end - merged[i].start;
    sessionStart = merged[i].start;
  }

  const mins = Math.round(total / 60000);
  if (mins <= 0 || mins > MAX_PLAUSIBLE_SLEEP_MIN) return null; // şüpheli veri → sessiz geç
  return mins;
}

export const SleepHealth = {
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

  async requestAuthorization(): Promise<boolean> {
    if (Platform.OS === 'ios') {
      const hk = getHK();
      if (!hk || typeof hk.requestAuthorization !== 'function') return false;
      try {
        // kingstinct v14 (Nitro): TEK nesne { toRead: [...] } bekler. Yanlış imza NATIVE CRASH yapar.
        await hk.requestAuthorization({ toRead: [SLEEP_ID] });
        return true;
      } catch { return false; }
    }
    if (Platform.OS === 'android') {
      const hc = getHC();
      if (!hc) return false;
      try {
        if (typeof hc.initialize === 'function') { const ok = await hc.initialize(); if (ok === false) return false; }
        const granted = await hc.requestPermission([{ accessType: 'read', recordType: 'SleepSession' }]);
        return Array.isArray(granted) ? granted.length > 0 : !!granted;
      } catch { return false; }
    }
    return false;
  },

  /**
   * Verilen pencerede platformun bildirdigi TUM uyku araliklarini toplar.
   *
   * Ayri fonksiyon: iki tuketicisi var — "son gece kac dakika" ve "son N gunun gun gun
   * dokumu". Ikisi ayni okuma mantigini paylasmali, yoksa biri duzeltilip oteki
   * eskir (bu dosyada tam olarak bu olmustu: Android evre filtresi yanlisti).
   */
  async _readIntervals(from: Date, to: Date): Promise<(Interval | null)[] | null> {
    if (Platform.OS === 'ios') {
      const hk = getHK();
      if (!hk || typeof hk.queryCategorySamples !== 'function') return null;
      try {
        // v14 imzası: (identifier, { filter: { date: { startDate, endDate } }, limit }). limit:0 = tümü.
        const samples: HKSleepSample[] = (await hk.queryCategorySamples(SLEEP_ID, {
          filter: { date: { startDate: from, endDate: to } },
          limit: 0,
        })) ?? [];
        if (!Array.isArray(samples) || samples.length === 0) return null;
        // Aralık olarak topla; SÜRELERİ TOPLAMA (çok kaynaklı çift sayımı önlemek için union şart).
        const asleep: (Interval | null)[] = [];
        const inBed: (Interval | null)[] = [];
        for (const s of samples) {
          const v = typeof s.value === 'number' ? s.value : Number(s.value);
          const iv = toInterval(s.startDate ?? s.startdate ?? s.start, s.endDate ?? s.enddate ?? s.end);
          if (!iv) continue;
          if (ASLEEP_VALUES.has(v)) asleep.push(iv);
          else if (v === IN_BED_VALUE) inBed.push(iv);
        }
        // "Uykuda" kaydı varsa onu kullan; yoksa "yatakta"ya düş (eski/basit kaynaklar).
        return asleep.length > 0 ? asleep : inBed;
      } catch { return null; }
    }

    if (Platform.OS === 'android') {
      const hc = getHC();
      if (!hc || typeof hc.readRecords !== 'function') return null;
      try {
        if (typeof hc.initialize === 'function') await hc.initialize();
        const res = await hc.readRecords('SleepSession', {
          timeRangeFilter: { operator: 'between', startTime: from.toISOString(), endTime: to.toISOString() },
        });
        const records: HCSleepRecord[] = res?.records ?? res ?? [];
        if (!Array.isArray(records) || records.length === 0) return null;
        // iOS'taki ile aynı kural: aralıkları topla, union'ı lastSessionMinutes alsın.
        // Health Connect'te de birden fazla uygulama aynı geceyi yazabiliyor (çift sayım riski).
        const intervals: (Interval | null)[] = [];
        for (const r of records) {
          // Evre verisi varsa uyanık evreleri AT; yoksa oturumun tamamını al.
          const stages: HCSleepStage[] = Array.isArray(r.stages) ? r.stages : [];
          if (stages.length > 0) {
            for (const st of stages) {
              if (isAwakeStage(st.stage)) continue;
              intervals.push(toInterval(st.startTime, st.endTime));
            }
          } else {
            intervals.push(toInterval(r.startTime, r.endTime));
          }
        }
        return intervals;
      } catch { return null; }
    }

    return null;
  },

  /** Son gece (en son oturum) kac dakika. */
  async getRecentSleepMinutes(): Promise<number | null> {
    const { from, to } = recentSleepWindow();
    const intervals = await this._readIntervals(from, to);
    return intervals ? lastSessionMinutes(intervals) : null;
  },

  /**
   * SON N GUNUN GUN GUN uyku dokumu — geriye donuk doldurma icin.
   *
   * NEDEN VAR: kullanici uygulamayi 3 gun acmazsa `getRecentSleepMinutes` yalnizca son
   * 26 saati okuyordu ve senkron yalnizca BUGUNU isaretliyordu. Aradaki geceler
   * HealthKit/Health Connect'te DURURKEN kayboluyor, uyku aliskanligi isaretlenmiyor,
   * SERI KIRILIYOR ve momentum dusuyordu. Yani uygulama, kullaniciyi kendisini
   * acmadigi icin cezalandiriyordu — elindeki veriyi kullanmadan.
   *
   * GUN ATAMASI: bir oturum UYANILAN gune yazilir. 23:00'te baslayip 07:00'de biten
   * uyku, ertesi gunun uykusudur — insanlar "dun gece kac saat uyudum" diye sorar,
   * cevabi da o sabahin gunune isler. Mevcut davranis da buydu, korunuyor.
   */
  async getSleepMinutesByDay(daysBack: number): Promise<Record<string, number>> {
    const to = new Date();
    // +1 gun pay: en eski gunun uykusu bir onceki aksam baslamis olabilir.
    const from = new Date(to.getTime() - (daysBack + 1) * 24 * 60 * 60 * 1000);

    const raw = await this._readIntervals(from, to);
    if (!raw) return {};

    // Ayni union + oturum ayrimi kurallari; ama TUM oturumlar, yalniz sonuncusu degil.
    const items = raw.filter((x): x is Interval => x != null).sort((a, b) => a.start - b.start);
    if (items.length === 0) return {};

    const merged: Interval[] = [];
    for (const it of items) {
      const last = merged[merged.length - 1];
      if (last && it.start <= last.end) { if (it.end > last.end) last.end = it.end; }
      else merged.push({ ...it });
    }

    const gapMs = SESSION_GAP_MIN * 60000;
    const out: Record<string, number> = {};
    let cur: Interval | null = null;
    let total = 0;

    const flush = () => {
      if (!cur) return;
      const mins = Math.round(total / 60000);
      // Ayni akla yatkinlik siniri: sacma uzun bir oturum veriyi kirletmesin.
      if (mins > 0 && mins <= MAX_PLAUSIBLE_SLEEP_MIN) {
        const d = new Date(cur.end);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        // Ayni gune birden fazla oturum dusebilir (gece + sabah devami) — topla.
        out[key] = Math.min((out[key] ?? 0) + mins, MAX_PLAUSIBLE_SLEEP_MIN);
      }
      cur = null; total = 0;
    };

    for (const iv of merged) {
      if (cur && iv.start - cur.end <= gapMs) {
        total += iv.end - iv.start;
        cur.end = iv.end;
      } else {
        flush();
        cur = { ...iv };
        total = iv.end - iv.start;
      }
    }
    flush();

    return out;
  },

  async getAvailability(): Promise<SleepAvailability> {
    if (!this.isSupported()) return 'unsupported';
    if (!(await this.isDataAvailable())) return 'unsupported';
    const mins = await this.getRecentSleepMinutes();
    return mins != null ? 'ready' : 'needs-permission';
  },
};

/**
 * Saf yardımcı (test edilebilir): ISO/Date çiftlerinden EN SON uyku oturumunun
 * dakikasını hesaplar. Union + oturum ayrımı + akla yatkınlık sınırı uygular.
 */
export function lastSleepSessionMinutes(blocks: { start: DateLike; end: DateLike }[]): number | null {
  return lastSessionMinutes(blocks.map(b => toInterval(b.start, b.end)));
}

/** Dakikayı "7s 10dk" gibi biçimle. */
export function formatSleepDuration(minutes: number, lang: 'tr' | 'en'): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (lang === 'tr') return m > 0 ? `${h}s ${m}dk` : `${h} saat`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
