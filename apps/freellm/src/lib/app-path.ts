// Each SPA is served from the root of its own subdomain, so build bases must
// never leak into browser routes.
export function appBase(basePath: string): string {
  return (basePath || '').replace(/\/+$/, '')
}

export function appPath(path: string, basePath: string): string {
  const base = appBase(basePath)
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  if (!base || normalizedPath === base || normalizedPath.startsWith(`${base}/`)) {
    return normalizedPath
  }
  return `${base}${normalizedPath}`
}
