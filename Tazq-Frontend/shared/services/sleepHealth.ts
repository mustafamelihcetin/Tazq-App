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

function toInterval(a: any, b: any): Interval | null {
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

  async getRecentSleepMinutes(): Promise<number | null> {
    const { from, to } = recentSleepWindow();

    if (Platform.OS === 'ios') {
      const hk = getHK();
      if (!hk || typeof hk.queryCategorySamples !== 'function') return null;
      try {
        // v14 imzası: (identifier, { filter: { date: { startDate, endDate } }, limit }). limit:0 = tümü.
        const samples: any[] = (await hk.queryCategorySamples(SLEEP_ID, {
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
        return lastSessionMinutes(asleep.length > 0 ? asleep : inBed);
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
        const records: any[] = res?.records ?? res ?? [];
        if (!Array.isArray(records) || records.length === 0) return null;
        // iOS'taki ile aynı kural: aralıkları topla, union'ı lastSessionMinutes alsın.
        // Health Connect'te de birden fazla uygulama aynı geceyi yazabiliyor (çift sayım riski).
        const intervals: (Interval | null)[] = [];
        for (const r of records) {
          // Evre verisi varsa awake dışını al; yoksa oturumun tamamını al.
          const stages: any[] = Array.isArray(r.stages) ? r.stages : [];
          if (stages.length > 0) {
            for (const st of stages) {
              const stage = String(st.stage ?? '').toUpperCase();
              if (stage.includes('AWAKE')) continue;
              intervals.push(toInterval(st.startTime, st.endTime));
            }
          } else {
            intervals.push(toInterval(r.startTime, r.endTime));
          }
        }
        return lastSessionMinutes(intervals);
      } catch { return null; }
    }

    return null;
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
export function lastSleepSessionMinutes(blocks: { start: any; end: any }[]): number | null {
  return lastSessionMinutes(blocks.map(b => toInterval(b.start, b.end)));
}

/** Dakikayı "7s 10dk" gibi biçimle. */
export function formatSleepDuration(minutes: number, lang: 'tr' | 'en'): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (lang === 'tr') return m > 0 ? `${h}s ${m}dk` : `${h} saat`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
