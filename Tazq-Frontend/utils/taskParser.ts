export interface ParsedHint {
  priority?: 'Low' | 'Medium' | 'High';
  dueDate?: string;    // ISO date string
  dueTime?: string;    // ISO time string
  tags?: string[];
  wittyMessage?: string; // Conversational feedback
}

const HIGH_PRIORITY_TR = ['acil', 'kritik', 'önemli', 'urgent', 'asap', 'hemen', 'ivedi', 'hayati', 'kritik'];
const MEDIUM_PRIORITY_TR = ['normal', 'orta', 'bu hafta', 'this week'];
const LOW_PRIORITY_TR = ['düşük', 'lazy', 'zamanında', 'sonra', 'later', 'low'];

const URGENT_TOPICS = ['sınav', 'exam', 'mülakat', 'interview', 'sunum', 'presentation', 'rapor', 'report', 'fatura', 'bill'];

const TAG_MAP: Record<string, string> = {
  toplantı: 'toplantı', meeting: 'toplantı',
  alışveriş: 'alışveriş', shopping: 'alışveriş',
  rapor: 'iş', report: 'iş',
  sunum: 'iş', presentation: 'iş',
  tasarım: 'tasarım', design: 'tasarım',
  kod: 'geliştirme', code: 'geliştirme', coding: 'geliştirme',
  test: 'geliştirme',
  egzersiz: 'sağlık', exercise: 'sağlık', spor: 'sağlık',
  doktor: 'sağlık', doctor: 'sağlık',
  fatura: 'finans', bill: 'finans', ödeme: 'finans', payment: 'finans',
  aile: 'kişisel', family: 'kişisel',
  arkadaş: 'kişisel', friend: 'kişisel',
};

const WEEKDAY_MAP: Record<string, number> = {
  pazartesi: 1, monday: 1,
  salı: 2, tuesday: 2,
  çarşamba: 3, wednesday: 3,
  perşembe: 4, thursday: 4,
  cuma: 5, friday: 5,
  cumartesi: 6, saturday: 6,
  pazar: 0, sunday: 0,
};

function nextWeekday(targetDay: number): Date {
  const today = new Date();
  const current = today.getDay();
  let diff = targetDay - current;
  if (diff <= 0) diff += 7;
  const result = new Date(today);
  result.setDate(today.getDate() + diff);
  return result;
}

function toISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function parseTaskHint(text: string): ParsedHint {
  if (!text.trim()) return {};
  const lower = text.toLowerCase();
  const hint: ParsedHint = {};

  // Priority
  if (HIGH_PRIORITY_TR.some((w) => lower.includes(w))) {
    hint.priority = 'High';
  } else if (MEDIUM_PRIORITY_TR.some((w) => lower.includes(w))) {
    hint.priority = 'Medium';
  } else if (LOW_PRIORITY_TR.some((w) => lower.includes(w))) {
    hint.priority = 'Low';
  }

  // Auto-upgrade priority for urgent topics
  if (!hint.priority && URGENT_TOPICS.some(w => lower.includes(w))) {
    hint.priority = 'High';
  }

  // Due date
  const today = new Date();
  if (lower.includes('bugün') || lower.includes('today')) {
    hint.dueDate = toISO(today);
  } else if (lower.includes('yarın') || lower.includes('tomorrow')) {
    const tom = new Date(today);
    tom.setDate(today.getDate() + 1);
    hint.dueDate = toISO(tom);
  } else if (lower.includes('öbür gün') || lower.includes('day after')) {
    const d = new Date(today);
    d.setDate(today.getDate() + 2);
    hint.dueDate = toISO(d);
  } else if (lower.includes('üç gün sonra') || lower.includes('3 gün sonra')) {
    const d = new Date(today);
    d.setDate(today.getDate() + 3);
    hint.dueDate = toISO(d);
  } else if (lower.includes('bu hafta') || lower.includes('this week')) {
    const d = new Date(today);
    d.setDate(today.getDate() + (5 - today.getDay())); 
    hint.dueDate = toISO(d);
  } else if (lower.includes('gelecek hafta') || lower.includes('next week')) {
    const d = new Date(today);
    d.setDate(today.getDate() + 7);
    hint.dueDate = toISO(d);
  } else {
    for (const [keyword, dayNum] of Object.entries(WEEKDAY_MAP)) {
      if (lower.includes(keyword)) {
        hint.dueDate = toISO(nextWeekday(dayNum));
        break;
      }
    }
  }

  // Time — support "saat 14", "14:30", "14'te", "14.00'de", "2pm", etc.
  const timeMatch =
    lower.match(/saat\s*(\d{1,2})(?:[:.\s](\d{2}))?/) ||
    lower.match(/(\d{1,2})[:.](\d{2})/) ||
    lower.match(/(\d{1,2})['’](?:te|de|ta|da|ten|dan|e|a)/) ||
    lower.match(/(\d{1,2})\s*(?:pm|öğleden sonra)/) ||
    lower.match(/at\s*(\d{1,2})(?:[:.](\d{2}))?/);

  if (timeMatch) {
    let hour = parseInt(timeMatch[1], 10);
    const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    if (lower.includes('pm') && hour < 12) hour += 12;
    
    // Use Local Time to avoid timezone shifts in UI
    const base = hint.dueDate ? new Date(hint.dueDate) : new Date();
    base.setHours(hour, minute, 0, 0);
    hint.dueTime = base.toISOString();
  }

  // Auto-tags
  const tags: string[] = [];
  for (const [keyword, tag] of Object.entries(TAG_MAP)) {
    if (lower.includes(keyword) && !tags.includes(tag)) {
      tags.push(tag);
    }
  }
  if (tags.length > 0) hint.tags = tags;

  // Witty Message Logic (Contextual Intelligence)
  const isUrgent = URGENT_TOPICS.some(w => lower.includes(w));
  const isTomorrow = lower.includes('yarın') || lower.includes('tomorrow');
  const isToday = lower.includes('bugün') || lower.includes('today');
  const isFuture = !!hint.dueDate && !isToday && !isTomorrow;

  if (isUrgent && isTomorrow) {
    hint.wittyMessage = "Yarın büyük gün! Bugünden hazırlıklara başla derim. 🔥";
  } else if (isUrgent && isToday) {
    hint.wittyMessage = "Kritik görev! Hemen odak moduna geçmelisin. ⚡";
  } else if (isUrgent && isFuture) {
    hint.wittyMessage = `${hint.dueDate} tarihindeki bu önemli görev için zamanın var ama gardını düşürme! 🚀`;
  } else if (isTomorrow) {
    hint.wittyMessage = "Yarınki sen sana teşekkür edecek. Planlandı! ✅";
  } else if (isToday) {
    hint.wittyMessage = "Bugünün listesine eklendi. Hadi bitirelim! 💪";
  } else if (isFuture) {
    hint.wittyMessage = "Uzak bir hedef ama radarımızda. Kaydedildi! 📡";
  }

  return hint;
}
