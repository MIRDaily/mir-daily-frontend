import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'piodbnhiwgntpjxbqqlw.supabase.co',
        pathname: '/storage/v1/object/public/avatars/**',
      },
    ],
  },
  turbopack: {
    resolveAlias: {
      tailwindcss: path.resolve(__dirname, 'node_modules/tailwindcss'),
    },
  },
};

export default nextConfig;