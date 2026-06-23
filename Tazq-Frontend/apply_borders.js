const fs = require('fs');
const path = require('path');

const files = [
  'app/cockpit.tsx',
  'app/admin.tsx',
  'app/index.tsx',
  'app/focus.tsx',
  'app/modlar.tsx',
  'app/login.tsx',
  'components/BottomNavBar.tsx',
  'components/BentoCard.tsx'
];

for (const relPath of files) {
  const file = path.join('d:\\Tazq-App\\Tazq-Frontend', relPath);
  if (!fs.existsSync(file)) continue;
  
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

  if (changed) {
    // Ensure B is imported from constants/tokens
    if (content.includes('from \'../constants/tokens\'')) {
      if (!content.includes(' B ')) {
        content = content.replace(/import \{(.*?)\} from '\.\.\/constants\/tokens';/, (match, group1) => {
          if (!group1.includes('B')) {
            return `import { ${group1.trim()}, B } from '../constants/tokens';`;
          }
          return match;
        });
      }
    } else if (content.includes('from \'@/constants/tokens\'')) {
      if (!content.includes(' B ')) {
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
      const prefix = depth === 1 ? '../' : '../../';
      content = content.replace(/(import React.*?;\n)/, `$1import { B } from '${prefix}constants/tokens';\n`);
    }
    
    fs.writeFileSync(file, content);
    console.log(`Updated ${relPath}`);
  }
}
