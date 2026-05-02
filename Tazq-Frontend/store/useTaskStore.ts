import { create } from 'zustand';
import { SubtaskItem, RecurrenceType } from '../services/api';

export interface Task {
  id: number;
  title: string;
  description: string;
  dueDate?: string | null;
  dueTime?: string | null;
  isCompleted: boolean;
  priority: string;
  tags: string[];
  subtasks?: SubtaskItem[];
  recurrence?: RecurrenceType;
  sortOrder?: number;
}

interface TaskState {
  tasks: Task[];
  isLoading: boolean;
  dailyProgressText: string;
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  removeTask: (taskId: number) => void;
  updateTask: (taskId: number, updated: Partial<Task>) => void;
  toggleTaskCompletion: (taskId: number) => void;
  toggleSubtask: (taskId: number, subtaskIndex: number) => void;
  reorderTasks: (orderedIds: number[]) => void;
  setLoading: (loading: boolean) => void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  isLoading: false,
  dailyProgressText: '',

  setTasks: (tasks) => {
    // Smart Sort: 
    // 1. Uncompleted first
    // 2. Manual sort order (if set)
    // 3. Priority (High > Medium > Low)
    // 4. Due Date (Earliest first, nulls at bottom)
    const sorted = [...tasks].sort((a, b) => {
      if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
      
      // Manual sort order takes precedence if both have non-zero values
      if ((a.sortOrder || 0) !== (b.sortOrder || 0)) {
        return (a.sortOrder || 0) - (b.sortOrder || 0);
      }

      const priorityMap: Record<string, number> = { 'High': 3, 'Medium': 2, 'Low': 1 };
      const pA = priorityMap[a.priority] || 0;
      const pB = priorityMap[b.priority] || 0;
      if (pA !== pB) return pB - pA;

      if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      
      return b.id - a.id; // Newest first as tie-breaker
    });

    const todayTasks = sorted.filter((t) => {
      if (!t.dueDate) return false;
      return new Date(t.dueDate).toDateString() === new Date().toDateString();
    });
    const completedToday = todayTasks.filter((t) => t.isCompleted).length;
    set({ tasks: sorted, dailyProgressText: '' });
  },

  addTask: (task) => {
    const updated = [task, ...get().tasks];
    get().setTasks(updated);
  },

  removeTask: (taskId) => {
    const updated = get().tasks.filter((t) => t.id !== taskId);
    get().setTasks(updated);
  },

  updateTask: (taskId, updated) => {
    const newTasks = get().tasks.map((t) =>
      t.id === taskId ? { ...t, ...updated } : t
    );
    get().setTasks(newTasks);
  },

  toggleTaskCompletion: (taskId) => {
    const newTasks = get().tasks.map((t) =>
      t.id === taskId ? { ...t, isCompleted: !t.isCompleted } : t
    );
    get().setTasks(newTasks);
  },

  toggleSubtask: (taskId, subtaskIndex) => {
    const newTasks = get().tasks.map((t) => {
      if (t.id !== taskId) return t;
      const subs = [...(t.subtasks || [])];
      if (subs[subtaskIndex]) {
        subs[subtaskIndex] = { ...subs[subtaskIndex], done: !subs[subtaskIndex].done };
      }
      return { ...t, subtasks: subs };
    });
    get().setTasks(newTasks);
  },

  reorderTasks: (orderedIds) => {
    const taskMap = new Map(get().tasks.map(t => [t.id, t]));
    const reordered = orderedIds
      .map((id, i) => {
        const task = taskMap.get(id);
        if (task) return { ...task, sortOrder: i };
        return null;
      })
      .filter(Boolean) as Task[];
    // Add any tasks not in the ordered list
    get().tasks.forEach(t => {
      if (!orderedIds.includes(t.id)) reordered.push(t);
    });
    set({ tasks: reordered });
  },

  setLoading: (isLoading) => set({ isLoading }),
}));

