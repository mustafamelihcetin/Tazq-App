import * as Calendar from 'expo-calendar/legacy';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { swallow } from './swallow';

export async function requestCalendarPermissions(): Promise<boolean> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === 'granted';
}

async function getOrCreateTazqCalendarId(): Promise<string | null> {
  try {
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const existing = calendars.find((c: any) => c.title === 'TAZQ' || c.name === 'TAZQ');
    if (existing) return existing.id;

    // Permissions check
    const hasPerm = await requestCalendarPermissions();
    if (!hasPerm) return null;

    if (Platform.OS === 'android') {
      try {
        return await Calendar.createCalendarAsync({
          title: 'TAZQ',
          color: '#6366F1',
          entityType: Calendar.EntityTypes.EVENT,
          sourceId: '1',
          source: {
            name: 'TAZQ Tasks',
            isLocalAccount: true,
            type: 'LOCAL',
          },
          name: 'TAZQ',
          ownerAccount: 'personal',
          accessLevel: Calendar.CalendarAccessLevel.OWNER,
        });
      } catch (err) {
        swallow('calendarSync.createAndroidCalendar', err);
        const defaultCal = await Calendar.getDefaultCalendarAsync();
        return defaultCal?.id || null;
      }
    } else {
      // iOS: find default local source
      try {
        const localSource = calendars.find((c: any) => c.source.type === 'local') || calendars[0];
        return await Calendar.createCalendarAsync({
          title: 'TAZQ',
          color: '#6366F1',
          entityType: Calendar.EntityTypes.EVENT,
          sourceId: localSource?.source.id,
          name: 'TAZQ',
          ownerAccount: 'personal',
        });
      } catch (err) {
        swallow('calendarSync.createIosCalendar', err);
        const defaultCal = await Calendar.getDefaultCalendarAsync();
        return defaultCal?.id || null;
      }
    }
  } catch (error) {
    swallow('calendarSync.getOrCreateCalendar', error);
    try {
      const defaultCal = await Calendar.getDefaultCalendarAsync();
      return defaultCal?.id || null;
    } catch {
      return null;
    }
  }
}

export async function syncTaskToCalendar(task: { id: number; title: string; dueDate?: string | null; dueTime?: string | null; recurrence?: string | null }): Promise<void> {
  try {
    const isSyncEnabled = await AsyncStorage.getItem('tazq_calendar_sync_enabled');
    if (isSyncEnabled !== 'true') return;

    if (!task.dueDate) return; // Only sync tasks that have a date!

    const calendarId = await getOrCreateTazqCalendarId();
    if (!calendarId) return;

    // Setup start and end dates
    const startDate = new Date(task.dueDate);
    if (task.dueTime) {
      // Parse hour and minute safely
      const parts = task.dueTime.split('T')[1]?.split(':');
      if (parts) {
        startDate.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
      }
    } else {
      startDate.setHours(9, 0, 0, 0); // Default to 9:00 AM
    }
    const endDate = new Date(startDate);
    endDate.setHours(startDate.getHours() + 1); // 1 hour duration

    // Recurrence rule
    let recurrenceRule: Calendar.RecurrenceRule | undefined;
    if (task.recurrence && task.recurrence !== 'None') {
      let frequency: Calendar.Frequency;
      if (task.recurrence === 'Daily') frequency = Calendar.Frequency.DAILY;
      else if (task.recurrence === 'Weekly') frequency = Calendar.Frequency.WEEKLY;
      else frequency = Calendar.Frequency.MONTHLY;

      recurrenceRule = {
        frequency,
        interval: 1,
      };
    }

    // Check if event already exists
    const eventKey = `tazq_cal_event_${task.id}`;
    const existingEventId = await AsyncStorage.getItem(eventKey);

    const eventDetails = {
      title: task.title,
      startDate,
      endDate,
      timeZone: 'GMT',
      notes: 'TAZQ tarafından otomatik senkronize edilmiştir.',
      recurrenceRule,
    };

    if (existingEventId) {
      try {
        await Calendar.updateEventAsync(existingEventId, eventDetails);
        return;
      } catch {
        // Event was deleted from native calendar, fall through to create new one
      }
    }

    const newEventId = await Calendar.createEventAsync(calendarId, eventDetails);
    await AsyncStorage.setItem(eventKey, newEventId);
  } catch (error) {
    swallow('calendarSync.syncTaskToCalendar', error, { capture: true });
  }
}

export async function deleteTaskFromCalendar(taskId: number): Promise<void> {
  try {
    const eventKey = `tazq_cal_event_${taskId}`;
    const eventId = await AsyncStorage.getItem(eventKey);
    if (eventId) {
      await Calendar.deleteEventAsync(eventId);
      await AsyncStorage.removeItem(eventKey);
    }
  } catch (error) {
    swallow('calendarSync.deleteTaskFromCalendar', error);
  }
}

export async function bulkExportTasksToCalendar(tasks: any[]): Promise<{ success: boolean; fallback: boolean }> {
  try {
    const calendarId = await getOrCreateTazqCalendarId();
    if (!calendarId) return { success: false, fallback: false };

    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const hasTazq = calendars.some((c: any) => c.title === 'TAZQ' || c.name === 'TAZQ');

    for (const task of tasks) {
      if (!task.isCompleted && task.dueDate) {
        await syncTaskToCalendar(task);
      }
    }
    return { success: true, fallback: !hasTazq };
  } catch (error) {
    swallow('calendarSync.bulkExport', error, { capture: true });
    return { success: false, fallback: false };
  }
}
