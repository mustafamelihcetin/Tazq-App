import fs from 'fs';
import path from 'path';
import { useFocusStore } from '@/features/focus/store/useFocusStore';

const ROOT = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !l.trim().startsWith('//')).join('\n');

const DAY = stripComments(read('app/gun.tsx'));
const ACTIONS = stripComments(read('features/tasks/utils/taskActions.ts'));

/**
 * "BUGÜN" EKRANI — uygulamada eksik olan ZAMAN ekseni.
 *
 * ── EKSİK OLAN ────────────────────────────────────────────────────────────────
 * Uygulama "ne" yapılacağını (görevler), "ne kadar" yapıldığını (skor) ve "neden"
 * yapıldığını (modlar) biliyordu; "NE ZAMAN" sorusunun hiçbir karşılığı yoktu.
 * Görevlerin saati vardı ama saat ekseninde gösteren tek bir ekran yoktu: plan
 * listeye giriyor, GÜNE hiç girmiyordu.
 */
describe('Bugün ekranı — günün saat ekseni', () => {
  it('eksen içerikten doğar — sabit pencereye hapsolmaz', () => {
    // Sabit 08–22 yazmak, sabah 6'daki işi ekranın dışında bırakırdı.
    expect(DAY).toContain('DAY_START_HOUR');
    expect(DAY).toContain('DAY_END_HOUR');
    expect(DAY).toMatch(/Math\.min\(DAY_START_HOUR, now\.getHours\(\)/);
    expect(DAY).toMatch(/Math\.max\(DAY_END_HOUR, now\.getHours\(\)/);
  });

  it('"şimdi" işareti var — gün akıyor, liste değil', () => {
    expect(DAY).toContain('hour === now.getHours()');
    expect(DAY).toContain('d.now');
  });

  it('TEK jest kuralı: dokun = taşı, basılı tut = menü', () => {
    /*
      Önce tutarsızdı: saatsiz işte dokunuş "eline al", zaman eksenindeki işte dokunuş
      "menü" demekti. Aynı jest iki yerde iki farklı şey yapınca kullanıcı her seferinde
      ne olacağını denemek zorunda kalıyordu.

      İki satır da AYNI işleyicileri çağırıyor — ayrışmaları imkânsız.
    */
    const presses = DAY.match(/onPress=\{\(\) => pickUp\(task\)\}/g) ?? [];
    const holds = DAY.match(/onLongPress=\{\(\) => openMenu\(task\)\}/g) ?? [];
    expect(presses.length).toBe(2);   // saatsiz satır + eksendeki iş
    expect(holds.length).toBe(2);
    expect((DAY.match(/delayLongPress=\{LONG_PRESS_MS\}/g) ?? []).length).toBe(2);
  });

  it('basılı tutma eşiği RN varsayılanından KISA', () => {
    // 500ms bu ekranda uzun: kullanıcı taşımak mı menü mü istediğine hızlı karar veriyor.
    const m = DAY.match(/LONG_PRESS_MS = (\d+)/);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeLessThan(500);
    expect(Number(m![1])).toBeGreaterThanOrEqual(250);
  });

  it('basılı tutma TİTREŞİMLE karşılanır — "açılmadı mı?" hissi olmasın', () => {
    expect(DAY).toMatch(/const openMenu = \(task: Task\) => \{\s*haptic\.surface\(\);/);
  });

  it('taşıma şeridi bölümden BAĞIMSIZ — eksendeki işi alan da ne olduğunu görür', () => {
    // İpucu önce yalnız "saati yok" bölümünün içindeydi.
    expect(DAY).toMatch(/\{placingId != null && \([\s\S]{0,400}placingBar/);
    expect(DAY).toContain('d.cancelPlacing');
  });

  it('jest kuralı kullanıcıya TEK cümleyle söyleniyor', () => {
    expect(DAY).toContain('d.gestureHint');
    const i18n = read('shared/constants/i18n.ts');
    expect(i18n).toContain("gestureHint: 'Dokun: taşı · Basılı tut: menü'");
    expect(i18n).toContain("gestureHint: 'Tap to move · Hold for options'");
  });

  it('yerleştirme SÜRÜKLEMEYLE değil iki dokunuşla', () => {
    /*
      Sürükleme dar ekranda kaydırmayla çakışır ve ekran okuyucuyla yapılamaz.
      İşe dokun → saate dokun: aynı sonuç, tek elle, erişilebilir.
    */
    expect(DAY).toContain('placingId');
    expect(DAY).toMatch(/const place = \(hour: number\)/);
    expect(DAY).toContain('setTaskDue(placingId, { dueTime: timeAtHour(hour) })');
  });
});

describe('odak bağı — teklif, dayatma değil', () => {
  it('bağ otomatik KURULMAZ; menüden seçilir', () => {
    // Her görev odak seansına uygun değil ("süt al", "15:00 toplantı").
    expect(DAY).toContain('d.actionFocus');
    expect(DAY).toMatch(/setCurrentTask\(getLocalizedTaskTitle\(task, tr\), task\.id\)/);
    // Ekranda hiçbir yerde "her göreve odak" gibi koşulsuz bir bağ yok.
    expect(DAY).not.toMatch(/useEffect\([^)]*setCurrentTask/);
  });

  it('bağ KURULMADAN seans bugünküyle aynı davranır', () => {
    const store = useFocusStore.getState();
    store.setCurrentTask('serbest seans'); // ikinci parametre YOK
    expect(useFocusStore.getState().currentTaskId).toBeNull();

    const before = { ...useFocusStore.getState().taskFocusMinutes };
    useFocusStore.getState().addFocusMinutes(25);
    expect(useFocusStore.getState().taskFocusMinutes).toEqual(before);
  });

  it('bağ kurulduğunda dakikalar O GÖREVE yazılır', () => {
    useFocusStore.setState({ taskFocusMinutes: {} });
    useFocusStore.getState().setCurrentTask('Rapor yaz', 42);
    useFocusStore.getState().addFocusMinutes(25);
    useFocusStore.getState().addFocusMinutes(15);
    expect(useFocusStore.getState().taskFocusMinutes[42]).toBe(40);
  });

  it('seans bitince bağ düşer — sonraki seans yanlış göreve yazılmaz', () => {
    useFocusStore.getState().setCurrentTask('Rapor yaz', 42);
    useFocusStore.getState().reset();
    expect(useFocusStore.getState().currentTaskId).toBeNull();
  });

  it('dakika sayacı TEK yerde toplanıyor — beş bitiş yolu da aynı fonksiyondan geçer', () => {
    /*
      Seans beş ayrı yerde bitiyor (normal, erken, pomodoro turu, arka plandan dönüş,
      zen çıkışı) ve hepsi addFocusMinutes çağırıyor. Bağ orada kurulduğu için birini
      unutma ihtimali yok.
    */
    const store = stripComments(read('features/focus/store/useFocusStore.ts'));
    const idx = store.indexOf('addFocusMinutes: (mins)');
    expect(store.slice(idx, idx + 900)).toContain('currentTaskId != null');
  });
});

describe('günü kapatma — bitmeyen iş rozet olarak birikmez', () => {
  it('iki çıkış var: yarına al ya da düşür', () => {
    expect(DAY).toContain('d.moveAllTomorrow');
    expect(DAY).toContain('d.moveTomorrow');
    expect(DAY).toContain('d.drop');
  });

  it('"düşür" SİLMEZ — arşive alır', () => {
    // Günü kapatırken karar hızlı verilir; hızlı kararın geri dönüşü olmalı.
    expect(DAY).toContain('archiveTask(id)');
    expect(DAY).not.toContain('removeTask');
    expect(ACTIONS).toContain('isArchived: true');
  });

  it('yarına alma toplu yapılabilir — tek tek uğraştırmaz', () => {
    expect(DAY).toMatch(/moveToTomorrow\(unfinished\.map\(task => task\.id\)\)/);
  });

  it('akşam özeti artık bir yere GÖTÜRÜYOR', () => {
    /*
      Akşam bildirimi eskiden "3 iş kaldı" deyip hiçbir yere götürmüyordu; kullanıcı
      uygulamayı açınca yine listeyle baş başa kalıyordu.
    */
    const notif = read('shared/utils/notifications.ts');
    expect(notif).toContain("data: { type: 'evening-brief' }");
    expect(notif).toContain("data: { type: 'morning-brief' }");
    const layout = stripComments(read('app/_layout.tsx'));
    expect(layout).toMatch(/'morning-brief' \|\| data\.type === 'evening-brief'[\s\S]{0,80}router\.push\('\/gun'\)/);
  });
});

describe('görev eylemleri TEK yerde — kopya sessiz veri kaybıdır', () => {
  it('tamamlama, tarih değişimi ve arşivleme aynı dosyada', () => {
    expect(ACTIONS).toContain('export async function completeTask');
    expect(ACTIONS).toContain('export function setTaskDue');
    expect(ACTIONS).toContain('export function archiveTask');
  });

  it('üçü de ÇEVRİMDIŞI güvenli — iyimser güncelleme kuyruğa düşer', () => {
    const enqueues = ACTIONS.match(/useOfflineQueue\.getState\(\)\.enqueue/g) ?? [];
    expect(enqueues.length).toBeGreaterThanOrEqual(4);
  });

  it('gerçek sunucu hatasında tamamlama GERİ ALINIR', () => {
    // Ağ hatasında korunur (kuyruğa gider); sunucu reddettiyse kullanıcı bitmiş
    // sandığı işi bir sonraki açılışta yeniden karşısında bulmamalı — geri alınır.
    const idx = ACTIONS.indexOf('export async function completeTask');
    const body = ACTIONS.slice(idx, ACTIONS.indexOf('export function setTaskDue'));
    expect(body).toContain('isNetworkError(e)');
    expect(body).toContain('toggleTaskCompletion(taskId)');
  });
});
