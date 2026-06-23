const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = [...walk('./app'), ...walk('./components')];

let updatedCount = 0;

files.forEach(file => {
  if (file.includes('Touchable.tsx')) return;
  
  let content = fs.readFileSync(file, 'utf8');
  
  // If it doesn't use TouchableOpacity, skip
  if (!content.includes('<TouchableOpacity') && !content.includes(' TouchableOpacity')) return;

  let originalContent = content;

  // 1. Replace the tags
  content = content.replace(/<TouchableOpacity/g, '<Touchable');
  content = content.replace(/<\/TouchableOpacity>/g, '</Touchable>');

  // 2. Add the import if it's not there
  if (content !== originalContent) {
    if (!content.includes("import { Touchable } from '@/components/Touchable'")) {
      // Find the last import line to insert after it, or just insert at the top
      const importMatches = [...content.matchAll(/^import .*;$/gm)];
      if (importMatches.length > 0) {
        const lastImport = importMatches[importMatches.length - 1];
        const insertPos = lastImport.index + lastImport[0].length;
        content = content.slice(0, insertPos) + "\nimport { Touchable } from '@/components/Touchable';" + content.slice(insertPos);
      } else {
        content = "import { Touchable } from '@/components/Touchable';\n" + content;
      }
    }
    
    // We intentionally don't try to remove TouchableOpacity from react-native imports 
    // to avoid breaking complex multi-line imports. 
    // We can run a linter later if we care, or just leave it.

    fs.writeFileSync(file, content, 'utf8');
    console.log('Updated:', file);
    updatedCount++;
  }
});

console.log(`Successfully updated ${updatedCount} files.`);
