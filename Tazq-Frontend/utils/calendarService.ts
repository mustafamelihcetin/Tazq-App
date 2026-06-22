import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

export interface CalendarTask {
  id: number;
  title: string;
  description?: string;
  dueDate?: string | null;
  dueTime?: string | null;
}

export interface CalendarSyncResult {
  success: boolean;
  eventId?: string;
  error?: string;
}

// ─── Permission ───────────────────────────────────────────────────────────────

export async function requestCalendarPermissions(): Promise<boolean> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === 'granted';
}

export async function getCalendarPermissionStatus(): Promise<Calendar.PermissionStatus> {
  const { status } = await Calendar.getCalendarPermissionsAsync();
  return status;
}

// ─── Calendar Selection ───────────────────────────────────────────────────────

async function getTazqCalendar(): Promise<string | null> {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);

  // Prefer a calendar named Tazq we created previously
  const existing = calendars.find(c => c.title === 'Tazq' && c.allowsModifications);
  if (existing) return existing.id;

  // On iOS create a dedicated calendar; on Android use the default writable calendar
  if (Platform.OS === 'ios') {
    const defaultSource = calendars.find(c => c.source?.name === 'Default') ?? calendars[0];
    const newCalId = await Calendar.createCalendarAsync({
      title: 'Tazq',
      color: '#6366F1',
      entityType: Calendar.EntityTypes.EVENT,
      sourceId: defaultSource?.source?.id,
      source: defaultSource?.source ?? { isLocalAccount: true, name: 'Tazq', type: '' },
      name: 'Tazq',
      ownerAccount: 'personal',
      accessLevel: Calendar.CalendarAccessLevel.OWNER,
    });
    return newCalId;
  }

  // Android: find first writable calendar
  const writable = calendars.find(c => c.allowsModifications);
  return writable?.id ?? null;
}

// ─── Task → Calendar Event ────────────────────────────────────────────────────

export async function addTaskToCalendar(task: CalendarTask): Promise<CalendarSyncResult> {
  try {
    const granted = await requestCalendarPermissions();
    if (!granted) return { success: false, error: 'permission_denied' };

    const calendarId = await getTazqCalendar();
    if (!calendarId) return { success: false, error: 'no_calendar' };

    const startDate = buildEventDate(task.dueDate, task.dueTime);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // default 1 hour

    const eventId = await Calendar.createEventAsync(calendarId, {
      title: task.title,
      notes: task.description ?? '',
      startDate,
      endDate,
      alarms: [{ relativeOffset: -30 }], // 30 min before
    });

    return { success: true, eventId };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'unknown' };
  }
}

export async function removeTaskFromCalendar(eventId: string): Promise<boolean> {
  try {
    await Calendar.deleteEventAsync(eventId);
    return true;
  } catch {
    return false;
  }
}

export async function updateTaskInCalendar(
  eventId: string,
  task: Partial<CalendarTask>
): Promise<boolean> {
  try {
    const patch: Partial<Calendar.Event> = {};
    if (task.title) patch.title = task.title;
    if (task.description !== undefined) patch.notes = task.description ?? '';
    if (task.dueDate) {
      const startDate = buildEventDate(task.dueDate, task.dueTime);
      patch.startDate = startDate;
      patch.endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    }
    await Calendar.updateEventAsync(eventId, patch);
    return true;
  } catch {
    return false;
  }
}

// ─── Focus Block → Calendar Event ─────────────────────────────────────────────

export async function addFocusBlockToCalendar(
  taskTitle: string,
  startDate: Date,
  durationMinutes: number
): Promise<CalendarSyncResult> {
  try {
    const granted = await requestCalendarPermissions();
    if (!granted) return { success: false, error: 'permission_denied' };

    const calendarId = await getTazqCalendar();
    if (!calendarId) return { success: false, error: 'no_calendar' };

    const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

    const eventId = await Calendar.createEventAsync(calendarId, {
      title: `🎯 ${taskTitle}`,
      notes: 'Tazq odak seansı',
      startDate,
      endDate,
    });

    return { success: true, eventId };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'unknown' };
  }
}

// ─── Upcoming Events (for future calendar view integration) ──────────────────

export async function getUpcomingEvents(days = 7): Promise<Calendar.Event[]> {
  try {
    const granted = await requestCalendarPermissions();
    if (!granted) return [];

    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const calendarIds = calendars.filter(c => c.allowsModifications).map(c => c.id);

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    const events = await Calendar.getEventsAsync(calendarIds, startDate, endDate);
    return events;
  } catch {
    return [];
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildEventDate(dueDateStr?: string | null, dueTimeStr?: string | null): Date {
  const base = dueDateStr ? new Date(dueDateStr + 'T00:00:00') : new Date();
  if (dueTimeStr) {
    const t = new Date(dueTimeStr);
    base.setHours(t.getHours(), t.getMinutes(), 0, 0);
  } else {
    base.setHours(9, 0, 0, 0); // default 09:00
  }
  return base;
}
