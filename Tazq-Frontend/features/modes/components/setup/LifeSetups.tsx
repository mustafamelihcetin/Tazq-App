import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react-native';
import { F, W, S, ICON } from '@/shared/constants/tokens';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useModeAccent } from '@/shared/hooks/useModeAccent';
import { useMoneySymbol } from '@/features/modes/hooks/useMoneySymbol';
import { kiloCheck, moneyCheck, monthlyNeed } from '@/features/modes/utils/setupRules';
import { spendingAreaLabel, triggerLabel, type SpendingArea, type TriggerId } from '@/shared/utils/lifeModePlans';
import { useQuitStore, type QuitType } from '@/shared/store/useQuitStore';
import type { BudgetType } from '@/shared/store/useBudgetStore';
import { GOAL_LIMITS, quitRoomLeft } from '@/features/modes/utils/goalRows';
import { ModeField } from '../ModeField';
import { WeightWheelPicker } from '../modes/WeightWheelPicker';
import { getSporGoals } from '../modes/SporCard';
import { Choice, Chips, DateStep, daysUntilKey, Question, SetupShell, Summary, type SetupStep } from './SetupShell';
import { dateKeyFromNow } from '@/shared/utils/dateKey';

/*
  SPOR: hedef türü, sonra türün gerçekten ihtiyaç duyduğu bilgi (kilo: beden ve kilo, koşu: km ve mesafe, güç/form: haftada gün), tarih (kiloda sağlıklı tempodan hesaplanır, sorulmaz), özet. Kilo uydurulmaz: dokunulmayan tekerlek kaydedilmez.
  BİRİKİM: tür, türün tutarları (borç, birikim, acil fon ayrı), süre (ayda ne gerektiğini gösterir), nereye gidiyor, özet.
  BIRAKMA: ne bırakıyorsun, en zor anın, özet. Tarihi yok, ölçüsü seridir.
*/
export interface SporResult { kind: 'spor'; slot: string; goal: string; date: string; typeKey: string; cw: string; tw: string; height: string; age: string; weeklyKm: string; event: string; trainingDays: 3 | 4 | 5 | null }
export interface MoneyResult { kind: 'tasarruf'; slot: 'tasarruf'; type: Exclude<BudgetType, ''>; start: number; target: number; monthly: number; cover: number; months: number; area: SpendingArea }
export interface QuitResult { kind: 'birakma'; slot: 'birakma'; keys: Exclude<QuitType, ''>[]; custom: string; trigger: TriggerId }

const SPOR = {
  tr: {
    goalQ: 'Hedefin ne?', goalSub: { maraton: 'Mesafeni ve haftalık tempoyu büyütürüz', guc: 'Haftalık antrenman düzeni kurarız', kilo: 'Sağlıklı tempoda hedef kiloya gideriz', genel: 'Düzenli hareket alışkanlığı kurarız', yaris: 'Yarış gününe doğru hazırlarız' } as Record<string, string>,
    kiloQ: 'Bugün neredesin, nereye gidiyorsun?', kiloHint: 'Boyunu yazarsan sağlıklı aralığın dışına çıkan hedefe izin vermeyiz.', height: 'Boy', age: 'Yaş', now: 'Şu an', target: 'Hedef',
    kiloOut: 'Kilo 30–300 kg arasında olmalı.', kiloFar: 'İki kilo arasındaki fark 100 kg’ı geçemez.', kiloSame: 'Hedef kilon şu anki kilonla aynı.', kiloLow: (kg: number) => `Bu boy için sağlıklı alt sınır yaklaşık ${kg} kg. Daha yüksek bir hedef seç.`,
    kiloFine: (d: number, r: number, w: number) => `${d} kg · haftada ${r} kg · yaklaşık ${w} hafta`, kiloDoctor: '30 kg üzeri hedeflerde bir doktor ya da diyetisyen desteği iyi olur.',
    runQ: 'Şu an ne kadar koşuyorsun?', km: 'Haftalık km', kmPh: 'Örn: 15', eventQ: 'Hedef mesafe', events: { '5K': '5K', '10K': '10K', 'Yarı': 'Yarı maraton', 'Tam': 'Maraton' } as Record<string, string>,
    daysQ: 'Haftada kaç gün ayırabilirsin?', daysOpt: (d: number) => `${d} gün`, daysSub: { 3: 'Başlamak ve sürdürmek için ideal', 4: 'Dengeli ilerleme', 5: 'İddialı tempo' } as Record<number, string>,
    dateQ: 'Hedefin ne zaman?', dateHint: 'Antrenmanı bu tarihe göre yükseltiriz.', daysTo: 'hedefe kalan gün',
    sum: 'Planın hazır', days: 'gün', weeks: 'hafta', perWeek: 'gün / hafta', toLose: 'kg',
    how: ['Her gün o günün işi gelir: antrenman, dinlenme ya da küçük bir alışkanlık.', 'Yapamadığın gün cezalandırılmaz; plan sana göre ayarlanır.', 'İlerlemeni Planım’daki Takip’ten görürsün.'],
    ticker: ['Hedef', 'Haftalık düzen', 'İlk antrenman', 'Takip'], line: 'Planın kuruluyor',
  },
  en: {
    goalQ: 'What’s your goal?', goalSub: { maraton: 'We build up your distance and weekly pace', guc: 'We set a weekly training routine', kilo: 'We reach your target at a healthy pace', genel: 'We build a regular movement habit', yaris: 'We prepare you for race day' } as Record<string, string>,
    kiloQ: 'Where are you today, and where are you going?', kiloHint: 'With your height, we won’t allow a target outside the healthy range.', height: 'Height', age: 'Age', now: 'Now', target: 'Target',
    kiloOut: 'Weight must be between 30 and 300 kg.', kiloFar: 'The gap can’t exceed 100 kg.', kiloSame: 'Your target equals your current weight.', kiloLow: (kg: number) => `The healthy minimum for this height is about ${kg} kg. Pick a higher target.`,
    kiloFine: (d: number, r: number, w: number) => `${d} kg · ${r} kg a week · about ${w} weeks`, kiloDoctor: 'For goals above 30 kg, support from a doctor or dietitian helps.',
    runQ: 'How much do you run now?', km: 'Weekly km', kmPh: 'e.g. 15', eventQ: 'Target distance', events: { '5K': '5K', '10K': '10K', 'Yarı': 'Half marathon', 'Tam': 'Marathon' } as Record<string, string>,
    daysQ: 'How many days a week can you give?', daysOpt: (d: number) => `${d} days`, daysSub: { 3: 'Ideal for starting and sticking with it', 4: 'Balanced progress', 5: 'Ambitious pace' } as Record<number, string>,
    dateQ: 'When is your goal?', dateHint: 'We raise training toward this date.', daysTo: 'days to your goal',
    sum: 'Your plan is ready', days: 'days', weeks: 'weeks', perWeek: 'days / week', toLose: 'kg',
    how: ['Each day brings that day’s job: training, rest or a small habit.', 'A missed day isn’t punished; the plan adjusts to you.', 'See your progress in My Plan under Track.'],
    ticker: ['Goal', 'Weekly routine', 'First session', 'Tracking'], line: 'Building your plan',
  },
};

export function SporSetup({ slot, lang, onClose, onDone }: { slot: string; lang: 'tr' | 'en'; onClose: () => void; onDone: (r: SporResult) => void }) {
  const { theme, isDark } = useAppTheme();
  const { accent, accentText } = useModeAccent('spor');
  const c = SPOR[lang];
  const primary = slot === 'spor';
  // İkinci hedefte kilo sunulmaz: beden verisi tek takım tutuluyor.
  const goals = getSporGoals(lang === 'tr').filter(g => primary || g.key !== 'kilo');
  const [goalKey, setGoalKey] = useState('');
  const [cw, setCw] = useState('');
  const [tw, setTw] = useState('');
  const [height, setHeight] = useState('');
  const [age, setAge] = useState('');
  const [km, setKm] = useState('');
  const [event, setEvent] = useState('');
  const [days, setDays] = useState<3 | 4 | 5 | null>(null);
  const [date, setDate] = useState('');
  const goal = goals.find(g => g.key === goalKey);
  const kilo = kiloCheck(cw, tw, height);
  const isKilo = goalKey === 'kilo';
  const isRun = goalKey === 'maraton';
  const needsInfo = primary && !!goalKey;
  const infoValid = isKilo ? kilo.ok : isRun ? !!km.trim() && !!event : days != null;
  const finalDate = isKilo && kilo.weeks ? dateKeyFromNow(kilo.weeks * 7) : date;
  const dayCount = finalDate ? daysUntilKey(finalDate) : 0;
  const err = kilo.problem === 'range' ? c.kiloOut : kilo.problem === 'far' ? c.kiloFar : kilo.problem === 'same' ? c.kiloSame : kilo.problem === 'low' ? c.kiloLow(kilo.minKg) : null;
  const rows = [
    { key: 'goal', valid: !!goalKey, node: <><Question title={c.goalQ} />{goals.map((g, i) => <Choice key={g.key} kind="spor" index={i} title={g.label} sub={c.goalSub[g.key]} on={goalKey === g.key} onPress={() => setGoalKey(g.key)} />)}</> },
  ] as SetupStep[];
  if (needsInfo && isKilo) rows.push({
    key: 'kilo', valid: kilo.ok, node: (
      <>
        <Question title={c.kiloQ} hint={c.kiloHint} />
        <View style={st.row}>
          <ModeField accent={accent} containerStyle={{ flex: 1 }} suffix={<Text style={{ color: theme.onSurfaceMuted, fontSize: F.caption }}>cm</Text>} value={height} onChangeText={setHeight} placeholder={c.height} keyboardType="number-pad" />
          <ModeField accent={accent} containerStyle={{ flex: 1 }} value={age} onChangeText={setAge} placeholder={c.age} keyboardType="number-pad" />
        </View>
        <View style={st.row}>
          <View style={st.wheel}><Text style={{ fontSize: F.caption, fontWeight: W.semibold, color: theme.onSurfaceMuted }}>{c.now}</Text><WeightWheelPicker value={parseFloat(cw) > 0 ? Math.round(parseFloat(cw)) : 75} onChange={v => setCw(String(v))} theme={theme} isDark={isDark} sporColor={accent} /></View>
          <View style={st.wheel}><Text style={{ fontSize: F.caption, fontWeight: W.semibold, color: theme.onSurfaceMuted }}>{c.target}</Text><WeightWheelPicker value={parseFloat(tw) > 0 ? Math.round(parseFloat(tw)) : 70} onChange={v => setTw(String(v))} theme={theme} isDark={isDark} sporColor={accent} /></View>
        </View>
        {err && <View style={st.note}><AlertTriangle size={ICON.sm} color={theme.error} /><Text style={{ flex: 1, fontSize: F.footnote, color: theme.error }}>{err}</Text></View>}
        {kilo.ok && (
          <View style={st.note}>
            {kilo.gaining ? <TrendingUp size={ICON.sm} color={accentText} /> : <TrendingDown size={ICON.sm} color={accentText} />}
            <Text style={{ flex: 1, fontSize: F.footnote, fontWeight: W.semibold, color: accentText }}>{c.kiloFine(kilo.diff, kilo.rate, kilo.weeks ?? 0)}</Text>
          </View>
        )}
        {kilo.ok && kilo.diff > 30 && <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{c.kiloDoctor}</Text>}
      </>
    ),
  });
  if (needsInfo && isRun) rows.push({
    key: 'run', valid: infoValid, node: (
      <>
        <Question title={c.runQ} />
        <ModeField accent={accent} suffix={<Text style={{ color: theme.onSurfaceMuted, fontSize: F.caption }}>km</Text>} value={km} onChangeText={setKm} placeholder={c.kmPh} keyboardType="numeric" />
        <Question title={c.eventQ} />
        <Chips kind="spor" items={Object.entries(c.events).map(([id, label]) => ({ id, label }))} isOn={id => event === id} onToggle={setEvent} />
      </>
    ),
  });
  if (needsInfo && !isKilo && !isRun) rows.push({
    key: 'days', valid: days != null, node: <><Question title={c.daysQ} />{([3, 4, 5] as const).map((d, i) => <Choice key={d} kind="spor" index={i} title={c.daysOpt(d)} sub={c.daysSub[d]} on={days === d} onPress={() => setDays(d)} />)}</>,
  });
  if (!isKilo) rows.push({ key: 'date', valid: !!date, node: <><Question title={c.dateQ} hint={c.dateHint} /><DateStep kind="spor" lang={lang} date={date} onDate={setDate} label={c.daysTo} fallbackDays={90} /></> });
  rows.push({
    key: 'sum', valid: true, node: (
      <Summary kind="spor" lang={lang} title={goal?.label ?? ''} heading={c.sum} how={c.how}
        facts={isKilo ? [[String(kilo.diff), c.toLose], [String(kilo.weeks ?? 0), c.weeks]] : days != null ? [[String(dayCount), c.days], [String(days), c.perWeek]] : [[String(dayCount), c.days]]} />
    ),
  });
  return (
    <SetupShell kind="spor" lang={lang} steps={rows} onClose={onClose}
      scene={{ title: goal?.label ?? '', big: dayCount, bigLabel: c.days, ticker: c.ticker, line: c.line }}
      onDone={() => onDone({ kind: 'spor', slot, goal: goal?.label ?? '', typeKey: goalKey, date: finalDate, cw, tw, height, age, weeklyKm: km, event, trainingDays: days })} />
  );
}

const MONEY = {
  tr: {
    typeQ: 'Paranla ne yapmak istiyorsun?', types: { birikim: ['Birikim', 'Bir hedef için para biriktir'], borc: ['Borç kapatma', 'Borcunu sıfıra indir'], acilfon: ['Acil fon', 'Beklenmedik güne güvence kur'] },
    savingsQ: 'Ne kadarın var, ne kadar istiyorsun?', current: 'Şu anki birikim', target: 'Hedef tutar', savingsBad: 'Hedef, şu anki birikimden büyük olmalı.',
    debtQ: 'Borcun ne kadar?', debt: 'Toplam borç',
    fundQ: 'Aylık giderin ne kadar?', monthly: 'Aylık gider', coverQ: 'Kaç aylık güvence istersin?', coverOpt: (m: number) => `${m} ay`, fundTarget: (t: string) => `Hedefin: ${t}`,
    timeQ: 'Ne kadar sürede?', timeOpt: (m: number) => `${m} ay`, need: (t: string) => `Ayda ${t}`,
    areaQ: 'Paran en çok nereye gidiyor?', areaHint: 'İstersen seç; plan oraya küçük işler ekler.',
    sum: 'Planın hazır', amount: 'hedef', perMonth: 'ayda', months: 'ay',
    how: ['Her gün küçük bir para işi gelir, hepsi Planım’da.', 'Haftada bir bakiyeni girersin, kumbara dolar ve kalan yol görünür.', 'Geride kalırsan suçlamayız, ayda ne gerektiğini yeniden hesaplarız.'],
    ticker: ['Hedef', 'Aylık tutar', 'Haftalık kayıt', 'Kumbara'], line: 'Kumbaran hazırlanıyor',
  },
  en: {
    typeQ: 'What do you want to do with your money?', types: { birikim: ['Savings', 'Save toward a goal'], borc: ['Debt payoff', 'Bring your debt to zero'], acilfon: ['Emergency fund', 'Build a cushion for bad days'] },
    savingsQ: 'What do you have, and what do you want?', current: 'Current savings', target: 'Target amount', savingsBad: 'The target must be higher than current savings.',
    debtQ: 'How much is your debt?', debt: 'Total debt',
    fundQ: 'What are your monthly expenses?', monthly: 'Monthly expenses', coverQ: 'How many months of cover?', coverOpt: (m: number) => `${m} months`, fundTarget: (t: string) => `Your target: ${t}`,
    timeQ: 'Over how long?', timeOpt: (m: number) => `${m} months`, need: (t: string) => `${t} a month`,
    areaQ: 'Where does your money go most?', areaHint: 'Pick if you like; the plan adds small jobs there.',
    sum: 'Your plan is ready', amount: 'target', perMonth: 'a month', months: 'months',
    how: ['Each day brings a small money job, all in My Plan.', 'Once a week you log your balance; the jar fills and the road ahead shows.', 'If you fall behind, no blame: we recalculate what each month needs.'],
    ticker: ['Goal', 'Monthly amount', 'Weekly log', 'Jar'], line: 'Preparing your jar',
  },
};
const TYPES: Exclude<BudgetType, ''>[] = ['birikim', 'borc', 'acilfon'];
const COVER = [3, 6, 12];
const DURATIONS = [3, 6, 12, 24];
const AREAS: Exclude<SpendingArea, ''>[] = ['disarida_yemek', 'online_alisveris', 'abonelikler', 'eglence_hobi'];
const digits = (t: string) => t.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 10);
const LOCALE = { tr: 'tr-TR', en: 'en-GB' };

export function MoneySetup({ lang, onClose, onDone }: { lang: 'tr' | 'en'; onClose: () => void; onDone: (r: MoneyResult) => void }) {
  const { theme } = useAppTheme();
  const { accent, accentText } = useModeAccent('tasarruf');
  const { symbol } = useMoneySymbol(lang);
  const c = MONEY[lang];
  const tr = lang === 'tr';
  const fmt = (n: number) => `${symbol}${Math.round(n).toLocaleString(LOCALE[lang])}`;
  const [type, setType] = useState<Exclude<BudgetType, ''> | ''>('');
  const [startText, setStart] = useState('');
  const [targetText, setTarget] = useState('');
  const [monthlyText, setMonthly] = useState('');
  const [cover, setCover] = useState(6);
  const [months, setMonths] = useState<number | null>(null);
  const [area, setArea] = useState<SpendingArea>('');
  const m = moneyCheck(type, parseFloat(startText) || 0, parseFloat(targetText) || 0, parseFloat(monthlyText) || 0, cover);
  const field = (label: string, value: string, set: (v: string) => void) => (
    <View style={{ gap: S.xs }}>
      <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: theme.onSurfaceVariant }}>{label}</Text>
      <ModeField accent={accent} prefix={<Text style={{ color: theme.onSurfaceMuted, fontSize: F.body }}>{symbol}</Text>} value={value} onChangeText={t => set(digits(t))} placeholder="0" keyboardType="number-pad" />
    </View>
  );
  const typeTitle = type ? c.types[type][0] : '';
  const need = months ? monthlyNeed(m.start, m.target, months) : 0;
  const steps: SetupStep[] = [
    { key: 'type', valid: !!type, node: <><Question title={c.typeQ} />{TYPES.map((t, i) => <Choice key={t} kind="tasarruf" index={i} title={c.types[t][0]} sub={c.types[t][1]} on={type === t} onPress={() => setType(t)} />)}</> },
    {
      key: 'amount', valid: m.ok, node: type === 'borc' ? <><Question title={c.debtQ} />{field(c.debt, startText, setStart)}</>
        : type === 'acilfon' ? (
          <>
            <Question title={c.fundQ} />
            {field(c.monthly, monthlyText, setMonthly)}
            <Question title={c.coverQ} />
            <Chips kind="tasarruf" items={COVER.map(x => ({ id: String(x), label: c.coverOpt(x) }))} isOn={id => cover === Number(id)} onToggle={id => setCover(Number(id))} />
            {field(c.current, startText, setStart)}
            {m.target > 0 && <Text style={{ fontSize: F.body, fontWeight: W.bold, color: accentText }}>{c.fundTarget(fmt(m.target))}</Text>}
          </>
        ) : (
          <>
            <Question title={c.savingsQ} />
            {field(c.current, startText, setStart)}
            {field(c.target, targetText, setTarget)}
            {!!targetText && !m.ok && <Text style={{ fontSize: F.footnote, color: theme.error }}>{c.savingsBad}</Text>}
          </>
        ),
    },
    {
      key: 'time', valid: months != null, node: (
        <>
          <Question title={c.timeQ} />
          {DURATIONS.map((d, i) => <Choice key={d} kind="tasarruf" index={i} title={c.timeOpt(d)} sub={c.need(fmt(monthlyNeed(m.start, m.target, d)))} on={months === d} onPress={() => setMonths(d)} />)}
        </>
      ),
    },
    {
      key: 'area', valid: true, optional: !area, node: (
        <>
          <Question title={c.areaQ} hint={c.areaHint} />
          <Chips kind="tasarruf" items={AREAS.map(a => ({ id: a, label: spendingAreaLabel(a, tr) }))} isOn={id => area === id} onToggle={id => setArea(area === id ? '' : (id as SpendingArea))} />
        </>
      ),
    },
    { key: 'sum', valid: true, node: <Summary kind="tasarruf" lang={lang} title={typeTitle} heading={c.sum} how={c.how} facts={[[fmt(type === 'borc' ? m.start : m.target), c.amount], [fmt(need), c.perMonth], [String(months ?? 0), c.months]]} /> },
  ];
  return (
    <SetupShell kind="tasarruf" lang={lang} steps={steps} onClose={onClose}
      scene={{ title: typeTitle, big: months ?? 0, bigLabel: c.months, ticker: c.ticker, line: c.line }}
      onDone={() => { if (type && months) onDone({ kind: 'tasarruf', slot: 'tasarruf', type, start: m.start, target: m.target, monthly: parseFloat(monthlyText) || 0, cover, months, area }); }} />
  );
}

const QUIT = {
  tr: {
    whatQ: 'Neyi bırakmak istiyorsun?', whatHint: (n: number) => `Aynı anda en çok ${n} şey. Az olması tutunmayı kolaylaştırır.`, customPh: 'Ne? (ör. Kahve)',
    types: { sigara: 'Sigara', sosyal: 'Sosyal medya', seker: 'Şeker', alkol: 'Alkol', kumar: 'Kumar', ozel: 'Başka bir şey' } as Record<string, string>,
    whenQ: 'İstek en çok ne zaman geliyor?', whenHint: 'Bilirsek o an için hazırlık ekleriz. Boş da bırakabilirsin.',
    sum: 'Bugün 1. gün', count: 'bırakılan', how: ['Her gün temiz kaldığını işaretlersin, serin görünür.', 'İşler tek tek gelir: tetikleyiciyi yaz, isteğe hazırlan, destek bul.', 'Kayarsan seri biter ama yolun bitmez; yeniden başlamak tek dokunuş.'],
    line: 'Yeni başlangıcın hazırlanıyor', days: '. gün',
  },
  en: {
    whatQ: 'What do you want to quit?', whatHint: (n: number) => `Up to ${n} at once. Fewer makes it easier to hold on.`, customPh: 'What? (e.g. Coffee)',
    types: { sigara: 'Smoking', sosyal: 'Social media', seker: 'Sugar', alkol: 'Alcohol', kumar: 'Gambling', ozel: 'Something else' } as Record<string, string>,
    whenQ: 'When do cravings hit most?', whenHint: 'If we know, we add prep for that moment. You can leave this empty.',
    sum: 'Today is day 1', count: 'quitting', how: ['Each day you mark staying clean, and your streak shows.', 'Jobs come one at a time: write your triggers, prepare for cravings, find support.', 'If you slip, the streak ends but the road doesn’t; starting again takes one tap.'],
    line: 'Preparing your new start', days: ' day',
  },
};
const QUIT_KEYS: Exclude<QuitType, ''>[] = ['sigara', 'sosyal', 'seker', 'alkol', 'kumar', 'ozel'];
const TRIGGERS: Exclude<TriggerId, ''>[] = ['stres', 'sosyal_ortam', 'can_sikintisi', 'otomatik_pilot'];

export function QuitSetup({ lang, onClose, onDone }: { lang: 'tr' | 'en'; onClose: () => void; onDone: (r: QuitResult) => void }) {
  const { accent } = useModeAccent('birakma');
  const c = QUIT[lang];
  const items = useQuitStore(s => s.items);
  const taken = new Set(items.map(i => i.type));
  const [keys, setKeys] = useState<Exclude<QuitType, ''>[]>([]);
  const [custom, setCustom] = useState('');
  const [trigger, setTrigger] = useState<TriggerId>('');
  const room = quitRoomLeft(items.length, keys.length);
  const toggle = (k: string) => setKeys(v => (v.includes(k as never) ? v.filter(x => x !== k) : room > 0 ? [...v, k as Exclude<QuitType, ''>] : v));
  const names = keys.map(k => (k === 'ozel' ? custom.trim() : c.types[k])).filter(Boolean);
  const valid = keys.length > 0 && (!keys.includes('ozel') || !!custom.trim());
  const available = QUIT_KEYS.filter(k => k === 'ozel' || !taken.has(k));
  const steps: SetupStep[] = [
    {
      key: 'what', valid, node: (
        <>
          <Question title={c.whatQ} hint={c.whatHint(GOAL_LIMITS.birakma)} />
          <Chips kind="birakma" items={available.map(k => ({ id: k, label: c.types[k] }))} isOn={id => keys.includes(id as never)} onToggle={toggle} />
          {keys.includes('ozel') && <ModeField accent={accent} value={custom} onChangeText={setCustom} placeholder={c.customPh} maxLength={24} returnKeyType="done" />}
        </>
      ),
    },
    {
      key: 'when', valid: true, optional: !trigger, node: (
        <>
          <Question title={c.whenQ} hint={c.whenHint} />
          <Chips kind="birakma" items={TRIGGERS.map(t => ({ id: t, label: triggerLabel(t, lang === 'tr') }))} isOn={id => trigger === id} onToggle={id => setTrigger(trigger === id ? '' : (id as TriggerId))} />
        </>
      ),
    },
    { key: 'sum', valid: true, node: <Summary kind="birakma" lang={lang} title={names.join(', ')} heading={c.sum} how={c.how} facts={[[String(names.length), c.count]]} /> },
  ];
  return (
    <SetupShell kind="birakma" lang={lang} steps={steps} onClose={onClose}
      scene={{ title: names.join(', '), big: 1, bigLabel: c.days.trim(), ticker: names, line: c.line }}
      onDone={() => onDone({ kind: 'birakma', slot: 'birakma', keys, custom: custom.trim(), trigger })} />
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', gap: S.sm },
  wheel: { flex: 1, alignItems: 'center', gap: S.sm },
  note: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
});
