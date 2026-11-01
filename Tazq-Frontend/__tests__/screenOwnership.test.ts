import fs from 'fs';
import path from 'path';

/**
 * SAHİPLİK KURALI (A2) — her sorunun tek sahibi.
 *
 * ── NEDEN VAR ─────────────────────────────────────────────────────────────────
 * Aynı soru birden çok ekranda cevaplanınca ekranlar aynı hafta için farklı sayı
 * gösterdi (Kokpit ↔ Rapor) ve kullanıcı hangisine bakacağını bilemedi. Rol ayrımı
 * yapıldı ama yalnız kod yorumlarında yazılıydı; kopya sessizce geri gelebiliyordu.
 *
 *   Bugün    = Ana sayfa (Gün ekranı onun saat görünümü)
 *   Bu hafta = Haftalık
 *   Hedefler = Modlar
 *   Geçmiş   = Rapor (Mod özeti onun mod kolu)
 *
 * Bir ekran BAŞKA sorunun kartını çizerse test kırılır. Başka sorunun sahibine götüren
 * tek satır bağlantı serbesttir (kart değil, yönlendirme). Envanter: docs/ekran-envanteri.md.
 */

type Question = 'today' | 'week' | 'goals' | 'past';

const SCREEN_OWNER: Record<string, Question> = {
  'app/index.tsx': 'today',
  'app/gun.tsx': 'today',
  'app/cockpit.tsx': 'week',
  'app/modlar.tsx': 'goals',
  'app/report.tsx': 'past',
  'app/mod-ozet.tsx': 'past',
};

/** Bir soruyu cevaplayan kartlar. Araç bileşenleri (form, sayfa, düğme) burada yok. */
const CARD_QUESTION: Record<string, Question> = {
  TodayRings: 'today',
  ModeTodayCard: 'today',
  MyDayHabits: 'today',
  MyDayItem: 'today',
  TazqZenCard: 'today',
  PaymentsSummaryCard: 'today',
  WeekPanel: 'week',
  WeekHabits: 'week',
  ModeStatusCard: 'goals',
  ModeRoadmapSheet: 'goals',
  TurkishModeBanner: 'goals',
  WeekDisplay: 'past',
  WeekChart: 'past',
  HabitWeekList: 'past',
  WeekSky: 'past',
  WeekBars: 'past',
  TrendLine: 'past',
};

/**
 * BEKLEYEN KOPYALAR — A3'te tek tek kaldırılır (her biri senin onayınla).
 * Kaldırıldığında satır da silinmeli: test bayat satırı da yakalar (mandal yalnız daralır).
 */
const PENDING: Array<{ screen: string; card: string; ref: string }> = [
];

const root = path.join(__dirname, '..');
const read = (f: string) => fs.readFileSync(path.join(root, f), 'utf8');

/** Ekranın JSX'te çizdiği kartlar ("<WeekPanel" ya da "<WeekPanel\n"). */
function cardsOn(screen: string): string[] {
  const src = read(screen);
  return Object.keys(CARD_QUESTION).filter((c) => new RegExp(`<${c}[\\s/>]`).test(src));
}

describe('sahiplik kuralı', () => {
  it('hiçbir ekran başka sorunun kartını çizmez (bekleyen kopyalar hariç)', () => {
    const offenders: string[] = [];
    for (const [screen, owner] of Object.entries(SCREEN_OWNER)) {
      for (const card of cardsOn(screen)) {
        if (CARD_QUESTION[card] === owner) continue;
        if (PENDING.some((p) => p.screen === screen && p.card === card)) continue;
        offenders.push(`${screen} → <${card}> (${CARD_QUESTION[card]}, ekranın sorusu ${owner})`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('bekleyen kopya listesi bayat değil — kaldırılan kopyanın satırı da silinmeli', () => {
    const stale = PENDING.filter((p) => !cardsOn(p.screen).includes(p.card)).map((p) => `${p.ref} ${p.screen} <${p.card}>`);
    expect(stale).toEqual([]);
  });

  it('kayıttaki her ekran ve kart gerçekten var (yeniden adlandırma testi boşa düşürmesin)', () => {
    const missingScreens = Object.keys(SCREEN_OWNER).filter((f) => !fs.existsSync(path.join(root, f)));
    expect(missingScreens).toEqual([]);

    const walk = (dir: string): string[] =>
      fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(path.join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [read(path.join(dir, e.name))] : [],
      );
    const sources = ['app', 'features', 'shared'].flatMap(walk).join('\n');
    const missingCards = Object.keys(CARD_QUESTION).filter(
      (c) => !new RegExp(`(function|const|class)\\s+${c}\\b`).test(sources),
    );
    expect(missingCards).toEqual([]);
  });

  it('kural gerçekten yakalıyor — kopya bir kart test edilen kalıpla bulunur', () => {
    expect(cardsOn('app/index.tsx')).toContain('TodayRings');
    expect(cardsOn('app/modlar.tsx')).toContain('TurkishModeBanner');
  });
});

/**
 * BAŞLIK DÜĞMELERİ (A5) — bir ekranın başlığındaki yönlendirme, o ekranın SAHİP OLMADIĞI
 * sorunun sahibine götürür. Kendi sorusuna götüren düğme bir kopyadır (aynı soruyu iki yoldan
 * sormak). Profil gibi hesap ekranları bir soruya ait değildir; serbesttir.
 */
const ROUTE_QUESTION: Record<string, Question> = {
  '/': 'today', '/gun': 'today', '/cockpit': 'week', '/modlar': 'goals', '/report': 'past', '/mod-ozet': 'past',
};

/** ScreenHeader bloğunun içindeki router.push / replace hedefleri. */
function headerTargets(screen: string): string[] {
  const src = read(screen);
  const at = src.indexOf('<ScreenHeader');
  if (at < 0) return [];
  // Tek satırlık etiket o satırda kapanır; çok satırlı olanı açılışla AYNI girintideki "/>" kapatır.
  const lineStart = src.lastIndexOf('\n', at) + 1;
  const lineEnd = src.indexOf('\n', at);
  const firstLine = src.slice(at, lineEnd);
  const indent = src.slice(lineStart, at);
  const end = firstLine.trimEnd().endsWith('/>') ? lineEnd : src.indexOf(`\n${indent}/>`, at);
  if (end < 0) throw new Error(`${screen}: ScreenHeader kapanışı bulunamadı`);
  const block = src.slice(at, end);
  return [...block.matchAll(/router\.(?:push|replace)\(\s*(?:\{\s*pathname:\s*)?'([^']+)'/g)].map((m) => m[1]);
}

describe('başlık düğmeleri sahibine götürür (A5)', () => {
  it('hiçbir ekranın başlığı kendi sorusuna götürmez', () => {
    const offenders: string[] = [];
    for (const [screen, owner] of Object.entries(SCREEN_OWNER)) {
      for (const route of headerTargets(screen)) {
        if (ROUTE_QUESTION[route] === owner) offenders.push(`${screen} → ${route}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('kalıp gerçekten okuyor — Bu Hafta başlığı Gün ve Rapor\'a götürür', () => {
    expect(headerTargets('app/cockpit.tsx')).toEqual(expect.arrayContaining(['/gun', '/report']));
  });
});

/**
 * E-1 — Gün ekranı Bugün'ün SAAT görünümü, ama ana sayfadan oraya hiç yol yoktu (yalnız Bu Hafta,
 * Görevler ve sabah/akşam bildiriminden açılıyordu). Panelin tarih şeridi o günü saatleriyle açar;
 * panel geçmiş bir güne kaydırıldıysa O GÜNÜ.
 */
describe('ana sayfa → Gün ekranı (E-1)', () => {
  it('tarih şeridi dokunulabilir bir bağlantı', () => {
    const DS = read('shared/components/DisplayPanel.tsx');
    expect(DS).toMatch(/onPress\?: \(\) => void/);
    expect(DS).toContain('accessibilityRole="link"');
  });

  it('panel kaydırılan günü iletir, ana sayfa Gün ekranını o tarihle açar', () => {
    expect(read('features/dashboard/components/TodayRings.tsx')).toContain('onOpenDay');
    const INDEX = read('app/index.tsx');
    expect(INDEX).toContain("pathname: '/gun'");
    expect(INDEX).toContain('onOpenDay={openDay}');
  });
});

/**
 * GEÇMİŞ'İN BAĞLANTILARI (E-2, K-4) — Rapor geçmişin sahibi.
 *  · E-2: Mod özeti (modların son 4 haftası) yalnız Hedefler'den açılıyordu; Geçmiş'in sahibi
 *    Rapor'dan da yolu olmalı. Mod yoksa satır yok (boş sayfaya göndermez).
 *  · K-4: Rapor içinde bulunulan haftayı da gösteriyor; "bu hafta" sorusunun sahibi Bu Hafta.
 *    O haftada tek satır oraya götürür (yığında varsa ona DÖNER — dismissTo, çift ekran yok).
 */
describe('Rapor bağlantıları (E-2, K-4)', () => {
  const REPORT = read('app/report.tsx');

  it("modlar varsa Mod özeti'ne götürür", () => {
    expect(REPORT).toContain("router.push('/mod-ozet')");
    expect(REPORT).toMatch(/hasModes && \(/);
  });

  it("içinde bulunulan haftada Bu Hafta'ya döner", () => {
    expect(REPORT).toContain("router.dismissTo('/cockpit')");
  });
});
