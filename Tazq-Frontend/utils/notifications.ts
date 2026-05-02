/**
 * Tazq Smart Local Notifications (Mocked for Expo Go Stability)
 * This file is temporarily mocked to prevent SDK 53+ crashes in Expo Go.
 */

// import * as Notifications from 'expo-notifications'; // DISABLED FOR EXPO GO

export async function requestNotificationPermissions(): Promise<boolean> {
  console.log('[Notifications] Mocked permission request');
  return false;
}

export async function scheduleTaskNotification(
  taskId: number,
  title: string,
  dueDate?: string | null,
  dueTime?: string | null,
  locale: string = 'en'
): Promise<string | null> {
  return null;
}

export async function cancelTaskNotification(taskId: number): Promise<void> {
  return;
}

export async function scheduleShutdownNotification(
  pendingCount: number,
  locale: string = 'en'
): Promise<void> {
  return;
}

export async function cancelAllNotifications(): Promise<void> {
  return;
}
