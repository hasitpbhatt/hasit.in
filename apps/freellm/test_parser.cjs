const ts = require('typescript');
const fs = require('fs');
const code = fs.readFileSync('src/lib/auth.tsx', 'utf8');
const sourceFile = ts.createSourceFile('auth.tsx', code, ts.ScriptTarget.Latest, true);
const diagnostics = ts.getPreEmitDiagnostics(sourceFile);
console.log('Diagnostics:', diagnostics.length);
diagnostics.forEach(d => {
  console.log('  ', d.messageText, 'at', d.start, 'length', d.length);
});