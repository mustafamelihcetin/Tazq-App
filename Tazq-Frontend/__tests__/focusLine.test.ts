import { focusLineCandidates, type FocusLineContext } from '@/shared/constants/Quotes';

/*
  ODAK ALT SATIRI (2026-11-01): telkin ve motivasyon AYRI; seçim durumdan; motivasyon yalnız gerçek veriyle.
*/
const base: FocusLineContext = { phase: 'idle', task: null, sound: 'off', hour: 14, todayMin: 0, goalMin: 0, streak: 0, sessionsToday: 0 };
const texts = (c: Partial<FocusLineContext>, lang: 'tr' | 'en' = 'tr') => focusLineCandidates({ ...base, ...c }, lang);

describe('telkin / motivasyon', () => {
  it('başlamadan MOTİVASYON, seans sırasında ve molada TELKİN, son dakikalarda MOTİVASYON', () => {
    expect(texts({}).every(l => l.kind === 'motivation')).toBe(true);
    // Seans sırasında ağırlık telkinde; araya genel motivasyon girer (2026-11-01: "arada motivasyonel cümleler de").
    const focus = texts({ phase: 'focus' });
    expect(focus.filter(l => l.kind === 'suggestion').length).toBeGreaterThan(focus.filter(l => l.kind === 'motivation').length);
    expect(focus.some(l => l.kind === 'motivation')).toBe(true);
    expect(texts({ phase: 'break' }).every(l => l.kind === 'suggestion')).toBe(true);
    expect(texts({ phase: 'final' }).every(l => l.kind === 'motivation')).toBe(true);
  });

  it('motivasyon yalnız ölçülen veriyle konuşur', () => {
    expect(texts({ task: 'Türev tekrarı' }).map(l => l.t)).toContain('Sıradaki: Türev tekrarı. Gerisi bekleyebilir.');
    expect(texts({ todayMin: 30, goalMin: 50 }).map(l => l.t)).toContain('Bugün 30 dk odaklandın; hedefe 20 dk kaldı.');
    expect(texts({ todayMin: 60, goalMin: 50 }).map(l => l.t)).toContain('Bugünün hedefi tamam. Bu seans sana ekstra.');
    expect(texts({ streak: 4, todayMin: 10 }).map(l => l.t)).toContain('4 gündür her gün odaklanıyorsun. Zinciri bugün de sürdür.');
    // Veri yoksa seri/hedef cümlesi UYDURULMAZ
    expect(texts({}).some(l => /gündür|hedef/.test(l.t))).toBe(false);
  });

  it('çalan sesin telkini havuzda; gece "kısa tut"', () => {
    expect(texts({ phase: 'focus', sound: 'rain' }).map(l => l.t)).toContain('Bırak yağsın. Sen bu sayfadasın.');
    expect(texts({ phase: 'focus', hour: 23 }).map(l => l.t)).toContain('Gece sessiz. Kısa tut, sonra dinlen.');
  });

  it('İngilizce kendi diliyle yazılmış (çeviri değil)', () => {
    expect(texts({ phase: 'focus', sound: 'rain' }, 'en').map(l => l.t)).toContain('Let it rain. You’re on this page.');
    expect(texts({ phase: 'final' }, 'en')[0].t).toBe('Almost there. Stand up when the bell rings.');
  });

  it('hedef ve bu seansın dakikası: daha spesifik motivasyon', () => {
    // Kullanıcı: "kilo yönetimi ile başlayanın başında emoji var yine": ne gelirse gelsin cümleye emoji girmez, ekran da ham kaydı okumaz.
    expect(texts({ goal: { name: '⚖️ Kilo Yönetimi', days: 40 } }).map(l => l.t)).toContain('Kilo Yönetimi için 40 gün kaldı. Bugünkü seans o yolun bir adımı.');
    const focus = require('fs').readFileSync(require('path').join(__dirname, '../app/focus.tsx'), 'utf8');
    expect(focus).not.toContain('s.sporGoal');
    expect(focus).toContain('goalTitle(p, lang');
    expect(texts({ goal: { name: 'YKS', days: 212 } }).map(l => l.t)).toContain('YKS için 212 gün kaldı. Bugünkü seans o yolun bir adımı.');
    expect(texts({ goal: { name: 'YKS', days: 0 } }).map(l => l.t)).toContain('YKS bugün. Bu seans son hazırlığın.');
    expect(texts({ phase: 'final', todayMin: 50, sessionMin: 25 })[0].t).toBe('Az kaldı. Bu seansla bugün 75 dk olacak.');
  });
});

describe('ekranda', () => {
  it('söz satırı süreyle gizlenmez, 40 sn'+"'"+'de bir değişir; yalnız Zen seansında kapalı', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '../app/focus.tsx'), 'utf8');
    expect(src).toContain('animate={{ opacity: zenMode && isActive ? 0 : 1 }}');
    expect(src).toContain('(v + 0.618) % 1), 40000');
  });
});
