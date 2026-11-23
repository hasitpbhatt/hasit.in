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
const checker = program.getTypeChecker();
const varDecl = sourceFile.statements[1].declarationList.declarations[0];
const callExpr = varDecl.initializer;
const arrowFn = callExpr.arguments[0];
console.log('ArrowFunction:', arrowFn.kind === ts.SyntaxKind.ArrowFunction);
console.log('TypeParameters:', arrowFn.typeParameters?.map(t => t.getText()));
const signature = checker.getSignatureFromDeclaration(arrowFn);
console.log('Signature:', signature);
if (signature) {
  console.log('TypeParameters:', signature.typeParameters?.map(t => t.getName()));
}