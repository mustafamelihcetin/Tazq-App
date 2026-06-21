import { useOfflineQueue, OfflineOp } from '../store/useOfflineQueue';

beforeEach(() => {
  useOfflineQueue.setState({ ops: [] });
});

describe('useOfflineQueue', () => {
  describe('enqueue', () => {
    it('adds a toggle-task op', () => {
      const op: OfflineOp = { type: 'toggle-task', id: 1, isCompleted: true, completedAt: '2026-06-21T10:00:00.000Z' };
      useOfflineQueue.getState().enqueue(op);
      expect(useOfflineQueue.getState().ops).toHaveLength(1);
      expect(useOfflineQueue.getState().ops[0]).toEqual(op);
    });

    it('adds a delete-task op', () => {
      useOfflineQueue.getState().enqueue({ type: 'delete-task', id: 42 });
      expect(useOfflineQueue.getState().ops[0].type).toBe('delete-task');
    });

    it('adds a reorder-tasks op', () => {
      useOfflineQueue.getState().enqueue({ type: 'reorder-tasks', ids: [3, 1, 2] });
      const op = useOfflineQueue.getState().ops[0];
      expect(op.type).toBe('reorder-tasks');
      if (op.type === 'reorder-tasks') expect(op.ids).toEqual([3, 1, 2]);
    });

    it('adds an update-task op with arbitrary payload', () => {
      useOfflineQueue.getState().enqueue({ type: 'update-task', id: 7, payload: { title: 'Updated', priority: 'High' } });
      const op = useOfflineQueue.getState().ops[0];
      expect(op.type).toBe('update-task');
      if (op.type === 'update-task') expect(op.payload).toEqual({ title: 'Updated', priority: 'High' });
    });

    it('preserves FIFO order across multiple enqueues', () => {
      useOfflineQueue.getState().enqueue({ type: 'toggle-task', id: 1, isCompleted: true, completedAt: null });
      useOfflineQueue.getState().enqueue({ type: 'delete-task', id: 2 });
      useOfflineQueue.getState().enqueue({ type: 'update-task', id: 3, payload: {} });

      const ops = useOfflineQueue.getState().ops;
      expect(ops).toHaveLength(3);
      expect(ops[0].type).toBe('toggle-task');
      expect(ops[1].type).toBe('delete-task');
      expect(ops[2].type).toBe('update-task');
    });

    it('allows duplicate ops (same task toggled offline twice)', () => {
      useOfflineQueue.getState().enqueue({ type: 'toggle-task', id: 5, isCompleted: true, completedAt: null });
      useOfflineQueue.getState().enqueue({ type: 'toggle-task', id: 5, isCompleted: false, completedAt: null });
      expect(useOfflineQueue.getState().ops).toHaveLength(2);
    });
  });

  describe('dequeue', () => {
    beforeEach(() => {
      // Seed 4 ops
      useOfflineQueue.getState().enqueue({ type: 'toggle-task', id: 1, isCompleted: true, completedAt: null });
      useOfflineQueue.getState().enqueue({ type: 'delete-task', id: 2 });
      useOfflineQueue.getState().enqueue({ type: 'delete-task', id: 3 });
      useOfflineQueue.getState().enqueue({ type: 'update-task', id: 4, payload: {} });
    });

    it('removes the first N ops (FIFO)', () => {
      useOfflineQueue.getState().dequeue(2);
      const ops = useOfflineQueue.getState().ops;
      expect(ops).toHaveLength(2);
      expect(ops[0]).toMatchObject({ type: 'delete-task', id: 3 });
    });

    it('dequeue(1) removes only the oldest op', () => {
      useOfflineQueue.getState().dequeue(1);
      expect(useOfflineQueue.getState().ops).toHaveLength(3);
      expect(useOfflineQueue.getState().ops[0]).toMatchObject({ type: 'delete-task', id: 2 });
    });

    it('dequeue with count >= length empties the queue', () => {
      useOfflineQueue.getState().dequeue(100);
      expect(useOfflineQueue.getState().ops).toHaveLength(0);
    });

    it('dequeue(0) leaves queue unchanged', () => {
      useOfflineQueue.getState().dequeue(0);
      expect(useOfflineQueue.getState().ops).toHaveLength(4);
    });
  });

  describe('clear', () => {
    it('removes all ops at once', () => {
      useOfflineQueue.getState().enqueue({ type: 'delete-task', id: 1 });
      useOfflineQueue.getState().enqueue({ type: 'delete-task', id: 2 });
      useOfflineQueue.getState().clear();
      expect(useOfflineQueue.getState().ops).toHaveLength(0);
    });

    it('is safe to call on empty queue', () => {
      expect(() => useOfflineQueue.getState().clear()).not.toThrow();
      expect(useOfflineQueue.getState().ops).toHaveLength(0);
    });
  });

  describe('replay-style batch processing', () => {
    it('processes all ops then clears — simulating sync flush', () => {
      useOfflineQueue.getState().enqueue({ type: 'toggle-task', id: 10, isCompleted: true, completedAt: '2026-06-21' });
      useOfflineQueue.getState().enqueue({ type: 'delete-task', id: 11 });

      const ops = [...useOfflineQueue.getState().ops];
      expect(ops).toHaveLength(2);

      // Simulate: process each op, then clear
      const processed: string[] = [];
      ops.forEach(op => processed.push(op.type));
      useOfflineQueue.getState().dequeue(ops.length);

      expect(processed).toEqual(['toggle-task', 'delete-task']);
      expect(useOfflineQueue.getState().ops).toHaveLength(0);
    });

    it('partial flush leaves remaining ops intact', () => {
      for (let i = 0; i < 5; i++) {
        useOfflineQueue.getState().enqueue({ type: 'delete-task', id: i });
      }

      // Flush first 3, leave 2 (simulating a partial network failure)
      useOfflineQueue.getState().dequeue(3);
      expect(useOfflineQueue.getState().ops).toHaveLength(2);
      if (useOfflineQueue.getState().ops[0].type === 'delete-task') {
        expect((useOfflineQueue.getState().ops[0] as any).id).toBe(3);
      }
    });
  });
});
