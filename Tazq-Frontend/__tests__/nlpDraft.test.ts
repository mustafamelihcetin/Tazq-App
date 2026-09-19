import { applyHint, markManual, rejectTag, visibleHint, EMPTY_DRAFT, type DraftControl, type DraftForm } from '@/features/tasks/nlp/draft';
import { parseTaskHint } from '@/features/tasks/utils/taskParser';

/**
 * TASLAK DENETİMİ — "elle seçilen her zaman kazanır".
 *
 * Görev formu başlıktaki her tuşta ayrıştırıcıyı çalıştırıyor. Bu testler, kullanıcı
 * yazarken motorun formu nasıl etkilediğini TUŞ TUŞ canlandırıyor: her senaryo, eski
 * formda ölçülen bir soruna karşılık geliyor.
 */

const NOW = new Date(2026, 8, 19, 10, 0, 0);
const EMPTY: DraftForm = { priority: 'Medium', dueDate: '', dueTime: null, recurrence: 'None', tags: [], reminderEnabled: false };

/** Kullanıcının yazdığı her ara hâli sırayla uygular — formun gördüğü gibi. */
function typeInto(steps: string[], start: { form: DraftForm; draft: DraftControl } = { form: EMPTY, draft: EMPTY_DRAFT }) {
  let { form, draft } = start;
  for (const text of steps) ({ form, draft } = applyHint(form, parseTaskHint(text, 'tr', NOW), draft));
  return { form, draft };
}

describe('dokunulmamış alanlar cümlenin aynası', () => {
  it('"yarın" yazılınca tarih gelir, SİLİNİNCE gider', () => {
    // Eskiden tarih yerinde kalıyordu: cümle ile form ayrışıyordu.
    expect(typeInto(['yarın ara']).form.dueDate).toBe('2026-09-20');
    expect(typeInto(['yarın ara', 'ara']).form.dueDate).toBe('');
  });

  it('otomatik etiket cümleyle birlikte değişir', () => {
    expect(typeInto(['market']).form.tags).toEqual(['alışveriş']);
    expect(typeInto(['market', 'doktor']).form.tags).toEqual(['sağlık']);
  });
});

describe('elle seçilen kazanır', () => {
  it('önceliği elle seçen kullanıcı yazmaya devam edince öncelik GERİ DÖNMEZ', () => {
    let s = typeInto(['rapor']);
    s = { form: { ...s.form, priority: 'High' }, draft: markManual(s.draft, 'priority') };
    const after = typeInto(['rapor sonra bak'], s);   // "sonra" → düşük öncelik der
    expect(after.form.priority).toBe('High');
  });

  it('elle seçilen tarih cümledeki "yarın"a ezilmez', () => {
    const s = { form: { ...EMPTY, dueDate: '2026-10-01' }, draft: markManual(EMPTY_DRAFT, 'dueDate') };
    expect(typeInto(['yarın toplantı'], s).form.dueDate).toBe('2026-10-01');
  });

  it('kullanıcının kendi etiketleri bir sonraki tuşta SİLİNMEZ', () => {
    // Eskiden form her tuşta etiketleri motorunkilerle değiştiriyordu.
    let s = typeInto(['toplantı']);
    s = { ...s, form: { ...s.form, tags: [...s.form.tags, 'proje-x'] } };
    const after = typeInto(['toplantı hazırlığı', 'toplantı hazırlığı bitti'], s);
    expect(after.form.tags).toContain('proje-x');
  });

  it('kaldırılan otomatik etiket GERİ GELMEZ', () => {
    let s = typeInto(['kiraya bak']);
    expect(s.form.tags).toEqual(['finans']);
    s = { form: { ...s.form, tags: [] }, draft: rejectTag(s.draft, 'finans') };
    expect(typeInto(['kiraya bak yarın'], s).form.tags).toEqual([]);
  });

  it('kullanıcının kendi etiketini kaldırması bir şeyi reddetmez', () => {
    const d = rejectTag({ ...EMPTY_DRAFT, autoTags: ['iş'] }, 'benim-etiketim');
    expect(d.rejected).toEqual([]);
  });

  it('hatırlatma anahtarına elle dokunulduysa motor onu kapatmaz', () => {
    const s = { form: { ...EMPTY, reminderEnabled: true }, draft: markManual(EMPTY_DRAFT, 'reminder') };
    expect(typeInto(['ekmek al'], s).form.reminderEnabled).toBe(true);
  });
});

describe('çipler yalnız GERÇEKTEN uygulananı gösterir', () => {
  it('elle seçilen alan ve reddedilen etiket çip olmaz', () => {
    const hint = parseTaskHint('acil fatura yarın', 'tr', NOW);
    const draft: DraftControl = { manual: ['priority'], autoTags: [], rejected: ['finans'] };
    const v = visibleHint(hint, draft);
    expect(v.priority).toBeUndefined();
    expect(v.tags).toEqual([]);
    expect(v.dueDate).toBe('2026-09-20');
  });
});

describe('hatırlatma niyeti', () => {
  it('"hatırlat" yazılınca anahtar açılır, silinince kapanır', () => {
    expect(typeInto(["yarın 9'da ilacı hatırlat"]).form.reminderEnabled).toBe(true);
    expect(typeInto(["yarın 9'da ilacı hatırlat", 'yarın ilaç']).form.reminderEnabled).toBe(false);
  });
});
