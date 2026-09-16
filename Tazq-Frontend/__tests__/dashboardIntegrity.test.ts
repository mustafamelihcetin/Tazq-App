import fs from 'fs';
import path from 'path';

/**
 * ANA EKRAN — denetimde bulunan kusurların bekçisi.
 *
 * ── NEDEN KAYNAK METNİNE BAKAN BİR TEST ───────────────────────────────────────
 * Aşağıdaki kusurların ortak özelliği: hiçbiri "ekranı açıp bakmakla" görünmüyordu.
 * Görev ekleniyor ve bildirim çıkıyordu (ama kaydedilmiyordu). Liste çiziliyordu (ama
 * tamamlanamıyordu). Seri artıyordu (ama yanlış günden). Halka doluyordu (ama başka
 * bir kümeyi sayarak).
 *
 * Davranışın kendisi `app/index.tsx` içinde, 2300 satırlık bir bileşende yaşıyor ve
 * render edilerek sınanamıyor. Burada YAPININ korunduğu doğrulanıyor: kaydın hangi
 * yoldan geçtiği, kararın hangi kaynaktan geldiği. Kararların KENDİSİ saf hâle
 * getirildi ve __tests__/streakDay.test.ts içinde çağrılarak test ediliyor.
 */

const ROOT = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
/** Yorumları eler — bir kuralı ANLATAN not, kuralın ihlali sayılmasın. */
const stripComments = (src: string) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trim().startsWith('//'))
    .join('\n');

const INDEX = stripComments(read('app/index.tsx'));
const ROW = stripComments(read('features/dashboard/components/MyDayTaskRow.tsx'));

describe('eklenen görev GERÇEKTEN kaydediliyor', () => {
  it('panel kayıt BİTİNCE kapanıyor — hata olursa yazılan metin durur', () => {
    /*
      İyimser kapanış denendi ve geri alındı: kayıt artık sunucuya gidiyor ve
      başarısız olabiliyor, o zaman kullanıcının cümlesi kayboluyordu. Paneli geri
      açmak ise "paletin tek giriş noktası logodur" kuralını bozuyor.
    */
    expect(INDEX).toMatch(/await handleQuickSave\(title\);\s*setCommandPortalVisible\(false\);/);
    expect(INDEX).toContain('if (portalSavingRef.current) return;');
  });

  it('komut paleti mağazaya doğrudan yazmıyor', () => {
    /*
      Palet `useTaskStore.getState().addTask(...)` çağırıyordu: sunucuya istek yok,
      çevrimdışı kuyruğa kayıt yok. Ekran her odaklandığında `fetchTasks` çalışıyor ve
      `setTasks` listeyi sunucununkiyle DEĞİŞTİRİYOR (birleştirme gelen diziden kurulur,
      yerelde kalanlar düşer). Kullanıcı "eklendi" yazısını görüyor, sekme değiştirip
      dönünce görev yok oluyordu.
    */
    expect(INDEX).not.toMatch(/useTaskStore\.getState\(\)\.addTask\(/);
  });

  it('paletin iki girişi de TEK kayıt yolundan geçiyor', () => {
    // Aynı payload iki yere elle kopyalanmıştı; kopyalar zamanla ayrışır.
    expect(INDEX).toContain('const savePortalTask = async () => {');
    expect(INDEX).toContain('await handleQuickSave(title);');
    expect((INDEX.match(/savePortalTask\(\)/g) ?? []).length).toBe(2);
  });

  it('kayıt yolu çevrimdışını da taşıyor', () => {
    // handleQuickSave çevrimdışıyken kuyruğa alıyor; palet artık bunu devralıyor.
    expect(INDEX).toMatch(/enqueue\(\{ type: 'create-task'/);
  });

  it('görev kimliği UYDURULMUYOR', () => {
    /*
      `id: Date.now()` sunucunun kimlik alanıyla çakışan POZİTİF bir sayıydı; çevrimdışı
      kuyruk geçici kimlikleri bilerek NEGATİF üretiyor (`-Date.now()`).
    */
    expect(INDEX).not.toMatch(/\bid: Date\.now\(\)/);
  });
});

describe('günlük listeden görev tamamlanabiliyor', () => {
  it('tamamlama işleyicisi satıra BAĞLI — ölü kod değil', () => {
    /*
      `handleCheckTask` (kilo modalı, kutlama kapıları, çevrimdışı kuyruk, ses efekti)
      tanımlıydı ama hiçbir yerden çağrılmıyordu: ana ekrandaki listeden bir görev
      tamamlanamıyordu. Aynı kartın üstünde ritüeller tek dokunuşla işaretleniyordu.
    */
    expect(INDEX).toContain('const handleCheckTask = async (taskId: number) => {');
    expect(INDEX).toMatch(/onCheck=\{[^}]*handleCheckTask\(item\.id\)/);
  });

  it('satır bir tamamlama kontrolü ÇİZİYOR', () => {
    expect(ROW).toContain('onCheck?: () => void;');
    expect(ROW).toMatch(/const CheckRing/);
    expect(ROW).toContain('accessibilityRole="checkbox"');
  });

  it('örnek (sahte) satırlarda dokunulamaz', () => {
    // Sahte satırın kimliği metin, canlı görevinki sayı. Basınca sessizce hiçbir şey
    // olmasın diye kapı burada.
    expect(INDEX).toMatch(/typeof item\.id === 'number' \? \(\) => handleCheckTask/);
  });

  it('kilo görevi ORTAK yardımcıyla tanınıyor', () => {
    /*
      Satır `item.tags` diye bakıyordu ama aldığı nesne bir sarmal: etiketler
      `item.original.tags` altında, yani koşul HİÇ doğru olmuyordu. Ayrıca ham etiket
      kontrolü başlıktan tanınan eski kilo görevlerini kaçırıyor.
    */
    expect(INDEX).toContain('isWeightEntryTask(item.original)');
    expect(INDEX).not.toMatch(/item\.tags\?\.includes\('weight_entry'\)/);
  });
});

describe('tek bir "bugün" tanımı', () => {
  it('seri hesabı ürünün gün anahtarını kullanıyor', () => {
    /*
      Üç ayrı tanım vardı: alışkanlıklar tamponlu `fmtDateKey`, odak mağazası aynı
      biçim, seri hesabı ise `toDateString()`. `dailyFocusDate === todayStr` koşulu bu
      yüzden hiç doğru olmuyordu — odak seansları seriye HİÇ sayılmıyordu.
    */
    expect(INDEX).toContain("from '@/features/dashboard/utils/streakDay'");
    expect(INDEX).toMatch(/wasActiveOn\(\{/);
    expect(INDEX).toMatch(/decideStreak\(\{/);
    expect(INDEX).not.toMatch(/dailyFocusDate === \w*[Tt]odayStr/);
  });

  it('kalkan kararı SUNUCU CEVABI gelmeden verilmiyor', () => {
    /*
      Bağımlılık yalnız `isLoading` idi ama gövde `tasks`ı okuyordu: görevler gelmeden
      çalışıp dünü boş görebiliyor, sonra `lastCheckedDate`i yazdığı için bir daha
      bakmıyordu. Geri alınamaz bir yazma, eksik veriyle.
    */
    expect(INDEX).toContain('const [tasksFetched, setTasksFetched] = useState(false);');
    expect(INDEX).toContain('setTasksFetched(true);');
    expect(INDEX).toMatch(/if \(!tasksFetched \|\| shieldCheckedRef\.current\) return;/);
  });

  it('odak dakikası GÜN KAPISINDAN geçiyor', () => {
    /*
      Mağazadaki sayaç yalnız rehydrate'te sıfırlanıyor; uygulama açık kalıp gece
      yarısını geçtiğinde dünün dakikaları bugün gösteriliyordu.
    */
    expect(INDEX).toContain('const todayFocusMinutes = dailyFocusDate === todayKey() ? dailyFocusMinutes : 0;');
    expect(INDEX).toContain('focusMinutes={todayFocusMinutes}');
  });
});

describe('halka ile liste AYNI kümeyi sayıyor', () => {
  it('günün kümesi tek yerde tanımlı', () => {
    /*
      Halka `dueDate` TAM BUGÜN olanları sayıyor, liste ise gecikmişleri ve tarihsizleri
      de gösteriyordu: listede altı görev dururken halka "0/2" yazabiliyordu.
    */
    expect(INDEX).toContain('const dayScope = React.useMemo(');
    expect(INDEX).toContain('const todayTasksIncomplete = dayScope.incomplete;');
    expect(INDEX).toContain('const todayTasksCompleted = dayScope.completed;');
    expect(INDEX).toContain('const dailyGoal = todayTasks.length;');
    expect(INDEX).toContain('const todayCompleted = todayTasksCompleted.length;');
  });

  it('küme İKİ kez tanımlanmıyor', () => {
    // Eskiden aynı gün iki ayrı blokta, iki farklı kuralla süzülüyordu.
    expect((INDEX.match(/const todayTasksIncomplete/g) ?? []).length).toBe(1);
    expect((INDEX.match(/const todayTasksCompleted/g) ?? []).length).toBe(1);
  });

  it('tamamlanan gecikmiş/tarihsiz görev listeden KAYBOLMUYOR', () => {
    /*
      Eski koşul yalnız "vadesi bugün olan"ları alıyordu; gecikmiş ya da tarihsiz bir
      görev tamamlanınca iki listenin de dışında kalıp ekrandan siliniyordu.
    */
    expect(INDEX).toMatch(/wasCompletedOn\(t, today\)/);
  });
});

describe('boş ekran tek cümle söylüyor', () => {
  it('örnek veri varken "hiçbir şeyin yok" kartı çıkmıyor', () => {
    // Üç sahte görev dururken altında "nereden başlayalım?" yazıyordu.
    expect(INDEX).toMatch(/tasks\.length === 0 && habits\.length === 0 && !demoGate\(tasks\.length\)/);
  });
});

describe('arama kullanıcının GÖRDÜĞÜ adla eşleşiyor', () => {
  it('Türkçe küçük harf ve yerelleştirilmiş başlık', () => {
    // `toLowerCase()` Türkçe'de 'İ' harfini bozuyor; arama ayrıca ham `title`
    // üzerindeydi, oysa ekranda yerelleştirilmiş ad görünüyor.
    expect(INDEX).not.toMatch(/portalSearch\.toLowerCase\(\)/);
    expect(INDEX).toContain("portalSearch.toLocaleLowerCase(tr ? 'tr-TR' : 'en-US')");
    expect(INDEX).toMatch(/getLocalizedTaskTitle\(t, tr\)\.toLocaleLowerCase/);
  });
});

describe('hızlı odak seansı GÖREVLE başlıyor', () => {
  it('sıradaki iş seansa geçiriliyor', () => {
    // `const target = topTaskToday` alınıp hiç kullanılmıyordu: seans adsız açılıyor
    // ve dakikalar hiçbir göreve işlenmiyordu (bkz. useFocusStore → taskFocusMinutes).
    expect(INDEX).toMatch(/setCurrentTask\(target \? getLocalizedTaskTitle\(target, tr\) : '', target\?\.id \?\? null\)/);
  });
});
