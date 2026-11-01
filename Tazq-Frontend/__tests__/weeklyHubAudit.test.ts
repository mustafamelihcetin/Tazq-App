import fs from 'fs';
import path from 'path';

const read = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

/**
 * HAFTALIK MERKEZ — denetim (2026-10-31): boş / seyrek / dolu hafta ayrı ayrı değerlendirildi.
 */
const COCKPIT = read('app/cockpit.tsx');
const HABITS = read('features/week/WeekHabits.tsx');
const PANEL = read('features/week/WeekPanel.tsx');

describe('Haftalık Merkez — cümle ortak motordan', () => {
  it('cümle buildWeekSentence ile (gün bilen boş cümle, sıfırsız, "6 sa 15 dk")', () => {
    expect(COCKPIT).toContain('buildWeekSentence(');
    expect(COCKPIT).not.toContain("fresh: 'Hafta yeni başlıyor");
    expect(COCKPIT).not.toMatch(/\$\{focusHrs\}\$\{tr \? 'sa'/);
  });
});

describe('Haftalık Merkez — alışkanlık satırı haftayı söyler', () => {
  it('satırın alt yazısı haftanın sayısı (30 günlük etiketsiz % değil)', () => {
    expect(HABITS).toContain('weekLabel(');
    expect(HABITS).not.toMatch(/`%\$\{cons\}`/);
  });
  it('ekran okuyucu haftanın sayısını da duyar (çubuklar ağaçta değil)', () => {
    expect(COCKPIT).toMatch(/accessibilityLabel=\{describeHabit\([^}]*\}, habit\.name, language\) \+ \(sub \? `, \$\{sub\}` : ''\)\}/);
  });
});

describe('Haftalık Merkez — bugünün çubuğu rakama benzemez', () => {
  it('bugün (bekleyen) soluk dolgu; çerçeveli ince hap "0" gibi okunuyordu (cihazda görüldü)', () => {
    expect(HABITS).not.toContain("borderWidth: st === 'today' ? 1 : 0");
    expect(HABITS).toContain("st === 'today' ? color + TODAY_ALPHA");
  });
});

describe('Haftalık Merkez — gün halkası', () => {
  it('sesli etiket görev + alışkanlığı "planlı iş" diye sayar (eskiden hepsine "görev" diyordu)', () => {
    expect(COCKPIT).toContain('planlı işten');
    expect(COCKPIT).not.toContain('görevden ${done} tamamlandı');
  });
  it('planı olmayan geçmiş gün kesik halkayla çizilir (boş gün ≠ plan yok belirsizliği)', () => {
    expect(PANEL).toContain('DashPathEffect');
  });
});

describe('Haftalık Merkez — yazım ve tekrar', () => {
  it('ay değişen haftada başlık iki ayı da yazar ("26 EKİ – 1 KAS")', () => {
    expect(COCKPIT).toContain('weekDays[0].getMonth() !== weekDays[6].getMonth()');
  });
  it('tarih yalnız başlıkta; panel etiketi "BU HAFTA"', () => {
    expect(COCKPIT).not.toMatch(/label=\{`\$\{upperFor\(tr \? 'Bu hafta' : 'This week', tr\)\} · /);
  });
  it('Türkçe düğme ve başlıklar cümle düzeninde', () => {
    for (const s of ["'Gelecek haftayı planla'", "'Haftalık hedefi güncelle'", "'Alışkanlık ekle'", "'Gelecek hafta'", "'Haftalık hedef'"]) {
      expect(COCKPIT).toContain(s);
    }
    expect(COCKPIT).not.toMatch(/'Gelecek Haftayı Planla'|'Alışkanlık Ekle'|'Su İç'|'Kitap Oku'/);
  });
  it('boş durumda klişe yerine somut ilk adım', () => {
    expect(COCKPIT).not.toContain('Küçük alışkanlıklar büyük dönüşümler yaratır.');
  });
  it('sayfa tutamaçları tema renginden', () => {
    expect(COCKPIT).not.toMatch(/isDark \? 'rgba\(255,255,255,0\.15\)' : 'rgba\(0,0,0,0\.12\)'/);
  });
});
