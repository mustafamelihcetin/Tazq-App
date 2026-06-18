type Language = 'tr' | 'en';

interface Task {
  title: string;
  priority: string;
  isCompleted: boolean;
  dueDate?: string | null;
}

const SENSITIVE_KW = ['cenaze', 'vefat', 'taziye', 'hastane', 'ameliyat', 'başsağlığı', 'mevlit', 'ilaç', 'tedavi', 'klinik'];
const JOYFUL_KW = ['doğum günü', 'kutlama', 'parti', 'düğün', 'tatil', 'bayram', 'tebrik', 'yıl dönümü', 'nişan', 'eğlence'];
const STRESSFUL_KW = ['sınav', 'mülakat', 'sunum', 'teslim', 'deadline', 'acil', 'vize', 'final', 'proje', 'toplantı'];
const TOMORROW_KW = ['yarın', 'tomorrow', 'öbür gün', 'next day'];
const FUNERAL_KW = ['cenaze', 'vefat', 'taziye', 'başsağlığı', 'mevlit'];

type Sentiment = 'sensitive' | 'joyful' | 'stressful' | 'normal';

function getSentiment(title: string): Sentiment {
  const t = title.toLowerCase();
  if (SENSITIVE_KW.some(kw => t.includes(kw))) return 'sensitive';
  if (JOYFUL_KW.some(kw => t.includes(kw))) return 'joyful';
  if (STRESSFUL_KW.some(kw => t.includes(kw))) return 'stressful';
  return 'normal';
}

function isTomorrowTask(title: string): boolean {
  const t = title.toLowerCase();
  return TOMORROW_KW.some(kw => t.includes(kw));
}

function tr(trStr: string, enStr: string, lang: Language): string {
  return lang === 'tr' ? trStr : enStr;
}

export function getSmartInsight(
  lang: Language,
  isActive: boolean,
  momentum: number,
  highPriorityToday: Task | undefined,
  topTaskToday: Task | undefined,
  futureTasksIncomplete: Task[],
): string {
  if (isActive) {
    return tr(
      'Odak modu aktif. Akışını bozma, harika gidiyorsun.',
      'Focus mode active. Stay in the zone, you\'re doing great.',
      lang,
    );
  }

  if (highPriorityToday && !isTomorrowTask(highPriorityToday.title)) {
    const sentiment = getSentiment(highPriorityToday.title);
    const titleL = highPriorityToday.title.toLowerCase();
    if (sentiment === 'sensitive') {
      if (FUNERAL_KW.some(kw => titleL.includes(kw))) {
        return tr(`Başınız sağ olsun. "${highPriorityToday.title}" için metanet diliyorum. 🙏`, `My condolences. Stay strong for "${highPriorityToday.title}". 🙏`, lang);
      }
      return tr(`Geçmiş olsun. "${highPriorityToday.title}" sürecinde kendine dikkat et. 🙏`, `Get well soon. Take care during "${highPriorityToday.title}". 🙏`, lang);
    }
    if (sentiment === 'joyful') return tr(`Harika! "${highPriorityToday.title}" günü geldi. Tadını çıkar! 🎉`, `Awesome! "${highPriorityToday.title}" is today. Enjoy! 🎉`, lang);
    return tr(
      `Bugünün en kritik işi: "${highPriorityToday.title}". Hemen bitirip rahatlamaya ne dersin?`,
      `Today's priority: "${highPriorityToday.title}". How about finishing it now to relax?`,
      lang,
    );
  }

  if (topTaskToday && !isTomorrowTask(topTaskToday.title)) {
    const sentiment = getSentiment(topTaskToday.title);
    const titleL = topTaskToday.title.toLowerCase();
    if (sentiment === 'sensitive') {
      if (FUNERAL_KW.some(kw => titleL.includes(kw))) {
        return tr(`Zor bir görev: "${topTaskToday.title}". Sabır dilerim. 🙏`, `A difficult task: "${topTaskToday.title}". Wishing you patience. 🙏`, lang);
      }
      return tr(`"${topTaskToday.title}" konusuna odaklanalım. Sağlık her şeyden önemli. 🙏`, `Let's focus on "${topTaskToday.title}". Health comes first. 🙏`, lang);
    }
    if (sentiment === 'joyful') return tr(`Hadi "${topTaskToday.title}" hazırlıklarına başlayalım! ✨`, `Let's start prep for "${topTaskToday.title}"! ✨`, lang);
    return tr(
      `Sıradaki bugünün görevi: "${topTaskToday.title}". Küçük bir adımla başlamak ivmeni artırır.`,
      `Next for today: "${topTaskToday.title}". A small step now will boost your momentum.`,
      lang,
    );
  }

  if (futureTasksIncomplete.length > 0 || (topTaskToday && isTomorrowTask(topTaskToday.title))) {
    const nextTask = (topTaskToday && isTomorrowTask(topTaskToday.title)) ? topTaskToday : futureTasksIncomplete[0];
    const titleL = nextTask.title.toLowerCase();
    const sentiment = getSentiment(nextTask.title);
    const isTomorrow = isTomorrowTask(titleL);

    if (isTomorrow) {
      if (sentiment === 'sensitive') {
        if (FUNERAL_KW.some(kw => titleL.includes(kw))) {
          return tr('Yarın zor bir gün olacak. Metanetini koru, bugün sadece dinlen. 🙏', 'Tomorrow will be difficult. Stay strong, just rest today. 🙏', lang);
        }
        return tr(`Yarınki "${nextTask.title}" için şimdiden hazırlıklı ol. Geçmiş olsun. 🙏`, `Be prepared for tomorrow's "${nextTask.title}". Get well soon. 🙏`, lang);
      }
      if (sentiment === 'joyful') return tr(`Yarın harika bir gün olacak! "${nextTask.title}" seni bekliyor. 🎈`, `Tomorrow will be great! "${nextTask.title}" awaits you. 🎈`, lang);
      return tr(
        `Bugünlük işler tamam gibi. Yarınki "${nextTask.title}" görevin için şimdiden plan yapabilirsin.`,
        `Today seems clear. You can start planning for tomorrow's "${nextTask.title}" task.`,
        lang,
      );
    }
    return tr(
      `Sıradaki hedefin: "${nextTask.title}". Zamanı geldiğinde seni uyaracağım.`,
      `Next target: "${nextTask.title}". I'll alert you when the time comes.`,
      lang,
    );
  }

  if (momentum > 75) return tr('Zirvedesin! Bugün durdurulamaz bir tempoya ulaştın.', "You're at peak performance! Unstoppable pace today.", lang);
  return tr('Tüm görevler hazır. Yeni bir hedef belirleme vakti.', 'All tasks ready. Time to set a new target.', lang);
}
