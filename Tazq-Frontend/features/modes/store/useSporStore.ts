import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface WeightEntry {
  date: string; // YYYY-MM-DD
  weight: number;
}

export type TargetEvent = '' | '5K' | '10K' | 'Yarı' | 'Tam';
export type Gender = '' | 'male' | 'female';

interface SporState {
  currentWeight: string;
  targetWeight: string;
  heightCm: string;
  ageYears: string;
  gender: Gender;
  weeklyKm: string;
  targetEvent: TargetEvent;
  trainingDays: 3 | 4 | 5 | null;
  weightLog: WeightEntry[];
  setCurrentWeight: (v: string) => void;
  setTargetWeight: (v: string) => void;
  setHeightCm: (v: string) => void;
  setAgeYears: (v: string) => void;
  setGender: (v: Gender) => void;
  setWeeklyKm: (v: string) => void;
  setTargetEvent: (v: TargetEvent) => void;
  setTrainingDays: (v: 3 | 4 | 5 | null) => void;
  addWeightEntry: (weight: number) => void;
  removeWeightEntry: (date: string) => void;
  /** Plan formu alanlarını sıfırlar. Kilo GEÇMİŞİNE dokunmaz — bkz. resetInputs. */
  resetInputs: () => void;
  /** Çıkış/hesap silme: kilo geçmişi DAHİL her şeyi siler (gizlilik sınırı). */
  clearAll: () => void;
}

export function getLocalDateString(d: Date = new Date()): string {
  const adjusted = new Date(d);
  adjusted.setHours(adjusted.getHours() - 3); // 3-hour buffer for night owls
  const y = adjusted.getFullYear();
  const m = String(adjusted.getMonth() + 1).padStart(2, '0');
  const day = String(adjusted.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const useSporStore = create<SporState>()(
  persist(
    (set) => ({
      currentWeight: '',
      targetWeight: '',
      heightCm: '',
      ageYears: '',
      gender: '' as Gender,
      weeklyKm: '',
      targetEvent: '',
      trainingDays: null,
      weightLog: [],
      setCurrentWeight: (v) => set({ currentWeight: v }),
      setTargetWeight: (v) => set({ targetWeight: v }),
      setHeightCm: (v) => set({ heightCm: v }),
      setAgeYears: (v) => set({ ageYears: v }),
      setGender: (v) => set({ gender: v }),
      setWeeklyKm: (v) => set({ weeklyKm: v }),
      setTargetEvent: (v) => set({ targetEvent: v }),
      setTrainingDays: (v) => set({ trainingDays: v }),
      addWeightEntry: (weight) => set((s) => {
        const today = getLocalDateString();
        const filtered = s.weightLog.filter(e => e.date !== today);
        return { weightLog: [...filtered, { date: today, weight }].sort((a, b) => b.date.localeCompare(a.date)) };
      }),
      removeWeightEntry: (date) => set((s) => ({ weightLog: s.weightLog.filter(e => e.date !== date) })),
      /*
        PLAN KALDIRMAK TARTI GEÇMİŞİNİ SİLMEZ.

        Burası eskiden `weightLog: []` de yazıyordu; gerekçesi "plan yeniden açıldığında
        eski girişler görünür kalıyordu" idi. Bedeli ise ölçtüğünden ağırdı:

         1. VERİ KAYBI. Kilo geçmişi kullanıcının kendi sağlık kaydı, planın kurulum
            artığı değil. Plan bir kez kapatılınca aylarca birikmiş tartım geri gelmiyordu.
         2. HAFTALIK ZİNCİR SIFIRLANIYORDU. "7 günde bir tartıl" sayacı geçmişten
            hesaplanıyor (bkz. canLogWeight). Geçmiş silinince sayaç sıfırlanıyor ve
            "Güncel kilonu gir" görevi daha yeni tartılmışken hemen geri geliyordu.

        Form alanları (hedef kilo, boy, yaş...) plana AİT olduğu için sıfırlanmaya devam
        ediyor; ölçümler kullanıcıya ait olduğu için korunuyor.
      */
      resetInputs: () => set({
        currentWeight: '', targetWeight: '', heightCm: '', ageYears: '', gender: '' as Gender,
        weeklyKm: '', targetEvent: '', trainingDays: null,
      }),
      /*
        ÇIKIŞ AYRI BİR SINIR: cihazda kullanıcıya ait iz kalmamalı — aynı telefonu başkası
        kullanabilir. Bu yüzden burada geçmiş DE siliniyor.

        Bilinen bedel: kilo geçmişi buluta gönderilmediği için (gizlilik metni 2.5 —
        sağlık verisi sunucuya gitmez) çıkış yapan kullanıcı geçmişini geri alamaz.
        Bunu değiştirmek metin + App Store veri etiketi kararı gerektirir; kod tek başına
        karar veremez.
      */
      clearAll: () => set({
        currentWeight: '', targetWeight: '', heightCm: '', ageYears: '', gender: '' as Gender,
        weeklyKm: '', targetEvent: '', trainingDays: null, weightLog: [],
      }),
    }),
    { name: 'spor-store', storage: createJSONStorage(() => AsyncStorage) }
  )
);

/**
 * Bu tartım döneminde girilmiş kayıt (varsa).
 *
 * "Hafta" tanımı, kaydın kabul edilme kuralıyla (weightCheckin.canLogWeight) AYNI
 * olmalı: YUVARLANAN 7 GÜN. Eskiden burası takvim haftası (Pazartesi) kullanıyordu;
 * modal "Bu hafta kaydedildi" derken kayıt kabul edilebiliyor ya da tersi olabiliyordu.
 * Ayrıca 'YYYY-MM-DD' UTC olarak parse ediliyordu → negatif UTC ofsetli ülkelerde
 * kayıt bir gün geriye kayıyordu; artık yerel parse ediliyor.
 */
export function getThisWeekEntry(log: WeightEntry[]): WeightEntry | null {
  if (!log?.length) return null;
  const cutoff = Date.now() - 7 * 86400000;
  const newest = log.reduce((a, b) => (a.date > b.date ? a : b));
  return new Date(newest.date + 'T00:00:00').getTime() > cutoff ? newest : null;
}
