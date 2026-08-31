/**
 * BİLDİRİM İZNİ — sistem diyaloğu bağlamsız açılmaz.
 *
 * ÖLÇÜLEN SORUN: `_layout` girişten hemen sonra `requestNotificationPermissions()`
 * çağırıyordu, yani sistem diyaloğunu açıyordu. Kullanıcı henüz tek görev bile
 * eklememişken "TAZQ size bildirim göndermek istiyor" penceresini görüyordu ve ne
 * göndereceğimiz yazmıyordu.
 *
 * iOS'ta o pencere kullanıcı başına BİR KEZ açılabilir. Reddedilirse uygulama bir
 * daha SORAMAZ — sabah özeti, akşam özeti, görev ve alışkanlık hatırlatıcıları
 * kalıcı olarak kapanır. Yani bağlamsız sorulan tek bir soru, tutundurma
 * özelliklerinin tamamını kapatabiliyordu.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !l.trim().startsWith('//')).join('\n');

const LAYOUT = stripComments(read('app/_layout.tsx'));
const NOTIFS = read('shared/utils/notifications.ts');
const PRIMER = read('shared/components/NotificationPrimer.tsx');

describe('okuma ile isteme AYRI fonksiyon', () => {
  it('durum okuyan fonksiyon diyaloğu AÇMAZ', () => {
    const fn = NOTIFS.slice(
      NOTIFS.indexOf('export async function getNotificationPermissionStatus'),
      NOTIFS.indexOf('export async function requestNotificationPermissions'),
    );
    expect(fn).toContain('getPermissionsAsync');
    expect(fn).not.toContain('requestPermissionsAsync');
  });

  it('üç durumu da ayırt eder — "sorulmadı" ile "reddedildi" aynı şey değil', () => {
    const fn = NOTIFS.slice(
      NOTIFS.indexOf('export async function getNotificationPermissionStatus'),
      NOTIFS.indexOf('export async function requestNotificationPermissions'),
    );
    expect(fn).toContain("'granted'");
    expect(fn).toContain("'undetermined'");
    expect(fn).toContain("'denied'");
  });
});

describe('_layout artık izin İSTEMİYOR', () => {
  it('açılışta yalnız mevcut durumu okur', () => {
    expect(LAYOUT).toContain('getNotificationPermissionStatus().then(setNotifPermission)');
  });

  it('izin isteme YALNIZ ön-bilgilendirmenin onay düğmesinde', () => {
    const calls = [...LAYOUT.matchAll(/requestNotificationPermissions\(\)/g)];
    expect(calls.length).toBe(1);
    const ctx = LAYOUT.slice(Math.max(0, calls[0].index! - 400), calls[0].index!);
    expect(ctx).toContain('onEnable');
  });

  it('brief zamanlaması izin VARSA çalışır', () => {
    expect(LAYOUT).toContain("if (notifPermission !== 'granted') return;");
  });
});

describe('ön-bilgilendirme ne zaman çıkar', () => {
  it('hatırlatılacak bir şey varken — girişte değil', () => {
    const block = LAYOUT.slice(LAYOUT.indexOf('const showNotifPrimer'), LAYOUT.indexOf('const showNotifPrimer') + 400);
    expect(block).toContain('tasks.length > 0');
  });

  it('yalnız bir kez', () => {
    const block = LAYOUT.slice(LAYOUT.indexOf('const showNotifPrimer'), LAYOUT.indexOf('const showNotifPrimer') + 400);
    expect(block).toContain('!notifPrimerSeen');
  });

  it('"reddedildi" durumunda GÖSTERİLMEZ — sistem zaten sormamıza izin vermiyor', () => {
    const block = LAYOUT.slice(LAYOUT.indexOf('const showNotifPrimer'), LAYOUT.indexOf('const showNotifPrimer') + 400);
    expect(block).toContain("notifPermission === 'undetermined'");
  });

  it('tercihler hidrate olmadan gösterilmez — yoksa her açılışta çıkardı', () => {
    const block = LAYOUT.slice(LAYOUT.indexOf('const showNotifPrimer'), LAYOUT.indexOf('const showNotifPrimer') + 400);
    expect(block).toContain('prefsHydrated');
  });
});

describe('iki çıkışın ikisi de bayrağı yazar', () => {
  it('"aç" seçildiğinde', () => {
    const usage = LAYOUT.slice(LAYOUT.indexOf('<NotificationPrimer'), LAYOUT.indexOf('<NotificationPrimer') + 800);
    const enable = usage.slice(usage.indexOf('onEnable'), usage.indexOf('onDismiss'));
    expect(enable).toContain('setNotifPrimerSeen(true)');
  });

  it('"şimdi değil" seçildiğinde — bir daha sorulmaz', () => {
    const usage = LAYOUT.slice(LAYOUT.indexOf('<NotificationPrimer'), LAYOUT.indexOf('<NotificationPrimer') + 800);
    const dismiss = usage.slice(usage.indexOf('onDismiss'));
    expect(dismiss).toContain('setNotifPrimerSeen(true)');
  });

  it('"şimdi değil" sistem diyaloğunu AÇMAZ — tek hak durur', () => {
    const usage = LAYOUT.slice(LAYOUT.indexOf('<NotificationPrimer'), LAYOUT.indexOf('<NotificationPrimer') + 800);
    const dismiss = usage.slice(usage.indexOf('onDismiss'));
    expect(dismiss).not.toContain('requestNotificationPermissions');
  });

  it('sonuç durumu geri yazılır — brief\'ler aynı oturumda kurulsun', () => {
    const usage = LAYOUT.slice(LAYOUT.indexOf('<NotificationPrimer'), LAYOUT.indexOf('<NotificationPrimer') + 800);
    expect(usage).toContain('setNotifPermission(');
  });
});

describe('ekran ne göndereceğimizi SAYAR', () => {
  const { translations } = require('@/shared/constants/i18n');

  it('üç bildirim türünü tek tek anlatır — her iki dilde', () => {
    for (const lang of ['tr', 'en'] as const) {
      const d = translations[lang].notifPrimer;
      for (const k of ['morningTitle', 'morningSub', 'taskTitle', 'taskSub', 'eveningTitle', 'eveningSub'] as const) {
        expect(typeof d[k]).toBe('string');
        expect(d[k].length).toBeGreaterThan(3);
      }
    }
    // Ekran üçünü de çiziyor
    expect(PRIMER).toContain('t.morningTitle');
    expect(PRIMER).toContain('t.taskTitle');
    expect(PRIMER).toContain('t.eveningTitle');
  });

  it('kapatılabilir olduğunu söyler', () => {
    expect(translations.tr.notifPrimer.sub).toContain('ayarlardan tek tek kapatabilirsin');
    expect(translations.en.notifPrimer.sub).toContain('turn each one off in settings');
  });

  it('"şimdi değil" ne olacağını açıklar (ekran okuyucu dahil)', () => {
    expect(PRIMER).toContain('accessibilityHint={t.dismissHint}');
    expect(translations.tr.notifPrimer.dismissHint).toContain('Sistem izin penceresi açılmaz');
    expect(translations.en.notifPrimer.dismissHint).toContain('will not appear');
  });

  it('iki düğmenin ikisinin de erişilebilir etiketi var', () => {
    expect(PRIMER).toContain('accessibilityLabel={t.enable}');
    expect(PRIMER).toContain('accessibilityLabel={t.dismiss}');
  });

  it('ham emoji taşımaz — çizgisel ikon kullanır', () => {
    expect(PRIMER).toContain("from 'lucide-react-native'");
    expect(PRIMER).not.toMatch(/'[^']*\p{Extended_Pictographic}[^']*'/u);
    for (const lang of ['tr', 'en'] as const) {
      for (const v of Object.values(translations[lang].notifPrimer)) {
        expect(String(v)).not.toMatch(/\p{Extended_Pictographic}/u);
      }
    }
  });

  it('metinler i18n sözlüğünde — bileşende satır içi çeviri yok', () => {
    expect(PRIMER).toContain('useLanguageStore(s2 => s2.t).notifPrimer');
    expect(PRIMER).not.toMatch(/\btr \? '/);
  });
});

describe('tercih bulutla eşitlenir', () => {
  it('notifPrimerSeen eşitleme listesinde — cihaz değiştiren kullanıcıya tekrar sorulmaz', () => {
    const prefs = read('features/modes/store/usePrefsStore.ts');
    expect(prefs).toContain("'notifPrimerSeen',");
  });
});
