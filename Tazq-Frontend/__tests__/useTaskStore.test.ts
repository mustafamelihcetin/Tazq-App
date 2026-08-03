import { useTaskStore } from '@/features/tasks';
import type { Task } from '@/features/tasks';

/*
  ALT GÖREV SENKRONU SAHTELENİYOR — bu dosya STORE mantığını sınıyor, ağı değil.

  `toggleSubtask` artık işaretlemeyi sunucuya da yazıyor (800 ms gecikmeli). Sahtelenmezse
  zamanlayıcı test bittikten SONRA ateşleniyor ve Jest ortamı kapandığı için şu uyarıyı
  üretiyordu:

    "You are trying to `import` a file after the Jest environment has been torn down"

  Uyarı testi düşürmüyor ama iki gerçek sorunu gizliyor: test gerçek bir ağ isteği
  denemesi yapıyor (yavaş ve kırılgan) ve ortam kapandıktan sonra çalışan kod, ileride
  açıklaması zor hatalar üretir.

  Kalıcılık davranışı ayrıca `subtaskSync.test.ts`'te sınanıyor.
*/
jest.mock('@/features/tasks/utils/subtaskSync', () => ({
  persistSubtasks: jest.fn(),
  flushPendingSubtasks: jest.fn(),
}));

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: Math.floor(Math.random() * 10000),
  title: 'Test Task',
  description: '',
  isCompleted: false,
  priority: 'Medium',
  tags: [],
  subtasks: [],
  ...overrides,
});

beforeEach(() => {
  useTaskStore.setState({ tasks: [], isLoading: false, dailyProgressText: '' });
});

describe('useTaskStore', () => {
  it('addTask inserts task', () => {
    const task = makeTask({ title: 'New Task' });
    useTaskStore.getState().addTask(task);
    expect(useTaskStore.getState().tasks).toHaveLength(1);
    expect(useTaskStore.getState().tasks[0].title).toBe('New Task');
  });

  it('removeTask deletes by id', () => {
    const task = makeTask({ id: 42 });
    useTaskStore.setState({ tasks: [task] });
    useTaskStore.getState().removeTask(42);
    expect(useTaskStore.getState().tasks).toHaveLength(0);
  });

  it('toggleTaskCompletion flips isCompleted', () => {
    const task = makeTask({ id: 1, isCompleted: false });
    useTaskStore.setState({ tasks: [task] });
    useTaskStore.getState().toggleTaskCompletion(1);
    expect(useTaskStore.getState().tasks[0].isCompleted).toBe(true);
  });

  it('updateTask patches fields', () => {
    const task = makeTask({ id: 5, title: 'Old' });
    useTaskStore.setState({ tasks: [task] });
    useTaskStore.getState().updateTask(5, { title: 'New' });
    expect(useTaskStore.getState().tasks[0].title).toBe('New');
  });

  it('setTasks sorts: incomplete before complete', () => {
    const done = makeTask({ id: 1, isCompleted: true, priority: 'High' });
    const todo = makeTask({ id: 2, isCompleted: false, priority: 'Low' });
    useTaskStore.getState().setTasks([done, todo]);
    expect(useTaskStore.getState().tasks[0].isCompleted).toBe(false);
  });

  it('setTasks sorts: High priority before Low', () => {
    const low = makeTask({ id: 1, isCompleted: false, priority: 'Low' });
    const high = makeTask({ id: 2, isCompleted: false, priority: 'High' });
    useTaskStore.getState().setTasks([low, high]);
    expect(useTaskStore.getState().tasks[0].priority).toBe('High');
  });

  it('toggleSubtask flips subtask done state', () => {
    const task = makeTask({ id: 10, subtasks: [{ text: 'step 1', done: false }] });
    useTaskStore.setState({ tasks: [task] });
    useTaskStore.getState().toggleSubtask(10, 0);
    expect(useTaskStore.getState().tasks[0].subtasks![0].done).toBe(true);
  });
});
