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
const HUB = stripComments(read('features/dashboard/components/StatusHubModal.tsx'));
const SLEEP = stripComments(read('features/habits/hooks/useSleepHealthSync.ts'));
const LAYOUT = stripComments(read('app/_layout.tsx'));

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
    expect(INDEX).toMatch(/onCheck=\{isDemoId\(item\.id\) \? undefined : \(\) => handleCheckTask\(item\.id\)\}/);
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

describe('örnek veri GERÇEK bir şey tetiklemiyor', () => {
  it('örnek satırlar HALKAYLA aynı diziden geliyor', () => {
    /*
      Liste üç örnek satır çiziyordu ama halka gerçek (boş) veriden besleniyordu:
      ekranda üç görev dururken kart "Bugün için planın boş" diyordu. Aynı ekranda
      iki çelişen cümle.
    */
    expect(INDEX).toContain('const demoMyDayTasks = React.useMemo(');
    expect(INDEX).toContain('if (demoActive) return demoMyDayTasks;');
    expect(INDEX).toMatch(/todayCompleted = demoActive\s*\?\s*demoMyDayTasks\.filter/);
  });

  it('sahte satırlar tek bir kapıdan ayırt ediliyor', () => {
    /*
      Mağazalar bilinmeyen bir kimlikle sessizce hiçbir şey yapmıyor, yani veri
      bozulmuyordu — ama YAN ETKİLER çalışıyordu. Sahte bir ritüele dokununca
      `pendingHabits` gerçek (ve boş) listeden hesaplanıyor, "hepsi bitti" çıkıyor ve
      kullanıcıya sahip olmadığı ritüeller için tam ekran kutlama patlıyordu.
    */
    expect(INDEX).toContain("const DEMO_ID_PREFIX = 'mock-';");
    expect(INDEX).toMatch(/const isDemoId = \(id: string \| number\) => typeof id === 'string' && id\.startsWith\(DEMO_ID_PREFIX\);/);
  });

  it('alışkanlığın iki eylemi de kapıdan geçiyor', () => {
    // Gerçek alışkanlık kimlikleri de METİN; tür kontrolü burada yetmez.
    expect((INDEX.match(/if \(isDemoId\(item\.id\)\) return;/g) ?? []).length).toBe(2);
  });

  it('her sahte kimlik önek taşıyor — kapı boşa düşmesin', () => {
    /*
      Kapı öneke dayanıyor. Yeni bir örnek satır önek olmadan eklenirse kapı sessizce
      açık kalır ve kusur geri gelir; bu yüzden önek burada sayılıyor.
    */
    const ids = [...INDEX.matchAll(/id: '([^']*)'/g)].map(m => m[1]);
    const demoish = ids.filter(id => /^mock/.test(id));
    expect(demoish.length).toBeGreaterThanOrEqual(6);
    for (const id of demoish) expect(id.startsWith('mock-')).toBe(true);
  });

  it('gün kutlaması örnek veriden tetiklenemiyor', () => {
    /*
      Halka ile liste aynı şeyi söylesin diye sayaçlar örnek veri açıkken sahte
      satırlardan geliyor. Bugünkü dizide üçte biri tamamlı olduğu için koşul
      tutmuyor — ama bu bir TESADÜF; diziye dokunan biri üçünü de tamamlandı yapsa
      hiç görevi olmayan kullanıcıya gün kutlaması patlardı.
    */
    expect(INDEX).toMatch(/if \(demoActive\) return;\s*const done = dailyGoal > 0/);
  });

  it('atlanan ritüel "bekleyen" sayılmıyor', () => {
    /*
      Koşul yalnız `completedDates`e bakıyordu: bir ritüeli atlayıp kalanları bitiren
      kullanıcının günü kapanmış sayılmıyordu. Sistemin geri kalanı atlamayı mazur
      görüyor — seri bile bozulmuyor (bkz. computeStreak).
    */
    expect(INDEX).toMatch(/!h\.skippedDates\?\.includes\(habitTodayKey\)/);
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

  it('seri bayrağı GÜNE bağlı — oturum boyunca donmuyor', () => {
    /*
      Boolean bir bayraktı: bir kez true olunca oturum boyunca öyle kalıyor, uygulama
      açık kalıp gece yarısını geçen kullanıcıda YENİ GÜNÜN serisi hiç artmıyordu.
      `currentHour` bağımlılıkta çünkü gün, kullanıcı hiçbir şeye dokunmadan da
      değişebiliyor (yalnız odak seansı yapan biri tasks/habits'i değiştirmez).
    */
    expect(INDEX).toContain('const [streakDayDone, setStreakDayDone] = useState<string | null>(null);');
    expect(INDEX).toContain('if (streakDayDone === todayKey()) return;');
    expect(INDEX).toMatch(/\}, \[tasks, habits, isLoading, streakDayDone, currentHour\]\);/);
  });

  it('7 günlük alışkanlık ızgarası ÜRÜNÜN gün anahtarını kullanıyor', () => {
    /*
      Anahtarlar ham takvim tarihinden kuruluyordu, oysa alışkanlıklar `fmtDateKey`
      ile (3 saat tamponlu) yazılıyor. Gece 00:00–03:00 arasında ızgara BİR GÜN
      kayıyordu: kullanıcı 01:00'de bir ritüeli işaretliyor, "bugün" diye
      çerçevelenen kutu boş kalıyordu. Aynı kayma haftalık sayımı da bozuyordu.
    */
    expect(HUB).toContain("import { fmtDateKey } from '@/features/habits';");
    expect(HUB).toContain('const key = fmtDateKey(d);');
    expect(HUB).not.toMatch(/const key = `\$\{y\}-\$\{m\}-\$\{day\}`/);
  });

  it('uyku senkronu tek gün tanımı kullanıyor', () => {
    /*
      Aynı dosya bugünü `fmtDateKey()` ile, geriye dolguyu tamponsuz yerel bir
      `dayKey()` ile kuruyordu — ikisi de aynı `completedDates` dizisine yazıyordu.
      Geriye dolgu artık tarihi yeniden kurmuyor, verinin KENDİ anahtarını yazıyor.
    */
    expect(SLEEP).not.toMatch(/function dayKey\(d: Date\)/);
    expect(SLEEP).toContain('for (const [key, mins] of Object.entries(byDay))');
    expect(SLEEP).toContain('if (key >= todayKey) continue;');
  });

  it('haftalık şeritte "bugün" sütunu tek yerden geliyor', () => {
    /*
      Aynı soru iki yerde ayrı cevaplanıyordu: ana ekran tamponu uyguluyor, durum
      merkezindeki grafik ham `getDay()` kullanıyordu. Gece 00:00–03:00 arasında
      dolu çubuk ile "bugün" çerçevesi ayrı sütuna düşüyordu.
    */
    expect(INDEX).toContain('const currentDayIndex = weekdayIndex();');
    expect(HUB).toContain('const todayIndex = weekdayIndex();');
    expect(HUB).not.toMatch(/new Date\(\)\.getDay\(\) \+ 6\) % 7/);
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

describe('bildirim eylemleri gerçekten iş yapıyor', () => {
  it('bildirimden tamamlama YEREL listeyi de günceller', () => {
    /*
      `useTaskStore.getState().fetchTasks?.()` yazıyordu ama mağazada `fetchTasks`
      diye bir şey YOK — soru işareti satırı sessizce yutuyordu. Kullanıcı kilit
      ekranından görevi tamamlıyor, sunucu güncelleniyor, uygulama görevi hâlâ açık
      gösteriyordu. Hemen altındaki alışkanlık dalı bunu zaten doğru yapıyor.
    */
    expect(LAYOUT).not.toMatch(/fetchTasks\?\.\(\)/);
    expect(LAYOUT).toMatch(/\.updateTask\(taskId, \{ isCompleted: true, completedAt/);
  });

  it('ertele tetikleyicisi uygulamanın BİÇİMİNDE', () => {
    /*
      `trigger: snoozeTime` (ham Date) yazıyordu. expo-notifications 53'ten beri bunu
      kabul etmiyor; uygulamanın kendi bildirim dosyasındaki her çağrı
      `{ type: 'date', date }` kullanıyor. Yani "15 dakika ertele" ya hiç kurulmuyor
      ya anında geri geliyordu — alttaki sessiz `catch` de hatayı yutuyordu.
    */
    expect(LAYOUT).toContain("trigger: { type: 'date', date: snoozeTime },");
    expect(LAYOUT).toMatch(/swallow\('layout\.notifActionSnoozeSchedule'/);
  });

  it('sabah/akşam özeti ana ekranla AYNI günü sayıyor', () => {
    /*
      "Bugün N görevin var" yalnız vadesi TAM BUGÜN olanları sayıyordu: beş gecikmiş
      görevi olan kullanıcı sabah "0 görevin var" bildirimi alıyordu.
    */
    expect(LAYOUT).toContain('const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);');
    expect(LAYOUT).toContain('const when = t.completedAt ?? t.dueDate;');
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
    expect(INDEX).toContain('const dailyGoal = demoActive ? demoMyDayTasks.length : todayTasks.length;');
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

describe('haftalık ipuçları GERÇEK veriyle konuşuyor', () => {
  it('ivme geçmişi boş dizi olarak verilmiyor', () => {
    // `momentumLast7: []` → eğilim hep 'na', ivmeye dayalı hiçbir ipucu üretilmiyordu.
    expect(INDEX).not.toMatch(/momentumLast7: \[\]/);
    expect(INDEX).toContain('momentumLast7: completionHistory.map(d => d.score),');
  });

  it('kullanıcının seçtiği verimli saat kullanılıyor', () => {
    /*
      Hoş geldin ekranında sorulan, kaydedilen ve buluta eşitlenen bir tercih burada
      sabit `'afternoon'` ile eziliyordu. Sorulan bir sorunun cevabını yok saymak,
      hiç sormamaktan kötüdür.
    */
    expect(INDEX).not.toMatch(/productivityHour: 'afternoon'/);
    expect(INDEX).toMatch(/^\s+productivityHour,$/m);
  });

  it('haftalık tamamlama sayısı KOŞULSUZ saymıyor', () => {
    // `: true` yedeği, `completedAt` taşımayan her eski kaydı "bu hafta" sayıyordu.
    expect(INDEX).not.toMatch(/< 7 \* 86400000\) : true\)/);
    expect(INDEX).toContain('const when = t.completedAt ?? t.dueDate;');
  });
});

describe('düğmeler üstünde yazanı yapıyor', () => {
  it('"+ GÖREV EKLE" gerçekten ekleme açıyor', () => {
    /*
      Boş durumdaki birincil düğme artı işaretli ve "ekle" diyor ama `onSeeAll`e
      bağlıydı: listeye götürüp bırakıyordu, kullanıcı orada bir kez daha "+"ya
      basmak zorundaydı.
    */
    expect(INDEX).toMatch(/onAdd=\{\(\) => router\.push\(\{ pathname: '\/tasks', params: \{ action: 'add' \} \}\)\}/);
  });

  it('boş günde kutlama yok', () => {
    /*
      `todayCompleted >= dailyGoal` boş günde 0 >= 0 ile doğru çıkıyor ve hiç planı
      olmayan kullanıcı "MÜKEMMEL GÜN!" alkışı alıyordu. TodayCard bu kuralı kendi
      içinde doğru yazmış; vurgulama dalı onu dışarıdan eziyordu.
    */
    expect(INDEX).toMatch(/if \(dailyGoal === 0\) return language === 'tr' \? 'BUGÜN SERBEST!'/);
  });

  it('yer tutucu adla selamlanmıyor', () => {
    // Ad "TAZQ Kullanıcısı" iken ekran "Günaydın, TAZQ" diyordu — uygulama kendi
    // adıyla selam veriyordu. Bilgi zaten vardı (isNamePlaceholder), kullanılmıyordu.
    expect(INDEX).toMatch(/name=\{\(!isNamePlaceholder && user\?\.name\?\.split\(' '\)\[0\]\)/);
  });
});

describe('dönemsel bant kendi dönemine bağlı', () => {
  it('kapatma anahtarı ilgisiz bir tarihten türemiyor', () => {
    /*
      Anahtar `examDate ?? mulakatDate ?? tezDate ?? yıl` idi: Ramazan bandını kapatan
      kullanıcının kaydı sınav tarihine bağlanıyor, sınav tarihi değişince Ramazan
      bandı geri geliyordu — kapattığı şeyle ilgisi olmayan bir ayar yüzünden.
    */
    expect(INDEX).not.toMatch(/seasonal\.examDate \?\? seasonal\.mulakatDate/);
    expect(INDEX).toMatch(/activeMode\.type === 'ramazan'/);
  });

  it('ulaşılamayan mod dalları kaldırıldı', () => {
    /*
      Bu ekranda `activeMode` yalnız 'exam' (getCustomExamMode) ya da ramazan/yks/kpss
      (detectTurkishMode) olabiliyor. 'tez' ve 'mulakat' dalları hiç çalışmıyordu ama
      okuyana bu modlarda da bir bant çıktığını söylüyordu.
    */
    expect(INDEX).not.toMatch(/if \(t === 'tez'\) return tezPlanHabitIds;/);
    expect(INDEX).not.toMatch(/setPlanIds\('mulakat'/);
  });
});

describe('hiçbir görev SESSİZCE kaybolmuyor', () => {
  it('okunamayan tarih tarihsiz sayılıyor', () => {
    /*
      `new Date('bozuk').getTime()` NaN döner ve NaN ile yapılan her karşılaştırma
      yanlıştır: böyle bir görev ne "vadesi gelmiş" ne "tarihsiz" listesine giriyor,
      yani ekrandan tamamen kayboluyordu.
    */
    expect(INDEX).toContain('return Number.isNaN(ms) ? null : ms;');
    expect(INDEX).toMatch(/const undated = tasks\.filter\(t => t && !t\.isCompleted && dueAt\(t\) === null\);/);
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
