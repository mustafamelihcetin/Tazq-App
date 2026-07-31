import { movementTextOf, findOpenMovementTasks } from '@/features/modes/hooks/useActivityHealthSync';
import type { Task } from '@/features/tasks/store/useTaskStore';
import { fmtDateKey } from '@/features/habits/store/useHabitStore';

/**
 * HANGİ GÖREVLERE DOKUNULUR — otomatik tamamlamanın kapsamı.
 *
 * Eşleştirmenin kendisi `activityMatch.test.ts`te sınanıyor. Burada sınanan şey SEÇİM:
 * doğru türde ama YANLIŞ göreve dokunmak da en az yanlış sınıflandırma kadar zararlı.
 */

const today = fmtDateKey();
const iso = (key: string) => `${key}T09:00:00.000Z`;

const task = (p: Partial<Task>): Task => ({
  id: 1,
  title: '',
  description: '',
  dueDate: iso(today),
  isCompleted: false,
  priority: 'Medium',
  tags: ['daily'],
  ...p,
} as Task);

describe('movementTextOf — dil değişse de eşleşme bozulmaz', () => {
  it('açıklamadaki iki dilli başlığı da metne katar', () => {
    // Görev TR oluşturulup kullanıcı İngilizce'ye geçtiğinde `title` TR kalıyor.
    // İki dili birden okumak bu kopmayı çözüyor.
    const t = task({
      title: 'Bugünkü koşunu planına göre tamamla',
      description: JSON.stringify({ tr: 'Bugünkü koşunu planına göre tamamla', en: "Complete today's run per your plan" }),
    });
    const text = movementTextOf(t);
    expect(text).toContain('koşunu');
    expect(text).toContain("Complete today's run");
  });

  it('açıklama düz metinse çökmez, başlığa düşer', () => {
    const t = task({ title: 'Bugün 30+ dk hareket et', description: 'kullanıcının kendi notu' });
    expect(movementTextOf(t)).toContain('hareket et');
  });

  it('açıklama boşsa çökmez', () => {
    expect(movementTextOf(task({ title: 'Bugün en az 30 dk aktif ol', description: '' }))).toContain('aktif ol');
  });
});

describe('findOpenMovementTasks — kapsam', () => {
  const movement = { title: 'Bugün 30+ dk hareket et (tempolu yürüyüş veya antrenman)' };

  it('bugüne ait açık plan görevini bulur', () => {
    const out = findOpenMovementTasks([task({ id: 7, ...movement })], today);
    expect(out).toEqual([{ id: 7, kind: 'move' }]);
  });

  it('KULLANICININ KENDİ görevine dokunmaz — `daily` etiketi yok', () => {
    // Kullanıcının yazdığı "koşuya çık" görevinin ne anlama geldiğini yalnız kendisi
    // bilir. Otomatik kapatmak, bizim üretmediğimiz bir sözü bizim yerimize vermek olurdu.
    const out = findOpenMovementTasks([task({ id: 7, ...movement, tags: ['fitness'] })], today);
    expect(out).toEqual([]);
  });

  it('etiketi hiç olmayan göreve dokunmaz', () => {
    const out = findOpenMovementTasks([task({ id: 7, ...movement, tags: [] })], today);
    expect(out).toEqual([]);
  });

  it('zaten tamamlanmış göreve dokunmaz', () => {
    const out = findOpenMovementTasks([task({ id: 7, ...movement, isCompleted: true })], today);
    expect(out).toEqual([]);
  });

  it('BAŞKA GÜNE ait göreve dokunmaz', () => {
    // Geçmiş bir günün görevini bugünün verisiyle kapatmak, o günün momentum kaydı
    // çoktan yazılmışken tabloyu geriye dönük değiştirirdi.
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const out = findOpenMovementTasks([task({ id: 7, ...movement, dueDate: iso(fmtDateKey(yesterday)) })], today);
    expect(out).toEqual([]);
  });

  it('tarihsiz göreve dokunmaz', () => {
    const out = findOpenMovementTasks([task({ id: 7, ...movement, dueDate: null })], today);
    expect(out).toEqual([]);
  });

  it('hareketle ilgisi olmayan plan görevine dokunmaz', () => {
    const out = findOpenMovementTasks([task({ id: 7, title: 'Bugün 2+ litre su iç ve şekerli içecekten kaçın' })], today);
    expect(out).toEqual([]);
  });

  it('karışık listeden yalnız uygun olanları seçer', () => {
    const out = findOpenMovementTasks(
      [
        task({ id: 1, ...movement }),
        task({ id: 2, title: 'Bugün 2+ litre su iç' }),
        task({ id: 3, title: 'Bugünkü koşunu planına göre tamamla' }),
        task({ id: 4, title: 'Bugünkü mesafeni ve nasıl hissettiğini kaydet' }),
        task({ id: 5, title: 'Bugünkü antrenman bölünmeni (split) tamamla' }),
      ],
      today,
    );
    expect(out).toEqual([
      { id: 1, kind: 'move' },
      { id: 3, kind: 'run' },
      { id: 5, kind: 'workout' },
    ]);
  });
});

/**
 * RAMAZAN GÖREVLERİ ÇEVİRİ SÖZLÜĞÜNDE.
 *
 * `getAllDailyPlanPairs`, dil değiştirildiğinde sistem görev başlıklarını çeviren
 * sözlüğü besliyor (bkz. systemTaskTranslator). Ramazan havuzları listede olmadığı için
 * Ramazan modu açıkken dil değiştiren kullanıcının günlük görevleri ESKİ DİLDE kalıyordu.
 *
 * Sessiz bir hataydı — bir şey çökmüyor, yalnızca karşılık bulunamıyor. Bu yüzden
 * gözle fark edilmesi zor, testle sabitlenmesi kolay.
 */
describe('günlük plan çiftleri — Ramazan varyantları dahil', () => {
  const { getAllDailyPlanPairs } = require('@/features/modes/utils/dailyPlanEngine');
  const pairs: Array<{ tr: string; en: string }> = getAllDailyPlanPairs();
  const allTr = pairs.map((p) => p.tr);

  it.each([
    'İftar sonrası 30+ dk hafif tempolu yürüyüş veya hareket et',
    'Bugünkü koşunu iftar sonrasına veya sahur öncesine planla',
    'Ağır antrenmanını iftar sonrasına planla ve splitini tamamla',
    'İftar sonrası en az 30 dk hafif aktif ol (mobilite/esneme)',
  ])('%s — çeviri sözlüğüne giriyor', (title) => {
    expect(allTr).toContain(title);
  });

  it('her çiftin iki dili de dolu — yarım kayıt çeviriyi sessizce bozar', () => {
    const broken = pairs.filter((p) => !p.tr?.trim() || !p.en?.trim());
    expect(broken).toEqual([]);
  });
});
