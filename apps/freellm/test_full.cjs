const ts = require('typescript');
const fs = require('fs');
const code = fs.readFileSync('src/lib/auth.tsx', 'utf8');
const sourceFile = ts.createSourceFile('auth.tsx', code, ts.ScriptTarget.Latest, true);
const program = ts.createProgram(['auth.tsx'], { 
  skipLibCheck: true, 
  jsx: ts.JsxEmit.ReactJSX, 
  target: ts.ScriptTarget.ES2023,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  module: ts.ModuleKind.ESNext,
});
const diagnostics = program.getSyntacticDiagnostics(sourceFile);
console.log('Syntactic diagnostics:', diagnostics.length);
diagnostics.forEach(d => {
  console.log('  ', d.messageText, 'at', d.start, 'length', d.length);
});
const semanticDiagnostics = program.getSemanticDiagnostics(sourceFile);
console.log('Semantic diagnostics:', semanticDiagnostics.length);
semanticDiagnostics.forEach(d => {
  console.log('  ', d.messageText, 'at', d.start, 'length', d.length);
});