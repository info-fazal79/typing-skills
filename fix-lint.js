const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      if (!file.includes('node_modules') && !file.includes('.next')) {
        results = results.concat(walk(file));
      }
    } else {
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('.');
files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  let changed = false;
  
  // catch (e: any) -> catch (e)
  if (content.match(/catch\s*\(\s*(\w+)\s*:\s*any\s*\)/)) {
    content = content.replace(/catch\s*\(\s*(\w+)\s*:\s*any\s*\)/g, 'catch ($1)');
    changed = true;
  }
  
  // (a: any) -> (a: unknown) or similar for other cases, but only in mapping? 
  // Wait, let's just do a generic replace for explicit any if it's easy, or just use regex.
  // Actually, many instances of `: any` are just type declarations.
  // We can just use `any` -> `unknown` if it's safe, but that might cause type errors.
  
  // Remove unused imports in admin page
  if (f.includes('admin\\\\page.tsx') || f.includes('admin/page.tsx')) {
    content = content.replace(/AlertTriangle, /g, '');
    content = content.replace(/Award, /g, '');
    content = content.replace(/Calendar, /g, '');
    content = content.replace(/Edit2, /g, '');
    content = content.replace(/Check, /g, '');
    content = content.replace(/catch \(\w+\) \{/g, 'catch {');
    content = content.replace(/setFilter/g, 'setFilter'); // Just to mark if anything else
    changed = true;
  }
  
  if (changed) {
    fs.writeFileSync(f, content);
    console.log('Fixed', f);
  }
});
