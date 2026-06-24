const fs = require('fs');

let content = fs.readFileSync('app/modlar.tsx', 'utf8');

const cleanupStr = `      return () => {
        const s = seasonalRef.current;
        if (s.examMode && (!s.examName?.trim() || !s.examDate)) {
          setSeasonalPref('examMode', false); setSeasonalPref('examName', ''); setSeasonalPref('examDate', null);
        }
        if (s.tezMode && (!s.tezName?.trim() || !s.tezDate)) {
          setSeasonalPref('tezMode', false); setSeasonalPref('tezName', ''); setSeasonalPref('tezDate', null);
        }
        if (s.mulakatMode && (!s.mulakatName?.trim() || !s.mulakatDate)) {
          setSeasonalPref('mulakatMode', false); setSeasonalPref('mulakatName', ''); setSeasonalPref('mulakatDate', null);
        }
        if (s.sporMode) {
          const sGoal = s.sporGoal?.trim() ?? '';
          const sType = sGoal ? detectSporType(sGoal) : null;
          // kilo tipi için tarih otomatik hesaplanır, store'da olmayabilir — sadece hedef seçilmişse geçerli say
          const incomplete = !sGoal || (sType !== 'kilo' && !s.sporDate);
          if (incomplete) {
            setSeasonalPref('sporMode', false); setSeasonalPref('sporGoal', ''); setSeasonalPref('sporDate', null);
          }
        }
      };`;

content = content.replace(cleanupStr, '');

fs.writeFileSync('app/modlar.tsx', content);
console.log('Cleanup logic removed');
