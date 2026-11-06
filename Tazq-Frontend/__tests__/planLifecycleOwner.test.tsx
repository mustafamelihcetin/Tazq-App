/**
 * KÖK NEDEN (2026-11-06): kancanın her örneği kendi öne geliş dinleyicisini kuruyordu; dokuz örnek = aynı anda dokuz görev.
 * Gerçek kanca ve gerçek kademeli açılımla: kaç örnek bağlı olursa olsun öne gelişte tek görev.
 */
import React from 'react';
import fs from 'fs';
import path from 'path';
import { AppState } from 'react-native';
import { render, act } from '@testing-library/react-native';
import { usePlanAdaptations } from '@/features/modes/hooks/usePlanAdaptations';
import { useStagedPlanStore } from '@/features/modes/store/useStagedPlanStore';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { useHabitStore, fmtDateKey } from '@/features/habits/store/useHabitStore';
import { useTaskStore } from '@/features/tasks/store/useTaskStore';
import { useAuthStore } from '@/features/user';
import { TaskService } from '@/shared/services/api';

let createTask: jest.SpyInstance;
const yesterday = fmtDateKey(new Date(Date.now() - 86400000));

function Instance({ lifecycle }: { lifecycle?: boolean }) {
  usePlanAdaptations(lifecycle ? { lifecycle: true } : undefined);
  return null;
}
const entry = (title: string) => ({ kind: 'task' as const, item: { titleTr: title, titleEn: title, priority: 'High', tags: ['exam'] } });
const settle = async () => { for (let i = 0; i < 20; i += 1) await act(async () => { await new Promise((r) => setImmediate(r)); }); };

describe('plan motorunun yaşam döngüsü', () => {
  let listeners: ((s: string) => void)[] = [];

  beforeEach(() => {
    listeners = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, fn: (s: string) => void) => {
      listeners.push(fn);
      return { remove: () => { listeners = listeners.filter((l) => l !== fn); } };
    }) as never);
    createTask = jest.spyOn(TaskService, 'createTask');
    createTask.mockResolvedValue({ id: 99 } as never);
    useAuthStore.setState({ user: { id: 1 } } as never);
    useStagedPlanStore.getState().reset();
    useTaskStore.setState({ tasks: [] });
    useHabitStore.setState({ habits: [{ id: 'h1', name: 'Çalışma', emoji: 'x', color: '#000', completedDates: [yesterday], createdAt: '' }] } as never);
    usePrefsStore.getState().setSeasonalPref('examMode' as never, true as never);
    usePrefsStore.getState().setPlanIds('exam', ['h1'], []);
  });
  afterEach(() => jest.restoreAllMocks());

  const mountNine = () => render(
    <>
      <Instance lifecycle />
      {Array.from({ length: 8 }, (_, i) => <Instance key={i} />)}
    </>,
  );

  it('dokuz örnekte öne geliş dinleyicisi bir tane', () => {
    mountNine();
    expect(listeners).toHaveLength(1);
  });

  it('dokuz örnek bağlıyken art arda öne gelişlerde tek görev, sıradaki öğeler kaybolmaz', async () => {
    useStagedPlanStore.getState().setQueue('exam', [entry('Kaynak kitap temin et'), entry('Çıkmış soruları indir'), entry('Üçüncü')]);
    mountNine();
    await settle();
    for (let i = 0; i < 3; i += 1) {
      act(() => { listeners.forEach((l) => l('active')); });
      await settle();
    }
    const created = createTask.mock.calls.map((c: unknown[]) => (c[0] as { title: string }).title).filter((t: string) => t === 'Kaynak kitap temin et');
    expect(created).toHaveLength(1);
    expect(useStagedPlanStore.getState().queues.exam.items.map((e) => (e.item as { titleTr: string }).titleTr)).toEqual(['Çıkmış soruları indir', 'Üçüncü']);
  });

  it('yalnız kök düzen sahip olur', () => {
    const root = path.join(__dirname, '..');
    const owners: string[] = [];
    const walk = (dir: string) => {
      for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, f.name);
        if (f.isDirectory()) walk(p);
        else if (/\.tsx?$/.test(f.name) && fs.readFileSync(p, 'utf8').includes('lifecycle: true')) owners.push(path.relative(root, p).replace(/\\/g, '/'));
      }
    };
    ['app', 'features', 'shared'].forEach((d) => walk(path.join(root, d)));
    expect(owners).toEqual(['app/_layout.tsx']);
  });
});

describe('sıradan düşürme', () => {
  it('aynı öğe iki kez onaylansa da başka öğe silinmez', () => {
    const a = entry('A');
    const b = entry('B');
    useStagedPlanStore.getState().setQueue('exam', [a, b]);
    useStagedPlanStore.getState().commitAt('exam', a, '2026-11-06');
    useStagedPlanStore.getState().commitAt('exam', a, '2026-11-06');
    expect(useStagedPlanStore.getState().queues.exam.items).toEqual([b]);
  });
});
