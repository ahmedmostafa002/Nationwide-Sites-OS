import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Disable standalone output to avoid Windows symlink issues during build.
  // Netlify's Next.js plugin handles the server build output automatically.
  serverExternalPackages: [],
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    if (!dev && !isServer) {
      config.optimization.splitChunks.cacheGroups = {
        ...config.optimization.splitChunks.cacheGroups,
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        }
      };
    }
    return config;
  },
  outputFileTracingIncludes: {
    '/**': ['./data/**/*'],
  },
};

export default nextConfig;
