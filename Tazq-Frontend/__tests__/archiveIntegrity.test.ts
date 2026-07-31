import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/**
 * ARŞİV BÜTÜNLÜĞÜ — "arşivdeki görev hâlâ yapılabiliyorsa neden arşivde?"
 *
 * Arşivlemek "aktif hayatımdan çıkar" demek. Ama bayrak eklendikten sonra bu söz her
 * yerde tutulmuyordu: görev listeden kayboluyor, buna karşılık
 *
 *   · merkez ekranında ve mod özetinde görünmeye,
 *   · profil istatistiklerinde sayılmaya,
 *   · ve en somutu, ZAMANLANMIŞ BİLDİRİMİYLE telefonu çaldırmaya
 *
 * devam ediyordu. Görünmeyen ama hâlâ seni çağıran bir görev arşivlenmiş değildir.
 *
 * Kök sebep mimariydi: her ekran `!t.isArchived` kontrolünü kendisi yazmak zorundaydı
 * ve üç tanesi unuttu. Varsayılanın doğru olması gerekiyordu — bu yüzden arşivlenmişi
 * süzen bir seçici var ve arşivlenmişi GÖRMEK isteyen (yalnız arşiv ekranı) açıkça
 * ham listeyi okuyor.
 */
describe('arşivlenmiş görev hiçbir aktif görünüme sızmamalı', () => {
  const SCREENS = ['app/cockpit.tsx', 'app/mod-ozet.tsx', 'app/profile.tsx'];

  it.each(SCREENS)('%s ham görev listesini değil, aktif seçiciyi okur', (rel) => {
    const src = read(rel);
    expect(src).toContain('useActiveTasks');
    // Ham `state.tasks` aboneliği arşivlenmişleri de getirirdi.
    expect(src).not.toMatch(/useTaskStore\(\s*s(tate)?\s*=>\s*s(tate)?\.tasks\s*\)/);
    expect(src).not.toMatch(/const \{ tasks \} = useTaskStore\(\)/);
  });

  it('arşiv ekranı BİLEREK ham listeyi okur — istisna burada', () => {
    // Tek meşru tüketici: arşivi göstermek için arşivlenmişlere erişmesi gerekiyor.
    const src = read('app/archive.tsx');
    expect(src).toMatch(/state\.tasks/);
    expect(src).toContain('isArchived');
  });

  it('seçici arşivlenmişleri süzüyor ve referans kararlılığını koruyor', () => {
    const src = read('features/tasks/store/useTaskStore.ts');
    expect(src).toContain('export const useActiveTasks');
    expect(src).toContain('!t.isArchived');
    // `useShallow` olmadan filtre her render yeni dizi üretip gereksiz çizim yaptırırdı.
    expect(src).toContain('useShallow');
  });

  it('arşivleme hatırlatıcıyı İPTAL eder', () => {
    // Bir görev görünmüyorsa seni çağırmamalı. Bu satır olmadan arşivlenen görev
    // gecenin bir yarısı bildirim gönderiyor, kullanıcı da göremediği bir göreve
    // yönlendiriliyordu.
    const src = read('app/tasks.tsx');
    const fn = src.slice(src.indexOf('const handleBulkArchive'), src.indexOf('const handleBulkComplete'));
    expect(fn).toContain('cancelTaskNotification');
  });
});

/**
 * ALT GÖREVLİ GÖREV TEK DOKUNUŞLA TAMAMLANIR — ve kayıt tutarlı kalır.
 *
 * Alt görevleri tek tek işaretlemeye zorlamak, işi bitmiş kullanıcıya angarya çıkarır;
 * Apple Hatırlatıcılar ve Things de üst öğeyi doğrudan tamamlatır. Alt görevler bir
 * yardımcıdır, bir kapı değil.
 *
 * Ama alt görevler eski hâlinde bırakılırsa kayıt kendi kendisiyle çelişir: satırda
 * üstü çizili bir başlık ve hemen yanında "1/4" ilerlemesi. Aynı görev hem bitmiş hem
 * bitmemiş görünür.
 */
describe('tamamlama alt görevlere iner', () => {
  it('yerel tamamlama alt görevleri de kapatır', () => {
    const src = read('features/tasks/store/useTaskStore.ts');
    const fn = src.slice(src.indexOf('toggleTaskCompletion: (taskId)'));
    expect(fn).toMatch(/subtasks:\s*\(t\.subtasks \?\? \[\]\)\.map\(\(st\) => \(\{ \.\.\.st, done: true \}\)\)/);
  });

  it('sunucuya giden güncelleme de alt görevleri kapatır', () => {
    // İkisi ayrışırsa yenileme sonrası alt görevler geri açılır ve çelişki geri gelir.
    const src = read('app/tasks.tsx');
    expect(src).toMatch(/subtasks:\s*\(task\.subtasks \?\? \[\]\)\.map\(\(st: any\) => \(\{ \.\.\.st, done: true \}\)\)/);
  });
});
