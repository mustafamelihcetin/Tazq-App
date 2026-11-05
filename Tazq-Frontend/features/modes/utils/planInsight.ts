/*
  PLANIN KISA YORUMU (2026-11-05, "İçgörü & Önizle" penceresinden taşındı). Yalnız ölçülene bakar: yeni plan, bugün bitti mi, seri, haftalık oran.
*/
interface HabitLike { createdAt?: string | number | null; completedDates?: string[] | null; }
export interface InsightInput {
  type: string;
  tr: boolean;
  planHabits: HabitLike[];
  planHabitStats: { doneToday: boolean; streak: number }[];
  avgHabitWeekPct: number;
  completedPlanTasks: number;
  totalPlanTasks: number;
}

export function planInsight({ type, tr, planHabits, planHabitStats, avgHabitWeekPct, completedPlanTasks, totalPlanTasks }: InsightInput): string {
  const mode = { type };
  const bestStreak = planHabitStats.length > 0 ? Math.max(...planHabitStats.map(h => h.streak)) : 0;

    const now = new Date().getTime();
    const MS_IN_DAY = 24 * 60 * 60 * 1000;

    // Check if the plan is brand new (all habits in the plan created within the last 36 hours and no completions recorded yet)
    const isNewPlan = planHabits.length > 0 && planHabits.every(h => {
      const createdTime = h.createdAt ? new Date(h.createdAt).getTime() : now;
      return (now - createdTime) < 1.5 * MS_IN_DAY;
    }) && planHabits.reduce((acc, h) => acc + (h.completedDates?.length ?? 0), 0) === 0;

    const completedTodayCount = planHabitStats.filter(h => h.doneToday).length;
    const allTodayCompleted = planHabitStats.length > 0 && completedTodayCount === planHabitStats.length;

    const isHigh = avgHabitWeekPct >= 70 || (totalPlanTasks > 0 && completedPlanTasks / totalPlanTasks >= 0.70);
    const isLow = avgHabitWeekPct < 35;
    
    if (mode.type === 'exam') {
      if (isNewPlan) {
        return tr
          ? "Sınav hazırlık planın hazır! İlk adımı atmak en zorudur ama seni hedeflerine ulaştıracak olan da budur. Bugün listenden bir alışkanlık veya görevi tamamlayarak harika bir başlangıç yapabilirsin."
          : "Your exam prep plan is ready! Taking the first step is the hardest, but it's what leads you to your goals. You can make a great start today by completing just one habit or task from your list.";
      } else if (allTodayCompleted) {
        return tr
          ? "Harika! Bugünün tüm hedeflerini tamamladın. Bu günlük odaklanma ve kararlılık sınav gününde seni zirveye taşıyacak. Dinlenmeyi hak ettin!"
          : "Great job! You've completed all of today's goals. This daily focus and determination will carry you to the top on exam day. You've earned some rest!";
      } else if (bestStreak >= 3) {
        return tr
          ? `Sınav hazırlığında ${bestStreak} günlük harika bir seri yakaladın! İstikrar en büyük kozun. Zinciri kırmamak için bugün de hedeflerini tamamla.`
          : `You've caught a great ${bestStreak}-day streak in your exam prep! Consistency is your biggest asset. Complete today's goals to keep the chain unbroken.`;
      } else if (isHigh) {
        return tr 
          ? "Sınav disiplinin mükemmel seviyede! Haftalık alışkanlıkların ve görev tamamlama oranın oldukça yüksek. Bu tempoyu korursan hedefine ulaşmaman için hiçbir neden yok."
          : "Your exam discipline is at an excellent level! Your weekly habits and task completion rates are very high. Keep this pace up and there is no reason not to reach your goal.";
      } else if (isLow) {
        return tr
          ? "Bu ara tempodan düşmüş görünüyorsun. Kendine çok yüklenmeden, bugün sadece en kolay sınav görevine veya tek bir alışkanlığa odaklanarak ivme kazanmaya ne dersin?"
          : "Looks like you've lost momentum recently. Without pushing yourself too hard, how about starting with the easiest exam task or just a single habit today to gain momentum?";
      } else {
        return tr
          ? "İyi bir tempon var ama biraz daha istikrar sınav başarını katlayacaktır. Günlük planına sadık kalmaya çalış. Adım adım hedefe ilerliyorsun."
          : "You have a good tempo, but a bit more consistency will boost your exam success. Try to stay true to your daily plan. You are moving step by step to your goal.";
      }
    } else if (mode.type === 'tez') {
      if (isNewPlan) {
        return tr
          ? "Akademik maratonun başlıyor! Tez yazımında en önemli şey düzenli çalışmadır. Bugün kendine sadece 15 dakikalık okuma veya yazma hedefi koyarak ilk adımı atabilirsin."
          : "Your academic marathon begins! The most important thing in thesis writing is regular work. Today, you can take the first step by setting a simple 15-minute reading or writing goal.";
      } else if (allTodayCompleted) {
        return tr
          ? "Harika! Bugünün tez hedeflerini eksiksiz bitirdin. Her gün atılan bu küçük adımlar, o tezin başarıyla tamamlanmasını sağlayacak en önemli güçtür."
          : "Great! You completed today's thesis goals completely. These small daily steps are the key force that will ensure your thesis is successfully finished.";
      } else if (bestStreak >= 3) {
        return tr
          ? `Tez çalışmanda ${bestStreak} günlük bir seri yakaladın! Akademik disiplinin harika gidiyor. Rutinini bozmadan bugün de devam et.`
          : `You've built a ${bestStreak}-day streak in your thesis work! Your academic discipline is going great. Keep it up today without breaking the routine.`;
      } else if (isHigh) {
        return tr
          ? "Akademik disiplinin takdire şayan! Tez sürecinde en önemli şey sürekliliktir ve sen bunu başarıyorsun. Yazma ve araştırma rutinlerini korumaya devam et."
          : "Your academic discipline is highly commendable! Consistency is key in the thesis process and you're achieving it. Keep maintaining your writing and research routines.";
      } else if (isLow) {
        return tr
          ? "Yazma blokajı mı yaşıyorsun? Tezi gözünde büyütmek yerine sadece bugün için tek bir küçük kaynak okumayı veya bir paragraf yazmayı dene. Büyük işler küçük adımlarla başlar."
          : "Experiencing writer's block? Instead of letting the thesis overwhelm you, try reading just one source or writing a single paragraph today. Big tasks start with small steps.";
      } else {
        return tr
          ? "Tez yazımında ilerleme kaydediyorsun fakat bloklar halinde değil, düzenli çalışmak işini kolaylaştıracaktır. Bu hafta rutinlerini biraz daha yukarı taşımaya odaklan."
          : "You are making progress on your thesis, but working regularly rather than in big chunks will make it easier. Focus on boosting your routines a bit more this week.";
      }
    } else if (mode.type === 'mulakat') {
      if (isNewPlan) {
        return tr
          ? "Kariyer hedeflerine giden yolda ilk adım! Mülakat hazırlığı bir süreçtir. Bugün temel bir teknik konuyu gözden geçirerek veya özgeçmişine bakarak profesyonel başlangıcını yapabilirsin."
          : "The first step toward your career goals! Interview prep is a process. Today, you can make your professional start by reviewing a basic technical topic or looking over your resume.";
      } else if (allTodayCompleted) {
        return tr
          ? "Bugünün mülakat hazırlık görevlerini başarıyla tamamladın! Bu planlı çalışma sayesinde görüşme gününde kendine güvenin tam olacak."
          : "You've successfully completed today's interview prep tasks! Thanks to this planned effort, you will be fully confident on interview day.";
      } else if (bestStreak >= 3) {
        return tr
          ? `Mülakat hazırlığında ${bestStreak} günlük bir seri yakaladın! Her gün pratik yapmak seni rakiplerinden öne geçirecektir. Seriyi bugün de koru.`
          : `You've hit a ${bestStreak}-day streak in your interview prep! Daily practice will set you apart from other candidates. Maintain the streak today.`;
      } else if (isHigh) {
        return tr
          ? "Mülakata hazırlığın son derece profesyonel. Düzenli pratik ve hazırlık sayesinde hayalindeki o iş teklifini almaya çok yakınsın. Harika iş!"
          : "Your prep for the interview is extremely professional. Thanks to regular practice and prep, you are very close to landing that dream job offer. Great job!";
      } else if (isLow) {
        return tr
          ? "Hazırlığı erteleme eğiliminde misin? Bugün sadece 5 dakikalık bir kendini tanıtma simülasyonu yapmayı veya tek bir mülakat sorusuna yanıt aramayı dene."
          : "Are you tending to delay your prep? Today, try just a 5-minute self-introduction simulation or find an answer to a single common interview question.";
      } else {
        return tr
          ? "Hazırlığın iyi gidiyor ama teknik konuları veya mülakat simülasyonlarını biraz daha sıklaştırmalısın. Rutin pratikler mülakat heyecanını azaltacaktır."
          : "Your prep is going well, but you should practice technical topics or interview simulations more frequently. Routine practice will reduce your interview anxiety.";
      }
    } else if (mode.type === 'spor') {
      if (isNewPlan) {
        return tr
          ? "Sağlıklı ve güçlü bir beden için harika bir karar! Sporda en önemli şey başlamaktır. Bugün sadece hafif bir egzersiz veya su içme alışkanlığıyla ilk adımı atabilirsin."
          : "A great decision for a healthy and strong body! The most important thing in sports is starting. Today, you can take the first step with just a light exercise or drinking water habit.";
      } else if (allTodayCompleted) {
        return tr
          ? "Bugünün tüm spor hedeflerini tamamladın! Vücudun bu disipline minnettar kalacak. Kendini ödüllendir ve kaslarının dinlenmesine izin ver."
          : "You completed all of today's sports goals! Your body will thank you for this discipline. Reward yourself and allow your muscles to recover.";
      } else if (bestStreak >= 3) {
        return tr
          ? `Sporda ${bestStreak} günlük harika bir seri yakaladın! Vücudun bu ritme alışmaya başladı. İstikrarı sürdürmek için bugün de rutinini tamamla.`
          : `You've built a great ${bestStreak}-day sports streak! Your body is getting used to this rhythm. Complete your routine today to keep the consistency going.`;
      } else if (isHigh) {
        return tr
          ? "Performansın zirvede! Alışkanlıkların ve spor rutinin harika ilerliyor. Bu disiplin ve güç seni hedeflerine çok hızlı ulaştıracak. Aynen devam!"
          : "Your performance is peak! Your habits and sports routine are progressing wonderfully. This discipline and strength will bring you to your goals very fast. Keep it up!";
      } else if (isLow) {
        return tr
          ? "Sporda motivasyon kaybı normaldir, en önemli şey tekrar başlamaktır. Kendini zorlamadan bugün sadece hafif bir yürüyüş veya esneme yaparak rutine geri dönebilirsin."
          : "Loss of motivation in sports is normal; the key is starting again. Without pushing yourself, you can warm back into the routine with just a light walk or stretch today.";
      } else {
        return tr
          ? "Aktifsin ama antrenman ve beslenme rutinlerinde daha fazla istikrar hedefine daha hızlı ulaştıracaktır. Günlük takiplere devam et, sonuçları göreceksin."
          : "You are active, but more consistency in training and nutrition routines will bring you to your goal faster. Keep tracking daily, you will see results.";
      }
    } else {
      // Default / Ramadan mode
      if (isNewPlan) {
        return tr
          ? "Yeni manevi ve fiziksel rutinin hayırlı olsun! Alışkanlıklarına alışmak zaman alabilir, acele etme. Bugün sadece küçük bir niyet veya hafif bir okuma ile başlayabilirsin."
          : "Welcome to your new spiritual and physical routine! It can take time to adjust to your habits, don't rush. You can start today with just a small intention or light reading.";
      } else if (allTodayCompleted) {
        return tr
          ? "Mükemmel! Bugünün tüm rutinlerini tamamlayarak manevi ve zihinsel odaklanmanı en üst seviyede tuttun. Huzurlu ve verimli bir gün geçirdin."
          : "Perfect! By completing all of today's routines, you kept your spiritual and mental focus at the highest level. You had a peaceful and productive day.";
      } else if (bestStreak >= 3) {
        return tr
          ? `Rutinlerinde ${bestStreak} günlük harika bir istikrar yakaladın! Zihinsel ve bedensel huzurunu korumak için bugün de hedeflerini tamamla.`
          : `You've achieved a great ${bestStreak}-day consistency in your routines! Complete your goals today to maintain your mental and physical peace.`;
      } else if (isHigh) {
        return tr
          ? "Disiplinin ve sadakatin mükemmel seviyede. Planına olan bağlılığın manevi ve zihinsel odaklanmanı artıracaktır. Hayırlı ve verimli günler dileriz!"
          : "Your discipline and dedication are at an excellent level. Your loyalty to the plan will enhance your spiritual and mental focus. Wishing you blessed and productive days!";
      } else if (isLow) {
        return tr
          ? "Yeni tempoya alışmak zaman alabilir. Kendini çok yormadan, günlük küçük niyetler ve kolay hedeflerle planına yeniden odaklanabilirsin."
          : "Getting used to the new pace can take time. Without pushing yourself too hard, you can refocus on your plan with small daily intentions and easy goals.";
      } else {
        return tr
          ? "Rutinlerin fena gitmiyor. Günlük ibadet, okuma veya dinlenme dengeni korumak için planına sadık kalmaya çalış. İstikrar huzur getirecektir."
          : "Your routines are not going bad. Try to stay committed to your plan to keep your daily prayer, reading, or resting balance. Consistency brings peace.";
      }
    }
}
