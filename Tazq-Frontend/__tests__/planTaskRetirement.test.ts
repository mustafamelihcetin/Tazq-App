/**
 * MOD KAPATMA — KULLANICININ KENDİ GÖREVİNE DOKUNMAZ.
 *
 * ÖLÇÜLEN SORUN: `retireModeTasksByTag` görevleri başlık İÇİNDE serbest alt-dizi
 * araması ile eşleştiriyordu ve eşleşeni `retirePlanTask` ile hem yerelden hem
 * SUNUCUDAN kalıcı siliyordu. Emoji önekleri kaldırılınca spor hedefleri gündelik
 * ifadelere döndü ("Kilo Yönetimi", "Genel Form"), yani alt-dizi araması artık
 * kullanıcının kendi yazdığı görevlere de çarpıyordu. Geri alma yok.
 *
 * Ad eşleşmesi KALDIRILAMAZ (plan başlıkları adı cümle ortasında taşır), o yüzden
 * sınır ada değil MÜLKİYETE kondu: yalnız plan üretimi görevler eşleşebilir.
 */
import { useTaskStore } from '@/features/tasks/store/useTaskStore';
import { retireModeTasksByTag, isPlanOwnedTask, PLAN_TAGS, MODE_TASK_TAGS } from '@/features/modes/utils/planTaskOps';

jest.mock('@/shared/services/api', () => ({
  TaskService: { deleteTask: jest.fn().mockResolvedValue(undefined) },
}));

const mkTask = (id: number, title: string, tags: string[] = []) =>
  ({ id, title, description: '', isCompleted: false, priority: 'Medium', dueDate: null, tags } as any);

const seed = (tasks: any[]) => useTaskStore.setState({ tasks });
const titles = () => useTaskStore.getState().tasks.map(t => t.title);

beforeEach(() => {
  useTaskStore.setState({ tasks: [] });
  jest.clearAllMocks();
});

describe('retireModeTasksByTag — mülkiyet sınırı', () => {
  it('etiketi eşleşen plan görevini emekliye ayırır', () => {
    seed([mkTask(1, 'Hafta 3 sprint: tam YKS denemesi çöz', ['exam'])]);
    retireModeTasksByTag('exam', 'YKS');
    expect(titles()).toEqual([]);
  });

  it('adı cümle ORTASINDA geçen plan görevini de yakalar (öksüz kalmasın)', () => {
    // Etiketi bu modun kümesinde değil ama plan üretimi — ad eşleşmesi devreye girer.
    seed([mkTask(2, 'Hafta 3 sprint: tam YKS denemesi çöz', ['daily'])]);
    retireModeTasksByTag('exam', 'YKS');
    expect(titles()).toEqual([]);
  });

  it('KULLANICININ kendi görevini adı geçse bile SİLMEZ', () => {
    seed([mkTask(3, 'Kilo yönetimi için diyetisyen ara', ['sağlık'])]);
    retireModeTasksByTag('spor', 'Kilo Yönetimi');
    expect(titles()).toEqual(['Kilo yönetimi için diyetisyen ara']);
  });

  it('etiketsiz kullanıcı görevine dokunmaz', () => {
    seed([mkTask(4, 'Genel form tutmak için yürüyüş planı yap', [])]);
    retireModeTasksByTag('spor', 'Genel Form');
    expect(titles()).toEqual(['Genel form tutmak için yürüyüş planı yap']);
  });

  it('kısa adlar ad-eşleşmesini hiç açmaz (2 harf her başlıkta geçer)', () => {
    seed([mkTask(5, 'Evde temizlik', ['daily'])]);
    retireModeTasksByTag('tasarruf', 'ev');
    expect(titles()).toEqual(['Evde temizlik']);
  });

  it('Türkçe büyük/küçük harf doğru eşleşir (I ≠ ı sorunu)', () => {
    seed([mkTask(6, 'KILO ÖLÇÜMÜ: haftalık tartı', ['spor'])]);
    retireModeTasksByTag('spor', 'Kilo');
    expect(titles()).toEqual([]);
  });

  it('ad verilmezse yalnız etiket eşleşmesi çalışır', () => {
    seed([
      mkTask(7, 'Ramazan planı: sahur hazırlığı', ['ramazan']),
      mkTask(8, 'Ramazan alışverişi yap', []),
    ]);
    retireModeTasksByTag('ramazan');
    expect(titles()).toEqual(['Ramazan alışverişi yap']);
  });
});

describe('isPlanOwnedTask', () => {
  it('plan etiketlerini tanır', () => {
    for (const tag of PLAN_TAGS) {
      expect(isPlanOwnedTask({ tags: [tag] })).toBe(true);
    }
  });

  it('mod etiketlerini tanır', () => {
    for (const tag of Object.values(MODE_TASK_TAGS).flat()) {
      expect(isPlanOwnedTask({ tags: [tag] })).toBe(true);
    }
  });

  it('NLP ayrıştırıcısının kullanıcı etiketlerini plan SAYMAZ', () => {
    // features/tasks/utils/taskParser.ts → CLUSTER_TO_TAG + taskTags.ts → ICON_TAGS
    const userTags = [
      'önemli', 'sosyal', 'iş', 'acil', 'sağlık', 'finans', 'eğitim', 'alışveriş', 'ev',
      'important', 'social', 'work', 'urgent', 'health', 'finance', 'education', 'shopping', 'home',
      'hatırlatıcı', 'reminder', 'etkinlik', 'event', 'not', 'note',
    ];
    for (const tag of userTags) {
      expect(isPlanOwnedTask({ tags: [tag] })).toBe(false);
    }
  });

  it('weight_entry plan sayılmaz — kilo geçmişi mod kapanınca korunur', () => {
    expect(isPlanOwnedTask({ tags: ['weight_entry'] })).toBe(false);
  });

  it('etiketsiz görev plan sayılmaz', () => {
    expect(isPlanOwnedTask({ tags: [] })).toBe(false);
    expect(isPlanOwnedTask({ tags: null })).toBe(false);
    expect(isPlanOwnedTask({})).toBe(false);
  });
});
