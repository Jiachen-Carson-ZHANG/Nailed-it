import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The dev-mode overlay badge sits bottom-left and collides with the 今日 bottom-tab.
  // Live agent-round demos run in dev (the round trigger is dev-only), so hide it for a clean stage.
  devIndicators: false,
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
