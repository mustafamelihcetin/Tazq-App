/**
 * MİSAFİR MODU — hesapsız kullanım.
 *
 * ── ÖLÇÜLEN SORUN ─────────────────────────────────────────────────────────────
 * Onboarding'in sonunda kullanıcı doğrudan /login'e atılıyordu. Bir yapılacaklar
 * uygulamasını DENEMEK için önce e-posta, şifre ve 13-yaş onayı isteniyordu.
 * Oysa uygulamanın çekirdeği (görev · alışkanlık · odak) zaten offline-first ve
 * yerel store'larla çalışıyor — sunucu gerektirmiyordu. Kayıt duvarı teknik bir
 * zorunluluk değil, yalnızca bir varsayımdı.
 *
 * ── SÖZLEŞME ──────────────────────────────────────────────────────────────────
 *  1. Misafirken hiçbir istek sunucuya GİTMEZ (api.ts kapısı).
 *  2. Yapılan her şey kuyruğa yazılır ve kayıt olunca yeni hesaba AKAR.
 *     "Denerken yaptıkların kaybolur" durumu YOK — kaydolmamanın en yaygın sebebi
 *     tam olarak bu korkudur.
 *  3. Sunucu gerektiren yüzeyler (yaşam modları) misafire GÖSTERİLMEZ; açıp
 *     çalışmadığını göstermektense hiç göstermemek dürüsttür.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !l.trim().startsWith('//')).join('\n');

describe('auth store — misafir durumu', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('varsayılan misafir DEĞİL', () => {
    const { useSessionStore } = require('@/shared/store/useSessionStore');
    expect(useSessionStore.getState().isGuest).toBe(false);
  });

  it('startGuest misafirliğe geçirir', () => {
    const { useAuthStore } = require('@/features/user/store/useAuthStore');
    const { useSessionStore } = require('@/shared/store/useSessionStore');
    useAuthStore.getState().startGuest();
    expect(useSessionStore.getState().isGuest).toBe(true);
    // Misafir "giriş yapmış" SAYILMAZ — token yok, sunucu yok
    expect(useAuthStore.getState().isLoggedIn).toBe(false);
    expect(useAuthStore.getState().token).toBeNull();
  });

  it('gerçek hesap gelince misafirlik BİTER', () => {
    const { useAuthStore } = require('@/features/user/store/useAuthStore');
    const { useSessionStore } = require('@/shared/store/useSessionStore');
    useAuthStore.getState().startGuest();
    useAuthStore.getState().setAuth({ id: 1, name: 'A', email: 'a@b.c' } as any, 'tok');
    expect(useSessionStore.getState().isGuest).toBe(false);
    expect(useAuthStore.getState().isLoggedIn).toBe(true);
  });

  it('çıkışta da misafirlik biter — arada kalmış durum olmaz', () => {
    const { useAuthStore } = require('@/features/user/store/useAuthStore');
    const { useSessionStore } = require('@/shared/store/useSessionStore');
    useAuthStore.getState().startGuest();
    useAuthStore.getState().logout();
    expect(useSessionStore.getState().isGuest).toBe(false);
  });

  it('misafirlik uygulama kapanınca BİTMEZ — kalıcı', () => {
    const src = read('shared/store/useSessionStore.ts');
    expect(src).toContain("name: 'tazq-session-storage'");
    expect(src).toContain('partialize');
  });

  it('misafirlik biterken YEREL VERİ silinmez — kayıt olmak "sıfırdan başla" değil', () => {
    const src = stripComments(read('features/user/store/useAuthStore.ts'));
    // İlk geçiş tip bildirimi (`endGuest: () => void;`), uygulama ikinci geçişte.
    const impl = src.indexOf('endGuest: () => useSessionStore');
    expect(impl).toBeGreaterThan(-1);
    const fn = src.slice(impl, impl + 160);
    expect(fn).toContain('setGuest(false)');
    expect(fn).not.toContain('clearLocalUserData');
  });

  it('bayrak SHARED katmanında — mimari yön korunuyor', () => {
    /*
      Bayrağı okuması gereken üç yer de altyapı ve üçü de `shared`: api.ts,
      useOfflineSync, BottomNavBar. `useAuthStore`dan okumaları `shared → features`
      yönünde üç YENİ bağımlılık demekti (bkz. architecture.test.ts). Bayrak burada
      yaşıyor, `useAuthStore` yazıyor — tek kaynak, doğru yön.
    */
    for (const f of ['shared/services/api.ts', 'shared/hooks/useOfflineSync.ts', 'shared/components/BottomNavBar.tsx']) {
      expect(read(f)).toContain("from '@/shared/store/useSessionStore'");
      // Misafir bayrağı ASLA features'tan okunmaz
      expect(read(f)).not.toContain('useAuthStore.getState().isGuest');
      expect(read(f)).not.toMatch(/useAuthStore\(\s*s\d? => s\d?\.isGuest/);
    }
    // useOfflineSync ve BottomNavBar bu tur YENİ bir features bağımlılığı EKLEMEDİ.
    // (api.ts'in useAuthStore importu önceden vardı: oturum jetonunu okuyor.)
    expect(read('shared/components/BottomNavBar.tsx')).not.toContain('useAuthStore');
  });
});

describe('sunucuya istek GİTMEZ', () => {
  const API = read('shared/services/api.ts');

  it('istek interceptor\'ı misafirde erken atar', () => {
    const block = API.slice(API.indexOf('api.interceptors.request.use'), API.indexOf('api.interceptors.request.use') + 400);
    expect(block).toContain('if (isGuestSession()) throw guestModeError();');
  });

  it('kapı token EKLEMEDEN önce çalışır — hiçbir kimlik sızmaz', () => {
    const block = API.slice(API.indexOf('api.interceptors.request.use'), API.indexOf('api.interceptors.request.use') + 400);
    expect(block.indexOf('isGuest')).toBeLessThan(block.indexOf('Authorization'));
  });

  it('hata AĞ HATASI şeklinde — mevcut offline-first yolu devreye girsin', () => {
    // `response` YOK → isNetworkError(e) true → çağıranlar işlemi kuyruğa alır
    const fn = API.slice(API.indexOf('function guestModeError'), API.indexOf('function guestModeError') + 300);
    expect(fn).not.toContain('response');
    expect(fn).toContain('code');
  });

  it('misafir kapısı "bağlantı yok" bandını AÇMAZ — kullanıcı çevrimiçi', () => {
    expect(API).toContain('if (error?.code === GUEST_MODE_ERROR_CODE) return Promise.reject(error);');
    const idx = API.indexOf('GUEST_MODE_ERROR_CODE) return Promise.reject');
    const offlineIdx = API.indexOf('isLikelyConnectivityError(error)', idx);
    expect(idx).toBeLessThan(offlineIdx);
  });
});

describe('kuyruk BEKLETİLİR, silinmez', () => {
  const SYNC = stripComments(read('shared/hooks/useOfflineSync.ts'));

  it('misafirken kuyruk işlenmez', () => {
    expect(SYNC).toContain('if (isGuest) return;');
  });

  it('kuyruk misafirken TEMİZLENMEZ — kayıt olunca akacak', () => {
    const gate = SYNC.slice(SYNC.indexOf('if (isGuest) return;') - 200, SYNC.indexOf('if (isGuest) return;') + 200);
    expect(gate).not.toContain('clear');
    expect(gate).not.toContain('dequeue');
  });

  it('misafirlik bitince efekt YENİDEN koşar', () => {
    expect(SYNC).toContain('}, [isOnline, isGuest]);');
  });
});

describe('yönlendirme — misafir uygulamayı kullanabilir', () => {
  const LAYOUT = stripComments(read('app/_layout.tsx'));

  it('giriş ekranına ZORLANMAZ', () => {
    expect(LAYOUT).toContain("else if (!isLoggedIn && !isGuest && onboardingDone === 'true'");
  });

  it('muhafız misafirlik değişiminde yeniden değerlendirir', () => {
    expect(LAYOUT).toContain('[_hasHydrated, isLoggedIn, isGuest, segments]');
  });
});

describe('giriş noktaları', () => {
  it('onboarding\'in SON adımında var — duvarın hemen önünde', () => {
    const src = read('app/onboarding.tsx');
    expect(src).toContain('currentIndex === SLIDES.length - 1 && (');
    expect(src).toContain('useAuthStore.getState().startGuest()');
    expect(src).toContain('t.guest.tryWithoutAccount');
  });

  it('giriş ekranında var ve artık TURA değil uygulamaya götürüyor', () => {
    const src = read('app/login.tsx');
    expect(src).toContain('startGuest(); router.replace(\'/\')');
    // Eski davranış: kullanıcıyı tanıtım turuna geri gönderiyordu
    expect(src).not.toContain("router.push('/onboarding')");
  });

  it('ikisinde de ekran okuyucu için ne olacağı yazılı', () => {
    expect(read('app/onboarding.tsx')).toContain('accessibilityHint={t.guest.tryHint}');
    expect(read('app/login.tsx')).toContain('accessibilityHint={t.guest.tryHint}');
  });
});

describe('"kaydedildi" mesajı sebebine göre doğru', () => {
  it('misafire "çevrimdışısın" DENMEZ — interneti var', () => {
    const src = read('shared/utils/saveFeedback.ts');
    expect(src).toContain('isGuestSession() ? t.guest.savedLocally : t.savedOffline');
  });

  it('iki durum AYRI cümle — kullanıcı için farklı şey demek', () => {
    const { translations } = require('@/shared/constants/i18n');
    for (const lang of ['tr', 'en'] as const) {
      expect(translations[lang].guest.savedLocally).not.toBe(translations[lang].savedOffline);
    }
    expect(translations.tr.guest.savedLocally).toBe('Bu cihaza kaydedildi');
    expect(translations.en.guest.savedLocally).toBe('Saved on this device');
  });

  it('11 kopya kalmadı — tek yerden geliyor', () => {
    for (const f of ['app/index.tsx', 'app/tasks.tsx']) {
      expect(read(f)).not.toContain("'Çevrimdışı kaydedildi'");
      expect(read(f)).toContain('savedLocallyMessage()');
    }
  });
});

describe('misafirin yaptığı iş KAYBOLMAZ', () => {
  it('görev oluşturma ağ-hatası yolundan kuyruğa giriyor', () => {
    // Misafir kapısı `response`suz hata atar → isNetworkError(e) true → bu dal çalışır
    const src = read('app/tasks.tsx');
    // OLUŞTURMA yolunun catch dalı (silme yolunun aynı koşulu daha yukarıda).
    const marker = "enqueueOffline({ type: 'create-task', tempId, payload: safePayload })";
    const idx = src.indexOf(marker);
    expect(idx).toBeGreaterThan(-1);
    const before = src.slice(Math.max(0, idx - 600), idx);
    expect(before).toContain('if (isNetworkError(err)) {');
    // İyimser yerel kayıt da yapılıyor — ekranda görev DURUR
    expect(src.slice(idx, idx + 300)).toContain('addTask(');
  });

  it('isNetworkError misafir hatasını AĞ hatası sayıyor', () => {
    const { isNetworkError } = require('@/shared/utils/errors');
    const e = new Error('Guest mode: request not sent') as Error & { code: string };
    e.code = 'TAZQ_GUEST_MODE';
    expect(isNetworkError(e)).toBe(true);
  });
});

describe('sunucu gerektiren yüzeyler', () => {
  it('modlar sekmesi misafire gösterilmez', () => {
    const nav = stripComments(read('shared/components/BottomNavBar.tsx'));
    expect(nav).toMatch(/uiMode === 'lite' \|\| isGuest/);
  });

  it('misafirde görev/odak sekmeleri KALIR — çekirdek yerel çalışıyor', () => {
    const nav = read('shared/components/BottomNavBar.tsx');
    expect(nav).toContain("LITE_TAB_IDS = ['home', 'tasks', 'focus']");
  });

  it('ayarlarda "çıkış" yerine "hesap oluştur" görünür', () => {
    const src = stripComments(read('app/settings.tsx'));
    expect(src).toContain('{isGuest ? (');
    expect(src).toContain('t.guest.keepMyData');
  });

  it('metin verinin KALACAĞINI açıkça söyler', () => {
    const { translations } = require('@/shared/constants/i18n');
    expect(translations.tr.guest.keepMyData).toContain('verilerim kalsın');
    expect(translations.en.guest.keepMyData).toContain('keep my data');
    expect(translations.tr.guest.tryHint).toContain('hiçbir şey kaybolmaz');
    expect(translations.en.guest.tryHint).toContain('without losing anything');
  });
});
