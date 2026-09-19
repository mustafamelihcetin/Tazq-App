/**
 * İKİ DİLLİ SABİT KODLAMA — MANDAL (ratchet).
 *
 * ── ÖLÇÜLEN SORUN ─────────────────────────────────────────────────────────────
 * Uygulamada 1660 satır içi `tr ? '...' : '...'` var (67 dosya), buna karşılık
 * i18n sözlüğünde ~536 anahtar. Yani metinlerin çoğu ekranın içinde, iki dal hâlinde
 * elle yazılı. İki bedeli ölçüldü:
 *
 *  1. ÜÇÜNCÜ DİL İMKÂNSIZ. Yeni bir dil, 69 dosyanın tamamına dokunmayı gerektirir.
 *  2. DALLAR AYRIŞIYOR. Bu kalıp, tek bir denetimde şu hataların HEPSİNİ üretti:
 *       · ExamCard   — TR dalı temiz, EN dalında '⚠️' kalmış
 *       · ExamCard   — üç butondan yalnız birinde emoji kalmış
 *       · TaskFormModal — cümle temiz, yanındaki dört parça ham emoji
 *       · TaskFormModal — `Her ${gün}` sabit TÜRKÇE, İngilizce arayüzde "Her Monday"
 *       · taskParser — İngilizce gün adları Türkçe "her" bekliyordu, hiç çalışmıyordu
 *     Beşi de "iki dalı elle senkron tutma" işinin doğal sonucu. İnsan unutur; tek
 *     kaynaklı bir sözlükte unutacak ikinci dal yoktur.
 *
 * ── NEDEN TOPLU TAŞIMA YAPILMIYOR ─────────────────────────────────────────────
 * 1702 kullanımı tek seferde çevirmek, davranış testi olmayan ekranların tamamına
 * dokunan devasa bir değişiklik olurdu; getirisi ise bugün hiçbir kullanıcının
 * görmediği bir esneklik. Aynı gerekçe dosya boyutu borcunda da yazılı
 * (bkz. fileSize.test.ts): ölçülmemiş borç kontrolsüz büyür, ÖLÇÜLMÜŞ borç planlanır.
 *
 * ── KURAL ─────────────────────────────────────────────────────────────────────
 * Sayılar yalnızca DÜŞEBİLİR. Bir dosyada metin i18n'e taşındığında buradaki değer de
 * düşürülmeli; listede olmayan bir dosya HİÇ satır içi ternary ekleyemez.
 * Yani mevcut borç dondu, yeni borç yasak.
 *
 * ── TAŞIMA YOLU (bir dosya için) ──────────────────────────────────────────────
 *   1. `shared/constants/i18n.ts` içine anahtarları ekle (tr + en)
 *   2. Ekranda `const { t } = useLanguageStore()` → `t.<anahtar>`
 *   3. Buradaki sayıyı düşür; sıfırlanırsa satırı listeden sil
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const SKIP = ['node_modules', '.expo', 'android', 'ios', 'dist', '.git', '__tests__', '__mocks__'];

function walk(dir: string): string[] {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((e) => {
    if (SKIP.includes(e.name)) return [];
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) return walk(rel);
    return /\.tsx?$/.test(e.name) ? [rel] : [];
  });
}

const FILES = ['app', 'shared', 'features'].flatMap(walk);

const NEWLINE = String.fromCharCode(10);

/**
 * Satır içi iki dilli dallanma kalıpları.
 *
 * Yalnız DİZE üreten dallar sayılıyor (`? 'metin'`). `tr ? 4 : 8` gibi sayısal veya
 * bileşen seçen dallanmalar çeviri borcu değildir — onlar gerçek koşullu mantıktır.
 */
const PATTERNS = [
  /\b(?:tr|isTR|isTr)\s*\?\s*['"`]/g,
  /language\s*===\s*'tr'\s*\?\s*['"`]/g,
  /lang\s*===\s*'tr'\s*\?\s*['"`]/g,
];

/**
 * Yorumlari ELER — bir kuralin NEDENINI anlatan yorum cogu zaman ORNEK KODdur:
 *
 *     // eskiden `language === 'tr' ? 'Merhaba' : 'Hello'` yaziliyordu
 *
 * Sayac bunu KOD sanip borc olarak sayiyordu; yani kurali aciklamak kurali cignemek
 * oluyordu ve testi susturmanin yolu yorum YAZMAMAK haline geliyordu. Ayni tuzak
 * palet ve erisilebilirlik tarayicilarinda da yasandi — cozum orada da buydu.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(NEWLINE)
    .filter((l) => !l.trim().startsWith('//'))
    .join(NEWLINE);
}

function countInline(rel: string): number {
  const src = stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
  let n = 0;
  for (const re of PATTERNS) n += [...src.matchAll(re)].length;
  return n;
}

/**
 * BUGÜNKÜ borç. Sayılar yalnızca düşebilir.
 *
 * Bu liste bir HEDEF değil, bir FOTOĞRAF: nereden başladığımızı gösteriyor ve
 * geri gitmeyi imkânsız kılıyor.
 */
const BASELINE: Record<string, number> = {
  'app/achievements.tsx': 17,
  'app/admin.tsx': 205,
  'app/archive.tsx': 8,
  'app/cockpit.tsx': 63,
  'app/focus.tsx': 57,
  'app/index.tsx': 45, // 63 → 46: komut paleti ve Zen/Core metin nesnelerine geçti; 46 → 45: selamlamadaki yer tutucu ad ("sen") kalktı
  'app/login.tsx': 47,
  // 27 → 22: mod adları ve özet hesabı ortak hook'a taşındı (useActiveModeSummary),
  // adlar orada sözlükten geliyor.
  'app/mod-ozet.tsx': 22,
  'app/modlar.tsx': 66,
  'app/onboarding.tsx': 21,
  'app/profile.tsx': 44,
  // promo.tsx LİSTEDEN ÇIKTI (47 → 6 → 0): önce mock ekranların bütün metinleri tek
  // sözlüğe taşındı (COPY, bkz. PromoMock.tsx), sonra tanıtım kabuğunun kendi düğme
  // etiketleri de (UI). Slayt metinleri zaten SlideDef alanlarından geliyor.
  'app/register.tsx': 35,
  'app/report.tsx': 1, // 13 → 1: ekran yeniden yazıldı, metinler COPY sözlüğüne taşındı
  'app/settings.tsx': 84,
  'app/tasks.tsx': 85,
  'app/verify-email.tsx': 11,
  'features/dashboard/components/MyDayHabits.tsx': 5,
  // 3 → 1: yedi ayrı dallanma tek `copy(tr)` sözlüğüne toplandı. Satıra tamamlama
  // halkası eklenirken dört metin daha gerekiyordu; her birini ayrı dallandırmak
  // aynı soruyu on bir kez sormak olurdu.
  'features/dashboard/components/MyDayTaskRow.tsx': 1,
  'features/dashboard/components/StatusHub.tsx': 3,
  'features/dashboard/components/StatusHubModal.tsx': 19,
  'features/dashboard/components/TodayCard.tsx': 6,
  'features/habits/components/HabitBubble.tsx': 2,
  'features/habits/components/SwipeableHabitItem.tsx': 3,
  'features/habits/hooks/useSleepHealthSync.ts': 4,
  'features/modes/components/DailyStepsRow.tsx': 4,
  'features/modes/components/TurkishModeBanner.tsx': 103,
  'features/modes/components/WeightEntryModal.tsx': 11,
  'features/modes/components/modes/BirakmaCard.tsx': 32,
  'features/modes/components/modes/ExamCard.tsx': 64,
  'features/modes/components/modes/MulakatCard.tsx': 37,
  'features/modes/components/modes/RamazanCard.tsx': 13,
  'features/modes/components/modes/SporCard.tsx': 85,
  'features/modes/components/modes/TasarrufCard.tsx': 41,
  'features/modes/components/modes/TezCard.tsx': 24,
  'features/modes/hooks/useActivityHealthSync.ts': 1,
  'features/modes/utils/dailyPlanEngine.ts': 1,
  'features/modes/utils/modeHelpers.ts': 7,
  'features/modes/utils/planAdaptations.ts': 37,
  'features/modes/utils/turkishModes.ts': 5,
  'features/onboarding/components/TourFeaturePreview.tsx': 55,
  'features/tasks/components/TaskFormModal.tsx': 26,
  'features/user/components/CelebrationOverlay.tsx': 1,
  'features/user/components/DeleteAccountModal.tsx': 1,
  'features/user/components/MomentumPulse.tsx': 23,
  'features/user/components/ProfileSetupModal.tsx': 17,
  'features/user/components/ReviewPromptModal.tsx': 11,
  'features/user/components/RocketFeedback.tsx': 12,
  'shared/components/BackButton.tsx': 1,
  'shared/components/ConfettiOverlay.tsx': 2,
  'shared/components/CustomAlert.tsx': 1,
  'shared/components/OfflineBanner.tsx': 1,
  'shared/components/Pager.tsx': 5,
  'shared/components/ScreenHeader.tsx': 1,
  'shared/components/SectionHeader.tsx': 1,
  'shared/components/SupportModal.tsx': 18,
  'shared/components/SwipeableItem.tsx': 1,
  'shared/components/Toast.tsx': 1,
  'shared/hooks/useOfflineSync.ts': 1,
  'shared/utils/insights.ts': 2,
  'shared/utils/lifeModePlans.ts': 3,
  // 42 → 40: haftalık özetin başlığı, gövdesi ve tekrarlı yedeği ayrı ayrı
  // dallanıyordu; üçü tek sözlükte toplandı (iki dil yan yana).
  'shared/utils/notifications.ts': 40,
  'shared/utils/ramadanDates.ts': 1,
  'shared/utils/stepInsight.ts': 3,
};

describe('iki dilli sabit kodlama mandalı', () => {
  it('hiçbir dosya baseline değerini AŞMIYOR', () => {
    const grown = Object.entries(BASELINE)
      .filter(([f]) => fs.existsSync(path.join(ROOT, f)))
      .map(([f, cap]) => ({ f, cap, now: countInline(f) }))
      .filter(({ cap, now }) => now > cap)
      .map(({ f, cap, now }) => `${f}: ${now} > ${cap}`);
    expect(grown).toEqual([]);
  });

  it('listede OLMAYAN dosya satır içi ternary EKLEYEMEZ', () => {
    // Yeni kod i18n sözlüğünü kullanmak zorunda. Kural buradan uygulanıyor.
    const offenders = FILES
      .filter((f) => !(f in BASELINE))
      .map((f) => ({ f, n: countInline(f) }))
      .filter(({ n }) => n > 0)
      .map(({ f, n }) => `${f} (${n})`);
    expect(offenders).toEqual([]);
  });

  it('liste bayatlamamalı — silinen dosyalar listede kalmasın', () => {
    const stale = Object.keys(BASELINE).filter((f) => !fs.existsSync(path.join(ROOT, f)));
    expect(stale).toEqual([]);
  });

  it('sayaç gerçekten SAYIYOR — kalıp bozulursa test boşa düşer', () => {
    // Regex bozulursa her dosya 0 döner ve mandal sessizce serbest kalır.
    const total = Object.keys(BASELINE)
      .filter((f) => fs.existsSync(path.join(ROOT, f)))
      .reduce((sum, f) => sum + countInline(f), 0);
    expect(total).toBeGreaterThan(1000);
  });

  it('yürüyüş gerçekten çalışıyor', () => {
    expect(FILES.length).toBeGreaterThan(80);
    expect(FILES).toContain('app/admin.tsx');
  });

  it('kalıp YAKALIYOR — bilerek bozulmuş örnekler geçmemeli', () => {
    const samples = [
      "const s = tr ? 'Merhaba' : 'Hello';",
      'const s = isTR ? "Merhaba" : "Hello";',
      "const s = language === 'tr' ? 'Merhaba' : 'Hello';",
      "const s = lang === 'tr' ? `Merhaba` : `Hello`;",
    ];
    for (const sample of samples) {
      const hit = PATTERNS.some((re) => new RegExp(re.source, re.flags).test(sample));
      expect(hit).toBe(true);
    }
  });

  it('SAYISAL dallanmayı çeviri borcu SAYMIYOR — gerçek koşullu mantık serbest', () => {
    const numeric = ["const w = tr ? 120 : 90;", 'const c = isTR ? theme.primary : theme.secondary;'];
    for (const sample of numeric) {
      const hit = PATTERNS.some((re) => new RegExp(re.source, re.flags).test(sample));
      expect(hit).toBe(false);
    }
  });
});

describe('i18n sözlüğü çalışır durumda', () => {
  it('iki dilin anahtarları AYNI — birinde olup diğerinde olmayan yok', () => {
    const { translations } = require('@/shared/constants/i18n');
    const flat = (obj: any, prefix = ''): string[] =>
      Object.entries(obj).flatMap(([k, v]) =>
        v && typeof v === 'object' && !Array.isArray(v) ? flat(v, `${prefix}${k}.`) : [`${prefix}${k}`],
      );
    const tr = flat(translations.tr).sort();
    const en = flat(translations.en).sort();
    expect(tr.filter((k) => !en.includes(k))).toEqual([]);
    expect(en.filter((k) => !tr.includes(k))).toEqual([]);
  });
});
