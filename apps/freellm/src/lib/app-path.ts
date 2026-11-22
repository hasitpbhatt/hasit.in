export function appPath(path: string, basePath: string): string {
  const base = basePath.replace(/\/+$/, '')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  if (!base || normalizedPath === base || normalizedPath.startsWith(`${base}/`)) {
    return normalizedPath
  }
  return `${base}${normalizedPath}`
}
