import { create } from 'zustand';

export interface Task {
  id: number;
  title: string;
  description: string;
  dueDate?: string;
  dueTime?: string;
  isCompleted: boolean;
  priority: string;
  tags: string[];
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
  setLoading: (loading: boolean) => void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  isLoading: false,
  dailyProgressText: 'Bugün için harika bir gün!',

  setTasks: (tasks) => {
    // Smart Sort: 
    // 1. Uncompleted first
    // 2. Priority (High > Medium > Low)
    // 3. Due Date (Earliest first, nulls at bottom)
    const sorted = [...tasks].sort((a, b) => {
      if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
      
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
    const progressText =
      todayTasks.length > 0
        ? `${todayTasks.length} görevden ${completedToday} tanesi tamamlandı.`
        : 'Bugün için planlanan görev yok.';
    set({ tasks: sorted, dailyProgressText: progressText });
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

  setLoading: (isLoading) => set({ isLoading }),
}));
