import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'banana.bulkimagegeneration.com',
        port: '',
        pathname: '/**',
      },
    ],
    unoptimized: false,
    domains: ['localhost'],
  },
  async rewrites() {
    return [
      {
        source: '/inspiration-images/:path*',
        destination: '/api/images/:path*',
      },
    ];
  },
};

export default nextConfig;
