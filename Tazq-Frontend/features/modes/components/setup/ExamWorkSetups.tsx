import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Reanimated, { FadeInDown } from 'react-native-reanimated';
import { Touchable } from '@/shared/components/Touchable';
import { F, W, S, R } from '@/shared/constants/tokens';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useModeAccent } from '@/shared/hooks/useModeAccent';
import { haptic } from '@/shared/utils/haptics';
import { HOURS_OPTIONS, type ExamPreset } from '@/shared/utils/examPresets';
import { INTERVIEW_AREAS, TEZ_AREAS } from '@/shared/utils/weakAreas';
import { blueprintFor } from '@/features/studyplan/data/blueprints';
import type { StartLevel } from '@/features/studyplan/utils/scheduler';
import { ModeField } from '../ModeField';
import { ExamNameField } from '../modes/ExamNameField';
import { Choice, Chips, DateStep, daysUntilKey, Question, SetupShell, Summary, type SetupStep } from './SetupShell';

/*
  SINAV: sınav, tarih, süre, derslerde seviye, özet. Konu listesi olmayan sınavda seviye adımı atlanır ve bu söylenir.
  TEZ ve MÜLAKAT: ad, tarih, zorlandığın yer, özet. İkisinin ölçüsü tarih; süre sorulmaz, tempo yaklaşan tarihten gelir.
*/
export interface ExamResult { kind: 'exam'; slot: string; name: string; date: string; minutes: number; levels: Record<string, StartLevel>; preset: ExamPreset | null }
export interface WorkResult { kind: 'tez' | 'mulakat'; slot: string; name: string; date: string; areas: string[] }

const EXAM = {
  tr: {
    nameQ: 'Hangi sınava hazırlanıyorsun?', namePh: 'Örn: KPSS, YKS, ALES',
    dateQ: 'Sınav ne zaman?', dateHint: 'Takvim buna göre kurulur. Sonra değiştirebilirsin.', daysTo: (n: string) => `${n} için kalan gün`,
    timeQ: 'Günde ne kadar ayırabilirsin?', timeHint: 'Gerçekçi olan iyidir: plan bu süreye sığar, yetmezse sana söyler.',
    tier: (m: number) => (m <= 60 ? 'Temel · Her gün küçük ama düzenli adım' : m <= 120 ? 'Standart · Konu ve soru dengeli ilerler' : 'Yoğun · Hızlı tempo, sık deneme'),
    levelQ: 'Nereden başlıyorsun?', levelHint: (s: number, t: number) => `${s} ders, ${t} konu. Bildiğin dersleri işaretle, plan oralarda vakit harcamasın. Dokunmazsan sıfırdan başlar.`,
    levels: { yok: 'Sıfırdan', biraz: 'Biraz', tekrar: 'İyi' } as Record<StartLevel, string>,
    sum: 'Planın hazır', days: 'gün', min: 'dk / gün', topics: 'konu',
    how: ['Her gün sana yetecek kadar konu ve soru gelir, hepsi Planım’da.', 'Yaptıkça plan seni tanır: zorlandığın konu tekrar döner, kaçırdığın gün cezalandırılmaz, yeniden dağıtılır.', 'Denemelerini girersen gidişatın netleşir.'],
    howCustom: ['Bu sınavın konu listesi bizde yok, plan genel çalışma düzeniyle kurulur.', 'Her gün çalışma süren kadar iş gelir, hepsi Planım’da.', 'Yaptıkça plan seni tanır, kaçırdığın gün cezalandırılmaz.'],
    line: (t: number) => (t > 0 ? `${t} konu takvime yerleşiyor` : 'Planın kuruluyor'),
  },
  en: {
    nameQ: 'Which exam are you preparing for?', namePh: 'e.g. IELTS, SAT, GRE',
    dateQ: 'When is the exam?', dateHint: 'Your calendar is built from this. You can change it later.', daysTo: (n: string) => `days left to ${n}`,
    timeQ: 'How much can you give each day?', timeHint: 'Realistic beats ambitious: the plan fits this time and tells you if it falls short.',
    tier: (m: number) => (m <= 60 ? 'Foundation · Small, steady steps every day' : m <= 120 ? 'Standard · Balanced topics and questions' : 'Intensive · Fast pace, frequent mocks'),
    levelQ: 'Where are you starting from?', levelHint: (s: number, t: number) => `${s} subjects, ${t} topics. Mark what you already know so the plan skips ahead. Untouched means from zero.`,
    levels: { yok: 'From zero', biraz: 'Some', tekrar: 'Well' } as Record<StartLevel, string>,
    sum: 'Your plan is ready', days: 'days', min: 'min / day', topics: 'topics',
    how: ['Each day brings enough topics and questions for you, all in My Plan.', 'The plan learns as you go: hard topics come back, and a missed day isn’t punished, it’s redistributed.', 'Log your mock exams to see where you stand.'],
    howCustom: ['We have no topic list for this exam, so the plan uses a general study routine.', 'Each day brings work that fits your time, all in My Plan.', 'The plan learns as you go; a missed day isn’t punished.'],
    line: (t: number) => (t > 0 ? `Placing ${t} topics on your calendar` : 'Building your plan'),
  },
};
const LEVELS: StartLevel[] = ['yok', 'biraz', 'tekrar'];
const LABEL_KEY = { tr: 'labelTr', en: 'labelEn' } as const;

export function ExamSetup({ slot, lang, onClose, onDone }: { slot: string; lang: 'tr' | 'en'; onClose: () => void; onDone: (r: ExamResult) => void }) {
  const { theme } = useAppTheme();
  const { accent, onAccent } = useModeAccent('exam');
  const c = EXAM[lang];
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [preset, setPreset] = useState<ExamPreset | null>(null);
  const [suggestions, setSuggestions] = useState<ExamPreset[]>([]);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [levels, setLevels] = useState<Record<string, StartLevel>>({});
  const bp = useMemo(() => (name.trim() ? blueprintFor(name) : null), [name]);
  const clean = name.trim();
  const days = date ? daysUntilKey(date) : 0;

  const steps: SetupStep[] = [
    { key: 'name', valid: !!clean, node: <><Question title={c.nameQ} /><ExamNameField name={name} onName={setName} preset={preset} onPreset={setPreset} suggestions={suggestions} onSuggestions={setSuggestions} onClearHours={() => setMinutes(null)} placeholder={c.namePh} /></> },
    { key: 'date', valid: !!date, node: <><Question title={c.dateQ} hint={c.dateHint} /><DateStep kind="exam" lang={lang} date={date} onDate={setDate} label={c.daysTo(clean)} /></> },
    {
      key: 'time', valid: minutes != null, node: (
        <>
          <Question title={c.timeQ} hint={c.timeHint} />
          {HOURS_OPTIONS.map((o, i) => <Choice key={o.minutes} kind="exam" index={i} title={o[LABEL_KEY[lang]]} sub={c.tier(o.minutes)} on={minutes === o.minutes} onPress={() => setMinutes(o.minutes)} />)}
        </>
      ),
    },
    ...(bp ? [{
      key: 'level', valid: true, node: (
        <>
          <Question title={c.levelQ} hint={c.levelHint(bp.subjects.length, bp.topics.length)} />
          {bp.subjects.map((sub, i) => {
            const cur = levels[sub.id] ?? 'yok';
            return (
              <Reanimated.View key={sub.id} entering={FadeInDown.delay(Math.min(i, 10) * 40).duration(240)} style={[st.subject, { backgroundColor: theme.surfaceContainerHigh }]}>
                <Text style={{ fontSize: F.body, fontWeight: W.semibold, color: theme.onSurface }}>{sub[lang]}</Text>
                <View style={st.levels} accessibilityRole="radiogroup">
                  {LEVELS.map(l => {
                    const on = cur === l;
                    return (
                      <Touchable key={l} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${sub[lang]}: ${c.levels[l]}`} onPress={() => { haptic.select(); setLevels(v => ({ ...v, [sub.id]: l })); }} style={[st.level, { backgroundColor: on ? accent : theme.surfaceCard }]}>
                        <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: on ? onAccent : theme.onSurface }}>{c.levels[l]}</Text>
                      </Touchable>
                    );
                  })}
                </View>
              </Reanimated.View>
            );
          })}
        </>
      ),
    }] : []),
    {
      key: 'sum', valid: true, node: (
        <Summary kind="exam" lang={lang} title={clean} heading={c.sum} how={bp ? c.how : c.howCustom} facts={[[String(days), c.days], [String(minutes ?? 0), c.min], ...(bp ? [[String(bp.topics.length), c.topics] as [string, string]] : [])]} />
      ),
    },
  ];
  return (
    <SetupShell kind="exam" lang={lang} steps={steps} onClose={onClose}
      scene={{ title: clean, big: days, bigLabel: c.days, ticker: bp?.subjects.map(x => x[lang]) ?? [], line: c.line(bp?.topics.length ?? 0) }}
      onDone={() => onDone({ kind: 'exam', slot, name: clean, date, minutes: minutes ?? 0, levels, preset })} />
  );
}

const WORK = {
  tez: {
    tr: {
      nameQ: 'Tezinin ya da projenin adı ne?', namePh: 'Örn: Yüksek lisans tezi', dateQ: 'Teslim ne zaman?', dateHint: 'Bugünden teslime kadar yolu buna göre kurarız.', daysTo: 'teslime kalan gün',
      areaQ: 'En çok nerede zorlanıyorsun?', areaHint: 'İstersen birkaç tane seç; plan oraya daha sık döner. Boş da bırakabilirsin.',
      sum: 'Yol haritan hazır', days: 'gün', how: ['Her gün tek oturuşta bitecek somut bir iş gelir: yaz, oku, düzelt.', 'Teslim yaklaştıkça iş yazmaktan düzeltmeye ve savunmaya kayar.', 'Zorlandığın alan daha sık karşına çıkar.'],
      ticker: ['Literatür', 'Yazım', 'Analiz', 'Son düzeltme', 'Teslim'], line: 'Yol haritan çiziliyor',
    },
    en: {
      nameQ: 'What’s your thesis or project called?', namePh: 'e.g. Master’s thesis', dateQ: 'When is it due?', dateHint: 'We lay out the road from today to this date.', daysTo: 'days until it’s due',
      areaQ: 'Where do you struggle most?', areaHint: 'Pick a few if you like; the plan returns there more often. You can leave this empty.',
      sum: 'Your road map is ready', days: 'days', how: ['Each day brings one concrete job you can finish in a sitting: write, read, fix.', 'As the date nears, work shifts from writing to editing and defence.', 'The area you struggle with comes up more often.'],
      ticker: ['Literature', 'Writing', 'Analysis', 'Final edits', 'Submission'], line: 'Drawing your road map',
    },
  },
  mulakat: {
    tr: {
      nameQ: 'Hangi şirket, hangi pozisyon?', namePh: 'Örn: Google, iOS geliştirici', dateQ: 'Mülakat ne zaman?', dateHint: 'Kalan güne göre neye öncelik vereceğini biz sıralarız.', daysTo: 'mülakata kalan gün',
      areaQ: 'En çok hangi soru türünden çekiniyorsun?', areaHint: 'İstersen seç; pratik oraya ağırlık verir. Boş da bırakabilirsin.',
      sum: 'Hazırlığın hazır', days: 'gün', how: ['Her gün tek bir hazırlık işi gelir: şirketi tanı, hikayeni yaz, sesli prova et.', 'Son günlerde yeni konu yok; prova ve lojistik öne çıkar.', 'Çekindiğin soru türü daha sık karşına çıkar.'],
      ticker: ['Şirketi tanı', 'Hikayelerini yaz', 'Soruları çöz', 'Sesli prova', 'Son hazırlık'], line: 'Hazırlığın sıralanıyor',
    },
    en: {
      nameQ: 'Which company and role?', namePh: 'e.g. Google, iOS developer', dateQ: 'When is the interview?', dateHint: 'We prioritise based on the days you have left.', daysTo: 'days to the interview',
      areaQ: 'Which question type worries you most?', areaHint: 'Pick if you like; practice leans that way. You can leave this empty.',
      sum: 'Your prep is ready', days: 'days', how: ['Each day brings one prep job: learn the company, write your stories, rehearse aloud.', 'In the final days there are no new topics; rehearsal and logistics come first.', 'The question type that worries you comes up more often.'],
      ticker: ['Know the company', 'Write your stories', 'Solve questions', 'Rehearse aloud', 'Final prep'], line: 'Ordering your prep',
    },
  },
};

export function WorkSetup({ kind, slot, lang, onClose, onDone }: { kind: 'tez' | 'mulakat'; slot: string; lang: 'tr' | 'en'; onClose: () => void; onDone: (r: WorkResult) => void }) {
  const { accent } = useModeAccent(kind);
  const c = WORK[kind][lang];
  const areas = kind === 'tez' ? TEZ_AREAS : INTERVIEW_AREAS;
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const clean = name.trim();
  const days = date ? daysUntilKey(date) : 0;
  const steps: SetupStep[] = [
    { key: 'name', valid: !!clean, node: <><Question title={c.nameQ} /><ModeField accent={accent} value={name} onChangeText={setName} placeholder={c.namePh} returnKeyType="done" maxLength={60} /></> },
    { key: 'date', valid: !!date, node: <><Question title={c.dateQ} hint={c.dateHint} /><DateStep kind={kind} lang={lang} date={date} onDate={setDate} label={c.daysTo} fallbackDays={kind === 'tez' ? 90 : 14} /></> },
    {
      key: 'area', valid: true, optional: picked.length === 0, node: (
        <>
          <Question title={c.areaQ} hint={c.areaHint} />
          <Chips kind={kind} items={areas.map(a => ({ id: a.id, label: a[lang] }))} isOn={id => picked.includes(id)} onToggle={id => setPicked(v => (v.includes(id) ? v.filter(x => x !== id) : [...v, id]))} />
        </>
      ),
    },
    { key: 'sum', valid: true, node: <Summary kind={kind} lang={lang} title={clean} heading={c.sum} how={c.how} facts={[[String(days), c.days]]} /> },
  ];
  return (
    <SetupShell kind={kind} lang={lang} steps={steps} onClose={onClose}
      scene={{ title: clean, big: days, bigLabel: c.days, ticker: c.ticker, line: c.line }}
      onDone={() => onDone({ kind, slot, name: clean, date, areas: picked })} />
  );
}

const st = StyleSheet.create({
  subject: { borderRadius: R.md, padding: S.smd, gap: S.sm },
  levels: { flexDirection: 'row', gap: S.xs },
  level: { flex: 1, minHeight: 36, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
});
