const fs = require('fs');
const path = require('path');

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(file));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

const allFiles = [
  ...getFiles('d:\\Tazq-App\\Tazq-Frontend\\app'),
  ...getFiles('d:\\Tazq-App\\Tazq-Frontend\\components')
];

const bigStyles = [
  'styles.title', 'styles.sheetTitle', 'styles.missionTitle', 
  'styles.quickDraftTitle', 'styles.statValue', 'styles.modalTitle',
  'styles.progressNum', 'styles.metricValue', 'styles.name'
];

for (const file of allFiles) {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('<Text') && bigStyles.some(s => line.includes(s))) {
      if (!line.includes('adjustsFontSizeToFit')) {
        let newLine = line.replace('<Text ', '<Text adjustsFontSizeToFit minimumFontScale={0.7} ');
        if (!newLine.includes('numberOfLines=')) {
          newLine = newLine.replace('<Text ', '<Text numberOfLines={1} ');
        }
        lines[i] = newLine;
        changed = true;
      }
    }
  }

  if (changed) {
    fs.writeFileSync(file, lines.join('\n'));
    console.log(`Updated responsive styles in ${file}`);
  }
}
