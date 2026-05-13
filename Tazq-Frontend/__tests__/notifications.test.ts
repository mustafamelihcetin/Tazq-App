import {
  requestNotificationPermissions,
  scheduleTaskNotification,
  cancelTaskNotification,
  scheduleShutdownNotification,
  cancelAllNotifications,
} from '../utils/notifications';

describe('notifications (Expo Go mock)', () => {
  it('requestPermissions always returns false in mock mode', async () => {
    const result = await requestNotificationPermissions();
    expect(result).toBe(false);
  });

  it('scheduleTaskNotification returns null in mock mode', async () => {
    const result = await scheduleTaskNotification(1, 'Test Task', '2026-05-15', null, 'tr');
    expect(result).toBeNull();
  });

  it('cancelTaskNotification does not throw', async () => {
    await expect(cancelTaskNotification(1)).resolves.not.toThrow();
  });

  it('scheduleShutdownNotification does not throw', async () => {
    await expect(scheduleShutdownNotification(5, 'en')).resolves.not.toThrow();
  });

  it('cancelAllNotifications does not throw', async () => {
    await expect(cancelAllNotifications()).resolves.not.toThrow();
  });
});
