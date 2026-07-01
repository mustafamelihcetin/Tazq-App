import { SEMANTIC_DICTIONARY } from '@/shared/utils/semanticDictionary';

export type RecurrenceType = 'None' | 'Daily' | 'Weekly' | 'Monthly';

export interface ParsedHint {
  priority?: 'Low' | 'Medium' | 'High';
  dueDate?: string;
  dueTime?: string;
  tags?: string[];
  wittyMessage?: string;
  context?: 'sensitive' | 'joyful' | 'stressful' | 'normal';
  recurrence?: RecurrenceType;
  recurrenceDayLabel?: string; // e.g. "Pazartesi", "Monday" — extracted from "her pazartesi"
}

/**
 * TAZQ LOCAL SEMANTIC ENGINE V3 (Dictionary-Powered)
 * Uses the Global Semantic Dictionary for high-accuracy local NLP.
 */

type ContextType = 'sensitive' | 'joyful' | 'stressful' | 'urgent' | 'social' | 'health' | 'work' | 'finance' | 'education' | 'shopping' | 'home';

const CLUSTER_TO_TAG: Record<ContextType, { tr: string; en: string }> = {
  sensitive: { tr: 'önemli',    en: 'important'  },
  joyful:    { tr: 'sosyal',    en: 'social'      },
  stressful: { tr: 'iş',       en: 'work'        },
  urgent:    { tr: 'acil',     en: 'urgent'      },
  social:    { tr: 'sosyal',   en: 'social'      },
  health:    { tr: 'sağlık',   en: 'health'      },
  work:      { tr: 'iş',       en: 'work'        },
  finance:   { tr: 'finans',   en: 'finance'     },
  education: { tr: 'eğitim',   en: 'education'   },
  shopping:  { tr: 'alışveriş',en: 'shopping'    },
  home:      { tr: 'ev',       en: 'home'        },
};

function toISO(date: Date): string {
  // Use local date components to avoid UTC timezone shifts
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const WEEKDAY_MAP: Record<string, number> = {
  pazartesi: 1, monday: 1, salı: 2, tuesday: 2, çarşamba: 3, wednesday: 3,
  perşembe: 4, thursday: 4, cuma: 5, friday: 5, cumartesi: 6, saturday: 6, pazar: 0, sunday: 0,
};

export function parseTaskHint(text: string, preferredLang?: 'tr' | 'en'): ParsedHint {
  if (!text.trim()) return {};
  const lower = text.toLowerCase();
  const words = lower.split(/[\s,.;!?]+/);
  const hint: ParsedHint = {};
  const today = new Date();

  // 0. Language detection — preferred lang takes priority; fall back to text-based heuristics
  const isTR = preferredLang === 'tr'
    || (preferredLang !== 'en' && (
      /[ıİğĞüÜşŞöÖçÇ]/.test(text)
      || lower.includes('yarın') || lower.includes('bugün')
      || lower.includes('hatırlat') || lower.includes('pazartesi')
      || lower.includes('salı') || lower.includes('çarşamba')
      || lower.includes('perşembe') || lower.includes('cuma')
    ));
  
  // 1. Semantic Intent Calculation using the Global Dictionary
  const scores: Record<ContextType, number> = {
    sensitive: 0, joyful: 0, stressful: 0, urgent: 0, social: 0, health: 0, work: 0, finance: 0, education: 0, shopping: 0, home: 0
  };
  
  words.forEach(word => {
    // Advanced Stemming (Removing Turkish suffixes)
    const stems = [
      word, 
      word.replace(/[ıieaouüö]$/i, ''), 
      word.slice(0, -1), 
      word.slice(0, -2), 
      word.slice(0, -3),
      word.replace(/lar$|ler$|da$|de$|ta$|te$|in$|ın$|un$|ün$/i, '') // Extra TR suffixes
    ];
    const seenCluster = new Set<string>();
    
    stems.forEach(s => {
      const entry = SEMANTIC_DICTIONARY[s];
      if (entry && !seenCluster.has(s)) {
        Object.keys(entry).forEach((key) => {
           if (key in scores) {
              scores[key as ContextType] += entry[key] || 0;
           }
        });
        seenCluster.add(s);
      }
    });
  });

  // 2. Context Determination
  const emotionalContexts: ContextType[] = ['sensitive', 'joyful', 'stressful'];
  let maxScore = 0;
  hint.context = 'normal';

  emotionalContexts.forEach(c => {
    if (scores[c] > maxScore && scores[c] >= 5) {
      maxScore = scores[c];
      if (c === 'sensitive' || c === 'joyful' || c === 'stressful') {
        hint.context = c;
      }
    }
  });

  // 3. Priority Calculation
  if (scores.urgent >= 10 || scores.stressful >= 15) hint.priority = 'High';
  else if (scores.urgent >= 5 || scores.stressful >= 8) hint.priority = 'Medium';
  else if (scores.urgent > 0 || scores.stressful > 0) hint.priority = 'Low';

  // 4. Auto-Tagging (language-aware)
  const tagsSet = new Set<string>();
  Object.keys(scores).forEach(c => {
    if (scores[c as ContextType] >= 5) {
      const entry = CLUSTER_TO_TAG[c as ContextType];
      tagsSet.add(isTR ? entry.tr : entry.en);
    }
  });

  // Keyword-level tags — more specific than cluster-level
  const KEYWORD_TAGS: Array<{ keywords: string[]; tr: string; en: string }> = [
    {
      keywords: ['toplantı', 'meeting'],
      tr: 'toplantı', en: 'meeting',
    },
    {
      keywords: ['kod', 'kodla', 'kodlama', 'geliştir', 'develop', 'code', 'program', 'backend', 'frontend'],
      tr: 'geliştirme', en: 'dev',
    },
    {
      keywords: ['sınav', 'vize', 'final', 'exam', 'test', 'quiz'],
      tr: 'sınav', en: 'exam',
    },
    {
      keywords: ['ödev', 'homework', 'assignment'],
      tr: 'ödev', en: 'homework',
    },
    {
      keywords: ['alışveriş', 'market', 'sipariş', 'shopping', 'grocery', 'order'],
      tr: 'alışveriş', en: 'shopping',
    },
    {
      keywords: ['spor', 'egzersiz', 'gym', 'koşu', 'fitness', 'antrenman', 'workout', 'run'],
      tr: 'spor', en: 'fitness',
    },
    {
      keywords: ['randevu', 'doktor', 'hastane', 'appointment', 'doctor', 'hospital'],
      tr: 'randevu', en: 'appointment',
    },
  ];
  KEYWORD_TAGS.forEach(({ keywords, tr, en }) => {
    if (keywords.some(kw => lower.includes(kw))) {
      // Remove the generic cluster tag if a more specific one is added
      if (isTR) {
        tagsSet.delete('eğitim'); tagsSet.delete('sağlık'); tagsSet.delete('alışveriş');
        tagsSet.add(tr);
      } else {
        tagsSet.delete('education'); tagsSet.delete('health'); tagsSet.delete('shopping');
        tagsSet.add(en);
      }
    }
  });

  if (tagsSet.size > 0) hint.tags = Array.from(tagsSet);

  // 5. Smart Date & Time
  if (lower.includes('bugün') || lower.includes('today')) {
    hint.dueDate = toISO(today);
  } else if (lower.includes('yarın') || lower.includes('tomorrow')) {
    const d = new Date(today); d.setDate(today.getDate() + 1);
    hint.dueDate = toISO(d);
  } else {
    for (const [kw, dayNum] of Object.entries(WEEKDAY_MAP)) {
      if (lower.includes(kw)) {
        let diff = dayNum - today.getDay();
        if (diff <= 0) diff += 7;
        const d = new Date(today); d.setDate(today.getDate() + diff);
        hint.dueDate = toISO(d);
        break;
      }
    }
  }

  // 5b. Recurrence Detection
  const dailyPatterns = ['her gun', 'her gün', 'her sabah', 'her gece', 'gunluk', 'günlük', 'daily', 'every day', 'everyday'];
  const weeklyPatterns = ['her hafta', 'haftalik', 'haftalık', 'weekly', 'every week'];
  const monthlyPatterns = ['her ay', 'aylik', 'aylık', 'monthly', 'every month'];
  // "her pazartesi / her salı ..." → weekly
  const weeklyDayPattern = /her\s+(pazartesi|salı|çarşamba|perşembe|cuma|cumartesi|pazar|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i;

  if (dailyPatterns.some(p => lower.includes(p))) {
    hint.recurrence = 'Daily';
  } else if (weeklyPatterns.some(p => lower.includes(p))) {
    hint.recurrence = 'Weekly';
  } else {
    const dayMatch = weeklyDayPattern.exec(lower);
    if (dayMatch) {
      hint.recurrence = 'Weekly';
      const raw = dayMatch[1].toLowerCase();
      const dayMap: Record<string, string> = {
        pazartesi: 'Pazartesi', salı: 'Salı', çarşamba: 'Çarşamba',
        perşembe: 'Perşembe', cuma: 'Cuma', cumartesi: 'Cumartesi', pazar: 'Pazar',
        monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
        thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
      };
      hint.recurrenceDayLabel = dayMap[raw] ?? raw;
    } else if (monthlyPatterns.some(p => lower.includes(p))) {
      hint.recurrence = 'Monthly';
    }
  }

  const timeMatch =
    lower.match(/saat\s*(\d{1,2})(?:[:.\s](\d{2}))?/) ||
    lower.match(/(\d{1,2})[:.](\d{2})/) ||
    lower.match(/(\d{1,2})['']?(?:da|de|ta|te|ye|ya|e|a)/); // Turkish time suffixes like 15'te, 3'te

  if (timeMatch) {
    const hour = parseInt(timeMatch[1], 10);
    const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    if (hour <= 23 && minute <= 59) {
      const d = new Date();
      if (hint.dueDate) {
        const [y, m, day] = hint.dueDate.split('-').map(Number);
        d.setFullYear(y, m - 1, day);
      }
      d.setHours(hour, minute, 0, 0);
      hint.dueTime = d.toISOString();
    }
  }

  // 6. Witty Message Generation & Reminder/Event Intent
  const hasReminderIntent = lower.includes('hatırlat') || lower.includes('remind') || lower.includes('unutturma') || lower.includes('alarm');
  const hasGuestIntent = lower.includes('misafir') || lower.includes('davet') || lower.includes('konuk');
  
  // Event vs Task vs Note detection
  const taskVerbs = ['yap', 'hazırla', 'yaz', 'bitir', 'kodla', 'oku', 'al', 'götür', 'ara', 'check', 'fix', 'düzelt'];
  const eventKeywords = ['buluşma', 'toplantı', 'randevu', 'konser', 'sinema', 'maç', 'düğün', 'nişan', 'gelecek', 'başlıyor', 'meeting', 'appointment'];
  
  const hasTaskVerb = taskVerbs.some(v => lower.includes(v));
  const isEvent = eventKeywords.some(kw => lower.includes(kw)) || hasGuestIntent;
  const isExplicitNote = lower.startsWith('not:') || lower.startsWith('bilgi:');
  
  // A "Note" is something without a date, without a time, and without an obvious task verb/reminder intent
  const isNote = isExplicitNote || (!hint.dueDate && !hint.dueTime && !hasTaskVerb && !hasReminderIntent && !isEvent);

  const finalContext = (hint.context || 'normal') as string;
  
  if (isExplicitNote || isNote) {
    hint.wittyMessage = isTR ? "Bu önemli bilgiyi not defterime kaydettim. 📝" : "I've saved this important info to my notebook. 📝";
    if (isExplicitNote) {
      if (!hint.tags) hint.tags = [];
      hint.tags.push(isTR ? 'not' : 'note');
    }
    // Truncate long notes for DB/UI stability (max 200 chars for title part)
    if (text.length > 200) {
        // We'll keep the full text but maybe flag it or handle it in UI
    }
  } else if (hasReminderIntent) {
    hint.wittyMessage = isTR ? "Not aldım, vakti gelince hatırlatacağım. Merak etme! 🔔" : "Noted, I'll remind you when the time comes. Don't worry! 🔔";
    hint.priority = hint.priority === 'Low' ? 'Medium' : hint.priority;
    if (!hint.tags) hint.tags = [];
    hint.tags.push(isTR ? 'hatırlatıcı' : 'reminder');
  } else if (hasGuestIntent) {
    hint.wittyMessage = isTR ? "Misafirlerin başımın üstünde yeri var! Hazırlıklara başlayalım. ☕" : "Guests are always welcome! Let's get ready for them. ☕";
    hint.context = 'joyful';
    if (!hint.tags) hint.tags = [];
    hint.tags.push(isTR ? 'sosyal' : 'social');
  } else if (isEvent) {
    hint.wittyMessage = isTR ? "Ajandana bir etkinlik ekliyorum. Vaktinde orada olalım! 📅" : "Adding an event to your agenda. Let's be there on time! 📅";
    if (!hint.tags) hint.tags = [];
    hint.tags.push(isTR ? 'etkinlik' : 'event');
  } else if (finalContext === 'sensitive') {
    if (scores.sensitive >= 10) {
        hint.wittyMessage = isTR ? "Başınız sağ olsun. Tazq bu süreçte ajandanızı sadeleştirecek. 🙏" : "My condolences. Tazq will simplify your agenda during this time. 🙏";
    } else {
        hint.wittyMessage = isTR ? "Geçmiş olsun, sağlığınız her şeyden önemli. Kaydedildi. 🙏" : "Get well soon, your health is priority #1. Noted. 🙏";
    }
  } else if (finalContext === 'joyful') {
    hint.wittyMessage = isTR ? "Harika bir plan! Tazq kutlama moduna hazır. 🎉" : "Great plan! Tazq is ready for celebration mode. 🎉";
  } else if (finalContext === 'stressful') {
    hint.wittyMessage = isTR ? "Zorlu bir görev ama üstesinden gelebilirsin. Odaklanalım! 💪" : "A tough task, but you can handle it. Let's focus! 💪";
  } else {
    hint.wittyMessage = isTR ? "Planlandı. Adım adım hedefe ilerliyoruz. ✅" : "Scheduled. Moving towards the goal step by step. ✅";
  }

  return hint;
}
