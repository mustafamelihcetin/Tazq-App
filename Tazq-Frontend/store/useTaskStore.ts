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
  toggleTaskCompletion: (taskId: number) => void;
  setLoading: (loading: boolean) => void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  isLoading: false,
  dailyProgressText: "Bugün için harika bir gün!",
  
  setTasks: (tasks) => {
    const todayTasks = tasks.filter(t => {
      if (!t.dueDate) return false;
      return new Date(t.dueDate).toDateString() === new Date().toDateString();
    });
    
    const completedToday = todayTasks.filter(t => t.isCompleted).length;
    const progressText = todayTasks.length > 0 
      ? `${todayTasks.length} görevden ${completedToday} tanesi tamamlandı.`
      : "Bugün için planlanan görev yok.";
      
    set({ tasks, dailyProgressText: progressText });
  },

  toggleTaskCompletion: (taskId) => {
    const newTasks = get().tasks.map(t => 
      t.id === taskId ? { ...t, isCompleted: !t.isCompleted } : t
    );
    get().setTasks(newTasks);
  },

  setLoading: (isLoading) => set({ isLoading }),
}));
