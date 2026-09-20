import fs from 'fs';
import path from 'path';
import { datePassed } from '@/features/modes/utils/modeCompletion';

/**
 * YAŞAM MODLARI — ölçülen kusurlar.
 *
 *  1. Üstteki özet kartı 7 moddan 2'sini HİÇ görmüyordu: Tasarruf ve Bırakma ne
 *     "N mod" sayısına, ne "en yakın hedef" geri sayımına, ne de "bugün X/Y"
 *     ilerlemesine giriyordu. Yalnız bu iki modu kullanan kişi, kendi aktif kartları
 *     hemen altında dururken "0 mod · tarihli hedef yok · bugün planlı iş yok" görüyordu.
 *  2. Yalnız SINAV modu bittiğini biliyordu. Tez/mülakat/spor hedef tarihi geçince
 *     kart "Tarih geçti" yazıyor ama kimse bir şey sormuyor; alışkanlıklar her sabah
 *     gelmeye devam ediyordu (hayalet mod).
 *  3. Her kart kendi yükünü yazıyordu ama üst üste binen modların TOPLAMINI kimse
 *     söylemiyordu (aynı anda 12 plana kadar kurulabiliyor).
 *  4. Özet (grafik) ikonu sol yuvadaydı — geri tuşunun yeri; üstelik Haftalık
 *     Merkez'de aynı ikon sağda.
 */

const read = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
const MODLAR = read('app/modlar.tsx');

describe('özet kartı TÜM modları görür', () => {
  it('aktif mod sayısına tasarruf ve bırakma da girer', () => {
    const block = MODLAR.slice(MODLAR.indexOf('const statusActiveCount'), MODLAR.indexOf('const hasAnyActiveMode'));
    expect(block).toContain('seasonal.tasarrufMode && tasarrufApplied');
    expect(block).toContain('seasonal.birakmaMode && birakmaApplied');
  });

  it('tasarrufun hedef tarihi geri sayıma girer (bırakmanın tarihi yok)', () => {
    expect(MODLAR).toContain('pushCand(seasonal.tasarrufMode && tasarrufApplied, seasonal.tasarrufDate');
  });

  it('bugünkü ilerleme etikete değil TÜM MODLARIN PLANINA bakar', () => {
    /*
      Eski ölçü 'daily' etiketiydi: kendi akışını kullanan tasarruf ve bırakma hiç
      görünmüyordu. Mod başına toplamak da yetmez — ikinci/üçüncü slotlar (iki sınav,
      iki spor hedefi) dışarıda kalır. Ölçü: tüm slotların birleşimi.
    */
    expect(MODLAR).not.toMatch(/statusTodayTasks = useTaskStore\.getState\(\)\.tasks\.filter\(t => t\.tags\?\.includes\('daily'\)/);
    const block = MODLAR.slice(MODLAR.indexOf('const allPlanTaskIds'), MODLAR.indexOf('const statusTodayPct'));
    for (const ids of ['exam2PlanTaskIds', 'exam3PlanTaskIds', 'spor2PlanTaskIds', 'spor3PlanTaskIds',
                       'mulakat3PlanTaskIds', 'tasarrufPlanTaskIds', 'birakmaPlanTaskIds', 'ramazanPlanTaskIds']) {
      expect(block).toContain(ids);
    }
    expect(block).toContain('statusTodayAgg');
  });

  it('tasarruf/bırakma plan kimlikleri tepkisel okunur', () => {
    expect(MODLAR).not.toContain('applied(usePrefsStore.getState().tasarrufPlanHabitIds');
    expect(MODLAR).toContain('tasarrufPlanHabitIds, tasarrufPlanTaskIds,');
  });
});

describe('hedef tarihi geçince mod kendini kapatır', () => {
  it('gün SONUNA kadar "geçti" sayılmaz', () => {
    const noon = new Date(2026, 8, 20, 12, 0).getTime();
    expect(datePassed('2026-09-20', noon)).toBe(false);   // aynı gün
    expect(datePassed('2026-09-19', noon)).toBe(true);    // dün
    expect(datePassed('2026-09-21', noon)).toBe(false);   // yarın
    expect(datePassed(null, noon)).toBe(false);
    expect(datePassed(undefined, noon)).toBe(false);
  });

  it('tez, mülakat ve spor da ritüeli kullanır', () => {
    for (const f of ['TezCard', 'MulakatCard', 'SporCard']) {
      const src = read(`features/modes/components/modes/${f}.tsx`);
      expect(`${f}: ${src.includes('useModeCompletionReview({')}`).toBe(`${f}: true`);
      expect(`${f}: ${src.includes('closePlan: () => closePlan()')}`).toBe(`${f}: true`);
    }
  });

  it('kapatma GERİ ALINABİLİR — yanlışlıkla silinen plan geri gelir', () => {
    const hook = read('features/modes/hooks/useModeCompletionReview.ts');
    expect(hook).toContain('closeModeWithUndo(planMode, closePlan, copy.toast, copy.undo)');
    // Kullanıcı ısrar edilmeden çıkabilmeli.
    expect(hook).toContain("style: 'cancel'");
  });

  it('her modun AYRI bayrağı var ve yeni tarihte ritüel yeniden kurulur', () => {
    const prefs = read('features/modes/store/usePrefsStore.ts');
    for (const flag of ['examReviewShown', 'tezReviewShown', 'mulakatReviewShown', 'sporReviewShown']) {
      expect(prefs).toContain(`${flag}: false,`);
    }
    const hook = read('features/modes/hooks/useModeCompletionReview.ts');
    expect(hook).toContain('if (shown && dateStr && !datePassed(dateStr)) setShown(false);');
  });
});

describe('toplam yük ve başlık düzeni', () => {
  it('plan uygulanınca BUGÜNKÜ TOPLAM yük söylenir', () => {
    expect(MODLAR).toContain('collectAllPlanTaskIds()');
    expect(MODLAR).toContain('LOAD_COPY[language === ');
    expect(MODLAR).toMatch(/bugün toplam \$\{n\} plan görevin var/);
  });

  it('özet ikonu sağda, tanıtım solda — Haftalık Merkez ile aynı kural', () => {
    const header = MODLAR.slice(MODLAR.indexOf('<ScreenHeader'), MODLAR.indexOf('<View style={{ flex: 1 }}>'));
    const leftIdx = header.indexOf('left={');
    const rightIdx = header.indexOf('right={');
    expect(leftIdx).toBeGreaterThan(-1);
    expect(rightIdx).toBeGreaterThan(leftIdx);
    expect(header.slice(rightIdx)).toContain("router.push('/mod-ozet')");
    expect(header.slice(leftIdx, rightIdx)).toContain("setTourCompleted('modlar', false)");
  });

  it('turun hedefi özet düğmesiyle birlikte taşındı', () => {
    const header = MODLAR.slice(MODLAR.indexOf('<ScreenHeader'), MODLAR.indexOf('<View style={{ flex: 1 }}>'));
    const rightIdx = header.indexOf('right={');
    expect(header.slice(rightIdx)).toContain('<TourTarget id="overview">');
  });
});

describe('ritüel başka hedefleri SİLMEZ', () => {
  /*
    `closePlan`/`closeAll` birinci slotu temizlerken modu TÜMÜYLE kapatıyor. Birinci
    sınavın tarihi geçtiğinde otomatik kapanış, aylar sonraki ikinci sınavın planını da
    götürürdü (mülakat ve sporda ise o planlar sahipsiz kalırdı: alışkanlıkları listede,
    modu kapalı). Birden çok hedefi olan kullanıcıya otomatik soru sorulmaz.
  */
  it('sınav: ikinci/üçüncü slot doluysa ritüel çalışmaz', () => {
    const src = read('features/modes/components/modes/ExamCard.tsx');
    expect(src).toContain('const otherExamSlotsEmpty =');
    expect(src).toMatch(/if \(s\.examMode && otherExamSlotsEmpty &&/);
  });

  it('mülakat ve spor: aynı koruma', () => {
    const mul = read('features/modes/components/modes/MulakatCard.tsx');
    expect(mul).toContain('otherMulakatSlotsEmpty');
    expect(mul).toMatch(/enabled: !!seasonal\.mulakatMode && otherMulakatSlotsEmpty/);
    const spor = read('features/modes/components/modes/SporCard.tsx');
    expect(spor).toContain('otherSporSlotsEmpty');
    expect(spor).toMatch(/enabled: !!seasonal\.sporMode && otherSporSlotsEmpty/);
  });

  it('"soruldu" işareti uyarı GÖSTERİLİRKEN yazılır', () => {
    // Bayrak beklemeden önce yazılsaydı, kullanıcı o sırada sayfadan çıkınca soru hiç
    // görünmeden "soruldu" sayılır ve bir daha sorulmazdı.
    const hook = read('features/modes/hooks/useModeCompletionReview.ts');
    const timer = hook.slice(hook.indexOf('const timer = setTimeout'), hook.indexOf('}, 400);'));
    expect(timer).toContain('setShown(true);');
    expect(hook.slice(0, hook.indexOf('const timer = setTimeout'))).not.toContain('setShown(true);');
  });

  it('toplam yük sayımı ÜRETİM BİTTİKTEN sonra okunur', () => {
    expect(MODLAR).toContain('Promise.resolve(runAdaptations(true))');
    expect(MODLAR).not.toMatch(/runAdaptations\(true\);\s*setTimeout/);
  });
});

describe('görsel dil — yaşayan plan bir DURUM, form değil', () => {
  /*
    Aynı özet dört kartta ayrı yazılmıştı ve şimdiden ayrışmıştı: üçünde sayı 40pt/600,
    sporda F.hero/700; "gün kaldı" dört kez kopyalanmış, geçmiş tarih her kartta başka
    cümleyle anlatılıyordu. Prestij tutarlılıktan doğar.
  */
  const CARDS = ['ExamCard', 'TezCard', 'MulakatCard', 'SporCard'];

  it('dört kart da ORTAK özeti kullanır', () => {
    for (const f of CARDS) {
      const src = read(`features/modes/components/modes/${f}.tsx`);
      expect(`${f}: ${src.includes('<ModePlanSummary')}`).toBe(`${f}: true`);
      // Kopya geri gelmesin: elle yazılmış 40pt geri sayım ve "GÜN" etiketi kalmadı.
      expect(`${f}: ${/fontSize: 40, lineHeight: 42/.test(src)}`).toBe(`${f}: false`);
    }
  });

  it('spor modunun ÖZEL ölçüsü korunur (kilo yolu / haftalık antrenman)', () => {
    const spor = read('features/modes/components/modes/SporCard.tsx');
    expect(spor).toContain('progress={');
    expect(spor).toContain('kiloPct');
    expect(spor).toContain('sporWeekDays');
  });

  it('özet her ihtimali karşılar: tarihsiz, geçmiş, bugün, boş gün', () => {
    const sum = read('features/modes/components/ModePlanSummary.tsx');
    expect(sum).toContain('daysLeft == null');      // tarih yok
    expect(sum).toContain('if (past)');             // tarih geçti
    expect(sum).toContain('daysLeft === 0');        // hedef bugün
    expect(sum).toContain('nothingToday');          // bugün planlı iş yok
    expect(sum).toContain('adjustsFontSizeToFit');  // büyük yazı ayarı
    expect(sum).toContain('accessibilityLabel');    // tek cümle duyuru
  });

  it('durum kartı KAHRAMAN: tek büyük sayı + ortak ilerleme çubuğu', () => {
    // Kart artık kendi dosyasında (modlar.tsx 1700 satırı geçmişti).
    const CARD = read('features/modes/components/ModeStatusCard.tsx');
    const hero = CARD.slice(CARD.indexOf('KAHRAMAN SATIRI'), CARD.indexOf('const styles'));
    expect(hero).toContain('fontSize: F.hero');
    expect(hero).toContain('<ProgressRail');
    // Altı nokta yerine kartlarla aynı çubuk kullanılıyor.
    expect(hero).not.toContain('Math.min(statusTodayTotal, 6)');
  });

  it('tarihli hedefi olmayan kullanıcıya da bir cümle var', () => {
    const CARD = read('features/modes/components/ModeStatusCard.tsx');
    expect(CARD).toContain('openEndedTitle');
    expect(CARD).toContain('openEndedBody');
  });

  it('kartlar sırayla süzülür ama tur konumları bozulmaz', () => {
    expect(MODLAR).toContain('delay: Math.min(index, 5) * 60');
    // onLayout taşıyıcı View'da KALMALI: tur ve kaydırma o konuma bakıyor.
    expect(MODLAR).toMatch(/onLayout=\{\(e\) => \{[\s\S]{0,160}cardY\.current\[m\.id\]/);
  });
});

/**
 * KURULUM FORMLARI — renk, davranış, animasyon.
 *
 *  5. Dolu aksan butonları ("Planı Seç ›", "Kaydet", "Planı Uygula") yazılarını SABİT
 *     beyaz yazıyordu. Açık temada doğru; koyu temada aksan pastele dönüyor (#93C5FD)
 *     ve beyaz yazı 1.4:1 kalıyor — yani buton okunmuyordu.
 *  6. Form `{expanded && ...}` ile bir anda beliriyordu: kart büyürken içerik zıplıyor,
 *     üstelik ekranın geri kalanı (kart girişleri, geri sayım) yumuşak.
 *  7. Alan kabuğu yedi kartta kopyalanmıştı ve odakta hiçbir şey değişmiyordu.
 *  8. Anahtarların iki farklı dili vardı: beş kartta topuz aksan renginde ve ray aksanın
 *     yarısı (topuz raya karışıyor), iki kartta standart beyaz topuz.
 */
describe('mod kurulum formları', () => {
  const CARDS = ['ExamCard', 'MulakatCard', 'SporCard', 'TezCard', 'BirakmaCard', 'TasarrufCard']
    .map(n => [n, read(`features/modes/components/modes/${n}.tsx`)] as const);

  it('dolu aksan butonunda yazı rengi temaya göre çözülür, sabit beyaz değil', () => {
    for (const [name, src] of CARDS) {
      // Kalan tek beyaz: anahtarın topuzu (iOS standardı) — o bilerek sabit.
      const whites = src.split('\n').filter(l => /color: '#fff'|color="#fff"|: '#fff'/.test(l) && !l.includes('thumbColor'));
      expect([name, whites]).toEqual([name, []]);
    }
    expect(read('shared/hooks/useModeAccent.ts')).toContain('onAccent: modeAccentOn(isDark)');
  });

  it('form açılırken süzülür (kartların geri kalanıyla aynı dil)', () => {
    for (const [name, src] of CARDS) {
      expect([name, src.includes('<FormReveal')]).toEqual([name, true]);
      // "!expanded" dalı (kapalı haldeki özet) animasyona GİRMEMELİ: o bir form değil.
      expect([name, /!expanded && \(\s*\n\s*<FormReveal/.test(src)]).toEqual([name, false]);
    }
  });

  it('girdi alanları tek kabuktan gelir ve odakta vurgulanır', () => {
    for (const [name, src] of CARDS) {
      expect([name, src.includes('<TextInput')]).toEqual([name, false]);
      expect([name, src.includes('<ModeField')]).toEqual([name, true]);
    }
    const field = read('features/modes/components/ModeField.tsx');
    expect(field).toContain('focused ? accent : restColor');
    expect(field).toContain("transition={{ type: 'timing', duration: 160 }}");
  });

  it('anahtarlar tek dilde: renkli ray + beyaz topuz', () => {
    for (const [name, src] of CARDS.concat([['RamazanCard', read('features/modes/components/modes/RamazanCard.tsx')]])) {
      if (!src.includes('trackColor')) continue;
      // Yarım saydam ray + aksan topuz = topuzun raya karışması.
      expect([name, /true: [^}]*\+ '80'/.test(src)]).toEqual([name, false]);
    }
  });

  it('çakışma uyarısı ham hex değil tema token’ı kullanır', () => {
    const exam = CARDS.find(([n]) => n === 'ExamCard')![1];
    expect(exam).toContain('color: theme.warning');
    expect(exam).not.toContain('#F59E0B');
  });
});

describe('tartım girişi', () => {
  const SPOR = read('features/modes/components/modes/SporCard.tsx');

  it('geçerlilik kuralı tek yerde ve "Kaydet" geçersizken sönük', () => {
    // 20–300 kg aralığı iki JSX satırında kopyalanmıştı; buton hep dolu görünüyor,
    // geçersiz değerde basıldığında sessizce hiçbir şey olmuyordu.
    expect(SPOR).toContain('const weightEntryValid =');
    expect(SPOR).toContain('disabled={!weightEntryValid}');
    expect((SPOR.match(/> 20 && /g) || []).length).toBe(1);
  });
});

/**
 * SAYFANIN 25. GÜN SINAVI.
 *
 *  9. Hayatın araya girmesi için yer yoktu: planı DURAKLATMANIN hiçbir yolu yoktu.
 *     Hasta olan kullanıcının iki seçeneği vardı — ya görevler gelmeye devam etsin ve
 *     birikmiş suçluluğa dönüşsün, ya da modu kapatıp planı tamamen kaybetsin.
 * 10. Geri sayım baskı yapıyor, emek görünmüyordu: 25. gündeki kullanıcı "35 GÜN" ve
 *     "bugün 2/3" görüyor, 25 gündür ne yaptığını hiçbir yerde görmüyordu.
 * 11. Kapatılan hedef ekrandan siliniyordu — üç aylık emekten geriye iz kalmıyordu.
 * 12. Durum kartı kaç hedef olursa olsun YALNIZ BİRİNİ gösteriyordu.
 * 13. Toplam yük ancak plan uygulandıktan SONRA söyleniyordu.
 */
describe('planla birlikte yaşayan sayfa', () => {
  const ENGINE = read('features/modes/hooks/usePlanAdaptations.ts');
  const PAUSE_OPS = read('features/modes/utils/pauseOps.ts');
  const UNDO = read('features/modes/utils/modeUndo.ts');
  const SUMMARY = read('features/modes/components/ModePlanSummary.tsx');

  it('duraklatma kapısı görev üreten TÜM yolların geçtiği tek noktada', () => {
    // Dört ayrı üretim yolu var; kapıyı çağrı yerlerine dağıtmak, ilerde eklenecek
    // beşinci yolun sessizce duraklatmayı delmesi demekti.
    const applyTasks = ENGINE.slice(ENGINE.indexOf('const applyTasks'), ENGINE.indexOf('const run ='));
    expect(applyTasks).toContain('isSlotPausedNow(planMode)');
    // Budama duraklıyken de çalışmalı: silinmiş görev kimlikleri taşınmasın.
    expect(applyTasks).toContain('setPlanIds(planMode, prunedHabitIds, prunedTaskIds)');
  });

  it('duraklı gün alışkanlıkta SERİYİ KIRMADAN geçer', () => {
    expect(PAUSE_OPS).toContain('toggleSkipDate');
    // Yapılmış ya da zaten atlanmış güne dokunulmaz.
    expect(PAUSE_OPS).toContain("(h.completedDates ?? []).includes(todayKey)) continue");
    expect(PAUSE_OPS).toContain("(h.skippedDates ?? []).includes(todayKey)) continue");
    // Tüm aralık DEĞİL, yalnız yaşanan gün işaretlenir (erken devam edilirse iz kalmaz).
    expect(ENGINE).toContain('markPausedHabitsSkipped();');
  });

  it('ara verme BİTMİŞ işe ve kullanıcının kendi görevine dokunmaz', () => {
    const ops = read('features/modes/utils/planTaskOps.ts');
    const fn = ops.slice(ops.indexOf('export function retirePlanTasksFromToday'), ops.indexOf('export function rolloverPlanTask'));
    expect(fn).toContain('if (t.isCompleted) return false;');
    expect(fn).toContain('isPlanOwnedTask(t)');
    // Ad eşleşmesi YOK: duraklatma geçici, belirsiz hiçbir şeye dokunmamalı.
    expect(fn).not.toContain('normalizeForMatch');
  });

  it('devam edilince günün işleri HEMEN üretilir', () => {
    const lc = read('features/modes/hooks/usePlanLifecycle.ts');
    expect(lc).toContain('refreshPlans();');
    expect(MODLAR).toContain('<PlanRefreshContext.Provider value={refreshPlans}>');
  });

  it('kat edilen yol geri sayımın yanında durur', () => {
    expect(SUMMARY).toContain('<PlanArcRow');
    const row = read('features/modes/components/PlanPauseRow.tsx');
    expect(row).toContain('arcFirstDay');           // ilk günde "25 gün" yazmaz
  });

  it('ara verme YEDİ modun da elinde', () => {
    // Ara vermek bir "sınav modu özelliği" değil; hayatın araya girmesine verilen cevap.
    const withPause = ['ExamCard', 'TezCard', 'MulakatCard', 'SporCard', 'TasarrufCard', 'BirakmaCard', 'RamazanCard']
      .filter(n => read(`features/modes/components/modes/${n}.tsx`).includes('usePlanLifecycle'));
    expect(withPause).toHaveLength(7);
  });

  it('adı kullanıcı yazmayan mod da (Ramazan) geçmişe düşer', () => {
    expect(read('features/modes/utils/goalHistory.ts')).toContain('export function fallbackNameFor');
    expect(UNDO).toContain('fallbackNameFor(mode, names)');
  });

  it('kapanan hedef iz bırakır ve geri alınınca iz de silinir', () => {
    expect(UNDO).toContain('const record = captureGoalRecord(mode);');
    expect(UNDO).toContain('addGoalHistory(record)');
    expect(UNDO).toContain('removeGoalHistory(record.id)');
    // Ölçüler kapatmadan ÖNCE alınır; sonra kaynakları kalmaz.
    expect(UNDO.indexOf('captureGoalRecord(mode)')).toBeLessThan(UNDO.indexOf('close();'));
    expect(MODLAR).toContain('HISTORY_COPY');
  });

  it('durum kartı TÜM hedefleri gösterir (tek hedefte deste çizilmez)', () => {
    expect(MODLAR).toContain('statusOrdered');
    expect(read('features/modes/components/ModeStatusCard.tsx')).toContain('<ModeDeck');
    const deck = read('features/modes/components/ModeDeck.tsx');
    expect(deck).toContain('if (pages.length === 1) return <>{pages[0]}</>;');
  });

  it('ana ekran kartı da hedefler arasında geçer, "+2" yazmaz', () => {
    const today = read('features/modes/components/ModeTodayCard.tsx');
    expect(today).toContain('<ModeDeck');
    expect(today).not.toContain('t.more');
  });

  it('özet tasarruf ve bırakmayı da sayar', () => {
    const hook = read('features/modes/hooks/useActiveModeSummary.ts');
    expect(hook).toContain("key: 'tasarruf'");
    expect(hook).toContain("key: 'birakma'");
  });

  it('mevcut yük plan BAŞLATILMADAN önce söylenir', () => {
    const banner = read('features/modes/components/TurkishModeBanner.tsx');
    expect(banner).toContain('LOAD_HINT');
    expect(banner).toContain('activeLoad.activeCount > 0');
  });

  it('keşif kartı örnek bir gün gösterir', () => {
    expect(MODLAR).toContain('DISCOVERY_SAMPLE');
  });
});

describe('modlar.tsx küçülüyor', () => {
  it('durum kartının ÇİZİMİ ekran dosyasında değil', () => {
    // Ekranın işi (hangi plan uygulanmış, tur, önizleme) ile kartın çizimi iç içeydi.
    expect(MODLAR).toContain('<ModeStatusCard');
    expect(MODLAR).not.toContain('STATUS_COPY');
    const lines = MODLAR.split(String.fromCharCode(10)).length;
    expect(lines).toBeLessThan(1620);
  });
});
