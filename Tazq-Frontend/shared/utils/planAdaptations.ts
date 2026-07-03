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
  lookbackDays = 3,
  ignoreCompletion = false,
): boolean {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - lookbackDays);
  return tasks.some(t =>
    (ignoreCompletion ? true : !t.isCompleted) &&
    (t.tags ?? []).includes(tag) &&
    t.dueDate && new Date(t.dueDate) > cutoff
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
  if (!hasDuplicateAdaptation(existingTasks, 'kilo_adapt', 7, true)) {
    if (analysis.status === 'gaining_while_losing') {
      tasks.push({
        title: tr ? `Kilo artışı: Yemek günlüğü` : `Weight gain: Food diary`,
        description: JSON.stringify({ 
          tr: `Kilo artışı: Yemek günlüğü`, 
          en: `Weight gain: Food diary`,
          descTr: `Kilo artışı tespit edildi! Lütfen 3 günlük yemek günlüğü tutun ve günlük kalorilerinizi hesaplayın.`,
          descEn: `Weight gain detected! Please keep a 3-day food diary and calculate your daily calories.`
        }),
        priority: 'High',
        dueDate: daysFromNow(1),
        isCompleted: false,
        tags: ['kilo_adapt', 'fitness'],
      });
    } else if (analysis.status === 'behind') {
      const rateStr = Math.abs(analysis.actualRatePerWeek).toFixed(1);
      tasks.push({
        title: tr ? `Kilo kontrolü: İlerleme yavaş` : `Weight loss: Slow progress`,
        description: JSON.stringify({ 
          tr: `Kilo kontrolü: İlerleme yavaş`, 
          en: `Weight loss: Slow progress`,
          descTr: `İlerleme yavaş (~${rateStr} kg/hafta). Bu hafta programınıza 1 antrenman daha ekleyin; şeker ve işlenmiş gıdaları azaltın.`,
          descEn: `Progress is slow (~${rateStr} kg/week). Add 1 workout this week and reduce sugar and processed foods.`
        }),
        priority: 'High',
        dueDate: daysFromNow(2),
        isCompleted: false,
        tags: ['kilo_adapt', 'fitness'],
      });
    } else if (analysis.status === 'ahead' && losing) {
      tasks.push({
        title: tr ? `Kas kaybını önleme kontrolü` : `Prevent muscle loss check`,
        description: JSON.stringify({ 
          tr: `Kas kaybını önleme kontrolü`, 
          en: `Prevent muscle loss check`,
          descTr: `Kilo kaybı çok hızlı gidiyor! Kas kaybını önlemek için protein hedefinizi kontrol edin (vücut ağırlığı × 2g/kg protein tüketin).`,
          descEn: `Weight loss is too fast! To prevent muscle loss, check your protein target (aim for bodyweight × 2g/kg).`
        }),
        priority: 'Medium',
        dueDate: daysFromNow(2),
        isCompleted: false,
        tags: ['kilo_adapt', 'fitness'],
      });
    }
  }

  // Her 2. hafta tartı hatırlatması
  const week = Math.floor(analysis.weeksElapsed);
  if (week > 0 && week % 2 === 0 && !hasDuplicateAdaptation(existingTasks, 'weight_entry', 7, true)) {
    tasks.push({
      title: tr ? `Haftalık tartım zamanı` : `Weekly weigh-in time`,
      description: JSON.stringify({ 
        tr: `Haftalık tartım zamanı`, 
        en: `Weekly weigh-in time`,
        descTr: `Hafta ${week} tartısı: Sabah aç karna tartılın ve güncel kilonuzu sisteme kaydedin.`,
        descEn: `Week ${week} weigh-in: Weigh yourself in the morning fasted and log your weight.`
      }),
      priority: 'High',
      dueDate: daysFromNow(0),
      isCompleted: false,
      tags: ['weight_entry'],
    });
  }

  // Her 4. hafta vücut ölçüsü hatırlatması
  if (week > 0 && week % 4 === 0 && !hasDuplicateAdaptation(existingTasks, 'kilo_measure', 7, true)) {
    tasks.push({
      title: tr ? `${week}. hafta: Bel ölçüsü` : `Week ${week}: Waist measurement`,
      description: JSON.stringify({ 
        tr: `${week}. hafta: Bel ölçüsü`, 
        en: `Week ${week}: Waist measurement`,
        descTr: `${week}. hafta değerlendirmesi: Bel çevrenizi ölçün ve vücut ağırlığınızı kaydedin. Aynadaki görsel değişim tartıdaki rakam kadar önemlidir.`,
        descEn: `Week ${week} review: Record waist circumference and body weight. Changes in the mirror matter as much as the scale.`
      }),
      priority: 'Medium',
      dueDate: daysFromNow(1),
      isCompleted: false,
      tags: ['kilo_measure', 'fitness'],
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
  if (daysToRace <= 21 && daysToRace > 0 && !hasDuplicateAdaptation(existingTasks, 'maraton_taper', 21, true)) {
    tasks.push({
      title: tr ? `Taper başladı: Mesafe azaltımı` : `Taper begins: Reduce volume`,
      description: JSON.stringify({ 
        tr: `Taper başladı: Mesafe azaltımı`, 
        en: `Taper begins: Reduce volume`,
        descTr: `Taper dönemi başladı (${weeksLeft} hafta kaldı). Sakatlanmayı önlemek ve dinlenmek için haftalık km hedefinizi %20 azaltın (Yeni hedef: ${Math.round(weeklyKm * 0.8)} km).`,
        descEn: `Taper begins (${weeksLeft} weeks left). Reduce weekly distance by 20% to prevent injury and rest (New target: ${Math.round(weeklyKm * 0.8)} km).`
      }),
      priority: 'High',
      dueDate: daysFromNow(1),
      isCompleted: false,
      tags: ['maraton_taper', 'fitness'],
    });
  }

  // Yarış günü hazırlık: 1 hafta kala
  if (daysToRace <= 7 && daysToRace > 0 && !hasDuplicateAdaptation(existingTasks, 'maraton_race_week', 7, true)) {
    tasks.push({
      title: tr ? `Yarış haftası planlaması` : `Race week planning`,
      description: JSON.stringify({ 
        tr: `Yarış haftası planlaması`, 
        en: `Race week planning`,
        descTr: `Büyük gün yaklaşıyor! Yarış günü giyeceğiniz kıyafetleri, beslenme planınızı, rotayı ve start zamanını netleştirin.`,
        descEn: `Race day is coming! Plan your race outfit, nutrition strategy, map route, and check start time.`
      }),
      priority: 'High',
      dueDate: daysFromNow(1),
      isCompleted: false,
      tags: ['maraton_race_week', 'fitness'],
    });
    // Karbonhidrat yüklemesi sadece half/tam maraton için anlamlı
    if (targetEvent === 'Yarı' || targetEvent === 'Tam') {
      tasks.push({
        title: tr ? `Son 3 gün: Karbonhidrat yüklemesi` : `Last 3 days: Carb loading`,
        description: JSON.stringify({ 
          tr: `Son 3 gün: Karbonhidrat yüklemesi`, 
          en: `Last 3 days: Carb loading`,
          descTr: `Yarışa son 3 gün kaldı! Kas glikojen depolarınızı doldurmak için her öğünde pilav, makarna veya ekmek ağırlıklı beslenin.`,
          descEn: `Last 3 days of preparation! Focus on eating quality carbs like rice, pasta, or bread to load glycogen stores.`
        }),
        priority: 'Medium',
        dueDate: daysFromNow(2),
        isCompleted: false,
        tags: ['maraton_race_week', 'fitness'],
      });
    }
  }

  // Yetersiz hazırlık süresi uyarısı
  if (weeksLeft < minWeeks && !hasDuplicateAdaptation(existingTasks, 'maraton_warn', 30, true)) {
    tasks.push({
      title: tr ? `Hazırlık süresi yetersiz` : `Insufficient preparation time`,
      description: JSON.stringify({ 
        tr: `Hazırlık süresi yetersiz`, 
        en: `Insufficient preparation time`,
        descTr: `⚠️ Seçilen ${targetEvent} hedefi için ideal olarak en az ${minWeeks} hafta hazırlanmak gerekir. Sizin yarışa ${weeksLeft} haftanız var. Sakatlanma riskini azaltmak için hedefinizi gözden geçirebilirsiniz.`,
        descEn: `⚠️ ${targetEvent} ideally requires at least ${minWeeks} weeks of base building. You only have ${weeksLeft} weeks. Reconsider your target to prevent injury.`
      }),
      priority: 'High',
      dueDate: daysFromNow(1),
      isCompleted: false,
      tags: ['maraton_warn', 'fitness'],
    });
  }

  // Haftalık ilerleme: düşük tamamlama oranı
  if (habitCompletionRate < 0.5 && !hasDuplicateAdaptation(existingTasks, 'maraton_missed', 7, true)) {
    tasks.push({
      title: tr ? `Koşu haftasını tekrar et` : `Repeat running week`,
      description: JSON.stringify({ 
        tr: `Koşu haftasını tekrar et`, 
        en: `Repeat running week`,
        descTr: `Bu haftaki koşu hedefiniz eksik kaldı. Formunuzu korumak için önümüzdeki haftayı aynı kilometre hedefiyle tekrarlayın, hacmi artırmayın.`,
        descEn: `You missed your run goals this week. Repeat the same weekly distance next week without pushing further to protect your joints.`
      }),
      priority: 'High',
      dueDate: daysFromNow(1),
      isCompleted: false,
      tags: ['maraton_missed', 'fitness'],
    });
  } else if (habitCompletionRate >= 0.8 && weeklyKm < peak && !hasDuplicateAdaptation(existingTasks, 'maraton_progress', 7, true)) {
    const nextKm = Math.min(Math.round(weeklyKm * 1.1), peak);
    tasks.push({
      title: tr ? `Antrenman hacmini artır` : `Increase training volume`,
      description: JSON.stringify({ 
        tr: `Antrenman hacmini artır`, 
        en: `Increase training volume`,
        descTr: `Harika bir hafta geçirdiniz! Gelecek haftaki mesafenizi %10 artırın (Yeni hedef: ${nextKm} km/hafta).`,
        descEn: `Excellent week! Increase your weekly volume by 10% next week (New target: ${nextKm} km/week).`
      }),
      priority: 'Medium',
      dueDate: daysFromNow(1),
      isCompleted: false,
      tags: ['maraton_progress', 'fitness'],
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

  if (daysLeft <= 1 && daysLeft >= 0 && !hasDuplicateAdaptation(existingTasks, 'sinav_eve', 7, true)) {
    const timing = daysLeft === 0
      ? (tr ? 'Bugün' : 'Today')
      : (tr ? 'Yarın' : 'Tomorrow');
    tasks.push({
      title: tr ? `${name} hazırlıklarını tamamla` : `Complete prep for ${name}`,
      description: JSON.stringify({ 
        tr: `${name} hazırlıklarını tamamla`, 
        en: `Complete prep for ${name}`,
        descTr: `${name} ${timing === 'Bugün' ? 'bugün' : 'yarın'}! Erken uyuyun (22:00), sınav kalemi, kimlik ve suyunuzu şimdiden hazırlayın.`,
        descEn: `${name} is ${timing.toLowerCase()}! Sleep early (10pm), and prepare your exam pen, ID, and water now.`
      }),
      priority: 'High',
      dueDate: daysFromNow(0),
      isCompleted: false,
      tags: ['sinav_eve', 'education'],
    });
  }

  if (daysLeft <= 7 && daysLeft > 1 && !hasDuplicateAdaptation(existingTasks, 'sinav_week', 7, true)) {
    tasks.push({
      title: tr ? `Yeni konu açma: Deneme çöz` : `No new topics: Solve mocks`,
      description: JSON.stringify({ 
        tr: `Yeni konu açma: Deneme çöz`, 
        en: `No new topics: Solve mocks`,
        descTr: `${name} için son ${daysLeft} gün kaldı. Yeni bir konu çalışmayın, sadece deneme sınavı çözün ve hata analizlerini yapın.`,
        descEn: `${name}: ${daysLeft} days left. Do not start any new study topics; only solve practice exams and review errors.`
      }),
      priority: 'High',
      dueDate: daysFromNow(0),
      isCompleted: false,
      tags: ['sinav_week', 'education'],
    });
    tasks.push({
      title: tr ? `Sınav yerini teyit et ve yol planı yap` : `Confirm exam location & plan route`,
      description: JSON.stringify({ 
        tr: `Sınav yerini teyit et ve yol planı yap`, 
        en: `Confirm exam location & plan route`,
        descTr: `Sınav giriş belgenizden yer ve saati netleştirin. Sınav sabahı gecikmemek için ulaşım planınızı bugünden yapın.`,
        descEn: `Check your exam entrance document to confirm location and time. Plan your commute route in advance.`
      }),
      priority: 'High',
      dueDate: daysFromNow(1),
      isCompleted: false,
      tags: ['sinav_week', 'education'],
    });
  }

  if (daysLeft <= 30 && daysLeft > 7 && !hasDuplicateAdaptation(existingTasks, 'sinav_sprint_start', 30, true)) {
    tasks.push({
      title: tr ? `Sınav sprinti: Zayıf konular` : `Exam sprint: Weak topics`,
      description: JSON.stringify({ 
        tr: `Sınav sprinti: Zayıf konular`, 
        en: `Exam sprint: Weak topics`,
        descTr: `${name} sınavına ${daysLeft} gün kaldı — sprint başlıyor: Tüm zayıf olduğunuz konuları listeleyin ve çalışma planına dahil edin.`,
        descEn: `${name} in ${daysLeft} days — sprint starts: List all your weak topics and allocate daily study slots for them.`
      }),
      priority: 'High',
      dueDate: daysFromNow(1),
      isCompleted: false,
      tags: ['sinav_sprint_start', 'education'],
    });
    tasks.push({
      title: tr ? `Bu hafta 2 deneme sınavı çöz` : `Solve 2 practice exams this week`,
      description: JSON.stringify({ 
        tr: `Bu hafta 2 deneme sınavı çöz`, 
        en: `Solve 2 practice exams this week`,
        descTr: `Bu hafta 2 adet deneme sınavı çözün ve her birinin ardından cevap anahtarıyla detaylı karşılaştırma yapın.`,
        descEn: `Solve 2 practice exams this week and compare with answer keys in detail.`
      }),
      priority: 'High',
      dueDate: daysFromNow(3),
      isCompleted: false,
      tags: ['sinav_sprint_start', 'education'],
    });
  }

  if (daysLeft <= 60 && daysLeft > 30 && !hasDuplicateAdaptation(existingTasks, 'sinav_60', 30, true)) {
    tasks.push({
      title: tr ? `Eksik konuları listele` : `List missing study topics`,
      description: JSON.stringify({ 
        tr: `Eksik konuları listele`, 
        en: `List missing study topics`,
        descTr: `${name} sınavına 60 gün kaldı. Şimdiye kadar tüm konuları taradınız mı? Eksik kalan başlıkları listeleyin.`,
        descEn: `${name} in 60 days. Have you covered the entire syllabus? List all remaining/missing topics.`
      }),
      priority: 'Medium',
      dueDate: daysFromNow(2),
      isCompleted: false,
      tags: ['sinav_60', 'education'],
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
    (t.tags ?? []).includes('tez_weekly') &&
    new Date(t.dueDate ?? 0) >= mon
  );
  if (!thisWeekHasWeekly) {
    tasks.push({
      title: tr ? `${name}: bu hafta ne tamamladın? İlerlemeyi kaydet` : `${name}: what did you complete this week? Record progress`,
      description: JSON.stringify({ tr: `${name}: bu hafta ne tamamladın? İlerlemeyi kaydet`, en: `${name}: what did you complete this week? Record progress` }),
      priority: 'Medium',
      dueDate: daysFromNow(0),
      isCompleted: false,
      tags: ['tez_weekly', 'education'],
    });
  }

  if (daysLeft <= 14 && !hasDuplicateAdaptation(existingTasks, 'tez_final_2weeks', 30, true)) {
    tasks.push({
      title: tr ? `Tez biçim kontrol listesi` : `Run thesis format checklist`,
      description: JSON.stringify({ 
        tr: `Tez biçim kontrol listesi`, 
        en: `Run thesis format checklist`,
        descTr: `${name} için son 2 hafta kaldı. Tez formatı kontrol listesini (dipnotlar, kaynakça, sayfa numaralandırması ve biçim kuralları) gözden geçirin.`,
        descEn: `${name} final 2 weeks: Run format checklist (footnotes, bibliography, margins, and page numbering).`
      }),
      priority: 'High',
      dueDate: daysFromNow(1),
      isCompleted: false,
      tags: ['tez_final_2weeks', 'education'],
    });
    tasks.push({
      title: tr ? `Final taslağını gönder ve onay al` : `Submit final draft for approval`,
      description: JSON.stringify({ 
        tr: `Final taslağını gönder ve onay al`, 
        en: `Submit final draft for approval`,
        descTr: `Final taslağınızı danışman hocanıza veya yöneticinize gönderip son onay sürecini başlatın.`,
        descEn: `Send the complete final draft of your thesis to your advisor or manager for final review and approval.`
      }),
      priority: 'High',
      dueDate: daysFromNow(2),
      isCompleted: false,
      tags: ['tez_final_2weeks', 'education'],
    });
  }

  if (daysLeft <= 30 && daysLeft > 14 && !hasDuplicateAdaptation(existingTasks, 'tez_sprint_30', 30, true)) {
    tasks.push({
      title: tr ? `Tez tamamlanma analizi` : `Thesis completion analysis`,
      description: JSON.stringify({ 
        tr: `Tez tamamlanma analizi`, 
        en: `Thesis completion analysis`,
        descTr: `${name} için son 30 gün kaldı. Bugün tezin genel tamamlanma yüzdesini hesaplayın ve eksik kalan bölümleri listeleyin.`,
        descEn: `${name} in ${daysLeft} days: Calculate the completion percentage of your thesis today and list all missing sections.`
      }),
      priority: 'High',
      dueDate: daysFromNow(1),
      isCompleted: false,
      tags: ['tez_sprint_30', 'education'],
    });
  }

  if (daysLeft <= 60 && daysLeft > 30 && !hasDuplicateAdaptation(existingTasks, 'tez_60', 30, true)) {
    tasks.push({
      title: tr ? `Bölüm teslim tarihleri belirle` : `Set section due dates`,
      description: JSON.stringify({ 
        tr: `Bölüm teslim tarihleri belirle`, 
        en: `Set section due dates`,
        descTr: `60 Günlük Sprint Modu: Tezin/projenin kalan her ana bölümü için kendinize özel birer teslim tarihi belirleyin.`,
        descEn: `60-Day Sprint Mode: Establish a clear and realistic deadline for each remaining section of the project.`
      }),
      priority: 'High',
      dueDate: daysFromNow(2),
      isCompleted: false,
      tags: ['tez_60', 'education'],
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

  if (daysLeft === 0 && !hasDuplicateAdaptation(existingTasks, 'mulakat_day', 7, true)) {
    tasks.push({
      title: tr ? `Bugün ${name}! Derin nefes al — hazırsın, güven kendine 💪` : `Today is ${name}! Deep breath — you're ready, trust yourself 💪`,
      description: JSON.stringify({ tr: `Bugün ${name}! Derin nefes al — hazırsın, güven kendine 💪`, en: `Today is ${name}! Deep breath — you're ready, trust yourself 💪` }),
      priority: 'High',
      dueDate: daysFromNow(0),
      isCompleted: false,
      tags: ['mulakat_day', 'work'],
    });
    return tasks; // geçmiş tarih için başka görev ekleme
  }

  if (daysLeft < 0) return tasks; // tarih geçmiş

  if (daysLeft <= 1 && !hasDuplicateAdaptation(existingTasks, 'mulakat_eve', 7, true)) {
    tasks.push({
      title: tr ? `Mülakat hazırlıklarını kontrol et` : `Verify interview preparations`,
      description: JSON.stringify({ 
        tr: `Mülakat hazırlıklarını kontrol et`, 
        en: `Verify interview preparations`,
        descTr: `${name} mülakatı yarın! Kıyafetiniz, yol rotanız ve alarmınız hazır mı kontrol edin. 8 saat uyumaya özen gösterin.`,
        descEn: `${name} is tomorrow! Check if your outfit, commute route, and alarm are ready. Aim for 8 hours of sleep.`
      }),
      priority: 'High',
      dueDate: daysFromNow(0),
      isCompleted: false,
      tags: ['mulakat_eve', 'work'],
    });
    tasks.push({
      title: tr ? `STAR hikayelerini prova et` : `Rehearse STAR stories`,
      description: JSON.stringify({ 
        tr: `STAR hikayelerini prova et`, 
        en: `Rehearse STAR stories`,
        descTr: `Mülakatta anlatacağınız 3 güçlü STAR hikayesini sesli olarak prova edin ve her birini 2 dakikada bitirecek şekilde ayarlayın.`,
        descEn: `Rehearse your 3 strongest STAR stories out loud and practice keeping each under 2 minutes.`
      }),
      priority: 'High',
      dueDate: daysFromNow(0),
      isCompleted: false,
      tags: ['mulakat_eve', 'work'],
    });
  }

  if (daysLeft <= 3 && daysLeft > 1 && !hasDuplicateAdaptation(existingTasks, 'mulakat_3days', 7, true)) {
    tasks.push({
      title: tr ? `Şirket haberlerini araştır` : `Research company news`,
      description: JSON.stringify({ 
        tr: `Şirket haberlerini araştır`, 
        en: `Research company news`,
        descTr: `${name} mülakatı için son haberleri, şirketin ürünlerini ve kurum kültürünü 30 dakika boyunca araştırın.`,
        descEn: `${name}: Research latest news, products, and organizational culture for 30 minutes.`
      }),
      priority: 'High',
      dueDate: daysFromNow(0),
      isCompleted: false,
      tags: ['mulakat_3days', 'work'],
    });
    tasks.push({
      title: tr ? `Mock mülakat yap ve kaydet` : `Do a mock interview`,
      description: JSON.stringify({ 
        tr: `Mock mülakat yap ve kaydet`, 
        en: `Do a mock interview`,
        descTr: `Kendinize mock mülakat yapın. Verdiğiniz cevapları videoya veya sese kaydedip daha sonra geri izleyin/dinleyin.`,
        descEn: `Do a mock interview: Record your answers (audio or video) and review your performance.`
      }),
      priority: 'High',
      dueDate: daysFromNow(1),
      isCompleted: false,
      tags: ['mulakat_3days', 'work'],
    });
  }

  if (daysLeft <= 7 && daysLeft > 3 && !hasDuplicateAdaptation(existingTasks, 'mulakat_week', 14, true)) {
    tasks.push({
      title: tr ? `Neden biz / Neden sen?` : `Why us / Why you?`,
      description: JSON.stringify({ 
        tr: `Neden biz / Neden sen?`, 
        en: `Why us / Why you?`,
        descTr: `${name} mülakatına ${daysLeft} gün kaldı. "Neden bu şirket?" ve "Neden sen?" sorularının cevaplarını yazın.`,
        descEn: `${name} in ${daysLeft} days: Write down your answers for "Why this company?" and "Why you?".`
      }),
      priority: 'High',
      dueDate: daysFromNow(1),
      isCompleted: false,
      tags: ['mulakat_week', 'work'],
    });
    tasks.push({
      title: tr ? `Teknik çalışma bloğu planla` : `Plan technical study block`,
      description: JSON.stringify({ 
        tr: `Teknik çalışma bloğu planla`, 
        en: `Plan technical study block`,
        descTr: `Teknik veya vaka (case) konuları için odaklanmış 2 saatlik bir çalışma bloğu planlayıp uygulayın.`,
        descEn: `Plan and execute a focused 2-hour study block for technical or case topics.`
      }),
      priority: 'Medium',
      dueDate: daysFromNow(2),
      isCompleted: false,
      tags: ['mulakat_week', 'work'],
    });
  }

  if (daysLeft <= 14 && daysLeft > 7 && !hasDuplicateAdaptation(existingTasks, 'mulakat_2weeks', 30, true)) {
    tasks.push({
      title: tr ? `CV'ni şirkete göre uyarla` : `Tailor CV to company`,
      description: JSON.stringify({ 
        tr: `CV'ni şirkete göre uyarla`, 
        en: `Tailor CV to company`,
        descTr: `${name} mülakatı için CV'nizi şirkete/pozisyona göre uyarlayın. İlgisiz olan maddeleri CV'nizden çıkarın.`,
        descEn: `${name}: Tailor your CV to match the specific company and role. Remove irrelevant details.`
      }),
      priority: 'Medium',
      dueDate: daysFromNow(3),
      isCompleted: false,
      tags: ['mulakat_2weeks', 'work'],
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
  if (weeksInPlan > 0 && weeksInPlan % 4 === 0 && !hasDuplicateAdaptation(existingTasks, 'guc_deload', 28, true)) {
    tasks.push({
      title: tr ? `Deload haftası: Ağırlık düşür` : `Deload week: Reduce weights`,
      description: JSON.stringify({ 
        tr: `Deload haftası: Ağırlık düşür`, 
        en: `Deload week: Reduce weights`,
        descTr: `${weeksInPlan}. hafta — DELOAD: Ağırlıkları %40 oranında azaltın ancak set ve tekrar sayısını koruyun. Kasların dinlenmesini sağlar ve sakatlanma riskini düşürür.`,
        descEn: `Week ${weeksInPlan} — DELOAD: Reduce training weights by 40% while keeping sets and reps same. Allows muscles to recover and prevents injury.`
      }),
      priority: 'High',
      dueDate: daysFromNow(0),
      isCompleted: false,
      tags: ['guc_deload', 'fitness'],
    });
  }

  // Her 2 haftada bir ilerleme logu hatırlatması
  if (weeksInPlan > 0 && weeksInPlan % 2 === 0 && !hasDuplicateAdaptation(existingTasks, 'guc_progress', 14, true)) {
    tasks.push({
      title: tr ? `2 haftalık güç kontrolü` : `2-week strength check`,
      description: JSON.stringify({ 
        tr: `2 haftalık güç kontrolü`, 
        en: `2-week strength check`,
        descTr: `Temel hareketlerinizde (Squat, Bench Press, Deadlift vb.) geçen sefere kıyasla daha fazla ağırlık veya tekrar yapabiliyor musunuz? Kaydedin.`,
        descEn: `2-Week Check: Can you lift more weight or do more reps in your main lifts than 2 weeks ago? Record it.`
      }),
      priority: 'Medium',
      dueDate: daysFromNow(0),
      isCompleted: false,
      tags: ['guc_progress', 'fitness'],
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

  if (daysLeft <= 5 && daysLeft >= 0 && !hasDuplicateAdaptation(existingTasks, 'ramazan_kadir', 10, true)) {
    tasks.push({
      title: tr ? `Kadir Gecesi yaklaşıyor — son 10 gece ibadet programı yap` : `Laylat al-Qadr approaching — plan worship schedule for last 10 nights`,
      description: JSON.stringify({ tr: `Kadir Gecesi yaklaşıyor — son 10 gece ibadet programı yap`, en: `Laylat al-Qadr approaching — plan worship schedule for last 10 nights` }),
      priority: 'High',
      dueDate: daysFromNow(0),
      isCompleted: false,
      tags: ['ramazan_kadir', 'ramazan'],
    });
  }

  return tasks;
}
