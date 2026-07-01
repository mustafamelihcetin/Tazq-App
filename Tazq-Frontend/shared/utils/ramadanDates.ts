export interface RamadanPeriod {
  year: number;
  start: string; // YYYY-MM-DD, Türkiye/Diyanet resmi başlangıcı
  end: string;
}

// Diyanet İşleri Başkanlığı açıklamalarına göre — her yıl Şabanlık belgesiyle güncelle
const RAMADAN_DATES: RamadanPeriod[] = [
  { year: 2024, start: '2024-03-11', end: '2024-04-09' },
  { year: 2025, start: '2025-03-01', end: '2025-03-29' },
  { year: 2026, start: '2026-02-18', end: '2026-03-19' },
  { year: 2027, start: '2027-02-08', end: '2027-03-08' },
  { year: 2028, start: '2028-01-27', end: '2028-02-25' },
  { year: 2029, start: '2029-01-16', end: '2029-02-14' },
  { year: 2030, start: '2030-01-05', end: '2030-02-03' },
];

export function getRamadanForYear(year: number): RamadanPeriod | null {
  return RAMADAN_DATES.find((r) => r.year === year) ?? null;
}

export interface RamadanStatus {
  period: RamadanPeriod | null;
  isActive: boolean;
  daysRemaining: number;
  daysUntilStart: number;
  duration: number; // toplam Ramazan günü
}

export function getCurrentRamadanStatus(): RamadanStatus {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const year = today.getFullYear();

  const tryPeriod = (p: RamadanPeriod): RamadanStatus | null => {
    const start = new Date(p.start);
    const end = new Date(p.end);
    end.setHours(23, 59, 59, 999);
    const MS = 86_400_000;
    const duration = Math.round((new Date(p.end).getTime() - new Date(p.start).getTime()) / MS) + 1;

    if (today >= start && today <= end) {
      return { period: p, isActive: true, daysRemaining: Math.ceil((end.getTime() - today.getTime()) / MS), daysUntilStart: 0, duration };
    }
    if (today < start) {
      return { period: p, isActive: false, daysRemaining: 0, daysUntilStart: Math.ceil((start.getTime() - today.getTime()) / MS), duration };
    }
    return null;
  };

  for (const candidate of [getRamadanForYear(year), getRamadanForYear(year + 1)]) {
    if (!candidate) continue;
    const result = tryPeriod(candidate);
    if (result) return result;
  }

  return { period: null, isActive: false, daysRemaining: 0, daysUntilStart: 0, duration: 0 };
}

export function formatRamadanDate(iso: string, language: string, includeYear = false): string {
  const d = new Date(iso);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };
  if (includeYear) opts.year = 'numeric';
  return d.toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US', opts);
}
