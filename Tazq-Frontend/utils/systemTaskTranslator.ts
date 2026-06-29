import { getAllDailyPlanPairs } from './dailyPlanEngine';
import { getAllKnownModePairs } from './turkishModes';
import { useTaskStore } from '../store/useTaskStore';
import { useHabitStore } from '../store/useHabitStore';

let trToEnMap: Map<string, string> | null = null;
let enToTrMap: Map<string, string> | null = null;

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
    getAllDailyPlanPairs().forEach(p => addPair(p.tr, p.en));
  } catch (e) {}

  try {
    getAllKnownModePairs().forEach(p => addPair(p.tr, p.en));
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

      if (newTitle !== t.title || titleTr !== (t as any).titleTr || titleEn !== (t as any).titleEn) {
        tasksChanged = true;
        return {
          ...t,
          title: newTitle,
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
