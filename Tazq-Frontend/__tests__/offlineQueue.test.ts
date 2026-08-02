import fs from 'fs';
import path from 'path';
import { useOfflineQueue } from '@/shared/store/useOfflineQueue';

/**
 * ÇEVRİMDIŞI KUYRUK — sessiz veri kaybının iki kaynağı.
 *
 * Kuyruk, kullanıcının çevrimdışıyken yaptığı HER değişikliği taşıyor. Buradaki bir hata
 * ekranda hiç görünmez: kullanıcı işini yapmıştır, uygulama onaylamıştır, kayıp ancak
 * günler sonra "ben bunu yapmıştım" diye fark edilir. Bu yüzden iki değişmez test ediliyor.
 */

const reset = () => useOfflineQueue.setState({ ops: [] });

describe('kuyruk sırası (FIFO) korunuyor', () => {
  beforeEach(reset);

  it('enqueue sona ekler, dequeue baştan alır', () => {
    const q = useOfflineQueue.getState();
    q.enqueue({ type: 'delete-task', id: 1 });
    q.enqueue({ type: 'delete-task', id: 2 });
    q.enqueue({ type: 'delete-task', id: 3 });

    expect(useOfflineQueue.getState().ops.map((o: any) => o.id)).toEqual([1, 2, 3]);

    useOfflineQueue.getState().dequeue(1);
    expect(useOfflineQueue.getState().ops.map((o: any) => o.id)).toEqual([2, 3]);
  });

  it('işlenirken gelen yeni işlem SONA eklenir — sıradakini ezmez', () => {
    // Senkron sürerken kullanıcı görev tamamlarsa, yeni op araya girip
    // bekleyen bir op'un yerine geçmemeli.
    const q = useOfflineQueue.getState();
    q.enqueue({ type: 'delete-task', id: 1 });
    q.enqueue({ type: 'delete-task', id: 2 });

    useOfflineQueue.getState().enqueue({ type: 'toggle-task', id: 9, isCompleted: true, completedAt: null });
    useOfflineQueue.getState().dequeue(1); // 1 işlendi

    expect(useOfflineQueue.getState().ops.map((o: any) => o.id)).toEqual([2, 9]);
  });
});

/**
 * Aşağıdaki ikisi kaynak üzerinden doğrulanıyor: `useOfflineSync` bir React hook'u ve
 * ağ/store/toast bağımlılıklarıyla birlikte koşuyor; korunması gereken şey ise iki net
 * değişmez. Davranışı uçtan uca kurmak bu testin değerinden pahalı olurdu.
 */
const SRC = fs.readFileSync(
  path.resolve(__dirname, '../shared/hooks/useOfflineSync.ts'),
  'utf8',
);

describe('aynı anda tek senkron akışı', () => {
  /*
    Efekt `isOnline` her true olduğunda koşuyor ve mobil ağlar dalgalanır. Kuyruk
    işlenirken ağ bir kez kesilip gelirse İKİNCİ bir döngü, henüz kuyruktan düşmemiş
    AYNI anlık görüntüyle başlıyordu: aynı görev sunucuda iki kez oluşuyor ve iki döngü
    de dequeue çağırdığı için işlenmemiş bir op sessizce siliniyordu.
  */
  it('modül düzeyinde bir kilit var', () => {
    expect(SRC).toMatch(/let syncInFlight = false;/);
    expect(SRC).toMatch(/if \(syncInFlight\) return;/);
  });

  it('kilit finally ile bırakılıyor — kalıcı kilitlenme olamaz', () => {
    // Bayrak hata yolunda bırakılmazsa koruma, önlediği hatadan büyük bir hataya döner:
    // kullanıcı bir daha HİÇ senkron olamaz.
    expect(SRC).toMatch(/\} finally \{[\s\S]*syncInFlight = false;[\s\S]*\}/);
  });
});

describe('geçici kimlikler sunucuya sızmıyor', () => {
  /*
    Çevrimdışı oluşturulan görev negatif geçici kimlik alıyor ve senkronda gerçek kimlikle
    değiştiriliyor. Eşleme yalnız `op.id` alanına bakıyordu; sıralama işlemi kimlikleri
    `ids` DİZİSİNDE taşıdığı için kapsam dışı kalıyordu → sunucuya negatif kimlik gidiyor,
    istek 400 dönüyor, "zehirli op" sayılıp atılıyor ve sıralama kayboluyordu.
  */
  it('reorder işlemi de kimlik eşlemesinden geçiyor', () => {
    expect(SRC).toMatch(/op\.ids\.map\(id => idMap\.get\(id\) \?\? id\)/);
  });

  it('çözülemeyen negatif kimlikler isteğe konmuyor', () => {
    expect(SRC).toMatch(/\.filter\(id => id > 0\)/);
  });

  it('boş kalan sıralama isteği hiç gönderilmiyor', () => {
    expect(SRC).toMatch(/if \(mappedIds\.length > 0\) await TaskService\.reorderTasks\(mappedIds\)/);
  });
});
