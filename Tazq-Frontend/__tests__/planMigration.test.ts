import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Mocks (jest.mock factory yalnızca `mock` önekli değişkenlere erişebilir) ────
const mockDeleteTask = jest.fn((_id: number) => Promise.resolve());
const mockRemoveTask = jest.fn();
const mockSetPlanIds = jest.fn();
let mockTasks: any[] = [];
let mockPrefsState: any = {};

jest.mock('@/shared/services/api', () => ({
  TaskService: { deleteTask: (id: number) => mockDeleteTask(id) },
}));
jest.mock('@/features/tasks/store/useTaskStore', () => ({
  useTaskStore: { getState: () => ({ tasks: mockTasks, removeTask: mockRemoveTask }) },
}));
jest.mock('@/features/modes/store/usePrefsStore', () => ({
  usePrefsStore: { getState: () => ({ ...mockPrefsState, setPlanIds: mockSetPlanIds }) },
}));

import { runPlanMigrationOnce } from '@/shared/utils/planMigration';

const iso = (daysFromNow: number) => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString();
};

const emptyPlanIds = {
  examPlanTaskIds: [], examPlanHabitIds: [],
  exam2PlanTaskIds: [], exam2PlanHabitIds: [],
  exam3PlanTaskIds: [], exam3PlanHabitIds: [],
  tezPlanTaskIds: [], tezPlanHabitIds: [],
  mulakatPlanTaskIds: [], mulakatPlanHabitIds: [],
  mulakat2PlanTaskIds: [], mulakat2PlanHabitIds: [],
  mulakat3PlanTaskIds: [], mulakat3PlanHabitIds: [],
  sporPlanTaskIds: [], sporPlanHabitIds: [],
  spor2PlanTaskIds: [], spor2PlanHabitIds: [],
  spor3PlanTaskIds: [], spor3PlanHabitIds: [],
  ramazanPlanTaskIds: [], ramazanPlanHabitIds: [],
};

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockTasks = [];
  mockPrefsState = { ...emptyPlanIds };
});

describe('planMigration - runPlanMigrationOnce', () => {
  it('deletes future-dated, incomplete plan tasks but keeps today/tomorrow & completed', async () => {
    mockTasks = [
      { id: 1, dueDate: iso(0), isCompleted: false },    // bugün → kal
      { id: 2, dueDate: iso(1), isCompleted: false },    // yarın → kal
      { id: 3, dueDate: iso(30), isCompleted: false },   // gelecek → sil
      { id: 4, dueDate: iso(400), isCompleted: false },  // çok ileri → sil
      { id: 5, dueDate: iso(60), isCompleted: true },    // tamamlanmış → kal
      { id: 6, dueDate: null, isCompleted: false },      // tarihsiz → kal
    ];
    mockPrefsState = { ...emptyPlanIds, examPlanTaskIds: [1, 2, 3, 4, 5, 6], examPlanHabitIds: ['h1'] };

    await runPlanMigrationOnce();

    expect(mockRemoveTask).toHaveBeenCalledWith(3);
    expect(mockRemoveTask).toHaveBeenCalledWith(4);
    expect(mockRemoveTask).not.toHaveBeenCalledWith(1);
    expect(mockRemoveTask).not.toHaveBeenCalledWith(5);
    expect(mockDeleteTask).toHaveBeenCalledTimes(2);
    expect(mockSetPlanIds).toHaveBeenCalledWith('exam', ['h1'], [1, 2, 5, 6]);
  });

  it('does not touch tasks that are not in any plan id list', async () => {
    mockTasks = [{ id: 99, dueDate: iso(400), isCompleted: false }];
    mockPrefsState = { ...emptyPlanIds };

    await runPlanMigrationOnce();

    expect(mockRemoveTask).not.toHaveBeenCalled();
    expect(mockDeleteTask).not.toHaveBeenCalled();
  });

  it('runs only once (sets a flag)', async () => {
    mockTasks = [{ id: 3, dueDate: iso(30), isCompleted: false }];
    mockPrefsState = { ...emptyPlanIds, sporPlanTaskIds: [3], sporPlanHabitIds: [] };

    await runPlanMigrationOnce();
    expect(mockRemoveTask).toHaveBeenCalledTimes(1);

    mockRemoveTask.mockClear();
    await runPlanMigrationOnce();
    expect(mockRemoveTask).not.toHaveBeenCalled();
  });
});
