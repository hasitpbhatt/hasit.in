const ts = require('typescript');
const code = 'import { useCallback } from "react";\n\nconst authenticatedFetch = useCallback(async <T>(path: string, init?: RequestInit): Promise<T> => {\n  return null as any;\n}, []);';
const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);
const diagnostics = ts.getPreEmitDiagnostics(sourceFile);
console.log('Diagnostics:', diagnostics.length);
diagnostics.forEach(d => {
  console.log('  ', d.messageText, 'at', d.start, 'length', d.length);
});