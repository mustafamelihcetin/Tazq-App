import fs from 'fs';
import path from 'path';
import {
  requestNotificationPermissions,
  scheduleTaskNotification,
  cancelTaskNotification,
  scheduleShutdownNotification,
  cancelAllNotifications,
} from '@/shared/utils/notifications';

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

/**
 * HATIRLATICI SÖZÜ — sessizce bozulmamalı.
 *
 * `scheduleTaskNotification` izin KONTROLÜ YAPMIYORDU. Kullanıcı "Hatırlatıcı"
 * anahtarını açıyor, anahtar yeşile dönüyor, güvende hissediyor; ama bildirim izni
 * reddedilmişse planlama hiçbir şey yapmıyor ve kimse söylemiyordu.
 *
 * Bu, hatanın en kötü türü: kullanıcı hatırlatılacağını sandığı için ayrıca bir yere
 * not da almıyor. Yani uygulama yalnız görevi değil, kullanıcının yedeğini de siliyor.
 */
describe('bildirim izni — sessiz başarısızlık yok', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'shared/utils/notifications.ts'), 'utf8');

  it('planlamadan ÖNCE izin kontrol edilir', () => {
    expect(src).toContain('if (!(await hasNotificationPermission())) return null;');
  });

  it('kontrol izin İSTEMEZ — yalnız mevcut durumu okur', () => {
    // İzin istemek bir görev kaydedilirken kullanıcıyı beklemediği bir sistem
    // diyaloguyla karşılardı. `requestPermissionsAsync` bu yolda çağrılmamalı.
    const fn = src.match(/export async function hasNotificationPermission[\s\S]*?\n\}/)?.[0] ?? '';
    expect(fn).not.toBe('');
    expect(fn).toContain('getPermissionsAsync');
    expect(fn).not.toContain('requestPermissionsAsync');
  });
});

/**
 * BİLDİRİM MAHREMİYETİ — kilit ekranı herkese açık bir ekrandır.
 *
 * Bildirimin gövdesine kullanıcının yazdığı HAM başlık giriyor ve bildirim kilit
 * ekranında çıkıyor; yanındaki herkes okuyabiliyor. Kullanıcı o metni kendisi için
 * yazmıştı.
 *
 * Çözüm bir içerik SÜZGECİ DEĞİL: metin kullanıcının kendi cihazında kendisine
 * gösteriliyor, kimseyi rahatsız etmiyor. Küfür süzgeci hem vesayetçi olurdu hem de
 * Türkçede güvenilir çalışmaz. Üstelik risk küfürle sınırlı değil — "Doktor: test
 * sonucu", "Ayrılık konuşması", "Kredi başvurusu" aynı kapıdan sızıyor.
 * Doğru olan kararı KULLANICIYA vermek.
 */
describe('bildirim mahremiyeti', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'shared/utils/notifications.ts'), 'utf8');
  const prefs = fs.readFileSync(
    path.join(__dirname, '..', 'features/modes/store/usePrefsStore.ts'), 'utf8');
  const settings = fs.readFileSync(
    path.join(__dirname, '..', 'app/settings.tsx'), 'utf8');

  it('içerik gizlenebiliyor', () => {
    expect(src).toContain('hideContent: boolean = false');
    expect(src).toMatch(/hideContent\s*\?\s*\(isTR \? 'Bir görevinin zamanı geldi'/);
  });

  it('varsayılan AÇIK içerik — gizlemek tercih, dayatma değil', () => {
    // Çoğu kişi hatırlatmanın NE olduğunu görmek ister.
    expect(src).toContain('hideContent: boolean = false');
    expect(prefs).toContain('hideNotificationContent: false,');
  });

  it('kullanıcı bulabilsin — ayarlarda görünür anahtar', () => {
    // Ayarlarda görünmeyen bir tercih, olmayan tercihtir.
    expect(settings).toContain('setHideNotificationContent');
    expect(settings).toMatch(/'Bildirimde içeriği gizle'/);
  });

  it('içerik SÜZGECİ yok — kullanıcının kendi metnini sansürlemiyoruz', () => {
    // Küfür/argo listesi eklenirse burası kırılır; karar bilinçliydi.
    // Yorumlar hariç: gerekçe metninde bu kelimelerden SÖZ etmek serbest.
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
      .join('\n');
    expect(code).not.toMatch(/profanity|badWords|censor|sanitizeTitle/i);
  });
});
