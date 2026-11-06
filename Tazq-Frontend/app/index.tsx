import { NavGlassArea } from '@/shared/components/NavGlass';
import { View, Text, RefreshControl, StyleSheet, Animated } from 'react-native';
import { BentoCard } from '@/shared/components/BentoCard';
import { BottomNavBar } from '@/shared/components/BottomNavBar';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { TriageModal } from '@/features/dashboard/components/TriageModal';
import { TazqZenCard } from '@/features/dashboard/components/TazqZenCard';
import { TodayBelow } from '@/features/dashboard/components/TodayBelow';
import { InboxButton, InboxSheet } from '@/features/dashboard/components/InboxSheet';
import { useInboxStore } from '@/shared/store/useInboxStore';
import { CommandPortal } from '@/features/dashboard/components/CommandPortal';
import { SomedayNudge } from '@/features/dashboard/components/SomedayNudge';
import { UserAvatar } from '@/features/user/components/UserAvatar';
import { TazqLogo } from '@/shared/components/TazqLogo';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { MyDayHabits } from '@/features/dashboard/components/MyDayHabits';
import { MotiView } from 'moti';
import { ChevronRight, Flame, Plus, Rocket, Zap } from 'lucide-react-native';
import { HighlightHeader } from '@/features/dashboard/components/HighlightHeader';
import { ICON, S, R, F, B, MIN_TOUCH, contentMaxWidth, HAIRLINE, fabSafeBottom, topBarSpace, TOP_AVATAR_SIZE, touchSlop } from '@/shared/constants/tokens';
import { WeightEntryModal } from '@/features/modes/components/WeightEntryModal';
import { HelpTourModal } from '@/features/onboarding/components/HelpTourModal';
import { TourTarget } from '@/shared/components/TourContext';
import { Touchable } from '@/shared/components/Touchable';
import { QuickAddSheet } from '@/features/tasks/components/QuickAddSheet';
import { PaymentsSummaryCard } from '@/features/payments/components/PaymentsSummaryCard';
import { ProfileSetupModal } from '@/features/user/components/ProfileSetupModal';
import { CaptureSheet } from '@/features/onboarding/components/CaptureSheet';
import { DottedBackground } from '@/shared/components/DottedBackground';
import { MagneticFAB } from '@/shared/components/MagneticFAB';
import { WideSplit, WideCol } from '@/shared/components/ResponsiveColumns';
import { ReviewPromptModal } from '@/features/user/components/ReviewPromptModal';
import { Separator } from '@/shared/components/Separator';
import { AppIcon } from '@/shared/components/AppIcon';
import { EntranceStage } from '@/shared/components/EntranceStage';
import { haptic } from '@/shared/utils/haptics';
import { TodayRings } from '@/features/dashboard/components/TodayRings';
import { useHomeModel, RINGS_COPY } from '@/features/dashboard/hooks/useHomeModel';



const styles = StyleSheet.create({
  // Başlık çubuğu öğesi: SABİT 30pt (bkz. TOP_ITEM_SIZE). scale(34) hem 44pt'lik
  // çubukta kenara 1.8pt bırakıyordu hem de tablette 42.5'e çıkıyordu — chrome ölçeklenmez.
  // borderWidth/borderColor BURADA YOK: ikisi de kullanım yerinde temaya ve
  // kişiselleştirme rengine göre veriliyor. Burada da yazılıydı ve değeri
  // `rgba(255,255,255,0.1)` idi — açık temada görünmeyen bir renk. Hiç etkisi yoktu
  // (satır içi hep eziyordu) ama kopyalanmayı bekleyen yanlış bir örnekti.
  // Zemin rengi BURADA YOK, kullanım yerinde temadan: sabit beyazdı ve koyu temada yuvarlak
  // kırpmanın kenarlarından (üst/alt/sol/sağ) ince beyaz çizgiler olarak sızıyordu.
  avatarContainer: { width: TOP_AVATAR_SIZE, height: TOP_AVATAR_SIZE, borderRadius: R.full, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  scrollContent: { flexGrow: 1 },
});
// Sade mod başlıkları: tek sözlük (bkz. i18nRatchet).
const LITE_COPY = {
  tr: { today: () => `Bugün, ${new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}`, empty: 'Listen boş' },
  en: { today: () => `Today, ${new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long' })}`, empty: 'Your list is empty' },
};

export default function HomeScreen() {
  const {
    width,
    bentoPad,
    tasks,
    user,
    t,
    language,
    theme,
    isDark,
    zen,
    insets,
    router,
    isLite,
    avatarBorderColor,
    profileSetupVisible,
    guestProfile,
    isNamePlaceholder,
    scrollViewRef,
    handleProfileSetupSave,
    habits,
    weightModalTaskId,
    setWeightModalTaskId,
    quickDraftVisible,
    setQuickDraftVisible,
    headerScale,
    headerTap,
    todayTap,
    headerHighlight,
    todayHighlight,
    focusSessions,
    showAllIncomplete,
    setShowAllIncomplete,
    showCompletedSection,
    setShowCompletedSection,
    logoTick,
    scrollY,
    titleCollapseAt,
    commandPortalVisible,
    setCommandPortalVisible,
    portalSearch,
    setPortalSearch,
    reviewModalVisible,
    setReviewModalVisible,
    captureOn,
    tourOn,
    demoGate,
    demoActive,
    todayTasksIncomplete,
    undatedTasksIncomplete,
    todayCompleted,
    dailyGoal,
    overdueCount,
    awayLine,
    pullRefreshing,
    wakeKey,
    onCaptureDone,
    onPullRefresh,
    handleQuickSave,
    savePortalTask,
    tr,
    dayHistory,
    myDayTasks,
    highlight,
    myDayHabits,
    startQuickFocus,
    handleLogoPress,
    todaySurprise,
    getGreeting,
    getSubGreeting,
    renderMyDayItem,
    priorityColor,
    todayDetail,
    todayMetrics,
    openDay,
    inboxOpen,
    setInboxOpen,
    visibleInbox,
    inboxFresh,
    inboxUnread,
    inboxEmpty,
    openInbox,
    closeInbox,
    onInboxItem,
    onInboxPay,
    todayTopSlot,
    todayFooter,
    openQuickAdd,
    onAddHabit,
    onHabitSkip,
    onHabitToggle,
  } = useHomeModel();


  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <NavGlassArea nav={<BottomNavBar />}>
      <DottedBackground color={theme.onBackground} opacity={isDark ? 0.05 : 0.08} size={24} dotSize={1} />
      {/* Yüzen başlık — dört sayfanın da kullandığı ortak bileşen (bkz. ScreenHeader).
          Eskiden bu blok her sayfada kopyalanmıştı; kopyalar ayrışıp boyları farklılaşmıştı. */}
      <ScreenHeader
        left={
          <Touchable
              onPress={() => router.push('/profile')}
              accessibilityRole="button"
              accessibilityLabel={language === 'tr' ? 'Profil' : 'Profile'}
              // Avatar 34pt çiziliyor ama dokunma hedefi 44pt olmalı (Apple HIG).
              // Görsel boyut ≠ erişilebilir alan.
              hitSlop={touchSlop(TOP_AVATAR_SIZE)}
              style={[
                  styles.avatarContainer,
                  {
                      backgroundColor: theme.surfaceField,
                      // HALKA HER İKİ DURUMDA DA HAIRLINE — 32pt'de tek doğru kalınlık.
                      //
                      // İki ayrı sebep aynı yere çıkıyor:
                      //  · DENGE: solda dolu bir fotoğraf, sağda saydam zeminli ince bir
                      //    glif var. Aynı çapta olsalar bile dolu olan ağır okunur; halka
                      //    kalınlaştıkça (eskiden 2.5pt) sol kenar iyice ağır basıyordu —
                      //    üstelik yalnız renk SEÇEN kullanıcılarda, yani tasarımı test
                      //    edenin göremeyeceği bir durumda.
                      //  · ÖLÇEK: renkli bir halka ancak fotoğrafla arasında boşluk varken
                      //    ÇERÇEVE gibi okunur; boşluksuz olunca yüzün etrafına çizilmiş
                      //    bir kontur gibi durur. 32pt'de boşluğa yer yok (2pt boşluk
                      //    fotoğrafı 25pt'ye düşürürdü). Bu ölçekte doğru olan inceltmek:
                      //    seçilen renk hâlâ görünür, kenar tanımlı kalır, fotoğraf
                      //    sıkışmaz. Apple'ın nav bar avatarlarında zaten halka yoktur.
                      borderWidth: B.thin,
                      // Varsayılan halka `rgba(255,255,255,0.1)` idi — AÇIK TEMADA beyaz
                      // üstünde beyaz, yani görünmüyordu. Tema jetonu iki temada da çalışır.
                      borderColor: (!avatarBorderColor || avatarBorderColor === 'transparent') ? theme.outlineVariant : theme.primary // çerçeve = vurgu (avatarRings.ts)
                  }
              ]}
          >
              <UserAvatar avatar={user?.avatar ?? guestProfile?.avatar} size={TOP_AVATAR_SIZE - 2 * B.thin} iconSize={ICON.sm} theme={theme} />
          </Touchable>
        }
        /*
          ORTA YUVA İKİ KATMANLI: tepede marka işareti, kaydırınca selamlama.

          Kelime işareti bir ara tamamen kaldırılmıştı. Doğru teşhis yanlış tedaviydi:
          teşhis, çubuğun kaydırıldığında hiçbir şey söylememesiydi (selamlama gidiyor,
          yerine bir şey gelmiyordu) — ama tedavi olarak marka işaretini silmek, HİÇ
          şikâyet edilmemiş bir şeyi bozdu. Üstelik logo tıklanabilirdi: komut paletinin
          tek girişiydi.

          Şimdi ikisi de duruyor ve aynı yuvayı SIRAYLA kullanıyorlar. Tepede logo
          (sayfanın başlığı zaten altındaki büyük selamlama), kaydırınca selamlama
          devralıyor. Tek bir yuva, iki farklı an, çakışma yok.
        */
        center={
          <Touchable
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={language === 'tr' ? 'TAZQ Core: ara, ekle, komutlar' : 'TAZQ Core: search, add, commands'}
              onPress={handleLogoPress}
              // Dokunma hedefi 44pt (çubuğun tam boyu), GÖRSEL öğe 24pt: Apple'ın bar
              // button item'ı gibi. Eskiden padding S.smd (12) ile toplam 54.5pt olup
              // 44pt çubuğa taşıyordu — "sıkışmışlık" hissinin kaynağı buydu.
              style={{ height: '100%', paddingHorizontal: S.sm, justifyContent: 'center', alignItems: 'center' }}
          >
              {/* Odak halkası — dokunuşun kaydedildiğini söyler. */}
              {logoTick > 0 && (
                <MotiView
                  key={`ripple-${logoTick}`}
                  from={{ scale: 1, opacity: 0.6 }}
                  animate={{ scale: 2.2, opacity: 0 }}
                  transition={{ type: 'timing', duration: 400 }}
                  style={{
                    position: 'absolute',
                    width: 40,
                    height: 20,
                    borderRadius: R.md,
                    borderWidth: 1.2,
                    borderColor: theme.primary,
                  }}
                />
              )}

              <MotiView
                  animate={{ scale: logoTick === 0 ? 1 : [1, 1.06, 1] }}
                  transition={{ type: 'timing', duration: 200 }}
              >
                  {/* TazqLogo'nun kendi varsayılanı 24pt ve 44pt çubukta 10pt nefes
                      bırakıyor. (30 eski 54pt çubuğa göreydi; 0.72 çarpanı keyfiydi.) */}
                  {/* Turun "TAZQ Core" adımı bu logoyu vurgular (bkz. tourSteps). */}
                  <TourTarget id="core" spotRadius={R.sm} spotPad={S.sm}>
                    <TazqLogo height={24} />
                  </TourTarget>
              </MotiView>
          </Touchable>
        }
        title={getGreeting()}
        scrollY={scrollY}
        collapseAt={titleCollapseAt}
        /*
          SAĞ ÜST = GELEN KUTUSU (2026-11-01). Eski düğme Hafta'ya götürüyordu (sekme çubuğunda zaten var — kullanıcı:
          "işlevini yitirmiş"). Gelen kutusu yeni bir şey: dağınık uyarıları toplar; rozet yalnız yeni bir şey varken.
        */
        right={isLite && inboxEmpty ? undefined : <InboxButton count={inboxUnread} onPress={openInbox} theme={theme} language={language === 'en' ? 'en' : 'tr'} />}
      />

      <View style={{ flex: 1 }}>

        {/* Değerlendirme / geri bildirim akışı — kendi bileşeninde (state'i de orada). */}
        <ReviewPromptModal
          visible={reviewModalVisible}
          onClose={() => setReviewModalVisible(false)}
          theme={theme}
          tr={tr}
        />

        <Animated.ScrollView
            ref={scrollViewRef}
            style={{ flex: 1 }}
            // Kaydırma konumunu doğrudan Animated.Value'ya bağlar. useNativeDriver:
            // başlığın belirmesi UI thread'de olur, her karede React render'ı tetiklemez.
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: true },
            )}
            scrollEventThrottle={16}
            // Dip boşluğu navbar'ın GERÇEK yüksekliğinden gelir (bkz. navBarSpace).
            // Sabit S.xxl yazıyordu: navbar 106pt kaplarken 64pt bırakıyordu, yani son
            // 42pt barın arkasında kalıyor ve kullanıcı en alta inemiyordu.
            /*
              Geniş ekranda sütun 600'den 1240'a açılıyor (bkz. contentMaxWidth) — ama
              içerik satırı uzamıyor, İKİYE bölünüyor (bkz. WideSplit). Telefonda
              contentMaxWidth zaten MAX_W döndürdüğü için bu satır değişmemiş gibidir.
            */
            contentContainerStyle={[styles.scrollContent, { paddingTop: topBarSpace(insets.top) + S.lg, paddingBottom: fabSafeBottom(insets.bottom), width: '100%', maxWidth: contentMaxWidth(width), alignSelf: 'center' }]}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={pullRefreshing} onRefresh={onPullRefresh} tintColor={theme.primary} colors={[theme.primary]} progressBackgroundColor={theme.surfaceContainer} progressViewOffset={insets.top + S.sm + 44 + S.sm} />}
        >



            {/*
              ── GENİŞ EKRANDA İKİ SÜTUN ───────────────────────────────────────────
              Selamlama SAYFA BAŞLIĞI olduğu için bölünmenin dışında, tam genişlikte
              kalıyor. Altındaki yüzeyler ise iki role ayrılıyor: solda kullanıcının
              BAKTIĞI şey (plan, bugünün durumu, skor, sıradaki iş), sağda YAPACAĞI şey
              (günün listesi, ritüeller, davetler). Telefonda bu ayrım hiç devreye
              girmiyor; sıra ve çıktı bugünküyle birebir aynı.
            */}
            <WideSplit>

            <WideCol>
            {/*
              EKRAN DURUMA GÖRE KURULUYOR — "bugün ne yapmalıyım" sorusu en üstte.

              ÖLÇÜLEN SORUN: bu ekranda on iki yüzey yarışıyordu ve göz nereye gideceğini
              bilmiyordu. Sıra artık bir KARARDAN geliyor:

                1. Aktif dönem varsa PLAN (aşağıdaki kart) — sınava hazırlanan biri için
                   günün sorusu "bugün ne var" değil, "planımda bugün ne var"dır.
                2. Bugünün durumu ve görevleri
                3. Skor (ivme) — bir EYLEM değil, bir sonuç. Eylemlerin altına indi.

              İvme skoru eskiden selamlamanın hemen altındaydı: kullanıcı ekranı açtığında
              ilk gördüğü şey, yapacağı iş değil aldığı nottu.
            */}

            {/*
              MOD YOKKEN SKOR YERİNDE KALIYOR.

              Bu satırın selamlamayla kartlar arasındaki yeri bir kez denenip GERİ ALINMIŞTI:
              momentum satırı kartsızdır ve iki ağır kartın arasına sıkışınca öksüz kalıyor
              (bkz. __tests__/dashboardZeroState.test.ts). O ders duruyor — aktif dönemi
              olmayan kullanıcı için sıra hiç değişmedi.

              Aktif dönem varsa ekranın konusu PLAN oluyor; skor o zaman eylemlerin altına
              iniyor. Kart tek yerde tanımlı, yalnız KONUMU duruma göre değişiyor.
              (2026-10-30: plan + halkalar + skor tek DİJİTAL PANELDE; plan panelin üst yuvası.)
            */}

            {/*
              BUGÜN — ÜÇ HALKA + MOMENTUM (bkz. TodayRings). Eskiden Momentum kartı ve BUGÜN
              kartı iki ayrı yüzeydi; alışkanlık ilerlemesi hiçbir özette yoktu. Vitrinin
              ilk bloğu artık günün tamamını tek nesnede söylüyor.
            */}
            {!isLite && <TodayRings
              tourId="today"
              // Selam ekranın durum şeridinde (ayrı blok yok). Ad bilinmiyorsa yalnız selam — "…, sen" UYDURULMAZ.
              greeting={awayLine ?? (() => { const n = (!isNamePlaceholder && user?.name?.split(' ')[0]) || guestProfile?.name?.split(' ')[0] || ''; return n ? `${getGreeting()}, ${n}` : getGreeting(); })()}
              history={dayHistory}
              // Okumaya dokununca açılan ayrıntı (bkz. TodayDetail): sıradaki işler, bugünkü alışkanlıklar, panelden odak.
              detail={todayDetail}
              onOpenDay={openDay}
              topSlot={todayTopSlot}
              label={t.todayLabel}
              caption={(() => {
                const c = RINGS_COPY[language === 'en' ? 'en' : 'tr'];
                if (!isLite && todayHighlight) return todaySurprise;
                /*
                  TARİHSİZ İŞ VARKEN "PLANIN BOŞ" DENMEZ (cihazda görüldü): selamlama "1 görevin
                  kaldı", liste o görevi gösteriyor, bu satır "planın boş" diyordu. Tarihsizler
                  halkanın hedefine bilerek girmiyor (bkz. todayTasks) — ama var oldukları söylenir.
                */
                if (dailyGoal === 0) return undatedTasksIncomplete.length > 0 ? c.undatedOnly(undatedTasksIncomplete.length) : c.empty;
                if (todayCompleted >= dailyGoal) return c.allDone;
                // Olağan gün: eski selamlama bloğunun alt satırı ("N görevin var…") panelin alt yazısı.
                return getSubGreeting();
              })()}
              captionHighlight={!isLite && todayHighlight}
              metrics={todayMetrics}
              footer={todayFooter}
              /*
                TEK EKLEME YOLU (2026-10-25): bu düğme tam formu, şimşek düğmesi hızlı eklemeyi
                açıyordu — aynı ekranda aynı niyete iki ayrı yüzey. İkisi de artık hızlı ekleme;
                tam form oradaki "Detaylar"dan bir dokunuş uzakta (Todoist/Things deseni).
              */
              onAdd={openQuickAdd}
              wake={wakeKey} entrance={!tourOn}
              addLabel={t.addTask}
              showAdd={dailyGoal === 0 && !demoGate(tasks.length)}
              onTap={todayTap.onTap}
              theme={theme}
              padding={bentoPad}
            />}
            {/* Ödemeler — GÖREV/plan akışından AYRI yüzey (bkz. PaymentsSummaryCard); panelin altında, ikincil. */}
            <PaymentsSummaryCard />
            </WideCol>

            {/* Unified My Day Bento Card — geniş ekranda SAĞ sütunun tepesi. */}
            <WideCol col="right">
            {/* Zen önerisi ve raf hatırlatması sayfadan çıktı → sağ üstteki GELEN kutusunda (bkz. InboxSheet). */}
            {(myDayTasks.length > 0 || myDayHabits.length > 0) && (
              <EntranceStage order={1} enabled={!tourOn} style={{ paddingHorizontal: S.lg, marginBottom: S.lg }}>
                {overdueCount > 0 && (
                  <Touchable
                    // Sayının KENDİSİNE gider: filtresiz listede kullanıcı gecikmişleri arıyordu.
                    onPress={() => router.push({ pathname: '/tasks', params: { filter: 'overdue' } })}
                    activeOpacity={0.8}
                    /*
                      ── EKRAN OKUYUCU BUNLARIN DÜĞME OLDUĞUNU BİLMİYORDU ─────────
                      Bu satır ve aşağıdaki beş kontrol yalnız metin taşıyordu: sesli
                      okuma içeriği söylüyor ama "dokunulabilir" olduğunu söylemiyordu.
                      Mevcut bekçi test (a11yInteractive) bunları YAKALAMIYOR, çünkü o
                      yalnız ADSIZ kontrolleri arıyor — bunların adı var, ROLÜ yoktu.
                    */
                    accessibilityRole="button"
                    // 44 pt dokunma alanı YERLEŞİMİ DEĞİŞTİRMEDEN (hitSlop): minHeight satırı kartlar arasında ortaya itiyordu (cihazda görüldü).
                    hitSlop={touchSlop(F.footnote + S.xs)} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: S.sm, paddingHorizontal: S.xxs }}
                  >
                    {/*
                      HATA DEĞİL, UYARI. Bu satır `theme.error` (kırmızı) ile çiziliyordu
                      ve dashboard'da gözün bulduğu İLK renkti. Ama gecikmiş bir görev
                      bozulmuş bir şey değil, bir DURUMDUR — kırmızı, gerçekten yanlış
                      giden şeyler için ayrılmalı, yoksa uygulamanın her yerinde kırmızı
                      görünce kullanıcı onu okumayı bırakır.
                      `warning` (amber) iki temada da AA geçiyor: bilgi kaybolmuyor,
                      yalnız aciliyet tonu gerçeğe indiriliyor.
                    */}
                    <View style={{ width: 5, height: 5, borderRadius: R.full, backgroundColor: theme.warning }} />
                    <Text style={{ fontSize: F.footnote, fontWeight: '600', color: theme.warning, flex: 1 }}>
                      {overdueCount} {language === 'tr' ? 'gecikmiş görev' : overdueCount === 1 ? 'overdue task' : 'overdue tasks'}
                    </Text>
                    <ChevronRight size={ICON.xs} color={theme.warning} opacity={0.5} />
                  </Touchable>
                )}
                
                <BentoCard index={1} style={{ padding: 0, overflow: 'hidden' }}>
                  {/* BUGÜNKÜ RİTÜELLERİM (Daily Habits) */}
                  {!isLite && <><TourTarget id="habits" spotRadius={R.md} spotCorners="top">
                    <MyDayHabits
                      habits={myDayHabits}
                      theme={theme}
                      isDark={isDark}
                      tr={tr}
                      onAddHabit={onAddHabit}
                      onSkip={onHabitSkip}
                      onToggle={onHabitToggle}
                    />
                  </TourTarget>

                  <Separator theme={theme} /></>}
                  <TourTarget id="tasks" spotRadius={R.md} spotCorners="bottom">
                    {/* Dolgu YOK — SectionHeader kendi boşluğunu taşıyor. Sarmala da
                        vermek ikiye katlıyordu: bu başlık 32pt girintili çiziliyor ve
                        aynı karttaki alışkanlık başlığından (16pt) kaymış duruyordu. */}
                    <Touchable
                      onPress={() => router.push('/tasks')}
                      accessibilityRole="button"
                      accessibilityLabel={tr ? 'Günlük görevleri yönet' : 'Manage daily tasks'}
                    >
                    <SectionHeader
                      title={isLite ? LITE_COPY[language === 'en' ? 'en' : 'tr'].today() : (tr ? 'Günlük görevlerim' : 'My daily tasks')}
                      theme={theme}
                      tr={tr}
                      inset={S.md}
                    />
                  </Touchable>

                  {/* Render Incomplete Tasks */}
                  {(() => {
                    const incompleteTasks = highlight.ordered; // yıldız önde (madde 11)
                    const visibleIncomplete = showAllIncomplete || isLite ? incompleteTasks : incompleteTasks.slice(0, 4);
                    
                    if (incompleteTasks.length === 0) {
                      return (
                        <View style={{ padding: S.md, alignItems: 'center' }}>
                          <Text style={{ fontSize: F.footnote, color: theme.onSurfaceMuted }}>
                            {tr ? 'Bugün için bekleyen görevin kalmadı' : 'No pending tasks for today'}
                          </Text>
                        </View>
                      );
                    }

                    return (
                      <View>
                        {!isLite && highlight.star && incompleteTasks.length > 1 && <HighlightHeader others={highlight.others} />}
                        {visibleIncomplete.map((item, idx) => {
                          const isLast = idx === visibleIncomplete.length - 1;
                          return renderMyDayItem(item, isLast, idx);
                        })}
                        
                        {!isLite && incompleteTasks.length > 4 && (
                          <Touchable
                            onPress={() => { haptic.select(); setShowAllIncomplete(!showAllIncomplete); }}
                            /*
                              AÇILIR BÖLÜM: durumu YALNIZ görsel olarak belliydi (yazı
                              değişiyor, chevron dönüyor). Ekran okuyucu kullanıcısı
                              listenin açık mı kapalı mı olduğunu duymuyordu.
                            */
                            accessibilityRole="button"
                            accessibilityState={{ expanded: showAllIncomplete }}
                            style={{
                              minHeight: MIN_TOUCH,
                              paddingVertical: S.smd,
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderTopWidth: HAIRLINE,
                              borderTopColor: theme.separator
                            }}
                          >
                            <Text style={{ fontSize: F.footnote, fontWeight: '600', color: theme.primary }}>
                              {showAllIncomplete
                                ? (language === 'tr' ? 'Daha az göster' : 'Show less')
                                : (language === 'tr' ? `${incompleteTasks.length - 4} görev daha` : `${incompleteTasks.length - 4} more`)
                              }
                            </Text>
                          </Touchable>
                        )}
                      </View>
                    );
                  })()}

                  {/* Render Completed Tasks (Collapsible Section) */}
                  {(() => {
                    const completedTasks = myDayTasks.filter(item => item.isCompleted);
                    if (completedTasks.length === 0) return null;
                    
                    return (
                      <View style={{ borderTopWidth: HAIRLINE, borderTopColor: theme.separator }}>
                        <Touchable
                          onPress={() => { haptic.select(); setShowCompletedSection(!showCompletedSection); }}
                          accessibilityRole="button"
                          accessibilityState={{ expanded: showCompletedSection }}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            minHeight: MIN_TOUCH,
                            paddingHorizontal: S.md,
                            paddingVertical: S.smd,
                          }}
                        >
                          <Text style={{ fontSize: F.footnote, fontWeight: '600', color: theme.onSurfaceMuted }}>
                            {language === 'tr' ? `Tamamlananlar (${completedTasks.length})` : `Completed (${completedTasks.length})`}
                          </Text>
                          <ChevronRight
                            size={ICON.sm}
                            color={theme.onSurfaceVariant}
                            opacity={0.4}
                            style={{ transform: [{ rotate: showCompletedSection ? '90deg' : '0deg' }] }}
                          />
                        </Touchable>
                        
                        {showCompletedSection && (
                          <View>
                            {completedTasks.map((item, idx) => {
                              const isLast = idx === completedTasks.length - 1;
                              return renderMyDayItem(item, isLast, idx);
                            })}
                          </View>
                        )}
                      </View>
                    );
                  })()}
                  </TourTarget>
                </BentoCard>
              </EntranceStage>
            )}
            </WideCol>

            {/* Aktif dönem varsa skor BURADA — eylemlerin altında (yukarıdaki nota bkz.). */}

            {/* Focus Widget */}
            {/*
              Odak kartı YALNIZ SEANS SÜRERKEN (canlı sayaç + görev). Boştaki hâli ("Başlamaya
              hazır · Başlat") aşağıdaki Sıradaki kartının "Odaklan"ıyla aynı niyetti — iki çağrı.
            */}
            {/* Süren seans listenin içinde değil: tüm uygulamada altta yüzen tek canlı kapsül (bkz. FocusIsland). */}

            {/* İlk açılış — soğuk başlangıç kartı: görev ve alışkanlık yokken kullanıcıya net 3 giriş noktası sunar */}
            {/*
              Kart eskiden "tur BİTMİŞSE" gösteriliyordu, çünkü tur zaten ilk açılışta
              çıkıyor ve ikisi çakışıyordu. Tur ilk göreve taşınınca o koşul boş ekranı
              rehbersiz bırakırdı: görevi olmayan yeni kullanıcı ne turu ne kartı görürdü.
            */}
            <WideCol col="right">
            {/*
              ÖRNEK VERİ VARKEN BU KART ÇIKMAZ. İkisi aynı anda görünüyordu: ekranda
              üç sahte görev dururken altında "hiçbir şeyin yok, nereden başlayalım?"
              yazıyordu. Aynı ekranda iki çelişen cümle, ikisi de güvenilmez olur.
              Örnek veri varsa yönlendirmeyi tur yapıyor (bkz. useDemoGate).
            */}
            {tasks.length === 0 && (isLite || habits.length === 0) && !demoGate(tasks.length) && (
              <EntranceStage order={1} enabled={!tourOn} style={{ paddingHorizontal: S.lg, marginBottom: S.lg }}>
                <BentoCard index={1} style={{ padding: bentoPad, gap: S.sm }}>
                    <Text style={{ fontSize: F.subhead, fontWeight: '700', color: theme.onSurface, letterSpacing: -0.3, marginBottom: S.xs }}>
                        {isLite ? LITE_COPY[language === 'en' ? 'en' : 'tr'].empty : tr ? 'Hoş geldin! Nereden başlamak istersin?' : 'Welcome! Where would you like to start?'}
                    </Text>
                    {[
                        { Icon: Plus, label: tr ? 'İlk görevini ekle' : 'Add your first task', sub: tr ? 'Aklındakini yaz, gerisini TAZQ halletsin' : 'Jot it down, TAZQ handles the rest', onPress: () => setQuickDraftVisible(true) }, // "ekle" diyen satır listeye değil eklemeye açılır
                        ...(isLite ? [] : [{ Icon: Rocket, label: tr ? 'Bir mod seç' : 'Choose a mode', sub: tr ? 'Sigara bırak, tasarruf, sınava hazırlık…' : 'Quit smoking, save, exam prep…', onPress: () => router.push('/modlar') },
                        { Icon: Flame, label: tr ? 'Bir alışkanlık başlat' : 'Start a habit', sub: tr ? 'Her gün tek dokunuşla işaretle' : 'Check in daily with one tap', onPress: () => router.push('/cockpit') }]),
                    ].map((row, i) => (
                        <Touchable key={i} onPress={row.onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: S.xs + 2 }} accessibilityRole="button" accessibilityLabel={row.label}>
                            <AppIcon Icon={row.Icon} color={theme.primary} />
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: F.body, fontWeight: '700', color: theme.onSurface }}>{row.label}</Text>
                                <Text style={{ fontSize: F.caption, color: theme.onSurfaceMuted }}>{row.sub}</Text>
                            </View>
                            <ChevronRight size={ICON.sm} color={theme.onSurfaceVariant} opacity={0.4} />
                        </Touchable>
                    ))}
                </BentoCard>
              </EntranceStage>
            )}
            </WideCol>

            {/*
              ── Section Header — easter egg sadece aktifken görünür ──

              `accessible={false}`: bu bir ÖZELLİK değil, çift dokunma kolay yumurtası
              — TodayCard'daki kararla aynı. Adsız bir düğme olarak odak almasındansa
              ağacın dışında kalması doğru; içindeki yazılar yine okunuyor.
            */}
            <WideCol col="right">
            {headerHighlight && (
              <Touchable accessible={false} onPress={headerTap.onTap} activeOpacity={1} style={{ paddingHorizontal: S.lg, marginBottom: S.sm }}>
                <Animated.View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', transform: [{ scale: headerScale }] }}>
                  {/* "devam et →" KALDIRILDI: mavi ve oklu, bağlantı gibi duruyordu ama hiçbir yere gitmiyordu. */}
                  <Text style={{ fontSize: F.caption, fontWeight: '600', letterSpacing: 1.8, color: theme.onSurfaceVariant }}>
                    {language === 'tr' ? 'İYİ GİDİYOR' : 'LOOKING GOOD'}
                  </Text>
                </Animated.View>
              </Touchable>
            )}
            </WideCol>

            </WideSplit>

            {/* Sayfanın altı: önümüzdeki günler · bu hafta · günün göğü (bkz. TodayBelow). Örnek veri varken çizilmez. */}
            {!demoActive && !isLite && (
              <TodayBelow
                tasks={tasks} habits={habits} sessions={focusSessions}
                today={dayHistory[dayHistory.length - 1]}
                dayClosed={todayTasksIncomplete.length === 0}
                theme={theme} isDark={isDark} language={language === 'en' ? 'en' : 'tr'} padding={bentoPad}
                onOpenDay={openDay} onOpenWeek={() => router.push('/cockpit')}
              />
            )}

        </Animated.ScrollView>


        {/* Gelen kutusu — Zen ve raf kendi eylemli kartlarıyla; eylem önce kutuyu kapatır (pencere içinde pencere yok). */}
        <InboxSheet
          visible={inboxOpen}
          onClose={closeInbox}
          items={visibleInbox}
          onDismiss={(ids) => useInboxStore.getState().dismiss(ids)}
          onRestore={(ids) => useInboxStore.getState().undismiss(ids)}
          fresh={inboxFresh}
          language={language === 'en' ? 'en' : 'tr'}
          theme={theme}
          onItem={onInboxItem}
          onPay={onInboxPay}
          zenCard={
            <TazqZenCard
              visible={zen.cardVisible}
              plan={zen.overduePlan}
              overdueTotal={zen.analysis.overdue.length}
              onRebalance={zen.rebalanceOverdue}
              onDismiss={zen.dismissCard}
              overload={zen.overloadVisible ? { count: zen.analysis.todayLoad, onOpen: () => { setInboxOpen(false); setTimeout(zen.openTriage, 350); } } : null}
              theme={theme}
              tr={tr}
            />
          }
          somedayCard={
            <SomedayNudge
              visible={zen.somedayNudgeVisible}
              count={zen.somedayCount}
              onOpen={() => { zen.markSomedayNudge(); setInboxOpen(false); router.push({ pathname: '/tasks', params: { filter: 'someday' } }); }}
              onLater={zen.markSomedayNudge}
              theme={theme}
              tr={tr}
            />
          }
        />

        {/* Hızlı ekleme — + düğmesinin varsayılanı (bkz. QuickAddSheet) */}
        <QuickAddSheet
          visible={quickDraftVisible}
          onClose={() => setQuickDraftVisible(false)}
          onSave={handleQuickSave}
          theme={theme}
          isDark={isDark}
          language={language}
          t={t}
        />

        {/* Hoş geldinden sonra, turdan önce: "Aklındakileri yaz" (bkz. captureFlow). */}
        <CaptureSheet visible={captureOn} onDone={onCaptureDone} />

        {/* Profile Onboarding/Setup Modal */}
        <ProfileSetupModal
          visible={profileSetupVisible}
          theme={theme}
          isDark={isDark}
          language={language}
          t={t}
          currentName={user?.name || ''}
          // Misafirin adı yok → ad alanı zorunlu görünür.
          isNamePlaceholder={isNamePlaceholder || !user}
          onSave={handleProfileSetupSave}
        />

      </View>

      {/* Hızlı taslak — görev listesine tek dokunuşla not düşer. */}
      <MagneticFAB
        onPress={() => setQuickDraftVisible(true)}
        accessibilityLabel={t.quickAdd.title}
        // TEK ANAHTAR — düğme her ekranda AYNI yerde dursun.
        // İki ekran ayrı konum saklıyordu: kullanıcı dashboard'da sola taşıyıp Görevler'e
        // geçince düğme sağda kalıyordu. Kalıcı bir eylem düğmesinin tek gerekçesi kas
        // hafızasıdır; ekrana göre yer değiştirmesi o gerekçeyi çürütüyordu.
        storageKey={`@fab_${user?.id ?? 'guest'}`}
        isDark={isDark}
        theme={theme}
        style={{
          backgroundColor: theme.primaryFill,
          shadowColor: theme.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        buttonSize={54}
      >
        {/*
          İkon Zap (şimşek): bu buton HIZLI taslak yakalama (quick draft) — "aksiyon merkezi"
          zaten Plus (+) kullanıyor, aynı ekranda iki + çelişki yaratıyordu. Şimşek bu butonu
          "anında yakala / hızlı ekle" olarak ayırır; + ise yapılandırılmış görev eklemede kalır.

          Renk: paletten: vurgu dolgusunun üstünde onPrimaryFill (sarıda koyu).
        */}
        <Zap size={ICON.lg} color={theme.onPrimaryFill} strokeWidth={2.5} fill={theme.onPrimaryFill} />
      </MagneticFAB>

      </NavGlassArea>

      <CommandPortal
        visible={commandPortalVisible}
        onClose={() => setCommandPortalVisible(false)}
        query={portalSearch}
        onQueryChange={setPortalSearch}
        onSubmit={savePortalTask}
        onQuickFocus={startQuickFocus}
        saveTheDay={!isLite && zen.saveTheDayHint ? { hint: zen.saveTheDayHint, onPress: () => { void zen.saveTheDay(); } } : null}
        tasks={tasks}
        priorityColor={priorityColor}
        theme={theme}
        isDark={isDark}
        tr={tr}
      />

      <WeightEntryModal
        visible={weightModalTaskId !== null}
        taskId={weightModalTaskId}
        onClose={() => setWeightModalTaskId(null)}
      />
      
      <TriageModal
        visible={zen.triageVisible}
        onClose={zen.closeTriage}
        tasks={zen.analysis.movableToday}
        preview={zen.previewTriage}
        onConfirm={(keepIds) => { void zen.confirmTriage(keepIds); }}
        fixedCount={zen.todayFixedCount}
        theme={theme}
        tr={tr}
      />

      {/*
        TUR İLK GÖREVDEN SONRA — daha önce uygulamanın İLK ekranında, kullanıcı tek
        dokunuş yapmadan açılıyordu.

        ÖLÇÜLEN SORUN: "İvme Skorun şöyle çalışır" anlatımı, henüz hiçbir görevi
        olmayan birine yapılıyordu. Kullanılmamış bir özelliği anlatmak, anlatımın
        tutmamasının en yaygın sebebi: karşılığı olmayan bir cümle akılda kalmaz,
        üstelik kullanıcıyla ilk görevi arasına giren fazladan bir engel olur.
        Aynı ilke bildirim izninde de uygulandı — izin, işe yarayacağı ana taşındı.

        Görevi olmayan kullanıcı bunun yerine "nereden başlayayım" kartını görüyor
        (aşağıya bkz.); yani rehberlik kaybolmuyor, SIRASI değişiyor.
      */}
      {tourOn && (
        <HelpTourModal
          pageId="dashboard"
          scrollRef={scrollViewRef}
        />
      )}
    </View>
  );
}



export { RouteErrorBoundary as ErrorBoundary } from '@/shared/components/CrashFallback';