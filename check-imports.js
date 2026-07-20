const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('src');
files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  const imports = content.match(/from ['"]([^'"]+)['"]/g);
  if (imports) {
    imports.forEach(imp => {
      const p = imp.slice(6, -1);
      if (p.startsWith('.') || p.startsWith('@/')) {
        console.log(f + ' -> ' + p);
      }
    });
  }
});
