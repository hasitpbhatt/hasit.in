const ts = require('typescript');
const code = 'import { useCallback } from "react";\nconst x = useCallback(async <T>(p: string): Promise<T> => { return null as any; }, []);';
const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);
const program = ts.createProgram(['test.ts'], { 
  skipLibCheck: true, 
  jsx: ts.JsxEmit.ReactJSX, 
  target: ts.ScriptTarget.ES2023,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  module: ts.ModuleKind.ESNext,
});
const checker = program.getTypeChecker();
const diagnostics = program.getSyntacticDiagnostics(sourceFile);
console.log('Syntactic diagnostics:', diagnostics.length);
diagnostics.forEach(d => {
  console.log('  ', d.messageText, 'at', d.start, 'length', d.length);
});
try {
  const semanticDiagnostics = program.getSemanticDiagnostics(sourceFile);
  console.log('Semantic diagnostics:', semanticDiagnostics.length);
  semanticDiagnostics.forEach(d => {
    console.log('  ', d.messageText, 'at', d.start, 'length', d.length);
  });
} catch (e) {
  console.log('Error:', e.message);
}