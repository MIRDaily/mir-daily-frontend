import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Versión que viaja en los reportes de contenido: el commit que desplegó
  // Vercel (VERCEL_GIT_COMMIT_SHA solo existe allí; en local sale 'dev').
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ?? 'dev',
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'piodbnhiwgntpjxbqqlw.supabase.co',
        pathname: '/storage/v1/object/public/avatars/**',
      },
    ],
  },
};

export default nextConfig;
