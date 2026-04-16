import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  // Disable image optimization for static export
  images: {
    unoptimized: true,
  },
  // Disable static generation for dynamic routes to prevent memory issues
  serverExternalPackages: [],
  // Reduce memory usage during build
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
  }
};

export default nextConfig;
