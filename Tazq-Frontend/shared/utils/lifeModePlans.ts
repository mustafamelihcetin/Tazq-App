/**
 * Tasarruf/Bütçe ve Bırakma modlarının kural-tabanlı (AI'sız) plan içerikleri.
 * "Uygula" anında oluşturulacak başlangıç alışkanlık + görevleri ve dönemsel
 * (haftalık tartım / milestone) üretim yardımcıları burada toplanır.
 */
import type { BudgetType } from '@/shared/store/useBudgetStore';
import type { QuitType } from '@/shared/store/useQuitStore';

export const TASARRUF_COLOR = '#06B6D4';
export const BIRAKMA_COLOR = '#EF4444';

export interface ModeDraftHabit { name: string; nameEn: string; emoji: string; color: string; }
export interface ModeDraftTask { title: string; titleEn: string; priority: 'High' | 'Medium' | 'Low'; tags: string[]; desc?: string; descEn?: string; }
export interface ModePlanContent { habits: ModeDraftHabit[]; tasks: ModeDraftTask[]; }

// ── TASARRUF / BÜTÇE ────────────────────────────────────────────────────────
const TASARRUF_BASE_HABITS: ModeDraftHabit[] = [
  { name: 'Günlük harcama kaydı', nameEn: 'Log daily spending', emoji: '🧾', color: TASARRUF_COLOR },
  { name: 'Haftalık bütçe gözden geçir', nameEn: 'Weekly budget review', emoji: '📊', color: TASARRUF_COLOR },
];

// Tipe özel günlük alışkanlık — her bütçe hedefi farklı bir günlük davranışı pekiştirir.
const TASARRUF_TYPE_HABITS: Record<Exclude<BudgetType, ''>, ModeDraftHabit> = {
  birikim: { name: 'Bugün hedefe katkı yaptım', nameEn: 'Contributed toward my goal today', emoji: '💰', color: TASARRUF_COLOR },
  borc: { name: 'Bugün borca ödeme/ayırma yaptım', nameEn: 'Paid/set aside toward debt today', emoji: '💳', color: TASARRUF_COLOR },
  acilfon: { name: 'Acil fona dokunmadım', nameEn: "Didn't touch the emergency fund", emoji: '🛡️', color: TASARRUF_COLOR },
};

const TASARRUF_BASE_TASKS: ModeDraftTask[] = [
  { 
    title: 'Otomatik birikim talimatı kur', 
    titleEn: 'Set up an automatic transfer', 
    priority: 'High', 
    tags: ['tasarruf'],
    desc: 'Maaş gününüzde belirlediğiniz birikim tutarının otomatik olarak tasarruf hesabınıza aktarılması için banka talimatı kurun.',
    descEn: 'Set up a recurring automatic transfer on your payday to move your savings directly to a separate account.'
  },
  { 
    title: '50/30/20 bütçe kuralını uygula', 
    titleEn: 'Apply the 50/30/20 budget rule', 
    priority: 'Medium', 
    tags: ['tasarruf'],
    desc: 'Gelirinizin %50\'sini temel ihtiyaçlara, %30\'unu kişisel isteklere ve %20\'sini birikim/borç ödemeye ayırın.',
    descEn: 'Allocate 50% of your income to needs, 30% to wants, and 20% to savings or debt payoff.'
  },
  { 
    title: 'Gereksiz abonelikleri iptal et', 
    titleEn: 'Cancel unused subscriptions', 
    priority: 'Medium', 
    tags: ['tasarruf'],
    desc: 'Son 3 aydır kullanmadığınız dijital üyelikleri, spor salonu üyeliklerini ve diğer gereksiz abonelikleri iptal edin.',
    descEn: 'Review your bank statements and cancel any streaming services, gym memberships, or subscriptions you haven\'t used recently.'
  },
];

// Tipe özel görevler (2 adet) — genel kalıbı değil, o hedefin gerçek ilk adımlarını verir.
const TASARRUF_TYPE_TASKS: Record<Exclude<BudgetType, ''>, ModeDraftTask[]> = {
  birikim: [
    { 
      title: 'Aylık birikim tutarını belirle', 
      titleEn: 'Decide your monthly saving amount', 
      priority: 'High', 
      tags: ['tasarruf'],
      desc: 'Gelir ve giderlerinizi analiz ederek her ay bir kenara atabileceğiniz gerçekçi bir birikim tutarı belirleyin.',
      descEn: 'Analyze your budget and commit to a realistic, fixed amount to save each month.'
    },
    { 
      title: 'Birikim için ayrı bir hesap aç', 
      titleEn: 'Open a separate account for savings', 
      priority: 'Medium', 
      tags: ['tasarruf'],
      desc: 'Birikimlerinizi günlük harcamalarınızla karıştırmamak için farklı bir bankadan veya vadeli hesap açın.',
      descEn: 'Open a separate bank account dedicated purely to savings to prevent accidental spending.'
    },
  ],
  borc: [
    { 
      title: 'Borç ödeme planı çıkar', 
      titleEn: 'Make a payoff plan', 
      priority: 'High', 
      tags: ['tasarruf'],
      desc: 'Tüm borçlarınızı listeleyin; kartopu (küçük borçtan başlama) veya çığ (yüksek faizliden başlama) yöntemlerinden birini seçin.',
      descEn: 'List all your debts and choose a payoff strategy like the debt snowball or debt avalanche.'
    },
    { 
      title: 'En yüksek faizli borcu önceliklendir', 
      titleEn: 'Prioritize the highest-interest debt', 
      priority: 'Medium', 
      tags: ['tasarruf'],
      desc: 'Toplam ödeyeceğiniz faizi azaltmak için en yüksek faiz oranına sahip kredi veya kredi kartı borcuna ekstra ödeme yapın.',
      descEn: 'Focus extra payments on the debt with the highest interest rate to minimize total interest paid.'
    },
  ],
  acilfon: [
    { 
      title: 'Acil fon hedefini belirle', 
      titleEn: 'Set emergency fund target', 
      priority: 'High', 
      tags: ['tasarruf'],
      desc: 'Beklenmedik durumlara karşı 3 ila 6 aylık temel giderlerinizi karşılayacak bir acil durum fonu hedefi belirleyin.',
      descEn: 'Calculate your basic living expenses for 3 to 6 months and set this as your emergency fund target.'
    },
    { 
      title: 'Acil fon için ayrı bir hesap aç', 
      titleEn: 'Open a separate emergency account', 
      priority: 'Medium', 
      tags: ['tasarruf'],
      desc: 'Acil durum paranızı kolayca harcamamak için günlük kartınızın bağlı olmadığı, erişimi zor bir hesapta tutun.',
      descEn: 'Keep your emergency funds in a separate account without an active debit card to avoid impulse spending.'
    },
  ],
};

export function buildTasarrufPlan(type: BudgetType): ModePlanContent {
  const habits = TASARRUF_BASE_HABITS.map(h => ({ ...h }));
  const tasks = [...TASARRUF_BASE_TASKS];
  if (type && TASARRUF_TYPE_HABITS[type as Exclude<BudgetType, ''>]) {
    habits.push({ ...TASARRUF_TYPE_HABITS[type as Exclude<BudgetType, ''>] });
  }
  if (type && TASARRUF_TYPE_TASKS[type as Exclude<BudgetType, ''>]) {
    // Tipe özel görevler en başa (en alakalı ilk adımlar üstte görünsün).
    tasks.unshift(...TASARRUF_TYPE_TASKS[type as Exclude<BudgetType, ''>]);
  }
  return { habits, tasks };
}

// ── BIRAKMA ─────────────────────────────────────────────────────────────────
const BIRAKMA_BASE_HABITS: ModeDraftHabit[] = [
  { name: 'Bugün temiz kaldım', nameEn: 'Stayed clean today', emoji: '🛡️', color: BIRAKMA_COLOR },
  { name: 'Tetikleyiciden uzak dur', nameEn: 'Avoid triggers', emoji: '🚫', color: BIRAKMA_COLOR },
  { name: 'Nefes / su molası', nameEn: 'Breathe / water break', emoji: '💧', color: BIRAKMA_COLOR },
];

const BIRAKMA_BASE_TASKS: ModeDraftTask[] = [
  { 
    title: 'Tetikleyicilerini yaz', 
    titleEn: 'Write down your triggers', 
    priority: 'High', 
    tags: ['birakma'],
    desc: 'Bırakmak istediğiniz alışkanlığı tetikleyen durumları (stres, arkadaş çevresi, can sıkıntısı, belirli saatler) listeleyin.',
    descEn: 'Identify and write down situations, emotions, or social groups that trigger your habit.'
  },
  { 
    title: 'İlk 3 günün planını yap', 
    titleEn: 'Plan your first 3 days', 
    priority: 'High', 
    tags: ['birakma'],
    desc: 'En zor geçecek ilk 72 saati atlatmak için kriz anlarında yapacağınız aktiviteleri (yürüyüş, su içme, hobi) planlayın.',
    descEn: 'Prepare specific distraction activities (walks, drinking water, hobbies) to get through the critical first 72 hours.'
  },
  { 
    title: 'Destek olacak birine durumunu söyle', 
    titleEn: 'Tell someone who can support you', 
    priority: 'Medium', 
    tags: ['birakma'],
    desc: 'Süreç boyunca size destek olacak ve sizi denetleyecek güvendiğiniz bir yakınınıza hedefinizi açıklayın.',
    descEn: 'Share your commitment with a trusted friend or family member who can offer encouragement and accountability.'
  },
  { 
    title: 'Kendine bir ödül belirle', 
    titleEn: 'Choose a reward for yourself', 
    priority: 'Low', 
    tags: ['birakma'],
    desc: 'Bu alışkanlığı bıraktığınızda tasarruf edeceğiniz zaman veya para ile kendinize vereceğiniz bir motivasyon ödülü seçin.',
    descEn: 'Set a motivational milestone reward using the time or money you will save by quitting.'
  },
];

// Tipe özel görevler (2 adet) — bırakılan şeye göre somut çevresel adımlar.
const BIRAKMA_TYPE_TASKS: Partial<Record<Exclude<QuitType, ''>, ModeDraftTask[]>> = {
  
  sigara: [
    { 
      title: 'Sigara parasını ayrı bir hesaba ayır', 
      titleEn: 'Stash your cigarette money separately', 
      priority: 'Medium', 
      tags: ['birakma'],
      desc: 'Sigaraya harcamadığınız günlük/haftalık tutarı biriktirmek için ayrı bir hesap veya fiziksel bir kumbara kurun.',
      descEn: 'Transfer the money you would have spent on cigarettes into a separate account or piggy bank.'
    },
    { 
      title: 'Sigarayı çağrıştıran eşyaları kaldır', 
      titleEn: 'Remove smoking cues', 
      priority: 'Medium', 
      tags: ['birakma'],
      desc: 'Evinizdeki ve iş yerinizdeki kül tablalarını, çakmakları ve sigara paketlerini tamamen atın.',
      descEn: 'Dispose of all ashtrays, lighters, and remaining cigarette packs in your home and car.'
    },
  ],
  sosyal: [
    { 
      title: 'Uygulamalara günlük kullanım limiti koy', 
      titleEn: 'Set daily app usage limits', 
      priority: 'Medium', 
      tags: ['birakma'],
      desc: 'Telefonunuzun ayarlarından sosyal medya uygulamalarına günlük maksimum 30-45 dakikalık kullanım limiti tanımlayın.',
      descEn: 'Configure screen time limits on your phone to restrict social media apps to 30-45 minutes daily.'
    },
    { 
      title: 'Bildirimleri kapat ve uygulamayı gizle', 
      titleEn: 'Mute alerts and hide app', 
      priority: 'Medium', 
      tags: ['birakma'],
      desc: 'Sosyal medya uygulamalarının tüm bildirimlerini kapatın ve uygulamaları ana ekrandan kaldırıp klasör içine gizleyin.',
      descEn: 'Disable all push notifications for social networks and move the apps off your home screen into a folder.'
    },
  ],
  seker: [
    { 
      title: 'Şekerli içecekleri evden çıkar', 
      titleEn: 'Remove sugary drinks from home', 
      priority: 'Medium', 
      tags: ['birakma'],
      desc: 'Mutfaktaki asitli içecekleri, hazır meyve sularını ve şekerli soğuk çayları tamamen temizleyin.',
      descEn: 'Discard or give away all sodas, packaged juices, and sweetened teas from your pantry and fridge.'
    },
    { 
      title: 'Sağlıklı atıştırmalık alternatifleri hazırla', 
      titleEn: 'Prep healthy snack alternatives', 
      priority: 'Medium', 
      tags: ['birakma'],
      desc: 'Şeker krizleri geldiğinde tüketmek üzere çiğ kuruyemiş, kuru meyve veya yoğurt gibi alternatifleri elinizin altında bulundurun.',
      descEn: 'Stock your kitchen with raw nuts, fresh/dried fruits, or greek yogurt to satisfy sweet cravings naturally.'
    },
  ],
  alkol: [
    { 
      title: 'Alkolsüz alternatifler hazır bulundur', 
      titleEn: 'Keep alcohol-free alternatives ready', 
      priority: 'Medium', 
      tags: ['birakma'],
      desc: 'Evde alkollü içecekler yerine maden suyu, bitki çayları veya alkolsüz soğuk içecekler bulundurun.',
      descEn: 'Keep sparkling water, herbal teas, or non-alcoholic beers stocked at home.'
    },
    { 
      title: 'Tetikleyici ortamlardan bu hafta uzak dur', 
      titleEn: 'Avoid trigger settings this week', 
      priority: 'Medium', 
      tags: ['birakma'],
      desc: 'Sosyal ortamlarda alkol tüketimini tetikleyecek bar, pub gibi mekanlara gitmeye bu hafta ara verin.',
      descEn: 'Steer clear of bars, pubs, or social gatherings centered around drinking for at least this week.'
    },
  ],
  kumar: [
    { 
      title: 'Bahis uygulamalarını sil ve engelle', 
      titleEn: 'Delete and block betting apps', 
      priority: 'High', 
      tags: ['birakma'],
      desc: 'Telefonunuzdaki ve bilgisayarınızdaki tüm bahis, iddaa ve casino uygulamalarını silin ve web sitelerini tarayıcınızdan engelleyin.',
      descEn: 'Uninstall all betting apps and use website blockers to block access to online casinos and sportsbooks.'
    },
    { 
      title: 'Hesaplarına para girişini sınırla/dondur', 
      titleEn: 'Limit/freeze deposits to your accounts', 
      priority: 'High', 
      tags: ['birakma'],
      desc: 'Kredi kartı limitlerinizi düşürün, banka hesaplarınızdan bahis sitelerine para gönderimini engellemesi için bankanızla görüşün.',
      descEn: 'Contact your bank to block transactions to gambling vendors and lower credit limits.'
    },
  ],

};

// Bir bırakma türünün yalnızca TİPE ÖZEL görevleri (paylaşılan temel plana eklenir).
export function birakmaTypeTasks(type: QuitType): ModeDraftTask[] {
  const extra = type ? BIRAKMA_TYPE_TASKS[type as Exclude<QuitType, ''>] : undefined;
  return extra ? extra.map(t => ({ ...t })) : [];
}

export function buildBirakmaPlan(type: QuitType): ModePlanContent {
  const tasks = [...BIRAKMA_BASE_TASKS, ...birakmaTypeTasks(type)];
  return { habits: BIRAKMA_BASE_HABITS.map(h => ({ ...h })), tasks };
}

// Bırakma kilometre taşı kutlama görevi (Stage 5 günlük üretimde kullanılır).
export function birakmaMilestoneTask(days: number, tr: boolean): ModeDraftTask {
  return {
    title: tr ? `🎉 ${days}. gün! Bu seriyi koru` : `🎉 Day ${days}! Keep the streak`,
    titleEn: `🎉 Day ${days}! Keep the streak`,
    priority: 'Low',
    tags: ['birakma', `birakma_m${days}`],
  };
}

// İnsan-okur tip etiketleri.
export function tasarrufTypeLabel(type: BudgetType, tr: boolean): string {
  const map: Record<string, [string, string]> = {
    birikim: ['Birikim Hedefi', 'Savings Goal'],
    borc: ['Borç Kapatma', 'Debt Payoff'],
    acilfon: ['Acil Fon', 'Emergency Fund'],
  };
  const e = map[type]; return e ? (tr ? e[0] : e[1]) : (tr ? 'Tasarruf' : 'Savings');
}

export function birakmaTypeLabel(type: QuitType, tr: boolean): string {
  const map: Record<string, [string, string]> = {
    sigara: ['Sigara', 'Smoking'],
    sosyal: ['Sosyal Medya', 'Social Media'],
    seker: ['Şeker', 'Sugar'],
    alkol: ['Alkol', 'Alcohol'],
    kumar: ['Kumar / Bahis', 'Gambling'],
    ozel: ['Özel', 'Custom'],
  };
  const e = map[type]; return e ? (tr ? e[0] : e[1]) : (tr ? 'Bırakma' : 'Quit');
}

export function getAllLifeModePairs(): Array<{ tr: string; en: string }> {
  const pairs: Array<{ tr: string; en: string }> = [];

  TASARRUF_BASE_HABITS.forEach(h => pairs.push({ tr: h.name, en: h.nameEn }));
  Object.values(TASARRUF_TYPE_HABITS).forEach(h => pairs.push({ tr: h.name, en: h.nameEn }));
  BIRAKMA_BASE_HABITS.forEach(h => pairs.push({ tr: h.name, en: h.nameEn }));

  TASARRUF_BASE_TASKS.forEach(t => pairs.push({ tr: t.title, en: t.titleEn }));
  Object.values(TASARRUF_TYPE_TASKS).forEach(list => list.forEach(t => pairs.push({ tr: t.title, en: t.titleEn })));
  BIRAKMA_BASE_TASKS.forEach(t => pairs.push({ tr: t.title, en: t.titleEn }));
  Object.values(BIRAKMA_TYPE_TASKS).forEach(list => list.forEach(t => pairs.push({ tr: t.title, en: t.titleEn })));

  return pairs;
}
