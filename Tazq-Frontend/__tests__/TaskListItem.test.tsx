import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { MemoizedTaskItem } from '@/features/tasks/components/TaskListItem';
import type { Task } from '@/features/tasks/store/useTaskStore';
import { Colors } from '@/shared/constants/Colors';
import { translations } from '@/shared/constants/i18n';
import { rowHint, bulkSelectHint } from '@/shared/utils/a11y';

/**
 * Görev satırı — görevler ekranının en çok dokunulan parçası.
 *
 * tasks.tsx'ten çıkarıldı. Dokunuşun ne yaptığı kipe göre değişiyor (aç / seç / kilo
 * gir) ve bu ayrım yalnız elle denenebiliyordu; buradaki testler onu sabitliyor.
 */

const theme = Colors.light;
const baseTask: Task = {
  id: 7,
  title: 'Sunumu bitir',
  description: '',
  isCompleted: false,
  priority: 'High',
  tags: [],
};

const setup = (over: Partial<React.ComponentProps<typeof MemoizedTaskItem>> = {}) => {
  const handlers = {
    handleDelete: jest.fn(),
    handleToggleExpand: jest.fn(),
    handleLongPress: jest.fn(),
    handleBulkSelect: jest.fn(),
    handleToggle: jest.fn(),
    toggleSubtask: jest.fn(),
  };
  const utils = render(
    <MemoizedTaskItem
      task={baseTask}
      i={0}
      theme={theme}
      isDark={false}
      highlightedId={null}
      isBulkMode={false}
      isSelected={false}
      language="tr"
      t={translations.tr}
      showSwipePeek={false}
      priorityColor={() => theme.priorityHigh}
      completingIds={new Set()}
      expandedId={null}
      sortBy="creation"
      modeInfo={null}
      {...handlers}
      {...over}
    />,
  );
  return { ...utils, ...handlers };
};

describe('TaskListItem', () => {
  it('başlığı gösterir', () => {
    expect(setup().getByText('Sunumu bitir')).toBeTruthy();
  });

  it('normal kipte dokunuş satırı açar — tamamlamaz, seçmez', () => {
    const { getByRole, handleToggleExpand, handleToggle, handleBulkSelect } = setup();
    fireEvent.press(getByRole('button', { name: /Sunumu bitir/ }));
    expect(handleToggleExpand).toHaveBeenCalledWith(7);
    expect(handleToggle).not.toHaveBeenCalled();
    expect(handleBulkSelect).not.toHaveBeenCalled();
  });

  it('toplu seçim kipinde dokunuş SEÇER — yanlışlıkla açılıp kapanmaz', () => {
    const { getByRole, handleBulkSelect, handleToggleExpand } = setup({ isBulkMode: true });
    fireEvent.press(getByRole('button', { name: /Sunumu bitir/ }));
    expect(handleBulkSelect).toHaveBeenCalledWith(7);
    expect(handleToggleExpand).not.toHaveBeenCalled();
  });

  it('uzun basış toplu seçimi başlatır', () => {
    const { getByRole, handleLongPress } = setup();
    fireEvent(getByRole('button', { name: /Sunumu bitir/ }), 'longPress');
    expect(handleLongPress).toHaveBeenCalledWith(7);
  });

  it('tamamlanma durumu ekran okuyucuya da söylenir', () => {
    const row = setup({ task: { ...baseTask, isCompleted: true } }).getByRole('button', { name: /Sunumu bitir/ });
    expect(row.props.accessibilityState).toMatchObject({ checked: true });
  });

  it('ipucu kipe göre değişir', () => {
    expect(setup().getByRole('button', { name: /Sunumu bitir/ }).props.accessibilityHint).toBe(rowHint('tr'));
    expect(setup({ isBulkMode: true }).getByRole('button', { name: /Sunumu bitir/ }).props.accessibilityHint)
      .toBe(bulkSelectHint('tr'));
  });
});
