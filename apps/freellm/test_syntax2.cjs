const ts = require('typescript');
const code = 'import { useCallback } from "react";\nconst x = useCallback(async <T>(p: string): Promise<T> => { return null; }, []);';
const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);
const program = ts.createProgram(['test.ts'], { 
  skipLibCheck: true, 
  jsx: ts.JsxEmit.ReactJSX, 
  target: ts.ScriptTarget.ES2023,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  module: ts.ModuleKind.ESNext,
});
try {
  const syntacticDiagnostics = program.getSyntacticDiagnostics(sourceFile);
  console.log('Syntactic diagnostics:', syntacticDiagnostics.length);
  syntacticDiagnostics.forEach(d => {
    console.log('  ', d.messageText, 'at', d.start, 'length', d.length);
  });
} catch (e) {
  console.log('Error:', e.message);
}