const ts = require('typescript');
const code = 'import { useCallback, useEffect, useState, type ReactNode } from "react";\nimport { api } from "./api";\nimport { AuthContext } from "./authContext";\nimport type { User } from "./types";\nconst AUTH_DOMAIN = "https://auth.hasit.in";\nexport function AuthProvider({ children }: { children: ReactNode }) {\n  const [user, setUserState] = useState<User | null>(null);\n  const [loading, setLoadingState] = useState(true);\n  const [accessToken, setAccessTokenState] = useState<string | null>(() => {\n    if (typeof window !== "undefined") {\n      return localStorage.getItem("freellm_access_token");\n    }\n    return null;\n  });\n  const authenticatedFetch = useCallback(async <T>(path: string, init?: RequestInit): Promise<T> => {\n    return null as any;\n  }, [accessToken]);\n}';
const sourceFile = ts.createSourceFile('auth.tsx', code, ts.ScriptTarget.Latest, true);
const program = ts.createProgram(['auth.tsx'], { 
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