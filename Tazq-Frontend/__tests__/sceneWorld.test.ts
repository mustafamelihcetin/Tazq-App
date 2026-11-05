import { worldFor, MAX_WORLD_LIGHTS, WORLD_RESULT, FOCUS_SCENES } from '@/features/focus/utils/focusScenes';

const at = (seconds: number, over: Partial<Parameters<typeof worldFor>[0]> = {}) =>
  worldFor({ isActive: true, seconds, totalSeconds: 1500, pomodoroPhase: 'work', ...over });

describe('sahne saati', () => {
  it('kare işlevi sabit: değişirse kütüphane döngüyü her çizimde yeniden kurar, sahne takılır', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '../features/focus/components/FocusBackdrop.tsx'), 'utf8');
    expect(src).toContain('useFrameCallback(onFrame, false)');
    expect(src).toMatch(/const onFrame = useCallback\(/);
  });
});

describe('sahneler her tuvale uyar', () => {
  const read = (f: string) => require('fs').readFileSync(require('path').join(__dirname, '..', f), 'utf8');
  const src = read('features/focus/components/FocusBackdrop.tsx');
  const shaders = read('features/focus/utils/sceneShaders.ts');
  it('çizim alanı aşağı yuvarlanmaz: kenarda açık zemin çizgisi kalmaz', () => {
    expect(src).toContain('Math.ceil(w * k) + 1');
    expect(src).toContain('Math.ceil(h * k) + 1');
    expect(src).toContain('backgroundColor: base[1]');
  });
  it('ağaçlar yatay tuvalde tepeden kesilmez, toplanan parçalar orana göre küçülür', () => {
    expect(shaders).toContain('scale /= min(1.0, u_res.y / u_res.x / 1.4);');
    expect(shaders.match(/min\(1\.0, H \/ 1\.4\)/g)?.length).toBeGreaterThanOrEqual(4);
  });
});

describe('Haftanın Gökyüzü', () => {
  it('parıltı kenarda kesilmez: tuval veri alanından taşar, bugün işareti köşesiz', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '../features/focus/components/WeekSky.tsx'), 'utf8');
    expect(src).toContain('width: w + OVERSCAN * 2');
    expect(src).toContain('<Oval');
    expect(src).not.toMatch(/left: \(\(?todayIdx/);
  });

  it('yalnız gök çizer: manzara ve sahnenin kendi parçacıkları kazanılmış yıldızlarla karışmaz', () => {
    const fs = require('fs'); const path = require('path');
    expect(fs.readFileSync(path.join(__dirname, '../features/focus/components/WeekSky.tsx'), 'utf8')).toContain('paused sky />');
    const src = fs.readFileSync(path.join(__dirname, '../features/focus/utils/sceneShaders.ts'), 'utf8');
    expect(src).toContain('q.y > 0.50 && u_sky < 0.5');
    expect(src).toContain('uv.y > 0.58 && u_sky < 0.5');
    expect(src).toContain('u_sky > 0.5 ? 1.02 : 0.57');
    expect(src).toContain('uv.y > 0.40 && u_sky < 0.5');
  });
});

describe('odakla büyüyen dünya', () => {
  it('seans başında dünya başlangıçta, sonunda tamamlanmış', () => {
    expect(at(1500)).toEqual({ active: true, growth: 0, lights: 0 });
    expect(at(0)).toEqual({ active: true, growth: 1, lights: 5 });
  });

  it('5 dakikada bir parça eklenir, yarı yolda dünya yarıdır', () => {
    expect(at(750)?.growth).toBeCloseTo(0.5);
    expect(at(1500 - 299)?.lights).toBe(0);
    expect(at(1500 - 300)?.lights).toBe(1);
  });

  it('boştayken sahne tam görünür: seçicide en güzel hali, parça yok', () => {
    expect(at(1500, { isActive: false })).toEqual({ active: false, growth: 1, lights: 0 });
  });

  it('duraklatınca dünya geri gitmez: ceza yok', () => {
    expect(at(750, { isActive: false })).toEqual({ active: true, growth: 0.5, lights: 2 });
  });

  it('molada dünyaya dokunulmaz', () => {
    expect(at(100, { pomodoroPhase: 'break' })).toBeNull();
  });

  it('parça sayısı sınırı aşmaz (uzun seans)', () => {
    expect(worldFor({ isActive: true, seconds: 0, totalSeconds: 4 * 3600, pomodoroPhase: 'work' })?.lights).toBe(MAX_WORLD_LIGHTS);
  });

  it('her sahnenin kendi sonuç cümlesi var, iki dilde; tamamlanınca yüzde yazmaz', () => {
    const lines = new Set<string>();
    for (const lang of ['tr', 'en'] as const) for (const sc of FOCUS_SCENES) {
      const done = WORLD_RESULT[lang][sc.id](100);
      expect(done).not.toContain('%');
      expect(WORLD_RESULT[lang][sc.id](40)).toContain('40');
      lines.add(done);
    }
    expect(lines.size).toBe(FOCUS_SCENES.length * 2);
  });
});
