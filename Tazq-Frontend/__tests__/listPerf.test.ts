import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const TASKS = fs.readFileSync(path.join(ROOT, 'app/tasks.tsx'), 'utf8');

/**
 * LİSTE PERFORMANSI — ölçülmüş bir takılmanın koruması.
 *
 * Görevler ekranında seçenekler dokunulduğunda gözle görülür bir gecikme vardı ve
 * sebebi tek bir satırdı: liste öğesi bileşeni `usePrefsStore()`u SEÇİCİSİZ çağırıyor,
 * yani tüm tercih store'una abone oluyordu.
 *
 * Sonuç, listedeki görev sayısı kadar abonelik. Tercihlerde en ufak değişiklik
 * (filtre, sıralama, "tamamlananları gizle") BÜTÜN kartları yeniden render ediyordu —
 * ve liste uzadıkça dokunuş daha geç cevap veriyordu.
 *
 * Üstelik `React.memo` bu yüzden hiçbir işe yaramıyordu: prop'lar değişmese bile iç
 * abonelik render'ı tetikler. Bu, memo edilmiş bir bileşende store aboneliğinin en
 * sinsi tarafı — koruma varmış gibi görünür, yoktur.
 *
 * Hesap ebeveyne, tek geçişe alındı ve karta prop olarak veriliyor.
 */
describe('görev kartı store aboneliği taşımamalı', () => {
  /** `MemoizedTaskItem` bileşeninin gövdesi. */
  const cardBody = (() => {
    const start = TASKS.indexOf('const MemoizedTaskItem = React.memo(');
    expect(start).toBeGreaterThan(-1);
    // Bileşenin sonu: bir sonraki üst düzey `const ... = ` tanımı.
    const rest = TASKS.slice(start + 40);
    const end = rest.search(/\n(const|function|export) /);
    return rest.slice(0, end > 0 ? end : rest.length);
  })();

  /** Yorumlar hariç — gerekçe metni kuralın kendisi sanılmasın. */
  const code = cardBody
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trim().startsWith('//'))
    .join('\n');

  it('kart hiçbir zustand store\'una abone olmamalı', () => {
    // Liste öğesi SAF olmalı: aldığı prop'lardan başka hiçbir şeye bakmasın. Aksi
    // halde `React.memo` sessizce etkisizleşir ve maliyet görev sayısıyla çarpılır.
    for (const store of ['usePrefsStore(', 'useTaskStore(', 'useFocusStore(', 'useSporStore(']) {
      expect(code).not.toContain(store);
    }
  });

  it('mod bilgisi PROP olarak geliyor — kart kendisi hesaplamıyor', () => {
    // `getModeInfoForTask` görev başına çağrıldığında içeride `require()` yapıyor ve
    // sayı verilirse tüm görev listesini tarıyor. Kart başına bir kez = O(n²).
    expect(code).toContain('modeInfo');
    expect(code).not.toContain('getModeInfoForTask(');
  });
});

/**
 * SEÇİM DURUMU HER RENDER'DA YENİDEN HESAPLANMAMALI.
 *
 * "Bu seçim düzenlenebilir mi / arşivlenebilir mi" soruları memo'suz yazıldığında her
 * seçili görev için tüm listede arama yapıyordu — O(seçili × görev), üstelik seçim
 * modunda her dokunuş yeni bir render tetiklediği için sürekli tekrar ediyordu.
 */
describe('seçim hesapları memoize', () => {
  it('düzenlenebilirlik ve arşivlenebilirlik useMemo ile hesaplanıyor', () => {
    expect(TASKS).toMatch(/const canEditSelection = React\.useMemo\(/);
    expect(TASKS).toMatch(/const canArchiveSelection = React\.useMemo\(/);
  });

  it('mod kimlikleri tek geçişte, prefs bağımlılığıyla çıkarılıyor', () => {
    // `prefsAll` bağımlılıkta OLMAK ZORUNDA: mod açılıp kapandığında ya da plan
    // tarihleri değiştiğinde harita eskirse kart yanlış mod rengini gösterir —
    // ekran doğru görünmeye devam ettiği için fark edilmesi çok zor bir hata.
    expect(TASKS).toMatch(/const modeInfoById = React\.useMemo\(/);
    expect(TASKS).toMatch(/\}, \[tasks, theme, prefsAll\]\);/);
  });
});
