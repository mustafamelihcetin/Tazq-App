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

for (const file of allFiles) {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // Replace borderWidth: 1
  if (content.match(/borderWidth:\s*1([,} \n])/)) {
    content = content.replace(/borderWidth:\s*1([,} \n])/g, 'borderWidth: B.thin$1');
    changed = true;
  }
  
  // Replace borderWidth: 1.5
  if (content.match(/borderWidth:\s*1\.5([,} \n])/)) {
    content = content.replace(/borderWidth:\s*1\.5([,} \n])/g, 'borderWidth: B.medium$1');
    changed = true;
  }
  
  // Replace borderWidth: 1.2
  if (content.match(/borderWidth:\s*1\.2([,} \n])/)) {
    content = content.replace(/borderWidth:\s*1\.2([,} \n])/g, 'borderWidth: B.thin$1');
    changed = true;
  }

  if (changed) {
    const relPath = path.relative('d:\\Tazq-App\\Tazq-Frontend', file).replace(/\\/g, '/');
    
    // Ensure B is imported
    if (content.includes('from \'../constants/tokens\'') || content.includes('from "../../constants/tokens"')) {
      if (!content.includes(' B ') && !content.includes('{ B }')) {
        content = content.replace(/import \{(.*?)\} from (['"])\.\.\/constants\/tokens\2;/, (match, group1, group2) => {
          if (!group1.includes('B')) {
            return `import { ${group1.trim()}, B } from ${group2}../constants/tokens${group2};`;
          }
          return match;
        });
        content = content.replace(/import \{(.*?)\} from (['"])\.\.\/\.\.\/constants\/tokens\2;/, (match, group1, group2) => {
          if (!group1.includes('B')) {
            return `import { ${group1.trim()}, B } from ${group2}../../constants/tokens${group2};`;
          }
          return match;
        });
      }
    } else if (content.includes('from \'@/constants/tokens\'')) {
      if (!content.includes(' B ') && !content.includes('{ B }')) {
        content = content.replace(/import \{(.*?)\} from '@\/constants\/tokens';/, (match, group1) => {
          if (!group1.includes('B')) {
            return `import { ${group1.trim()}, B } from '@/constants/tokens';`;
          }
          return match;
        });
      }
    } else {
      // If tokens is not imported at all, add it after react
      const depth = relPath.split('/').length - 1;
      let prefix = '';
      for (let i = 0; i < depth; i++) { prefix += '../'; }
      if (prefix === '') prefix = './';
      content = content.replace(/(import React.*?;\n)/, `$1import { B } from '${prefix}constants/tokens';\n`);
    }
    
    fs.writeFileSync(file, content);
    console.log(`Updated ${relPath}`);
  }
}
