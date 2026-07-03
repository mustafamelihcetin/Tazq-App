import { getAllDailyPlanPairs } from './dailyPlanEngine';
import { getAllKnownModePairs } from '@/features/modes/utils/turkishModes';
import { getAllLifeModePairs } from './lifeModePlans';
import { useTaskStore } from '@/features/tasks/store/useTaskStore';
import { useHabitStore } from '@/features/habits/store/useHabitStore';
import { translateTag } from '@/features/tasks';

let trToEnMap: Map<string, string> | null = null;
let enToTrMap: Map<string, string> | null = null;

const DAYS_MAP: Record<string, { tr: string; en: string }> = {
  pazartesi: { tr: 'Pazartesi', en: 'Monday' },
  salı: { tr: 'Salı', en: 'Tuesday' },
  çarşamba: { tr: 'Çarşamba', en: 'Wednesday' },
  perşembe: { tr: 'Perşembe', en: 'Thursday' },
  cuma: { tr: 'Cuma', en: 'Friday' },
  cumartesi: { tr: 'Cumartesi', en: 'Saturday' },
  pazar: { tr: 'Pazar', en: 'Sunday' },
  monday: { tr: 'Pazartesi', en: 'Monday' },
  tuesday: { tr: 'Salı', en: 'Tuesday' },
  wednesday: { tr: 'Çarşamba', en: 'Wednesday' },
  thursday: { tr: 'Perşembe', en: 'Thursday' },
  friday: { tr: 'Cuma', en: 'Friday' },
  saturday: { tr: 'Cumartesi', en: 'Saturday' },
  sunday: { tr: 'Pazar', en: 'Sunday' }
};

const SUBJECTS_MAP: Record<string, { tr: string; en: string }> = {
  'coğrafya': { tr: 'Coğrafya', en: 'Geography' },
  'geography': { tr: 'Coğrafya', en: 'Geography' },
  'tarih': { tr: 'Tarih', en: 'History' },
  'history': { tr: 'Tarih', en: 'History' },
  'matematik': { tr: 'Matematik', en: 'Mathematics' },
  'mathematics': { tr: 'Matematik', en: 'Mathematics' },
  'fizik': { tr: 'Fizik', en: 'Physics' },
  'physics': { tr: 'Fizik', en: 'Physics' },
  'kimya': { tr: 'Kimya', en: 'Chemistry' },
  'chemistry': { tr: 'Kimya', en: 'Chemistry' },
  'biyoloji': { tr: 'Biyoloji', en: 'Biology' },
  'biology': { tr: 'Biyoloji', en: 'Biology' },
  'türkçe': { tr: 'Türkçe', en: 'Turkish' },
  'turkish': { tr: 'Türkçe', en: 'Turkish' },
  'edebiyat': { tr: 'Edebiyat', en: 'Literature' },
  'literature': { tr: 'Edebiyat', en: 'Literature' },
  'felsefe': { tr: 'Felsefe', en: 'Philosophy' },
  'philosophy': { tr: 'Felsefe', en: 'Philosophy' },
  'geometri': { tr: 'Geometri', en: 'Geometry' },
  'geometry': { tr: 'Geometri', en: 'Geometry' },
  'vatandaşlık': { tr: 'Vatandaşlık', en: 'Civics' },
  'civics': { tr: 'Vatandaşlık', en: 'Civics' }
};

function translateDaysList(listStr: string, toLang: 'tr' | 'en'): string {
  return listStr.split(',').map(d => {
    const trimmed = d.trim().toLowerCase();
    const match = DAYS_MAP[trimmed];
    if (match) {
      return toLang === 'tr' ? match.tr : match.en;
    }
    return d.trim();
  }).join(toLang === 'tr' ? ', ' : ', ');
}

function translatePrefix(prefix: string, toLang: 'tr' | 'en'): string {
  let lower = prefix.toLowerCase();
  for (const [key, val] of Object.entries(SUBJECTS_MAP)) {
    if (lower.includes(key)) {
      const targetStr = toLang === 'tr' ? val.tr : val.en;
      const regex = new RegExp(key, 'gi');
      return prefix.replace(regex, targetStr);
    }
  }
  return prefix;
}

function initMaps() {
  if (trToEnMap && enToTrMap) return;
  trToEnMap = new Map<string, string>();
  enToTrMap = new Map<string, string>();

  const addPair = (tr?: string, en?: string) => {
    if (!tr || !en) return;
    const cleanTr = tr.trim();
    const cleanEn = en.trim();
    if (!cleanTr || !cleanEn) return;
    trToEnMap!.set(cleanTr.toLowerCase(), cleanEn);
    enToTrMap!.set(cleanEn.toLowerCase(), cleanTr);
  };

  addPair('Güncel kilonu gir', 'Log current weight');
  addPair('Kilo artıyor! 3 günlük yemek günlüğü tut ve kalori hesapla', 'Weight is going up! Keep a 3-day food diary and count calories');
  addPair('Çok hızlı gidiyor — kas kaybını önle: protein hedefini kontrol et (vücut ağırlığı × 2g/kg)', 'Going too fast — prevent muscle loss: check protein target (bodyweight × 2g/kg)');
  
  try {
    getAllDailyPlanPairs().forEach((p: any) => addPair(p.tr, p.en));
  } catch (e) {}

  try {
    getAllKnownModePairs().forEach((p: any) => addPair(p.tr, p.en));
  } catch (e) {}

  try {
    getAllLifeModePairs().forEach((p: any) => addPair(p.tr, p.en));
  } catch (e) {}
}

export function lookupSystemString(text: string, toLanguage: 'tr' | 'en'): string | null {
  if (!text) return null;
  initMaps();
  const clean = text.trim();
  const lower = clean.toLowerCase();
  
  if (toLanguage === 'en') {
    if (trToEnMap!.has(lower)) return trToEnMap!.get(lower)!;
  } else {
    if (enToTrMap!.has(lower)) return enToTrMap!.get(lower)!;
  }

  // 2. Dynamic Workout days list translations
  if (toLanguage === 'en') {
    const match = clean.match(/^antrenman günlerini takvime ekle:\s*(.*)$/i);
    if (match) {
      return `Add training days to calendar: ${translateDaysList(match[1], 'en')}`;
    }
  } else {
    const match = clean.match(/^add training days to calendar:\s*(.*)$/i);
    if (match) {
      return `Antrenman günlerini takvime ekle: ${translateDaysList(match[1], 'tr')}`;
    }
  }

  // 3. Dynamic Daily Exam tasks with prefix matching (e.g. "KPSS Coğrafya:")
  const prefixMatch = clean.match(/^([a-zşğçıtöuü\s\d-]+):\s*(.*)$/i);
  if (prefixMatch) {
    const prefix = prefixMatch[1];
    const rest = prefixMatch[2];
    const restLower = rest.toLowerCase().trim();

    let translatedRest: string | null = null;
    if (toLanguage === 'en') {
      for (const [trKey, enVal] of trToEnMap!.entries()) {
        const trKeyPlaceholder = trKey.replace('{name}', '').trim();
        if (trKeyPlaceholder && restLower.includes(trKeyPlaceholder)) {
          const prefixTranslated = translatePrefix(prefix, 'en');
          translatedRest = enVal.replace('{name}', prefixTranslated);
          break;
        }
      }
    } else {
      for (const [enKey, trVal] of enToTrMap!.entries()) {
        const enKeyPlaceholder = enKey.replace('{name}', '').trim();
        if (enKeyPlaceholder && restLower.includes(enKeyPlaceholder)) {
          const prefixTranslated = translatePrefix(prefix, 'tr');
          translatedRest = trVal.replace('{name}', prefixTranslated);
          break;
        }
      }
    }

    if (translatedRest) {
      return translatedRest;
    }
  }

  return null;
}

export function syncTasksAndHabitsLanguage(lang: 'tr' | 'en') {
  try {
    const taskStore = useTaskStore.getState();
    const tasks = taskStore.tasks || [];
    let tasksChanged = false;

    const updatedTasks = tasks.map(t => {
      let newTitle = t.title;
      let titleTr = (t as any).titleTr;
      let titleEn = (t as any).titleEn;

      if (!titleTr || !titleEn) {
        if (t.description && t.description.startsWith('{"tr":')) {
          try {
            const parsed = JSON.parse(t.description);
            if (parsed.tr && parsed.en) {
              titleTr = parsed.tr;
              titleEn = parsed.en;
            }
          } catch {}
        }
      }

      if (titleTr && titleEn) {
        newTitle = lang === 'tr' ? titleTr : titleEn;
      } else {
        const found = lookupSystemString(t.title, lang);
        if (found) {
          newTitle = found;
          if (lang === 'tr') {
            titleTr = found;
            titleEn = t.title;
          } else {
            titleEn = found;
            titleTr = t.title;
          }
        }
      }

      const oldTags = t.tags || [];
      const newTags = oldTags.map(tag => translateTag(tag, lang));
      const tagsChanged = oldTags.length !== newTags.length || oldTags.some((val, idx) => val !== newTags[idx]);

      if (newTitle !== t.title || titleTr !== (t as any).titleTr || titleEn !== (t as any).titleEn || tagsChanged) {
        tasksChanged = true;
        return {
          ...t,
          title: newTitle,
          tags: newTags,
          ...(titleTr ? { titleTr } : {}),
          ...(titleEn ? { titleEn } : {}),
        };
      }
      return t;
    });

    if (tasksChanged) {
      taskStore.setTasks(updatedTasks);
    }
  } catch (e) {}

  try {
    const habitStore = useHabitStore.getState();
    const habits = habitStore.habits || [];
    let habitsChanged = false;

    const updatedHabits = habits.map(h => {
      let newName = h.name;
      let nameTr = (h as any).nameTr;
      let nameEn = (h as any).nameEn;

      if (nameTr && nameEn) {
        newName = lang === 'tr' ? nameTr : nameEn;
      } else {
        const found = lookupSystemString(h.name, lang);
        if (found) {
          newName = found;
          if (lang === 'tr') {
            nameTr = found;
            nameEn = h.name;
          } else {
            nameEn = found;
            nameTr = h.name;
          }
        }
      }

      if (newName !== h.name || nameTr !== (h as any).nameTr || nameEn !== (h as any).nameEn) {
        habitsChanged = true;
        return {
          ...h,
          name: newName,
          ...(nameTr ? { nameTr } : {}),
          ...(nameEn ? { nameEn } : {}),
        };
      }
      return h;
    });

    if (habitsChanged) {
      habitStore.setHabits(updatedHabits);
    }
  } catch (e) {}
}
