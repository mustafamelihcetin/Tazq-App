import fs from 'fs';
import path from 'path';
import { TOUR_STEPS, AUTO_START_PAGES } from '@/features/onboarding/tour/tourSteps';
import { holePath, placeTip, spotRect } from '@/features/onboarding/tour/spotlightGeometry';

/**
 * TANITIM TURU — standartlar (2026-10-25 yeniden kuruldu).
 *
 * Kaynaklar: driver.js / react-native-copilot / shepherd (gerçek öğe vurgulanır),
 * react-joyride (ilerleme, tek atla, beacon), Apple HIG Onboarding + TipKit (kısa),
 * M3 Rich tooltip (Android). Eski tur sahte önizleme çiziyordu: gece "Günaydın, Deniz
 * · 84" — kullanıcının ekranıyla çelişen bir şey anlatılıyordu.
 */

const ROOT = path.join(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const PAGE_FILE: Record<string, string[]> = {
  // Kart hedefleri kartın KENDİ bileşeninde (delik kart kenarına birebir oturur).
  dashboard: ['app/index.tsx', 'features/dashboard/components/TodayRings.tsx', 'features/modes/components/ModeTodayCard.tsx'],
  // 'list' artık listenin İLK SATIRI (tasks.tsx → TaskListItem tourId).
  tasks: ['app/tasks.tsx', 'shared/components/MagneticFAB.tsx'],
  focus: ['app/focus.tsx'],
  modlar: ['app/modlar.tsx'],
  cockpit: ['app/cockpit.tsx'],
};

describe('adımlar gerçek öğeleri işaret eder', () => {
  it.each(Object.entries(TOUR_STEPS))('%s: her hedef sayfada TourTarget olarak var', (page, steps) => {
    const src = PAGE_FILE[page].map(read).join('\n');
    for (const s of steps) {
      const asTarget = src.includes(`<TourTarget id="${s.target}"`);
      const asFab = src.includes(`tourId="${s.target}"`) || src.includes(`tourId={i === 0 ? '${s.target}'`);
      expect({ page, target: s.target, found: asTarget || asFab }).toEqual({ page, target: s.target, found: true });
    }
  });
});

describe('kısa — kullanıcı bunalmaz (HIG / TipKit)', () => {
  const all = Object.values(TOUR_STEPS).flat();

  it('sayfa başına en fazla 5 adım; toplam 16\'yı geçmez (eskisi 18)', () => {
    for (const steps of Object.values(TOUR_STEPS)) expect(steps.length).toBeLessThanOrEqual(5);
    expect(all.length).toBeLessThanOrEqual(16);
  });

  it('her açıklama TEK cümle ve kısa (≤ 90 karakter)', () => {
    for (const s of all) {
      for (const text of [s.body.tr, s.body.en]) {
        expect({ text, len: text.length <= 90 }).toEqual({ text, len: true });
        expect({ text, sentences: text.replace(/[.!?]$/, '').split(/[.!?] /).length }).toEqual({ text, sentences: 1 });
      }
    }
  });

  it('başlıklar 3 kelimeyi geçmez', () => {
    for (const s of all) for (const t of [s.title.tr, s.title.en]) expect(t.split(' ').length).toBeLessThanOrEqual(3);
  });

  it('yalnız ana sayfa kendiliğinden açılır (kullanıcı kararı)', () => {
    expect([...AUTO_START_PAGES]).toEqual(['dashboard']);
  });
});

describe('vurgulama geometrisi', () => {
  const screen = { width: 360, height: 780 };

  it('delik hedefi pay kadar büyütür ve ekrandan taşmaz', () => {
    const r = spotRect({ x: 2, y: 100, width: 356, height: 80 }, 8, screen, { top: 24, bottom: 0 });
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.x + r.width).toBeLessThanOrEqual(screen.width);
    expect(r.y).toBe(92);
    expect(r.height).toBe(96);
  });

  it('çok uzun hedef görünür alana kırpılır (liste gibi)', () => {
    const r = spotRect({ x: 16, y: 200, width: 328, height: 2000 }, 8, screen, { top: 24, bottom: 100 });
    expect(r.y + r.height).toBeLessThanOrEqual(screen.height - 100);
  });

  it('delik yolu dış dikdörtgen + yuvarlak delik (evenodd)', () => {
    const d = holePath({ x: 10, y: 20, width: 100, height: 50 }, 12, screen);
    expect(d.startsWith('M0 0H360V780H0Z')).toBe(true);
    expect(d).toContain('A12 12');
  });

  it('altta yer varsa balon hedefin ALTINDA, yoksa ÜSTÜNDE', () => {
    const top = placeTip({ x: 16, y: 100, width: 328, height: 80 }, 140, screen, { top: 24, bottom: 90 }, 12);
    expect(top.side).toBe('below');
    expect(top.y).toBe(192);
    const low = placeTip({ x: 16, y: 560, width: 328, height: 80 }, 140, screen, { top: 24, bottom: 90 }, 12);
    expect(low.side).toBe('above');
    expect(low.y).toBe(560 - 12 - 140);
  });

  it('iki yanda da yer yoksa balon görünür alanın dibine yaslanır, ekrandan taşmaz', () => {
    const t = placeTip({ x: 16, y: 40, width: 328, height: 700 }, 140, screen, { top: 24, bottom: 90 }, 12);
    expect(t.y + 140).toBeLessThanOrEqual(screen.height - 90);
    expect(t.y).toBeGreaterThanOrEqual(24);
  });
});

describe('balon her ekrana uyar (telefon → tablet)', () => {
  const { placeTipX } = require('@/features/onboarding/tour/spotlightGeometry');
  it.each([[320], [360], [393], [430], [768], [1024], [1366]])('%ipt genişlikte ekrandan taşmaz', (w) => {
    for (const hx of [0, w / 2 - 20, w - 40]) {
      const t = placeTipX({ x: hx, y: 0, width: 40, height: 40 }, w, 16, 360, 12);
      expect(t.x).toBeGreaterThanOrEqual(16);
      expect(t.x + t.width).toBeLessThanOrEqual(w - 16);
      expect(t.width).toBeLessThanOrEqual(360);
      expect(t.arrowX).toBeGreaterThanOrEqual(18);
      expect(t.arrowX).toBeLessThanOrEqual(t.width - 18);
    }
  });
  it('tablette balon hedefin ortasına hizalanır (ekranın ortasına değil)', () => {
    const t = placeTipX({ x: 100, y: 0, width: 200, height: 40 }, 1024, 16, 360, 12);
    expect(t.x + t.width / 2).toBe(200);
  });
});

describe('delik köşeleri bölüme göre — kartın içinde kesik bırakmaz', () => {
  /*
    Cihazda görüldü: alışkanlıklar bölümü kartın ÜST yarısı; delik dört köşeden yuvarlak
    çizilince alt köşelerde kartın içine kesik açıyordu (kart orada bitmiyor).
  */
  const screen = { width: 360, height: 780 };
  const r = { x: 10, y: 20, width: 100, height: 50 };
  it('yalnız üst köşeler yuvarlak', () => {
    const d = holePath(r, 12, screen, 'top');
    // alt köşeler keskin: (110,70) ve (10,70) noktalarından düz geçer
    expect(d).toContain('V70H10');
    expect(d).toContain('A12 12 0 0 1 22 20');
  });
  it('yalnız alt köşeler yuvarlak', () => {
    const d = holePath(r, 12, screen, 'bottom');
    expect(d).toContain('M10 20H110');
  });
  it('varsayılan dört köşe', () => {
    expect(holePath(r, 12, screen)).toBe(holePath(r, 12, screen, 'all'));
  });
});

describe('başlıktaki hedef — sayfa en üste kaydırılır', () => {
  it('core (logo) adımı scrollTop taşır ve tur bunu uygular', () => {
    const core = TOUR_STEPS.dashboard.find((s) => s.target === 'core');
    expect(core?.scrollTop).toBe(true);
    const src = fs.readFileSync(path.join(ROOT, 'features/onboarding/components/SpotlightTour.tsx'), 'utf8');
    expect(src).toMatch(/if \(step\.scrollTop\) \{\s*[\s\S]*?scrollTo\(\{ y: 0/);
  });
});

describe('tur teklifi kendiliğinden kaybolmaz', () => {
  // Cihazda görüldü: 10 sn'lik zamanlayıcı teklifi kapatıp turu "tamamlandı" sayıyordu;
  // dokunulduğu an kaybolunca dokunuş alttaki karta düşüyordu (WCAG 2.2.1).
  it('TourBeacon zamanlayıcı kurmuyor', () => {
    const src = require('fs').readFileSync(require('path').resolve(__dirname, '../features/onboarding/components/TourBeacon.tsx'), 'utf8');
    expect(src).not.toMatch(/setTimeout\(/);
  });
});
