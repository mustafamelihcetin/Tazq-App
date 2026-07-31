import { snapshotMode, restoreMode } from '@/features/modes/utils/modeUndo';
import { useHabitStore } from '@/features/habits/store/useHabitStore';
import { useTaskStore } from '@/features/tasks/store/useTaskStore';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { useNetworkStore } from '@/shared/store/useNetworkStore';
import { useOfflineQueue } from '@/shared/store/useOfflineQueue';

/**
 * MOD GERİ ALMA — geri alınamaz veri kaybının tek sigortası.
 *
 * Kullanıcı bir modu kapattığında o moda ait alışkanlıklar ve görevler siliniyor.
 * "Geri al" bunu kurtaran TEK yol ve toast kapanınca kaybolan bir fırsat. Bu kod
 * bozulursa kullanıcı aylık serisini, kilo kaydını, çalışma geçmişini kaybeder —
 * ve geri getirmenin bir yolu olmaz.
 *
 * NEDEN TEST EDİLMEMİŞTİ: mutlu yol elle denendiğinde çalışıyor görünüyor. Kırılma
 * ayrıntıda: seri korunuyor mu, çevrimdışıyken ne oluyor, iki kez geri alınırsa
 * kopya mı oluşuyor. Hiçbiri gözle fark edilmez.
 */

const MODE = 'spor';

function resetStores() {
  useHabitStore.setState({ habits: [] } as any);
  useTaskStore.setState({ tasks: [] } as any);
  useOfflineQueue.setState({ ops: [] } as any);
  useNetworkStore.setState({ isOnline: false } as any); // ağ YOK → kuyruk yolu
  usePrefsStore.setState({
    seasonal: { sporMode: true, examMode: false },
    sporPlanHabitIds: [],
    sporPlanTaskIds: [],
  } as any);
}

/** Moda ait bir alışkanlık + görev kurar. */
function seed() {
  const habit = {
    id: 'h-spor-1',
    name: 'Direnç antrenmanı',
    nameTr: 'Direnç antrenmanı',
    nameEn: 'Resistance training',
    emoji: '💪',
    color: '#000',
    planMode: MODE,
    // Seri: kullanıcının haftalarca biriktirdiği şey. Geri almanın ASIL sınavı bu.
    completedDates: ['2026-07-01', '2026-07-02', '2026-07-03'],
  };
  const task = {
    id: 101,
    title: 'Bugün 30+ dk hareket et',
    description: '',
    isCompleted: false,
    priority: 'Medium',
    dueDate: '2026-07-05',
    // Etiket MODE_TASK_TAGS.spor listesinden olmalı — fotoğraf görevleri etikete
    // göre topluyor. İlk yazdığımda 'kilo yönetimi' kullanmıştım (arayüzdeki rozet
    // metni); gerçek etiket 'kilo'. Test verisi yanlıştı, kod değil.
    tags: ['kilo'],
    subtasks: [],
    recurrence: 'None',
  };
  useHabitStore.setState({ habits: [habit] } as any);
  useTaskStore.setState({ tasks: [task] } as any);
  usePrefsStore.setState({ sporPlanHabitIds: [habit.id], sporPlanTaskIds: [task.id] } as any);
  return { habit, task };
}

beforeEach(resetStores);

describe('snapshotMode — kapatmadan önceki fotoğraf', () => {
  it('moda ait alışkanlığı yakalar', () => {
    const { habit } = seed();
    const snap = snapshotMode(MODE);
    expect(snap.habits.map(h => h.id)).toContain(habit.id);
  });

  it('id listesi BAYAT olsa bile etiketten yakalar', () => {
    // Gerçek hata kaynağı: `sporPlanHabitIds` güncellenmemiş olabiliyor.
    // İki yoldan biri kaçırırsa öteki yakalamalı, yoksa alışkanlık geri gelmez.
    const { habit } = seed();
    usePrefsStore.setState({ sporPlanHabitIds: [] } as any);
    const snap = snapshotMode(MODE);
    expect(snap.habits.map(h => h.id)).toContain(habit.id);
  });

  it('KOPYA alır — sonraki değişiklik fotoğrafı bozmaz', () => {
    // Referans tutulsaydı, kapatma sırasında store'daki nesne değişince
    // "geri alınacak hâl" de değişir ve yanlış veri geri yüklenirdi.
    const { habit } = seed();
    const snap = snapshotMode(MODE);
    useHabitStore.setState({ habits: [{ ...habit, completedDates: [] }] } as any);
    expect(snap.habits[0].completedDates).toHaveLength(3);
  });

  it('moda AİT OLMAYAN veriye dokunmaz', () => {
    seed();
    useHabitStore.setState(s => ({
      habits: [...s.habits, { id: 'h-baska', name: 'Kitap', completedDates: [] }],
    }) as any);
    const snap = snapshotMode(MODE);
    expect(snap.habits.map(h => h.id)).not.toContain('h-baska');
  });

  it('seasonal tercihlerinin kopyasını alır', () => {
    seed();
    const snap = snapshotMode(MODE);
    expect(snap.seasonal.sporMode).toBe(true);
    // Kopya olmalı: sonradan değişen tercih fotoğrafı bozmasın.
    usePrefsStore.setState({ seasonal: { sporMode: false } } as any);
    expect(snap.seasonal.sporMode).toBe(true);
  });
});

describe('restoreMode — geri yükleme', () => {
  it('SERİYİ korur — asıl sınav bu', () => {
    // Alışkanlık aynı id ve aynı completedDates ile dönmeli. Yeni id verilseydi
    // ya da tarihler boş dönseydi kullanıcı haftalarca biriktirdiği seriyi kaybederdi.
    const { habit } = seed();
    const snap = snapshotMode(MODE);

    useHabitStore.setState({ habits: [] } as any); // mod kapatıldı
    return restoreMode(snap).then(() => {
      const restored = useHabitStore.getState().habits.find(h => h.id === habit.id);
      expect(restored).toBeTruthy();
      expect(restored!.completedDates).toEqual(['2026-07-01', '2026-07-02', '2026-07-03']);
    });
  });

  it('iki kez geri alınırsa KOPYA oluşturmaz', () => {
    // Kullanıcı toast'a iki kez basabilir; her basış yeni bir alışkanlık eklememeli.
    const { habit } = seed();
    const snap = snapshotMode(MODE);
    useHabitStore.setState({ habits: [] } as any);

    return restoreMode(snap)
      .then(() => restoreMode(snap))
      .then(() => {
        const all = useHabitStore.getState().habits.filter(h => h.id === habit.id);
        expect(all).toHaveLength(1);
      });
  });

  it('ÇEVRİMDIŞIYKEN görevleri kuyruğa alır — sessizce kaybetmez', async () => {
    // Ağ yokken geri alma çalışmazsa kullanıcı verisini kaybeder ve bunu ancak
    // günler sonra fark eder.
    seed();
    const snap = snapshotMode(MODE);
    useTaskStore.setState({ tasks: [] } as any);

    await restoreMode(snap);

    const queued = useOfflineQueue.getState().ops.filter((q: any) => q.type === 'create-task');
    expect(queued.length).toBeGreaterThan(0);
    // Yerel listede de HEMEN görünmeli — kullanıcı geri aldığını görmeli.
    expect(useTaskStore.getState().tasks.length).toBeGreaterThan(0);
  });

  it('görev İÇERİĞİ korunur — başlık, tarih, durum', async () => {
    const { task } = seed();
    const snap = snapshotMode(MODE);
    useTaskStore.setState({ tasks: [] } as any);

    await restoreMode(snap);

    const restored = useTaskStore.getState().tasks[0];
    expect(restored.title).toBe(task.title);
    expect(restored.dueDate).toBe(task.dueDate);
    expect(restored.isCompleted).toBe(task.isCompleted);
    expect(restored.tags).toEqual(task.tags);
  });

  it('kapatılan modun tercihini geri açar', async () => {
    seed();
    const snap = snapshotMode(MODE);          // spor: true
    usePrefsStore.setState({ seasonal: { sporMode: false } } as any);

    await restoreMode(snap);

    expect((usePrefsStore.getState().seasonal as any).sporMode).toBe(true);
  });

  /**
   * GERİ ALMA YALNIZ KENDİ MODUNA DOKUNUR.
   *
   * Eskiden fotoğraftaki TÜM seasonal anahtarları geri yazılıyordu. Senaryo: kullanıcı
   * spor modunu kapatıyor, toast çıkıyor; o birkaç saniyede SINAV modunu açıyor; sonra
   * "Geri al"a basıyor. Spor geri geliyor ama sınav da kapanıyordu — kullanıcının az
   * önce yaptığı, tamamen ilgisiz bir seçim sessizce geri alınıyordu.
   *
   * Kapsam ad önekiyle çiziliyor: seasonal anahtarları mod adıyla başlıyor
   * (`sporMode`, `sporGoal`, `examDate`…), yani "bu moda ait mi" sorusu tahminsiz
   * cevaplanabiliyor.
   */
  it('ARADA yapılan başka mod değişikliğine DOKUNMAZ', async () => {
    seed();
    const snap = snapshotMode(MODE);          // sporMode: true, examMode: false
    usePrefsStore.setState({ seasonal: { sporMode: false, examMode: true } } as any);

    await restoreMode(snap);

    const seasonal = usePrefsStore.getState().seasonal as any;
    expect(seasonal.sporMode).toBe(true);   // kendi modu geri geldi
    expect(seasonal.examMode).toBe(true);   // kullanıcının açtığı mod KAPANMADI
  });

  it('boş fotoğrafta çökmez', async () => {
    const snap = snapshotMode(MODE); // hiç veri yok
    await expect(restoreMode(snap)).resolves.toBeUndefined();
  });
});
