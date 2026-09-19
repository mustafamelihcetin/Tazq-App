import { Task, useTaskStore } from '@/features/tasks/store/useTaskStore';
import { TaskService } from '@/shared/services/api';
import { swallow } from '@/shared/utils/swallow';

export interface BalancerResult {
  isOverwhelmed: boolean;
  overdueTasks: Task[];
  suggestedToMove: Task[];
}

/**
 * Returns the local date string in YYYY-MM-DD format.
 */
export function getLocalDateString(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Parses YYYY-MM-DD to a local Date object at midnight.
 */
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Returns the difference in days between two date strings (YYYY-MM-DD).
 */
function getDaysDifference(date1: string, date2: string): number {
  const d1 = parseLocalDate(date1);
  const d2 = parseLocalDate(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function analyzeTaskLoad(tasks: Task[]): BalancerResult {
  const todayStr = getLocalDateString();

  const overdueTasks = tasks.filter((t) => {
    if (t.isCompleted || t.isArchived || !t.dueDate) return false;
    return t.dueDate < todayStr;
  });

  const isOverwhelmed = overdueTasks.length >= 3;
  const suggestedToMove = [...overdueTasks];

  return {
    isOverwhelmed,
    overdueTasks,
    suggestedToMove,
  };
}

/**
 * TAZQZen Algorithm: Distributes tasks intelligently over the next 7 days.
 * 1. Icebox Rule: Tasks older than 3 days are moved to backlog (dueDate = null).
 * 2. Load Smoothing: Remaining tasks are distributed to days with the fewest tasks, capped at 5 per day.
 * Returns the updated tasks with their new dates (or null for icebox).
 */
export function calculateZenDistribution(
  tasksToMove: Task[],
  allTasks: Task[]
): { task: Task; newDate: string | null }[] {
  const todayStr = getLocalDateString();
  const todayDate = parseLocalDate(todayStr);
  
  const updates: { task: Task; newDate: string | null }[] = [];
  const tasksToDistribute: Task[] = [];

  // 1. Apply Icebox Rule
  for (const task of tasksToMove) {
    if (!task.dueDate) continue;
    const daysOld = getDaysDifference(task.dueDate, todayStr);
    
    // If a task is more than 3 days old, put it in the Icebox
    if (daysOld > 3) {
      updates.push({ task, newDate: null });
    } else {
      tasksToDistribute.push(task);
    }
  }

  // 2. Load Smoothing
  if (tasksToDistribute.length > 0) {
    // Generate next 7 days
    const next7Days: { dateStr: string; count: number }[] = [];
    for (let i = 1; i <= 7; i++) {
      const d = new Date(todayDate);
      d.setDate(d.getDate() + i);
      const dateStr = getLocalDateString(d);
      
      // Count active tasks on this day
      const existingTasks = allTasks.filter(t => !t.isCompleted && !t.isArchived && t.dueDate === dateStr).length;
      next7Days.push({ dateStr, count: existingTasks });
    }

    const MAX_TASKS_PER_DAY = 5;

    for (const task of tasksToDistribute) {
      // Find the day with the minimum tasks, strictly prioritizing earlier days if counts are equal
      next7Days.sort((a, b) => {
        if (a.count !== b.count) return a.count - b.count;
        return a.dateStr.localeCompare(b.dateStr);
      });

      // Distribute to the least busy day
      let selectedDay = next7Days[0];
      
      // If even the least busy day is full (> MAX_TASKS), just push to icebox to prevent overwhelm
      if (selectedDay.count >= MAX_TASKS_PER_DAY) {
         updates.push({ task, newDate: null });
      } else {
         updates.push({ task, newDate: selectedDay.dateStr });
         selectedDay.count += 1;
      }
    }
  }

  return updates;
}

export async function applyZenDistribution(updates: { task: Task; newDate: string | null }[]) {
  const updateStore = useTaskStore.getState().updateTask;

  for (const { task, newDate } of updates) {
    // 1. Update local store immediately (Optimistic UI)
    updateStore(task.id, { dueDate: newDate });

    // 2. Sync to server
    try {
      const fullTaskPayload = { ...task, dueDate: newDate };
      await TaskService.updateTask(task.id, fullTaskPayload as any);
    } catch (error: any) {
      swallow('taskBalancer.applyZenDistribution', error, { capture: true });
    }
  }
}

export async function rescheduleTasks(tasks: Task[], targetDateStr: string) {
  const updateStore = useTaskStore.getState().updateTask;

  for (const task of tasks) {
    // 1. Update local store immediately (Optimistic UI)
    updateStore(task.id, { dueDate: targetDateStr });

    // 2. Sync to server
    try {
      const fullTaskPayload = { ...task, dueDate: targetDateStr };
      await TaskService.updateTask(task.id, fullTaskPayload as any);
    } catch (error: any) {
      swallow('taskBalancer.rescheduleTasks', error, { capture: true });
    }
  }
}

export async function undoRescheduleTasks(originalTasks: Task[]) {
  const updateStore = useTaskStore.getState().updateTask;

  for (const task of originalTasks) {
    // Note: If task was moved to icebox, original dueDate might have been valid, so we restore it.
    // If it was already null, we restore it to null.
    updateStore(task.id, { dueDate: task.dueDate || null });

    // 2. Sync to server
    try {
      const fullTaskPayload = { ...task, dueDate: task.dueDate || null };
      await TaskService.updateTask(task.id, fullTaskPayload as any);
    } catch (error) {
      swallow('taskBalancer.undoRescheduleTasks', error, { capture: true });
    }
  }
}
