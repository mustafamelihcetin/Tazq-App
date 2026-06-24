import re

def update_store():
    with open('store/useTaskStore.ts', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Add isArchived to interface Task
    if "isArchived?: boolean;" not in content:
        content = content.replace("sortOrder?: number;", "sortOrder?: number;\n  isArchived?: boolean;")

    # 2. Add methods to TaskState
    if "archiveTask: (id: number) => void;" not in content:
        content = content.replace("deleteTask: (id: number) => void;", "deleteTask: (id: number) => void;\n  archiveTask: (id: number) => void;\n  archiveCompletedTasks: () => void;")

    # 3. Implement methods inside create(...)
    if "archiveTask: (id) =>" not in content:
        archive_methods = """
      deleteTask: (id) => set((state) => {
          // ... implementation ...
      }),
      archiveTask: (id) => set((state) => {
          const t = state.tasks.find(tk => tk.id === id);
          if (t) {
              const updated = { ...t, isArchived: true };
              get().enqueueOffline('update', updated);
              return { tasks: state.tasks.map(tk => tk.id === id ? updated : tk) };
          }
          return state;
      }),
      archiveCompletedTasks: () => set((state) => {
          const completedTasks = state.tasks.filter(tk => tk.isCompleted && !tk.isArchived);
          if (completedTasks.length === 0) return state;
          
          const updatedTasks = state.tasks.map(tk => {
              if (tk.isCompleted && !tk.isArchived) {
                  const updated = { ...tk, isArchived: true };
                  get().enqueueOffline('update', updated);
                  return updated;
              }
              return tk;
          });
          return { tasks: updatedTasks };
      }),"""
        
        # We need to find deleteTask: (id) => set((state) => { ... })
        # This is a bit tricky with regex, so we'll just insert it before clearTasks
        
        insert_idx = content.find("clearTasks: () =>")
        if insert_idx != -1:
            methods_to_insert = """
      archiveTask: (id) => set((state) => {
          const t = state.tasks.find(tk => tk.id === id);
          if (t) {
              const updated = { ...t, isArchived: true };
              get().enqueueOffline('update', updated);
              return { tasks: state.tasks.map(tk => tk.id === id ? updated : tk) };
          }
          return state;
      }),
      archiveCompletedTasks: () => set((state) => {
          const completedTasks = state.tasks.filter(tk => tk.isCompleted && !tk.isArchived);
          if (completedTasks.length === 0) return state;
          
          const updatedTasks = state.tasks.map(tk => {
              if (tk.isCompleted && !tk.isArchived) {
                  const updated = { ...tk, isArchived: true };
                  // Queue offline update for each archived task
                  get().enqueueOffline('update', updated);
                  return updated;
              }
              return tk;
          });
          return { tasks: updatedTasks };
      }),
      """
            content = content[:insert_idx] + methods_to_insert + content[insert_idx:]

    with open('store/useTaskStore.ts', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Updated useTaskStore.ts with archive functionality!")

update_store()
