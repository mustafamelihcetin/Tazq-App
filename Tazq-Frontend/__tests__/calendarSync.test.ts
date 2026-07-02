import { requestCalendarPermissions, syncTaskToCalendar, deleteTaskFromCalendar } from '@/shared/utils/calendarSync';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Calendar from 'expo-calendar';

jest.mock('expo-calendar', () => ({
  requestCalendarPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getCalendarsAsync: jest.fn().mockResolvedValue([{ title: 'TAZQ', id: 'tazq-cal-id', source: { id: 'source-1', type: 'local' } }]),
  createCalendarAsync: jest.fn().mockResolvedValue('tazq-cal-id'),
  createEventAsync: jest.fn().mockResolvedValue('event-123'),
  updateEventAsync: jest.fn().mockResolvedValue(null),
  deleteEventAsync: jest.fn().mockResolvedValue(null),
  EntityTypes: { EVENT: 'event' },
  Frequency: { DAILY: 'daily', WEEKLY: 'weekly', MONTHLY: 'monthly' },
  CalendarAccessLevel: { OWNER: 'owner' },
}));

describe('CalendarSync utility', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('requests calendar permissions successfully', async () => {
    const granted = await requestCalendarPermissions();
    expect(granted).toBe(true);
    expect(Calendar.requestCalendarPermissionsAsync).toHaveBeenCalled();
  });

  it('does not sync task if calendar sync is disabled', async () => {
    await AsyncStorage.setItem('tazq_calendar_sync_enabled', 'false');
    const task = { id: 1, title: 'Test Task', dueDate: '2026-07-01' };
    await syncTaskToCalendar(task);
    expect(Calendar.getCalendarsAsync).not.toHaveBeenCalled();
  });

  it('syncs task and creates event if calendar sync is enabled', async () => {
    await AsyncStorage.setItem('tazq_calendar_sync_enabled', 'true');
    const task = { id: 1, title: 'Test Task', dueDate: '2026-07-01', recurrence: 'None' };
    await syncTaskToCalendar(task);
    expect(Calendar.getCalendarsAsync).toHaveBeenCalled();
    expect(Calendar.createEventAsync).toHaveBeenCalledWith('tazq-cal-id', expect.objectContaining({
      title: 'Test Task',
    }));
  });

  it('updates existing event if event ID exists in storage', async () => {
    await AsyncStorage.setItem('tazq_calendar_sync_enabled', 'true');
    await AsyncStorage.setItem('tazq_cal_event_1', 'event-123');
    
    const task = { id: 1, title: 'Updated Test Task', dueDate: '2026-07-01', recurrence: 'None' };
    await syncTaskToCalendar(task);
    
    expect(Calendar.updateEventAsync).toHaveBeenCalledWith('event-123', expect.objectContaining({
      title: 'Updated Test Task',
    }));
  });

  it('deletes event from calendar when deleteTaskFromCalendar is called', async () => {
    await AsyncStorage.setItem('tazq_cal_event_1', 'event-123');
    await deleteTaskFromCalendar(1);
    expect(Calendar.deleteEventAsync).toHaveBeenCalledWith('event-123');
    expect(await AsyncStorage.getItem('tazq_cal_event_1')).toBeNull();
  });
});
