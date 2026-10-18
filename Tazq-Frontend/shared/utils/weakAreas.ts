import type { Topic } from '@/shared/utils/curriculum';

/**
 * Sınav-dışı modlar için HAFİF alan bankası — `curriculum.ts`'teki Ders→Konu ağacının
 * sadeleştirilmiş eşdeğeri. Mülakat/Tez/Spor'un her biri zaten TEK bir "ders" (mülakatın
 * kendisi, tezin kendisi, spor türünün kendisi); ihtiyaç olan yalnız düz bir ALAN
 * LİSTESİ. `Topic` tipi aynen kullanılıyor (id+tr+en+weight) — tip tekrarı yok.
 *
 * `pickTopic`in aksine burada bir "aralıklı tekrar" (lastStudied/progress) YOK: alan
 * sayısı küçük (3-5) ve haftalık bazda tekrar zaten yeterli. Yalnız ağırlıklı dönüşüm
 * var — zayıf işaretlenen alan 2x sıklıkla çıkar (bkz. `pickWeightedArea`).
 */

export const INTERVIEW_AREAS: Topic[] = [
  { id: 'interview_technical', tr: 'Teknik Sorular', en: 'Technical Questions' },
  { id: 'interview_behavioral', tr: 'Davranışsal Sorular', en: 'Behavioral Questions' },
  { id: 'interview_case', tr: 'Vaka Analizi', en: 'Case Analysis' },
  { id: 'interview_company', tr: 'Şirket Araştırması', en: 'Company Research' },
  { id: 'interview_salary', tr: 'Maaş Müzakeresi', en: 'Salary Negotiation' },
];

export const TEZ_AREAS: Topic[] = [
  { id: 'tez_literature', tr: 'Literatür Taraması', en: 'Literature Review' },
  { id: 'tez_writing', tr: 'Yazım & Dil', en: 'Writing & Language' },
  { id: 'tez_analysis', tr: 'Veri Analizi', en: 'Data Analysis' },
  { id: 'tez_defense', tr: 'Sunum & Savunma', en: 'Presentation & Defense' },
];

export type SporAreaKind = 'kilo' | 'maraton' | 'guc' | 'genel';

export const SPOR_AREAS: Record<SporAreaKind, Topic[]> = {
  kilo: [
    { id: 'spor_kilo_beslenme', tr: 'Beslenme Disiplini', en: 'Nutrition Discipline' },
    { id: 'spor_kilo_kardiyo', tr: 'Kardiyo', en: 'Cardio' },
    { id: 'spor_kilo_uyku', tr: 'Uyku & Toparlanma', en: 'Sleep & Recovery' },
  ],
  guc: [
    { id: 'spor_guc_ust', tr: 'Üst Vücut', en: 'Upper Body' },
    { id: 'spor_guc_alt', tr: 'Alt Vücut', en: 'Lower Body' },
    { id: 'spor_guc_core', tr: 'Core', en: 'Core' },
    { id: 'spor_guc_hareketlilik', tr: 'Hareketlilik', en: 'Mobility' },
  ],
  maraton: [
    { id: 'spor_maraton_hiz', tr: 'Hız Çalışması', en: 'Speed Work' },
    { id: 'spor_maraton_dayaniklilik', tr: 'Dayanıklılık', en: 'Endurance' },
    { id: 'spor_maraton_toparlanma', tr: 'Esneme & Toparlanma', en: 'Stretching & Recovery' },
  ],
  genel: [
    { id: 'spor_genel_kardiyo', tr: 'Kardiyo', en: 'Cardio' },
    { id: 'spor_genel_kuvvet', tr: 'Kuvvet', en: 'Strength' },
    { id: 'spor_genel_esneklik', tr: 'Esneklik', en: 'Flexibility' },
  ],
};

/**
 * Bugünün alanını seçer — zayıf işaretli alanlar (`weakIds`) 2x ağırlıklı, deterministik
 * gün-rotasyonu. `pickTopic`teki weak-ağırlıklandırma mantığının sadeleştirilmiş hali
 * (bkz. dosya başlığı — burada "en uzun süredir çalışılmayan" takibi yok).
 */
export function pickWeightedArea(areas: Topic[], dayIndex: number, weakIds?: string[] | null): Topic | null {
  if (!areas.length) return null;
  const weakSet = new Set(weakIds ?? []);
  const expanded: Topic[] = [];
  for (const a of areas) {
    const base = Math.max(1, Math.round(a.weight ?? 1));
    const w = weakSet.has(a.id) ? base * 2 : base;
    for (let i = 0; i < w; i++) expanded.push(a);
  }
  if (!expanded.length) return areas[0];
  return expanded[((dayIndex % expanded.length) + expanded.length) % expanded.length];
}

/**
 * Etiketi alan adıyla birleştirir: "Google Mülakatı — Teknik Sorular". `subjectExamLabel`
 * ile AYNI "—" biçimi (tutarlılık için) ama tek seviyeli (ders kavramı yok).
 */
export function areaLabel(baseName: string, area: Topic | null | undefined, lang: 'tr' | 'en'): string {
  const name = baseName.trim();
  if (!area) return name;
  const a = lang === 'tr' ? area.tr : area.en;
  return name ? `${name} — ${a}` : a;
}
