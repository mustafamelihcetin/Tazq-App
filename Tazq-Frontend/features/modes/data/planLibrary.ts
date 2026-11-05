/*
  GÖREV KÜTÜPHANESİ (2026-11-05, kullanıcı: "çeşitlilik ve yönetim çok zayıf"). Ölçüm: Tez ve Mülakat'ta 30 günde 2 farklı görev, Spor'da
  3-4; Tasarruf ve Bırakma'da günlük görev yoktu. Elle yazıldı, LLM yok. Her görev tek başına anlaşılır, somut ve küçüktür.

  area: weakAreas alanı; kullanıcı o alanı seçtiyse görev daha sık gelir. Görev kendi alanıyla yazılıdır: eski "Veri Analizi: kaynakça
  güncelle" gibi rastgele birleşim olmaz.
  when: ne zaman uygun. Yoksa her zaman.
*/
export type PlanStage = 'early' | 'mid' | 'late' | 'eve';
export interface LibraryTask { tr: string; en: string; area?: string; when?: PlanStage[] }

const T = (tr: string, en: string, area?: string, when?: PlanStage[]): LibraryTask => ({ tr, en, area, when });
const EARLY: PlanStage[] = ['early'];
const MID: PlanStage[] = ['mid'];
const LATE: PlanStage[] = ['late', 'eve'];
const NOT_LATE: PlanStage[] = ['early', 'mid'];

export const TEZ_LIBRARY: LibraryTask[] = [
  T('Araştırma sorunu tek cümleyle yaz, danışmanına gösterilecek kadar net olsun', 'Write your research question in one sentence, clear enough to show your advisor', 'tez_literature', EARLY),
  T('Konunla ilgili 2 yeni makale bul, özetlerini oku', 'Find 2 new papers on your topic and read the abstracts', 'tez_literature', NOT_LATE),
  T('Okuduğun bir makaleden 3 not çıkar, kendi cümlelerinle', 'Take 3 notes from a paper in your own words', 'tez_literature', NOT_LATE),
  T('Literatürde çelişen iki görüşü yan yana yaz', 'Write two conflicting views from the literature side by side', 'tez_literature', NOT_LATE),
  T('Kaynak yöneticine bu haftanın makalelerini ekle', 'Add this week’s papers to your reference manager', 'tez_literature', NOT_LATE),
  T('Literatür bölümündeki bir boşluğu not al: kimse neyi çalışmamış', 'Note a gap in the literature: what has nobody studied', 'tez_literature', EARLY),
  T('Tezinin ana hatlarını güncelle, başlıkları sırala', 'Update your outline and order the headings', 'tez_writing', EARLY),
  T('25 dakika ara vermeden yaz, düzeltmeyi sonraya bırak', 'Write for 25 minutes without stopping; fix it later', 'tez_writing', NOT_LATE),
  T('Bir paragrafı baştan yaz, ilk cümlesi ana fikri söylesin', 'Rewrite one paragraph so its first sentence states the main idea', 'tez_writing'),
  T('Yazdığın bir bölümü sesli oku, takıldığın cümleleri işaretle', 'Read a section aloud and mark where you stumble', 'tez_writing'),
  T('Uzun bir cümleyi ikiye böl, üç yerde tekrar eden kelimeyi değiştir', 'Split one long sentence and replace a repeated word in three places', 'tez_writing'),
  T('Giriş bölümünde tezin amacını gözden geçir', 'Review the aim of your thesis in the introduction', 'tez_writing', MID),
  T('Bölüm sonunda iki cümlelik özet yaz, sonraki bölüme bağla', 'End a chapter with a two-sentence summary that links to the next', 'tez_writing', MID),
  T('Danışmanına kısa bir ilerleme notu gönder', 'Send your advisor a short progress note', 'tez_writing'),
  T('Danışman yorumlarından birini uygula ve işaretle', 'Apply one advisor comment and mark it done', 'tez_writing', NOT_LATE),
  T('Veri toplama planında sıradaki adımı netleştir', 'Clarify the next step of your data collection plan', 'tez_analysis', EARLY),
  T('Verinin küçük bir bölümünü temizle, sorunları not et', 'Clean a small part of your data and note the problems', 'tez_analysis', NOT_LATE),
  T('Bir tablo ya da grafiği yeniden çiz, başlığı bulguyu söylesin', 'Redraw one table or chart so its title states the finding', 'tez_analysis'),
  T('Bir bulguyu iki cümleyle açıkla, teknik terim kullanmadan', 'Explain one finding in two sentences without jargon', 'tez_analysis'),
  T('Analiz kodunu ya da adımlarını başkası tekrar edebilecek gibi yaz', 'Write up your analysis steps so someone else could repeat them', 'tez_analysis', MID),
  T('Beklenmedik bir sonucu not et, olası nedenini yaz', 'Note one unexpected result and a possible reason', 'tez_analysis', MID),
  T('Savunmada sorulabilecek zor bir soruyu yaz, cevabını taslakla', 'Write a hard defense question and draft your answer', 'tez_defense', MID),
  T('Tezini 3 cümleyle anlat, süre tut', 'Explain your thesis in 3 sentences, with a timer', 'tez_defense'),
  T('Sunuma tek slayt ekle: tek mesaj, az yazı', 'Add one slide: one message, few words', 'tez_defense', LATE),
  T('Sunumu baştan sona sesli prova et', 'Rehearse the whole talk aloud', 'tez_defense', LATE),
  T('Kaynakçada 10 kaydı biçim kuralına göre kontrol et', 'Check 10 references against the format rules', 'tez_writing', LATE),
  T('Şekil ve tablo numaralarını metinle karşılaştır', 'Match figure and table numbers with the text', 'tez_writing', LATE),
  T('Bir bölümde yazım denetimi yap, kuralları kontrol et', 'Proofread one chapter against the rules', 'tez_writing', LATE),
  T('Özeti tezin son haline göre güncelle', 'Update the abstract to match the final thesis', 'tez_writing', LATE),
  T('Enstitünün teslim adımlarını listele, eksikleri işaretle', 'List your institute’s submission steps and mark what’s missing', undefined, LATE),
];

export const MULAKAT_LIBRARY: LibraryTask[] = [
  T('İlanı satır satır oku, istenen 5 beceriyi çıkar', 'Read the posting line by line and pick out 5 required skills', 'interview_company', EARLY),
  T('CV’nde bu pozisyonla en ilgili 3 maddeyi öne al', 'Move the 3 most relevant CV items to the top', 'interview_company', EARLY),
  T('LinkedIn başlığını bu role göre güncelle', 'Update your LinkedIn headline for this role', 'interview_company', EARLY),
  T('Şirketin ürününü kullan ya da incele, 3 not al', 'Try or study the company’s product and take 3 notes', 'interview_company', NOT_LATE),
  T('Şirketin son 3 haberini oku, birini mülakatta nasıl anacağını yaz', 'Read 3 recent company news items; note how you’d mention one', 'interview_company'),
  T('Görüşeceğin kişileri LinkedIn’de incele', 'Look up your interviewers on LinkedIn', 'interview_company', LATE),
  T('Şirkete soracağın 3 iyi soru yaz', 'Write 3 good questions to ask them', 'interview_company'),
  T('“Neden bu şirket?” cevabını 3 cümleyle yaz', 'Write your “why this company?” answer in 3 sentences', 'interview_company', NOT_LATE),
  T('Pozisyonun temel bir konusunu 30 dakika çalış', 'Study one core topic for the role for 30 minutes', 'interview_technical', NOT_LATE),
  T('Bir teknik soruyu çöz, düşünceni sesli anlatarak', 'Solve one technical question, thinking aloud', 'interview_technical'),
  T('Zorlandığın bir kavramı başkasına anlatır gibi yaz', 'Write up a tough concept as if teaching someone', 'interview_technical', NOT_LATE),
  T('Yaptığın bir projeyi 2 dakikada teknik olarak anlat', 'Explain one of your projects technically in 2 minutes', 'interview_technical'),
  T('Daha önce yaptığın bir hatayı ve dersini teknik yönüyle yaz', 'Write up a technical mistake you made and what you learned', 'interview_technical', MID),
  T('Süre tutarak 1 pratik soru çöz', 'Solve 1 practice question with a timer', 'interview_technical', MID),
  T('Kendini tanıttığın konuşmayı 60 saniyeye indir', 'Trim your self-introduction to 60 seconds', 'interview_behavioral'),
  T('Bir başarını STAR ile yaz: durum, görev, eylem, sonuç', 'Write one achievement with STAR: situation, task, action, result', 'interview_behavioral'),
  T('Bir çatışma hikayesi hazırla, nasıl çözdüğünü anlat', 'Prepare a conflict story and how you resolved it', 'interview_behavioral', NOT_LATE),
  T('Başarısız olduğun bir anı ve çıkardığın dersi yaz', 'Write about a failure and what you learned', 'interview_behavioral', NOT_LATE),
  T('“Zayıf yönün ne?” cevabını dürüst ve kısa hazırla', 'Prepare an honest, short “biggest weakness” answer', 'interview_behavioral', NOT_LATE),
  T('Hikayelerinden birine ölçülebilir bir sonuç ekle', 'Add a measurable result to one of your stories', 'interview_behavioral'),
  T('Bir cevabını kaydet, dinle, dolgu kelimeleri say', 'Record an answer, listen back and count filler words', 'interview_behavioral', MID),
  T('Bir vaka sorusunu 15 dakikada çöz, varsayımlarını yaz', 'Solve a case question in 15 minutes and write your assumptions', 'interview_case', NOT_LATE),
  T('Bir iş problemini parçalarına ayır, sırala', 'Break a business problem into parts and order them', 'interview_case', NOT_LATE),
  T('Sayısal bir tahmin sorusunu adım adım yaz', 'Work through an estimation question step by step', 'interview_case', MID),
  T('Bu rol için piyasa maaşını 2 kaynaktan araştır', 'Check market pay for this role from 2 sources', 'interview_salary', NOT_LATE),
  T('Maaş beklentini aralık olarak ve gerekçesiyle yaz', 'Write your salary range with your reasoning', 'interview_salary', MID),
  T('Teklif gelirse soracağın 3 şeyi yaz', 'Write 3 things to ask if you get an offer', 'interview_salary', LATE),
  T('Birinden deneme mülakatı yapmasını iste', 'Ask someone to run a mock interview with you', undefined, ['mid', 'late']),
  T('15 dakikalık deneme mülakatı yap, kendini kaydet', 'Do a 15-minute mock interview and record yourself', undefined, ['late']),
  T('En güçlü 3 hikayeni tek cümleyle özetle', 'Sum up your 3 strongest stories in one sentence each', undefined, ['late', 'eve']),
  T('Saat, yol, kıyafet ve belgeleri kontrol et', 'Check the time, route, outfit and documents', undefined, ['eve']),
  T('Online ise kamera, ses ve bağlantıyı dene', 'If it’s online, test your camera, sound and connection', undefined, ['eve']),
  T('Bugün yeni konu yok; erken uyu', 'No new topics today; get to bed early', undefined, ['eve']),
];

export const KILO_LIBRARY: LibraryTask[] = [
  T('Bir öğüne avuç içi kadar protein ekle', 'Add a palm-sized portion of protein to a meal', 'spor_kilo_beslenme'),
  T('Tabağının yarısını sebzeyle doldur', 'Fill half your plate with vegetables', 'spor_kilo_beslenme'),
  T('Şekerli bir içeceği suyla değiştir', 'Swap one sugary drink for water', 'spor_kilo_beslenme'),
  T('Yarının öğünlerini bugünden düşün', 'Think through tomorrow’s meals today', 'spor_kilo_beslenme'),
  T('Atıştırmalığını önceden hazırla', 'Prepare your snack in advance', 'spor_kilo_beslenme'),
  T('Bir öğünü telefonsuz, yavaş ye', 'Eat one meal slowly, without your phone', 'spor_kilo_beslenme'),
  T('Bugün ne yediğini kısaca not et', 'Briefly log what you ate today', 'spor_kilo_beslenme'),
  T('Etiket oku: bir ürünün şeker miktarına bak', 'Read a label: check how much sugar a product has', 'spor_kilo_beslenme'),
  T('20 dakika tempolu yürü', 'Walk briskly for 20 minutes', 'spor_kilo_kardiyo'),
  T('Asansör yerine merdiven kullan', 'Take the stairs instead of the lift', 'spor_kilo_kardiyo'),
  T('Yemekten sonra 10 dakika yürü', 'Walk for 10 minutes after a meal', 'spor_kilo_kardiyo'),
  T('Evde 10 dakikalık hareket videosu yap', 'Follow a 10-minute home workout', 'spor_kilo_kardiyo'),
  T('Bir durak erken inip yürü', 'Get off one stop early and walk', 'spor_kilo_kardiyo'),
  T('10 çömelme, 10 duvar şınavı, 3 tur', '10 squats, 10 wall push-ups, 3 rounds', 'spor_kilo_kardiyo'),
  T('Bu gece uyku saatini 30 dakika öne çek', 'Move your bedtime 30 minutes earlier tonight', 'spor_kilo_uyku'),
  T('Yatmadan bir saat önce ekranı bırak', 'Put screens away an hour before bed', 'spor_kilo_uyku'),
  T('Öğleden sonra kafeini bırak', 'Skip caffeine after lunch', 'spor_kilo_uyku'),
  T('5 dakika esne, sonra dinlen', 'Stretch for 5 minutes, then rest', 'spor_kilo_uyku'),
];

export const MARATON_LIBRARY: LibraryTask[] = [
  T('Kolay tempoda koş: konuşabilecek hızda', 'Run at an easy pace: you should be able to talk', 'spor_maraton_dayaniklilik'),
  T('Bu haftanın uzun koşusunu takvime koy', 'Schedule this week’s long run', 'spor_maraton_dayaniklilik', NOT_LATE),
  T('Uzun koşu için rota ve su planı yap', 'Plan route and water for your long run', 'spor_maraton_dayaniklilik', NOT_LATE),
  T('Koşu sırasında ne yiyip içeceğini dene', 'Test what you’ll eat and drink while running', 'spor_maraton_dayaniklilik', MID),
  T('Haftalık mesafeni hesapla, %10’dan fazla artırma', 'Check your weekly distance; don’t add more than 10%', 'spor_maraton_dayaniklilik', NOT_LATE),
  T('6 x 1 dakika hızlı, 2 dakika yavaş koş', 'Run 6 x 1 minute fast, 2 minutes easy', 'spor_maraton_hiz', NOT_LATE),
  T('20 dakika yarış temposunda koş', 'Run 20 minutes at race pace', 'spor_maraton_hiz', MID),
  T('Yokuşta 5 kısa tekrar yap', 'Do 5 short hill repeats', 'spor_maraton_hiz', NOT_LATE),
  T('Koşu sonunda 4 x 20 saniye hızlan', 'Finish your run with 4 x 20-second pickups', 'spor_maraton_hiz'),
  T('Hedef tempoyu kilometre başına hesapla', 'Work out your target pace per kilometre', 'spor_maraton_hiz', MID),
  T('Koşudan sonra 10 dakika esne', 'Stretch for 10 minutes after your run', 'spor_maraton_toparlanma'),
  T('Dinlenme günü: yürü, koşma', 'Rest day: walk, don’t run', 'spor_maraton_toparlanma'),
  T('Bacaklarına 10 dakika rulo uygula', 'Foam-roll your legs for 10 minutes', 'spor_maraton_toparlanma'),
  T('Ayakkabının kaç kilometre yaptığına bak', 'Check how many kilometres your shoes have done', 'spor_maraton_toparlanma', EARLY),
  T('Ağrıyan bir yer varsa not et, yükü azalt', 'Note any pain and ease off', 'spor_maraton_toparlanma'),
  T('Yarış gününün kıyafetini denemiş ol', 'Try out your race-day outfit', undefined, LATE),
  T('Yarış günü ulaşımını ve saatini planla', 'Plan race-day travel and timing', undefined, LATE),
  T('Bu hafta mesafeyi azalt, formu koru', 'Cut your distance this week and stay fresh', undefined, ['late']),
];

export const GUC_LIBRARY: LibraryTask[] = [
  T('Üst vücut antrenmanı: itme ve çekme hareketleri', 'Upper-body session: push and pull moves', 'spor_guc_ust'),
  T('Bir üst vücut hareketinde 1 tekrar ya da biraz ağırlık ekle', 'Add a rep or a little weight to one upper-body lift', 'spor_guc_ust'),
  T('Şınav formunu video ile kontrol et', 'Check your push-up form on video', 'spor_guc_ust'),
  T('Omuz sağlığı için 5 dakika ısınma yap', 'Do a 5-minute shoulder warm-up', 'spor_guc_ust'),
  T('Alt vücut antrenmanı: çömelme ve kalça menteşesi', 'Lower-body session: squat and hip hinge', 'spor_guc_alt'),
  T('Çömelmede tekrarlarını kaydet', 'Log your squat reps', 'spor_guc_alt'),
  T('Tek bacak hareketi ekle: lunge ya da step-up', 'Add a single-leg move: lunge or step-up', 'spor_guc_alt'),
  T('Kalça için 3 set köprü yap', 'Do 3 sets of glute bridges', 'spor_guc_alt'),
  T('3 tur plank, her biri 30 saniye', '3 rounds of 30-second planks', 'spor_guc_core'),
  T('10 dakika karın ve bel antrenmanı', '10-minute core session', 'spor_guc_core'),
  T('Yan plank ile dengeyi çalış', 'Work balance with side planks', 'spor_guc_core'),
  T('Kalça ve göğüs için 10 dakika esne', 'Stretch hips and chest for 10 minutes', 'spor_guc_hareketlilik'),
  T('Antrenmandan önce dinamik ısınma yap', 'Do a dynamic warm-up before training', 'spor_guc_hareketlilik'),
  T('Ayak bileği hareketliliğine 5 dakika ayır', 'Spend 5 minutes on ankle mobility', 'spor_guc_hareketlilik'),
  T('Protein hedefini bugün yakala', 'Hit your protein target today'),
  T('Antrenman defterine ağırlıkları yaz', 'Write your weights in your training log'),
  T('Bu haftanın programına bak, eksik günü belirle', 'Check this week’s program and find the missed day'),
  T('Bugün dinlen, kas dinlenirken gelişir', 'Rest today; muscle grows during recovery'),
];

export const GENEL_LIBRARY: LibraryTask[] = [
  T('20 dakika tempolu yürü', 'Walk briskly for 20 minutes', 'spor_genel_kardiyo'),
  T('10 dakika ip atla ya da yerinde koş', 'Skip rope or jog in place for 10 minutes', 'spor_genel_kardiyo'),
  T('Bisiklete bin ya da yüz', 'Go for a ride or a swim', 'spor_genel_kardiyo'),
  T('Bir arkadaşınla yürüyüş planla', 'Plan a walk with a friend', 'spor_genel_kardiyo'),
  T('Merdivenleri kullan, asansöre binme', 'Take the stairs, skip the lift', 'spor_genel_kardiyo'),
  T('10 çömelme, 10 şınav, 3 tur', '10 squats, 10 push-ups, 3 rounds', 'spor_genel_kuvvet'),
  T('Direnç lastiğiyle 15 dakika çalış', 'Do 15 minutes with a resistance band', 'spor_genel_kuvvet'),
  T('Bir ağır eşyayı doğru kaldırmayı dene: kalçadan eğil', 'Practice lifting properly: hinge at the hips', 'spor_genel_kuvvet'),
  T('Plank ile karnını çalıştır: 3 x 30 saniye', 'Work your core with planks: 3 x 30 seconds', 'spor_genel_kuvvet'),
  T('Sabah 5 dakika esne', 'Stretch for 5 minutes this morning', 'spor_genel_esneklik'),
  T('Boyun ve omuzlarını rahatlat', 'Loosen your neck and shoulders', 'spor_genel_esneklik'),
  T('Kısa bir yoga akışı yap', 'Do a short yoga flow', 'spor_genel_esneklik'),
  T('Masa başından kalk, 2 dakika hareket et', 'Get up from your desk and move for 2 minutes', 'spor_genel_esneklik'),
  T('Günde 2 litre suya yaklaş', 'Get close to 2 litres of water today'),
  T('Bu gece 7-8 saat uyumayı hedefle', 'Aim for 7-8 hours of sleep tonight'),
  T('Haftanın aktif günlerini seç', 'Pick your active days for the week'),
];

export const RAMAZAN_LIBRARY: LibraryTask[] = [
  T('Sahurda proteinli ve lifli bir şeyler ye', 'Have something with protein and fibre at sahur'),
  T('İftarı hafif başlat, yavaş ye', 'Start iftar light and eat slowly'),
  T('İftar ile sahur arasında 2 litre su iç', 'Drink 2 litres of water between iftar and sahur'),
  T('Bugün bir sayfa mushaf oku', 'Read one page of the Quran today'),
  T('Bir kişiyi iftara davet et ya da ara', 'Invite someone to iftar or give them a call'),
  T('Küçük de olsa bir sadaka ver', 'Give a little charity, however small'),
  T('Teravihe git ya da evde iki rekat kıl', 'Go to tarawih or pray two rakats at home'),
  T('Gün içinde 5 dakika sessiz kal, dua et', 'Sit quietly for 5 minutes and pray'),
  T('Öğle sonrası 20 dakika kısa uyku', 'Take a 20-minute nap after noon'),
  T('En verimli saatine en zor işini koy', 'Put your hardest work in your best hour'),
  T('Bu hafta için bir iyilik planla', 'Plan one good deed for this week'),
  T('Sevdiğin bir duayı öğren', 'Learn a prayer you like'),
  T('Bayram hazırlıklarının listesini çıkar', 'List what you need for the bayram', undefined, ['late', 'eve']),
  T('Fitre ve zekat hesabını yap', 'Work out your fitre and zakat', undefined, ['late', 'eve']),
  T('Son on gün için özel bir niyet belirle', 'Set a special intention for the last ten days', undefined, ['late']),
];

export const TASARRUF_LIBRARY: LibraryTask[] = [
  T('Bugünkü harcamalarını yaz', 'Write down today’s spending'),
  T('Abonelik listene bak, birini gözden geçir', 'Review one of your subscriptions'),
  T('Bu haftanın harcamasını kategoriye ayır', 'Sort this week’s spending into categories'),
  T('En büyük üç harcamana bak: hangisi kısılır', 'Look at your three biggest expenses: which can shrink'),
  T('Hedefin için bugün küçük bir tutar ayır', 'Set aside a small amount for your goal today'),
  T('Banka hesabına otomatik aktarım kur', 'Set up an automatic transfer'),
  T('Markete gitmeden liste yap', 'Make a list before going shopping'),
  T('Bir öğünü dışarıda değil evde ye', 'Eat one meal at home rather than out'),
  T('Bugün bir şey almadan 24 saat bekle', 'Wait 24 hours before buying something today'),
  T('Sepetteki bir ürünü çıkar', 'Remove one item from your cart'),
  T('Bir faturayı karşılaştır: daha ucuz seçenek var mı', 'Compare one bill: is there a cheaper option'),
  T('Kullanmadığın bir şeyi satışa koy', 'List something you don’t use for sale'),
  T('Kredi kartı borcunu kontrol et, asgariye bırakma', 'Check your card balance; don’t leave it at the minimum'),
  T('En yüksek faizli borcunu belirle', 'Find your highest-interest debt'),
  T('Bu ayın bütçesini 3 kalemde yaz', 'Write this month’s budget in 3 lines'),
  T('Acil durum için kaç ay yeter, hesapla', 'Work out how many months your emergency fund covers'),
  T('Para harcadığın bir duyguyu not et', 'Note a feeling that makes you spend'),
  T('Bu haftanın ücretsiz bir etkinliğini bul', 'Find a free activity for this week'),
];

export const BIRAKMA_LIBRARY: LibraryTask[] = [
  T('Bugün en zor saatini önceden belirle', 'Work out your hardest hour today in advance'),
  T('İstek gelince 10 dakika bekle, sonra karar ver', 'When a craving hits, wait 10 minutes before deciding'),
  T('İstek anında yapacağın tek bir şey seç', 'Pick one thing to do when a craving hits'),
  T('Tetikleyen bir şeyi bugün evden uzaklaştır', 'Remove one trigger from your home today'),
  T('Bıraktığın için kazandığın bir şeyi yaz', 'Write one thing you’ve gained from quitting'),
  T('Bu kararı neden aldığını tek cümleyle yaz', 'Write in one sentence why you decided this'),
  T('Güvendiğin birine durumunu anlat', 'Tell someone you trust how it’s going'),
  T('5 dakika yürü ya da dışarı çık', 'Walk for 5 minutes or step outside'),
  T('4 saniye nefes al, 6 saniye ver: 2 dakika', 'Breathe in for 4 and out for 6, for 2 minutes'),
  T('Bir bardak su iç, eline bir şey al', 'Drink a glass of water and hold something'),
  T('Bugünün zor anını not et: nerede, ne zaman', 'Note today’s hard moment: where and when'),
  T('Eski rutinin yerine yeni bir rutin dene', 'Try a new routine in place of the old one'),
  T('Biriktirdiğin parayı ya da zamanı hesapla', 'Work out the money or time you’ve saved'),
  T('Kendine küçük bir ödül seç', 'Choose a small reward for yourself'),
  T('Kötü geçen bir gün her şeyi silmez: yarın için bir adım yaz', 'One bad day doesn’t erase it all: write a step for tomorrow'),
  T('Destek hattı ya da uzman numarasını kaydet', 'Save a support line or a professional’s number'),
];

/** Rutin önerileri: Planım'dan eklenir, modun rutin sınırına tabidir. */
export interface RoutineSuggestion { tr: string; en: string; emoji: string }
export const ROUTINE_SUGGESTIONS: Record<string, RoutineSuggestion[]> = {
  exam: [
    { tr: 'Günlük soru seti', en: 'Daily question set', emoji: '📝' },
    { tr: 'Kısa kelime tekrarı', en: 'Short vocabulary review', emoji: '🧠' },
    { tr: 'Odaklı çalışma seansı', en: 'Focused study session', emoji: '🎯' },
    { tr: 'Akşam tekrarı', en: 'Evening review', emoji: '📚' },
  ],
  tez: [
    { tr: 'Her gün biraz yaz', en: 'Write a little every day', emoji: '✍️' },
    { tr: 'Makale okuma', en: 'Paper reading', emoji: '📚' },
    { tr: 'Araştırma notları', en: 'Research notes', emoji: '📝' },
    { tr: 'Veri çalışması', en: 'Data work', emoji: '📊' },
  ],
  mulakat: [
    { tr: 'Sesli cevap provası', en: 'Spoken answer practice', emoji: '🗣️' },
    { tr: 'Teknik pratik', en: 'Technical practice', emoji: '💻' },
    { tr: 'Şirket haberleri', en: 'Company news', emoji: '💼' },
    { tr: 'Bir STAR hikayesi', en: 'One STAR story', emoji: '📝' },
  ],
  spor: [
    { tr: '20 dakika yürüyüş', en: '20-minute walk', emoji: '🏃' },
    { tr: 'Sabah esnemesi', en: 'Morning stretch', emoji: '🧘' },
    { tr: 'Kuvvet antrenmanı', en: 'Strength training', emoji: '💪' },
    { tr: 'Erken uyku', en: 'Early bedtime', emoji: '💤' },
  ],
  ramazan: [
    { tr: 'Günlük dua', en: 'Daily prayer', emoji: '🙏' },
    { tr: 'Mushaf okuma', en: 'Quran reading', emoji: '📚' },
    { tr: 'İftar sonrası yürüyüş', en: 'Post-iftar walk', emoji: '🏃' },
    { tr: 'Şükür notu', en: 'Gratitude note', emoji: '📝' },
  ],
  tasarruf: [
    { tr: 'Harcama kaydı', en: 'Spending log', emoji: '🧾' },
    { tr: 'Bugün bir şey almadım', en: 'No-spend day', emoji: '💰' },
    { tr: 'Küçük birikim', en: 'Small saving', emoji: '💵' },
    { tr: 'Haftalık bütçe bakışı', en: 'Weekly budget check', emoji: '📊' },
  ],
  birakma: [
    { tr: 'Bugün temiz kaldım', en: 'Stayed clean today', emoji: '🛡️' },
    { tr: 'Nefes egzersizi', en: 'Breathing exercise', emoji: '🧘' },
    { tr: 'Kısa yürüyüş', en: 'Short walk', emoji: '🏃' },
    { tr: 'Tetikleyici notu', en: 'Trigger note', emoji: '📝' },
  ],
};

/** Kalan güne göre aşama. Mülakatın takvimi kısa, diğerleri uzun. */
export function planStage(kind: string, daysLeft: number): PlanStage {
  if (kind === 'mulakat') return daysLeft <= 1 ? 'eve' : daysLeft <= 7 ? 'late' : daysLeft <= 21 ? 'mid' : 'early';
  if (kind === 'ramazan') return daysLeft <= 1 ? 'eve' : daysLeft <= 10 ? 'late' : 'mid';
  return daysLeft <= 1 ? 'eve' : daysLeft <= 14 ? 'late' : daysLeft <= 60 ? 'mid' : 'early';
}

export const LIBRARY_BY_KIND: Record<string, LibraryTask[]> = {
  tez: TEZ_LIBRARY, mulakat: MULAKAT_LIBRARY, kilo: KILO_LIBRARY, maraton: MARATON_LIBRARY, guc: GUC_LIBRARY, genel: GENEL_LIBRARY, ramazan: RAMAZAN_LIBRARY, tasarruf: TASARRUF_LIBRARY, birakma: BIRAKMA_LIBRARY,
};

/** Bu aşamada uygun görevler; zayıf alanın görevleri iki kez sayılır, gizlenenler çıkar. */
export function libraryPool(kind: string, daysLeft: number, weak?: string[] | null, hidden?: string[] | null): LibraryTask[] {
  const stage = planStage(kind, daysLeft);
  const hide = new Set(hidden ?? []);
  const weakSet = new Set(weak ?? []);
  const out: LibraryTask[] = [];
  for (const t of LIBRARY_BY_KIND[kind] ?? []) {
    if (hide.has(t.tr)) continue;
    if (t.when && !t.when.includes(stage)) continue;
    out.push(t);
    if (t.area && weakSet.has(t.area)) out.push(t);
  }
  return out;
}
