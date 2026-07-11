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
function minutesBetween(a: any, b: any): number {
  const s = new Date(a).getTime();
  const e = new Date(b).getTime();
  if (!isFinite(s) || !isFinite(e) || e <= s) return 0;
  return (e - s) / 60000;
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
        let asleep = 0, inBed = 0;
        for (const s of samples) {
          const v = typeof s.value === 'number' ? s.value : Number(s.value);
          const mins = minutesBetween(s.startDate ?? s.startdate ?? s.start, s.endDate ?? s.enddate ?? s.end);
          if (ASLEEP_VALUES.has(v)) asleep += mins;
          else if (v === IN_BED_VALUE) inBed += mins;
        }
        const total = Math.round(asleep > 0 ? asleep : inBed);
        return total > 0 ? total : null;
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
        let total = 0;
        for (const r of records) {
          // Evre verisi varsa awake dışını topla; yoksa oturum süresini al.
          const stages: any[] = Array.isArray(r.stages) ? r.stages : [];
          if (stages.length > 0) {
            for (const st of stages) {
              const stage = String(st.stage ?? '').toUpperCase();
              if (stage.includes('AWAKE')) continue;
              total += minutesBetween(st.startTime, st.endTime);
            }
          } else {
            total += minutesBetween(r.startTime, r.endTime);
          }
        }
        const rounded = Math.round(total);
        return rounded > 0 ? rounded : null;
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

/** Dakikayı "7s 10dk" gibi biçimle. */
export function formatSleepDuration(minutes: number, lang: 'tr' | 'en'): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (lang === 'tr') return m > 0 ? `${h}s ${m}dk` : `${h} saat`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
