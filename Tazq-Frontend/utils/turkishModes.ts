export type ModeType = 'ramazan' | 'yks' | 'kpss';

export interface ModeHabit {
  name: string;
  nameTr: string;
  emoji: string;
  color: string;
}

export interface ModeTask {
  titleTr: string;
  titleEn: string;
  priority: 'High' | 'Medium' | 'Low';
}

export interface TurkishMode {
  type: ModeType;
  labelTr: string;
  labelEn: string;
  subtitleTr: string;
  subtitleEn: string;
  emoji: string;
  daysLeft: number;
  habits: ModeHabit[];
  tasks: ModeTask[];
}

// ── Date ranges ─────────────────────────────────────────────────────────────

const RAMAZAN: { start: string; end: string }[] = [
  { start: '2025-03-01', end: '2025-03-30' },
  { start: '2026-02-18', end: '2026-03-19' },
  { start: '2027-02-07', end: '2027-03-08' },
  { start: '2028-01-28', end: '2028-02-25' },
];

const YKS: { start: string; end: string }[] = [
  { start: '2025-06-14', end: '2025-06-15' },
  { start: '2026-06-13', end: '2026-06-14' },
  { start: '2027-06-12', end: '2027-06-13' },
];

const KPSS: { start: string; end: string }[] = [
  { start: '2025-10-26', end: '2025-10-26' },
  { start: '2026-10-25', end: '2026-10-25' },
  { start: '2027-10-24', end: '2027-10-24' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysUntilEnd(endStr: string): number {
  const end = new Date(endStr);
  end.setHours(23, 59, 59, 999);
  return Math.ceil((end.getTime() - Date.now()) / 86400000);
}

function isActive(start: string, end: string, leadDays = 0): number {
  const s = new Date(start);
  s.setDate(s.getDate() - leadDays);
  s.setHours(0, 0, 0, 0);
  const e = new Date(end);
  e.setHours(23, 59, 59, 999);
  const now = Date.now();
  if (now >= s.getTime() && now <= e.getTime()) return daysUntilEnd(end);
  return -1;
}

// ── Mode definitions ──────────────────────────────────────────────────────────

const RAMAZAN_MODE = (days: number): TurkishMode => ({
  type: 'ramazan',
  labelTr: 'Ramazan Modu',
  labelEn: 'Ramadan Mode',
  subtitleTr: `${days} gün kaldı · Rutinlerin hazırlandı`,
  subtitleEn: `${days} days left · Routines ready`,
  emoji: '🌙',
  daysLeft: days,
  habits: [
    { name: 'Teravih Namazı', nameTr: 'Teravih Namazı', emoji: '🤲', color: '#6366F1' },
    { name: 'Kuran Okuma', nameTr: 'Kuran Okuma', emoji: '📖', color: '#8B5CF6' },
    { name: 'Sahur Uyanışı', nameTr: 'Sahur Uyanışı', emoji: '⏰', color: '#F59E0B' },
    { name: 'Dua & Zikir', nameTr: 'Dua & Zikir', emoji: '☪️', color: '#10B981' },
  ],
  tasks: [
    { titleTr: 'Zekat hesapla ve öde', titleEn: 'Calculate and pay Zakat', priority: 'High' },
    { titleTr: 'İftar planlaması yap', titleEn: 'Plan iftar meals', priority: 'Medium' },
    { titleTr: 'Ramazan hedeflerini belirle', titleEn: 'Set Ramadan goals', priority: 'Medium' },
  ],
});

const YKS_MODE = (days: number): TurkishMode => ({
  type: 'yks',
  labelTr: 'YKS Modu',
  labelEn: 'YKS Mode',
  subtitleTr: `${days} gün kaldı · Çalışma planın hazır`,
  subtitleEn: `${days} days left · Study plan ready`,
  emoji: '📚',
  daysLeft: days,
  habits: [
    { name: 'TYT Çalışması', nameTr: 'TYT Çalışması', emoji: '📐', color: '#3B82F6' },
    { name: 'AYT Çalışması', nameTr: 'AYT Çalışması', emoji: '📊', color: '#EF4444' },
    { name: 'Günlük Deneme', nameTr: 'Günlük Deneme', emoji: '📝', color: '#10B981' },
    { name: 'Soru Analizi', nameTr: 'Soru Analizi', emoji: '🔍', color: '#F59E0B' },
    { name: 'Konu Tekrarı', nameTr: 'Konu Tekrarı', emoji: '🧠', color: '#8B5CF6' },
  ],
  tasks: [
    { titleTr: 'Haftalık çalışma programı oluştur', titleEn: 'Create weekly study schedule', priority: 'High' },
    { titleTr: 'Zayıf konuları listele', titleEn: 'List weak topics', priority: 'High' },
    { titleTr: 'Deneme sınavı stratejisi belirle', titleEn: 'Define mock exam strategy', priority: 'High' },
    { titleTr: 'Sınav günü lojistiğini planla', titleEn: 'Plan exam day logistics', priority: 'Medium' },
  ],
});

const KPSS_MODE = (days: number): TurkishMode => ({
  type: 'kpss',
  labelTr: 'KPSS Modu',
  labelEn: 'KPSS Mode',
  subtitleTr: `${days} gün kaldı · Hazırlık planın aktif`,
  subtitleEn: `${days} days left · Prep plan active`,
  emoji: '🏛️',
  daysLeft: days,
  habits: [
    { name: 'GY/GK Çalışması', nameTr: 'GY/GK Çalışması', emoji: '📖', color: '#6366F1' },
    { name: 'Tarih Tekrarı', nameTr: 'Tarih Tekrarı', emoji: '🏺', color: '#EC4899' },
    { name: 'Günlük Deneme', nameTr: 'Günlük Deneme', emoji: '📝', color: '#10B981' },
    { name: 'Matematik Pratik', nameTr: 'Matematik Pratik', emoji: '➗', color: '#F59E0B' },
  ],
  tasks: [
    { titleTr: 'KPSS başvurusunu kontrol et', titleEn: 'Check KPSS application', priority: 'High' },
    { titleTr: 'Konu tarama planı oluştur', titleEn: 'Create topic sweep plan', priority: 'High' },
    { titleTr: 'Sınav yerini ve saatini not al', titleEn: 'Note exam location and time', priority: 'High' },
    { titleTr: 'Son iki yılın sorularını çöz', titleEn: 'Solve last 2 years questions', priority: 'Medium' },
  ],
});

// ── Public API ───────────────────────────────────────────────────────────────

export function detectTurkishMode(): TurkishMode | null {
  for (const r of RAMAZAN) {
    const days = isActive(r.start, r.end, 0);
    if (days >= 0) return RAMAZAN_MODE(days);
  }
  for (const y of YKS) {
    const days = isActive(y.start, y.end, 35);
    if (days >= 0) return YKS_MODE(days);
  }
  for (const k of KPSS) {
    const days = isActive(k.start, k.end, 45);
    if (days >= 0) return KPSS_MODE(days);
  }
  return null;
}
