import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TaskFormModal } from '@/features/tasks/components/TaskFormModal';
import { Colors } from '@/shared/constants/Colors';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@react-native-community/datetimepicker', () => {
  const Picker = () => null;
  return { __esModule: true, default: Picker, DateTimePickerAndroid: { open: jest.fn() } };
});
jest.mock('@/shared/utils/voice', () => ({ __esModule: true, default: { start: jest.fn(), stop: jest.fn(() => Promise.resolve()), destroy: jest.fn() } }));

/**
 * CİHAZDA GÖRÜLDÜ (2026-10-25): düzenleme sırasında form sayfası kayboldu ve yazılanlar
 * silindi. Açılış etkisi görev NESNESİNE bağlıydı; Görevler ekranı nesneyi her çizimde
 * `tasks.find(...)` ile yeniden buluyor. Arka plan eşitlemesi listeyi yenileyince aynı
 * görevin yeni bir kopyası gelir → form sıfırlanır, sayfa gizlenir, yazılanlar gider.
 */
const t = { addTask: 'Yeni Görev', editTask: 'Görevi Düzenle', taskTitle: 'Başlık', taskDescription: 'Açıklama', filterLow: 'Düşük', filterMedium: 'Orta', filterHigh: 'Yüksek', recurrenceNone: 'Yok', recurrenceDaily: 'Her Gün', recurrenceWeekly: 'Her Hafta', recurrenceMonthly: 'Her Ay', listeningLabel: 'Dinleniyor' };
const base = { id: 7, title: 'Sunumu bitir', description: '', priority: 'High', dueDate: null, dueTime: null, tags: [], subtasks: [], recurrence: 'None' };

const props = { visible: true, onClose: jest.fn(), onSave: jest.fn(() => Promise.resolve()), theme: Colors.light, isDark: false, language: 'tr', t };

describe('düzenleme formu eşitlemede sıfırlanmaz', () => {
  it('aynı görevin yeni kopyası gelince yazılan başlık kalır', () => {
    const view = render(<TaskFormModal {...props} task={{ ...base }} />);
    fireEvent.changeText(view.getByDisplayValue('Sunumu bitir'), 'Sunumu bitir ve gönder');
    view.rerender(<TaskFormModal {...props} task={{ ...base }} />);
    expect(view.getByDisplayValue('Sunumu bitir ve gönder')).toBeTruthy();
  });

  it('BAŞKA bir görev açılınca form o görevle dolar', () => {
    const view = render(<TaskFormModal {...props} task={{ ...base }} />);
    view.rerender(<TaskFormModal {...props} task={{ ...base, id: 8, title: 'Faturayı öde' }} />);
    expect(view.getByDisplayValue('Faturayı öde')).toBeTruthy();
  });
});
