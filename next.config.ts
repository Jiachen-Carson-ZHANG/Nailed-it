import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  experimental: {
    serverActions: {
      allowedOrigins: [
        '*.dev.coze.site',
        '*.sandbox-dev.coze-coding.bytedance.net',
      ],
    },
  },
};

export default nextConfig;
