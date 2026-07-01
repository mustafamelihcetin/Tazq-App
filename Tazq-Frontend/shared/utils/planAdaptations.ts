/**
 * Plan Adaptations Engine
 *
 * Her aktif plan modu için duruma göre yeni görevler üretir.
 * Çıktılar: TaskService.createTask ile oluşturulacak görev listesi.
 *
 * Kural: Her adaptasyon yalnızca 7 günde bir aynı "tip"ten görev üretebilir
 * (duplicate önleme için mevcut görev listesi kontrol edilir).
 */

import { CreateTaskPayload } from '@/shared/services/api';
import { WeightEntry } from '@/shared/store/useSporStore';

export type Language = 'tr' | 'en';

export type SporTypeLocal = 'kilo' | 'maraton' | 'guc' | 'genel' | 'yaris';

export function detectSporTypeLocal(goalLabel: string): SporTypeLocal {
  if (goalLabel.includes('Kilo') || goalLabel.includes('Weight')) return 'kilo';
  if (goalLabel.includes('Maraton') || goalLabel.includes('Marathon') || goalLabel.includes('Koşu') || goalLabel.includes('Running')) return 'maraton';
  if (goalLabel.includes('Güç') || goalLabel.includes('Strength') || goalLabel.includes('Kas') || goalLabel.includes('Muscle')) return 'guc';
  if (goalLabel.includes('Yarışma') || goalLabel.includes('Competition')) return 'yaris';
  return 'genel';
}

// ─── Tarih yardımcıları ─────────────────────────────────────────────────────

export function daysUntil(dateStr: string): number {
  const adjustedNow = new Date();
  adjustedNow.setHours(adjustedNow.getHours() - 3);
  adjustedNow.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((d.getTime() - adjustedNow.getTime()) / 86400000));
}

export function daysAgo(dateStr: string): number {
  const adjustedNow = new Date();
  adjustedNow.setHours(adjustedNow.getHours() - 3);
  adjustedNow.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((adjustedNow.getTime() - d.getTime()) / 86400000);
}

function daysFromNow(n: number): string {
  const adjusted = new Date();
  adjusted.setHours(adjusted.getHours() - 3);
  adjusted.setDate(adjusted.getDate() + n);
  const y = adjusted.getFullYear();
  const m = String(adjusted.getMonth() + 1).padStart(2, '0');
  const day = String(adjusted.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Mevcut task listesinde tag ve başlık benzerliğine göre duplicate var mı? */
export function hasDuplicateAdaptation(
  tasks: { title: string; tags?: string[] | null; isCompleted: boolean; dueDate?: string | null }[],
  tag: string,
): boolean {
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  return tasks.some(t =>
    !t.isCompleted &&
    (t.tags ?? []).includes(tag) &&
    t.dueDate && new Date(t.dueDate) > threeDaysAgo
  );
}

// ─── KILO MODU ─────────────────────────────────────────────────────────────

export interface KiloAnalysis {
  actualRatePerWeek: number;    // kg/week (negative = losing)
  targetRatePerWeek: number;    // kg/week (negative = losing)
  status: 'on_track' | 'behind' | 'ahead' | 'gaining_while_losing' | 'not_enough_data';
  weeksElapsed: number;
  totalLost: number;            // negative = gained
  progressPct: number;          // 0–100
}

export function analyzeKiloProgress(
  weightLog: WeightEntry[],
  startWeight: number,
  targetWeight: number,
): KiloAnalysis {
  if (weightLog.length < 2) {
    return { actualRatePerWeek: 0, targetRatePerWeek: 0, status: 'not_enough_data', weeksElapsed: 0, totalLost: 0, progressPct: 0 };
  }

  const sorted = [...weightLog].sort((a, b) => a.date.localeCompare(b.date));
  const oldest = sorted[0];
  const newest = sorted[sorted.length - 1];
  const daysDiff = daysAgo(oldest.date) - daysAgo(newest.date);
  const weeksElapsed = Math.max(daysDiff / 7, 0.14);

  const totalChange = newest.weight - oldest.weight; // negative = lost
  const actualRatePerWeek = totalChange / weeksElapsed;

  const totalNeeded = targetWeight - startWeight; // negative = need to lose
  const totalWeeksNeeded = Math.abs(totalNeeded) / (totalNeeded < 0 ? 0.5 : 0.25);
  const targetRatePerWeek = totalNeeded / totalWeeksNeeded;

  const totalLost = startWeight - newest.weight; // positive = lost, negative = gained
  const totalGoal = Math.abs(startWeight - targetWeight);
  const progressPct = totalGoal > 0 ? Math.min(100, (Math.abs(totalLost) / totalGoal) * 100) : 0;

  const losing = targetWeight < startWeight;
  let status: KiloAnalysis['status'] = 'on_track';

  // Mutlak değer üzerinden karşılaştır — negatif işaret kafa karıştırmasın
  const absActual = Math.abs(actualRatePerWeek);
  const absTarget = Math.abs(targetRatePerWeek);

  if (losing) {
    if (totalLost < 0) {
      status = 'gaining_while_losing';
    } else if (absActual < absTarget * 0.65) {
      status = 'behind'; // hedefin %65'inden yavaş kaybediyor
    } else if (absActual > absTarget * 1.4) {
      status = 'ahead'; // hedefin %140'ından hızlı kaybediyor (çok agresif)
    }
  } else {
    if (absActual < absTarget * 0.5) {
      status = 'behind';
    } else if (absActual > absTarget * 1.5) {
      status = 'ahead';
    }
  }

  return { actualRatePerWeek, targetRatePerWeek, status, weeksElapsed, totalLost, progressPct };
}

export function buildKiloAdaptationTasks(
  analysis: KiloAnalysis,
  currentWeight: number,
  targetWeight: number,
  existingTasks: { title: string; tags?: string[] | null; isCompleted: boolean; dueDate?: string | null }[],
  lang: Language,
): CreateTaskPayload[] {
  const tasks: CreateTaskPayload[] = [];
  const tr = lang === 'tr';
  const losing = targetWeight < currentWeight;

  // weight_entry zamanlaması WeightEntryModal tarafından yönetiliyor, burada üretilmiyor.

  if (analysis.status === 'not_enough_data') return tasks;

  // Durum bazlı aksiyon görevi
  if (!hasDuplicateAdaptation(existingTasks, 'kilo_adapt')) {
    if (analysis.status === 'gaining_while_losing') {
      tasks.push({
        title: tr
          ? `Kilo artıyor! 3 günlük yemek günlüğü tut ve kalori hesapla`
          : `Weight is going up! Keep a 3-day food diary and count calories`,
        description: '',
        priority: 'High',
        dueDate: daysFromNow(1),
        isCompleted: false,
        tags: ['kilo_adapt'],
      });
    } else if (analysis.status === 'behind') {
      const rateStr = Math.abs(analysis.actualRatePerWeek).toFixed(1);
      tasks.push({
        title: tr
          ? `İlerleme yavaş (~${rateStr} kg/hafta). Bu hafta 1 antrenman ekle + şeker ve işlenmiş gıdaları azalt`
          : `Progress is slow (~${rateStr} kg/week). Add 1 workout + cut sugar and processed foods`,
        description: '',
        priority: 'High',
        dueDate: daysFromNow(2),
        isCompleted: false,
        tags: ['kilo_adapt'],
      });
    } else if (analysis.status === 'ahead' && losing) {
      tasks.push({
        title: tr
          ? `Çok hızlı gidiyor — kas kaybını önle: protein hedefini kontrol et (vücut ağırlığı × 2g/kg)`
          : `Going too fast — prevent muscle loss: check protein target (bodyweight × 2g/kg)`,
        description: '',
        priority: 'Medium',
        dueDate: daysFromNow(2),
        isCompleted: false,
        tags: ['kilo_adapt'],
      });
    }
  }

  // Her 2. hafta tartı hatırlatması
  const week = Math.floor(analysis.weeksElapsed);
  if (week > 0 && week % 2 === 0 && !hasDuplicateAdaptation(existingTasks, 'weight_entry')) {
    tasks.push({
      title: tr
        ? `Hafta ${week} tartısı — sabah aç karna`
        : `Week ${week} weigh-in — fasted morning`,
      description: '',
      priority: 'High',
      dueDate: daysFromNow(0),
      isCompleted: false,
      tags: ['weight_entry'],
    });
  }

  // Her 4. hafta vücut ölçüsü hatırlatması
  if (week > 0 && week % 4 === 0 && !hasDuplicateAdaptation(existingTasks, 'kilo_measure')) {
    tasks.push({
      title: tr
        ? `${week}. hafta: bel çevresi + vücut ağırlığını kaydet — aynadaki değişim kilo kadar önemli`
        : `Week ${week}: record waist circumference + weight — mirror changes matter as much as the scale`,
      description: '',
      priority: 'Medium',
      dueDate: daysFromNow(1),
      isCompleted: false,
      tags: ['kilo_measure'],
    });
  }

  return tasks;
}

// ─── MARATON MODU ─────────────────────────────────────────────────────────

const PEAK_KM: Record<string, number> = { '5K': 30, '10K': 50, 'Yarı': 65, 'Tam': 80 };
const MIN_WEEKS: Record<string, number> = { '5K': 6, '10K': 8, 'Yarı': 12, 'Tam': 16 };

export function buildMaratonAdaptationTasks(
  weeklyKm: number,
  targetEvent: string,
  daysToRace: number,
  weeksInPlan: number,
  habitCompletionRate: number, // 0–1, this week
  existingTasks: { title: string; tags?: string[] | null; isCompleted: boolean; dueDate?: string | null }[],
  lang: Language,
): CreateTaskPayload[] {
  const tasks: CreateTaskPayload[] = [];
  const tr = lang === 'tr';
  const peak = PEAK_KM[targetEvent] ?? 50;
  const weeksLeft = Math.ceil(daysToRace / 7);
  const minWeeks = MIN_WEEKS[targetEvent] ?? 8;

  // Taper: yarışmaya 3 hafta kala
  if (daysToRace <= 21 && daysToRace > 0 && !hasDuplicateAdaptation(existingTasks, 'maraton_taper')) {
    tasks.push({
      title: tr
        ? `TAPER BAŞLADI (${weeksLeft} hafta kaldı): Haftalık km'yi %20 azalt — ${Math.round(weeklyKm * 0.8)} km hedef`
        : `TAPER BEGINS (${weeksLeft} weeks left): Reduce weekly km by 20% — target ${Math.round(weeklyKm * 0.8)} km`,
      description: '',
      priority: 'High',
      dueDate: daysFromNow(1),
      isCompleted: false,
      tags: ['maraton_taper'],
    });
  }

  // Yarış günü hazırlık: 1 hafta kala
  if (daysToRace <= 7 && daysToRace > 0 && !hasDuplicateAdaptation(existingTasks, 'maraton_race_week')) {
    tasks.push({
      title: tr
        ? `Yarış haftası: kıyafet + beslenme + rota + start zamanını planla`
        : `Race week: plan outfit + nutrition + route + start time`,
      description: '',
      priority: 'High',
      dueDate: daysFromNow(1),
      isCompleted: false,
      tags: ['maraton_race_week'],
    });
    // Karbonhidrat yüklemesi sadece half/tam maraton için anlamlı
    if (targetEvent === 'Yarı' || targetEvent === 'Tam') {
      tasks.push({
        title: tr
          ? `Son 3 gün: karbonhidrat yüklemesi — her öğünde pilav/makarna/ekmek ağırlıklı beslen`
          : `Last 3 days: carb loading — make rice/pasta/bread the base of every meal`,
        description: '',
        priority: 'Medium',
        dueDate: daysFromNow(2),
        isCompleted: false,
        tags: ['maraton_race_week'],
      });
    }
  }

  // Yetersiz hazırlık süresi uyarısı
  if (weeksLeft < minWeeks && !hasDuplicateAdaptation(existingTasks, 'maraton_warn')) {
    tasks.push({
      title: tr
        ? `⚠️ ${targetEvent} için ${minWeeks} hafta gerekiyor, ${weeksLeft} haftan var — hedefi gözden geçir`
        : `⚠️ ${targetEvent} requires ${minWeeks} weeks, you have ${weeksLeft} — reconsider goal`,
      description: '',
      priority: 'High',
      dueDate: daysFromNow(1),
      isCompleted: false,
      tags: ['maraton_warn'],
    });
  }

  // Haftalık ilerleme: düşük tamamlama oranı
  if (habitCompletionRate < 0.5 && !hasDuplicateAdaptation(existingTasks, 'maraton_missed')) {
    tasks.push({
      title: tr
        ? `Bu haftaki koşu eksik! Haftayı aynı km ile tekrarla — üste çıkma`
        : `Missed runs this week! Repeat the same km next week — don't push further`,
      description: '',
      priority: 'High',
      dueDate: daysFromNow(1),
      isCompleted: false,
      tags: ['maraton_missed'],
    });
  } else if (habitCompletionRate >= 0.8 && weeklyKm < peak && !hasDuplicateAdaptation(existingTasks, 'maraton_progress')) {
    const nextKm = Math.min(Math.round(weeklyKm * 1.1), peak);
    tasks.push({
      title: tr
        ? `Harika hafta! Gelecek hafta hedef: ${nextKm} km/hafta (+10% kural)`
        : `Great week! Next week target: ${nextKm} km/week (+10% rule)`,
      description: '',
      priority: 'Medium',
      dueDate: daysFromNow(1),
      isCompleted: false,
      tags: ['maraton_progress'],
    });
  }

  return tasks;
}

// ─── SINAV MODU ──────────────────────────────────────────────────────────

export function buildSinavAdaptationTasks(
  examName: string,
  daysLeft: number,
  existingTasks: { title: string; tags?: string[] | null; isCompleted: boolean; dueDate?: string | null }[],
  lang: Language,
): CreateTaskPayload[] {
  const tasks: CreateTaskPayload[] = [];
  const tr = lang === 'tr';
  const name = examName || (tr ? 'Sınav' : 'Exam');

  if (daysLeft <= 1 && daysLeft >= 0 && !hasDuplicateAdaptation(existingTasks, 'sinav_eve')) {
    const timing = daysLeft === 0
      ? (tr ? 'Bugün' : 'Today')
      : (tr ? 'Yarın' : 'Tomorrow');
    tasks.push({
      title: tr
        ? `${name} ${timing === 'Bugün' ? 'bugün' : 'yarın'}! Erken uyu (22:00), kalem + kimlik + su hazırla`
        : `${name} is ${timing.toLowerCase()}! Sleep early (10pm), prepare pen + ID + water`,
      description: '',
      priority: 'High',
      dueDate: daysFromNow(0),
      isCompleted: false,
      tags: ['sinav_eve'],
    });
  }

  if (daysLeft <= 7 && daysLeft > 1 && !hasDuplicateAdaptation(existingTasks, 'sinav_week')) {
    tasks.push({
      title: tr
        ? `${name} son ${daysLeft} gün: yeni konu yok — sadece deneme + hata analizi`
        : `${name}: ${daysLeft} days left — no new topics, only mock exams + error review`,
      description: '',
      priority: 'High',
      dueDate: daysFromNow(0),
      isCompleted: false,
      tags: ['sinav_week'],
    });
    tasks.push({
      title: tr
        ? `Sınav yeri ve saatini teyit et, ulaşım planını yap`
        : `Confirm exam location & time, plan your route`,
      description: '',
      priority: 'High',
      dueDate: daysFromNow(1),
      isCompleted: false,
      tags: ['sinav_week'],
    });
  }

  if (daysLeft <= 30 && daysLeft > 7 && !hasDuplicateAdaptation(existingTasks, 'sinav_sprint_start')) {
    tasks.push({
      title: tr
        ? `${name} ${daysLeft} gün — sprint başlıyor: tüm zayıf konuları listele`
        : `${name} in ${daysLeft} days — sprint starts: list all weak topics`,
      description: '',
      priority: 'High',
      dueDate: daysFromNow(1),
      isCompleted: false,
      tags: ['sinav_sprint_start'],
    });
    tasks.push({
      title: tr
        ? `Bu hafta 2 deneme sınavı çöz ve cevap anahtarıyla karşılaştır`
        : `Solve 2 practice exams this week and compare with answer keys`,
      description: '',
      priority: 'High',
      dueDate: daysFromNow(3),
      isCompleted: false,
      tags: ['sinav_sprint_start'],
    });
  }

  if (daysLeft <= 60 && daysLeft > 30 && !hasDuplicateAdaptation(existingTasks, 'sinav_60')) {
    tasks.push({
      title: tr
        ? `${name} 60 gün — tüm konuları taradın mı? Eksik topikleri listele`
        : `${name} in 60 days — have you covered all topics? List missing ones`,
      description: '',
      priority: 'Medium',
      dueDate: daysFromNow(2),
      isCompleted: false,
      tags: ['sinav_60'],
    });
  }

  return tasks;
}

// ─── TEZ / PROJE MODU ───────────────────────────────────────────────────

export function buildTezAdaptationTasks(
  tezName: string,
  daysLeft: number,
  existingTasks: { title: string; tags?: string[] | null; isCompleted: boolean; dueDate?: string | null }[],
  lang: Language,
): CreateTaskPayload[] {
  const tasks: CreateTaskPayload[] = [];
  const tr = lang === 'tr';
  const name = tezName || (tr ? 'Tez/Proje' : 'Thesis/Project');

  // Haftalık ilerleme değerlendirmesi: bu haftadan bir tez_weekly görevi yoksa oluştur
  // (Pazartesi'ye bağlı değil — o gün app açılmamışsa görev hiç oluşmaz)
  const now = new Date();
  const mon = new Date(now);
  mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  mon.setHours(0, 0, 0, 0);
  const thisWeekHasWeekly = existingTasks.some(t =>
    !t.isCompleted &&
    (t.tags ?? []).includes('tez_weekly') &&
    new Date(t.dueDate ?? 0) >= mon
  );
  if (!thisWeekHasWeekly) {
    tasks.push({
      title: tr
        ? `${name}: bu hafta ne tamamladın? İlerlemeyi kaydet`
        : `${name}: what did you complete this week? Record progress`,
      description: '',
      priority: 'Medium',
      dueDate: daysFromNow(0),
      isCompleted: false,
      tags: ['tez_weekly'],
    });
  }

  if (daysLeft <= 14 && !hasDuplicateAdaptation(existingTasks, 'tez_final_2weeks')) {
    tasks.push({
      title: tr
        ? `${name} son 2 hafta: format kontrol listesini çalıştır (dipnot, kaynakça, sayfa numarası)`
        : `${name} final 2 weeks: run format checklist (footnotes, bibliography, page numbers)`,
      description: '',
      priority: 'High',
      dueDate: daysFromNow(1),
      isCompleted: false,
      tags: ['tez_final_2weeks'],
    });
    tasks.push({
      title: tr
        ? `Danışmana/yöneticiye final taslağı gönder ve onay al`
        : `Send final draft to advisor/manager and get approval`,
      description: '',
      priority: 'High',
      dueDate: daysFromNow(2),
      isCompleted: false,
      tags: ['tez_final_2weeks'],
    });
  }

  if (daysLeft <= 30 && daysLeft > 14 && !hasDuplicateAdaptation(existingTasks, 'tez_sprint_30')) {
    tasks.push({
      title: tr
        ? `${name} ${daysLeft} gün — bugün tamamlanma yüzdesini hesapla ve eksik bölümleri listele`
        : `${name} in ${daysLeft} days — calculate completion % today and list missing sections`,
      description: '',
      priority: 'High',
      dueDate: daysFromNow(1),
      isCompleted: false,
      tags: ['tez_sprint_30'],
    });
  }

  if (daysLeft <= 60 && daysLeft > 30 && !hasDuplicateAdaptation(existingTasks, 'tez_60')) {
    tasks.push({
      title: tr
        ? `60 Gün Sprint Modu: her bölüm için teslim tarihi belirle`
        : `60-Day Sprint Mode: set a due date for each section`,
      description: '',
      priority: 'High',
      dueDate: daysFromNow(2),
      isCompleted: false,
      tags: ['tez_60'],
    });
  }

  return tasks;
}

// ─── MÜLAKAT MODU ───────────────────────────────────────────────────────

export function buildMulakatAdaptationTasks(
  company: string,
  daysLeft: number,
  existingTasks: { title: string; tags?: string[] | null; isCompleted: boolean; dueDate?: string | null }[],
  lang: Language,
): CreateTaskPayload[] {
  const tasks: CreateTaskPayload[] = [];
  const tr = lang === 'tr';
  const name = company || (tr ? 'Mülakat' : 'Interview');

  if (daysLeft === 0 && !hasDuplicateAdaptation(existingTasks, 'mulakat_day')) {
    tasks.push({
      title: tr
        ? `Bugün ${name}! Derin nefes al — hazırsın, güven kendine 💪`
        : `Today is ${name}! Deep breath — you're ready, trust yourself 💪`,
      description: '',
      priority: 'High',
      dueDate: daysFromNow(0),
      isCompleted: false,
      tags: ['mulakat_day'],
    });
    return tasks; // geçmiş tarih için başka görev ekleme
  }

  if (daysLeft < 0) return tasks; // tarih geçmiş

  if (daysLeft <= 1 && !hasDuplicateAdaptation(existingTasks, 'mulakat_eve')) {
    tasks.push({
      title: tr
        ? `${name} yarın: kıyafet + rota + alarm hazır mı? 8 saat uyu`
        : `${name} tomorrow: outfit + route + alarm ready? Sleep 8 hours`,
      description: '',
      priority: 'High',
      dueDate: daysFromNow(0),
      isCompleted: false,
      tags: ['mulakat_eve'],
    });
    tasks.push({
      title: tr
        ? `3 güçlü STAR hikayeni sesli anlat ve 2 dakikada bitir`
        : `Tell your 3 strongest STAR stories out loud and finish in 2 minutes`,
      description: '',
      priority: 'High',
      dueDate: daysFromNow(0),
      isCompleted: false,
      tags: ['mulakat_eve'],
    });
  }

  if (daysLeft <= 3 && daysLeft > 1 && !hasDuplicateAdaptation(existingTasks, 'mulakat_3days')) {
    tasks.push({
      title: tr
        ? `${name}: son haberler, ürünler ve kültür — 30 dk araştır`
        : `${name}: latest news, products & culture — research 30 min`,
      description: '',
      priority: 'High',
      dueDate: daysFromNow(0),
      isCompleted: false,
      tags: ['mulakat_3days'],
    });
    tasks.push({
      title: tr
        ? `Mock mülakat yap — kaydet ve geri izle (video/ses)`
        : `Do a mock interview — record and review (video/audio)`,
      description: '',
      priority: 'High',
      dueDate: daysFromNow(1),
      isCompleted: false,
      tags: ['mulakat_3days'],
    });
  }

  if (daysLeft <= 7 && daysLeft > 3 && !hasDuplicateAdaptation(existingTasks, 'mulakat_week')) {
    tasks.push({
      title: tr
        ? `${name} ${daysLeft} gün — "Neden bu şirket?" ve "Neden sen?" sorularını yaz`
        : `${name} in ${daysLeft} days — write "Why this company?" and "Why you?"`,
      description: '',
      priority: 'High',
      dueDate: daysFromNow(1),
      isCompleted: false,
      tags: ['mulakat_week'],
    });
    tasks.push({
      title: tr
        ? `Teknik/case konuları için odaklı 2 saatlik çalışma bloğu planla`
        : `Plan a focused 2-hour study block for technical/case topics`,
      description: '',
      priority: 'Medium',
      dueDate: daysFromNow(2),
      isCompleted: false,
      tags: ['mulakat_week'],
    });
  }

  if (daysLeft <= 14 && daysLeft > 7 && !hasDuplicateAdaptation(existingTasks, 'mulakat_2weeks')) {
    tasks.push({
      title: tr
        ? `${name}: CV'ni şirkete göre uyarla — ilgisiz maddeleri çıkar`
        : `${name}: tailor your CV to the company — remove irrelevant items`,
      description: '',
      priority: 'Medium',
      dueDate: daysFromNow(3),
      isCompleted: false,
      tags: ['mulakat_2weeks'],
    });
  }

  return tasks;
}

// ─── GÜÇ / KAS MODU ─────────────────────────────────────────────────────

export function buildGucAdaptationTasks(
  weeksInPlan: number,
  trainingDays: number,
  existingTasks: { title: string; tags?: string[] | null; isCompleted: boolean; dueDate?: string | null }[],
  lang: Language,
): CreateTaskPayload[] {
  const tasks: CreateTaskPayload[] = [];
  const tr = lang === 'tr';

  // Her 4 haftada bir deload haftası
  if (weeksInPlan > 0 && weeksInPlan % 4 === 0 && !hasDuplicateAdaptation(existingTasks, 'guc_deload')) {
    tasks.push({
      title: tr
        ? `${weeksInPlan}. hafta — DELOAD: ağırlıkları %40 azalt, aynı set/tekrar; kaslar büyür, sakatlanma riski düşer`
        : `Week ${weeksInPlan} — DELOAD: reduce weights by 40%, same sets/reps; muscles grow, injury risk drops`,
      description: '',
      priority: 'High',
      dueDate: daysFromNow(0),
      isCompleted: false,
      tags: ['guc_deload'],
    });
  }

  // Her 2 haftada bir ilerleme logu hatırlatması
  if (weeksInPlan > 0 && weeksInPlan % 2 === 0 && !hasDuplicateAdaptation(existingTasks, 'guc_progress')) {
    tasks.push({
      title: tr
        ? `2 Haftalık İlerleme: Temel hareketlerinde geçen seferden fazla ağırlık/tekrar yapabiliyor musun? Kaydet`
        : `2-Week Check: Can you lift more weight or do more reps than 2 weeks ago? Record it`,
      description: '',
      priority: 'Medium',
      dueDate: daysFromNow(0),
      isCompleted: false,
      tags: ['guc_progress'],
    });
  }

  return tasks;
}

// ─── RAMAZAN MODU ────────────────────────────────────────────────────────

export function buildRamazanAdaptationTasks(
  daysLeft: number,
  existingTasks: { title: string; tags?: string[] | null; isCompleted: boolean; dueDate?: string | null }[],
  lang: Language,
): CreateTaskPayload[] {
  const tasks: CreateTaskPayload[] = [];
  const tr = lang === 'tr';

  if (daysLeft <= 5 && daysLeft >= 0 && !hasDuplicateAdaptation(existingTasks, 'ramazan_kadir')) {
    tasks.push({
      title: tr
        ? `Kadir Gecesi yaklaşıyor — son 10 gece ibadet programı yap`
        : `Laylat al-Qadr approaching — plan worship schedule for last 10 nights`,
      description: '',
      priority: 'High',
      dueDate: daysFromNow(0),
      isCompleted: false,
      tags: ['ramazan_kadir'],
    });
  }

  return tasks;
}
