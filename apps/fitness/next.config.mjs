/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'export',
  basePath: '/apps/fitness',
  assetPrefix: '/apps/fitness/',
  trailingSlash: true,
  images: { unoptimized: true },
};
export default nextConfig;
