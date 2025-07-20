/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    };
    config.externals.push('pino-pretty', 'lokijs', 'encoding')
    return config
  },
  // Disable source maps in development to avoid URL parameter issues
  productionBrowserSourceMaps: false,
}

module.exports = nextConfig 