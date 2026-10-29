/**
 * Madde 8 — dışa aktarma temizleme hattı. Dosya paylaşılabilen bir şey: iç kimlikler,
 * sistem etiketleri ve iç şema dışarı çıkmaz; kullanıcının verisinin TAMAMI çıkar.
 */
import { buildExportPackage, exportToMarkdown, countRecords, type ExportSources } from '@/shared/utils/exportPackage';
import { visibleTextTags, isSomeday } from '@/features/tasks/utils/taskTags';

const deps = {
  localizeTitle: (t: { title: string }) => (t.title === 'sys_drink_water' ? 'Su iç' : t.title),
  visibleTags: visibleTextTags,
  isSomeday,
};

const src: ExportSources = {
  language: 'tr',
  theme: 'dark',
  currency: 'USD',
  user: { name: 'Melih', email: 'm@example.com', ...( { id: 42, token: 'jwt-secret' } as object) },
  tasks: [
    { ...({ id: 9001, userId: 42, sortOrder: 3, ignoreMomentum: true } as object), title: 'sys_drink_water', description: '', dueDate: new Date(2026, 9, 27, 12).toISOString(), isCompleted: true, completedAt: new Date(2026, 9, 27, 18).toISOString(), priority: 'High', tags: ['archived', 'weight_entry', 'iş', 'plan_exam'], isArchived: true, recurrence: 'None', subtasks: [{ title: 'bardak', done: true }] },
  ],
  habits: [{ ...({ id: 'h-1', color: '#fff', emoji: '💧', planMode: 'spor' } as object), name: 'water', nameTr: 'Su', nameEn: 'Water', createdAt: new Date(2026, 8, 1, 12).toISOString(), completedDates: ['2026-10-27'] }],
  focusSessions: [{ startedAt: new Date(2026, 9, 27, 9, 5).toISOString(), minutes: 25 }, { startedAt: new Date(2026, 9, 28, 14, 0).toISOString(), minutes: 50 }],
  budget: { budgetType: 'savings', startAmount: '0', targetAmount: '1000', log: [{ date: '2026-10-01', amount: 200 }] },
  payments: [{ ...({ id: 7, lastPaidCycleKey: '2026-10' } as object), title: 'Kira', amount: 24, dueDay: 5, recurrence: 'Monthly' }],
  preferences: { soundEffects: false, examPlanTaskIds: [1, 2], tourSeen: { dashboard: true }, _hasHydrated: true, focusAutoZen: false },
};

const pkg = buildExportPackage(src, deps, new Date(2026, 9, 29));
const json = JSON.stringify(pkg);

describe('dışa aktarma paketi', () => {
  it('iç kimlikler ve sırlar dosyaya GİRMEZ', () => {
    for (const leak of ['9001', '"userId"', '"id":42', 'jwt-secret', 'token', 'sortOrder', 'ignoreMomentum', 'lastPaidCycleKey', '"h-1"', 'planMode']) {
      expect(json).not.toContain(leak);
    }
  });

  it('sistem etiketleri elenir, kullanıcı etiketi kalır; arşiv bayrak olarak çıkar', () => {
    expect(pkg.tasks[0].tags).toEqual(['iş']);
    expect(pkg.tasks[0].archived).toBe(true);
    expect(json).not.toContain('weight_entry');
    expect(json).not.toContain('plan_exam');
  });

  it('sistem görev başlığı kullanıcının dilinde', () => {
    expect(pkg.tasks[0].title).toBe('Su iç');
  });

  it('tarih ve saat okunur biçimde (yerel gün)', () => {
    expect(pkg.tasks[0].dueDate).toBe('2026-10-27');
    expect(pkg.tasks[0].completedOn).toBe('2026-10-27');
    expect(pkg.focus.sessions[0]).toEqual({ date: '2026-10-27', start: '09:05', minutes: 25 });
  });

  it('tercihler İZİN LİSTESİYLE — iç şema (plan kimlikleri, tur durumu) çıkmaz', () => {
    expect(pkg.preferences).toEqual({ language: 'tr', theme: 'dark', currency: 'USD', soundEffects: false, focusAutoZen: false });
  });

  it('eskiden kaybolan veriler artık pakette: odak geçmişi, birikim, ödemeler', () => {
    expect(pkg.focus.totalMinutes).toBe(75);
    expect(pkg.savings?.entries).toEqual([{ date: '2026-10-01', amount: 200 }]);
    expect(pkg.payments[0]).toEqual({ title: 'Kira', amount: 24, currency: 'USD', dayOfMonth: 5, repeat: 'monthly' });
  });

  it('alışkanlık kullanıcının dilinde ve süs alanları olmadan', () => {
    expect(pkg.habits[0]).toEqual({ name: 'Su', startedOn: '2026-09-01', doneOn: ['2026-10-27'] });
  });

  it('biçim sürümlü', () => {
    expect(pkg.formatVersion).toBe(2);
    expect(pkg.format).toBe('tazq-export');
  });

  it('kayıt sayısı', () => {
    expect(countRecords(pkg)).toBe(1 + 1 + 2 + 1 + 1);
  });

  it('Markdown okunur sürüm: görev, alt görev, odak ve ödeme', () => {
    const md = exportToMarkdown(pkg, 'tr');
    expect(md).toContain('# TAZQ verilerim');
    expect(md).toContain('- [x] Su iç');
    expect(md).toContain('  - [x] bardak');
    expect(md).toContain('Toplam odak: 75 dk');
    expect(md).toContain('- Kira — 24 USD');
    expect(md).not.toContain('9001');
    expect(md).toContain('yüksek öncelik'); // öncelik kullanıcının dilinde, "high" değil
  });
});
