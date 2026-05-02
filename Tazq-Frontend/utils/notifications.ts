/**
 * Tazq Smart Local Notifications
 * Schedules local notifications for task due dates/times.
 * Uses expo-notifications — no server required.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request notification permissions from the user.
 * Returns true if granted.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Notifications] Permission not granted');
      return false;
    }

    // Android needs a notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('tazq-reminders', {
        name: 'Tazq Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#94aaff',
        sound: 'default',
      });
    }

    return true;
  } catch (e) {
    console.log('[Notifications] Permission request failed:', e);
    return false;
  }
}

/**
 * Schedule a notification for a task.
 * Schedules at exact due time, and 15 minutes before if possible.
 */
export async function scheduleTaskNotification(
  taskId: number,
  title: string,
  dueDate?: string | null,
  dueTime?: string | null,
  locale: string = 'en'
): Promise<string | null> {
  try {
    // Cancel any existing notifications for this task
    await cancelTaskNotification(taskId);

    if (!dueDate && !dueTime) return null;

    // Calculate the target date/time
    let targetDate: Date;
    
    if (dueTime && dueTime.includes('T')) {
      // Use the exact time from dueTime
      targetDate = new Date(dueTime);
      if (dueDate) {
        const dateParts = dueDate.split('T')[0].split('-');
        targetDate.setFullYear(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
      }
    } else if (dueDate) {
      // Only date set — notify at 9 AM
      targetDate = new Date(dueDate);
      targetDate.setHours(9, 0, 0, 0);
    } else {
      return null;
    }

    const now = new Date();
    
    // Don't schedule for past dates
    if (targetDate <= now) return null;

    const secondsUntil = Math.floor((targetDate.getTime() - now.getTime()) / 1000);
    if (secondsUntil <= 0) return null;

    const isTR = locale.startsWith('tr');
    const bodyText = isTR ? `"${title}" şimdi zamanı geldi!` : `"${title}" is due now!`;
    const titleText = isTR ? 'Tazq Hatırlatma' : 'Tazq Reminder';

    // Schedule main notification
    const notifId = await Notifications.scheduleNotificationAsync({
      content: {
        title: titleText,
        body: bodyText,
        sound: 'default',
        data: { taskId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: secondsUntil,
      },
    });

    // Schedule 15-min early notification if > 15 min away
    const earlySeconds = secondsUntil - 900;
    if (earlySeconds > 60) {
      const earlyBody = isTR ? `"${title}" 15 dakika içinde başlıyor` : `"${title}" coming up in 15 minutes`;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `⏰ ${titleText}`,
          body: earlyBody,
          sound: 'default',
          data: { taskId, early: true },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: earlySeconds,
        },
      });
    }

    return notifId;
  } catch (e) {
    console.log('[Notifications] Schedule failed:', e);
    return null;
  }
}

/**
 * Cancel all notifications for a specific task.
 */
export async function cancelTaskNotification(taskId: number): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of scheduled) {
      if ((notif.content.data as any)?.taskId === taskId) {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }
  } catch (e) {
    console.log('[Notifications] Cancel failed:', e);
  }
}

/**
 * Cancel all scheduled notifications.
 */
export async function cancelAllNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (e) {
    console.log('[Notifications] Cancel all failed:', e);
  }
}
